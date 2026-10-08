import { payout, satisfies, type BrewPreview, type Order, type Potion, type RunState } from '../core';

type PotionLike = Pick<Potion, 'recipe' | 'family' | 'tier' | 'ingredients'>;

/** The open order a potion would earn the most from, preferring the one the player pinned. */
export function bestOrderFor(state: Pick<RunState, 'orders'>, potion: PotionLike, pinned: number | null = null): Order | null {
  const fits = state.orders.filter((o) => satisfies(potion, o));
  const pin = fits.find((o) => o.id === pinned);
  if (pin) return pin;
  let best: Order | null = null;
  let bestValue = -1;
  for (const o of fits) {
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
