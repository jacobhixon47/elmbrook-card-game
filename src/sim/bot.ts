import { codex } from '../codex';
import {
  NIGHT_SHIFT_DAY, payout, previewBrew, rentDue, satisfies, tierIndex,
  type Action, type BrewPreview, type CardInstance, type Order, type Potion, type RunState,
} from '../core';
import { targetsOf } from '../core/effects';
import { fencePrice } from '../core/reduce';
import { nextFloat, type RngState } from '../core/rng';

// Headless players for `pnpm sim`. They only read state and return actions, like the UI does.

export type Strategy = 'greedy' | 'random';

type Plan = { cards: CardInstance[]; preview: Extract<BrewPreview, { kind: 'potion' }>; deliverTo?: number; value: number };

function combos<T>(items: readonly T[], min: number, max: number): T[][] {
  const out: T[][] = [];
  const pickFrom = (start: number, acc: T[]) => {
    if (acc.length >= min) out.push(acc.slice());
    if (acc.length === max) return;
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      pickFrom(i + 1, acc);
      acc.pop();
    }
  };
  pickFrom(0, []);
  return out;
}

const keyOf = (cards: readonly CardInstance[]) => cards.map((c) => `${c.card}:${c.aged ?? 0}`).sort().join('|');

/** Every distinct brew the hand and cauldron could make right now, scored. */
function brewOptions(s: RunState): Plan[] {
  // Sorted so the plan doesn't flip between equal options as cards move into the cauldron.
  const pool = [...s.cauldron, ...s.hand].filter((c) => codex.ingredients.has(c.card)).sort((a, b) => a.uid - b.uid);
  const seen = new Set<string>();
  const out: Plan[] = [];
  for (const cards of combos(pool, 2, s.cauldronSlots)) {
    const key = keyOf(cards);
    if (seen.has(key)) continue;
    seen.add(key);
    const rest = pool.filter((c) => !cards.includes(c));
    const preview = previewBrew(s, cards, rest);
    if (preview.kind !== 'potion' || preview.discardCost > s.discardsLeft) continue;
    out.push({ cards, preview, value: 0 });
  }
  return out;
}

function asPotion(p: Plan): Potion {
  return {
    uid: 0, recipe: p.preview.recipe, family: p.preview.family, quality: p.preview.quality, tier: p.preview.tier,
    ingredients: p.cards.map((c) => c.card), experiment: !p.preview.known, heartDelta: 0,
  };
}

function orderValue(potion: Potion, order: Order): number {
  const { pay, tip } = payout(potion, order);
  return pay + tip;
}

/** Steps the cauldron toward `plan`: unslot strays, slot what's missing, then brew. */
function stepToward(s: RunState, plan: Plan): Action {
  const want = new Set(plan.cards.map((c) => c.uid));
  const stray = s.cauldron.find((c) => !want.has(c.uid));
  if (stray) return { type: 'unslot', uid: stray.uid };
  const missing = plan.cards.find((c) => !s.cauldron.some((k) => k.uid === c.uid));
  if (missing) return { type: 'slot', uid: missing.uid };
  return plan.deliverTo === undefined ? { type: 'brew' } : { type: 'brew', deliverTo: plan.deliverTo };
}

const TINCTURE_VALUE: Record<string, number> = { 'bottle-spare': 9, steep: 8, stir: 5, forage: 4, sift: 4 };

function cardValue(s: RunState, id: string): number {
  if (codex.tinctures.has(id)) return TINCTURE_VALUE[id] ?? 3;
  const ing = codex.ingredients.get(id);
  if (!ing) return -10;
  const known = s.knownRecipes.map((r) => codex.recipes.get(r)!);
  const fits = ing.essences.filter((e) => known.some((r) => r.pattern.includes(e))).length;
  return ing.potency + 2 * fits;
}

function greedyBrewing(s: RunState): Action {
  const open = s.orders.filter((o) => o.status === 'open');

  // Fill from the Shelf first: it costs nothing.
  for (const o of [...open].sort((a, b) => b.pay - a.pay)) {
    const p = s.shelf.filter((x) => satisfies(x, o)).sort((a, b) => orderValue(b, o) - orderValue(a, o))[0];
    if (p) return { type: 'deliver', order: o.id, potion: p.uid };
  }
  if (s.brewsLeft <= 0) return { type: 'endDay' };

  const options = brewOptions(s);
  let best: Plan | null = null;
  for (const plan of options) {
    const potion = asPotion(plan);
    for (const o of open) {
      if (!satisfies(potion, o)) continue;
      const value = orderValue(potion, o);
      if (!best || value > best.value) best = { ...plan, deliverTo: o.id, value };
    }
  }

  const tinctures = s.hand.filter((c) => codex.tinctures.has(c.card));
  const decant = tinctures.find((c) => targetsOf(c.card) === 'shelf-one');
  const dull = s.shelf.find((p) => tierIndex(p.tier) < tierIndex('superb'));
  if (decant && dull) return { type: 'playTincture', uid: decant.uid, targets: [dull.uid] };
  const peek = tinctures.find((c) => targetsOf(c.card) === 'top-3');
  if (peek) return { type: 'playTincture', uid: peek.uid };
  if (best) {
    // Buff the brew first; Steep and Bottle Spare are worth spending on an order.
    // Any Tincture that needs no target is played before the brew it helps.
    const buff = tinctures.find((c) => !targetsOf(c.card));
    if (buff && s.cauldron.length === 0) return { type: 'playTincture', uid: buff.uid };
    const infuse = tinctures.find((c) => targetsOf(c.card) === 'hand-one');
    const strongest = best.cards[0];
    if (infuse && strongest && s.cauldron.length === 0) return { type: 'playTincture', uid: infuse.uid, targets: [strongest.uid] };
    return stepToward(s, best);
  }

  if (open.length > 0) {
    // Hunt for the right cards.
    const forage = tinctures.find((c) => c.card === 'forage');
    if (forage) return { type: 'playTincture', uid: forage.uid };
    const wanted = new Set(
      open.flatMap((o) =>
        [...codex.recipes.values()]
          .filter((r) => (o.request.kind === 'recipe' ? r.id === o.request.recipe : r.family === o.request.family))
          .filter((r) => r.pattern.length <= s.cauldronSlots)
          .flatMap((r) => r.pattern),
      ),
    );
    const useless = s.hand
      .filter((c) => {
        const ing = codex.ingredients.get(c.card);
        if (codex.tinctures.has(c.card)) return false;
        return !ing || !ing.essences.some((e) => wanted.has(e) || wanted.has('any'));
      })
      .sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card));
    const weakest = s.hand
      .filter((c) => codex.ingredients.has(c.card))
      .sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card))
      .slice(0, 2);
    const toss = (useless.length ? useless : weakest).slice(0, 5);
    const sift = tinctures.find((c) => c.card === 'sift');
    if (sift && toss.length) return { type: 'playTincture', uid: sift.uid, targets: toss.map((c) => c.uid) };
    if (s.discardsLeft > 0 && toss.length) {
      if (s.cauldron.length) return { type: 'unslot', uid: s.cauldron[0]!.uid };
      return { type: 'discard', uids: toss.map((c) => c.uid) };
    }
  }

  // Nothing fills an order: brew the most valuable potion for the Shelf (and to cycle cards).
  const room = s.shelf.length < s.shelfSize;
  const shelfPlan = options
    .filter((p) => p.preview.known)
    .map((p) => ({ ...p, value: fencePrice(asPotion(p)) + p.preview.quality / 100 }))
    .sort((a, b) => b.value - a.value)[0];
  if (shelfPlan && (room || open.length > 0)) return stepToward(s, shelfPlan);
  return { type: 'endDay' };
}

function greedyDusk(s: RunState): Action {
  const offer = s.offer!;
  const deck = [...s.drawPile, ...s.hand, ...s.discardPile];
  const reserve = Math.round(rentDue(s.season, s.week) * (s.day / NIGHT_SHIFT_DAY));
  switch (offer.kind) {
    case 'reward': {
      const scored = offer.cards.map((card, index) => ({ index, v: cardValue(s, card) }));
      const top = scored.sort((a, b) => b.v - a.v)[0]!;
      return deck.length >= 24 || top.v < 5 ? { type: 'skipReward' } : { type: 'pickReward', index: top.index };
    }
    case 'errands': {
      const sludge = deck.some((c) => c.card === 'sludge');
      const order: ('hearth' | 'market' | 'forage')[] = sludge ? ['hearth', 'forage', 'market'] : s.gold - reserve >= 8 ? ['market', 'forage', 'hearth'] : ['forage', 'market', 'hearth'];
      return { type: 'chooseErrand', errand: order.find((e) => offer.options.includes(e))! };
    }
    case 'market': {
      const spare = s.gold - reserve;
      const slot = offer.stock.findIndex((i) => i.kind === 'cauldron-slot' && !i.sold && i.price <= spare);
      if (slot >= 0) return { type: 'buy', index: slot };
      const card = offer.stock
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.kind === 'card' && !item.sold && item.price <= spare)
        .map(({ item, index }) => ({ index, v: item.kind === 'card' ? cardValue(s, item.card) : 0 }))
        .sort((a, b) => b.v - a.v)[0];
      if (card && card.v >= 7 && deck.length < 24) return { type: 'buy', index: card.index };
      return { type: 'leaveErrand' };
    }
    case 'forage': {
      if (offer.picksLeft <= 0 || deck.length >= 24) return { type: 'leaveErrand' };
      const best = offer.cards.map((card, index) => ({ index, v: cardValue(s, card) })).sort((a, b) => b.v - a.v)[0];
      return best && best.v >= 6 ? { type: 'forage', index: best.index } : { type: 'leaveErrand' };
    }
    case 'hearth': {
      if (offer.removed || deck.length <= 10) return { type: 'leaveErrand' };
      const worst = deck.slice().sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card))[0]!;
      return cardValue(s, worst.card) < 6 ? { type: 'removeCard', uid: worst.uid } : { type: 'leaveErrand' };
    }
    case 'fence':
      return s.shelf[0] ? { type: 'sellPotion', uid: s.shelf[0].uid } : { type: 'leaveMarket' };
  }
}

export function greedyAction(s: RunState): Action {
  switch (s.phase) {
    case 'morning':
      return { type: 'openShop' };
    case 'brewing':
      return greedyBrewing(s);
    case 'dusk':
    case 'night-market':
      return greedyDusk(s);
    default:
      throw new Error(`run is over (${s.phase})`);
  }
}

/** A fuzzing player: random actions, many of them illegal. Proves the rules never crash or corrupt. */
export function randomAction(s: RunState, rng: RngState): [Action, RngState] {
  let r = rng;
  const roll = (n: number) => {
    const [f, next] = nextFloat(r);
    r = next;
    return Math.floor(f * n);
  };
  const any = <T>(xs: readonly T[]): T | undefined => (xs.length ? xs[roll(xs.length)] : undefined);
  const hand = s.hand.map((c) => c.uid);
  const candidates: Action[] = [{ type: 'endDay' }, { type: 'openShop' }, { type: 'leaveErrand' }, { type: 'leaveMarket' }, { type: 'skipReward' }];
  const card = any(hand) ?? 0;
  const order = any(s.orders.map((o) => o.id)) ?? 0;
  const potion = any(s.shelf.map((p) => p.uid)) ?? 0;
  candidates.push(
    { type: 'slot', uid: card },
    { type: 'slot', uid: card },
    { type: 'slot', uid: card },
    { type: 'unslot', uid: any(s.cauldron.map((c) => c.uid)) ?? 0 },
    { type: 'brew' },
    { type: 'brew', deliverTo: order },
    { type: 'brew', deliverTo: order },
    { type: 'discard', uids: hand.filter(() => roll(3) === 0) },
    { type: 'playTincture', uid: card, targets: hand.filter(() => roll(3) === 0) },
    { type: 'deliver', order, potion },
    { type: 'decline', order },
    { type: 'pickReward', index: roll(4) },
    { type: 'chooseErrand', errand: any(['market', 'forage', 'hearth'] as const)! },
    { type: 'buy', index: roll(7) },
    { type: 'forage', index: roll(5) },
    { type: 'removeCard', uid: any([...s.drawPile, ...s.hand, ...s.discardPile].map((c) => c.uid)) ?? 0 },
    { type: 'sellPotion', uid: potion },
  );
  // Weight away from ending the day so random runs actually brew.
  const a = roll(10) === 0 ? candidates[roll(5)]! : candidates[5 + roll(candidates.length - 5)]!;
  return [a, r];
}

export function isOver(s: RunState): boolean {
  return s.phase === 'game-over' || s.phase === 'victory';
}
