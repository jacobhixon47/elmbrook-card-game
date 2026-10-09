import { codex } from '../codex';
import { fits, payout, type BrewPreview, type Order, type Potion, type RunState } from '../core';
import { fencePrice } from '../core/reduce';
import { customerName, familyName, TIER_NAME } from './describe';

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

/** A Shelf potion's tooltip: what it is, who wants it and what the Fence pays. */
export function potionLines(state: RunState, potion: Potion, pinned: number | null = null): string[] {
  const made = potion.ingredients.map((id) => codex.ingredients.get(id)?.name ?? id).join(', ');
  const lines = [`${familyName(potion.family)} · ${TIER_NAME[potion.tier]} (quality ${potion.quality})`, `Made with ${made}.`];
  if (potion.heartDelta) lines.push(`${potion.heartDelta > 0 ? '+' : ''}${potion.heartDelta} heart on delivery.`);
  const order = state.phase === 'brewing' ? bestOrderFor(state, potion, pinned) : null;
  if (order) {
    const { pay, tip } = payout(potion, order);
    lines.push(`Fills ${customerName(order.customer)}'s order: +${pay + tip}g.`);
  } else if (state.phase === 'brewing') {
    lines.push('No open order wants it yet.');
  }
  lines.push(`The Fence pays ${fencePrice(potion)}g after the Night Shift.`);
  lines.push('Click to deliver. Right-click to pour it away.');
  return lines;
}
