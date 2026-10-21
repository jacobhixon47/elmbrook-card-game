import { codex } from '../codex';
import type { RunState } from './state';

// Mutations (GDD §13, approved by Jacob, Oct 21): optional challenge twists chosen for a whole Year
// at the cottage. Each changes how you play and makes the Year a little harder (about 10 points of win
// rate, by sim); a mutated run earns a little more Reputation, and beating that Year's Winter with one on ticks it off for good.

export type MutationId = 'no-vital' | 'lone-witch' | 'steady-hands' | 'threes-company' | 'open-market' | 'lean-times';

export const MUTATIONS: readonly { id: MutationId; name: string; text: string }[] = [
  { id: 'no-vital', name: 'No Vital', text: 'No Vital ingredients: half of your starting ones are Sludge, the rest are gone, and none are offered.' },
  { id: 'lone-witch', name: 'Lone Witch', text: 'No familiars. You start every run with a tier 2 relic.' },
  { id: 'steady-hands', name: 'Steady Hands', text: 'No Discards, but you draw two more cards.' },
  { id: 'threes-company', name: "Three's Company", text: 'Every brew needs three or more ingredients, with one fewer Brew a day. You start with a third cauldron slot.' },
  { id: 'open-market', name: 'Open Market', text: 'The full moon every week: every stall is out, but Night Market prices are 50% higher and rent 10% higher.' },
  { id: 'lean-times', name: 'Lean Times', text: 'You start with no gold. Rent is 5% lower.' },
];

export const MUTATION_RULES = {
  /** What a mutated run's Reputation is multiplied by. */
  reputation: 1.25,
  steadyHand: 2,
  openPrice: 1.5,
  leanRent: 0.95,
  loneRelicTier: 2,
  threesMin: 3,
  /** Three's Company: Brews a day, against the usual. */
  threesBrews: -1,
  /** Open Market: rent, against the usual. */
  openRent: 1.1,
} as const;

export const isMutation = (id: string): id is MutationId => MUTATIONS.some((m) => m.id === id);
export const mutationName = (id: string) => MUTATIONS.find((m) => m.id === id)?.name ?? id;

/** Whether this run has a mutation on. */
export const mutated = (s: Partial<Pick<RunState, 'mutation'>>, id: MutationId) => s.mutation === id;

/** No Vital: whether a card is barred from the run. */
export function barredCard(s: Partial<Pick<RunState, 'mutation'>>, id: string): boolean {
  return mutated(s, 'no-vital') && (codex.ingredients.get(id)?.essences.includes('vital') ?? false);
}
