import { isMutation, MUTATION_RULES, MUTATIONS, type MutationId } from './mutations';
import { codex } from '../codex';
import { ALMANAC_FIRST_PAGE, almanacMet } from './almanac';
import { allKeepsakes, allStoryKeys, bankFriendship, KEEPSAKE_SLOTS } from './friendship';
import { seedRng, shuffle } from './rng';
import { MAX_YEAR, reputationMult } from './year';
import { SEASONS, WEATHERS, type Season } from './calendar';
import { runWeek, WEEKS } from './rules';
import { RUN_VERSION, type RunState } from './state';

// What persists between runs (GDD §13, tech.md "Persistence"): the profile, and the saved run's
// migrations. Pure: src/profile.ts and src/save.ts do the storage.

export const PROFILE_VERSION = 15;

/** Sound settings: the sound effects' volume and the music's, 0 to 1, and mute (both). */
export type SoundSettings = { volume: number; music: number; muted: boolean };

/** The game's size on screen: a whole-number scale (0 = the largest that fits), and fullscreen. */
export type DisplaySettings = { scale: number; fullscreen: boolean };

/** The largest scale offered in Settings. */
export const MAX_SCALE = 6;

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
  settings: SoundSettings;
  display: DisplaySettings;
  /** Whether each run opens with its season's scene screen (Settings, or "Don't show again" on the screen). */
  seasonOpenings: boolean;
  /** Whether first-time notes show (Settings). */
  notes: boolean;
  /** First-time notes already shown (`view/notes.ts`), each once per save. */
  notesSeen: string[];
  /** Weathers whose first-time scene screen has been shown: each shows once per save. */
  weatherSeen: string[];
  /** The witch and cauldron last chosen at the cottage (GDD §12); runs set out with them. */
  witch: string;
  cauldron: string;
  /** The witches and cauldrons that have won a season, for the Almanac's Every Witch's Way and Every Pot in the House. */
  witchWins: string[];
  cauldronWins: string[];
  /** Friendship points with each regular over the whole save (GDD §4.1). They only ever rise. */
  friendship: Record<string, number>;
  /** Regulars' story scenes already shown (`storyKey`), each once per save (GDD §13). */
  storySeen: string[];
  /** The keepsake box (GDD §13): cards chosen to add to every run's starting deck. */
  keepsakes: string[];
  /**
   * The season the cottage is dressed for (GDD §13): the one you'll set out for next. A win moves it
   * on to the next season, a loss keeps the season you lost in.
   */
  home: Season;
  /** The longest Endless run (GDD §13): weeks lasted past the finale, and where. */
  endlessBest: EndlessBest | null;
  /**
   * Mutations (GDD §13): each Year's (index 0 is Year 1), whether it is locked (a run has set out in
   * that Year), and those whose Year's Winter was won with them on.
   */
  mutations: (MutationId | null)[];
  mutationLocked: boolean[];
  mutationsDone: MutationId[];
};

export type EndlessBest = { weeks: number; season: Season; year: number };

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
    settings: { volume: 0.7, music: 0.5, muted: false },
    display: { scale: 0, fullscreen: false },
    seasonOpenings: true,
    notes: true,
    notesSeen: [],
    weatherSeen: [],
    witch: 'hedge-witch',
    cauldron: 'copper',
    witchWins: [],
    cauldronWins: [],
    friendship: {},
    storySeen: [],
    keepsakes: [],
    home: 'spring',
    endlessBest: null,
    mutations: [null],
    mutationLocked: [false],
    mutationsDone: [],
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
  // 5 → 6: sound settings, at the default volume.
  5: (p) => ({ ...p, settings: newProfile().settings }),
  // 6 → 7: season openings on, and no weather met yet.
  6: (p) => ({ ...p, seasonOpenings: true, weatherSeen: [] }),
  // 7 → 8: witches and cauldrons, starting from the Hedge Witch and Copper.
  7: (p) => ({ ...p, witch: 'hedge-witch', cauldron: 'copper' }),
  // 8 → 9: which witches and cauldrons have won. Every win before them was the Hedge Witch's, in Copper.
  8: (p) => {
    const won = Object.values((p.wins ?? {}) as Record<string, unknown>).some((n) => Number(n) > 0);
    return { ...p, witchWins: won ? ['hedge-witch'] : [], cauldronWins: won ? ['copper'] : [] };
  },
  // 9 → 10: Friendship, from none. Hearts lasted only a run, so there is nothing to carry over.
  9: (p) => ({ ...p, friendship: {} }),
  // 10 → 11: regulars' stories, none seen yet.
  10: (p) => ({ ...p, storySeen: [] }),
  // 11 → 12: the keepsake box, empty.
  11: (p) => ({ ...p, keepsakes: [] }),
  // 12 → 13: the cottage dressed for the newest season open in the chosen Year.
  12: (p) => {
    const years = Array.isArray(p.yearSeasons) ? (p.yearSeasons as unknown[][]) : [];
    const open = years[(typeof p.year === 'number' ? p.year : 1) - 1] ?? [];
    return { ...p, home: SEASONS.filter((x) => open.includes(x)).at(-1) ?? 'spring' };
  },
  // 13 → 14: Endless, never played.
  13: (p) => ({ ...p, endlessBest: p.endlessBest ?? null }),
  // 14 → 15: mutations, none chosen. Years already played are locked, as if they set out unmutated.
  14: (p) => {
    const years = Array.isArray(p.yearSeasons) ? p.yearSeasons.length : 1;
    const runs = typeof p.runs === 'number' ? p.runs : 0;
    return { ...p, mutations: Array(years).fill(null), mutationLocked: Array.from({ length: years }, (_, i) => runs > 0 && i < years - 1), mutationsDone: [] };
  },
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
  const sound = (p.settings && typeof p.settings === 'object' ? p.settings : {}) as Partial<Record<keyof SoundSettings, unknown>>;
  const display = (p.display && typeof p.display === 'object' ? p.display : {}) as Partial<Record<keyof DisplaySettings, unknown>>;
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
    settings: {
      volume: typeof sound.volume === 'number' && Number.isFinite(sound.volume) ? Math.min(1, Math.max(0, sound.volume)) : fresh.settings.volume,
      music: typeof sound.music === 'number' && Number.isFinite(sound.music) ? Math.min(1, Math.max(0, sound.music)) : fresh.settings.music,
      muted: sound.muted === true,
    },
    display: {
      scale: typeof display.scale === 'number' && Number.isInteger(display.scale) && display.scale >= 0 && display.scale <= MAX_SCALE ? display.scale : 0,
      fullscreen: display.fullscreen === true,
    },
    seasonOpenings: p.seasonOpenings !== false,
    notes: p.notes !== false,
    notesSeen: Array.isArray(p.notesSeen) ? [...new Set((p.notesSeen as unknown[]).filter((id): id is string => typeof id === 'string'))] : [],
    weatherSeen: Array.isArray(p.weatherSeen) ? WEATHERS.filter((w) => (p.weatherSeen as unknown[]).includes(w)) : [],
    witch: typeof p.witch === 'string' && codex.witches.has(p.witch) ? p.witch : fresh.witch,
    cauldron: typeof p.cauldron === 'string' && codex.cauldrons.has(p.cauldron) ? p.cauldron : fresh.cauldron,
    witchWins: Array.isArray(p.witchWins) ? [...codex.witches.keys()].filter((id) => (p.witchWins as unknown[]).includes(id)) : [],
    cauldronWins: Array.isArray(p.cauldronWins) ? [...codex.cauldrons.keys()].filter((id) => (p.cauldronWins as unknown[]).includes(id)) : [],
    storySeen: Array.isArray(p.storySeen) ? allStoryKeys().filter((k) => (p.storySeen as unknown[]).includes(k)) : [],
    keepsakes: Array.isArray(p.keepsakes) ? [...new Set((p.keepsakes as unknown[]).filter((k): k is string => typeof k === 'string' && allKeepsakes().includes(k)))].slice(0, KEEPSAKE_SLOTS) : [],
    home: SEASONS.includes(p.home as Season) ? (p.home as Season) : fresh.home,
    friendship: Object.fromEntries([...codex.regulars.keys()].map((id) => [id, count((p.friendship as Raw | undefined)?.[id])] as const).filter(([, n]) => n > 0)),
    endlessBest: endlessBestOf(p.endlessBest),
    mutations: yearSeasons.map((_, i) => {
      const m = Array.isArray(p.mutations) ? p.mutations[i] : null;
      return typeof m === 'string' && isMutation(m) ? m : null;
    }),
    mutationLocked: yearSeasons.map((_, i) => Array.isArray(p.mutationLocked) && p.mutationLocked[i] === true),
    mutationsDone: Array.isArray(p.mutationsDone) ? MUTATIONS.map((m) => m.id).filter((id) => (p.mutationsDone as unknown[]).includes(id)) : [],
  };
}

function endlessBestOf(raw: unknown): EndlessBest | null {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  if (typeof b.weeks !== 'number' || b.weeks < 0 || !SEASONS.includes(b.season as Season)) return null;
  return { weeks: Math.floor(b.weeks), season: b.season as Season, year: typeof b.year === 'number' && b.year >= 1 ? Math.floor(b.year) : 1 };
}

/** Whether a witch is open (GDD §12): the Hedge Witch always; each other the first time her season is won. */
export function witchOpen(p: Pick<Profile, 'wins'>, id: string): boolean {
  const w = codex.witches.get(id);
  return !!w && (w.unlockSeason === null || p.wins[w.unlockSeason] > 0);
}

/** Whether a cauldron is open: Copper always; each other once its Almanac entry is done. */
export function cauldronOpen(p: Pick<Profile, 'almanac'>, id: string): boolean {
  const c = codex.cauldrons.get(id);
  return !!c && (c.unlock === null || p.almanac.includes(c.unlock));
}

/** The witch and cauldron a run sets out with: the profile's choice, or the defaults if it is no longer open. */
export function runStartChoice(p: Pick<Profile, 'wins' | 'almanac' | 'witch' | 'cauldron'>): { witch: string; cauldron: string } {
  return { witch: witchOpen(p, p.witch) ? p.witch : 'hedge-witch', cauldron: cauldronOpen(p, p.cauldron) ? p.cauldron : 'copper' };
}

/** The tables the cottage's Codex shows, in its order (GDD §13). */
export const CODEX_TABLES = {
  ingredients: codex.ingredients,
  tinctures: codex.tinctures,
  recipes: codex.recipes,
  familiars: codex.familiars,
  relics: codex.relics,
  townsfolk: new Map([...codex.regulars, ...codex.nightCustomers, ...codex.visitors, ...codex.patrons].map(([id, c]) => [id, c] as const)),
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

export function reputationFor(s: Pick<RunState, 'phase' | 'week' | 'stats'> & Partial<Pick<RunState, 'year' | 'mutation'>>): number {
  const won = s.phase === 'victory';
  const weeks = won ? WEEKS : Math.max(0, s.week - 1);
  const base = weeks * REPUTATION.week + s.stats.ordersFilled * REPUTATION.order + s.stats.potionsSold * REPUTATION.potionSold + (won ? REPUTATION.win : 0);
  // Each looped Year multiplies what a run earns (×1.5 in Year 2, ×2 in Year 3), so climbing pays.
  // A mutated run (GDD §13) earns a little more.
  return Math.round(base * reputationMult(s.year ?? 1) * (s.mutation ? MUTATION_RULES.reputation : 1));
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
  /** Perk board tiers this run opened. */
  perkTiers: number[];
  /** Witches and cauldrons this run opened (GDD §12). */
  witches: string[];
  cauldrons: string[];
};

/** Witches and cauldrons open after a run that were not before it. */
function newlyOpen(before: Profile, after: Profile): Pick<RunOutcome, 'witches' | 'cauldrons'> {
  return {
    witches: [...codex.witches.keys()].filter((id) => witchOpen(after, id) && !witchOpen(before, id)),
    cauldrons: [...codex.cauldrons.keys()].filter((id) => cauldronOpen(after, id) && !cauldronOpen(before, id)),
  };
}

/** Count a finished run. A run still going, or one already counted, changes nothing. */
export function recordRun(profile: Profile, s: Pick<RunState, 'seed' | 'season' | 'phase' | 'week' | 'stats'> & Partial<Pick<RunState, 'year' | 'gold' | 'witch' | 'cauldronKind' | 'friendship' | 'endless' | 'lostTo' | 'mutation'>>): RunOutcome {
  const same = { profile, reputation: 0, opened: null, yearDone: false, newYear: null, almanac: [], perkTiers: [], witches: [], cauldrons: [] };
  // Endless earns nothing but a best (GDD §13): the win was counted at the finale, before it went on.
  if (s.endless && s.phase === 'game-over') return { ...same, profile: recordEndless(profile, s) };
  if ((s.phase !== 'victory' && s.phase !== 'game-over') || profile.lastRun === s.seed) return same;
  const reputation = reputationFor(s);
  const won = s.phase === 'victory';
  const witchWins = won && s.witch && !profile.witchWins.includes(s.witch) ? [...profile.witchWins, s.witch] : profile.witchWins;
  const cauldronWins = won && s.cauldronKind && !profile.cauldronWins.includes(s.cauldronKind) ? [...profile.cauldronWins, s.cauldronKind] : profile.cauldronWins;
  const almanac = almanacMet(profile.almanac, { ...s, witchWins, cauldronWins });
  const p: Profile = {
    ...profile, yearSeasons: profile.yearSeasons.map((y) => [...y]), boons: [...profile.boons], wins: { ...profile.wins }, perks: [...profile.perks], runs: profile.runs + 1, lastRun: s.seed,
    reputation: profile.reputation + reputation, reputationEarned: profile.reputationEarned + reputation, almanac: [...profile.almanac, ...almanac],
    codex: [...profile.codex, ...codexMet(profile.codex, s)], witchWins, cauldronWins,
    // Friendship earned this run banks, won or lost.
    friendship: bankFriendship(profile.friendship, s.friendship ?? {}),
  };
  // The cottage is dressed for the next season you'll play: the one you lost in, or the one after a win.
  p.home = s.phase === 'game-over' ? s.season : (nextSeason(s.season) ?? 'spring');
  if (s.phase === 'game-over') return { ...same, profile: p, reputation, almanac, perkTiers: tiersOpened(profile, p), ...newlyOpen(profile, p) };
  p.wins[s.season]++;
  const year = Math.min(p.yearSeasons.length, s.year ?? 1);
  const open = p.yearSeasons[year - 1]!;
  const next = nextSeason(s.season);
  const opened = next && !open.includes(next) ? next : null;
  if (opened) p.yearSeasons[year - 1] = SEASONS.filter((x) => x === opened || open.includes(x));
  const yearDone = s.season === 'winter';
  if (yearDone) p.years++;
  // Winning the top Year's Winter opens the next Year, once looping is open.
  // Winter won with the Year's mutation on ticks it off for good.
  const mutation = s.mutation ?? null;
  if (yearDone && mutation && profile.mutations[year - 1] === mutation && !p.mutationsDone.includes(mutation)) p.mutationsDone = [...p.mutationsDone, mutation];
  const newYear = yearDone && year === p.yearSeasons.length && loopOpen(p) ? year + 1 : null;
  if (newYear) {
    p.yearSeasons.push(['spring']);
    p.boons.push(null);
    p.mutations = [...p.mutations, null];
    p.mutationLocked = [...p.mutationLocked, false];
  }
  return { profile: p, reputation, opened, yearDone, newYear, almanac, perkTiers: tiersOpened(profile, p), ...newlyOpen(profile, p) };
}

/** Endless opens once you reach this Year (GDD §13). */
export const ENDLESS_YEAR = 5;

export const endlessOpen = (p: Pick<Profile, 'yearSeasons'>): boolean => p.yearSeasons.length >= ENDLESS_YEAR;

/** Weeks an Endless run has lasted past its first finale: each rent paid (a lost finale paid that week's). */
export function endlessWeeks(s: Pick<RunState, 'week'> & Partial<Pick<RunState, 'endless' | 'lostTo' | 'phase'>>): number {
  if (!s.endless) return 0;
  const paidThisWeek = s.phase === 'victory' || (s.phase === 'game-over' && s.lostTo === 'finale');
  return Math.max(0, runWeek(s) - WEEKS - (paidThisWeek ? 0 : 1));
}

/** An Endless run's weeks against the best, kept if longer. Counting it twice changes nothing. */
function recordEndless(p: Profile, s: Pick<RunState, 'season' | 'week'> & Partial<Pick<RunState, 'year' | 'endless' | 'lostTo' | 'phase'>>): Profile {
  const weeks = endlessWeeks(s);
  if (p.endlessBest && p.endlessBest.weeks >= weeks) return p;
  return { ...p, endlessBest: { weeks, season: s.season, year: s.year ?? 1 } };
}

/** Almanac entries done that open looping before a second Year is won (GDD §13): a quarter of the first page, kept when the harder entries came. */
export const LOOP_ALMANAC = 4;

/**
 * Whether winning Winter in your top Year opens the next: Year 1 always just ends with the ending, so
 * from the second Year completed on, or once LOOP_ALMANAC entries are done. Never past MAX_YEAR.
 */
export function loopOpen(p: Pick<Profile, 'years' | 'yearSeasons' | 'almanac'>): boolean {
  return p.yearSeasons.length < MAX_YEAR && (p.years >= 2 || p.almanac.length >= LOOP_ALMANAC);
}

/** The seasons open in a Year (the chosen one by default). */
export const seasonsOf = (p: Pick<Profile, 'yearSeasons' | 'year'>, year = p.year): Season[] => p.yearSeasons[year - 1] ?? [];

/** The season the cottage is dressed for: `home` if it's open in the chosen Year, else that Year's newest. */
export function homeSeason(p: Pick<Profile, 'yearSeasons' | 'year' | 'home'>): Season {
  const open = seasonsOf(p);
  return open.includes(p.home) ? p.home : (open.at(-1) ?? 'spring');
}

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

/** Mutations open once a first Year is done (GDD §13). */
export const mutationsOpen = (p: Pick<Profile, 'years'>): boolean => p.years >= 1;

/** The chosen Year's mutation, if it has one. */
export const mutationOf = (p: Pick<Profile, 'mutations' | 'year'>): MutationId | null => p.mutations[p.year - 1] ?? null;

/** Whether the chosen Year's mutation can still be changed: open, and no run has set out in it. */
export const mutationChangeable = (p: Pick<Profile, 'years' | 'year' | 'mutationLocked'>): boolean => mutationsOpen(p) && !p.mutationLocked[p.year - 1];

/** Choose (or clear, with null) the chosen Year's mutation, before Spring starts. */
export function chooseMutation(p: Profile, id: MutationId | null): Profile {
  if (!mutationChangeable(p)) throw new Error(`Year ${p.year}'s mutation is locked`);
  const mutations = [...p.mutations];
  mutations[p.year - 1] = id;
  return { ...p, mutations };
}

/** A run sets out in the chosen Year: its mutation, chosen or not, is now fixed for that Year. */
export function lockMutation(p: Profile): Profile {
  if (p.mutationLocked[p.year - 1]) return p;
  const mutationLocked = [...p.mutationLocked];
  mutationLocked[p.year - 1] = true;
  return { ...p, mutationLocked };
}

/** Choose the chosen Year's boon from the three on offer; it lasts every run in that Year. */
export function pickBoon(p: Profile, id: string): Profile {
  if (!p.boonOffer?.includes(id)) throw new Error(`${id} is not on offer`);
  const boons = [...p.boons];
  boons[p.year - 1] = id;
  return { ...p, boons, boonOffer: null };
}

/**
 * The perk board's tiers (GDD §13): tier 1 is open from the start, and each later tier opens with a
 * Year reached (won, for tier 2) or with Almanac entries done, whichever comes first.
 */
export const PERK_TIERS = [
  { tier: 2, years: 1, almanac: 4 },
  { tier: 3, year: 3, almanac: 8 },
  // The first page, as when the board was tuned; the harder entries came later.
  { tier: 4, year: 6, almanac: ALMANAC_FIRST_PAGE },
] as const;

type TierRule = { tier: number; years?: number; year?: number; almanac: number };

/** Whether a tier of the perk board is open. */
export function perkTierOpen(p: Pick<Profile, 'years' | 'yearSeasons' | 'almanac'>, tier: number): boolean {
  const rule: TierRule | undefined = PERK_TIERS.find((r) => r.tier === tier);
  if (!rule) return tier === 1;
  return p.years >= (rule.years ?? Infinity) || p.yearSeasons.length >= (rule.year ?? Infinity) || p.almanac.length >= rule.almanac;
}

/** What opens a tier of the perk board, as a line for the cottage. */
export function perkTierGoal(tier: number): string {
  const rule: TierRule | undefined = PERK_TIERS.find((r) => r.tier === tier);
  if (!rule) return '';
  const first = rule.years ? 'Win a Year' : `Reach Year ${rule.year}`;
  const almanac = rule.almanac >= codex.almanac.size ? 'the whole Almanac' : `${rule.almanac} Almanac entries`;
  return `${first} or ${almanac} to open.`;
}

const tiersOpened = (before: Profile, after: Profile): number[] => PERK_TIERS.map((r) => r.tier).filter((t) => !perkTierOpen(before, t) && perkTierOpen(after, t));

/** Why this perk can't be bought now, or null. */
export function perkBlocked(p: Profile, id: string): string | null {
  const perk = codex.perks.get(id);
  if (!perk) return `no perk ${id}`;
  if (p.perks.includes(id)) return 'already yours';
  if (!perkTierOpen(p, perk.tier)) return perkTierGoal(perk.tier);
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
  // 14 → 15: day counters for the Bloomtide Fair's Hive Smoker and Garland.
  14: (s) => ({ ...s, discardsToday: 0, flowerPotencyToday: 0 }),
  // 15 → 16: the Firefly and Harvest Fairs' counters (Mulling Spice, the Corn Dolly, the Prism).
  15: (s) => ({ ...s, emberPotencyToday: 0, weekDeliveries: 0, pending: { ...(s.pending as Raw), essenceHarmony: 0 } }),
  // 16 → 17: the Longest Night vigil's blessing.
  16: (s) => ({ ...s, blessing: null }),
  // 17 → 18: witches and cauldrons. Every run before them was the Hedge Witch's, in Copper.
  17: (s) => ({ ...s, cauldronKind: 'copper', quirkUsed: false }),
  // 18 → 19: the harder Almanac goals' stats. A Legendary already brewed counts once; Discards so far count the Discard actions.
  18: (s) => {
    const stats = s.stats as Raw;
    return { ...s, stats: { ...stats, legendaries: Number(stats.bestTier) >= 4 ? 1 : 0, discardsUsed: Number(s.discardCount) || 0 } };
  },
  // 19 → 20: Friendship in place of hearts. The regulars' hearts so far count as Friendship earned this
  // run; the profile had none before this run, so its base is empty.
  19: ({ hearts, ...s }) => {
    const old = (hearts && typeof hearts === 'object' ? hearts : {}) as Raw;
    const friendship = Object.fromEntries(Object.entries(old).filter(([id, n]) => codex.regulars.has(id) && typeof n === 'number' && n > 0));
    return { ...s, friendship, friendshipBase: {} };
  },
  // 20 → 21: the Firefly Keeper's half-price buys (seasonal visitors).
  20: (s) => ({ ...s, halfPrice: 0, favours: [] }),
  21: (s) => ({ ...s, tomorrow: { brews: 0, discards: 0 }, forfeitReward: false, blindBrew: false, patronsRead: false }),
  // 22 → 23: Endless, not entered.
  22: (s) => ({ ...s, endless: 0 }),
  // 23 → 24: mutations, none on.
  23: (s) => ({ ...s, mutation: null }),
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
