import type { CardSource, GameEvent } from './actions';
import { NIGHT_SHIFT_DAY } from './calendar';
import { sumEffect } from './effects';
import { isSatchelCard } from './night';
import { nextFloat, shuffle } from './rng';
import { MAX_HEARTS } from './rules';
import type { CardInstance, RunState } from './state';

/**
 * A reduce call works on a private copy of the state (`s`) and appends events (`ev`).
 * Helpers here mutate that copy; `reduce` hands back the copy, so callers still see a pure function.
 */
export type Ctx = { s: RunState; ev: GameEvent[] };

/** Thrown by a rule check; `reduce` turns it into a `rejected` event and keeps the old state. */
export class Reject extends Error {}

export function reject(reason: string): never {
  throw new Reject(reason);
}

export function rand(ctx: Ctx): number {
  const [f, next] = nextFloat(ctx.s.rng);
  ctx.s.rng = next;
  return f;
}

export function randInt(ctx: Ctx, maxExclusive: number): number {
  return Math.floor(rand(ctx) * maxExclusive);
}

export function pickWeighted<T>(ctx: Ctx, options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand(ctx) * total;
  for (const [value, w] of options) {
    roll -= w;
    if (roll < 0) return value;
  }
  return options[options.length - 1]![0];
}

export function pick<T>(ctx: Ctx, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty list');
  return items[randInt(ctx, items.length)]!;
}

export function shuffled<T>(ctx: Ctx, items: readonly T[]): T[] {
  const [out, next] = shuffle(items, ctx.s.rng);
  ctx.s.rng = next;
  return out;
}

/** Draw n cards, reshuffling the discard pile when the draw pile runs out. */
export function draw(ctx: Ctx, n: number): void {
  const s = ctx.s;
  for (let i = 0; i < n; i++) {
    if (s.drawPile.length === 0) {
      if (s.discardPile.length === 0) return;
      s.drawPile = shuffled(ctx, s.discardPile);
      s.discardPile = [];
      ctx.ev.push({ type: 'deckShuffled', size: s.drawPile.length });
    }
    const top = s.drawPile.shift()!;
    s.hand.push(top);
    ctx.ev.push({ type: 'cardDrawn', uid: top.uid, card: top.card });
    // Wolfsbane and kin cost Discards when drawn on a Night Shift (GDD §6.1).
    const cost = s.day === NIGHT_SHIFT_DAY && s.phase === 'brewing' ? sumEffect(top.card, 'nightDrawCost') : 0;
    if (cost > 0) s.discardsLeft = Math.max(0, s.discardsLeft - cost);
  }
}

export function drawToHandSize(ctx: Ctx): void {
  draw(ctx, Math.max(0, ctx.s.handSize - ctx.s.hand.length));
}

/** A new card for the deck, or for the Night Satchel if it is a Lunar ingredient or an Omen (GDD §5.4). */
export function gainCard(ctx: Ctx, card: string, source: CardSource): CardInstance {
  const inst = { uid: ctx.s.nextUid++, card };
  (isSatchelCard(card) ? ctx.s.satchel : ctx.s.discardPile).push(inst);
  ctx.ev.push({ type: 'cardGained', card, uid: inst.uid, source });
  return inst;
}

export function changeGold(ctx: Ctx, delta: number, reason: string): void {
  if (delta === 0) return;
  ctx.s.gold += delta;
  ctx.ev.push({ type: 'goldChanged', gold: ctx.s.gold, delta, reason });
}

export function takeFromHand(ctx: Ctx, uid: number): CardInstance {
  const i = ctx.s.hand.findIndex((c) => c.uid === uid);
  if (i < 0) reject(`card ${uid} is not in hand`);
  return ctx.s.hand.splice(i, 1)[0]!;
}

/** Hearts with a regular, up to the cap. */
export function addHearts(ctx: Ctx, regular: string, n: number): void {
  const before = ctx.s.hearts[regular] ?? 0;
  const hearts = Math.min(MAX_HEARTS, before + n);
  ctx.ev.push({ type: 'heartsChanged', customer: regular, hearts, delta: hearts - before });
  ctx.s.hearts[regular] = hearts;
}

/** Take a card out of the deck (draw pile, hand or discard) for good. */
export function removeCard(ctx: Ctx, card: CardInstance): void {
  for (const pile of [ctx.s.drawPile, ctx.s.hand, ctx.s.discardPile]) {
    const i = pile.findIndex((c) => c.uid === card.uid);
    if (i >= 0) pile.splice(i, 1);
  }
  ctx.ev.push({ type: 'cardRemoved', uid: card.uid, card: card.card });
}
