// The player's profile: what persists between runs on this browser (GDD §13, tech.md "Persistence").
// The rules for it, versions and migrations included, are in core/meta.ts; this is the storage,
// which may be missing or blocked (a private window): then nothing persists and nothing breaks.

import { buyPerk, chooseYear, lockMutation, migrateProfile, pickBoon, recordRun, toggleMutation, type MutationId, type Profile, type RunOutcome, type RunState } from './core';

const KEY = 'elmbrook.profile';

export function loadProfile(): Profile {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return migrateProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return migrateProfile(null);
  }
}

function store(p: Profile): Profile {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: the profile lasts until the tab closes.
  }
  return p;
}

export function saveProfile(change: Partial<Profile>): Profile {
  return store({ ...loadProfile(), ...change });
}

/** Count a finished run in the profile: wins open the next season. */
export function recordFinishedRun(s: RunState): RunOutcome {
  const before = loadProfile();
  const out = recordRun(before, s);
  if (out.profile !== before) store(out.profile);
  return out;
}

/** Buy a cottage perk with Reputation (throws when it can't be bought; check `perkBlocked` first). */
export function buyPerkNow(id: string): Profile {
  return store(buyPerk(loadProfile(), id));
}

/** Play another Year you've reached, at the cottage. */
export function chooseYearNow(year: number): Profile {
  return store(chooseYear(loadProfile(), year));
}

/** Turn one of this Year's mutations on or off at the cottage, before Spring starts. */
export function toggleMutationNow(id: MutationId): Profile {
  return store(toggleMutation(loadProfile(), id));
}

/** A run sets out: this Year's mutations are fixed from now on. */
export function lockMutationNow(): Profile {
  const p = loadProfile();
  const locked = lockMutation(p);
  return locked === p ? p : store(locked);
}

/** Choose this Year's boon at the cottage. */
export function pickBoonNow(id: string): Profile {
  return store(pickBoon(loadProfile(), id));
}
