// The run in progress, saved in this browser after every action so closing the tab doesn't lose it
// (GDD §3, tech.md "Persistence"). One slot; a finished run clears it. Like the profile, storage may be missing or blocked.

import { migrateRun, type RunState } from './core';

const KEY = 'elmbrook.run';

/** The saved run, brought up to date, or null when there is none or it can't be (see core/meta.ts). */
export function loadRun(): RunState | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const s = migrateRun(JSON.parse(raw));
    return s && s.phase !== 'game-over' && s.phase !== 'victory' ? s : null;
  } catch {
    return null;
  }
}

/** Save the run, or clear the slot once it's over. */
export function saveRun(s: RunState): void {
  if (s.phase === 'game-over' || s.phase === 'victory') return clearRun();
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked or full: the run just won't be there to continue.
  }
}

export function clearRun(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
