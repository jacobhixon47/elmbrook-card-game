import { codex } from '../codex';
import { tierIndex, WEEKS } from './rules';
import type { RunState } from './state';

// The Almanac (GDD §13): goals met in any run, won or lost. Each entry adds content to the pools for
// good. Entries are codex data (`almanac`); their goals are here, by id, read from a finished run.

export type AlmanacRun = Pick<RunState, 'season' | 'phase' | 'stats'> & Partial<Pick<RunState, 'year' | 'gold'>> & {
  /** The witches and cauldrons that have ever won a season, this run included. */
  witchWins?: readonly string[];
  cauldronWins?: readonly string[];
};

/** The first page's entries come first in the codex; the rest are the second page. */
export const ALMANAC_FIRST_PAGE = 13;

/** The second page's goals (GDD §13): harder, for players who have seen the first page through. */
export const HARD_ALMANAC = { legendaries: 3, orders: 40, gold: 150, deepWinterYear: 3 } as const;

export const ALMANAC_GOALS: Record<string, (s: AlmanacRun) => boolean> = {
  'open-for-business': (s) => s.stats.ordersFilled >= 25,
  'paid-up': (s) => s.stats.rentsPaid >= Math.min(3, WEEKS),
  'superb-work': (s) => s.stats.bestTier >= tierIndex('superb'),
  'masterwork': (s) => s.stats.bestTier >= tierIndex('masterwork'),
  'legendary': (s) => s.stats.bestTier >= tierIndex('legendary'),
  'shopkeeper': (s) => s.stats.potionsSold >= 12,
  'menagerie': (s) => s.stats.mostFamiliars >= 3,
  'collector': (s) => s.stats.mostRelics >= 4,
  'nameless-deal': (s) => s.stats.cursesTaken >= 1,
  'spring-won': (s) => s.phase === 'victory' && s.season === 'spring',
  'summer-won': (s) => s.phase === 'victory' && s.season === 'summer',
  'autumn-won': (s) => s.phase === 'victory' && s.season === 'autumn',
  'winter-won': (s) => s.phase === 'victory' && s.season === 'winter',
  'legend-thrice': (s) => s.stats.legendaries >= HARD_ALMANAC.legendaries,
  'full-ledger': (s) => s.stats.ordersFilled >= HARD_ALMANAC.orders,
  'steady-hand': (s) => s.phase === 'victory' && s.stats.discardsUsed === 0,
  'every-witch': (s) => [...codex.witches.keys()].every((id) => s.witchWins?.includes(id)),
  'every-cauldron': (s) => [...codex.cauldrons.keys()].every((id) => s.cauldronWins?.includes(id)),
  'deep-winter': (s) => s.phase === 'victory' && s.season === 'winter' && (s.year ?? 1) >= HARD_ALMANAC.deepWinterYear,
  'tidy-sum': (s) => s.phase === 'victory' && (s.gold ?? 0) >= HARD_ALMANAC.gold,
};

/** Almanac entries this run met that aren't already done, in Almanac order. */
export function almanacMet(done: readonly string[], s: AlmanacRun): string[] {
  return [...codex.almanac.keys()].filter((id) => !done.includes(id) && ALMANAC_GOALS[id]?.(s));
}

/** Everything the done entries have added to the pools: pass it to `startRun` as `unlocks`. */
export function almanacUnlocks(done: readonly string[]): string[] {
  return [...codex.almanac.values()].filter((e) => done.includes(e.id)).flatMap((e) => e.unlocks);
}
