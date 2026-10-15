import { codex } from '../codex';
import {
  patronOf, patronKnown, festivalOn, MOON_NAME, NIGHT_SHIFT_DAY, snowedIn, todaysWeather, WEATHER_RULE, weatherOn,
  WEEK_MOONS, WEEKS, type Festival, type RunState, type SkyEvent, type Weather,
} from '../core';

// What the HUD and the Grimoire's Calendar tab say about the month (GDD §3, §4.2). Pure, so tests can check it.

export const WEATHER_NAME: Record<Weather, string> = { clear: 'Clear', rain: 'Rain', fog: 'Fog', heatwave: 'Heatwave', snow: 'Snow' };

/** A few words for the HUD; the full rule is in the tooltip. */
const WEATHER_SHORT: Record<Weather, string> = {
  clear: 'Clear skies',
  rain: 'Rain: Creek, Tide +2',
  fog: 'Fog: orders hidden',
  heatwave: 'Heatwave: Ember +2',
  snow: 'Snow: Frost cards first',
};

export const FESTIVAL_NAME: Record<Festival, string> = {
  bloomtide: 'Bloomtide', 'firefly-fair': 'Firefly Fair', 'harvest-fair': 'Harvest Fair', 'longest-night': 'Longest Night',
};

/** What each festival brings. Seasons whose fair isn't built yet show nothing on their festival day. */
export const FESTIVAL_RULE: Record<Festival, string> = {
  bloomtide: 'After closing, the Bloomtide Fair fills the square: festival-only flowers, a beekeeper and a garland weaver.',
  'firefly-fair': 'After closing, the Firefly Fair fills the square: an orchard keeper, a glassblower and a hatter.',
  'harvest-fair': 'After closing, the Harvest Fair fills the square: a farmer, a cider maker and a straw weaver.',
  'longest-night': 'After closing, the town keeps vigil in the square: gifts from the regulars you\'re close to, and a blessing from the Solstice Fire for the Moonless Patron\'s night.',
};

export const SKY_NAME: Record<SkyEvent, string> = { eclipse: 'Eclipse', 'meteor-shower': 'Meteor Shower' };
export const SKY_RULE: Record<SkyEvent, string> = {
  eclipse: 'Day and night mix: your Night Satchel joins today\'s deck, and Eclipse recipes can be brewed.',
  'meteor-shower': 'Fallen Stars can turn up in rewards, the Market and the Forage all week.',
};

type When = Pick<RunState, 'calendar' | 'season' | 'week' | 'day'> & Partial<Pick<RunState, 'patrons' | 'fortunes' | 'year' | 'seed' | 'blessing'>>;

const buried = (s: When, week: number) => s.seed !== undefined && snowedIn({ ...s, seed: s.seed }, week);
const SNOWED_IN_RULE = 'Snowed In: drifts bury the Night Market, and only the Hearth Trader opens.';

/** From Year 2 a patron stays a stranger until the day before their Night Shift (GDD §13). */
const HIDDEN_PATRON = { name: 'A patron', text: 'Who, and what they want, you learn the day before.' };

/** The patron of a week's Night Shift (GDD §10), as far as you know yet. */
function patronFor(s: When, week: number) {
  const patron = s.patrons ? patronOf({ patrons: s.patrons, week }) : null;
  return patron && !patronKnown(s, week) ? HIDDEN_PATRON : patron;
}

/** The sky event on this day, if any (a Meteor Shower covers its whole week). */
function skyOn(s: Pick<RunState, 'calendar'>, week: number, day: number): SkyEvent | null {
  const e = s.calendar.sky;
  if (!e || e.week !== week || (e.day !== null && e.day !== day)) return null;
  return e.event;
}

/** The festival held on this day (GDD §4.2): a fair, or Winter's vigil on the eve of the finale. */
function festivalToday(s: When, week: number, day: number): Festival | null {
  return festivalOn(s, week, day);
}

/** One short line for the HUD: the weather, plus a festival or sky event when there is one. */
export function todayLine(s: When): string {
  const parts = [WEATHER_SHORT[todaysWeather(s)]];
  const patron = s.day === NIGHT_SHIFT_DAY ? patronFor(s, s.week) : null;
  if (patron) parts.unshift(patron.name);
  const f = festivalToday(s, s.week, s.day);
  if (f) parts.push(FESTIVAL_NAME[f]);
  const e = skyOn(s, s.week, s.day);
  if (e) parts.push(SKY_NAME[e]);
  return parts.join(' · ');
}

/** The full rules for today, for the HUD tooltip. */
export function todayRules(s: When): string[] {
  return dayRules(s, { week: s.week, day: s.day, weather: todaysWeather(s) });
}

/** The full rules for any day of the month. */
export function dayRules(s: When, c: Pick<CalendarCell, 'week' | 'day' | 'weather'>): string[] {
  const out = [WEATHER_RULE[c.weather]];
  if (c.weather === 'fog' && c.day === NIGHT_SHIFT_DAY) out[0] = 'Fog: it never hides a Night Shift\'s orders.';
  const patron = c.day === NIGHT_SHIFT_DAY ? patronFor(s, c.week) : null;
  if (patron) out.unshift(`${patron.name}: ${patron.text}`);
  const f = festivalToday(s, c.week, c.day);
  if (f) out.push(`${FESTIVAL_NAME[f]}: ${FESTIVAL_RULE[f]}`);
  const e = skyOn(s, c.week, c.day);
  if (e) out.push(`${SKY_NAME[e]}: ${SKY_RULE[e]}`);
  if (c.day === NIGHT_SHIFT_DAY && buried(s, c.week)) out.push(SNOWED_IN_RULE);
  // The vigil's blessing acts on the finale's Night Shift.
  const blessing = s.blessing ? codex.blessings.get(s.blessing) : undefined;
  if (blessing && c.day === NIGHT_SHIFT_DAY && c.week === WEEKS) out.push(`${blessing.name}: ${blessing.text}`);
  // Fortune Tent twists on this week's days (The Moon's fog already shows as the weather).
  if (c.day < NIGHT_SHIFT_DAY) {
    for (const f of s.fortunes ?? []) {
      const t = codex.tarot.get(f.card);
      if (f.week === c.week && t && t.effect !== 'fog-week') out.push(`${t.name}: ${t.text.replace(/^Next week: /, '')}`);
    }
  }
  return out;
}

export type CalendarCell = { week: number; day: number; label: string; weather: Weather; marks: string[]; mark: 'done' | 'now' | 'next' };
export type CalendarWeek = { week: number; moon: string; cells: CalendarCell[] };

/** The whole month: each day's weather, festival and sky event, and where you are now. */
export function calendarWeeks(s: When): CalendarWeek[] {
  return Array.from({ length: WEEKS }, (_, w) => {
    const week = w + 1;
    const cells = Array.from({ length: NIGHT_SHIFT_DAY }, (_, d): CalendarCell => {
      const day = d + 1;
      const marks: string[] = [];
      const patron = day === NIGHT_SHIFT_DAY ? patronFor(s, week) : null;
      if (patron) marks.push(patron.name.replace(/^The /, ''));
      const f = festivalToday(s, week, day);
      if (f) marks.push(FESTIVAL_NAME[f]);
      const e = skyOn(s, week, day);
      if (e) marks.push(SKY_NAME[e]);
      if (day === NIGHT_SHIFT_DAY && buried(s, week)) marks.push('Snowed In');
      const at = week * 10 + day;
      const now = s.week * 10 + s.day;
      return {
        week, day, label: day === NIGHT_SHIFT_DAY ? 'Night' : `Day ${day}`, weather: weatherOn(s, week, day), marks,
        mark: at < now ? 'done' : at === now ? 'now' : 'next',
      };
    });
    return { week, moon: MOON_NAME[WEEK_MOONS[w]!], cells };
  });
}
