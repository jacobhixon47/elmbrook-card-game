import { expect } from 'vitest';
import { reduce, type Action, type GameEvent, type RunState, type Season } from '../src/core';

export function start(seed = 'test', season?: Season): RunState {
  return reduce(null, { type: 'startRun', seed, witch: 'hedge-witch', ...(season ? { season } : {}) }).state;
}

/** A run in the brewing phase of day 1. */
export function brewing(seed = 'test', season?: Season): RunState {
  return ok(start(seed, season), { type: 'openShop' }).state;
}

/** Apply an action and fail the test if a rule rejected it. */
export function ok(state: RunState, action: Action): { state: RunState; events: GameEvent[] } {
  const r = reduce(state, action);
  const rejected = r.events.find((e) => e.type === 'rejected');
  expect(rejected, JSON.stringify(rejected)).toBeUndefined();
  return r;
}

/** Apply an action that must be rejected; returns the reason. */
export function no(state: RunState, action: Action): string {
  const r = reduce(state, action);
  expect(r.state).toBe(state);
  const e = r.events[0];
  if (e?.type !== 'rejected') throw new Error(`expected ${action.type} to be rejected`);
  return e.reason;
}

/** Replace the hand with fresh copies of these cards. Returns the state and the new uids in order. */
export function withHand(state: RunState, cards: string[]): [RunState, number[]] {
  const s = structuredClone(state);
  const uids = cards.map(() => s.nextUid++);
  s.hand = cards.map((card, i) => ({ uid: uids[i]!, card }));
  s.cauldron = [];
  return [s, uids];
}

/** Slot these hand cards in order. */
export function slotAll(state: RunState, uids: number[]): RunState {
  return uids.reduce((s, uid) => ok(s, { type: 'slot', uid }).state, state);
}

export function ofType<T extends GameEvent['type']>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}
