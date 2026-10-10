import { NIGHT_SHIFT_DAY } from './calendar';
import { tierStep, type Tier } from './rules';
import type { RunState } from './state';

// The Year (GDD §13): each later Year adds a stacking modifier to every season, like Ascension.
// Year 1 has none. A loop starts the next Year at Spring with a boon (codex `boons`).

/** Years go up to 10, like Ascension: each adds one rule that changes how you play (GDD §13). */
export const MAX_YEAR = 10;

export const YEAR_RULES = {
  /** Rent times this from the Year given (the latest step applies): a little from Year 2, a lot from Year 4. */
  rent: [[4, 1.25], [2, 1.05]] as [number, number][],
  /** Year 2: a patron is known only from the day before their Night Shift. */
  twistNoticeDays: 1,
  /** Year 3: junk in every starting deck. */
  startJunk: 'cobweb',
  /** Year 4: fewer Night Market stalls (never below the ones always open). */
  fewerStalls: 1,
  /** Year 5: fewer Discards every day. */
  discards: 1,
  /** Year 6: week 2 day orders ask for at least this tier (week 1's are all Fine already). */
  weekTwoTier: 'superb',
  /** Year 8: Shelf slots lost. */
  shelf: 1,
  /** Year 9: fewer cards in every reward pick. */
  rewardCards: 1,
  /** Year 10: the Moonless Patron's orders ask this many tiers higher. */
  finaleTiers: 1,
  /** Reputation earned grows by this much for each Year after the first. */
  reputationStep: 0.5,
} as const;

/** What each Year adds, in order. A Year carries every rule up to it. */
export const YEAR_MODIFIERS: { year: number; text: string }[] = [
  { year: 2, text: 'Patrons stay hidden until the day before their Night Shift. Rent +5%.' },
  { year: 3, text: 'Every run starts with a Cobweb in the deck.' },
  { year: 4, text: 'One fewer Night Market stall opens, and rent rises to +25%.' },
  { year: 5, text: 'One fewer Discard every day.' },
  { year: 6, text: 'Week 2 orders ask for Superb or better.' },
  { year: 7, text: 'Every run starts with a random Curse.' },
  { year: 8, text: 'The Shelf holds one less potion.' },
  { year: 9, text: 'Reward picks offer one card fewer.' },
  { year: 10, text: 'The Moonless Patron asks one tier higher.' },
];

type InYear = Partial<Pick<RunState, 'year'>>;
const yearOf = (s: InYear) => s.year ?? 1;

/** Whether this run's Year carries that Year's rule. */
export const yearRule = (s: InYear, year: number) => yearOf(s) >= year;
export const yearModifiers = (year: number) => YEAR_MODIFIERS.filter((m) => m.year <= year);
export const yearDiscards = (s: InYear) => (yearRule(s, 5) ? YEAR_RULES.discards : 0);
/** Rent times this in the run's Year (GDD §13). */
export const yearRent = (s: InYear) => YEAR_RULES.rent.find(([y]) => yearRule(s, y))?.[1] ?? 1;
export const reputationMult = (year: number) => 1 + YEAR_RULES.reputationStep * (Math.max(1, year) - 1);

/** A Moonless Patron ladder tier, one higher from Year 10. */
export const finaleTier = (s: InYear, tier: Tier): Tier => (yearRule(s, 10) ? tierStep(tier, YEAR_RULES.finaleTiers) : tier);

/** Whether this week's patron is known yet: always in Year 1, and from the day before their Night Shift after. */
export function patronKnown(s: InYear & Partial<Pick<RunState, 'week' | 'day'>>, week: number): boolean {
  if (!yearRule(s, 2) || s.week === undefined || s.day === undefined) return true;
  return week < s.week || (week === s.week && s.day >= NIGHT_SHIFT_DAY - YEAR_RULES.twistNoticeDays);
}
