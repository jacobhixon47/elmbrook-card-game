import { codex } from '../codex';
import type { Ingredient, Recipe, Regular } from '../codex/schema';
import { fillsPattern, recipeAvailable } from './brew';
import { FESTIVAL_DAY, festivalOn, todaysWeather } from './calendar';
import { pick, pickWeighted, rand, type Ctx } from './ctx';
import { FAMILIAR_RULES } from './familiars';
import { fortuneOn } from './market';
import { patronOf, twistNow } from './night';
import {
  BONUS_TIP, CLOCKLESS_BREWS, RAIN_MIN_ORDERS, HARVEST_FAIR, LONGEST_NIGHT, BLOOMTIDE_PAY, NIGHT_PAY, ORDER_PAY, ORDER_TIERS, orderCount,
  HERMIT_PAY, PALE_COURIER_PAY, SEASON_RULES, TIER_PAY, tierIndex, tierOf, tierStep, TOWER_PAY, WEEK_PAY_STEP, type Tier,
} from './rules';
import { allCards, type CardInstance, type Order, type OrderBonus, type OrderRequest, type Potion, type RunState } from './state';
import { yearPayMult } from './year';

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

type Guest = {
  id: string;
  prefers: readonly string[];
  payMult: number;
  bonusChance: number;
  bonusPool: readonly OrderBonus[];
  needsUmbra?: boolean;
};

const regularGuest = (r: Regular): Guest => ({ id: r.id, prefers: r.prefers, payMult: r.payMult, bonusChance: r.bonusChance, bonusPool: r.bonusPool });

/**
 * Night customers, and the regulars who only come at night (The Gardener). Night customers set no bonus conditions.
 * The Sleepless Miller pays more when you carry no Curse for him to lift.
 */
function nightGuests(cursed: boolean): (Guest & { weight: number })[] {
  return [
    ...[...codex.nightCustomers.values()].map((n) => ({
      id: n.id, weight: n.weight, prefers: n.prefers, bonusChance: 0, bonusPool: [] as OrderBonus[], needsUmbra: n.requiresUmbra,
      payMult: n.paysIn.kind === 'lift-curse' && !cursed ? n.paysIn.noCurseMult : n.goldMult,
    })),
    ...[...codex.regulars.values()].filter((r) => r.nightOnly).map((r) => ({ ...regularGuest(r), weight: r.weight })),
  ];
}

type Reach = { reach: Map<string, number>; recipes: Recipe[] };

/** The best quality the deck can reach for a request. */
function ceilingOf(r: Reach, request: OrderRequest): number {
  if (request.kind === 'recipe') return r.reach.get(request.recipe)!;
  return Math.max(...r.recipes.filter((x) => x.family === request.family).map((x) => r.reach.get(x.id)!));
}

/** A request this guest likes, from what the deck can brew: half the time a named recipe, half a family. */
function requestFor(ctx: Ctx, r: Reach, prefers: readonly string[]): OrderRequest {
  const liked = r.recipes.filter((x) => prefers.some((p) => (p === 'rare' ? x.pattern.length === 3 || x.baseHarmony >= 3 : x.family === p)));
  const recipe = pick(ctx, liked.length ? liked : r.recipes);
  return rand(ctx) < 0.5 ? { kind: 'recipe', recipe: recipe.id } : { kind: 'family', family: recipe.family };
}

/** Can the deck put an Umbra ingredient into a potion of this request? */
function umbraFits(s: RunState, request: OrderRequest, r: Reach): boolean {
  const hasUmbra = allCards(s).some((c) => codex.ingredients.get(c.card)?.essences.includes('umbra'));
  const recipes = r.recipes.filter((x) => (request.kind === 'recipe' ? x.id === request.recipe : x.family === request.family));
  return hasUmbra && recipes.some((x) => x.pattern.includes('umbra') || x.pattern.includes('any'));
}

type OrderOpts = {
  customer: string;
  request: OrderRequest;
  minTier: Tier;
  ceiling: number;
  payScale: number;
  bonus: OrderBonus | null;
  quantity?: number;
  tagBonus?: Order['tagBonus'];
  needsUmbra?: boolean;
  expiresIn?: number | null;
};

function postOrder(ctx: Ctx, o: OrderOpts): void {
  const s = ctx.s;
  const cap = tierOf(o.ceiling);
  const minTier = tierIndex(o.minTier) > tierIndex(cap) ? cap : o.minTier;
  const order: Order = {
    id: s.nextUid++,
    customer: o.customer,
    request: o.request,
    minTier,
    pay: Math.round(ORDER_PAY[minTier] * o.payScale),
    bonus: o.bonus,
    status: 'open',
    quantity: o.quantity ?? 1,
    delivered: 0,
    tagBonus: o.tagBonus ?? null,
    needsUmbra: o.needsUmbra ?? false,
    expiresIn: o.expiresIn ?? null,
  };
  s.orders.push(order);
  ctx.ev.push({ type: 'orderPosted', order });
}

const weekScale = (s: RunState, night: boolean) => (1 + WEEK_PAY_STEP * (s.week - 1)) * (night ? NIGHT_PAY : 1) * SEASON_RULES[s.season].payMult * yearPayMult(s);

/**
 * Post the day's orders. Customers ask for what they like (GDD §14 regulars) from what your deck can
 * brew, and never for a tier your deck can't reach, so a weak deck gets easier, poorer orders.
 */
export function postOrders(ctx: Ctx, nightShift: boolean): void {
  const s = ctx.s;
  const reach = reachableRecipes(s, nightShift);
  if (reach.size === 0) return;
  const r: Reach = { reach, recipes: [...reach.keys()].map((id) => codex.recipes.get(id)!) };
  if (nightShift) return postNightOrders(ctx, r);

  const customers = weightedOrder(ctx, [...codex.regulars.values()].filter((x) => !x.nightOnly));
  const festival = festivalOn(s, s.week, s.day);
  let count = orderCount(s.week, false, rand(ctx));
  // Rain keeps one customer home, but only on a busy day (sim: cutting quiet days too halves the win rate).
  if (todaysWeather(s) === 'rain' && count >= RAIN_MIN_ORDERS) count -= 1;
  const harvest = festival === 'harvest-fair';
  if (harvest) count += HARVEST_FAIR.extraOrders;
  const bloomtide = festival === 'bloomtide';
  // Fortune Tent twists on this week: The Hermit (fewer, richer orders) and The Tower (harder, richer).
  const hermit = fortuneOn(s, 'fewer-orders');
  const tower = fortuneOn(s, 'harder-orders');
  if (hermit) count = Math.max(1, count - 1);

  for (let i = 0; i < count; i++) {
    const customer = customers[i % customers.length]!;
    const request = requestFor(ctx, r, customer.prefers);
    const ceiling = ceilingOf(r, request);
    const rolled = pickWeighted(ctx, ORDER_TIERS[Math.min(4, s.week)]!);
    const minTier = tower ? tierStep(rolled, 1) : rolled;
    postOrder(ctx, {
      customer: customer.id, request, minTier, ceiling,
      payScale: weekScale(s, false) * customer.payMult * (harvest ? HARVEST_FAIR.payMult : 1) * (hermit ? HERMIT_PAY : 1) * (tower ? TOWER_PAY : 1),
      bonus: rand(ctx) < customer.bonusChance ? pick(ctx, customer.bonusPool) : null,
      quantity: harvest ? HARVEST_FAIR.quantity : 1,
      tagBonus: bloomtide ? { tag: 'flower', mult: BLOOMTIDE_PAY } : null,
    });
  }
}

/**
 * A Night Shift's orders (GDD §10): the patron's first, one tier harder, then night customers. The
 * patron's twist can change every order (two potions each, a clock, double pay).
 */
function postNightOrders(ctx: Ctx, r: Reach): void {
  const s = ctx.s;
  const patron = patronOf(s)!;
  const twist = patron.twist;
  let count = patron.orderCount;
  if (festivalOn(s, s.week, FESTIVAL_DAY) === 'longest-night') count += LONGEST_NIGHT.extraOrders;
  // Rain keeps a night customer home on a busy night; the patron always comes.
  if (todaysWeather(s) === 'rain' && count >= RAIN_MIN_ORDERS && !patron.ladder) count -= 1;
  const scale = weekScale(s, true) * patron.payMult;
  const every = { quantity: twist === 'orders-double' ? 2 : 1, expiresIn: twist === 'orders-expire-2' ? CLOCKLESS_BREWS : null };
  const rolled = () => pickWeighted(ctx, ORDER_TIERS[Math.min(4, s.week)]!);

  // The patron's order(s).
  const ladder = patron.ladder ?? [];
  for (const tier of ladder) {
    const request = requestFor(ctx, r, ['lunar', 'rare']);
    postOrder(ctx, { customer: patron.id, request, minTier: tier, ceiling: ceilingOf(r, request), payScale: scale, bonus: null, ...every });
  }
  if (!ladder.length) {
    const fixed = patron.fixedOrder;
    let request: OrderRequest;
    let minTier: Tier;
    if (fixed && r.recipes.some((x) => x.family === fixed.family)) {
      request = { kind: 'family', family: fixed.family };
      minTier = fixed.minTier;
    } else if (fixed) {
      // No way to brew it yet: the patron asks for the deck's best family at its best tier instead.
      const best = [...r.recipes].sort((a, b) => r.reach.get(b.id)! - r.reach.get(a.id)!)[0]!;
      request = { kind: 'family', family: best.family };
      minTier = tierOf(r.reach.get(best.id)!);
    } else {
      request = requestFor(ctx, r, ['rare']);
      minTier = tierStep(rolled(), 1);
    }
    postOrder(ctx, { customer: patron.id, request, minTier, ceiling: ceilingOf(r, request), payScale: scale, bonus: null, ...every });
  }

  // Night customers fill the rest.
  const guests = weightedOrder(ctx, nightGuests(ctx.s.curses.length > 0));
  const extra = twist === 'pale-courier' ? PALE_COURIER_PAY : 1;
  for (let i = 0; i < count - Math.max(1, ladder.length); i++) {
    const guest = guests[i % guests.length]!;
    const request = requestFor(ctx, r, guest.prefers);
    postOrder(ctx, {
      customer: guest.id, request, minTier: rolled(), ceiling: ceilingOf(r, request),
      payScale: scale * guest.payMult * extra,
      bonus: guest.bonusChance > 0 && rand(ctx) < guest.bonusChance ? pick(ctx, guest.bonusPool) : null,
      needsUmbra: guest.needsUmbra === true && umbraFits(s, request, r),
      ...every,
    });
  }
}

export function matchesRequest(potion: Pick<Potion, 'recipe' | 'family'>, request: OrderRequest): boolean {
  return request.kind === 'recipe' ? potion.recipe === request.recipe : potion.family === request.family;
}

type PotionLike = Pick<Potion, 'recipe' | 'family' | 'tier' | 'ingredients'>;

const hasUmbra = (p: Pick<Potion, 'ingredients'>) => p.ingredients.some((id) => codex.ingredients.get(id)?.essences.includes('umbra'));

export function satisfies(potion: PotionLike, order: Order): boolean {
  return order.status === 'open' && matchesRequest(potion, order.request) && tierIndex(potion.tier) >= tierIndex(order.minTier)
    && (!order.needsUmbra || hasUmbra(potion));
}

/** `satisfies`, plus tonight's twist: The May Queen won't take the same family twice running. */
export function fits(s: Partial<Pick<RunState, 'patrons' | 'week' | 'day' | 'lastFamily'>>, potion: PotionLike, order: Order): boolean {
  if (!satisfies(potion, order)) return false;
  return !(twistNow(s) === 'family-chain' && s.lastFamily === potion.family);
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
export function payout(potion: Pick<Potion, 'tier' | 'ingredients'>, order: Order, familiars: readonly string[] = []): { pay: number; tip: number; bonus: boolean } {
  const bonus = order.bonus !== null && meetsBonus(potion, order.bonus);
  const tagged = order.tagBonus !== null && potion.ingredients.some((id) => codex.ingredients.get(id)?.tags.includes(order.tagBonus!.tag));
  const pay = tagged ? Math.round(order.pay * order.tagBonus!.mult) : order.pay;
  // The Fox doubles the tip for beating the minimum tier.
  const tierTip = Math.round(order.pay * (TIER_PAY[potion.tier] / TIER_PAY[order.minTier] - 1)) * (familiars.includes('fox') ? FAMILIAR_RULES.foxTipMult : 1);
  const tipMult = codex.regulars.get(order.customer)?.tipMult ?? 1;
  return { pay, tip: Math.round((Math.max(0, tierTip) + (bonus ? BONUS_TIP : 0)) * tipMult), bonus };
}
