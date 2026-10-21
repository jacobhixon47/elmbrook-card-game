// The run in progress, saved in this browser after every action so closing the tab doesn't lose it
// (GDD §3, tech.md "Persistence"). Two slots: the story run, and an Endless run (GDD §13), each kept
// apart so one never overwrites the other. A finished run clears its slot. Like the profile, storage
// may be missing or blocked.

import { migrateRun, type RunState } from './core';

export type RunSlot = 'story' | 'endless';

const KEYS: Record<RunSlot, string> = { story: 'elmbrook.run', endless: 'elmbrook.endless' };

const slotOf = (s: Pick<RunState, 'endlessMode'>): RunSlot => (s.endlessMode ? 'endless' : 'story');

/** The run saved in a slot, brought up to date, or null when there is none or it can't be (see core/meta.ts). */
export function loadRun(slot: RunSlot = 'story'): RunState | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEYS[slot]);
    if (!raw) return null;
    const s = migrateRun(JSON.parse(raw));
    return s && s.phase !== 'game-over' && s.phase !== 'victory' && slotOf(s) === slot ? s : null;
  } catch {
    return null;
  }
}

/** Save the run in its slot, or clear the slot once it's over. */
export function saveRun(s: RunState): void {
  if (s.phase === 'game-over' || s.phase === 'victory') return clearRun(slotOf(s));
  try {
    globalThis.localStorage?.setItem(KEYS[slotOf(s)], JSON.stringify(s));
  } catch {
    // Storage blocked or full: the run just won't be there to continue.
  }
}

export function clearRun(slot: RunSlot = 'story'): void {
  try {
    globalThis.localStorage?.removeItem(KEYS[slot]);
  } catch {
    // Nothing to clear.
  }
}
