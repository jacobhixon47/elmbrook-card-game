import { codex } from '../codex';
import { almanacMet } from './almanac';
import { SEASONS, type Season } from './calendar';
import { WEEKS } from './rules';
import { RUN_VERSION, type RunState } from './state';

// What persists between runs (GDD §13, tech.md "Persistence"): the profile, and the saved run's
// migrations. Pure: src/profile.ts and src/save.ts do the storage.

export const PROFILE_VERSION = 3;

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
  /** Reputation to spend at the cottage, and all ever earned. */
  reputation: number;
  reputationEarned: number;
  /** Cottage perks bought (codex `perks`). */
  perks: string[];
  /** Almanac entries done (codex `almanac`), in the order they were met. */
  almanac: string[];
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
    reputation: 0,
    reputationEarned: 0,
    perks: [],
    almanac: [],
  };
}

type Raw = Record<string, unknown>;

/**
 * Each step takes a profile of version n to n + 1. Version 0 is the M2.5 profile, `{ tutorialDone }`
 * with no version field. Add a step (and bump PROFILE_VERSION) for any change old saves can't read.
 */
const PROFILE_MIGRATIONS: Record<number, (p: Raw) => Raw> = {
  0: (p) => ({ ...newProfile(), tutorialDone: p.tutorialDone === true }),
  // 1 → 2: Reputation and perks, starting from none.
  1: (p) => ({ ...p, reputation: 0, reputationEarned: 0, perks: [] }),
  // 2 → 3: the Almanac, with nothing done.
  2: (p) => ({ ...p, almanac: [] }),
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
    reputation: count(p.reputation),
    reputationEarned: count(p.reputationEarned),
    perks: Array.isArray(p.perks) ? [...codex.perks.keys()].filter((id) => (p.perks as unknown[]).includes(id)) : [],
    almanac: Array.isArray(p.almanac) ? [...new Set(p.almanac)].filter((id): id is string => typeof id === 'string' && codex.almanac.has(id)) : [],
  };
}

/** The season a win in this one opens, or null after Winter. */
export function nextSeason(season: Season): Season | null {
  return SEASONS[SEASONS.indexOf(season) + 1] ?? null;
}

/** Reputation a finished run earns (GDD §13): for each week's rent paid, each order filled and potion sold, and a win. */
export const REPUTATION = { week: 4, order: 1, potionSold: 1, win: 10 } as const;

export function reputationFor(s: Pick<RunState, 'phase' | 'week' | 'stats'>): number {
  const won = s.phase === 'victory';
  const weeks = won ? WEEKS : Math.max(0, s.week - 1);
  return weeks * REPUTATION.week + s.stats.ordersFilled * REPUTATION.order + s.stats.potionsSold * REPUTATION.potionSold + (won ? REPUTATION.win : 0);
}

export type RunOutcome = {
  profile: Profile;
  /** Reputation the run earned. */
  reputation: number;
  /** A season this run opened. */
  opened: Season | null;
  /** This run completed a Year (a win in Winter). */
  yearDone: boolean;
  /** Almanac entries this run met for the first time. */
  almanac: string[];
};

/** Count a finished run. A run still going, or one already counted, changes nothing. */
export function recordRun(profile: Profile, s: Pick<RunState, 'seed' | 'season' | 'phase' | 'week' | 'stats'>): RunOutcome {
  const same = { profile, reputation: 0, opened: null, yearDone: false, almanac: [] };
  if ((s.phase !== 'victory' && s.phase !== 'game-over') || profile.lastRun === s.seed) return same;
  const reputation = reputationFor(s);
  const almanac = almanacMet(profile.almanac, s);
  const p: Profile = {
    ...profile, seasons: [...profile.seasons], wins: { ...profile.wins }, perks: [...profile.perks], runs: profile.runs + 1, lastRun: s.seed,
    reputation: profile.reputation + reputation, reputationEarned: profile.reputationEarned + reputation, almanac: [...profile.almanac, ...almanac],
  };
  if (s.phase === 'game-over') return { ...same, profile: p, reputation, almanac };
  p.wins[s.season]++;
  const next = nextSeason(s.season);
  const opened = next && !p.seasons.includes(next) ? next : null;
  if (opened) p.seasons = SEASONS.filter((x) => x === opened || p.seasons.includes(x));
  const yearDone = s.season === 'winter';
  if (yearDone) p.years++;
  return { profile: p, reputation, opened, yearDone, almanac };
}

/** Why this perk can't be bought now, or null. */
export function perkBlocked(p: Profile, id: string): string | null {
  const perk = codex.perks.get(id);
  if (!perk) return `no perk ${id}`;
  if (p.perks.includes(id)) return 'already yours';
  return p.reputation < perk.cost ? `needs ${perk.cost} Reputation` : null;
}

/** Buy a cottage perk with Reputation; it applies from the next run on. */
export function buyPerk(p: Profile, id: string): Profile {
  const why = perkBlocked(p, id);
  if (why) throw new Error(why);
  return { ...p, perks: [...p.perks, id], reputation: p.reputation - codex.perks.get(id)!.cost };
}

/**
 * Steps that bring a saved run of version n up to n + 1, so a game update doesn't throw away a run
 * in progress. A version with no step can't be continued. Bump RUN_VERSION and add a step together.
 */
export const RUN_MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // 10 → 11: run stats for Reputation. A run saved before them starts counting from now.
  10: (s) => ({ ...s, stats: { ordersFilled: 0, potionsSold: 0 } }),
  // 11 → 12: the stats Almanac goals read. Rent paid and holdings come from the run so far; the best brew starts from now.
  11: (s) => {
    const stats = (s.stats ?? {}) as Raw;
    const held = (k: string) => (Array.isArray(s[k]) ? (s[k] as unknown[]).length : 0);
    const week = typeof s.week === 'number' ? s.week : 1;
    return { ...s, stats: { ...stats, rentsPaid: Math.max(0, week - 1), bestTier: -1, mostFamiliars: held('familiars'), mostRelics: held('relics'), cursesTaken: held('curses') } };
  },
};

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
