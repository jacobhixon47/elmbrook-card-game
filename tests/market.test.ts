import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, BLACK_MARKET, BLACK_MARKET_RELIC, CAULDRON_SLOTS, essencesOf, forgettable, fortuneOn, fortunePrice, isSatchelCard, LANTERN_STOCK, MIN_DECK, moonOf,
  NIGHT_SHIFT_DAY, previewBrew, reduce, TINKER_PRICE, tierIndex, WEEKS,
  type RunState, type StallId, type StallState,
} from '../src/core';
import { no, ofType, ok, slotAll, start, withHand } from './helpers';

/** A run standing on the Night Market's street after this week's Night Shift. */
function market(week: number, opts: { seed?: string; gold?: number } = {}): RunState {
  let s = start(opts.seed ?? 'market');
  s = ok(s, { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  s = ok(ok(ok(s, { type: 'openShop' }).state, { type: 'endDay' }).state, { type: 'skipReward' }).state;
  while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
  return opts.gold === undefined ? s : { ...s, gold: opts.gold };
}

const stalls = (s: RunState): StallState[] => (s.offer?.kind === 'night-market' ? s.offer.stalls : []);
const ids = (s: RunState) => stalls(s).map((x) => x.id);

/** Walk up to a stall by id. */
function visit(s: RunState, id: StallId): RunState {
  const index = ids(s).indexOf(id);
  expect(index, `${id} is open`).toBeGreaterThanOrEqual(0);
  return ok(s, { type: 'visitStall', index }).state;
}

const at = <K extends StallId>(s: RunState, id: K) => stalls(s).find((x) => x.id === id) as StallState & { id: K };

describe('the Night Market street', () => {
  it('opens three stalls at a quarter moon, every stall plus a visitor at the full and new moon', () => {
    expect([1, 2, 3, 4].map(moonOf)).toEqual(['quarter', 'full-moon', 'quarter', 'new-moon']);
    const drawn = new Set<StallId>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const q = ids(market(1, { seed }));
      expect(q).toHaveLength(3);
      expect(q.slice(0, 2)).toEqual(['lantern-seller', 'fence']);
      drawn.add(q[2]!);
    }
    expect([...drawn].every((id) => codex.stalls.get(id)!.opens === 'drawn')).toBe(true);
    expect(drawn.size).toBeGreaterThan(1);
    expect(ids(market(2))).toEqual(['lantern-seller', 'fence', 'moth-broker', 'hollow-tailor', 'fortune-tent', 'name-taker', 'wandering-tinker']);
    expect(ids(market(4))).toEqual(['lantern-seller', 'fence', 'moth-broker', 'hollow-tailor', 'fortune-tent', 'name-taker', 'black-market']);
  });

  it('walks between stalls; each trade needs you at its stall', () => {
    const s = market(2, { gold: 50 });
    expect(s.phase).toBe('night-market');
    const r = ok(s, { type: 'visitStall', index: 4 });
    expect(ofType(r.events, 'stallVisited')).toEqual([{ type: 'stallVisited', stall: 'fortune-tent' }]);
    expect(no(s, { type: 'visitStall', index: 9 })).toMatch(/no stall/);
    expect(no(s, { type: 'drawTarot' })).toMatch(/Fortune Tent/);
    expect(no(s, { type: 'sellPotion', uid: 1 })).toMatch(/Fence/);
    expect(no(s, { type: 'buy', index: 0 })).toMatch(/market/);
    const back = ok(r.state, { type: 'leaveStall' }).state;
    expect(back.offer).toMatchObject({ kind: 'night-market', at: null });
    // Rent can be paid from anywhere on the street.
    expect(ok(r.state, { type: 'leaveMarket' }).state.week).toBe(3);
    expect(no(start(), { type: 'leaveStall' })).toMatch(/closed/);
  });
});

describe('the Lantern Seller and the Wandering Tinker', () => {
  it('sells Lunar ingredients and Omens into the Night Satchel', () => {
    let s = visit(market(1, { gold: 30 }), 'lantern-seller');
    const stock = at(s, 'lantern-seller').stock;
    expect(stock.map((i) => i.price)).toEqual([...Array(LANTERN_STOCK.lunar).fill(LANTERN_STOCK.lunarPrice), ...Array(LANTERN_STOCK.omens).fill(LANTERN_STOCK.omenPrice)]);
    expect(stock.every((i) => i.kind === 'card' && isSatchelCard(i.card))).toBe(true);
    s = ok(s, { type: 'buy', index: 3 }).state;
    expect(s.gold).toBe(30 - LANTERN_STOCK.omenPrice);
    expect(s.satchel).toHaveLength(1);
    expect(allCards(s).some((c) => isSatchelCard(c.card))).toBe(false);
    expect(no(s, { type: 'buy', index: 3 })).toMatch(/sold/);
    expect(no({ ...s, gold: 1 }, { type: 'buy', index: 0 })).toMatch(/gold/);
  });

  it('the Tinker sells a cauldron slot and a Shelf slot at the full moon', () => {
    let s = visit(market(2, { gold: 40 }), 'wandering-tinker');
    const stock = at(s, 'wandering-tinker').stock;
    expect(stock.map((i) => [i.kind, i.price])).toEqual([['familiar', Math.round(18 * 0.75)], ['cauldron-slot', TINKER_PRICE.cauldronSlot], ['shelf-slot', TINKER_PRICE.shelfSlot]]);
    expect(stock[0]!.kind === 'familiar' && codex.familiars.get(stock[0]!.familiar)!.rarity).toBe('rare');
    s = ok(s, { type: 'buy', index: 1 }).state;
    expect(s.cauldronSlots).toBe(CAULDRON_SLOTS + 1);
    expect(s.gold).toBe(40 - TINKER_PRICE.cauldronSlot);
  });
});

describe('the Moth Broker', () => {
  it('takes a learned recipe, never a starting one, for 1 of 3 Rare cards', () => {
    let s = ok(market(2), { type: 'debug', op: 'learnRecipes', recipes: ['smoke-veil'] }).state;
    expect(forgettable(s)).toEqual(['smoke-veil']);
    s = visit(s, 'moth-broker');
    expect(no(s, { type: 'forgetRecipe', recipe: 'healing-draught' })).toMatch(/won't take/);
    expect(no(s, { type: 'brokerPick', index: 0 })).toMatch(/no card/);
    const r = ok(s, { type: 'forgetRecipe', recipe: 'smoke-veil' });
    s = r.state;
    expect(s.knownRecipes).not.toContain('smoke-veil');
    const cards = at(s, 'moth-broker').cards;
    expect(cards).toHaveLength(3);
    expect(cards.every((c) => codex.ingredients.get(c)?.rarity === 'rare')).toBe(true);
    expect(ofType(r.events, 'recipeForgotten')[0]).toMatchObject({ recipe: 'smoke-veil', cards });
    expect(no(s, { type: 'forgetRecipe', recipe: 'smoke-veil' })).toMatch(/one memory/);
    s = ok(s, { type: 'brokerPick', index: 2 }).state;
    expect(allCards(s).map((c) => c.card)).toContain(cards[2]);
    expect(at(s, 'moth-broker')).toMatchObject({ done: true, cards: [] });
  });
});

describe('the Hollow Tailor', () => {
  it('sews one card\'s essence into another, with +1 Potency, and brewing uses it', () => {
    let s = visit(market(2), 'hollow-tailor');
    const deck = allCards(s);
    const clay = deck.find((c) => c.card === 'river-clay')!;
    const elm = deck.find((c) => c.card === 'elmroot')!;
    expect(no(s, { type: 'weave', from: clay.uid, into: clay.uid })).toMatch(/different/);
    expect(no(s, { type: 'weave', from: deck.find((c) => c.card === 'stir')!.uid, into: elm.uid })).toMatch(/ingredients/);
    const r = ok(s, { type: 'weave', from: clay.uid, into: elm.uid });
    s = r.state;
    expect(ofType(r.events, 'cardWoven')[0]).toMatchObject({ from: 'river-clay', into: 'elmroot', essence: 'stone' });
    expect(allCards(s).some((c) => c.uid === clay.uid)).toBe(false);
    const woven = allCards(s).find((c) => c.uid === elm.uid)!;
    expect(woven).toMatchObject({ woven: 'stone', bonus: 1 });
    expect(essencesOf(woven)).toEqual(['vital', 'stone']);
    expect(no(s, { type: 'weave', from: deck[0]!.uid, into: deck[1]!.uid })).toMatch(/one card a night/);

    // A woven essence replaces the second, and the card brews as that.
    expect(essencesOf({ card: 'willow-bark', woven: 'ember' })).toEqual(['vital', 'ember']);
    expect(essencesOf({ card: 'willow-bark', woven: 'tide' })).toEqual(['vital', 'tide']);
    let b = ok(ok({ ...s, gold: 500 }, { type: 'leaveMarket' }).state, { type: 'openShop' }).state;
    const [h, uids] = withHand(b, ['emberbloom']);
    b = { ...h, hand: [...h.hand, { ...woven }] };
    b = slotAll(b, [...uids, woven.uid]);
    const p = previewBrew(b, b.cauldron, b.hand);
    expect(p).toMatchObject({ kind: 'potion' });
    expect(codex.recipes.get((p as { recipe: string }).recipe)!.pattern).toContain('stone');
  });

  it('won\'t sew in what a card already has, or thin the deck below the minimum', () => {
    const s = visit(market(2), 'hollow-tailor');
    const elms = allCards(s).filter((c) => c.card === 'elmroot');
    expect(no(s, { type: 'weave', from: elms[0]!.uid, into: elms[1]!.uid })).toMatch(/already vital/);
    const thin = { ...s, drawPile: s.drawPile.slice(0, MIN_DECK - s.discardPile.length - s.hand.length) };
    const cards = allCards(thin).filter((c) => codex.ingredients.has(c.card));
    expect(allCards(thin)).toHaveLength(MIN_DECK);
    expect(no(thin, { type: 'weave', from: cards[0]!.uid, into: cards.find((c) => c.card !== cards[0]!.card)!.uid })).toMatch(/below/);
  });
});

describe('the Fortune Tent', () => {
  it('costs more each draw and plays every tarot card', () => {
    let s = visit(market(2, { gold: 100 }), 'fortune-tent');
    expect([0, 1, 2].map(fortunePrice)).toEqual([5, 8, 11]);
    const seen = new Set<string>();
    let paid = 0;
    for (let i = 0; i < 40; i++) {
      const before = s;
      s = { ...s, gold: 1000 };
      const r = ok(s, { type: 'drawTarot' });
      const [drawn] = ofType(r.events, 'tarotDrawn');
      expect(drawn!.price).toBe(fortunePrice(i));
      paid += drawn!.price;
      seen.add(drawn!.card);
      const t = codex.tarot.get(drawn!.card)!;
      const gold = r.state.gold - (1000 - drawn!.price);
      if (t.effect === 'gold') expect(gold).toBe(t.amount);
      if (t.effect === 'relic') expect(r.state.relics.length > before.relics.length || gold === t.amount).toBe(true);
      if (t.effect === 'familiar') expect(r.state.familiars.length > before.familiars.length || gold === t.amount).toBe(true);
      if (t.effect === 'lunar-card') expect(r.state.satchel.length).toBe(before.satchel.length + 1);
      if (t.effect === 'learn-recipe') expect(r.state.knownRecipes.length).toBe(before.knownRecipes.length + 1);
      if (t.effect === 'bad-omen') expect(allCards(r.state).filter((c) => c.card === 'bad-omen').length).toBe(allCards(before).filter((c) => c.card === 'bad-omen').length + 1);
      if (t.effect === 'lose-card') expect(allCards(r.state).length).toBe(Math.max(MIN_DECK, allCards(before).length - 1));
      if (t.effect === 'fog-week') expect(r.state.calendar.weather[2]!.slice(0, NIGHT_SHIFT_DAY - 1).every((w) => w === 'fog')).toBe(true);
      if (t.nextWeek) expect(r.state.fortunes).toContainEqual({ week: 3, card: t.id });
      s = r.state;
    }
    expect(paid).toBeGreaterThan(0);
    expect(seen.size).toBeGreaterThan(6);
    expect(no({ ...s, gold: 0 }, { type: 'drawTarot' })).toMatch(/gold/);
  });

  it('draws no next-week twists in the last week', () => {
    let s = visit(market(WEEKS, { gold: 1000 }), 'fortune-tent');
    for (let i = 0; i < 30; i++) s = ok({ ...s, gold: 1000 }, { type: 'drawTarot' }).state;
    expect(s.fortunes).toEqual([]);
  });

  it('The Hermit posts one order fewer a day for more pay; The Tower posts harder orders for double', () => {
    const base = market(2, { gold: 500 });
    expect(fortuneOn({ fortunes: [{ week: 3, card: 'the-hermit' }], week: 3 }, 'fewer-orders')).toBe(true);
    expect(fortuneOn({ fortunes: [{ week: 3, card: 'the-hermit' }], week: 2 }, 'fewer-orders')).toBe(false);
    // Same seed and day: compare week 3 day 1 with and without each twist.
    const day1 = (fortunes: RunState['fortunes']) => ok({ ...base, fortunes }, { type: 'leaveMarket' }).state.orders;
    const plain = day1([]);
    const hermit = day1([{ week: 3, card: 'the-hermit' }]);
    const tower = day1([{ week: 3, card: 'the-tower' }]);
    expect(hermit.length).toBe(Math.max(1, plain.length - 1));
    expect(Math.max(...hermit.map((o) => o.pay))).toBeGreaterThan(0);
    expect(tower.length).toBe(plain.length);
    expect(tower.reduce((n, o) => n + tierIndex(o.minTier), 0)).toBeGreaterThanOrEqual(plain.reduce((n, o) => n + tierIndex(o.minTier), 0));
    expect(tower.reduce((n, o) => n + o.pay, 0)).toBeGreaterThan(plain.reduce((n, o) => n + o.pay, 0));
  });
});

describe('the Black Market', () => {
  it('sells Rare cards for gold, or for two cards from the deck', () => {
    let s = visit(market(WEEKS, { gold: 30 }), 'black-market');
    const stock = at(s, 'black-market').stock;
    expect(stock).toHaveLength(BLACK_MARKET.cards + 1);
    const cards = stock.slice(0, BLACK_MARKET.cards);
    expect(cards.every((i) => i.kind === 'card' && i.price === BLACK_MARKET.price && codex.ingredients.get(i.card)?.rarity === 'rare')).toBe(true);
    const relic = stock[BLACK_MARKET.cards]!;
    if (relic.kind !== 'relic') throw new Error('expected a relic');
    expect(codex.relics.get(relic.relic)!.tier).toBe(BLACK_MARKET_RELIC.tier);
    expect(relic.price).toBe(BLACK_MARKET_RELIC.price);
    expect(no(s, { type: 'swapForCard', index: BLACK_MARKET.cards, uids: [allCards(s)[0]!.uid, allCards(s)[1]!.uid] })).toMatch(/no stock/);
    const deck = allCards(s);
    expect(no(s, { type: 'swapForCard', index: 0, uids: [deck[0]!.uid] })).toMatch(/2 cards/);
    expect(no(s, { type: 'swapForCard', index: 0, uids: [deck[0]!.uid, deck[0]!.uid] })).toMatch(/2 cards/);
    const r = ok(s, { type: 'swapForCard', index: 0, uids: [deck[0]!.uid, deck[1]!.uid] });
    s = r.state;
    expect(ofType(r.events, 'cardRemoved')).toHaveLength(2);
    expect(allCards(s)).toHaveLength(deck.length - 1);
    expect(s.gold).toBe(30);
    expect(no(s, { type: 'swapForCard', index: 0, uids: [deck[2]!.uid, deck[3]!.uid] })).toMatch(/sold/);
    s = ok(s, { type: 'buy', index: 1 }).state;
    expect(s.gold).toBe(30 - BLACK_MARKET.price);
    const thin = { ...s, drawPile: [], hand: [], discardPile: allCards(s).slice(0, MIN_DECK) };
    expect(no(thin, { type: 'swapForCard', index: 2, uids: [thin.discardPile[0]!.uid, thin.discardPile[1]!.uid] })).toMatch(/below/);
  });
});

describe('the state', () => {
  it('starts with no fortunes', () => {
    expect(reduce(null, { type: 'startRun', seed: 'x', witch: 'hedge-witch' }).state.fortunes).toEqual([]);
  });
});
