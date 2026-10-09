import { SEASONS, type Season } from './calendar';
import { RUN_VERSION, type RunState } from './state';

// What persists between runs (GDD §13, tech.md "Persistence"): the profile, and the saved run's
// migrations. Pure: src/profile.ts and src/save.ts do the storage.

export const PROFILE_VERSION = 1;

export type Profile = {
  version: typeof PROFILE_VERSION;
  tutorialDone: boolean;
  /** Seasons you can start a run in, in Year order. Spring is always open; winning a season opens the next. */
  seasons: Season[];
  /** Runs finished, and runs won by season. */
  runs: number;
  wins: Record<Season, number>;
  /** Years completed: each win in Winter. */
  years: number;
  /** The seed of the last run counted, so a run is never counted twice. */
  lastRun: string | null;
};

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    tutorialDone: false,
    seasons: ['spring'],
    runs: 0,
    wins: { spring: 0, summer: 0, autumn: 0, winter: 0 },
    years: 0,
    lastRun: null,
  };
}

type Raw = Record<string, unknown>;

/**
 * Each step takes a profile of version n to n + 1. Version 0 is the M2.5 profile, `{ tutorialDone }`
 * with no version field. Add a step (and bump PROFILE_VERSION) for any change old saves can't read.
 */
const PROFILE_MIGRATIONS: Record<number, (p: Raw) => Raw> = {
  0: (p) => ({ ...newProfile(), tutorialDone: p.tutorialDone === true }),
};

/** Any stored profile, brought up to date. Something unreadable, or from a newer build, starts fresh. */
export function migrateProfile(raw: unknown): Profile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return newProfile();
  let p = raw as Raw;
  let v = typeof p.version === 'number' ? p.version : 0;
  if (v > PROFILE_VERSION) return newProfile();
  while (v < PROFILE_VERSION) {
    const step = PROFILE_MIGRATIONS[v];
    if (!step) return newProfile();
    p = { ...step(p), version: ++v };
  }
  return sanitize(p);
}

/** A current-version profile with every field present and sane, whatever the stored copy held. */
function sanitize(p: Raw): Profile {
  const fresh = newProfile();
  const seasons = Array.isArray(p.seasons) ? SEASONS.filter((s) => (p.seasons as unknown[]).includes(s)) : [];
  const wins = (p.wins && typeof p.wins === 'object' ? p.wins : {}) as Partial<Record<Season, unknown>>;
  const count = (n: unknown) => (typeof n === 'number' && n >= 0 ? Math.floor(n) : 0);
  return {
    version: PROFILE_VERSION,
    tutorialDone: p.tutorialDone === true,
    seasons: seasons.includes('spring') ? seasons : ['spring', ...seasons],
    runs: count(p.runs),
    wins: Object.fromEntries(SEASONS.map((s) => [s, count(wins[s])])) as Record<Season, number>,
    years: count(p.years),
    lastRun: typeof p.lastRun === 'string' ? p.lastRun : fresh.lastRun,
  };
}

/** The season a win in this one opens, or null after Winter. */
export function nextSeason(season: Season): Season | null {
  return SEASONS[SEASONS.indexOf(season) + 1] ?? null;
}

export type RunOutcome = {
  profile: Profile;
  /** A season this run opened. */
  opened: Season | null;
  /** This run completed a Year (a win in Winter). */
  yearDone: boolean;
};

/** Count a finished run. A run still going, or one already counted, changes nothing. */
export function recordRun(profile: Profile, s: Pick<RunState, 'seed' | 'season' | 'phase'>): RunOutcome {
  const same = { profile, opened: null, yearDone: false };
  if ((s.phase !== 'victory' && s.phase !== 'game-over') || profile.lastRun === s.seed) return same;
  const p: Profile = { ...profile, seasons: [...profile.seasons], wins: { ...profile.wins }, runs: profile.runs + 1, lastRun: s.seed };
  if (s.phase === 'game-over') return { ...same, profile: p };
  p.wins[s.season]++;
  const next = nextSeason(s.season);
  const opened = next && !p.seasons.includes(next) ? next : null;
  if (opened) p.seasons = SEASONS.filter((x) => x === opened || p.seasons.includes(x));
  const yearDone = s.season === 'winter';
  if (yearDone) p.years++;
  return { profile: p, opened, yearDone };
}

/**
 * Steps that bring a saved run of version n up to n + 1, so a game update doesn't throw away a run
 * in progress. A version with no step can't be continued. Bump RUN_VERSION and add a step together.
 */
export const RUN_MIGRATIONS: Record<number, (s: Raw) => Raw> = {};

/** A saved run brought up to date, or null when it can't be: unreadable, too old, or from a newer build. */
export function migrateRun(raw: unknown): RunState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  let s = raw as Raw;
  let v = s.version;
  if (typeof v !== 'number' || v > RUN_VERSION) return null;
  while (v < RUN_VERSION) {
    const step = RUN_MIGRATIONS[v];
    if (!step) return null;
    s = { ...step(s), version: ++v };
  }
  return s as unknown as RunState;
}
