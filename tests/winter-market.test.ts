import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, fencePrice, HOLLY_CROWN, LANTERN_STOCK, WINTER_LANTERN, MIN_DECK, NIGHT_SHIFT_DAY, snowedIn, WINTER_FENCE, YULE_LOG,
  type Potion, type RunState, type Season, type StallId, type StallState,
} from '../src/core';
import { calendarWeeks, dayRules } from '../src/view/calendar';
import { no, ok, start } from './helpers';

// Winter at the Night Market (decided with Jacob, Oct 14): the Hearth Trader every night, Snowed In
// nights, the Yule Log and the Holly Crown, a Fence that wants warmth, and a Frost familiar from the Tinker.

function market(season: Season, week: number, seed = 'winter', gold?: number): RunState {
  let s = start(seed, season);
  s = ok(s, { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  s = ok(ok(ok(s, { type: 'openShop' }).state, { type: 'endDay' }).state, { type: 'skipReward' }).state;
  while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
  return gold === undefined ? s : { ...s, gold };
}
const stalls = (s: RunState): StallState[] => (s.offer?.kind === 'night-market' ? s.offer.stalls : []);
const ids = (s: RunState) => stalls(s).map((x) => x.id);
const at = <K extends StallId>(s: RunState, id: K) => stalls(s).find((x) => x.id === id) as StallState & { id: K };
const visit = (s: RunState, id: StallId) => ok(s, { type: 'visitStall', index: ids(s).indexOf(id) }).state;

/** Seeds whose week-1 Night Shift is (or isn't) Snowed In. */
function seedWhere(buried: boolean): string {
  for (let i = 0; i < 400; i++) {
    const seed = `snow-${i}`;
    const s = start(seed, 'winter');
    const snowy = s.calendar.weather[0]![NIGHT_SHIFT_DAY - 1] === 'snow';
    if (snowy && snowedIn(s, 1) === buried) return seed;
  }
  throw new Error('no seed');
}

describe('Snowed In', () => {
  it('buries a snowy quarter-moon Winter night about half the time, and only the Hearth Trader opens', () => {
    const buried = market('winter', 1, seedWhere(true));
    expect(ids(buried)).toEqual(['hearth-trader']);
    const open = market('winter', 1, seedWhere(false));
    expect(ids(open)).toEqual(expect.arrayContaining(['lantern-seller', 'fence', 'hearth-trader']));
    let n = 0;
    let snowy = 0;
    for (let i = 0; i < 400; i++) {
      const s = start(`count-${i}`, 'winter');
      if (s.calendar.weather[0]![NIGHT_SHIFT_DAY - 1] !== 'snow') continue;
      snowy++;
      if (snowedIn(s, 1)) n++;
    }
    expect(n / snowy).toBeGreaterThan(0.35);
    expect(n / snowy).toBeLessThan(0.65);
  });

  it('never in other seasons, without snow, or on the full and new moon', () => {
    const s = start(seedWhere(true), 'winter');
    const snowEverywhere = { ...s, calendar: { ...s.calendar, weather: s.calendar.weather.map((w) => w.map(() => 'snow' as const)) } };
    expect(snowedIn({ ...snowEverywhere, season: 'autumn' }, 1)).toBe(false);
    expect(snowedIn({ ...s, calendar: { ...s.calendar, weather: s.calendar.weather.map((w) => w.map(() => 'clear' as const)) } }, 1)).toBe(false);
    expect(snowedIn(snowEverywhere, 2)).toBe(false);
    expect(snowedIn(snowEverywhere, 4)).toBe(false);
  });

  it('shows on the Calendar in advance', () => {
    const s = start(seedWhere(true), 'winter');
    expect(calendarWeeks(s)[0]!.cells[NIGHT_SHIFT_DAY - 1]!.marks).toContain('Snowed In');
    expect(dayRules(s, { week: 1, day: NIGHT_SHIFT_DAY, weather: 'snow' }).join(' ')).toMatch(/only the Hearth Trader/);
  });
});

describe('the Hearth Trader in Winter', () => {
  it('opens every Winter night, quarter moons included', () => {
    for (const seed of ['a', 'b', 'c', 'd']) expect(ids(market('winter', 3, seed))).toContain('hearth-trader');
  });

  it('burns one or two cards on the Yule Log for 4 gold, once a night', () => {
    const s = visit(market('winter', 2, 'yule', 10), 'hearth-trader');
    const deck = allCards(s);
    expect(no(s, { type: 'burnYule', uids: [] })).toMatch(/burn 1 or 2/);
    expect(no(s, { type: 'burnYule', uids: deck.slice(0, 3).map((c) => c.uid) })).toMatch(/burn 1 or 2/);
    expect(no({ ...s, gold: 3 }, { type: 'burnYule', uids: [deck[0]!.uid] })).toMatch(/gold/);
    const burned = ok(s, { type: 'burnYule', uids: deck.slice(0, 2).map((c) => c.uid) }).state;
    expect(allCards(burned)).toHaveLength(deck.length - 2);
    expect(burned.gold).toBe(10 - YULE_LOG.price);
    expect(no(burned, { type: 'burnYule', uids: [allCards(burned)[0]!.uid] })).toMatch(/once/);
    const small = { ...s, drawPile: s.drawPile.slice(0, MIN_DECK - s.hand.length - s.discardPile.length) };
    expect(no(small, { type: 'burnYule', uids: [allCards(small)[0]!.uid] })).toMatch(/below 8/);
  });

  it('sells a Frost familiar under the Holly Crown for 8 gold, once a night', () => {
    const s = visit(market('winter', 2, 'crown', 20), 'hearth-trader');
    expect(at(s, 'hearth-trader').crown).toEqual(HOLLY_CROWN.familiars);
    expect(no({ ...s, gold: 7 }, { type: 'wearCrown', index: 0 })).toMatch(/gold/);
    const r = ok(s, { type: 'wearCrown', index: 1 }).state;
    expect(r.familiars).toContain('ermine');
    expect(r.gold).toBe(20 - HOLLY_CROWN.price);
    expect(no(r, { type: 'wearCrown', index: 0 })).toMatch(/no familiar/);
    const owned = visit({ ...market('winter', 2, 'crown', 20) }, 'hearth-trader');
    expect(at(owned, 'hearth-trader').crown).toHaveLength(2);
  });

  it('the Ermine never turns up outside Winter\'s trades', () => {
    expect(codex.familiars.get('ermine')!.pool).toBe('event');
  });
});

describe('Winter\'s Lantern Seller', () => {
  it('is low on Lunar stock and keeps a Yule Candle by the Omens', () => {
    const stock = at(market('winter', 2), 'lantern-seller').stock;
    expect(stock.map((i) => (i.kind === 'card' ? i.card : ''))).toHaveLength(WINTER_LANTERN.lunar + LANTERN_STOCK.omens + 1);
    expect(stock.at(-1)).toMatchObject({ kind: 'card', card: 'yule-candle', price: LANTERN_STOCK.omenPrice });
    expect(at(market('autumn', 2), 'lantern-seller').stock.some((i) => i.kind === 'card' && i.card === 'yule-candle')).toBe(false);
  });
});

describe('Winter\'s Fence and Tinker', () => {
  const potion = (family: Potion['family']): Potion => ({ uid: 1, recipe: 'x', family, quality: 50, tier: 'masterwork', ingredients: [], experiment: false, heartDelta: 0 });

  it('pays half again for Warming potions in Winter, and a little less for the rest', () => {
    const base = fencePrice(potion('warming'));
    expect(fencePrice(potion('warming'), { season: 'winter' })).toBe(Math.round(base * WINTER_FENCE.warming));
    expect(fencePrice(potion('healing'), { season: 'winter' })).toBe(Math.round(base * WINTER_FENCE.other));
    expect(fencePrice(potion('healing'), { season: 'autumn' })).toBe(base);
  });

  it('the full-moon Tinker carries a Frost familiar in Winter', () => {
    const tinker = at(market('winter', 2), 'wandering-tinker');
    expect(tinker.stock.some((i) => i.kind === 'familiar' && HOLLY_CROWN.familiars.includes(i.familiar))).toBe(true);
    const summer = at(market('summer', 2), 'wandering-tinker');
    expect(summer.stock.filter((i) => i.kind === 'familiar')).toHaveLength(1);
  });
});
