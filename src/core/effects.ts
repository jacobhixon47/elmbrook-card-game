import { codex } from '../codex';
import type { Ingredient } from '../codex/schema';
import { draw, reject, takeFromHand, type Ctx } from './ctx';
import type { CardInstance } from './state';

/** Running totals while a brew is scored; ingredient effects adjust them in slot order. */
export type ScoreCtx = {
  potency: number;
  harmony: number;
  ingredients: readonly Ingredient[];
  /** Cards still in hand (not in the cauldron). */
  hand: readonly CardInstance[];
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
  /** +1 Potency for each day in the deck, reset when brewed. */
  aged?: boolean;
  /** Delivering a potion made with it costs a heart with that customer. */
  costsHeart?: boolean;
  /** What a Tincture does when played. `targets` are other hand cards the player chose. */
  onPlay?: (ctx: Ctx, targets: readonly number[]) => void;
};

function isUmbra(card: CardInstance): boolean {
  return codex.ingredients.get(card.card)?.essences.includes('umbra') ?? false;
}

/** Every effect id content can reference (GDD: effects that need code are registered by id). */
export const EFFECTS: Record<string, Effect> = {
  'on-discard-draw-1': { drawOnDiscard: 1 },
  'harmony-2-if-3-ingredients': {
    onScore: (c) => {
      if (c.ingredients.length < 3) return undefined;
      c.harmony += 2;
      return '+2 Harmony';
    },
  },
  'costs-1-discard': { discardCost: 1 },
  'harmony-per-umbra-in-hand': {
    onScore: (c) => {
      const n = c.hand.filter(isUmbra).length;
      if (n === 0) return undefined;
      c.harmony += n;
      return `+${n} Harmony`;
    },
  },
  aged: { aged: true },
  'wild-essence': { wild: true },
  'lose-heart': { costsHeart: true },

  'next-brew-harmony-1': {
    onPlay: (ctx) => {
      ctx.s.pending.harmony += 1;
    },
  },
  'draw-2': { onPlay: (ctx) => draw(ctx, 2) },
  'next-brew-potency-x1.5': {
    onPlay: (ctx) => {
      ctx.s.pending.potencyMult *= 1.5;
    },
  },
  'free-redraw': {
    onPlay: (ctx, targets) => {
      if (targets.length === 0) reject('Sift needs at least one card to redraw');
      const thrown = targets.map((uid) => takeFromHand(ctx, uid));
      ctx.s.discardPile.push(...thrown);
      ctx.ev.push({ type: 'cardsDiscarded', uids: thrown.map((c) => c.uid) });
      draw(ctx, thrown.length);
    },
  },
  'next-brew-double': {
    onPlay: (ctx) => {
      ctx.s.pending.copies = Math.max(ctx.s.pending.copies, 2);
    },
  },
};

export function effectsOf(cardId: string): Effect[] {
  const ids = codex.ingredients.get(cardId)?.effects ?? codex.tinctures.get(cardId)?.effects ?? [];
  return ids.map((id) => {
    const e = EFFECTS[id];
    if (!e) throw new Error(`unregistered effect "${id}" on ${cardId}`);
    return e;
  });
}

export function hasEffect(cardId: string, flag: keyof Effect): boolean {
  return effectsOf(cardId).some((e) => e[flag] !== undefined && e[flag] !== false);
}

export function sumEffect(cardId: string, key: 'discardCost' | 'drawOnDiscard'): number {
  return effectsOf(cardId).reduce((n, e) => n + (e[key] ?? 0), 0);
}
