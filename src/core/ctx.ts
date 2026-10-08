import type { GameEvent } from './actions';
import { nextFloat, shuffle } from './rng';
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
  }
}

export function drawToHandSize(ctx: Ctx): void {
  draw(ctx, Math.max(0, ctx.s.handSize - ctx.s.hand.length));
}

export function gainCard(ctx: Ctx, card: string, source: 'reward' | 'market' | 'forage' | 'sludge'): CardInstance {
  const inst = { uid: ctx.s.nextUid++, card };
  ctx.s.discardPile.push(inst);
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
