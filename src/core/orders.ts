import { codex } from '../codex';
import type { Ingredient, Recipe } from '../codex/schema';
import { fillsPattern, recipeAvailable } from './brew';
import { pick, pickWeighted, rand, type Ctx } from './ctx';
import {
  BONUS_TIP, NIGHT_PAY, ORDER_PAY, ORDER_TIERS, orderCount, SEASON_RULES, TIER_PAY, tierIndex, tierOf, tierStep, WEEK_PAY_STEP,
} from './rules';
import { allCards, type CardInstance, type Order, type OrderBonus, type OrderRequest, type Potion, type RunState } from './state';


/** Distinct ingredients in these cards with how many copies of each. */
function ingredientCounts(cards: readonly CardInstance[], night: boolean): [Ingredient, number][] {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const ing = codex.ingredients.get(c.card);
    if (!ing || (ing.nightOnly && !night)) continue;
    counts.set(ing.id, (counts.get(ing.id) ?? 0) + 1);
  }
  return [...counts].map(([id, n]) => [codex.ingredients.get(id)!, n]);
}

/** Highest Potency the deck could put into a recipe with a perfect draw; 0 if it can't make it. */
export function bestPotency(recipe: Recipe, counts: readonly [Ingredient, number][]): number {
  const n = recipe.pattern.length;
  let best = 0;
  const chosen: Ingredient[] = [];
  const walk = (start: number) => {
    if (chosen.length === n) {
      if (fillsPattern(chosen, recipe.pattern)) best = Math.max(best, chosen.reduce((p, i) => p + i.potency, 0));
      return;
    }
    for (let k = start; k < counts.length; k++) {
      const [ing, have] = counts[k]!;
      if (chosen.filter((c) => c.id === ing.id).length >= have) continue;
      chosen.push(ing);
      walk(k);
      chosen.pop();
    }
  };
  walk(0);
  return best;
}

/**
 * Best quality per recipe the deck and cauldron can make with a perfect draw, counting the best
 * Tincture boosts it owns. Recipes it can't make are left out.
 */
export function reachableRecipes(state: RunState, night: boolean): Map<string, number> {
  const cards = allCards(state);
  const counts = ingredientCounts(cards, night);
  const owns = (id: string) => cards.some((c) => c.card === id);
  const potencyMult = owns('steep') ? 1.5 : 1;
  const harmonyBonus = owns('stir') ? 1 : 0;
  const out = new Map<string, number>();
  for (const r of codex.recipes.values()) {
    if (r.pattern.length > state.cauldronSlots || !recipeAvailable(r, state)) continue;
    const p = bestPotency(r, counts);
    if (p > 0) out.set(r.id, Math.floor(p * potencyMult) * (r.baseHarmony + harmonyBonus));
  }
  return out;
}

/** Every customer once, in an order drawn by their weights: frequent regulars tend to come first. */
function weightedOrder<T extends { weight: number }>(ctx: Ctx, items: readonly T[]): T[] {
  const left = [...items];
  const out: T[] = [];
  while (left.length) {
    const i = pickWeighted(ctx, left.map((x, k) => [k, x.weight] as const));
    out.push(...left.splice(i, 1));
  }
  return out;
}

/**
 * Post the day's orders. Customers ask for what they like (GDD §14 regulars) from what your deck can
 * brew, and never for a tier your deck can't reach, so a weak deck gets easier, poorer orders.
 */
export function postOrders(ctx: Ctx, nightShift: boolean): void {
  const s = ctx.s;
  const reach = reachableRecipes(s, nightShift);
  if (reach.size === 0) return;
  const reachable = [...reach.keys()].map((id) => codex.recipes.get(id)!);
  const customers = weightedOrder(ctx, [...codex.regulars.values()].filter((r) => nightShift || !r.nightOnly));
  const count = orderCount(s.week, nightShift, rand(ctx));

  for (let i = 0; i < count; i++) {
    const customer = customers[i % customers.length]!;
    const liked = reachable.filter((r) =>
      customer.prefers.some((p) => (p === 'rare' ? r.pattern.length === 3 || r.baseHarmony >= 3 : r.family === p)),
    );
    const recipe = pick(ctx, liked.length ? liked : reachable);
    const request: OrderRequest = rand(ctx) < 0.5 ? { kind: 'recipe', recipe: recipe.id } : { kind: 'family', family: recipe.family };
    const ceiling =
      request.kind === 'recipe'
        ? reach.get(recipe.id)!
        : Math.max(...reachable.filter((r) => r.family === recipe.family).map((r) => reach.get(r.id)!));

    let minTier = pickWeighted(ctx, ORDER_TIERS[Math.min(4, s.week)]!);
    // The Night Shift's first order is the patron's: one tier harder.
    if (nightShift && i === 0) minTier = tierStep(minTier, 1);
    const cap = tierOf(ceiling);
    if (tierIndex(minTier) > tierIndex(cap)) minTier = cap;

    const scale = (1 + WEEK_PAY_STEP * (s.week - 1)) * (nightShift ? NIGHT_PAY : 1) * SEASON_RULES[s.season].payMult * customer.payMult;
    const order: Order = {
      id: s.nextUid++,
      customer: customer.id,
      request,
      minTier,
      pay: Math.round(ORDER_PAY[minTier] * scale),
      bonus: rand(ctx) < customer.bonusChance ? pick(ctx, customer.bonusPool) : null,
      status: 'open',
    };
    s.orders.push(order);
    ctx.ev.push({ type: 'orderPosted', order });
  }
}

export function matchesRequest(potion: Pick<Potion, 'recipe' | 'family'>, request: OrderRequest): boolean {
  return request.kind === 'recipe' ? potion.recipe === request.recipe : potion.family === request.family;
}

export function satisfies(potion: Pick<Potion, 'recipe' | 'family' | 'tier'>, order: Order): boolean {
  return order.status === 'open' && matchesRequest(potion, order.request) && tierIndex(potion.tier) >= tierIndex(order.minTier);
}

export function meetsBonus(potion: Pick<Potion, 'ingredients'>, bonus: OrderBonus): boolean {
  const ings = potion.ingredients.map((id) => codex.ingredients.get(id)!);
  switch (bonus) {
    case 'no-umbra':
      return ings.every((i) => !i.essences.includes('umbra'));
    case 'three-ingredients':
      return ings.length === 3;
    case 'wychwood-ingredient':
      return ings.some((i) => i.origin === 'wychwood');
  }
}

/** Pay plus tip: the tip grows with how far the potion beats the minimum tier, plus the bonus. */
export function payout(potion: Pick<Potion, 'tier' | 'ingredients'>, order: Order): { pay: number; tip: number; bonus: boolean } {
  const bonus = order.bonus !== null && meetsBonus(potion, order.bonus);
  const tierTip = Math.round(order.pay * (TIER_PAY[potion.tier] / TIER_PAY[order.minTier] - 1));
  const tipMult = codex.regulars.get(order.customer)?.tipMult ?? 1;
  return { pay: order.pay, tip: Math.round((Math.max(0, tierTip) + (bonus ? BONUS_TIP : 0)) * tipMult), bonus };
}
