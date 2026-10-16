import { codex } from '../codex';
import { fits, glamourReady, isPatron, matchesRequest, payout, tierIndex, twistNow, type BrewPreview, type Order, type Potion, type RunState } from '../core';
import { fencePrice } from '../core/reduce';
import { cap, customerName, familyName, recipeName, TIER_NAME } from './describe';

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

type OrderState = Pick<RunState, 'orders'> & Partial<Pick<RunState, 'fog' | 'patrons' | 'week' | 'day' | 'lastFamily' | 'witch' | 'quirkUsed'>>;

/**
 * When a brew fits no order, the order it most looks meant for and why it won't take it: the pinned
 * order, else one whose request it matches but whose terms it misses, else tonight's patron. A
 * playtest brewed a Lunar-essence potion of another family for the Pale Courier and lost it to a
 * full Shelf without a word of why (Oct 16), so the cauldron says why. `known` is false for an
 * Experiment, whose family stays a secret.
 */
export function missedOrder(state: OrderState, potion: PotionLike, pinned: number | null = null, known = true): { order: Order; why: string } | null {
  if (state.fog) return null;
  const open = state.orders.filter((o) => o.status === 'open');
  if (open.some((o) => fits(state, potion, o))) return null;
  const glamour = glamourReady(state);
  const order = open.find((o) => o.id === pinned)
    ?? open.find((o) => matchesRequest(potion, o.request, glamour))
    ?? open.find((o) => isPatron(o.customer));
  if (!order) return null;
  return { order, why: missWhy(state, potion, order, glamour, known) };
}

function missWhy(state: OrderState, potion: PotionLike, order: Order, glamour: boolean, known: boolean): string {
  const r = order.request;
  if (!matchesRequest(potion, r, glamour)) {
    const want = r.kind === 'recipe' ? recipeName(r.recipe) : familyName(r.family);
    if (!known) return `they want ${want}`;
    return `they want ${want}, this is ${r.kind === 'recipe' ? recipeName(potion.recipe) : familyName(potion.family)}`;
  }
  if (tierIndex(potion.tier) < tierIndex(order.minTier)) return `they want ${TIER_NAME[order.minTier]}, this is ${TIER_NAME[potion.tier]}`;
  if (order.needsUmbra) return 'it needs an Umbra ingredient';
  if (order.favourite) return `it needs a ${cap(order.favourite.tag)} ingredient`;
  if (twistNow(state) === 'family-chain') return `the last delivery was ${familyName(potion.family)} too`;
  return 'it doesn\'t fit their order';
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
  if (potion.heartDelta > 0) lines.push(`+${potion.heartDelta} Friendship on delivery.`);
  else if (potion.heartDelta < 0) lines.push('Earns no Friendship on delivery.');
  const order = state.phase === 'brewing' ? bestOrderFor(state, potion, pinned) : null;
  if (order) {
    const { pay, tip } = payout(potion, order);
    lines.push(`Fills ${customerName(order.customer)}'s order: +${pay + tip}g.`);
  } else if (state.phase === 'brewing') {
    lines.push('No open order wants it yet.');
  }
  lines.push(`The Fence pays ${fencePrice(potion, state)}g after the Night Shift.`);
  lines.push('Click to deliver. Right-click to pour it away.');
  return lines;
}
