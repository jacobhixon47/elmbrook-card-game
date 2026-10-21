import { mutated, MUTATION_RULES } from './mutations';
import { codex } from '../codex';
import type { Ingredient, Recipe, Regular, Visitor } from '../codex/schema';
import { fillsPattern, recipeAvailable } from './brew';
import { todaysWeather } from './calendar';
import { pick, pickWeighted, rand, type Ctx } from './ctx';
import { blessingTonight } from './fair';
import { FAMILIAR_RULES } from './familiars';
import { FRIENDSHIP, friendLevelOf, friendTip } from './friendship';
import { fortuneOn } from './market';
import { patronOf, twistNow } from './night';
import { cauldronOf, glamourReady, needsGlamour } from './cauldrons';
import { hasRelic, RELIC_RULES } from './relics';
import { rollVisitor } from './visitors';
import {
  BONUS_TIP, CLOCKLESS_BREWS, RAIN_MIN_ORDERS, NIGHT_PAY, ORDER_PAY, ORDER_TIERS, orderCount,
  HERMIT_PAY, PALE_COURIER_PAY, runWeek, SEASON_RULES, TIER_PAY, tierIndex, tierOf, tierStep, TOWER_PAY, WEEK_PAY_STEP, type Tier,
} from './rules';
import { allCards, type CardInstance, type Order, type OrderBonus, type OrderRequest, type Potion, type RunState } from './state';
import { finaleTier, YEAR_RULES, yearRule } from './year';

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
    // Three's Company (a mutation): only recipes of three or more ingredients can be brewed.
    if (mutated(state, 'threes-company') && r.pattern.length < MUTATION_RULES.threesMin) continue;
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

type Reach = { reach: Map<string, number>; recipes: Recipe[]; known: readonly string[]; fullExperiments: boolean };

/**
 * The best tier the deck can reach for a recipe. One you don't know yet brews as an Experiment, a
 * tier lower (GDD §6), unless the Witch's Hatpin makes Experiments brew at full quality.
 */
function recipeCeiling(r: Reach, recipe: string): Tier {
  const tier = tierOf(r.reach.get(recipe)!);
  return r.known.includes(recipe) || r.fullExperiments ? tier : tierStep(tier, -1);
}

/**
 * Whether a recipe belongs to a family: its own, or Lunar too when its pattern uses the Lunar essence,
 * so Moonlit Veil is Illusion and Lunar (Jacob, after a playtest, Oct 16).
 */
export function inFamily(recipe: Pick<Recipe, 'family' | 'pattern'>, family: string): boolean {
  return recipe.family === family || (family === 'lunar' && recipe.pattern.includes('lunar'));
}

/** A recipe's families: its own, then Lunar when it also counts as Lunar. */
export function familiesOf(recipe: Pick<Recipe, 'family' | 'pattern'>): string[] {
  return recipe.family !== 'lunar' && inFamily(recipe, 'lunar') ? [recipe.family, 'lunar'] : [recipe.family];
}

/** The best tier the deck can reach for a request. */
function ceilingOf(r: Reach, request: OrderRequest): Tier {
  const ids = request.kind === 'recipe' ? [request.recipe] : r.recipes.filter((x) => inFamily(x, request.family)).map((x) => x.id);
  return ids.map((id) => recipeCeiling(r, id)).reduce((a, b) => (tierIndex(b) > tierIndex(a) ? b : a));
}

const likes = (prefers: readonly string[], x: Recipe) => prefers.some((p) => (p === 'rare' ? x.pattern.length === 3 || x.baseHarmony >= 3 : x.family === p));

/**
 * A request this guest likes, from what the deck can brew: half the time a named recipe, half a family.
 * With `want`, only recipes the deck can bring to that tier, counting the Experiment's lower tier for
 * ones you don't know yet (all liked recipes if none can).
 */
function requestFor(ctx: Ctx, r: Reach, prefers: readonly string[], want?: Tier): OrderRequest {
  const liked = r.recipes.filter((x) => likes(prefers, x));
  const pool = liked.length ? liked : r.recipes;
  const reaches = want ? pool.filter((x) => tierIndex(recipeCeiling(r, x.id)) >= tierIndex(want)) : pool;
  const recipe = pick(ctx, reaches.length ? reaches : pool);
  return rand(ctx) < 0.5 ? { kind: 'recipe', recipe: recipe.id } : { kind: 'family', family: recipe.family };
}

/**
 * Keep a request if the deck can bring it to the tier asked for; if not (often a recipe you don't
 * know yet, which brews a tier lower), ask again among the ones that can. Rolling only when needed
 * keeps every other order, and the tutorial seed, as it was.
 */
function fitRequest(ctx: Ctx, r: Reach, prefers: readonly string[], request: OrderRequest, want: Tier): OrderRequest {
  return tierIndex(ceilingOf(r, request)) >= tierIndex(want) ? request : requestFor(ctx, r, prefers, want);
}

/**
 * No recipe is asked for twice on one board (Jacob's playtest, GDD §4). A customer who names a recipe
 * already there asks for another they like that the deck can bring to the tier, then any the deck can,
 * and otherwise for that recipe's family. Families can repeat, and so can yesterday's requests. Rolls
 * only on a repeat, so other orders stay as they were.
 */
function freshRecipe(ctx: Ctx, r: Reach, prefers: readonly string[], request: OrderRequest, want: Tier, board: readonly Order[]): OrderRequest {
  if (request.kind !== 'recipe') return request;
  const named = new Set(board.flatMap((o) => (o.request.kind === 'recipe' ? [o.request.recipe] : [])));
  if (!named.has(request.recipe)) return request;
  const fresh = r.recipes.filter((x) => !named.has(x.id) && tierIndex(recipeCeiling(r, x.id)) >= tierIndex(want));
  const liked = fresh.filter((x) => likes(prefers, x));
  const pool = liked.length ? liked : fresh;
  return pool.length ? { kind: 'recipe', recipe: pick(ctx, pool).id } : { kind: 'family', family: codex.recipes.get(request.recipe)!.family };
}

/**
 * A regular's favourite order (GDD §13): from Friendship level 4, a 1 in 4 chance per order of theirs,
 * at most one on the board a day, and only when the deck can brew their family and holds an ingredient
 * of their tag. Rolls only for a regular who could ask, so other orders stay as they were.
 */
function favouriteFor(ctx: Ctx, r: Reach, customer: string): { request: OrderRequest; favourite: { tag: string } } | null {
  const s = ctx.s;
  const fav = codex.regulars.get(customer)?.favourite;
  if (!fav || friendLevelOf(s, customer) < FRIENDSHIP.favouriteLevel || s.orders.some((o) => o.favourite)) return null;
  if (!r.recipes.some((x) => inFamily(x, fav.family))) return null;
  if (![...allCards(s), ...s.satchel].some((c) => codex.ingredients.get(c.card)?.tags.includes(fav.tag))) return null;
  if (rand(ctx) >= FRIENDSHIP.favouriteChance) return null;
  return { request: { kind: 'family', family: fav.family }, favourite: { tag: fav.tag } };
}

/** Can the deck put an Umbra ingredient into a potion of this request? */
function umbraFits(s: RunState, request: OrderRequest, r: Reach): boolean {
  const hasUmbra = allCards(s).some((c) => codex.ingredients.get(c.card)?.essences.includes('umbra'));
  const recipes = r.recipes.filter((x) => (request.kind === 'recipe' ? x.id === request.recipe : inFamily(x, request.family)));
  return hasUmbra && recipes.some((x) => x.pattern.includes('umbra') || x.pattern.includes('any'));
}

type OrderOpts = {
  customer: string;
  request: OrderRequest;
  minTier: Tier;
  ceiling: Tier;
  payScale: number;
  bonus: OrderBonus | null;
  quantity?: number;
  tagBonus?: Order['tagBonus'];
  needsUmbra?: boolean;
  expiresIn?: number | null;
  favourite?: Order['favourite'];
  needsTag?: string | null;
};

function postOrder(ctx: Ctx, o: OrderOpts): void {
  const s = ctx.s;
  const minTier = tierIndex(o.minTier) > tierIndex(o.ceiling) ? o.ceiling : o.minTier;
  const order: Order = {
    id: s.nextUid++,
    customer: o.customer,
    request: o.request,
    minTier,
    pay: Math.round(ORDER_PAY[minTier] * o.payScale * (cauldronOf(ctx.s).pay ?? 1)),
    bonus: o.bonus,
    status: 'open',
    quantity: o.quantity ?? 1,
    delivered: 0,
    // The May Crown: deliveries with a Flower ingredient pay more.
    tagBonus: o.tagBonus ?? (hasRelic(s, 'may-crown') ? { tag: 'flower', mult: RELIC_RULES.mayCrownPay } : null),
    needsUmbra: o.needsUmbra ?? false,
    expiresIn: o.expiresIn ?? null,
    ...(o.favourite ? { favourite: o.favourite } : {}),
    ...(o.needsTag ? { needsTag: o.needsTag } : {}),
  };
  s.orders.push(order);
  ctx.ev.push({ type: 'orderPosted', order });
}

const weekScale = (s: RunState, night: boolean) => (1 + WEEK_PAY_STEP * (runWeek(s) - 1)) * (night ? NIGHT_PAY : 1) * SEASON_RULES[s.season].payMult;

/**
 * Post the day's orders. Customers ask for what they like (GDD §14 regulars) from what your deck can
 * brew, and never for a tier your deck can't reach, so a weak deck gets easier, poorer orders.
 */
export function postOrders(ctx: Ctx, nightShift: boolean): void {
  const s = ctx.s;
  const reach = reachableRecipes(s, nightShift);
  if (reach.size === 0) return;
  const r: Reach = { reach, recipes: [...reach.keys()].map((id) => codex.recipes.get(id)!), known: s.knownRecipes, fullExperiments: hasRelic(s, 'witchs-hatpin') };
  if (nightShift) return postNightOrders(ctx, r);

  const customers = weightedOrder(ctx, [...codex.regulars.values()].filter((x) => !x.nightOnly));
  let count = orderCount(runWeek(s), false, rand(ctx));
  // Rain keeps one customer home, but only on a busy day (sim: cutting quiet days too halves the win rate).
  if (todaysWeather(s) === 'rain' && count >= RAIN_MIN_ORDERS) count -= 1;
  // Fortune Tent twists on this week: The Hermit (fewer, richer orders) and The Tower (harder, richer).
  const hermit = fortuneOn(s, 'fewer-orders');
  const tower = fortuneOn(s, 'harder-orders');
  if (hermit) count = Math.max(1, count - 1);

  // A seasonal visitor takes the last customer's place (GDD §4.1): rolled on its own stream.
  const visitor = rollVisitor(s, (v) => canServe(s, r, v));
  if (visitor) count -= 1;

  for (let i = 0; i < count; i++) {
    const customer = customers[i % customers.length]!;
    const asked = requestFor(ctx, r, customer.prefers);
    let rolled = pickWeighted(ctx, ORDER_TIERS[Math.min(4, runWeek(s))]!);
    // Year 6: week 2 asks for Superb or better.
    if (yearRule(s, 6) && s.week === 2 && tierIndex(rolled) < tierIndex(YEAR_RULES.weekTwoTier)) rolled = YEAR_RULES.weekTwoTier;
    const minTier = tower ? tierStep(rolled, 1) : rolled;
    const fav = favouriteFor(ctx, r, customer.id);
    const request = fav?.request ?? freshRecipe(ctx, r, customer.prefers, fitRequest(ctx, r, customer.prefers, asked, minTier), minTier, s.orders);
    const ceiling = ceilingOf(r, request);
    postOrder(ctx, {
      customer: customer.id, request, minTier, ceiling, favourite: fav?.favourite ?? null,
      payScale: weekScale(s, false) * customer.payMult * (hermit ? HERMIT_PAY : 1) * (tower ? TOWER_PAY : 1),
      bonus: rand(ctx) < customer.bonusChance ? pick(ctx, customer.bonusPool) : null,
    });
  }
  if (visitor) visitorOrder(ctx, r, visitor);
}

/** Can the deck brew a family this visitor likes, with their tag when they want one? */
function canServe(s: RunState, r: Reach, v: Visitor): boolean {
  return v.prefers.some((f) => r.recipes.some((x) => inFamily(x, f)) && (!v.needsTag || tagFits(s, r, f, v.needsTag)));
}

/** Does the deck hold an ingredient with this tag that fits a recipe of the family? */
function tagFits(s: RunState, r: Reach, family: string, tag: string): boolean {
  const tagged = allCards(s).map((c) => codex.ingredients.get(c.card)).filter((i) => i?.tags.includes(tag));
  return r.recipes.some((x) => inFamily(x, family) && tagged.some((i) => x.pattern.some((e) => e === 'any' || i!.essences.includes(e as never))));
}

/** A visitor's order: a family they like (with their tag, if any), at the day's tier, their gold. */
function visitorOrder(ctx: Ctx, r: Reach, v: Visitor): void {
  const s = ctx.s;
  const families = v.prefers.filter((f) => r.recipes.some((x) => inFamily(x, f)) && (!v.needsTag || tagFits(s, r, f, v.needsTag)));
  if (!families.length) return;
  const request: OrderRequest = { kind: 'family', family: pick(ctx, families) };
  const minTier = pickWeighted(ctx, ORDER_TIERS[Math.min(4, runWeek(s))]!);
  postOrder(ctx, {
    customer: v.id, request, minTier, ceiling: ceilingOf(r, request), payScale: weekScale(s, false) * v.goldMult, bonus: null,
    quantity: v.quantity, needsTag: v.needsTag ?? null,
  });
}

/** Post a visitor's order now, whatever the day (the dev overlay and fixtures). */
export function postVisitorOrder(ctx: Ctx, id: string): void {
  const s = ctx.s;
  const reach = reachableRecipes(s, false);
  const r: Reach = { reach, recipes: [...reach.keys()].map((x) => codex.recipes.get(x)!), known: s.knownRecipes, fullExperiments: hasRelic(s, 'witchs-hatpin') };
  visitorOrder(ctx, r, codex.visitors.get(id)!);
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
  // Rain keeps a night customer home on a busy night; the patron always comes.
  if (todaysWeather(s) === 'rain' && count >= RAIN_MIN_ORDERS && !patron.ladder) count -= 1;
  const scale = weekScale(s, true) * patron.payMult;
  const every = { quantity: twist === 'orders-double' ? 2 : 1, expiresIn: twist === 'orders-expire-2' ? CLOCKLESS_BREWS : null };
  const rolled = () => pickWeighted(ctx, ORDER_TIERS[Math.min(4, runWeek(s))]!);

  // The patron's order(s).
  const ladder = patron.ladder ?? [];
  ladder.forEach((tier, i) => {
    const asked = requestFor(ctx, r, ['lunar', 'rare']);
    // Year 10: the Moonless Patron asks higher (still no higher than the deck can reach).
    const minTier = finaleTier(s, tier);
    const request = freshRecipe(ctx, r, ['lunar', 'rare'], fitRequest(ctx, r, ['lunar', 'rare'], asked, minTier), minTier, s.orders);
    const ceiling = ceilingOf(r, request);
    // The Longest Night's blessings: Candle in the Window eases the first order a tier, Starlight the last.
    const asks = tierIndex(minTier) > tierIndex(ceiling) ? ceiling : minTier;
    const eased = (i === 0 && blessingTonight(s, 'candle-in-the-window')) || (i === ladder.length - 1 && blessingTonight(s, 'starlight'));
    postOrder(ctx, { customer: patron.id, request, minTier: eased ? tierStep(asks, -1) : asks, ceiling, payScale: scale, bonus: null, ...every });
  });
  if (!ladder.length) {
    const fixed = patron.fixedOrder;
    let request: OrderRequest;
    let minTier: Tier;
    if (fixed && r.recipes.some((x) => inFamily(x, fixed.family))) {
      request = { kind: 'family', family: fixed.family };
      minTier = fixed.minTier;
    } else if (fixed) {
      // No way to brew it yet: the patron asks for the deck's best family at its best tier instead.
      const best = [...r.recipes].sort((a, b) => r.reach.get(b.id)! - r.reach.get(a.id)!)[0]!;
      request = { kind: 'family', family: best.family };
      minTier = tierOf(r.reach.get(best.id)!);
    } else {
      const asked = requestFor(ctx, r, ['rare']);
      minTier = tierStep(rolled(), 1);
      request = fitRequest(ctx, r, ['rare'], asked, minTier);
    }
    postOrder(ctx, { customer: patron.id, request, minTier, ceiling: ceilingOf(r, request), payScale: scale, bonus: null, ...every });
  }

  // Night customers fill the rest.
  const guests = weightedOrder(ctx, nightGuests(ctx.s.curses.length > 0));
  const extra = twist === 'pale-courier' ? PALE_COURIER_PAY : 1;
  for (let i = 0; i < count - Math.max(1, ladder.length); i++) {
    const guest = guests[i % guests.length]!;
    const asked = requestFor(ctx, r, guest.prefers);
    const minTier = rolled();
    const fav = favouriteFor(ctx, r, guest.id);
    const request = fav?.request ?? freshRecipe(ctx, r, guest.prefers, fitRequest(ctx, r, guest.prefers, asked, minTier), minTier, s.orders);
    postOrder(ctx, {
      customer: guest.id, request, minTier, ceiling: ceilingOf(r, request), favourite: fav?.favourite ?? null,
      payScale: scale * guest.payMult * extra,
      bonus: guest.bonusChance > 0 && rand(ctx) < guest.bonusChance ? pick(ctx, guest.bonusPool) : null,
      needsUmbra: guest.needsUmbra === true && umbraFits(s, request, r),
      ...every,
    });
  }
}

/** Whether a potion is what the order asks for; with `glamour` (the Illusionist), any recipe of the named recipe's family is. */
export function matchesRequest(potion: Pick<Potion, 'recipe' | 'family'>, request: OrderRequest, glamour = false): boolean {
  if (request.kind === 'family') {
    const recipe = codex.recipes.get(potion.recipe);
    return potion.family === request.family || (recipe !== undefined && inFamily(recipe, request.family));
  }
  return potion.recipe === request.recipe || (glamour && needsGlamour(potion, { request }));
}

type PotionLike = Pick<Potion, 'recipe' | 'family' | 'tier' | 'ingredients'>;

const hasUmbra = (p: Pick<Potion, 'ingredients'>) => p.ingredients.some((id) => codex.ingredients.get(id)?.essences.includes('umbra'));
const hasTag = (p: Pick<Potion, 'ingredients'>, tag: string) => p.ingredients.some((id) => codex.ingredients.get(id)?.tags.includes(tag));

export function satisfies(potion: PotionLike, order: Order, glamour = false): boolean {
  return order.status === 'open' && matchesRequest(potion, order.request, glamour) && tierIndex(potion.tier) >= tierIndex(order.minTier)
    && (!order.needsUmbra || hasUmbra(potion)) && (!order.favourite || hasTag(potion, order.favourite.tag))
    && (!order.needsTag || hasTag(potion, order.needsTag));
}

/** `satisfies`, plus tonight's twist: The May Queen won't take the same family twice running. */
export function fits(s: Partial<Pick<RunState, 'patrons' | 'week' | 'day' | 'lastFamily' | 'witch' | 'quirkUsed'>>, potion: PotionLike, order: Order): boolean {
  if (!satisfies(potion, order, glamourReady(s))) return false;
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

/**
 * Pay plus tip: the tip grows with how far the potion beats the minimum tier, plus the bonus, plus
 * +1 gold from a regular at Friendship 10 when `friends` is given, plus a favourite order's tip.
 */
export function payout(
  potion: Pick<Potion, 'tier' | 'ingredients'>, order: Order, familiars: readonly string[] = [], friends?: Pick<RunState, 'friendship' | 'friendshipBase'>,
): { pay: number; tip: number; bonus: boolean } {
  const bonus = order.bonus !== null && meetsBonus(potion, order.bonus);
  const tagged = order.tagBonus !== null && potion.ingredients.some((id) => codex.ingredients.get(id)?.tags.includes(order.tagBonus!.tag));
  const pay = tagged ? Math.round(order.pay * order.tagBonus!.mult) : order.pay;
  // The Fox doubles the tip for beating the minimum tier.
  const tierTip = Math.round(order.pay * (TIER_PAY[potion.tier] / TIER_PAY[order.minTier] - 1)) * (familiars.includes('fox') ? FAMILIAR_RULES.foxTipMult : 1);
  const tipMult = codex.regulars.get(order.customer)?.tipMult ?? 1;
  const friendly = friends ? friendTip(friends, order.customer) : 0;
  const favourite = order.favourite ? FRIENDSHIP.favouriteTip : 0;
  return { pay, tip: Math.round((Math.max(0, tierTip) + (bonus ? BONUS_TIP : 0)) * tipMult) + friendly + favourite, bonus };
}
