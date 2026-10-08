import { codex } from '../codex';
import {
  allCards, fits, NIGHT_SHIFT_DAY, payout, previewBrew, rentDue, tierIndex, WEEKS,
  type Action, type BrewPreview, type CardInstance, type Order, type Potion, type RunState, type StallState, type StockItem,
} from '../core';
import { targetsOf } from '../core/effects';
import { brewBlocked, isSatchelCard } from '../core/night';
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
    if (preview.kind !== 'potion' || preview.discardCost > s.discardsLeft || brewBlocked(s, cards)) continue;
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

/** What the bot thinks each Tincture is worth when picking rewards and shopping (about an ingredient's Potency). */
const TINCTURE_VALUE: Record<string, number> = {
  'second-wind': 10, 'bottle-spare': 9, 'double-boil': 9, steep: 8, infuse: 7, 'pinch-of-salt': 6, 'tidy-up': 6, decant: 6,
  stir: 5, simmer: 5, 'grimoire-page': 5, 'charm-sachet': 5, forage: 4, sift: 4, 'taste-test': 3,
  // Omens: Night Satchel only, so they never thin the day deck.
  'blood-moon': 9, 'witching-hour': 8, 'wishing-star': 7, howl: 6, 'raven-call': 6, 'moth-swarm': 6, 'cracked-mirror': 5, 'black-cat-crossing': 4,
};

/** Sell the weakest familiar when one worth `v` would be clearly better and every slot is taken. */
function makeRoom(s: RunState, v: number): Action | null {
  if (s.familiars.length < s.familiarSlots) return null;
  const worst = s.familiars.map((id, index) => ({ index, v: familiarValue(s, id) })).sort((a, b) => a.v - b.v)[0];
  return worst && v >= worst.v + 5 ? { type: 'sellFamiliar', index: worst.index } : null;
}

/** Buy the best familiar on sale worth having, making room first if needed. */
function buyFamiliar(s: RunState, stock: readonly StockItem[], spare: number): Action | null {
  const best = stock
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'familiar' && !item.sold && item.price <= spare)
    .map(({ item, index }) => ({ index, v: item.kind === 'familiar' ? familiarValue(s, item.familiar) : 0 }))
    .sort((a, b) => b.v - a.v)[0];
  if (!best || best.v < 7) return null;
  return makeRoom(s, best.v) ?? (s.familiars.length < s.familiarSlots ? { type: 'buy', index: best.index } : null);
}

/** How much a familiar would help this deck, on the same scale as cardValue. */
export function familiarValue(s: RunState, id: string): number {
  const f = codex.familiars.get(id);
  if (!f) return -10;
  const deck = allCards(s).map((c) => codex.ingredients.get(c.card)).filter((i) => i !== undefined);
  const share = (test: (i: (typeof deck)[number]) => boolean) => deck.filter(test).length / Math.max(1, deck.length);
  const has = (e: string) => share((i) => i.essences.includes(e as never));
  switch (id) {
    case 'will-o-wisp': return 16;
    case 'old-hound': return s.cauldronSlots >= 3 ? 14 : 4;
    case 'hob': return 12;
    case 'black-cat': return 4 + 30 * has('umbra');
    case 'hedgehog': return 4 + 40 * has('stone');
    case 'heron': return 4 + 30 * has('tide');
    case 'salamander': return 4 + 30 * has('ember');
    case 'garden-snail': return 4 + 20 * share((i) => i.essences.length === 2);
    case 'jackdaw': return 10;
    case 'otter': return 9;
    case 'hearth-toad': return 7;
    case 'firefly': return 6;
    case 'frost-hare': return 2 + 20 * share((i) => i.tags.includes('frost'));
    case 'tortoise': case 'magpie': return 7;
    case 'fox': return 6;
    case 'ferret': return 5;
    case 'moth': return 3 + 4 * s.satchel.length;
    default: return 2;
  }
}

function cardValue(s: RunState, id: string): number {
  if (codex.tinctures.has(id)) {
    // A first copy adds a new trick to the deck; each extra copy is worth less.
    const owned = [...s.drawPile, ...s.hand, ...s.discardPile].filter((c) => c.card === id).length;
    return (TINCTURE_VALUE[id] ?? 3) + (owned ? -3 * owned : 3);
  }
  const ing = codex.ingredients.get(id);
  if (!ing) return -10;
  const known = s.knownRecipes.map((r) => codex.recipes.get(r)!);
  const fits = ing.essences.filter((e) => known.some((r) => r.pattern.includes(e))).length;
  return ing.potency + 2 * fits;
}

function greedyBrewing(s: RunState): Action {
  // Fog hides the orders: spend one Discard on the weakest card to see them, or brew blind.
  if (s.fog) {
    const weakest = [...s.hand].sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card))[0];
    if (s.discardsLeft > 1 && weakest && s.cauldron.length === 0) return { type: 'discard', uids: [weakest.uid] };
    const blind = brewOptions(s).filter((p) => p.preview.known).sort((a, b) => b.preview.quality - a.preview.quality)[0];
    if (blind && s.brewsLeft > 0) return stepToward(s, { ...blind, deliverTo: undefined });
    if (weakest && s.discardsLeft > 0) return s.cauldron.length ? { type: 'unslot', uid: s.cauldron[0]!.uid } : { type: 'discard', uids: [weakest.uid] };
    return { type: 'endDay' };
  }
  const open = s.orders.filter((o) => o.status === 'open');

  // Fill from the Shelf first: it costs nothing.
  for (const o of [...open].sort((a, b) => b.pay - a.pay)) {
    const p = s.shelf.filter((x) => fits(s, x, o)).sort((a, b) => orderValue(b, o) - orderValue(a, o))[0];
    if (p) return { type: 'deliver', order: o.id, potion: p.uid };
  }
  if (s.brewsLeft <= 0) return { type: 'endDay' };

  const options = brewOptions(s);
  let best: Plan | null = null;
  for (const plan of options) {
    const potion = asPotion(plan);
    for (const o of open) {
      if (!fits(s, potion, o)) continue;
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
      const fam = buyFamiliar(s, offer.stock, spare);
      if (fam) return fam;
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
    case 'gift': {
      if (offer.into === 'familiar') {
        const best = offer.cards.map((id, index) => ({ index, id, v: familiarValue(s, id) })).sort((a, b) => b.v - a.v)[0]!;
        return makeRoom(s, best.v) ?? (s.familiars.length < s.familiarSlots ? { type: 'takeGift', index: best.index } : { type: 'passGift' });
      }
      // Satchel cards are free and never thin the day deck; deck cards are taken like rewards.
      const best = offer.cards.map((card, index) => ({ index, v: cardValue(s, card) })).sort((a, b) => b.v - a.v)[0]!;
      return offer.into === 'satchel' || (deck.length < 24 && best.v >= 5) ? { type: 'takeGift', index: best.index } : { type: 'passGift' };
    }
    case 'night-market': {
      // Visit the first stall with something worth doing, do it there, then pay rent.
      const wants = (stall: StallState): Action | null => stallAction(s, stall);
      if (offer.at !== null) return wants(offer.stalls[offer.at]!) ?? { type: 'leaveStall' };
      const next = offer.stalls.findIndex((x) => wants(x) !== null);
      return next >= 0 ? { type: 'visitStall', index: next } : { type: 'leaveMarket' };
    }
  }
}

/** Satchel cards past this many rarely get drawn on a Night Shift. */
const SATCHEL_WANT = 4;
const NEXT_RENT_RESERVE = 0.5;

/** What the greedy bot does at a Night Market stall, or null when it has no use for it. */
function stallAction(s: RunState, stall: StallState): Action | null {
  // Keep tonight's rent and half of next week's: rent more than doubles each week.
  const spare = s.gold - rentDue(s.season, s.week) - (s.week < WEEKS ? Math.round(rentDue(s.season, s.week + 1) * NEXT_RENT_RESERVE) : 0);
  switch (stall.id) {
    case 'fence':
      return s.shelf[0] ? { type: 'sellPotion', uid: s.shelf[0].uid } : null;
    case 'lantern-seller': {
      // Satchel cards only help on later Night Shifts, and only a handful get drawn.
      if (s.week >= WEEKS || s.satchel.length + allCards(s).filter((c) => isSatchelCard(c.card)).length >= SATCHEL_WANT) return null;
      const best = stall.stock
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.kind === 'card' && !item.sold && item.price <= spare)
        .map(({ item, index }) => ({ index, v: item.kind === 'card' ? cardValue(s, item.card) : 0 }))
        .sort((a, b) => b.v - a.v)[0];
      return best ? { type: 'buy', index: best.index } : null;
    }
    case 'wandering-tinker': {
      const slot = stall.stock.findIndex((i) => i.kind === 'cauldron-slot' && !i.sold && i.price <= spare);
      return slot >= 0 ? { type: 'buy', index: slot } : buyFamiliar(s, stall.stock, spare);
    }
    default:
      // The Moth Broker, the Hollow Tailor, the Fortune Tent and the Black Market: the random bot covers them.
      return null;
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
  const deckUids = allCards(s).map((c) => c.uid);
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
    { type: 'takeGift', index: roll(4) },
    { type: 'passGift' },
    { type: 'chooseErrand', errand: any(['market', 'forage', 'hearth'] as const)! },
    { type: 'buy', index: roll(7) },
    { type: 'forage', index: roll(5) },
    { type: 'removeCard', uid: any([...s.drawPile, ...s.hand, ...s.discardPile].map((c) => c.uid)) ?? 0 },
    { type: 'sellPotion', uid: potion },
    { type: 'sellFamiliar', index: roll(5) },
    { type: 'moveFamiliar', from: roll(5), to: roll(5) },
    { type: 'visitStall', index: roll(7) },
    { type: 'visitStall', index: roll(7) },
    { type: 'leaveStall' },
    { type: 'forgetRecipe', recipe: any(s.knownRecipes) ?? '' },
    { type: 'brokerPick', index: roll(3) },
    { type: 'weave', from: any(deckUids) ?? 0, into: any(deckUids) ?? 0 },
    { type: 'drawTarot' },
    { type: 'swapForCard', index: roll(3), uids: [any(deckUids) ?? 0, any(deckUids) ?? 0] },
  );
  // Weight away from ending the day so random runs actually brew.
  const a = roll(10) === 0 ? candidates[roll(5)]! : candidates[5 + roll(candidates.length - 5)]!;
  return [a, r];
}

export function isOver(s: RunState): boolean {
  return s.phase === 'game-over' || s.phase === 'victory';
}
