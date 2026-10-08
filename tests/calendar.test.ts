import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  activeEvents, FESTIVAL_DAY, FESTIVAL_WEEK, HARVEST_FAIR, matchRecipe, NIGHT_SHIFT_DAY, payout, previewBrew, recipeAvailable, rollCalendar,
  SEASON_WEATHER, SEASONS, weatherPotency, WEEKS, type Calendar, type Order, type RunState, type Season, type Weather,
} from '../src/core';
import { dayPool } from '../src/core/dusk';
import { no, ofType, ok, slotAll, start, withHand } from './helpers';

/** Every day of the month has this weather (and this sky event). */
const sky = (weather: Weather, skyDate: Calendar['sky'] = null): Calendar => ({
  weather: Array.from({ length: WEEKS }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => weather)),
  sky: skyDate,
});

/** A run jumped to this day under this Calendar, with the shop open. */
function on(calendar: Calendar, week = 1, day = 1, season: Season = 'spring'): RunState {
  const s = { ...start('calendar', season), calendar };
  const r = ok(s, { type: 'debug', op: 'jumpToDay', week, day }).state;
  return ok(r, { type: 'openShop' }).state;
}

describe('rolling the Calendar', () => {
  it('is the same for the same seed and only uses the season’s weather', () => {
    expect(rollCalendar('a', 'spring', WEEKS)).toEqual(rollCalendar('a', 'spring', WEEKS));
    for (const season of SEASONS) {
      for (let i = 0; i < 30; i++) {
        const c = rollCalendar(`s${i}`, season, WEEKS);
        expect(c.weather).toHaveLength(WEEKS);
        for (const week of c.weather) {
          expect(week).toHaveLength(NIGHT_SHIFT_DAY);
          for (const w of week) expect(SEASON_WEATHER[season]).toContain(w);
        }
      }
    }
  });

  it('rolls at most one sky event, on a valid date, in about one run in eight', () => {
    let count = 0;
    for (let i = 0; i < 2000; i++) {
      const { sky: e } = rollCalendar(`run-${i}`, 'spring', WEEKS);
      if (!e) continue;
      count++;
      if (e.event === 'eclipse') {
        expect(e.week).toBeGreaterThanOrEqual(2);
        expect(e.day).toBeGreaterThanOrEqual(1);
        expect(e.day).toBeLessThan(NIGHT_SHIFT_DAY);
      } else {
        expect([2, 3]).toContain(e.week);
        expect(e.day).toBeNull();
      }
    }
    expect(count / 2000).toBeGreaterThan(0.08);
    expect(count / 2000).toBeLessThan(0.16);
  });

  it('does not change the deck a seed deals', () => {
    const s = start('same-deal');
    const other = { ...s, calendar: sky('clear') };
    expect(ok(other, { type: 'openShop' }).state.hand).toEqual(ok(s, { type: 'openShop' }).state.hand);
  });
});

describe('weather', () => {
  it('Rain gives Creek ingredients +2 Potency and posts one fewer order', () => {
    const creek = codex.ingredients.get('creekwater')!;
    expect(weatherPotency(creek, 'rain')).toBe(2);
    expect(weatherPotency(codex.ingredients.get('elmroot')!, 'rain')).toBe(0);
    const [s0, uids] = withHand(on(sky('rain')), ['elmroot', 'creekwater']);
    const p = previewBrew(slotAll(s0, uids), slotAll(s0, uids).cauldron, []);
    const [c0, cu] = withHand(on(sky('clear')), ['elmroot', 'creekwater']);
    const q = previewBrew(slotAll(c0, cu), slotAll(c0, cu).cauldron, []);
    if (p.kind !== 'potion' || q.kind !== 'potion') throw new Error('expected potions');
    expect(p.potency).toBe(q.potency + 2);
    expect(p.steps.find((x) => x.source === 'weather')?.note).toBe('+2 Potency');
    for (let w = 1; w <= WEEKS; w++) {
      const clear = on(sky('clear'), w).orders.length;
      // Only a busy day (3+ orders) loses one.
      expect(on(sky('rain'), w).orders.length).toBe(clear >= 3 ? clear - 1 : clear);
    }
    expect(on(sky('rain'), WEEKS).orders.length).toBe(on(sky('clear'), WEEKS).orders.length - 1);
  });

  it('a Heatwave helps Ember and wilts Tide, never below 0', () => {
    expect(weatherPotency(codex.ingredients.get('emberbloom')!, 'heatwave')).toBe(2);
    expect(weatherPotency(codex.ingredients.get('creekwater')!, 'heatwave')).toBe(-2);
    expect(weatherPotency(codex.ingredients.get('honeycomb')!, 'heatwave')).toBe(2); // Vital, Ember
    const tide = [...codex.ingredients.values()].find((i) => i.essences.includes('tide') && !i.essences.includes('ember') && i.potency < 2);
    if (tide) expect(weatherPotency(tide, 'heatwave')).toBe(-tide.potency);
  });

  it('Fog hides the orders until the first brew or Discard', () => {
    const s = on(sky('fog'));
    expect(s.fog).toBe(true);
    expect(no(s, { type: 'brew', deliverTo: s.orders[0]!.id })).toMatch(/fog/);
    const lifted = ok(s, { type: 'discard', uids: [s.hand[0]!.uid] });
    expect(lifted.state.fog).toBe(false);
    expect(ofType(lifted.events, 'fogLifted')).toHaveLength(1);
    const potion = { uid: 700, recipe: 'healing-draught', family: 'healing' as const, quality: 14, tier: 'fine' as const, ingredients: [], experiment: false, heartDelta: 0 };
    expect(no({ ...s, shelf: [potion] }, { type: 'deliver', order: s.orders[0]!.id, potion: 700 })).toMatch(/fog/);
    // Never on a Night Shift.
    expect(on(sky('fog'), 1, NIGHT_SHIFT_DAY).fog).toBe(false);
  });

  it('Snow puts Frost cards on top of the deck', () => {
    let s = { ...start('snowy', 'winter'), calendar: sky('snow') };
    s = { ...s, discardPile: [{ uid: 990, card: 'ice-lily' }, { uid: 991, card: 'rime-blossom' }] };
    const r = ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state;
    expect(r.drawPile.slice(0, 2).map((c) => c.uid).sort()).toEqual([990, 991]);
  });
});

describe('festivals', () => {
  const potion = (ingredients: string[]) => ({ tier: 'fine' as const, ingredients });

  it('Bloomtide doubles pay for potions with a Flower ingredient', () => {
    const s = on(sky('clear'), FESTIVAL_WEEK, FESTIVAL_DAY, 'spring');
    expect(s.orders.every((o) => o.tagBonus?.tag === 'flower')).toBe(true);
    const o = s.orders[0]!;
    const plain = payout(potion(['elmroot', 'creekwater']), { ...o, minTier: 'fine' });
    const flower = payout(potion(['thistledown', 'creekwater']), { ...o, minTier: 'fine' });
    expect(flower.pay).toBe(plain.pay * 2);
    expect(on(sky('clear'), FESTIVAL_WEEK, FESTIVAL_DAY - 1, 'spring').orders.every((x) => x.tagBonus === null)).toBe(true);
  });

  it('Harvest Fair orders want two potions and pay on the second', () => {
    const s = on(sky('clear'), FESTIVAL_WEEK, FESTIVAL_DAY, 'autumn');
    expect(s.orders.every((o) => o.quantity === HARVEST_FAIR.quantity)).toBe(true);
    const order: Order = { ...s.orders[0]!, request: { kind: 'family', family: 'healing' }, minTier: 'fine' };
    const p = (uid: number) => ({ uid, recipe: 'healing-draught', family: 'healing' as const, quality: 14, tier: 'fine' as const, ingredients: ['elmroot'], experiment: false, heartDelta: 0 });
    let r = ok({ ...s, orders: [order], shelf: [p(701), p(702)] }, { type: 'deliver', order: order.id, potion: 701 });
    expect(ofType(r.events, 'orderProgress')[0]).toMatchObject({ delivered: 1, quantity: 2 });
    expect(r.state.gold).toBe(s.gold);
    r = ok(r.state, { type: 'deliver', order: order.id, potion: 702 });
    expect(r.state.orders[0]!.status).toBe('filled');
    expect(r.state.gold).toBeGreaterThan(s.gold);
  });

  it('Longest Night gives the festival week’s Night Shift more Brews, Discards and orders', () => {
    const winter = on(sky('clear'), FESTIVAL_WEEK, NIGHT_SHIFT_DAY, 'winter');
    const other = on(sky('clear'), FESTIVAL_WEEK - 1, NIGHT_SHIFT_DAY, 'winter');
    expect(winter.brewsLeft).toBe(other.brewsLeft + 2);
    expect(winter.discardsLeft).toBe(other.discardsLeft + 1);
  });
});

describe('sky events', () => {
  const eclipse = sky('clear', { event: 'eclipse', week: 2, day: 3 });

  it('Eclipse recipes brew only on the Eclipse', () => {
    const corona = codex.recipes.get('corona-draught')!;
    const access = { knownRecipes: [], unlocks: [], calendar: eclipse };
    expect(recipeAvailable(corona, { ...access, week: 2, day: 3 })).toBe(true);
    expect(recipeAvailable(corona, { ...access, week: 2, day: 2 })).toBe(false);
    expect(recipeAvailable(corona, { knownRecipes: ['corona-draught'], unlocks: [], calendar: eclipse, week: 3, day: 3 })).toBe(false);
    expect(activeEvents({ calendar: eclipse, week: 2, day: 3 })).toEqual(['eclipse']);
    const single = (e: string) => [...codex.ingredients.values()].find((i) => i.essences.length === 1 && i.essences[0] === e && !i.effects.includes('wild-essence'))!;
    const cards = ['lunar', 'ember', 'vital'].map(single);
    expect(matchRecipe(cards, { ...access, week: 2, day: 3 })?.id).toBe('corona-draught');
  });

  it('a Meteor Shower adds Fallen Star to rewards and the Forage for its week', () => {
    const shower = sky('clear', { event: 'meteor-shower', week: 2, day: null });
    const pool = (week: number) => dayPool({ unlocks: [], season: 'spring', calendar: shower, week, day: 1 }).map((c) => c.id);
    expect(pool(2)).toContain('fallen-star');
    expect(pool(3)).not.toContain('fallen-star');
  });
});

describe('Calendar view', () => {
  it('lays out the month and marks today', async () => {
    const { calendarWeeks, todayLine, todayRules, dayRules } = await import('../src/view/calendar');
    const s = { ...on(sky('rain', { event: 'eclipse', week: 1, day: 1 })) };
    const weeks = calendarWeeks(s);
    expect(weeks).toHaveLength(WEEKS);
    expect(weeks[1]!.moon).toBe('Full Moon');
    expect(weeks[0]!.cells[0]).toMatchObject({ mark: 'now', weather: 'rain', marks: ['Eclipse'] });
    expect(weeks[0]!.cells[1]!.mark).toBe('next');
    expect(todayLine(s)).toBe('Rain: Creek cards +2 · Eclipse');
    expect(todayRules(s)).toHaveLength(2);
    const autumn = on(sky('fog'), FESTIVAL_WEEK, FESTIVAL_DAY, 'autumn');
    expect(todayLine(autumn)).toMatch(/Harvest Fair/);
    const winter = { ...start('w', 'winter'), calendar: sky('fog') };
    expect(dayRules(winter, { week: FESTIVAL_WEEK, day: NIGHT_SHIFT_DAY, weather: 'fog' })).toEqual([
      'Fog: it never hides a Night Shift\'s orders.', expect.stringMatching(/^Longest Night/),
    ]);
  });
});

it('order text shows how many potions and a festival pay bonus', async () => {
  const { orderTerms, requestText } = await import('../src/view/describe');
  const o = { request: { kind: 'family' as const, family: 'healing' as const }, quantity: 2, delivered: 1, minTier: 'fine' as const, pay: 20, tagBonus: { tag: 'flower', mult: 2 } };
  expect(requestText(o)).toBe('2× any Healing potion (1/2)');
  expect(requestText({ ...o, quantity: 1 })).toBe('any Healing potion');
  expect(orderTerms(o)).toBe('Fine+ · 20g · ×2 Flower');
});
