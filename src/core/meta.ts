import { codex } from '../codex';
import { almanacMet } from './almanac';
import { seedRng, shuffle } from './rng';
import { MAX_YEAR, reputationMult } from './year';
import { SEASONS, type Season } from './calendar';
import { WEEKS } from './rules';
import { RUN_VERSION, type RunState } from './state';

// What persists between runs (GDD §13, tech.md "Persistence"): the profile, and the saved run's
// migrations. Pure: src/profile.ts and src/save.ts do the storage.

export const PROFILE_VERSION = 5;

export type Profile = {
  version: typeof PROFILE_VERSION;
  tutorialDone: boolean;
  /**
   * Each Year you've reached (index 0 is Year 1) and the seasons open in it, in Year order. Spring is
   * always open; winning a season opens the next. A Year opens at Spring once the one before it is won.
   */
  yearSeasons: Season[][];
  /** Runs finished, and runs won by season. */
  runs: number;
  wins: Record<Season, number>;
  /** Years completed: each win in Winter. */
  years: number;
  /** The Year you've chosen to play at the cottage (GDD §13). Its modifiers apply to every run. */
  year: number;
  /** The boon picked for each Year (index 0 is Year 1, which has none), and the three on offer while the chosen Year's is still to pick. */
  boons: (string | null)[];
  boonOffer: string[] | null;
  /** The seed of the last run counted, so a run is never counted twice. */
  lastRun: string | null;
  /** Reputation to spend at the cottage, and all ever earned. */
  reputation: number;
  reputationEarned: number;
  /** Cottage perks bought (codex `perks`). */
  perks: string[];
  /** Almanac entries done (codex `almanac`), in the order they were met. */
  almanac: string[];
  /** Codex entries met in any run (cards, recipes, familiars, relics, customers), in the order first met. */
  codex: string[];
};

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    tutorialDone: false,
    yearSeasons: [['spring']],
    runs: 0,
    wins: { spring: 0, summer: 0, autumn: 0, winter: 0 },
    years: 0,
    year: 1,
    boons: [null],
    boonOffer: null,
    lastRun: null,
    reputation: 0,
    reputationEarned: 0,
    perks: [],
    almanac: [],
    codex: [],
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
  // 3 → 4: the Codex, with nothing met yet.
  3: (p) => ({ ...p, codex: [] }),
  // 4 → 5: Years, each with its own seasons. Everything so far was Year 1.
  4: (p) => ({ ...p, yearSeasons: p.yearSeasons ?? [p.seasons ?? ['spring']], year: 1, boons: [null], boonOffer: null }),
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
  const openIn = (list: unknown): Season[] => {
    const open = Array.isArray(list) ? SEASONS.filter((s) => list.includes(s)) : [];
    return open.includes('spring') ? open : ['spring', ...open];
  };
  const yearSeasons = (Array.isArray(p.yearSeasons) && p.yearSeasons.length ? p.yearSeasons : [[]]).slice(0, MAX_YEAR).map(openIn);
  const boons = Array.isArray(p.boons) ? p.boons : [];
  const offer = p.boonOffer;
  const wins = (p.wins && typeof p.wins === 'object' ? p.wins : {}) as Partial<Record<Season, unknown>>;
  const count = (n: unknown) => (typeof n === 'number' && n >= 0 ? Math.floor(n) : 0);
  return {
    version: PROFILE_VERSION,
    tutorialDone: p.tutorialDone === true,
    yearSeasons,
    runs: count(p.runs),
    wins: Object.fromEntries(SEASONS.map((s) => [s, count(wins[s])])) as Record<Season, number>,
    years: count(p.years),
    year: Math.min(yearSeasons.length, Math.max(1, count(p.year))),
    boons: yearSeasons.map((_, i) => (i > 0 && typeof boons[i] === 'string' && codex.boons.has(boons[i]) ? boons[i] : null)),
    boonOffer: Array.isArray(offer) && offer.length && offer.every((id) => typeof id === 'string' && codex.boons.has(id)) ? (offer as string[]) : null,
    lastRun: typeof p.lastRun === 'string' ? p.lastRun : fresh.lastRun,
    reputation: count(p.reputation),
    reputationEarned: count(p.reputationEarned),
    perks: Array.isArray(p.perks) ? [...codex.perks.keys()].filter((id) => (p.perks as unknown[]).includes(id)) : [],
    almanac: Array.isArray(p.almanac) ? [...new Set(p.almanac)].filter((id): id is string => typeof id === 'string' && codex.almanac.has(id)) : [],
    codex: Array.isArray(p.codex) ? [...new Set(p.codex)].filter((id): id is string => typeof id === 'string' && inCodex(id)) : [],
  };
}

/** The tables the cottage's Codex shows, in its order (GDD §13). */
export const CODEX_TABLES = {
  ingredients: codex.ingredients,
  tinctures: codex.tinctures,
  recipes: codex.recipes,
  familiars: codex.familiars,
  relics: codex.relics,
  townsfolk: new Map([...codex.regulars, ...codex.nightCustomers, ...codex.patrons].map(([id, c]) => [id, c] as const)),
} as const;
export type CodexTable = keyof typeof CODEX_TABLES;

export const inCodex = (id: string) => Object.values(CODEX_TABLES).some((t) => t.has(id));

/** Ids this run met that the Codex hasn't recorded yet, in Codex order of first meeting. */
export function codexMet(known: readonly string[], s: Pick<RunState, 'stats'>): string[] {
  return s.stats.met.filter((id) => inCodex(id) && !known.includes(id));
}

/** The season a win in this one opens, or null after Winter. */
export function nextSeason(season: Season): Season | null {
  return SEASONS[SEASONS.indexOf(season) + 1] ?? null;
}

/** Reputation a finished run earns (GDD §13): for each week's rent paid, each order filled and potion sold, and a win. */
export const REPUTATION = { week: 4, order: 1, potionSold: 1, win: 10 } as const;

export function reputationFor(s: Pick<RunState, 'phase' | 'week' | 'stats'> & Partial<Pick<RunState, 'year'>>): number {
  const won = s.phase === 'victory';
  const weeks = won ? WEEKS : Math.max(0, s.week - 1);
  const base = weeks * REPUTATION.week + s.stats.ordersFilled * REPUTATION.order + s.stats.potionsSold * REPUTATION.potionSold + (won ? REPUTATION.win : 0);
  // Each looped Year multiplies what a run earns (×1.5 in Year 2, ×2 in Year 3), so climbing pays.
  return Math.round(base * reputationMult(s.year ?? 1));
}

export type RunOutcome = {
  profile: Profile;
  /** Reputation the run earned. */
  reputation: number;
  /** A season this run opened. */
  opened: Season | null;
  /** This run completed a Year (a win in Winter). */
  yearDone: boolean;
  /** The Year this Winter win opened, if any. */
  newYear: number | null;
  /** Almanac entries this run met for the first time. */
  almanac: string[];
};

/** Count a finished run. A run still going, or one already counted, changes nothing. */
export function recordRun(profile: Profile, s: Pick<RunState, 'seed' | 'season' | 'phase' | 'week' | 'stats'> & Partial<Pick<RunState, 'year'>>): RunOutcome {
  const same = { profile, reputation: 0, opened: null, yearDone: false, newYear: null, almanac: [] };
  if ((s.phase !== 'victory' && s.phase !== 'game-over') || profile.lastRun === s.seed) return same;
  const reputation = reputationFor(s);
  const almanac = almanacMet(profile.almanac, s);
  const p: Profile = {
    ...profile, yearSeasons: profile.yearSeasons.map((y) => [...y]), boons: [...profile.boons], wins: { ...profile.wins }, perks: [...profile.perks], runs: profile.runs + 1, lastRun: s.seed,
    reputation: profile.reputation + reputation, reputationEarned: profile.reputationEarned + reputation, almanac: [...profile.almanac, ...almanac],
    codex: [...profile.codex, ...codexMet(profile.codex, s)],
  };
  if (s.phase === 'game-over') return { ...same, profile: p, reputation, almanac };
  p.wins[s.season]++;
  const year = Math.min(p.yearSeasons.length, s.year ?? 1);
  const open = p.yearSeasons[year - 1]!;
  const next = nextSeason(s.season);
  const opened = next && !open.includes(next) ? next : null;
  if (opened) p.yearSeasons[year - 1] = SEASONS.filter((x) => x === opened || open.includes(x));
  const yearDone = s.season === 'winter';
  if (yearDone) p.years++;
  // Winning the top Year's Winter opens the next Year, once looping is open.
  const newYear = yearDone && year === p.yearSeasons.length && loopOpen(p) ? year + 1 : null;
  if (newYear) {
    p.yearSeasons.push(['spring']);
    p.boons.push(null);
  }
  return { profile: p, reputation, opened, yearDone, newYear, almanac };
}

/** Almanac entries done that open looping before a second Year is won (GDD §13: a quarter of the Almanac). */
export const LOOP_ALMANAC = Math.ceil(codex.almanac.size / 4);

/**
 * Whether winning Winter in your top Year opens the next: Year 1 always just ends with the ending, so
 * from the second Year completed on, or once a quarter of the Almanac is done. Never past MAX_YEAR.
 */
export function loopOpen(p: Pick<Profile, 'years' | 'yearSeasons' | 'almanac'>): boolean {
  return p.yearSeasons.length < MAX_YEAR && (p.years >= 2 || p.almanac.length >= LOOP_ALMANAC);
}

/** The seasons open in a Year (the chosen one by default). */
export const seasonsOf = (p: Pick<Profile, 'yearSeasons' | 'year'>, year = p.year): Season[] => p.yearSeasons[year - 1] ?? [];

/** The boon of the chosen Year, if it has one. */
export const boonOf = (p: Pick<Profile, 'boons' | 'year'>): string | null => p.boons[p.year - 1] ?? null;

/** Three boons to choose from for a new Year, the same for the same profile. */
export function rollBoons(year: number, years: number): string[] {
  return shuffle([...codex.boons.keys()], seedRng(`boons-${year}-${years}`))[0].slice(0, 3);
}

/** Play a Year you've reached. A Year after the first with no boon yet offers three to choose from. */
export function chooseYear(p: Profile, year: number): Profile {
  if (year < 1 || year > p.yearSeasons.length) throw new Error(`Year ${year} is not open`);
  const offer = year > 1 && !p.boons[year - 1] ? rollBoons(year, p.years) : null;
  return { ...p, year, boonOffer: offer };
}

/** Choose the chosen Year's boon from the three on offer; it lasts every run in that Year. */
export function pickBoon(p: Profile, id: string): Profile {
  if (!p.boonOffer?.includes(id)) throw new Error(`${id} is not on offer`);
  const boons = [...p.boons];
  boons[p.year - 1] = id;
  return { ...p, boons, boonOffer: null };
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
  // 12 → 13: Codex ids met, from what the run holds now.
  12: (s) => {
    const ids = (k: string) => (Array.isArray(s[k]) ? (s[k] as unknown[]) : []);
    const cards = ['drawPile', 'hand', 'cauldron', 'discardPile'].flatMap(ids).map((c) => (c as { card?: unknown }).card);
    const customers = ids('orders').map((o) => (o as { customer?: unknown }).customer);
    const met = [...new Set([...cards, ...ids('knownRecipes'), ...ids('familiars'), ...ids('relics'), ...customers])].filter((x): x is string => typeof x === 'string');
    return { ...s, stats: { ...(s.stats as Raw), met } };
  },
  // 13 → 14: the Year; every run before looping existed was in Year 1.
  13: (s) => ({ ...s, year: 1 }),
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
