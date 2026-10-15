import { codex } from '../codex';
import type { StallId, TarotEffect } from '../codex/schema';
import { essencesOf, recipeAvailable } from './brew';
import { NIGHT_SHIFT_DAY, WEATHER_WEIGHTS, weatherOn } from './calendar';
import { changeGold, gainCard, pick, pickWeighted, randInt, reject, removeCard, shuffled, type Ctx } from './ctx';
import { dayPool, rarityOf } from './dusk';
import { addFamiliar, familiarPrice, rollFamiliars } from './familiars';
import { bestFriend, befriend, FRIENDSHIP, friendLevelOf } from './friendship';
import { nextFloat, seedRng } from './rng';
import { draft, lunarPool, omenPool, rarityPool } from './night';
import { addModifier, modifiable } from './modifiers';
import { cursePool, gainRelic, rollRelic, takeCurse } from './relics';
import {
  BLACK_MARKET, BLACK_MARKET_RELIC, HOLLY_CROWN, SNOWED_IN_CHANCE, YULE_LOG, BLOSSOM_ORACLE_PRICE, BROKER_CARDS, CIDER_PRESS, FIREFLY_GAMES, HARVEST_AUCTION, NECTAR_TRADER, SEED_SWAPPER,
  tierIndex, type ShopRarity, BROKER_FAMILIARS, TINKER_FAMILIAR, FORTUNE_PRICE, LANTERN_STOCK, WINTER_LANTERN, MAX_CAULDRON_SLOTS, MAX_SHELF_SLOTS, MIN_DECK,
  NAME_TAKER_DEALS, QUARTER_DRAWN_STALLS, TAILOR_POTENCY, TINKER_PRICE, WEEKS, WORLD_RELIC_TIER,
} from './rules';
import { YEAR_RULES, yearRule } from './year';
import { allCards, type CardInstance, type NameTakerDeal, type Potion, type RunState, type StallState, type StockItem } from './state';

// The Night Market (GDD §9): a street of stalls after each Night Shift, before rent. You can visit
// every stall that's open; which ones open depends on the moon.

/** Week 2's Night Shift is the full moon and week 4's the new moon (GDD §3). */
export function moonOf(week: number): 'quarter' | 'full-moon' | 'new-moon' {
  return week === 2 ? 'full-moon' : week === WEEKS ? 'new-moon' : 'quarter';
}

/**
 * Snowed In: in Winter, a quarter-moon Night Shift with snow buries the market half the time, and only
 * the Hearth Trader opens. Rolled from the seed so the Calendar can show it in advance.
 */
export function snowedIn(s: Pick<RunState, 'season' | 'seed' | 'calendar'>, week: number): boolean {
  if (s.season !== 'winter' || moonOf(week) !== 'quarter' || weatherOn(s, week, NIGHT_SHIFT_DAY) !== 'snow') return false;
  return nextFloat(seedRng(`${s.seed}:snowed-in:${week}`))[0] < SNOWED_IN_CHANCE;
}

/**
 * Tonight's stalls: the Lantern Seller and the Fence always, one drawn stall at a quarter moon, every
 * one plus a visitor at the full and new moon. In Winter the Hearth Trader opens every night, and on a
 * Snowed In night he is the only one.
 */
export function rollStalls(ctx: Ctx): StallId[] {
  const moon = moonOf(ctx.s.week);
  if (snowedIn(ctx.s, ctx.s.week)) return ['hearth-trader'];
  const all = [...codex.stalls.values()];
  const inSeason = (x: (typeof all)[number]) => x.opens === 'season' && x.season === ctx.s.season;
  const always = all.filter((x) => x.opens === 'always' || (inSeason(x) && x.everyNight)).map((x) => x.id);
  // This season's stalls are drawn with the rest (a next-week trade stays away in the last week).
  const seasonal = (x: (typeof all)[number]) => inSeason(x) && !x.everyNight && !(x.nextWeek && ctx.s.week >= WEEKS);
  const drawn = all.filter((x) => x.opens === 'drawn' || seasonal(x)).map((x) => x.id);
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
    case 'lantern-seller': {
      // In Winter she's low on Lunar stock, and keeps a Yule Candle by the Omens.
      const winter = s.season === 'winter';
      return {
        id,
        stock: [
          ...draft(ctx, lunarPool(s), winter ? WINTER_LANTERN.lunar : LANTERN_STOCK.lunar).map((card): StockItem => ({ kind: 'card', card, price: LANTERN_STOCK.lunarPrice, sold: false })),
          ...draft(ctx, omenPool(s), LANTERN_STOCK.omens).map((card): StockItem => ({ kind: 'card', card, price: LANTERN_STOCK.omenPrice, sold: false })),
          ...(winter ? [{ kind: 'card' as const, card: WINTER_LANTERN.omen, price: LANTERN_STOCK.omenPrice, sold: false }] : []),
        ],
      };
    }
    case 'wandering-tinker': {
      const stock: StockItem[] = rollFamiliars(ctx, 1, 'rare').map((familiar) => ({ kind: 'familiar', familiar, price: Math.round(familiarPrice(familiar) * TINKER_FAMILIAR), sold: false }));
      // In Winter he also carries a Frost familiar you don't have, at full price.
      const frost = s.season === 'winter' ? HOLLY_CROWN.familiars.find((f) => !s.familiars.includes(f)) : undefined;
      if (frost) stock.push({ kind: 'familiar', familiar: frost, price: familiarPrice(frost), sold: false });
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
    case 'seed-swapper':
      return { id, cards: draft(ctx, dayCards(s, 'uncommon'), SEED_SWAPPER.cards), done: false };
    case 'nectar-trader':
      return { id, cards: draft(ctx, dayCards(s, 'rare'), NECTAR_TRADER.cards), done: false };
    case 'hearth-trader':
      return {
        id, cards: draft(ctx, dayCards(s, 'rare'), FRIENDSHIP.traderBigCards), familiars: rollFamiliars(ctx, FRIENDSHIP.traderFamiliars), done: false,
        burned: false, crown: HOLLY_CROWN.familiars.filter((f) => !s.familiars.includes(f)), crowned: false,
      };
    case 'blossom-oracle':
      return { id, done: false };
    case 'firefly-games':
      return { id, tosses: 0, prizes: [], last: null };
    case 'cider-press':
      return { id, pressed: 0 };
    case 'harvest-auction': {
      const [lo, hi] = HARVEST_AUCTION.rival;
      return { id, relic: rollRelic(ctx, HARVEST_AUCTION.tier, relicsOnOffer(opened)), rival: lo + randInt(ctx, hi - lo + 1), bid: null };
    }
  }
}

/** Day cards of a rarity that rewards could offer: ingredients and Tinctures. */
const dayCards = (s: RunState, rarity: ShopRarity) => dayPool(s).filter((c) => c.rarity === rarity).map((c) => c.id);

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
      befriend(ctx, pick(ctx, [...codex.regulars.values()]).id, amount);
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
    if (st.id === 'harvest-auction') return st.relic && st.bid === null ? [st.relic] : [];
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

// ------------------------------------------------------------------ seasonal stalls (GDD §9)

/** Deck cards (not in the cauldron) the Seed Swapper takes: Common ingredients and Tinctures. */
export function commonCards(s: RunState): CardInstance[] {
  return [...s.drawPile, ...s.hand, ...s.discardPile].filter((c) => !codex.junk.has(c.card) && (codex.ingredients.has(c.card) || codex.tinctures.has(c.card)) && rarityOf(c.card) === 'common');
}

/** Take cards out of the deck for good, keeping it at `MIN_DECK` or more after `gain` cards come in. */
function giveCards(ctx: Ctx, from: readonly CardInstance[], uids: readonly number[], n: number, gain: number): void {
  const unique = [...new Set(uids)];
  if (unique.length !== n || !unique.every((u) => from.some((c) => c.uid === u))) reject(`pick ${n} cards`);
  const deck = [...ctx.s.drawPile, ...ctx.s.hand, ...ctx.s.discardPile];
  if (deck.length - n + gain < MIN_DECK) reject(`the deck can't go below ${MIN_DECK} cards`);
  for (const uid of unique) removeCard(ctx, deck.find((c) => c.uid === uid)!);
}

/** The Seed Swapper: two Common cards from the deck and 5 gold for one of the Uncommon cards on offer. One swap a night. */
export function seedSwap(ctx: Ctx, index: number, uids: readonly number[]): void {
  const stall = atStall(ctx, 'seed-swapper');
  const card = stall.cards[index];
  if (stall.done || !card) reject(`no card ${index} from the Seed Swapper`);
  if (ctx.s.gold < SEED_SWAPPER.price) reject('not enough gold');
  giveCards(ctx, commonCards(ctx.s), uids, SEED_SWAPPER.give, 1);
  changeGold(ctx, -SEED_SWAPPER.price, 'seed-swapper');
  gainCard(ctx, card, 'market');
  stall.done = true;
}

/** The Blossom Oracle: next week's four days get their weather rolled again. Once a night, never in week 4. */
export function readPetals(ctx: Ctx): void {
  const s = ctx.s;
  const stall = atStall(ctx, 'blossom-oracle');
  if (stall.done) reject('the Oracle reads the petals once a night');
  if (s.week >= WEEKS) reject('there is no next week to read');
  if (s.gold < BLOSSOM_ORACLE_PRICE) reject('not enough gold');
  changeGold(ctx, -BLOSSOM_ORACLE_PRICE, 'oracle');
  const week = s.calendar.weather[s.week]!;
  for (let d = 0; d < NIGHT_SHIFT_DAY - 1; d++) week[d] = pickWeighted(ctx, WEATHER_WEIGHTS[s.season]);
  stall.done = true;
  ctx.ev.push({ type: 'weatherRead', week: s.week + 1, weather: week.slice(0, NIGHT_SHIFT_DAY - 1) });
}

/** Firefly Games: a ring toss. One in three wins a pick of familiars (an Uncommon card with no free slot); a miss wins a Common card. */
export function tossRing(ctx: Ctx): void {
  const s = ctx.s;
  const stall = atStall(ctx, 'firefly-games');
  if (stall.prizes.length) reject('pick your prize first');
  if (s.gold < FIREFLY_GAMES.price) reject('not enough gold');
  changeGold(ctx, -FIREFLY_GAMES.price, 'firefly');
  stall.tosses++;
  const won = randInt(ctx, FIREFLY_GAMES.odds) === 0;
  const prizes = won && s.familiars.length < s.familiarSlots ? rollFamiliars(ctx, FIREFLY_GAMES.prizes) : [];
  let card: string | null = null;
  if (!prizes.length) {
    const pool = dayCards(s, won ? 'uncommon' : 'common');
    if (pool.length) card = gainCard(ctx, pick(ctx, pool), 'market').card;
  }
  stall.prizes = prizes;
  stall.last = { won, card };
  ctx.ev.push({ type: 'ringTossed', won, card });
}

export function takePrize(ctx: Ctx, index: number): void {
  const stall = atStall(ctx, 'firefly-games');
  const prize = stall.prizes[index];
  if (!prize) reject(`no prize ${index}`);
  addFamiliar(ctx, prize);
  stall.prizes = [];
}

/** The potion a stall takes: the lowest tier and quality on the Shelf, at `minTier` or better. */
export function cheapestPotion(s: Pick<RunState, 'shelf'>, minTier = 'crude' as Potion['tier']): Potion | undefined {
  return [...s.shelf]
    .filter((p) => tierIndex(p.tier) >= tierIndex(minTier))
    .sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier) || a.quality - b.quality)[0];
}

function takePotion(ctx: Ctx, potion: Potion): void {
  ctx.s.shelf = ctx.s.shelf.filter((p) => p.uid !== potion.uid);
  ctx.ev.push({ type: 'potionTraded', uid: potion.uid });
}

/** The Nectar Trader: your lowest Superb-or-better potion for one of the Rare cards. One trade a night. */
export function tradeNectar(ctx: Ctx, index: number): void {
  const stall = atStall(ctx, 'nectar-trader');
  const card = stall.cards[index];
  if (stall.done || !card) reject(`no card ${index} from the Nectar Trader`);
  const potion = cheapestPotion(ctx.s, NECTAR_TRADER.minTier);
  if (!potion) reject('the Nectar Trader wants a Superb or better potion');
  takePotion(ctx, potion);
  gainCard(ctx, card, 'market');
  stall.done = true;
}

/** Ingredients the Cider Press can sweeten. */
export function pressable(s: RunState): CardInstance[] {
  return allCards(s).filter((c) => codex.ingredients.has(c.card) && !codex.ingredients.get(c.card)!.nightOnly);
}

/** The Cider Press: your lowest Shelf potion is pressed, and one ingredient gets +2 Potency for the run. Up to three a night. */
export function pressCider(ctx: Ctx, uid: number): void {
  const stall = atStall(ctx, 'cider-press');
  if (stall.pressed >= CIDER_PRESS.max) reject(`the press takes ${CIDER_PRESS.max} potions a night`);
  const card = pressable(ctx.s).find((c) => c.uid === uid);
  if (!card) reject('the press only sweetens ingredients in your deck');
  const potion = cheapestPotion(ctx.s);
  if (!potion) reject('your Shelf is empty');
  takePotion(ctx, potion);
  card.bonus = (card.bonus ?? 0) + CIDER_PRESS.potency;
  stall.pressed++;
  ctx.ev.push({ type: 'cardInfused', uid: card.uid, bonus: card.bonus });
}

/** The Harvest Auction: one bid a night. It wins at the farmers' bid or more, and you pay only if it wins. */
export function placeBid(ctx: Ctx, amount: number): void {
  const s = ctx.s;
  const stall = atStall(ctx, 'harvest-auction');
  if (!stall.relic) reject('nothing is up for auction');
  if (stall.bid !== null) reject('one bid a night');
  if (!(HARVEST_AUCTION.bids as readonly number[]).includes(amount)) reject(`bids are ${HARVEST_AUCTION.bids.join(', ')}`);
  if (s.gold < amount) reject('not enough gold');
  stall.bid = amount;
  const won = amount >= stall.rival;
  ctx.ev.push({ type: 'auctionBid', bid: amount, rival: stall.rival, won });
  if (!won) return;
  changeGold(ctx, -amount, 'auction');
  gainRelic(ctx, stall.relic, 'auction');
}

/**
 * What the Hearth Trader shows tonight: two of his three Rare cards, or all three once your best friend
 * among the regulars is at FRIENDSHIP.traderBigLevel, then his familiar.
 */
export function hearthOffers(s: Pick<RunState, 'friendship' | 'friendshipBase'>, stall: { cards: string[]; familiars: string[] }): { cards: string[]; familiars: string[]; regular: string | null } {
  const regular = bestFriend(s);
  const level = regular ? friendLevelOf(s, regular) : 0;
  const shown = level >= FRIENDSHIP.traderBigLevel ? FRIENDSHIP.traderBigCards : FRIENDSHIP.traderCards;
  return { cards: stall.cards.slice(0, shown), familiars: stall.familiars, regular: level >= FRIENDSHIP.traderLevel ? regular : null };
}

/** The Hearth Trader: gold, on the name of a regular you're friends with, for a Rare card or a familiar (`index` runs over the cards shown, then the familiars). */
export function hearthTrade(ctx: Ctx, index: number): void {
  const s = ctx.s;
  const stall = atStall(ctx, 'hearth-trader');
  if (stall.done) reject('the Hearth Trader trades once a night');
  const shown = hearthOffers(s, stall);
  if (!shown.regular) reject(`he trades only with a friend of a regular (Friendship level ${FRIENDSHIP.traderLevel})`);
  if (s.gold < FRIENDSHIP.traderGold) reject(`needs ${FRIENDSHIP.traderGold} gold`);
  const offers = [...shown.cards, ...shown.familiars];
  const pick = offers[index];
  if (!pick) reject(`no offer ${index}`);
  const familiar = index >= shown.cards.length;
  if (familiar && s.familiars.length >= s.familiarSlots) reject('no free familiar slot');
  changeGold(ctx, -FRIENDSHIP.traderGold, 'market');
  if (familiar) addFamiliar(ctx, pick);
  else gainCard(ctx, pick, 'market');
  stall.done = true;
}

/** The Yule Log: 4 gold to burn one or two cards from your deck. Once a night; the deck can't drop below 8. */
export function burnYule(ctx: Ctx, uids: readonly number[]): void {
  const stall = atStall(ctx, 'hearth-trader');
  if (stall.burned) reject('the Yule Log burns once a night');
  const n = new Set(uids).size;
  if (n < 1 || n > YULE_LOG.cards) reject(`burn 1 or ${YULE_LOG.cards} cards`);
  if (ctx.s.gold < YULE_LOG.price) reject('not enough gold');
  giveCards(ctx, [...ctx.s.drawPile, ...ctx.s.hand, ...ctx.s.discardPile], uids, n, 0);
  changeGold(ctx, -YULE_LOG.price, 'yule-log');
  stall.burned = true;
}

/** The Holly Crown: 8 gold for one of the Frost familiars you don't have. Once a night. */
export function wearCrown(ctx: Ctx, index: number): void {
  const s = ctx.s;
  const stall = atStall(ctx, 'hearth-trader');
  const familiar = stall.crown[index];
  if (stall.crowned || !familiar) reject(`no familiar ${index} under the Holly Crown`);
  if (s.familiars.length >= s.familiarSlots) reject('no free familiar slot');
  if (s.gold < HOLLY_CROWN.price) reject('not enough gold');
  changeGold(ctx, -HOLLY_CROWN.price, 'holly-crown');
  addFamiliar(ctx, familiar);
  stall.crowned = true;
}
