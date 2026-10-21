import type { ModifierId } from '../codex/schema';
import { codex } from '../codex';
import {
  allCards, cheapestPotion, CIDER_PRESS, commonCards, dueWeekOf, EVENT_GOLD, eventChoiceAsk, eventChoiceBlocked, eventDone, fits, FIREFLY_GAMES, HARVEST_AUCTION, FRIENDSHIP, hearthOffers, HOLLY_CROWN, YULE_LOG,
  MIN_DECK, NECTAR_TRADER, NIGHT_SHIFT_DAY, payout, pressable, previewBrew, rentOf, SEED_SWAPPER, tierIndex, WEEKS,
  type Action, type BrewPreview, type CardInstance, type Errand, type Order, type Potion, type RunState, type StallState, type StockItem,
} from '../core';
import { effectsOf, targetsOf } from '../core/effects';
import { cantModify, cardPotency, MODIFIER_RULES } from '../core/modifiers';
import { brewBlocked, isSatchelCard } from '../core/night';
import { fencePrice } from '../core/reduce';
import { nextFloat, seedRng, type RngState } from '../core/rng';

// Headless players for `pnpm sim`. They only read state and return actions, like the UI does.

/** `greedy` plays as well as the bot knows how; the personas play like people do (see PERSONAS); `random` fuzzes. */
export type Strategy = 'greedy' | Persona | 'random';
export type Persona = 'skilled' | 'casual' | 'novice';

type Plan = { cards: CardInstance[]; preview: Extract<BrewPreview, { kind: 'potion' }>; deliverTo?: number; value: number; /** Which recipe to brew, when the cards fit more than one. */ recipe?: string };

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

const keyOf = (cards: readonly CardInstance[]) => cards.map((c) => `${c.card}:${c.aged ?? 0}:${c.bonus ?? 0}:${c.modifier ?? ''}`).sort().join('|');

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
    if (preview.options.length < 2) {
      out.push({ cards, preview, value: 0 });
      continue;
    }
    // The cards fit more than one recipe: each is its own plan, named when brewed.
    for (const recipe of preview.options) {
      const alt = recipe === preview.recipe ? preview : previewBrew(s, cards, rest, recipe);
      if (alt.kind === 'potion') out.push({ cards, preview: alt, value: 0, recipe });
    }
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
  const recipe = plan.recipe === undefined ? {} : { recipe: plan.recipe };
  return plan.deliverTo === undefined ? { type: 'brew', ...recipe } : { type: 'brew', deliverTo: plan.deliverTo, ...recipe };
}

/** What the bot thinks each Tincture is worth when picking rewards and shopping (about an ingredient's Potency). */
const TINCTURE_VALUE: Record<string, number> = {
  'second-wind': 10, 'bottle-spare': 9, 'double-boil': 9, steep: 8, infuse: 7, 'pinch-of-salt': 6, 'tidy-up': 6, decant: 6,
  stir: 5, simmer: 5, 'grimoire-page': 5, 'charm-sachet': 5, forage: 4, sift: 4, 'taste-test': 3,
  // Omens: Night Satchel only, so they never thin the day deck.
  'blood-moon': 9, 'witching-hour': 8, 'wishing-star': 7, howl: 6, 'raven-call': 6, 'moth-swarm': 6, 'cracked-mirror': 5, 'black-cat-crossing': 4, 'yule-candle': 6,
  'royal-jelly': 6, 'beeswax-candle': 6, 'spring-mead': 9, garland: 4,
  'firefly-jar': 6, 'sun-bottle': 6, prism: 6, 'paper-fan': 4, 'spiced-cider': 8, perry: 6, 'mulling-spice': 4, 'threshing-flail': 5,
  gingerbread: 6, 'mulled-wine': 9, 'wool-mittens': 6, 'snow-globe': 4,
  'honey-loaf': 7, 'paper-star': 5, 'shrine-candle': 10, 'gilded-coin': 10,
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
    case 'ermine': return 2 + 30 * share((i) => i.tags.includes('frost'));
    case 'tortoise': case 'magpie': return 7;
    case 'fox': return 6;
    case 'ferret': return 5;
    case 'moth': return 3 + 4 * s.satchel.length;
    case 'bumblebee': return 2 + 30 * share((i) => i.tags.includes('flower'));
    case 'dragonfly': return 4 + 30 * has('gale');
    case 'badger': return 4 + 30 * has('umbra');
    case 'scarecrow': return 4 + 15 * has('vital');
    case 'cricket': return 6;
    case 'harvest-hare': return s.cauldronSlots >= 3 ? 8 : 2;
    case 'queen-bee': return 2 + 25 * share((i) => i.tags.includes('flower'));
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

// Rough quality one brew gains from each Creek option, with a typical brew of Potency 14 and Harmony 4.
const BREW_POTENCY = 14;
const BREW_HARMONY = 4;
function creekGain(card: CardInstance, mod: ModifierId | 'temper'): number {
  switch (mod) {
    case 'temper': return MODIFIER_RULES.temperPotency * BREW_HARMONY;
    case 'moonlit': return MODIFIER_RULES.moonlitHarmony * BREW_POTENCY;
    case 'blessed': return cardPotency(card) * BREW_HARMONY + (effectsOf(card.card).length ? 2 * BREW_POTENCY : 0);
    case 'aged': return 2 * 2 * BREW_HARMONY; // about two days between brews
    default: return 0;
  }
}

/** The sold modifier with the best gain over a free temper per gold, or undefined to temper. */
function bestModifier(card: CardInstance, spare: number): ModifierId | undefined {
  const temper = creekGain(card, 'temper');
  return [...codex.modifiers.values()]
    .filter((m) => m.price != null && m.price <= spare && !cantModify(card, m.id))
    .map((m) => ({ id: m.id, v: (creekGain(card, m.id) - temper) / m.price! }))
    .filter((m) => m.v > 1)
    .sort((a, b) => b.v - a.v)[0]?.id;
}

/**
 * How a player brews. The greedy bot plays every useful Tincture, hunts with Discard for orders it can't
 * fill, pours away cheap Shelf potions, and takes the best brew; a persona sometimes doesn't (see PERSONAS).
 */
type BrewStyle = {
  tinctures: boolean;
  hunt: boolean;
  pour: boolean;
  /** Which brew to make, from the candidates best first. */
  pick: (plans: readonly Plan[]) => Plan | undefined;
  /** Told the brew it chose, so a persona can stick to it while slotting. */
  chose?: (plan: Plan) => void;
};
const BEST: BrewStyle = { tinctures: true, hunt: true, pour: true, pick: (plans) => plans[0] };

function greedyBrewing(s: RunState, style: BrewStyle = BEST): Action {
  const go = (plan: Plan): Action => {
    style.chose?.(plan);
    return stepToward(s, plan);
  };
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
  const filling: Plan[] = [];
  for (const plan of options) {
    const potion = asPotion(plan);
    for (const o of open) if (fits(s, potion, o)) filling.push({ ...plan, deliverTo: o.id, value: orderValue(potion, o) });
  }
  // Stable, so the greedy bot takes the first of equal brews.
  const best = style.pick(filling.sort((a, b) => b.value - a.value));

  const tinctures = style.tinctures ? s.hand.filter((c) => codex.tinctures.has(c.card)) : [];
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
    return go(best);
  }

  if (open.length > 0 && style.hunt) {
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
  const shelfPlan = style.pick(options
    .filter((p) => p.preview.known)
    .map((p) => ({ ...p, value: fencePrice(asPotion(p), s) + p.preview.quality / 100 }))
    .sort((a, b) => b.value - a.value));
  if (shelfPlan && (room || open.length > 0)) return go(shelfPlan);
  // A full Shelf: pour away its cheapest potion (a Discard) when the new one would fetch clearly more.
  if (shelfPlan && !room && s.brewsLeft > 0 && s.discardsLeft > 0 && style.pour) {
    const worst = s.shelf.slice().sort((a, b) => fencePrice(a, s) - fencePrice(b, s))[0]!;
    if (fencePrice(asPotion(shelfPlan), s) > fencePrice(worst, s) + 1) return { type: 'pourOut', uid: worst.uid };
  }
  return { type: 'endDay' };
}

function greedyDusk(s: RunState): Action {
  const offer = s.offer!;
  const deck = [...s.drawPile, ...s.hand, ...s.discardPile];
  const reserve = Math.round(rentOf(s) * (s.day / NIGHT_SHIFT_DAY));
  switch (offer.kind) {
    case 'reward': {
      const scored = offer.cards.map((card, index) => ({ index, v: cardValue(s, card) }));
      const top = scored.sort((a, b) => b.v - a.v)[0]!;
      return deck.length >= 24 || top.v < 5 ? { type: 'skipReward' } : { type: 'pickReward', index: top.index };
    }
    case 'errands': {
      const sludge = deck.some((c) => c.card === 'sludge');
      const order: Errand[] = sludge
        ? ['hearth', 'creek', 'guild', 'forage', 'market', 'event']
        : s.gold - reserve >= 8 ? ['market', 'creek', 'guild', 'forage', 'event', 'hearth'] : ['creek', 'guild', 'forage', 'event', 'market', 'hearth'];
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
    case 'creek': {
      if (offer.done) return { type: 'leaveErrand' };
      // The modifier worth the most per gold on the strongest ingredient, else temper it for free.
      const best = deck
        .filter((c) => codex.ingredients.has(c.card) && !c.modifier)
        .sort((a, b) => cardPotency(b) - cardPotency(a))[0];
      if (!best) return { type: 'leaveErrand' };
      const forced = process.env.SIM_MOD as ModifierId | 'temper' | undefined;
      if (forced === 'temper') return { type: 'temper', uid: best.uid };
      const pick = forced ? (cantModify(best, forced) ? undefined : forced) : bestModifier(best, s.gold - reserve);
      const price = pick && codex.modifiers.get(pick)!.price;
      return pick && price != null && s.gold - reserve >= price ? { type: 'enchant', uid: best.uid, modifier: pick } : { type: 'temper', uid: best.uid };
    }
    case 'guild': {
      if (offer.taken) return { type: 'leaveErrand' };
      // The commission it's likeliest to finish in time, by how far its goal is from what the deck already does.
      const best = offer.options.map((id, index) => ({ index, v: commissionValue(s, id) })).sort((a, b) => b.v - a.v)[0];
      return best && best.v > 0 ? { type: 'takeCommission', index: best.index } : { type: 'leaveErrand' };
    }
    case 'event': {
      if (offer.chose !== null || eventDone(s, offer)) return { type: 'leaveErrand' };
      const index = eventPreference(s, offer.event, s.gold - reserve).find((i) => eventChoiceBlocked(s, offer.event, i) === null) ?? 0;
      const ask = eventChoiceAsk(s, offer.event, index);
      switch (ask?.kind) {
        case 'deck': {
          // Bless the strongest card; give the apprentice the weakest.
          const byPotency = ask.cards.slice().sort((a, b) => cardPotency(b) - cardPotency(a));
          const card = offer.event === 'apprentice-asks' ? byPotency.at(-1) : byPotency[0];
          return { type: 'chooseEvent', index, ...(card ? { uid: card.uid } : {}) };
        }
        case 'shelf': {
          const potion = ask.potions.slice().sort((a, b) => b.quality - a.quality)[0];
          return { type: 'chooseEvent', index, ...(potion ? { uid: potion.uid } : {}) };
        }
        case 'recipe':
          return { type: 'chooseEvent', index, pick: ask.recipes[0] };
        case 'card':
          return { type: 'chooseEvent', index, pick: ask.cards[0] };
        default:
          return { type: 'chooseEvent', index };
      }
    }
    case 'hearth': {
      if (offer.removed) return { type: 'leaveErrand' };
      // A Curse costs more than any one card.
      const worstCurse = s.curses.slice().sort((a, b) => curseCost(s, b) - curseCost(s, a))[0];
      if (worstCurse) return { type: 'liftCurse', curse: worstCurse };
      if (deck.length <= 10) return { type: 'leaveErrand' };
      const worst = deck.slice().sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card))[0]!;
      return cardValue(s, worst.card) < 6 ? { type: 'removeCard', uid: worst.uid } : { type: 'leaveErrand' };
    }
    case 'favour': {
      // Rook carries off the weakest card; the Toymaker tunes up the strongest ingredient.
      if (offer.job === 'burn') {
        const worst = deck.slice().sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card))[0];
        return worst && deck.length > 10 && cardValue(s, worst.card) < 6 ? { type: 'doFavour', uid: worst.uid } : { type: 'passGift' };
      }
      const best = deck.filter((c) => codex.ingredients.has(c.card)).sort((a, b) => cardPotency(b) - cardPotency(a))[0];
      return best ? { type: 'doFavour', uid: best.uid } : { type: 'passGift' };
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
    case 'fair': {
      // Buy the best thing worth having that leaves rent covered, then go home.
      const spare = s.gold - reserve;
      const best = offer.stalls
        .flatMap((stall, si) => stall.stock.map((item, index) => ({ stall: si, index, item })))
        .filter(({ item }) => !item.sold && item.price <= spare)
        .map(({ stall, index, item }) => ({
          stall, index, item,
          v: item.kind === 'card' ? (deck.length < 24 ? cardValue(s, item.card) : 0)
            : item.kind === 'familiar' ? (s.familiars.length < s.familiarSlots ? familiarValue(s, item.familiar) : 0)
            : item.kind === 'relic' ? relicValue(s, item.relic) : 0,
        }))
        .sort((a, b) => b.v - a.v)[0];
      return best && best.v >= 8 ? { type: 'buyAtFair', stall: best.stall, index: best.index } : { type: 'leaveErrand' };
    }
    case 'vigil': {
      // Any blessing helps the finale; prefer the ones that add Brews or ease the last order.
      if (offer.chose) return { type: 'leaveErrand' };
      const rank = ['hearthfire', 'starlight', 'old-songs', 'warm-hands', 'the-long-watch', 'candle-in-the-window'];
      const best = offer.blessings.map((id, index) => ({ index, r: rank.indexOf(id) })).sort((a, b) => a.r - b.r)[0]!;
      return { type: 'chooseBlessing', index: best.index };
    }
  }
}

/** Rough worth of a relic to the greedy bot, in gold-ish points. */
export function relicValue(s: RunState, id: string): number {
  const weeksLeft = WEEKS - s.week + 1;
  switch (id) {
    case 'kettle-of-plenty': return 14;
    case 'moon-locket': return 4 * weeksLeft;
    case 'witchs-hatpin': return 8;
    case 'spare-satchel': return 12;
    case 'guild-seal': return Math.round(rentOf(s, Math.min(WEEKS, s.week + 1)) * 0.1);
    case 'copper-ladle': return s.cauldronSlots >= 3 ? 8 : 2;
    case 'mortar-and-pestle': return s.cauldronSlots >= 3 ? 10 : 3;
    case 'old-almanac': return 4;
    case 'lucky-horseshoe': return 5;
    case 'pressed-flower': return 6;
    case 'apprentice-ledger': return 2 * weeksLeft;
    case 'silver-bell': return 2;
    case 'may-crown': return 2 * weeksLeft;
    case 'hive-smoker': case 'maypole': case 'flower-basket': return 6;
    case 'ivy-wreath': return 3;
    case 'orchard-basket': case 'sun-bonnet': case 'feathered-cap': case 'rush-lantern': case 'wicker-basket': case 'cider-barrel': return 3;
    case 'lantern-glass': case 'straw-hat': case 'bottle-rack': return 6;
    case 'picnic-blanket': case 'apple-press': case 'harvest-wreath': return 5;
    case 'corn-dolly': return 2 * weeksLeft;
    case 'daisy-chain': return 2;
    default: return 0;
  }
}

/** A Rare card with the Cursed modifier: its Potency counts twice, but deliveries cost a heart. */
function cursedCardValue(s: RunState, id: string): number {
  const deck = allCards(s).length;
  return deck >= 24 ? 0 : Math.round((cardValue(s, id) + (codex.ingredients.get(id)?.potency ?? 0)) / 2);
}

/** How much the greedy bot wants a commission: its reward, discounted by how hard the goal looks. */
/** Dusk event choices in the order the greedy bot likes them, given its spare gold. */
function eventPreference(s: RunState, event: string, spare: number): number[] {
  const deck = allCards(s).length;
  switch (event) {
    case 'shrine-blessing':
      return spare >= EVENT_GOLD.shrine ? [0, 1] : [1];
    case 'spilled-cauldron':
      return spare >= EVENT_GOLD.spillHelp ? [1, 0] : [0, 1];
    case 'found-coin-purse':
      return [1, 0];
    case 'bargain-bin':
      if (deck >= 24) return [2];
      return spare >= EVENT_GOLD.binRare ? [1, 0, 2] : spare >= EVENT_GOLD.binUncommon ? [0, 2] : [2];
    case 'mice-in-the-pantry':
      return [1, 0];
    case 'sell-a-recipe':
      return [1];
    case 'apprentice-asks':
      return deck >= 14 ? [0, 1] : [1];
    default:
      return [0, 1];
  }
}

function commissionValue(s: RunState, id: string): number {
  const c = codex.commissions.get(id);
  if (!c) return 0;
  const reward = c.reward.kind === 'gold' ? c.reward.amount : c.reward.kind === 'relic' ? 6 * c.reward.tier : 8;
  const daysLeft = dueWeekOf(s, c) * NIGHT_SHIFT_DAY - ((s.week - 1) * NIGHT_SHIFT_DAY + s.day);
  const knows = (family: string) => s.knownRecipes.some((r) => codex.recipes.get(r)?.family === family);
  const odds: Record<string, number> = {
    'calm-the-shrine': knows('calming') ? 0.3 : 0,
    'full-moon-favour': knows('calming') ? 0.3 : 0,
    'miners-mend': knows('healing') || knows('protection') ? 0.7 : 0,
    'bakers-dozen': knows('warming') ? 0.6 : 0,
    'full-shelf': 0.3,
    'no-shadows': 0.7,
    'three-of-a-kind': s.cauldronSlots >= 3 ? 0.7 : 0,
    'masters-proof': s.week >= 3 ? 0.5 : 0.2,
    'the-whole-town': 0.8,
    'night-owl': 0.4,
  };
  return reward * (odds[id] ?? 0) * Math.min(1, daysLeft / 4);
}

/** Rough cost of carrying a Curse for the rest of the run. */
export function curseCost(s: RunState, id: string): number {
  switch (id) {
    case 'unpaid-debt': return Math.round(rentOf(s, WEEKS) * 0.15);
    case 'heavy-hands': return 12;
    case 'sour-luck': return 5;
    case 'moonsick': return 2 + s.satchel.length;
    case 'leaky-roof': return s.shelfSize > 3 ? 3 : 8;
    case 'nameless': return 1;
    default: return 10;
  }
}

/** Satchel cards past this many rarely get drawn on a Night Shift. */
const SATCHEL_WANT = 4;
const NEXT_RENT_RESERVE = 0.5;

/** The Cider Press is worth a potion the Fence would pay this much for or less. */
const CIDER_PRESS_MAX_PRICE = 3;

/** Shelf potions a seasonal stall open tonight will take, so the Fence leaves them. */
function keptPotions(s: RunState): Set<number> {
  const keep = new Set<number>();
  const o = s.offer;
  if (o?.kind !== 'night-market') return keep;
  for (const st of o.stalls) {
    if (st.id === 'nectar-trader' && !st.done) {
      const p = cheapestPotion(s, NECTAR_TRADER.minTier);
      if (p) keep.add(p.uid);
    }
    if (st.id === 'cider-press') {
      const cheap = s.shelf.filter((p) => !keep.has(p.uid) && fencePrice(p, s) <= CIDER_PRESS_MAX_PRICE);
      for (const p of cheap.slice(0, CIDER_PRESS.max - st.pressed)) keep.add(p.uid);
    }
  }
  return keep;
}

/** What the greedy bot does at a Night Market stall, or null when it has no use for it. */
function stallAction(s: RunState, stall: StallState): Action | null {
  // Keep tonight's rent and half of next week's: rent more than doubles each week.
  const spare = s.gold - rentOf(s) - (s.week < WEEKS ? Math.round(rentOf(s, s.week + 1) * NEXT_RENT_RESERVE) : 0);
  switch (stall.id) {
    case 'fence': {
      // Potions the Nectar Trader or the Cider Press will take tonight stay on the Shelf.
      const keep = keptPotions(s);
      const sell = s.shelf.find((p) => !keep.has(p.uid));
      return sell ? { type: 'sellPotion', uid: sell.uid } : null;
    }
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
    case 'name-taker': {
      if (stall.done) return null;
      // The relic, or the Cursed card when it's worth more (doubled Potency, a heart lost each time it's delivered).
      const best = stall.deals
        .flatMap((d, index) => [
          { index, take: 'relic' as const, v: relicValue(s, d.relic) - curseCost(s, d.curse) },
          ...(d.card ? [{ index, take: 'card' as const, v: cursedCardValue(s, d.card) - curseCost(s, d.curse) }] : []),
        ])
        .sort((a, b) => b.v - a.v)[0];
      return best && best.v >= 4 ? { type: 'takeDeal', index: best.index, take: best.take } : null;
    }
    case 'black-market': {
      const i = stall.stock.findIndex((item) => item.kind === 'relic' && !item.sold && item.price <= spare && relicValue(s, item.relic) >= 8);
      return i >= 0 ? { type: 'buy', index: i } : null;
    }
    case 'seed-swapper': {
      if (stall.done || allCards(s).length - SEED_SWAPPER.give + 1 < MIN_DECK || spare < SEED_SWAPPER.price) return null;
      const best = stall.cards.map((card, index) => ({ index, v: cardValue(s, card) })).sort((a, b) => b.v - a.v)[0];
      const give = commonCards(s).sort((a, b) => cardValue(s, a.card) - cardValue(s, b.card)).slice(0, SEED_SWAPPER.give);
      if (!best || give.length < SEED_SWAPPER.give || best.v < 7) return null;
      return give.reduce((v, c) => v + cardValue(s, c.card), 0) < best.v + 4 ? { type: 'seedSwap', index: best.index, uids: give.map((c) => c.uid) } : null;
    }
    case 'firefly-games': {
      if (stall.prizes.length) {
        const best = stall.prizes.map((id, index) => ({ index, v: familiarValue(s, id) })).sort((a, b) => b.v - a.v)[0]!;
        return { type: 'takePrize', index: best.index };
      }
      return stall.tosses < 2 && spare >= FIREFLY_GAMES.price && allCards(s).length < 24 ? { type: 'tossRing' } : null;
    }
    case 'nectar-trader': {
      if (stall.done || !cheapestPotion(s, NECTAR_TRADER.minTier)) return null;
      const best = stall.cards.map((card, index) => ({ index, v: cardValue(s, card) })).sort((a, b) => b.v - a.v)[0];
      return best && best.v >= 7 ? { type: 'tradeNectar', index: best.index } : null;
    }
    case 'cider-press': {
      const potion = cheapestPotion(s);
      if (stall.pressed >= CIDER_PRESS.max || !potion || fencePrice(potion, s) > CIDER_PRESS_MAX_PRICE) return null;
      const best = pressable(s).sort((a, b) => cardPotency(b) - cardPotency(a))[0];
      return best ? { type: 'pressCider', uid: best.uid } : null;
    }
    case 'harvest-auction': {
      if (!stall.relic || stall.bid !== null || relicValue(s, stall.relic) < 8) return null;
      const bid = [...HARVEST_AUCTION.bids].reverse().find((b) => b <= spare && b <= 21);
      return bid ? { type: 'placeBid', amount: bid } : null;
    }
    case 'hearth-trader': {
      const shown = hearthOffers(s, stall);
      if (!stall.done && shown.regular && spare >= FRIENDSHIP.traderGold) {
        const fam = s.familiars.length < s.familiarSlots
          ? shown.familiars.map((id, k) => ({ index: shown.cards.length + k, v: familiarValue(s, id) })).sort((a, b) => b.v - a.v)[0]
          : undefined;
        if (fam) return { type: 'hearthTrade', index: fam.index };
        const card = shown.cards.map((c, index) => ({ index, v: cardValue(s, c) })).sort((a, b) => b.v - a.v)[0];
        if (card && card.v >= 7) return { type: 'hearthTrade', index: card.index };
      }
      // The Holly Crown: a Frost familiar worth a slot.
      if (!stall.crowned && s.familiars.length < s.familiarSlots && spare >= HOLLY_CROWN.price) {
        const best = stall.crown.map((id, index) => ({ index, v: familiarValue(s, id) })).sort((a, b) => b.v - a.v)[0];
        if (best && best.v >= 6) return { type: 'wearCrown', index: best.index };
      }
      // The Yule Log: burn junk while the deck has room to shrink.
      const deck = [...s.drawPile, ...s.hand, ...s.discardPile];
      if (stall.burned || spare < YULE_LOG.price || deck.length < MIN_DECK + 2) return null;
      const burn = deck.filter((c) => codex.junk.has(c.card)).slice(0, YULE_LOG.cards);
      return burn.length ? { type: 'burnYule', uids: burn.map((c) => c.uid) } : null;
    }
    default:
      // The Moth Broker, the Hollow Tailor, the Fortune Tent and the Blossom Oracle: the random bot covers them.
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

/**
 * How often each persona slips, per decision. A slip is a choice a real player makes: a brew that fills
 * an order but not the best one, a reward or event picked on a whim, a shop buy the deck didn't need,
 * a Night Market stall walked past. Every other decision is the greedy bot's.
 */
export const PERSONAS: Record<Persona, {
  /** Takes another brew than the best, from the top `choice` that fill an order (or suit the Shelf). */
  brew: number;
  choice: number;
  /** Doesn't hunt with Discard for an order it can't fill, or pour away a cheap Shelf potion. */
  lazy: number;
  /** Leaves the Tinctures in hand unplayed. */
  tinctures: number;
  /** Picks a reward, errand, forage, Creek card, commission, event choice, gift or blessing at random. */
  whim: number;
  /** Buys something it can afford at random, past what the deck needs (rent still kept). */
  impulse: number;
  /** Walks past each Night Market stall but the Fence. */
  stalls: number;
}> = {
  skilled: { brew: 0.1, choice: 3, lazy: 0.15, tinctures: 0.1, whim: 0.15, impulse: 0.1, stalls: 0.2 },
  casual: { brew: 0.25, choice: 6, lazy: 0.4, tinctures: 0.3, whim: 0.35, impulse: 0.2, stalls: 0.5 },
  novice: { brew: 0.45, choice: 99, lazy: 0.7, tinctures: 0.5, whim: 0.6, impulse: 0.35, stalls: 0.75 },
};

export type Player = (s: RunState) => Action;

/** A player for this strategy. Personas and the fuzzer roll their own seeded dice, so a seed replays. */
export function makePlayer(strategy: Strategy, seed: string): Player {
  if (strategy === 'greedy') return greedyAction;
  let rng = seedRng(`bot:${seed}`);
  if (strategy === 'random') {
    return (s) => {
      const [a, next] = randomAction(s, rng);
      rng = next;
      return a;
    };
  }
  const roll = () => {
    const [f, next] = nextFloat(rng);
    rng = next;
    return f;
  };
  return personaPlayer(PERSONAS[strategy], roll);
}

function personaPlayer(p: (typeof PERSONAS)[Persona], roll: () => number): Player {
  const pick = <T>(xs: readonly T[]): T | undefined => xs[Math.floor(roll() * xs.length)];
  // The brew it's slotting toward, kept so it doesn't change its mind card by card.
  let plan: Plan | null = null;
  // Stalls it walked past tonight: `week:day:index`.
  const passed = new Set<string>();

  const brewing = (s: RunState): Action => {
    if (plan) {
      const held = new Set([...s.hand, ...s.cauldron].map((c) => c.uid));
      const order = plan.deliverTo === undefined || s.orders.some((o) => o.id === plan!.deliverTo && o.status === 'open');
      if (s.brewsLeft > 0 && order && plan.cards.every((c) => held.has(c.uid))) return stepToward(s, plan);
      plan = null;
    }
    const slip = roll() < p.brew;
    return greedyBrewing(s, {
      tinctures: roll() >= p.tinctures,
      hunt: roll() >= p.lazy,
      pour: roll() >= p.lazy,
      pick: (plans) => (slip ? pick(plans.slice(0, p.choice)) : plans[0]),
      chose: (x) => (plan = x),
    });
  };

  const dusk = (s: RunState): Action => {
    const offer = s.offer!;
    const reserve = Math.round(rentOf(s) * (s.day / NIGHT_SHIFT_DAY));
    const whim = roll() < p.whim;
    const index = (n: number) => Math.floor(roll() * n);
    switch (offer.kind) {
      case 'reward':
        if (whim) return { type: 'pickReward', index: index(offer.cards.length) };
        break;
      case 'errands':
        if (whim) return { type: 'chooseErrand', errand: pick(offer.options)! };
        break;
      case 'forage':
        if (whim && offer.picksLeft > 0) return { type: 'forage', index: index(offer.cards.length) };
        break;
      case 'creek': {
        if (!whim || offer.done) break;
        const card = pick(allCards(s).filter((c) => codex.ingredients.has(c.card) && !c.modifier));
        if (!card) break;
        const mod = pick([...codex.modifiers.values()].filter((m) => m.price != null && m.price <= s.gold - reserve && !cantModify(card, m.id)));
        return mod && roll() < 0.5 ? { type: 'enchant', uid: card.uid, modifier: mod.id } : { type: 'temper', uid: card.uid };
      }
      case 'guild':
        if (whim && !offer.taken) return { type: 'takeCommission', index: index(offer.options.length) };
        break;
      case 'event': {
        if (!whim || offer.chose !== null || eventDone(s, offer)) break;
        const open = codex.duskEvents.get(offer.event)!.choices.map((_, i) => i).filter((i) => eventChoiceBlocked(s, offer.event, i) === null);
        const choice = pick(open);
        if (choice === undefined) break;
        const ask = eventChoiceAsk(s, offer.event, choice);
        switch (ask?.kind) {
          case 'deck': return { type: 'chooseEvent', index: choice, uid: pick(ask.cards)!.uid };
          case 'shelf': return { type: 'chooseEvent', index: choice, uid: pick(ask.potions)!.uid };
          case 'recipe': return { type: 'chooseEvent', index: choice, pick: pick(ask.recipes)! };
          case 'card': return { type: 'chooseEvent', index: choice, pick: pick(ask.cards)! };
          default: return { type: 'chooseEvent', index: choice };
        }
      }
      case 'hearth':
        // Leaves without burning anything, or burns a card it isn't sure about.
        if (whim && !offer.removed && !s.curses.length) return roll() < 0.5 ? { type: 'leaveErrand' } : { type: 'removeCard', uid: pick(allCards(s).filter((c) => !c.modifier))!.uid };
        break;
      case 'gift':
        if (whim) return roll() < 0.8 && (offer.into !== 'familiar' || s.familiars.length < s.familiarSlots) ? { type: 'takeGift', index: index(offer.cards.length) } : { type: 'passGift' };
        break;
      case 'vigil':
        if (whim && !offer.chose) return { type: 'chooseBlessing', index: index(offer.blessings.length) };
        break;
      case 'market':
      case 'fair': {
        if (roll() >= p.impulse) break;
        const spare = s.gold - reserve;
        const items = offer.kind === 'market'
          ? offer.stock.flatMap((item, i) => (!item.sold && item.price <= spare && (item.kind !== 'familiar' || s.familiars.length < s.familiarSlots) ? [{ type: 'buy', index: i } as Action] : []))
          : offer.stalls.flatMap((st, si) => st.stock.flatMap((item, i) => (!item.sold && item.price <= spare && (item.kind !== 'familiar' || s.familiars.length < s.familiarSlots) ? [{ type: 'buyAtFair', stall: si, index: i } as Action] : [])));
        return pick(items) ?? { type: 'leaveErrand' };
      }
      case 'night-market': {
        if (offer.at !== null) break;
        // Walks past some stalls, decided once a night; the Fence is where the Shelf is sold.
        const walked = (i: number) => {
          const key = `${s.week}:${s.day}:${i}`;
          if (offer.stalls[i]!.id !== 'fence' && !passed.has(`${key}:seen`)) {
            passed.add(`${key}:seen`);
            if (roll() < p.stalls) passed.add(key);
          }
          return passed.has(key);
        };
        const next = offer.stalls.findIndex((x, i) => stallAction(s, x) !== null && !walked(i));
        return next >= 0 ? { type: 'visitStall', index: next } : { type: 'leaveMarket' };
      }
    }
    return greedyDusk(s);
  };

  return (s) => {
    switch (s.phase) {
      case 'brewing': return brewing(s);
      case 'dusk':
      case 'night-market': return dusk(s);
      default: return greedyAction(s);
    }
  };
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
    { type: 'pourOut', uid: potion },
    { type: 'pickReward', index: roll(4) },
    { type: 'takeGift', index: roll(4) },
    { type: 'passGift' },
    { type: 'chooseErrand', errand: any(['market', 'forage', 'creek', 'guild', 'hearth', 'event'] as const)! },
    { type: 'buy', index: roll(7) },
    { type: 'buyAtFair', stall: roll(4), index: roll(4) },
    { type: 'chooseBlessing', index: roll(4) },
    { type: 'forage', index: roll(5) },
    { type: 'chooseEvent', index: roll(3), uid: any(deckUids) ?? 0 },
    { type: 'removeCard', uid: any([...s.drawPile, ...s.hand, ...s.discardPile].map((c) => c.uid)) ?? 0 },
    { type: 'sellPotion', uid: potion },
    { type: 'sellFamiliar', index: roll(5) },
    { type: 'moveFamiliar', from: roll(5), to: roll(5) },
    { type: 'visitStall', index: roll(10) },
    { type: 'visitStall', index: roll(10) },
    { type: 'leaveStall' },
    { type: 'forgetRecipe', recipe: any(s.knownRecipes) ?? '' },
    { type: 'brokerPick', index: roll(3) },
    { type: 'weave', from: any(deckUids) ?? 0, into: any(deckUids) ?? 0 },
    { type: 'drawTarot' },
    { type: 'swapForCard', index: roll(3), uids: [any(deckUids) ?? 0, any(deckUids) ?? 0] },
    { type: 'takeDeal', index: roll(3), take: roll(2) ? 'relic' : 'card' },
    { type: 'temper', uid: any(deckUids) ?? 0 },
    { type: 'takeCommission', index: roll(3) },
    { type: 'enchant', uid: any(deckUids) ?? 0, modifier: any(['moonlit', 'aged', 'blessed', 'cursed'] as const)! },
    { type: 'liftCurse', curse: any(s.curses) ?? 'nameless' },
    { type: 'seedSwap', index: roll(3), uids: [any(deckUids) ?? 0, any(deckUids) ?? 0] },
    { type: 'readPetals' },
    { type: 'tossRing' },
    { type: 'takePrize', index: roll(2) },
    { type: 'tradeNectar', index: roll(3) },
    { type: 'pressCider', uid: any(deckUids) ?? 0 },
    { type: 'placeBid', amount: any(HARVEST_AUCTION.bids) ?? 12 },
    { type: 'hearthTrade', index: roll(4) },
    { type: 'burnYule', uids: [any(allCards(s))?.uid ?? 0] },
    { type: 'wearCrown', index: roll(3) },
  );
  // Weight away from ending the day so random runs actually brew.
  const a = roll(10) === 0 ? candidates[roll(5)]! : candidates[5 + roll(candidates.length - 5)]!;
  return [a, r];
}

export function isOver(s: RunState): boolean {
  return s.phase === 'game-over' || s.phase === 'victory';
}
