// Witches' quirks and cauldrons (GDD §12): the two choices a run starts from. A cauldron's numbers
// are codex data (`cauldrons`); a witch's quirk needs code, so it lives here by witch id.

import { codex, type Cauldron } from '../codex';
import type { Order, Potion, RunState } from './state';

/** The witches' quirks, in numbers. */
export const WITCH_RULES = {
  /** The Bloom Witch: the day's first brew with a Flower in it. */
  bloomHarmony: 2,
  /** The Frost Witch: cards in hand on a Snow day. */
  frostHand: 1,
} as const;

/** The run's cauldron; runs saved before cauldrons brew in Copper. */
export function cauldronOf(s: Partial<Pick<RunState, 'cauldronKind'>>): Cauldron {
  return codex.cauldrons.get(s.cauldronKind ?? 'copper') ?? codex.cauldrons.get('copper')!;
}

/** Whether this witch's once-a-day quirk is still to use today. */
export const quirkReady = (s: Partial<Pick<RunState, 'witch' | 'quirkUsed'>>, witch: 'bloom-witch' | 'alchemist' | 'illusionist') => s.witch === witch && s.quirkUsed === false;

/** The Illusionist can still pass a potion off as another recipe of its family today. */
export const glamourReady = (s: Partial<Pick<RunState, 'witch' | 'quirkUsed'>>) => quirkReady(s, 'illusionist');

/** Whether filling this order takes the Illusionist's glamour: the order names a different recipe of the potion's family. */
export function needsGlamour(potion: Pick<Potion, 'recipe' | 'family'>, order: Pick<Order, 'request'>): boolean {
  const r = order.request;
  return r.kind === 'recipe' && r.recipe !== potion.recipe && codex.recipes.get(r.recipe)?.family === potion.family;
}
