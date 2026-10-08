import { nextFloat, seedRng } from './rng';
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

/** Which weather each season can roll (GDD §4.2). */
export const SEASON_WEATHER: Record<Season, readonly Weather[]> = {
  spring: ['clear', 'rain', 'fog'],
  summer: ['clear', 'rain', 'fog', 'heatwave'],
  autumn: ['clear', 'rain', 'fog'],
  winter: ['clear', 'fog', 'snow'],
};

/** Order Board → afternoon, brewing → sunset, dusk errands → twilight; Night Shifts and the Night Market are night. */
export function skyTime(state: Pick<RunState, 'day' | 'phase'>): SkyTime {
  if (state.day === NIGHT_SHIFT_DAY || state.phase === 'night-market') return 'night';
  if (state.phase === 'morning') return 'afternoon';
  if (state.phase === 'dusk') return 'twilight';
  return 'sunset';
}

// ---------------------------------------------------------------- the Calendar (GDD §3, §4.2)

/** How likely each weather is per season (balance tables, events.json). */
export const WEATHER_WEIGHTS: Record<Season, readonly (readonly [Weather, number])[]> = {
  spring: [['clear', 50], ['rain', 35], ['fog', 15]],
  summer: [['clear', 45], ['rain', 15], ['fog', 10], ['heatwave', 30]],
  autumn: [['clear', 45], ['rain', 30], ['fog', 25]],
  winter: [['clear', 35], ['fog', 20], ['snow', 45]],
};

/** The moon on each week's Night Shift: Full Moon is the mid-run boss, New Moon the finale (GDD §3). */
export type Moon = 'first-quarter' | 'full' | 'last-quarter' | 'new';
export const WEEK_MOONS: readonly Moon[] = ['first-quarter', 'full', 'last-quarter', 'new'];
export const MOON_NAME: Record<Moon, string> = { 'first-quarter': 'First Quarter', full: 'Full Moon', 'last-quarter': 'Last Quarter', new: 'New Moon' };

/** Each season's festival, fixed on week 3, day 3 (GDD §4.2). */
export type Festival = 'bloomtide' | 'firefly-fair' | 'harvest-fair' | 'longest-night';
export const SEASON_FESTIVAL: Record<Season, Festival> = {
  spring: 'bloomtide', summer: 'firefly-fair', autumn: 'harvest-fair', winter: 'longest-night',
};
export const FESTIVAL_WEEK = 3;
export const FESTIVAL_DAY = 3;

/**
 * Rare sky events, at most one per run. Each entry is the share of all runs that get it. Blue Moon
 * and the Fae Ring arrive with patrons and fae bargains (later M3 parts).
 */
export type SkyEvent = 'eclipse' | 'meteor-shower';
export const SKY_CHANCE: readonly (readonly [SkyEvent, number])[] = [['eclipse', 0.06], ['meteor-shower', 0.06]];

/** An Eclipse lands on one Day of weeks 2-4; a Meteor Shower lasts one week, 2-3. */
export type SkyDate = { event: SkyEvent; week: number; day: number | null };

/** The month ahead, rolled once at run start so it can be planned around. */
export type Calendar = {
  /** weather[week - 1][day - 1], Night Shifts included. */
  weather: Weather[][];
  sky: SkyDate | null;
};

/**
 * Roll the Calendar from the run seed. It uses its own stream, so the deck shuffles and orders a seed
 * gives stay the same whatever the Calendar holds.
 */
export function rollCalendar(seed: string, season: Season, weeks: number): Calendar {
  let rng = seedRng(`${seed}:calendar`);
  const roll = () => {
    const [f, next] = nextFloat(rng);
    rng = next;
    return f;
  };
  const pickWeighted = <T>(options: readonly (readonly [T, number])[]): T => {
    let left = roll() * options.reduce((n, [, w]) => n + w, 0);
    for (const [v, w] of options) if ((left -= w) < 0) return v;
    return options[options.length - 1]![0];
  };
  const weather = Array.from({ length: weeks }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => pickWeighted(WEATHER_WEIGHTS[season])));
  let sky: SkyDate | null = null;
  let r = roll();
  for (const [event, chance] of SKY_CHANCE) {
    if ((r -= chance) >= 0) continue;
    sky = event === 'eclipse'
      ? { event, week: 2 + Math.floor(roll() * 3), day: 1 + Math.floor(roll() * DAYS_PER_WEEK) }
      : { event, week: 2 + Math.floor(roll() * 2), day: null };
    break;
  }
  return { weather, sky };
}

type When = Pick<RunState, 'calendar' | 'week' | 'day'>;

export function weatherOn(s: Pick<RunState, 'calendar'>, week: number, day: number): Weather {
  return s.calendar.weather[week - 1]?.[day - 1] ?? 'clear';
}

export function todaysWeather(s: Pick<RunState, 'calendar' | 'week' | 'day'>): Weather {
  return weatherOn(s, s.week, s.day);
}

export function festivalOn(s: Pick<RunState, 'season'>, week: number, day: number): Festival | null {
  return week === FESTIVAL_WEEK && day === FESTIVAL_DAY ? SEASON_FESTIVAL[s.season] : null;
}

/** Sky events and calendar events active today, by the ids content uses for `event`. */
export function activeEvents(s: Partial<When>): string[] {
  if (!s.calendar || s.week === undefined || s.day === undefined) return [];
  const sky = s.calendar.sky;
  if (!sky || sky.week !== s.week) return [];
  if (sky.day !== null && sky.day !== s.day) return [];
  return [sky.event];
}

/** What each weather does, in one line for the HUD and the Calendar. */
export const WEATHER_RULE: Record<Weather, string> = {
  clear: 'Clear skies. No effect.',
  rain: 'Rain: Creek ingredients +2 Potency; one fewer order on a busy day (3+).',
  fog: 'Fog: orders stay hidden until your first brew or Discard.',
  heatwave: 'Heatwave: Ember ingredients +2 Potency, Tide -2.',
  snow: 'Snow: Frost cards are drawn first.',
};
