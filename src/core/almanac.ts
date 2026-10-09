import { codex } from '../codex';
import { tierIndex, WEEKS } from './rules';
import type { RunState } from './state';

// The Almanac (GDD §13): goals met in any run, won or lost. Each entry adds content to the pools for
// good. Entries are codex data (`almanac`); their goals are here, by id, read from a finished run.

export type AlmanacRun = Pick<RunState, 'season' | 'phase' | 'stats'>;

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
};

/** Almanac entries this run met that aren't already done, in Almanac order. */
export function almanacMet(done: readonly string[], s: AlmanacRun): string[] {
  return [...codex.almanac.keys()].filter((id) => !done.includes(id) && ALMANAC_GOALS[id]?.(s));
}

/** Everything the done entries have added to the pools: pass it to `startRun` as `unlocks`. */
export function almanacUnlocks(done: readonly string[]): string[] {
  return [...codex.almanac.values()].filter((e) => done.includes(e.id)).flatMap((e) => e.unlocks);
}
