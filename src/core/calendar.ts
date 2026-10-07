import type { RunState } from './state';

/** Days before each week's Night Shift (GDD §3). One tuning constant; the sim compares values. */
export const DAYS_PER_WEEK = 4;
/** The Night Shift is the day after the last ordinary day of the week. */
export const NIGHT_SHIFT_DAY = DAYS_PER_WEEK + 1;

/** A run is one lunar month in one season; clearing a season unlocks the next (GDD §13). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** What the sky looks like right now, for the shop window. Days slide from afternoon into night. */
export type SkyTime = 'afternoon' | 'sunset' | 'twilight' | 'night';
export const SKY_TIMES: readonly SkyTime[] = ['afternoon', 'sunset', 'twilight', 'night'];

/** Daily weather (GDD §4.2). Heatwave is summer-only and snow winter-only. */
export type Weather = 'clear' | 'rain' | 'fog' | 'heatwave' | 'snow';
export const WEATHERS: readonly Weather[] = ['clear', 'rain', 'fog', 'heatwave', 'snow'];

/** Order Board → afternoon, brewing → sunset, dusk errands → twilight; Night Shifts and the Night Market are night. */
export function skyTime(state: Pick<RunState, 'day' | 'phase'>): SkyTime {
  if (state.day === NIGHT_SHIFT_DAY || state.phase === 'night-market') return 'night';
  if (state.phase === 'morning') return 'afternoon';
  if (state.phase === 'dusk') return 'twilight';
  return 'sunset';
}
