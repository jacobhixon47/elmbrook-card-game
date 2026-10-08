import { codex } from '../codex';
import type { Essence, Ingredient, Recipe } from '../codex/schema';
import { changeGold, draw, gainCard, randInt, reject, takeFromHand, type Ctx } from './ctx';
import { tierIndex, tierStep } from './rules';
import type { CardInstance } from './state';

/** Running totals while a brew is scored; ingredient effects adjust them in slot order. */
export type ScoreCtx = {
  potency: number;
  harmony: number;
  recipe: Recipe;
  ingredients: readonly Ingredient[];
  /** Cards still in hand (not in the cauldron). */
  hand: readonly CardInstance[];
  week: number;
  /** No brew has been made yet today. */
  firstBrew: boolean;
  /** Orders filled so far today. */
  filledToday: number;
};

export type Effect = {
  /** Adjusts the score when this ingredient resolves. Returns a short note for the scoring event. */
  onScore?: (c: ScoreCtx) => string | undefined;
  /** Counts as every essence for recipe matching. */
  wild?: boolean;
  /** Extra Discards it costs to brew this ingredient. */
  discardCost?: number;
  /** Cards drawn when this card is discarded. */
  drawOnDiscard?: number;
  /** Cards drawn after a brew it was in. */
  drawOnBrew?: number;
  /** A brew with it makes at least this many potions. */
  copies?: number;
  /** +1 Potency for each day in the deck, reset when brewed. */
  aged?: boolean;
  /** Hearts it adds or costs with the customer it is delivered to. */
  heartDelta?: number;
  /** Discards it costs when drawn on a Night Shift. */
  nightDrawCost?: number;
  /** Leaves the deck when the week's rent is paid. */
  goneAtWeekEnd?: boolean;
  /** Leaves the deck by itself after this many days. */
  expiresAfter?: number;
  /** Harmony every brew gets while this card sits in hand. */
  inHandHarmony?: number;
  /** What a Tincture does when played. `targets` are uids the player chose (hand cards, top cards or a Shelf potion). */
  onPlay?: (ctx: Ctx, targets: readonly number[]) => void;
  /** Which uids a Tincture's targets refer to, so the UI knows what to ask for. */
  targets?: 'hand' | 'hand-one' | 'top-3' | 'shelf-one';
};

const hasEssence = (ing: Ingredient, e: Essence) => ing.essences.includes(e) || ing.effects.includes('wild-essence');

function inHandWith(e: Essence) {
  return (card: CardInstance) => codex.ingredients.get(card.card)?.essences.includes(e) ?? false;
}

/** +n Harmony when a condition on the brew holds. */
function harmonyIf(n: number, test: (c: ScoreCtx) => boolean): Effect {
  return {
    onScore: (c) => {
      if (!test(c)) return undefined;
      c.harmony += n;
      return `+${n} Harmony`;
    },
  };
}

/** +1 Harmony for each ingredient in the brew that passes the test (this one included). */
function harmonyPer(test: (i: Ingredient) => boolean): Effect {
  return {
    onScore: (c) => {
      const n = c.ingredients.filter(test).length;
      if (n === 0) return undefined;
      c.harmony += n;
      return `+${n} Harmony`;
    },
  };
}

function nextBrew(change: (p: Ctx['s']['pending']) => void): Effect {
  return { onPlay: (ctx) => change(ctx.s.pending) };
}

/** Every effect id content can reference (GDD: effects that need code are registered by id). */
export const EFFECTS: Record<string, Effect> = {
  // Ingredients
  'on-discard-draw-1': { drawOnDiscard: 1 },
  'harmony-2-if-3-ingredients': harmonyIf(2, (c) => c.ingredients.length >= 3),
  'costs-1-discard': { discardCost: 1 },
  'harmony-per-umbra-in-hand': {
    onScore: (c) => {
      const n = c.hand.filter(inHandWith('umbra')).length;
      if (n === 0) return undefined;
      c.harmony += n;
      return `+${n} Harmony`;
    },
  },
  aged: { aged: true },
  'wild-essence': { wild: true },
  'lose-heart': { heartDelta: -1 },
  'gain-heart': { heartDelta: 1 },
  'harmony-1-with-tide': harmonyIf(1, (c) => c.ingredients.some((i) => hasEssence(i, 'tide'))),
  'harmony-1-if-calming': harmonyIf(1, (c) => c.recipe.family === 'calming'),
  'harmony-1-if-fortune': harmonyIf(1, (c) => c.recipe.family === 'fortune'),
  'harmony-1-if-2-ingredients': harmonyIf(1, (c) => c.ingredients.length === 2),
  'harmony-2-first-brew': harmonyIf(2, (c) => c.firstBrew),
  'harmony-per-ember-in-brew': harmonyPer((i) => hasEssence(i, 'ember')),
  'harmony-per-frost-in-brew': harmonyPer((i) => i.tags.includes('frost')),
  'harmony-x1.5-if-secrets': {
    onScore: (c) => {
      if (c.recipe.family !== 'secrets') return undefined;
      c.harmony *= 1.5;
      return '×1.5 Harmony';
    },
  },
  'potency-2-if-3-ingredients': {
    onScore: (c) => {
      if (c.ingredients.length < 3) return undefined;
      c.potency += 2;
      return '+2 Potency';
    },
  },
  'potency-per-week': {
    onScore: (c) => {
      if (c.week <= 1) return undefined;
      c.potency += c.week - 1;
      return `+${c.week - 1} Potency`;
    },
  },
  'potency-2-per-order-today': {
    onScore: (c) => {
      if (c.filledToday === 0) return undefined;
      c.potency += 2 * c.filledToday;
      return `+${2 * c.filledToday} Potency`;
    },
  },
  'brew-makes-2': { copies: 2 },
  'on-brew-draw-1': { drawOnBrew: 1 },
  'on-brew-draw-2': { drawOnBrew: 2 },
  'day-usable': {},
  'night-discard-cost': { nightDrawCost: 1 },
  'gone-at-week-end': { goneAtWeekEnd: true },

  // Junk
  junk: {},
  'expires-3-days': { expiresAfter: 3 },
  'harmony-minus-1-in-hand': { inHandHarmony: -1 },

  // Tinctures
  'next-brew-harmony-1': nextBrew((p) => (p.harmony += 1)),
  'next-brew-potency-3': nextBrew((p) => (p.potency += 3)),
  'next-brew-potency-x1.5': nextBrew((p) => (p.potencyMult *= 1.5)),
  'next-brew-harmony-x1.5': nextBrew((p) => (p.harmonyMult *= 1.5)),
  'next-brew-double': nextBrew((p) => (p.copies = Math.max(p.copies, 2))),
  'next-experiment-full': nextBrew((p) => (p.fullExperiment = true)),
  'draw-2': { onPlay: (ctx) => draw(ctx, 2) },
  'next-brew-harmony-1-draw-1': {
    onPlay: (ctx) => {
      ctx.s.pending.harmony += 1;
      draw(ctx, 1);
    },
  },
  'gain-discard': { onPlay: (ctx) => void (ctx.s.discardsLeft += 1) },
  'gain-brew': { onPlay: (ctx) => void (ctx.s.brewsLeft += 1) },
  'next-delivery-heart-tip': {
    onPlay: (ctx) => {
      ctx.s.delivery.hearts += 1;
      ctx.s.delivery.tip += 3;
    },
  },
  'free-redraw': {
    targets: 'hand',
    onPlay: (ctx, targets) => {
      if (targets.length === 0) reject('Sift needs at least one card to redraw');
      const thrown = targets.map((uid) => takeFromHand(ctx, uid));
      ctx.s.discardPile.push(...thrown);
      ctx.ev.push({ type: 'cardsDiscarded', uids: thrown.map((c) => c.uid) });
      draw(ctx, thrown.length);
    },
  },
  'card-potency-plus-2': {
    targets: 'hand-one',
    onPlay: (ctx, targets) => {
      if (targets.length !== 1) reject('choose one card in hand');
      const card = ctx.s.hand.find((c) => c.uid === targets[0]);
      if (!card) reject(`card ${targets[0]} is not in hand`);
      if (!codex.ingredients.has(card.card)) reject('only an ingredient can be infused');
      card.bonus = (card.bonus ?? 0) + 2;
      ctx.ev.push({ type: 'cardInfused', uid: card.uid, bonus: card.bonus });
    },
  },
  'peek-3-reorder': {
    targets: 'top-3',
    onPlay: (ctx, targets) => {
      const top = ctx.s.drawPile.slice(0, 3);
      if (targets.length === 0) return;
      const same = targets.length === top.length && top.every((c) => targets.includes(c.uid));
      if (!same) reject('put back exactly the top cards of the draw pile');
      const byUid = new Map(top.map((c) => [c.uid, c]));
      ctx.s.drawPile.splice(0, top.length, ...targets.map((uid) => byUid.get(uid)!));
      ctx.ev.push({ type: 'drawPileReordered', uids: [...targets] });
    },
  },
  'upgrade-shelf-potion': {
    targets: 'shelf-one',
    onPlay: (ctx, targets) => {
      if (targets.length !== 1) reject('choose one potion on the Shelf');
      const potion = ctx.s.shelf.find((p) => p.uid === targets[0]);
      if (!potion) reject(`potion ${targets[0]} is not on the Shelf`);
      if (tierIndex(potion.tier) >= tierIndex('superb')) reject('Decant raises potions up to Superb');
      potion.tier = tierStep(potion.tier, 1);
      ctx.ev.push({ type: 'potionUpgraded', uid: potion.uid, tier: potion.tier });
    },
  },

  // Omens (GDD §5.4): strong, with a drawback.
  'next-brew-harmony-x2': nextBrew((p) => (p.harmonyMult *= 2)),
  'next-brew-potency-x2': nextBrew((p) => (p.potencyMult *= 2)),
  'potency-2-per-lunar-in-brew': nextBrew((p) => (p.lunarPotency += 2)),
  'hand-counts-lunar': nextBrew((p) => (p.allLunar = true)),
  'lose-discard': { onPlay: (ctx) => void (ctx.s.discardsLeft = Math.max(0, ctx.s.discardsLeft - 1)) },
  'draw-3': { onPlay: (ctx) => draw(ctx, 3) },
  'discard-random-1': {
    onPlay: (ctx) => {
      if (ctx.s.hand.length === 0) return;
      const [card] = ctx.s.hand.splice(randInt(ctx, ctx.s.hand.length), 1);
      ctx.s.discardPile.push(card!);
      ctx.ev.push({ type: 'cardsDiscarded', uids: [card!.uid] });
    },
  },
  'next-customer-lose-heart': { onPlay: (ctx) => void (ctx.s.delivery.hearts -= 1) },
  'next-delivery-pay-x2': { onPlay: (ctx) => void (ctx.s.delivery.payMult *= 2) },
  'add-sludge': { onPlay: (ctx) => void gainCard(ctx, 'sludge', 'sludge') },
  'lose-gold-3': { onPlay: (ctx) => changeGold(ctx, -Math.min(3, ctx.s.gold), 'omen') },
  'copy-card-permanent': {
    targets: 'hand-one',
    onPlay: (ctx, targets) => {
      if (targets.length !== 1) reject('choose one card in hand');
      const card = ctx.s.hand.find((c) => c.uid === targets[0]);
      if (!card) reject(`card ${targets[0]} is not in hand`);
      gainCard(ctx, card.card, 'copy');
    },
  },
};

export function effectIds(cardId: string): readonly string[] {
  return codex.ingredients.get(cardId)?.effects ?? codex.tinctures.get(cardId)?.effects ?? codex.junk.get(cardId)?.effects ?? [];
}

export function effectsOf(cardId: string): Effect[] {
  return effectIds(cardId).map((id) => {
    const e = EFFECTS[id];
    if (!e) throw new Error(`unregistered effect "${id}" on ${cardId}`);
    return e;
  });
}

export function hasEffect(cardId: string, flag: keyof Effect): boolean {
  return effectsOf(cardId).some((e) => e[flag] !== undefined && e[flag] !== false);
}

type NumberKey = 'discardCost' | 'drawOnDiscard' | 'drawOnBrew' | 'heartDelta' | 'nightDrawCost' | 'inHandHarmony';

export function sumEffect(cardId: string, key: NumberKey): number {
  return effectsOf(cardId).reduce((n, e) => n + (e[key] ?? 0), 0);
}

/** What a Tincture asks the player to choose, if anything. */
export function targetsOf(cardId: string): Effect['targets'] {
  return effectsOf(cardId).find((e) => e.targets)?.targets;
}
