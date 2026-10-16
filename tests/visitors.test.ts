import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, migrateRun, MODIFIER_RULES, NIGHT_SHIFT_DAY, satisfies, VISITOR_RULES, visitorsToday, WEEKS,
  type Calendar, type Order, type RunState, type Season, type Weather,
} from '../src/core';
import { customerLine, customerName, extraPay, orderNeeds, orderTerms } from '../src/view/describe';
import { no, ofType, ok, start } from './helpers';

const sky = (w: Weather): Calendar => ({ weather: Array.from({ length: WEEKS }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => w)), sky: null });

/** A run on this day with the shop open. */
function day(season: Season, week: number, d: number, seed = 'visitors', weather: Weather = 'clear'): RunState {
  let s = { ...start(seed, season), calendar: sky(weather) };
  s = ok(s, { type: 'debug', op: 'jumpToDay', week, day: d }).state;
  return ok(s, { type: 'openShop' }).state;
}

/** Fill the visitor's order with a potion straight off the Shelf that meets it. */
function fillVisitor(s: RunState, id: string): RunState {
  let t = ok(s, { type: 'debug', op: 'postVisitor', visitor: id }).state;
  const order = t.orders.at(-1)!;
  expect(order.customer).toBe(id);
  const recipe = [...codex.recipes.values()].find((r) => order.request.kind === 'family' && r.family === order.request.family)!;
  const tag = order.needsTag ? [...codex.ingredients.values()].find((i) => i.tags.includes(order.needsTag!))!.id : 'elmroot';
  for (let i = 0; i < order.quantity; i++) {
    t = { ...t, shelf: [...t.shelf, { uid: t.nextUid, recipe: recipe.id, family: recipe.family, quality: 999, tier: 'legendary', ingredients: [tag], experiment: false, heartDelta: 0 }], nextUid: t.nextUid + 1 };
    t = ok(t, { type: 'deliver', potion: t.shelf.at(-1)!.uid, order: order.id }).state;
  }
  return t;
}

/** Close the shop and skip the reward, to reach the free picks and favours. */
const closeUp = (s: RunState) => ok(ok({ ...s, orders: s.orders.map((o) => ({ ...o, status: o.status === 'open' ? 'declined' as const : o.status })) }, { type: 'endDay' }).state, { type: 'skipReward' }).state;

describe('seasonal visitors (GDD §4.1)', () => {
  it('two per season, with no Friendship', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      expect([...codex.visitors.values()].filter((v) => v.season === season)).toHaveLength(2);
    }
    for (const id of codex.visitors.keys()) expect(codex.regulars.has(id)).toBe(false);
  });

  it('come only in their season, from week 2, on their weeks, days and weather', () => {
    const on = (season: Season, week: number, d: number, weather: Weather = 'clear') =>
      visitorsToday({ season, week, day: d, calendar: sky(weather) }).map((v) => v.id);
    expect(on('spring', 1, 2)).toEqual([]);
    expect(on('spring', 2, 2)).toEqual(['wren-hollis', 'may-herald']);
    expect(on('spring', 2, 4)).toEqual(['wren-hollis']);
    expect(on('spring', 3, 2)).toEqual(['wren-hollis']);
    expect(on('summer', 2, 1, 'rain')).toEqual(['captain-brine']);
    expect(on('summer', 2, 1)).toEqual(['captain-brine', 'firefly-keeper']);
    expect(on('winter', 3, 1)).toEqual(['toymaker']);
    expect(on('winter', 3, 1, 'snow')).toEqual(['snowbound-traveller', 'toymaker']);
    expect(VISITOR_RULES.firstWeek).toBe(2);
  });

  it('about 1 day in 4, taking a regular\'s place, at most one a day', () => {
    let days = 0;
    let visits = 0;
    for (let i = 0; i < 40; i++) {
      for (let d = 1; d < NIGHT_SHIFT_DAY; d++) {
        const s = day('autumn', 2 + (i % 3), d, `v-${i}`);
        const v = s.orders.filter((o) => codex.visitors.has(o.customer));
        expect(v.length).toBeLessThanOrEqual(1);
        for (const o of v) expect(codex.visitors.get(o.customer)!.season).toBe('autumn');
        days += 1;
        visits += v.length;
      }
    }
    expect(visits / days).toBeGreaterThan(0.12);
    expect(visits / days).toBeLessThan(0.38);
    // Never in week 1, or on a Night Shift.
    for (let i = 0; i < 20; i++) expect(day('autumn', 1, 2, `w1-${i}`).orders.some((o) => codex.visitors.has(o.customer))).toBe(false);
  });

  it('Wren and Captain Brine want their tag in the potion', () => {
    const s = ok(day('spring', 2, 2), { type: 'debug', op: 'postVisitor', visitor: 'wren-hollis' }).state;
    const order = s.orders.at(-1)!;
    expect(order.needsTag).toBe('flower');
    const family = order.request.kind === 'family' ? order.request.family : 'healing';
    const recipe = [...codex.recipes.values()].find((r) => r.family === family)!;
    const potion = { recipe: recipe.id, family, tier: 'legendary' as const, ingredients: ['elmroot'] };
    expect(satisfies(potion, order)).toBe(false);
    expect(satisfies({ ...potion, ingredients: ['lavender'] }, order)).toBe(true);
    expect(orderNeeds(order)).toBe('Needs a Flower ingredient');
  });

  it('Wren pays a pick of Flower ingredients and half gold', () => {
    const s = fillVisitor(day('spring', 2, 2), 'wren-hollis');
    expect(s.gifts).toHaveLength(1);
    const gift = s.gifts[0]!;
    expect(gift).toMatchObject({ source: 'visitor', from: 'wren-hollis', into: 'deck' });
    expect(gift.cards).toHaveLength(2);
    for (const id of gift.cards) expect(codex.ingredients.get(id)!.tags).toContain('flower');
    const t = closeUp(s);
    expect(t.offer).toMatchObject({ kind: 'gift', from: 'wren-hollis' });
  });

  it('Captain Brine pays Tide ingredients; the Traveller pays Tinctures', () => {
    const brine = fillVisitor(day('summer', 2, 2), 'captain-brine').gifts[0]!;
    for (const id of brine.cards) expect(codex.ingredients.get(id)!.essences).toContain('tide');
    const traveller = fillVisitor(day('winter', 2, 2, 'visitors', 'snow'), 'snowbound-traveller').gifts[0]!;
    for (const id of traveller.cards) expect(codex.tinctures.get(id)!.rarity).not.toBe('lunar');
  });

  it('the Tithe Collector wants two potions and pays double', () => {
    const s = ok(day('autumn', 2, 2), { type: 'debug', op: 'postVisitor', visitor: 'tithe-collector' }).state;
    expect(s.orders.at(-1)!.quantity).toBe(2);
    const filled = fillVisitor(day('autumn', 2, 2), 'tithe-collector');
    expect(filled.orders.at(-1)!.status).toBe('filled');
  });

  it('Rook carries off a card of your choice after closing', () => {
    let s = closeUp(fillVisitor(day('autumn', 2, 2), 'rook'));
    expect(s.offer).toEqual({ kind: 'favour', visitor: 'rook', job: 'burn' });
    const card = allCards(s)[0]!;
    const before = allCards(s).length;
    const r = ok(s, { type: 'doFavour', uid: card.uid });
    expect(allCards(r.state)).toHaveLength(before - 1);
    expect(ofType(r.events, 'favourDone')).toEqual([{ type: 'favourDone', visitor: 'rook', uid: card.uid }]);
    expect(r.state.offer?.kind).toBe('errands');
    // Or keep every card.
    s = closeUp(fillVisitor(day('autumn', 2, 2), 'rook'));
    expect(allCards(ok(s, { type: 'passGift' }).state)).toHaveLength(before);
  });

  it('the Toymaker tunes up an ingredient: +2 Potency for the run', () => {
    const s = closeUp(fillVisitor(day('winter', 2, 2), 'toymaker'));
    expect(s.offer).toEqual({ kind: 'favour', visitor: 'toymaker', job: 'temper' });
    const stir = allCards(s).find((c) => c.card === 'stir')!;
    expect(no(s, { type: 'doFavour', uid: stir.uid })).toMatch(/ingredients/);
    const card = allCards(s).find((c) => codex.ingredients.has(c.card))!;
    const t = ok(s, { type: 'doFavour', uid: card.uid }).state;
    expect(allCards(t).find((c) => c.uid === card.uid)!.bonus).toBe(MODIFIER_RULES.temperPotency);
  });

  it('the Firefly Keeper makes the next Night Market buy half price, for that week only', () => {
    let s = fillVisitor(day('summer', 2, 2), 'firefly-keeper');
    expect(s.halfPrice).toBe(1);
    s = ok({ ...s, orders: [] }, { type: 'debug', op: 'jumpToDay', week: 2, day: NIGHT_SHIFT_DAY }).state;
    s = ok(ok(s, { type: 'openShop' }).state, { type: 'endDay' }).state;
    s = ok(s, { type: 'skipReward' }).state;
    while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
    s = { ...s, gold: 200 };
    s = ok(s, { type: 'visitStall', index: 0 }).state;
    const stock = s.offer?.kind === 'night-market' ? (s.offer.stalls[0] as { stock: { price: number }[] }).stock : [];
    const gold = s.gold;
    s = ok(s, { type: 'buy', index: 0 }).state;
    expect(s.gold).toBe(gold - Math.ceil(stock[0]!.price / 2));
    expect(s.halfPrice).toBe(0);
    const g2 = s.gold;
    s = ok(s, { type: 'buy', index: 1 }).state;
    expect(s.gold).toBe(g2 - stock[1]!.price);
  });

  it('half price is gone once the week\'s rent is paid', () => {
    let s = day('summer', 2, NIGHT_SHIFT_DAY);
    s = ok({ ...s, halfPrice: 1, orders: [] }, { type: 'endDay' }).state;
    s = ok(s, { type: 'skipReward' }).state;
    while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
    s = ok({ ...s, gold: 999 }, { type: 'leaveMarket' }).state;
    expect(s.halfPrice).toBe(0);
  });

  it('speak in their own words, and say what they pay', () => {
    expect(customerName('rook')).toBe('Rook');
    const order = { request: { kind: 'family', family: 'protection' }, customer: 'rook' } as Pick<Order, 'request' | 'customer'>;
    expect(customerLine(order)).toBe(codex.visitors.get('rook')!.line);
    expect(extraPay('wren-hollis')).toBe('pick 1 of 2 Flower ingredients');
    expect(extraPay('snowbound-traveller')).toBe('pick 1 of 2 Tinctures');
    expect(extraPay('may-herald')).toBeNull();
    expect(orderTerms({ minTier: 'fine', pay: 6, customer: 'toymaker' })).toBe('Fine+ · 6g + +2 Potency');
  });

  it('a run saved before visitors continues with no half-price buys or favours', () => {
    const s = start('old');
    // Saved at version 20, before visitors.
    const old: Record<string, unknown> = { ...s, version: 20 };
    delete old.halfPrice;
    delete old.favours;
    const back = migrateRun(old)!;
    expect(back.halfPrice).toBe(0);
    expect(back.favours).toEqual([]);
  });
});
