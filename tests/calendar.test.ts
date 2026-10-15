import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  activeEvents, FESTIVAL_DAY, FESTIVAL_WEEK, matchRecipe, NIGHT_SHIFT_DAY, previewBrew, recipeAvailable, rollCalendar,
  SEASON_WEATHER, SEASONS, weatherPotency, WEEKS, type Calendar, type RunState, type Season, type Weather,
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
  it('Rain gives Creek and Tide ingredients +2 Potency and posts one fewer order', () => {
    const creek = codex.ingredients.get('creekwater')!;
    expect(weatherPotency(creek, 'rain')).toBe(2); // Creek and Tide: still +2, once per card
    expect(weatherPotency(codex.ingredients.get('river-clay')!, 'rain')).toBe(2); // Creek, Stone
    expect(weatherPotency(codex.ingredients.get('lavender')!, 'rain')).toBe(2); // Garden, Tide
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

  it('a Heatwave helps Ember and weakens nothing', () => {
    expect(weatherPotency(codex.ingredients.get('emberbloom')!, 'heatwave')).toBe(2);
    expect(weatherPotency(codex.ingredients.get('honeycomb')!, 'heatwave')).toBe(2); // Vital, Ember
    expect(weatherPotency(codex.ingredients.get('creekwater')!, 'heatwave')).toBe(0);
    // Weather only boosts.
    for (const w of ['clear', 'rain', 'fog', 'heatwave', 'snow'] as const) {
      for (const i of codex.ingredients.values()) expect(weatherPotency(i, w)).toBeGreaterThanOrEqual(0);
    }
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
    s = { ...s, discardPile: [{ uid: 990, card: 'ice-lily' }, { uid: 991, card: 'frostcap' }] };
    const r = ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state;
    expect(r.drawPile.slice(0, 2).map((c) => c.uid).sort()).toEqual([990, 991]);
  });
});

describe('festivals', () => {
  it('festival day plays like any other day: the old pay and order rules are gone', () => {
    for (const season of SEASONS) {
      const s = on(sky('clear'), FESTIVAL_WEEK, FESTIVAL_DAY, season);
      expect(s.orders.every((o) => o.tagBonus === null && o.quantity === 1)).toBe(true);
    }
    const winter = on(sky('clear'), FESTIVAL_WEEK, NIGHT_SHIFT_DAY, 'winter');
    const other = on(sky('clear'), FESTIVAL_WEEK - 1, NIGHT_SHIFT_DAY, 'winter');
    expect([winter.brewsLeft, winter.discardsLeft]).toEqual([other.brewsLeft, other.discardsLeft]);
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
    // No plain single-essence Lunar card is in the codex since Dusk Shard was cut, so the tests make one.
    const single = (e: string) => [...codex.ingredients.values()].find((i) => i.essences.length === 1 && i.essences[0] === e && !i.effects.includes('wild-essence'))
      ?? { ...codex.ingredients.get('starlit-dew')!, essences: [e as 'lunar'] };
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
    expect(todayLine(s)).toBe('Raining: Creek, Tide +2 · Eclipse');
    expect(todayRules(s)).toHaveLength(2);
    const spring = on(sky('fog'), FESTIVAL_WEEK, FESTIVAL_DAY, 'spring');
    expect(todayLine(spring)).toMatch(/Bloomtide/);
    expect(todayLine(on(sky('fog'), FESTIVAL_WEEK, FESTIVAL_DAY, 'autumn'))).toMatch(/Harvest Fair/);
    // Winter's vigil isn't built yet, so its festival day marks nothing.
    expect(todayLine(on(sky('fog'), FESTIVAL_WEEK, FESTIVAL_DAY, 'winter'))).not.toMatch(/Longest/);
    const winter = { ...start('w', 'winter'), calendar: sky('fog') };
    const patron = codex.patrons.get(winter.patrons[FESTIVAL_WEEK - 1]!)!;
    expect(dayRules(winter, { week: FESTIVAL_WEEK, day: NIGHT_SHIFT_DAY, weather: 'fog' })).toEqual([
      `${patron.name}: ${patron.text}`, 'Fog: it never hides a Night Shift\'s orders.',
    ]);
    // Each Night cell names its patron; the HUD line leads with tonight's.
    expect(calendarWeeks(winter).map((w) => w.cells[NIGHT_SHIFT_DAY - 1]!.marks[0])).toEqual(winter.patrons.map((id) => codex.patrons.get(id)!.name.replace(/^The /, '')));
    expect(todayLine({ ...winter, day: NIGHT_SHIFT_DAY })).toMatch(new RegExp(`^${codex.patrons.get(winter.patrons[0]!)!.name} · `));
    // Fortune Tent twists show on their week's days, but not on its Night Shift; The Moon's fog is already the weather.
    const told = { ...winter, fortunes: [{ week: 2, card: 'the-hermit' }, { week: 2, card: 'the-moon' }] };
    expect(dayRules(told, { week: 2, day: 1, weather: 'fog' }).at(-1)).toBe('The Hermit: one order fewer each day, each paying +50%.');
    expect(dayRules(told, { week: 2, day: 1, weather: 'fog' }).some((r) => r.startsWith('The Moon'))).toBe(false);
    expect(dayRules(told, { week: 3, day: 1, weather: 'clear' }).some((r) => r.startsWith('The Hermit'))).toBe(false);
    expect(dayRules(told, { week: 2, day: NIGHT_SHIFT_DAY, weather: 'clear' }).some((r) => r.startsWith('The Hermit'))).toBe(false);
  });
});

it('order text shows how many potions and a festival pay bonus', async () => {
  const { orderTerms, requestText } = await import('../src/view/describe');
  const o = { request: { kind: 'family' as const, family: 'healing' as const }, quantity: 2, delivered: 1, minTier: 'fine' as const, pay: 20, tagBonus: { tag: 'flower', mult: 2 } };
  expect(requestText(o)).toBe('2× any Healing potion (1/2)');
  expect(requestText({ ...o, quantity: 1 })).toBe('any Healing potion');
  expect(orderTerms(o)).toBe('Fine+ · 20g · ×2 Flower');
});
