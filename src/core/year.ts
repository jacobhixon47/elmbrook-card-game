import { NIGHT_SHIFT_DAY } from './calendar';
import type { RunState } from './state';

// The Year (GDD §13): each later Year adds a stacking modifier to every season, like Ascension.
// Year 1 has none. A loop starts the next Year at Spring with a boon (codex `boons`).

/** The highest Year so far; Years 6 to 10 get their modifiers in the season-ramp pass. */
export const MAX_YEAR = 5;

export const YEAR_RULES = {
  /** Year 2: a patron is known only from the day before their Night Shift. */
  twistNoticeDays: 1,
  /** Year 3: rent ×1.2. */
  rentMult: 1.2,
  /** Year 4: orders pay ×0.9. */
  payMult: 0.9,
  /** Year 5: one fewer Discard every day. */
  discards: 1,
  /** Reputation earned grows by this much for each Year after the first. */
  reputationStep: 0.5,
} as const;

/** What each Year adds, in order. A Year carries every modifier up to it. */
export const YEAR_MODIFIERS: { year: number; text: string }[] = [
  { year: 2, text: 'Patrons stay hidden until the day before their Night Shift.' },
  { year: 3, text: 'Rent +20%.' },
  { year: 4, text: 'Orders pay 10% less.' },
  { year: 5, text: 'One fewer Discard every day.' },
];

type InYear = Partial<Pick<RunState, 'year'>>;
const yearOf = (s: InYear) => s.year ?? 1;

export const yearModifiers = (year: number) => YEAR_MODIFIERS.filter((m) => m.year <= year);
export const yearRentMult = (s: InYear) => (yearOf(s) >= 3 ? YEAR_RULES.rentMult : 1);
export const yearPayMult = (s: InYear) => (yearOf(s) >= 4 ? YEAR_RULES.payMult : 1);
export const yearDiscards = (s: InYear) => (yearOf(s) >= 5 ? YEAR_RULES.discards : 0);
export const reputationMult = (year: number) => 1 + YEAR_RULES.reputationStep * (Math.max(1, year) - 1);

/** Whether this week's patron is known yet: always in Year 1, and from the day before their Night Shift after. */
export function patronKnown(s: InYear & Partial<Pick<RunState, 'week' | 'day'>>, week: number): boolean {
  if (yearOf(s) < 2 || s.week === undefined || s.day === undefined) return true;
  return week < s.week || (week === s.week && s.day >= NIGHT_SHIFT_DAY - YEAR_RULES.twistNoticeDays);
}
