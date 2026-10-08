import { fits, payout, type BrewPreview, type Order, type Potion, type RunState } from '../core';

type PotionLike = Pick<Potion, 'recipe' | 'family' | 'tier' | 'ingredients'>;

/** The open order a potion would earn the most from, preferring the one the player pinned. */
export function bestOrderFor(
  state: Pick<RunState, 'orders'> & Partial<Pick<RunState, 'fog' | 'patrons' | 'week' | 'day' | 'lastFamily'>>, potion: PotionLike, pinned: number | null = null,
): Order | null {
  // Fog hides the orders, so a brew can't be sent to one (GDD §4.2).
  if (state.fog) return null;
  const fitting = state.orders.filter((o) => fits(state, potion, o));
  const pin = fitting.find((o) => o.id === pinned);
  if (pin) return pin;
  let best: Order | null = null;
  let bestValue = -1;
  for (const o of fitting) {
    const { pay, tip } = payout(potion, o);
    if (pay + tip > bestValue) [best, bestValue] = [o, pay + tip];
  }
  return best;
}

/** The potion the cauldron preview would make, in the shape orders are checked against. */
export function previewPotion(preview: BrewPreview, cards: readonly { card: string }[]): PotionLike | null {
  if (preview.kind !== 'potion') return null;
  return { recipe: preview.recipe, family: preview.family, tier: preview.tier, ingredients: cards.map((c) => c.card) };
}
