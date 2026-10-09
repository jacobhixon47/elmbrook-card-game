import { codex } from '../codex';
import type { StallId, TarotEffect } from '../codex/schema';
import { essencesOf, recipeAvailable } from './brew';
import { NIGHT_SHIFT_DAY } from './calendar';
import { addHearts, changeGold, gainCard, pick, pickWeighted, reject, removeCard, shuffled, type Ctx } from './ctx';
import { addFamiliar, familiarPrice, rollFamiliars } from './familiars';
import { draft, lunarPool, omenPool, rarityPool } from './night';
import { addModifier, modifiable } from './modifiers';
import { cursePool, gainRelic, rollRelic, takeCurse } from './relics';
import {
  BLACK_MARKET, BLACK_MARKET_RELIC, BROKER_CARDS, BROKER_FAMILIARS, TINKER_FAMILIAR, FORTUNE_PRICE, LANTERN_STOCK, MAX_CAULDRON_SLOTS, MAX_SHELF_SLOTS, MIN_DECK,
  NAME_TAKER_DEALS, QUARTER_DRAWN_STALLS, TAILOR_POTENCY, TINKER_PRICE, WEEKS, WORLD_RELIC_TIER,
} from './rules';
import { YEAR_RULES, yearRule } from './year';
import { allCards, type CardInstance, type NameTakerDeal, type RunState, type StallState, type StockItem } from './state';

// The Night Market (GDD §9): a street of stalls after each Night Shift, before rent. You can visit
// every stall that's open; which ones open depends on the moon.

/** Week 2's Night Shift is the full moon and week 4's the new moon (GDD §3). */
export function moonOf(week: number): 'quarter' | 'full-moon' | 'new-moon' {
  return week === 2 ? 'full-moon' : week === WEEKS ? 'new-moon' : 'quarter';
}

/** Tonight's stalls: the Lantern Seller and the Fence always, one drawn stall at a quarter moon, every one plus a visitor at the full and new moon. */
export function rollStalls(ctx: Ctx): StallId[] {
  const moon = moonOf(ctx.s.week);
  const all = [...codex.stalls.values()];
  const always = all.filter((x) => x.opens === 'always').map((x) => x.id);
  const drawn = all.filter((x) => x.opens === 'drawn').map((x) => x.id);
  // Year 4: one fewer drawn stall opens.
  const fewer = yearRule(ctx.s, 4) ? YEAR_RULES.fewerStalls : 0;
  const count = Math.max(0, (moon === 'quarter' ? QUARTER_DRAWN_STALLS : drawn.length) - fewer);
  // Only a night that drops some stalls rolls for which (a Year 1 full or new moon opens them all).
  const keep = new Set(count < drawn.length ? shuffled(ctx, drawn).slice(0, count) : drawn);
  const tonight = [...always, ...drawn.filter((id) => keep.has(id))];
  return moon === 'quarter' ? tonight : [...tonight, ...all.filter((x) => x.opens === moon).map((x) => x.id)];
}

/** `opened` are tonight's stalls so far, so no relic is offered twice in one night. */
function openStall(ctx: Ctx, id: StallId, opened: readonly StallState[]): StallState {
  const s = ctx.s;
  switch (id) {
    case 'lantern-seller':
      return {
        id,
        stock: [
          ...draft(ctx, lunarPool(s), LANTERN_STOCK.lunar).map((card): StockItem => ({ kind: 'card', card, price: LANTERN_STOCK.lunarPrice, sold: false })),
          ...draft(ctx, omenPool(s), LANTERN_STOCK.omens).map((card): StockItem => ({ kind: 'card', card, price: LANTERN_STOCK.omenPrice, sold: false })),
        ],
      };
    case 'wandering-tinker': {
      const stock: StockItem[] = rollFamiliars(ctx, 1, 'rare').map((familiar) => ({ kind: 'familiar', familiar, price: Math.round(familiarPrice(familiar) * TINKER_FAMILIAR), sold: false }));
      if (s.cauldronSlots < MAX_CAULDRON_SLOTS) stock.push({ kind: 'cauldron-slot', price: TINKER_PRICE.cauldronSlot, sold: false });
      if (s.shelfSize < MAX_SHELF_SLOTS) stock.push({ kind: 'shelf-slot', price: TINKER_PRICE.shelfSlot, sold: false });
      return { id, stock };
    }
    case 'black-market': {
      const stock: StockItem[] = draft(ctx, rarityPool(s, 'rare'), BLACK_MARKET.cards).map((card) => ({ kind: 'card', card, price: BLACK_MARKET.price, sold: false }));
      const relic = rollRelic(ctx, BLACK_MARKET_RELIC.tier, relicsOnOffer(opened));
      if (relic) stock.push({ kind: 'relic', relic, price: BLACK_MARKET_RELIC.price, sold: false });
      return { id, stock };
    }
    case 'name-taker':
      return { id, deals: rollDeals(ctx, relicsOnOffer(opened)), done: false };
    case 'fence':
      return { id };
    case 'moth-broker':
      return { id, forgot: null, cards: [], familiars: [], done: false };
    case 'hollow-tailor':
      return { id, done: false };
    case 'fortune-tent':
      return { id, drawn: [] };
  }
}

export function openNightMarket(ctx: Ctx): void {
  const stalls: StallState[] = [];
  for (const id of rollStalls(ctx)) stalls.push(openStall(ctx, id, stalls));
  ctx.s.phase = 'night-market';
  ctx.s.offer = { kind: 'night-market', stalls, at: null };
  ctx.ev.push({ type: 'nightMarketOpened', stalls: stalls.map((x) => x.id) });
}

type MarketOffer = Extract<NonNullable<RunState['offer']>, { kind: 'night-market' }>;

export function marketOf(ctx: Ctx): MarketOffer {
  const o = ctx.s.offer;
  if (o?.kind !== 'night-market') reject('the Night Market is closed');
  return o;
}

/** The stall you're standing at, which must be this one. */
export function atStall<K extends StallId>(ctx: Ctx, id: K): StallState & { id: K } {
  const m = marketOf(ctx);
  const stall = m.at === null ? undefined : m.stalls[m.at];
  if (stall?.id !== id) reject(`you're not at ${codex.stalls.get(id)!.name}`);
  return stall as StallState & { id: K };
}

/** The stock of the stall you're at, for `buy`. Null when you're not at a stall that sells. */
export function stallStock(s: RunState): StockItem[] | null {
  const o = s.offer;
  if (o?.kind !== 'night-market' || o.at === null) return null;
  const stall = o.stalls[o.at]!;
  return 'stock' in stall ? stall.stock : null;
}

// ------------------------------------------------------------------ the Moth Broker

/** Recipes the Moth Broker will take: any you know but the witch started with. */
export function forgettable(s: Pick<RunState, 'knownRecipes' | 'witch'>): string[] {
  const start = codex.witches.get(s.witch)!.knownRecipes;
  return s.knownRecipes.filter((r) => !start.includes(r));
}

export function forgetRecipe(ctx: Ctx, recipe: string): void {
  const stall = atStall(ctx, 'moth-broker');
  if (stall.done || stall.forgot) reject('the Moth Broker takes one memory a night');
  if (!forgettable(ctx.s).includes(recipe)) reject(`the Moth Broker won't take ${recipe}`);
  ctx.s.knownRecipes = ctx.s.knownRecipes.filter((r) => r !== recipe);
  stall.forgot = recipe;
  stall.cards = draft(ctx, rarityPool(ctx.s, 'rare'), BROKER_CARDS);
  stall.familiars = rollFamiliars(ctx, BROKER_FAMILIARS);
  ctx.ev.push({ type: 'recipeForgotten', recipe, cards: stall.cards });
}

/** Take one of the Moth Broker's offers: `index` runs over the Rare cards, then the familiars. */
export function brokerPick(ctx: Ctx, index: number): void {
  const stall = atStall(ctx, 'moth-broker');
  const offers = [...stall.cards, ...stall.familiars];
  const pick = offers[index];
  if (stall.done || !pick) reject(`no card ${index} from the Moth Broker`);
  if (index < stall.cards.length) gainCard(ctx, pick, 'market');
  else addFamiliar(ctx, pick);
  stall.done = true;
  stall.cards = [];
  stall.familiars = [];
}

// ------------------------------------------------------------------ the Hollow Tailor

/** Cards the Tailor can work with: day ingredients in the deck. Satchel cards stay out of it, so Lunar never reaches the day. */
export function tailorCards(s: RunState): CardInstance[] {
  return allCards(s).filter((c) => {
    const ing = codex.ingredients.get(c.card);
    return ing !== undefined && !ing.nightOnly && !ing.essences.includes('lunar');
  });
}

export function weave(ctx: Ctx, fromUid: number, intoUid: number): void {
  const stall = atStall(ctx, 'hollow-tailor');
  if (stall.done) reject('the Hollow Tailor sews one card a night');
  if (fromUid === intoUid) reject('pick two different cards');
  const cards = tailorCards(ctx.s);
  const from = cards.find((c) => c.uid === fromUid);
  const into = cards.find((c) => c.uid === intoUid);
  if (!from || !into) reject('the Hollow Tailor only works with ingredients in your deck');
  if (allCards(ctx.s).length <= MIN_DECK) reject(`the deck can't go below ${MIN_DECK} cards`);
  const essence = essencesOf(from)[0]!;
  if (essencesOf(into).includes(essence)) reject(`${codex.ingredients.get(into.card)!.name} is already ${essence}`);
  for (const pile of [ctx.s.drawPile, ctx.s.hand, ctx.s.discardPile, ctx.s.cauldron]) {
    const i = pile.findIndex((c) => c.uid === fromUid);
    if (i >= 0) pile.splice(i, 1);
  }
  into.woven = essence;
  into.bonus = (into.bonus ?? 0) + TAILOR_POTENCY;
  stall.done = true;
  ctx.ev.push({ type: 'cardWoven', from: from.card, fromUid, into: into.card, intoUid, essence });
}

// ------------------------------------------------------------------ the Fortune Tent

export const fortunePrice = (draws: number) => FORTUNE_PRICE.base + FORTUNE_PRICE.step * draws;

/** Is a Fortune Tent twist on this week? */
export function fortuneOn(s: Pick<RunState, 'fortunes' | 'week'>, effect: TarotEffect): boolean {
  return s.fortunes.some((f) => f.week === s.week && codex.tarot.get(f.card)?.effect === effect);
}

export function drawTarot(ctx: Ctx): void {
  const s = ctx.s;
  const stall = atStall(ctx, 'fortune-tent');
  const price = fortunePrice(stall.drawn.length);
  if (s.gold < price) reject('not enough gold');
  changeGold(ctx, -price, 'fortune');
  const deck = [...codex.tarot.values()].filter((t) => !t.nextWeek || s.week < WEEKS);
  const card = pickWeighted(ctx, deck.map((t) => [t, t.weight] as const));
  stall.drawn.push(card.id);
  ctx.ev.push({ type: 'tarotDrawn', card: card.id, price });
  const amount = card.amount ?? 0;
  switch (card.effect) {
    case 'gold':
      changeGold(ctx, amount, 'fortune');
      return;
    case 'relic': {
      // The World: a tier 2 relic, or its gold if you hold every one.
      const relic = rollRelic(ctx, WORLD_RELIC_TIER, relicsOnOffer(marketOf(ctx).stalls));
      if (relic) gainRelic(ctx, relic, 'fortune');
      else changeGold(ctx, amount, 'fortune');
      return;
    }
    case 'bless': {
      // Wheel of Fortune: Blessed on a random ingredient that can take it, or its gold.
      const cards = modifiable(s, 'blessed');
      if (cards.length) addModifier(ctx, pick(ctx, cards), 'blessed', 'fortune');
      else changeGold(ctx, amount, 'fortune');
      return;
    }
    case 'familiar': {
      // A familiar if a slot is free, or its gold.
      const [f] = s.familiars.length < s.familiarSlots ? rollFamiliars(ctx, 1) : [];
      if (f) addFamiliar(ctx, f);
      else changeGold(ctx, amount, 'fortune');
      return;
    }
    case 'lunar-card': {
      const pool = lunarPool(s);
      if (pool.length) gainCard(ctx, pick(ctx, pool), 'fortune');
      return;
    }
    case 'learn-recipe': {
      const unknown = [...codex.recipes.values()].filter((r) => !r.eclipseOnly && r.pool !== 'event' && !s.knownRecipes.includes(r.id) && recipeAvailable(r, s));
      if (!unknown.length) return;
      const r = pick(ctx, unknown);
      s.knownRecipes.push(r.id);
      ctx.ev.push({ type: 'recipeDiscovered', recipe: r.id });
      return;
    }
    case 'hearts': {
      addHearts(ctx, pick(ctx, [...codex.regulars.values()]).id, amount);
      return;
    }
    case 'bad-omen':
      gainCard(ctx, 'bad-omen', 'fortune');
      changeGold(ctx, amount, 'fortune');
      return;
    case 'lose-card': {
      const deck = [...s.drawPile, ...s.discardPile, ...s.hand];
      if (deck.length <= MIN_DECK) return;
      removeCard(ctx, pick(ctx, deck));
      return;
    }
    case 'fog-week':
      // The Moon fogs next week's days now, so the Calendar shows it.
      for (let d = 0; d < NIGHT_SHIFT_DAY - 1; d++) s.calendar.weather[s.week]![d] = 'fog';
      s.fortunes.push({ week: s.week + 1, card: card.id });
      return;
    case 'fewer-orders':
    case 'harder-orders':
      s.fortunes.push({ week: s.week + 1, card: card.id });
      return;
  }
}

// ------------------------------------------------------------------ the Name-Taker

/** Relics tonight's stalls still offer (the Black Market's, the Name-Taker's deals). */
function relicsOnOffer(stalls: readonly StallState[]): string[] {
  return stalls.flatMap((st) => {
    if (st.id === 'name-taker') return st.done ? [] : st.deals.map((d) => d.relic);
    if ('stock' in st) return st.stock.flatMap((i) => (i.kind === 'relic' && !i.sold ? [i.relic] : []));
    return [];
  });
}

/**
 * Curses you don't carry, each with the relic it buys (the relic's tier is the Curse's severity) or,
 * instead, a Rare ingredient with the Cursed modifier.
 */
function rollDeals(ctx: Ctx, onOffer: readonly string[]): NameTakerDeal[] {
  const deals: NameTakerDeal[] = [];
  for (const curse of shuffled(ctx, cursePool(ctx.s))) {
    if (deals.length >= NAME_TAKER_DEALS) break;
    const tier = codex.curses.get(curse)!.severity;
    const relic = rollRelic(ctx, tier, [...onOffer, ...deals.map((d) => d.relic)]);
    if (relic) deals.push({ curse, relic, card: null });
  }
  const cards = draft(ctx, rarityPool(ctx.s, 'rare'), deals.length);
  deals.forEach((d, i) => (d.card = cards[i] ?? null));
  return deals;
}

/** Take a Curse for its relic or its Cursed card. One deal a night. */
export function takeDeal(ctx: Ctx, index: number, take: 'relic' | 'card'): void {
  const stall = atStall(ctx, 'name-taker');
  if (stall.done) reject('the Name-Taker makes one deal a night');
  const deal = stall.deals[index];
  if (!deal) reject(`no deal ${index}`);
  if (take === 'card' && !deal.card) reject('this deal has no card');
  takeCurse(ctx, deal.curse);
  if (take === 'card') addModifier(ctx, gainCard(ctx, deal.card!, 'market'), 'cursed', 'name-taker');
  else gainRelic(ctx, deal.relic, 'name-taker');
  stall.done = true;
}

// ------------------------------------------------------------------ the Black Market

/** Trade two deck cards for one of the Black Market's Rare cards, instead of gold. */
export function swapForCard(ctx: Ctx, index: number, uids: readonly number[]): void {
  const stall = atStall(ctx, 'black-market');
  const item = stall.stock[index];
  if (!item || item.kind !== 'card') reject(`no stock ${index}`);
  if (item.sold) reject('already sold');
  const deck = [...ctx.s.drawPile, ...ctx.s.hand, ...ctx.s.discardPile];
  const unique = [...new Set(uids)];
  if (unique.length !== BLACK_MARKET.swap || !unique.every((u) => deck.some((c) => c.uid === u))) reject(`the Black Market wants ${BLACK_MARKET.swap} cards from your deck`);
  if (deck.length - BLACK_MARKET.swap + 1 < MIN_DECK) reject(`the deck can't go below ${MIN_DECK} cards`);
  for (const uid of unique) {
    for (const pile of [ctx.s.drawPile, ctx.s.hand, ctx.s.discardPile]) {
      const i = pile.findIndex((c) => c.uid === uid);
      if (i < 0) continue;
      const [gone] = pile.splice(i, 1);
      ctx.ev.push({ type: 'cardRemoved', uid, card: gone!.card });
    }
  }
  item.sold = true;
  gainCard(ctx, item.card, 'market');
}
