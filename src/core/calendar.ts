import type { RunState } from './state';

/** A run is one lunar month in one season; clearing a season unlocks the next (see GDD §2). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** What the sky looks like right now, for the shop window. */
export type SkyTime = 'morning' | 'afternoon' | 'evening' | 'night';
export const SKY_TIMES: readonly SkyTime[] = ['morning', 'afternoon', 'evening', 'night'];

/** Days run morning (order board) → afternoon (brewing) → evening (dusk); Night Shifts and the Night Market are night. */
export function skyTime(state: Pick<RunState, 'day' | 'phase'>): SkyTime {
  if (state.day === 4 || state.phase === 'night-market') return 'night';
  if (state.phase === 'morning') return 'morning';
  if (state.phase === 'dusk') return 'evening';
  return 'afternoon';
}
