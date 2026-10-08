import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, fencePrice, NIGHT_SHIFT_DAY, orderCount, payout, reachableRecipes, reduce, rentDue, replay, satisfies,
  tierIndex, tierOf, type Action, type Order, type Potion, type RunState,
} from '../src/core';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'fine', pay: 10, bonus: null, status: 'open', ...o,
});
const potion = (p: Partial<Potion> = {}): Potion => ({
  uid: 600, recipe: 'healing-draught', family: 'healing', quality: 14, tier: 'fine', ingredients: ['elmroot', 'creekwater'],
  experiment: false, heartDelta: 0, ...p,
});

/** A brewing state with exactly these orders and this hand. */
function setup(orders: Order[], hand: string[], extra: Partial<RunState> = {}): [RunState, number[]] {
  const [s, uids] = withHand(brewing(), hand);
  return [{ ...s, orders, ...extra }, uids];
}

/** Walk a run from morning to the end of the day's dusk, choosing the first option everywhere. */
function skipDay(s: RunState): RunState {
  if (s.phase === 'morning') s = ok(s, { type: 'openShop' }).state;
  s = ok(s, { type: 'endDay' }).state;
  s = ok(s, { type: 'skipReward' }).state;
  if (s.phase === 'night-market') return s;
  s = ok(s, { type: 'chooseErrand', errand: (s.offer as { options: ('market' | 'forage' | 'hearth')[] }).options[0]! }).state;
  return ok(s, { type: 'leaveErrand' }).state;
}

describe('orders', () => {
  it('posts 1-2 orders in week 1, 2 in weeks 2-3, 3 in week 4, plus one on a Night Shift', () => {
    expect(orderCount(1, false, 0.1)).toBe(1);
    expect(orderCount(1, false, 0.9)).toBe(2);
    expect(orderCount(2, false, 0.5)).toBe(2);
    expect(orderCount(4, false, 0.5)).toBe(3);
    expect(orderCount(4, true, 0.5)).toBe(4);
  });

  it('never asks for more than the deck can brew', () => {
    for (let i = 0; i < 30; i++) {
      const s = ok(start(`orders-${i}`), { type: 'debug', op: 'jumpToDay', week: 4, day: 2 }).state;
      const reach = reachableRecipes(s, false);
      for (const o of s.orders) {
        const recipes = o.request.kind === 'recipe' ? [o.request.recipe] : [...reach.keys()].filter((id) => codex.recipes.get(id)!.family === (o.request as { family: string }).family);
        const best = Math.max(...recipes.map((id) => reach.get(id) ?? 0));
        expect(tierIndex(o.minTier)).toBeLessThanOrEqual(tierIndex(tierOf(best)));
        expect(codex.regulars.get(o.customer)!.nightOnly).toBe(false);
      }
      expect(new Set(s.orders.map((o) => o.customer)).size).toBe(s.orders.length);
    }
  });

  it('a potion fills an order of its recipe or family at or above the minimum tier', () => {
    expect(satisfies(potion(), order())).toBe(true);
    expect(satisfies(potion(), order({ request: { kind: 'recipe', recipe: 'healing-draught' } }))).toBe(true);
    expect(satisfies(potion(), order({ request: { kind: 'recipe', recipe: 'calm-waters' } }))).toBe(false);
    expect(satisfies(potion(), order({ minTier: 'superb' }))).toBe(false);
    expect(satisfies(potion(), order({ status: 'filled' }))).toBe(false);
  });

  it('tips grow with the tier above the minimum, and a bonus condition adds more', () => {
    expect(payout(potion(), order())).toEqual({ pay: 10, tip: 0, bonus: false });
    expect(payout(potion({ tier: 'superb' }), order())).toEqual({ pay: 10, tip: 5, bonus: false });
    expect(payout(potion(), order({ bonus: 'no-umbra' }))).toEqual({ pay: 10, tip: 2, bonus: true });
    expect(payout(potion(), order({ bonus: 'three-ingredients' })).bonus).toBe(false);
    expect(payout(potion({ ingredients: ['thistledown', 'elmroot', 'elmroot'] }), order({ bonus: 'three-ingredients' })).bonus).toBe(true);
    expect(payout(potion(), order({ bonus: 'wychwood-ingredient' })).bonus).toBe(false);
  });

  it('brewing straight into an order pays and earns a heart', () => {
    const [s, uids] = setup([order()], ['elmroot', 'creekwater']);
    const r = ok(slotAll(s, uids), { type: 'brew', deliverTo: 500 });
    expect(ofType(r.events, 'orderFilled')[0]).toMatchObject({ pay: 10, tip: 0 });
    expect(r.state.gold).toBe(s.gold + 10);
    expect(r.state.hearts['old-tobin']).toBe(1);
    expect(r.state.shelf).toHaveLength(0);
    expect(r.state.orders[0]!.status).toBe('filled');
  });

  it('a brew that misses the order goes to the Shelf, and a full Shelf spills', () => {
    const [s, uids] = setup([order({ minTier: 'superb' })], ['elmroot', 'creekwater']);
    const r = ok(slotAll(s, uids), { type: 'brew', deliverTo: 500 });
    expect(r.state.shelf).toHaveLength(1);
    expect(r.state.orders[0]!.status).toBe('open');
    const full = ok(slotAll({ ...s, shelf: [potion(), potion(), potion(), potion()] }, uids), { type: 'brew' });
    expect(ofType(full.events, 'potionSpilled')).toHaveLength(1);
    expect(no(slotAll(s, uids), { type: 'brew', deliverTo: 404 })).toMatch(/no order/);
  });

  it('Shelf potions can be delivered later', () => {
    const [s] = setup([order({ bonus: 'no-umbra' })], [], { shelf: [potion()] });
    const r = ok(s, { type: 'deliver', order: 500, potion: 600 });
    expect(r.state.shelf).toHaveLength(0);
    expect(r.state.hearts['old-tobin']).toBe(2);
    expect(no(r.state, { type: 'deliver', order: 500, potion: 600 })).toMatch(/already filled/);
    expect(no(s, { type: 'deliver', order: 500, potion: 1 })).toMatch(/not on the Shelf/);
    expect(no({ ...s, shelf: [potion({ tier: 'crude' })] }, { type: 'deliver', order: 500, potion: 600 })).toMatch(/does not fill/);
  });

  it('Grave Moss potions cost the heart they would have earned', () => {
    const [s] = setup([order()], [], { shelf: [potion({ heartDelta: -1 })], hearts: { 'old-tobin': 3 } });
    const r = ok(s, { type: 'deliver', order: 500, potion: 600 });
    expect(r.state.hearts['old-tobin']).toBe(3);
  });

  it('declining, or leaving an order unfinished, costs a heart', () => {
    const [s] = setup([order(), order({ id: 501, customer: 'bea-thornwick' })], [], { hearts: { 'old-tobin': 2, 'bea-thornwick': 1 } });
    const declined = ok(s, { type: 'decline', order: 500 });
    expect(declined.state.hearts['old-tobin']).toBe(1);
    const ended = ok(declined.state, { type: 'endDay' });
    expect(ended.state.hearts['bea-thornwick']).toBe(0);
    expect(ofType(ended.events, 'orderDeclined')).toHaveLength(1);
    expect(no(s, { type: 'decline', order: 404 })).toMatch(/no order/);
  });

  it('hearts stay between 0 and 10', () => {
    const [s] = setup([order()], [], { shelf: [potion()], hearts: { 'old-tobin': 10 } });
    expect(ok(s, { type: 'deliver', order: 500, potion: 600 }).state.hearts['old-tobin']).toBe(10);
    expect(ok({ ...s, hearts: {} }, { type: 'decline', order: 500 }).state.hearts['old-tobin']).toBe(0);
  });
});

describe('dusk', () => {
  it('ending the day offers 3 reward cards; picking one adds it to the deck', () => {
    const s = ok(brewing(), { type: 'endDay' }).state;
    expect(s.phase).toBe('dusk');
    expect(s.offer).toMatchObject({ kind: 'reward' });
    const cards = (s.offer as { cards: string[] }).cards;
    expect(new Set(cards).size).toBe(3);
    const r = ok(s, { type: 'pickReward', index: 1 });
    expect(allCards(r.state).filter((c) => c.card === cards[1]).length).toBe(allCards(s).filter((c) => c.card === cards[1]).length + 1);
    expect(r.state.offer).toMatchObject({ kind: 'errands' });
    expect(no(s, { type: 'pickReward', index: 5 })).toMatch(/no reward/);
  });

  it('skipping pays 2 gold and raises the rarity odds next time', () => {
    const s = ok(brewing(), { type: 'endDay' }).state;
    const r = ok(s, { type: 'skipReward' });
    expect(r.state.gold).toBe(s.gold + 2);
    expect(r.state.skipStreak).toBe(1);
    // Picking a card resets the streak.
    expect(ok({ ...r.state, offer: s.offer }, { type: 'pickReward', index: 0 }).state.skipStreak).toBe(0);
  });

  it('offers 2 of the 3 errands and only those can be chosen', () => {
    const s = ok(ok(brewing(), { type: 'endDay' }).state, { type: 'skipReward' }).state;
    const options = (s.offer as { options: string[] }).options;
    expect(options).toHaveLength(2);
    const missing = (['market', 'forage', 'hearth'] as const).find((e) => !options.includes(e))!;
    expect(no(s, { type: 'chooseErrand', errand: missing })).toMatch(/not on offer/);
    expect(no(s, { type: 'leaveErrand' })).toMatch(/choose an errand/);
  });

  function atErrand(errand: 'market' | 'forage' | 'hearth', gold = 50): RunState {
    const s = ok(ok(brewing(), { type: 'endDay' }).state, { type: 'skipReward' }).state;
    return ok({ ...s, gold, offer: { kind: 'errands', options: [errand] } }, { type: 'chooseErrand', errand }).state;
  }

  it('the Market sells cards and upgrades for gold', () => {
    const s = atErrand('market');
    if (s.offer?.kind !== 'market') throw new Error('not at market');
    const stock = s.offer.stock;
    expect(stock.filter((i) => i.kind === 'card')).toHaveLength(4);
    const slot = stock.findIndex((i) => i.kind === 'cauldron-slot');
    const shelf = stock.findIndex((i) => i.kind === 'shelf-slot');
    let r = ok(s, { type: 'buy', index: slot }).state;
    r = ok(r, { type: 'buy', index: shelf }).state;
    r = ok(r, { type: 'buy', index: 0 }).state;
    expect(r.cauldronSlots).toBe(3);
    expect(r.shelfSize).toBe(5);
    expect(r.gold).toBe(50 - stock[slot]!.price - stock[shelf]!.price - stock[0]!.price);
    expect(allCards(r).length).toBe(allCards(s).length + 1);
    expect(no(r, { type: 'buy', index: 0 })).toMatch(/already sold/);
    expect(no({ ...s, gold: 0 }, { type: 'buy', index: 0 })).toMatch(/not enough gold/);
    expect(no(s, { type: 'buy', index: 99 })).toMatch(/no stock/);
    const leave = ok(r, { type: 'leaveErrand' });
    expect(leave.state).toMatchObject({ day: 2, phase: 'morning' });
    // Upgrades disappear once maxed.
    const maxed = atErrand('market');
    expect(ok({ ...maxed, cauldronSlots: 3, shelfSize: 6, offer: { kind: 'errands', options: ['market'] } }, { type: 'chooseErrand', errand: 'market' }).state.offer)
      .toMatchObject({ stock: expect.not.arrayContaining([expect.objectContaining({ kind: 'cauldron-slot' })]) });
  });

  it('Wychwood Forage gives 2 free picks from 5', () => {
    const s = atErrand('forage');
    expect((s.offer as { cards: string[] }).cards).toHaveLength(5);
    let r = ok(s, { type: 'forage', index: 0 }).state;
    r = ok(r, { type: 'forage', index: 0 }).state;
    expect(allCards(r).length).toBe(allCards(s).length + 2);
    expect(r.gold).toBe(s.gold);
    expect(no(r, { type: 'forage', index: 0 })).toMatch(/no picks/);
    expect(no(s, { type: 'forage', index: 9 })).toMatch(/no forage card/);
  });

  it('the Hearth removes one card, but not below the minimum deck', () => {
    const s = atErrand('hearth');
    const victim = allCards(s)[0]!;
    const r = ok(s, { type: 'removeCard', uid: victim.uid }).state;
    expect(allCards(r).some((c) => c.uid === victim.uid)).toBe(false);
    expect(no(r, { type: 'removeCard', uid: allCards(r)[0]!.uid })).toMatch(/one card/);
    expect(no(s, { type: 'removeCard', uid: 9999 })).toMatch(/not in the deck/);
    const tiny = { ...s, drawPile: s.drawPile.slice(0, 2), hand: [], discardPile: s.discardPile.slice(0, 6) };
    expect(no(tiny, { type: 'removeCard', uid: tiny.drawPile[0]!.uid })).toMatch(/below 8/);
  });

  it('dusk actions are rejected at the wrong time', () => {
    const s = brewing();
    expect(no(s, { type: 'skipReward' })).toMatch(/nothing to do with a reward/);
    expect(no(s, { type: 'buy', index: 0 })).toMatch(/market/);
    expect(no(s, { type: 'leaveErrand' })).toMatch(/not allowed during brewing/);
    expect(no(s, { type: 'openShop' })).toMatch(/not allowed during brewing/);
    expect(no(start(), { type: 'brew' })).toMatch(/not allowed during morning/);
  });
});

describe('weeks, rent and the end of a run', () => {
  it('four days, then a Night Shift, then the Night Market and rent', () => {
    let s = start('week');
    for (let d = 1; d < NIGHT_SHIFT_DAY; d++) {
      expect(s.day).toBe(d);
      s = skipDay(s);
    }
    expect(s.day).toBe(NIGHT_SHIFT_DAY);
    s = skipDay(s);
    expect(s.phase).toBe('night-market');
    expect(s.offer).toEqual({ kind: 'fence' });

    s = { ...s, gold: 100, shelf: [potion({ tier: 'superb' }), potion({ uid: 601, ingredients: ['nightshade', 'creekwater'] })] };
    const sold = ok(s, { type: 'sellPotion', uid: 600 });
    expect(sold.state.gold).toBe(100 + fencePrice(potion({ tier: 'superb' })));
    expect(fencePrice(potion({ ingredients: ['nightshade', 'creekwater'] }))).toBeGreaterThan(fencePrice(potion()));
    expect(no(s, { type: 'sellPotion', uid: 1 })).toMatch(/not on the Shelf/);

    const next = ok(sold.state, { type: 'leaveMarket' });
    expect(ofType(next.events, 'rentPaid')[0]).toEqual({ type: 'rentPaid', week: 1, amount: 20 });
    expect(next.state).toMatchObject({ week: 2, day: 1, phase: 'morning', gold: sold.state.gold - 20 });
  });

  it("can't pay the rent: the run is over", () => {
    const s = { ...ok(start(), { type: 'debug', op: 'jumpToDay', week: 2, day: NIGHT_SHIFT_DAY }).state };
    const market = skipDay(s);
    const r = ok({ ...market, gold: 10 }, { type: 'leaveMarket' });
    expect(r.state.phase).toBe('game-over');
    expect(ofType(r.events, 'runLost')).toEqual([{ type: 'runLost', week: 2 }]);
    expect(no(r.state, { type: 'openShop' })).toMatch(/game-over/);
  });

  it('paying the fourth rent wins', () => {
    const s = ok(start(), { type: 'debug', op: 'jumpToDay', week: 4, day: NIGHT_SHIFT_DAY }).state;
    const r = ok({ ...skipDay(s), gold: 500 }, { type: 'leaveMarket' });
    expect(r.state.phase).toBe('victory');
    expect(r.state.gold).toBe(340);
    expect(ofType(r.events, 'runWon')).toHaveLength(1);
  });

  it('seasons scale the rent and twist the day', () => {
    expect([1, 2, 3, 4].map((w) => rentDue('spring', w))).toEqual([20, 45, 90, 160]);
    expect(rentDue('winter', 4)).toBeGreaterThan(rentDue('autumn', 4));
    const summer = start('sun', 'summer');
    expect(summer.brewsLeft).toBe(5);
    const night = ok(summer, { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state;
    expect(night).toMatchObject({ brewsLeft: 4, discardsLeft: 2 });
  });

  it('debug actions add gold and jump to a day', () => {
    const s = start();
    expect(ok(s, { type: 'debug', op: 'addGold', amount: 25 }).state.gold).toBe(s.gold + 25);
    expect(no(s, { type: 'debug', op: 'jumpToDay', week: 5, day: 1 })).toMatch(/no such day/);
  });
});

describe('replay', () => {
  it('an action log rebuilds the exact same run', () => {
    let s = start('replay');
    const log: Action[] = [{ type: 'startRun', seed: 'replay', witch: 'hedge-witch' }];
    const step = (a: Action) => {
      log.push(a);
      s = reduce(s, a).state;
    };
    step({ type: 'openShop' });
    step({ type: 'discard', uids: [s.hand[0]!.uid] });
    step({ type: 'endDay' });
    step({ type: 'pickReward', index: 0 });
    step({ type: 'brew' }); // rejected: wrong phase
    const r = replay(log);
    expect(r.state).toEqual(s);
    expect(r.rejected).toBe(1);
    expect(() => replay([])).toThrow(/empty/);
  });
});
