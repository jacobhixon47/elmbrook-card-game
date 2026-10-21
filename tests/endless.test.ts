import { describe, expect, it } from 'vitest';
import { ENDLESS_RENT, endlessOpen, endlessWeeks, FINALE_ORDERS, migrateProfile, migrateRun, NIGHT_SHIFT_DAY, newProfile, newStats, recordRun, reduce, rentDue, rentOf, runWeek, WEEKS, type RunState } from '../src/core';
import { ok, start } from './helpers';

/** A new Endless run, from the cottage's door in Endless mode. */
function endless(seed = 'endless', extra: { year?: number; boon?: string; mutations?: string[] } = {}): RunState {
  return reduce(null, { type: 'startRun', seed, witch: 'hedge-witch', season: 'summer', endless: true, ...extra }).state;
}

/** At this week's Night Market, with the gold to pay and (in week 4) the Moonless Patron served. */
function atMarket(s0: RunState, week: number): RunState {
  let s = ok(s0, { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  s = ok(ok(ok(s, { type: 'openShop' }).state, { type: 'endDay' }).state, { type: 'skipReward' }).state;
  while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
  const patron = s.patrons[week - 1]!;
  const served = Array.from({ length: FINALE_ORDERS }, () => ({ ...s.orders[0]!, customer: patron, status: 'filled' as const }));
  return { ...s, gold: 10000, orders: [...s.orders, ...served] };
}

describe('Endless', () => {
  it('starts as its own mode, by Year 1 rules without a boon or mutation', () => {
    const s = endless('e', { year: 4, boon: 'winter-savings', mutations: ['lean-times'] });
    expect(s.mutations).toEqual([]);
    expect(s).toMatchObject({ endlessMode: true, endless: 0, year: 1, week: 1 });
    expect(s.gold).toBe(endless('e').gold);
    expect(start('e').endlessMode).toBe(false);
  });

  it('rolls into a fresh month at the finale instead of winning, keeping the deck and gold', () => {
    const s = atMarket(endless(), WEEKS);
    const r = ok(s, { type: 'leaveMarket' });
    expect(r.events.some((e) => e.type === 'runWon')).toBe(false);
    expect(r.events).toContainEqual({ type: 'endlessMonth', month: 2 });
    expect(r.state).toMatchObject({ endless: 1, week: 1, day: 1, phase: 'morning', witch: s.witch });
    expect(r.state.gold).toBe(s.gold - rentOf(s));
    expect(r.state.calendar).not.toEqual(s.calendar);
    expect(runWeek(r.state)).toBe(WEEKS + 1);
    // A story run still wins there.
    expect(ok(atMarket(start('story', 'summer'), WEEKS), { type: 'leaveMarket' }).state.phase).toBe('victory');
  });

  it('keeps the first month\'s rents, then climbs from the finale\'s week by week', () => {
    const s = endless();
    const finale = rentDue(s.season, WEEKS);
    expect(rentOf({ ...s, week: 2 })).toBe(rentDue(s.season, 2));
    expect(rentOf({ ...s, endless: 1, week: 1 })).toBe(finale);
    expect(rentOf({ ...s, endless: 1, week: 2 })).toBe(Math.round(finale * ENDLESS_RENT));
    expect(rentOf({ ...s, endless: 2, week: 1 })).toBe(Math.round(finale * ENDLESS_RENT ** WEEKS));
  });

  it('counts the weeks lasted: each rent paid', () => {
    expect(endlessWeeks({ week: 3, endless: 0, phase: 'game-over', lostTo: 'rent' })).toBe(2);
    expect(endlessWeeks({ week: 3, endless: 1, phase: 'morning' })).toBe(WEEKS + 2);
    expect(endlessWeeks({ week: 4, endless: 1, phase: 'game-over', lostTo: 'finale' })).toBe(WEEKS * 2);
  });

  it('earns no progression, only a best', () => {
    const run = { seed: 'e1', season: 'summer' as const, week: 2, endless: 2, endlessMode: true, stats: { ...newStats(), ordersFilled: 90 } };
    const p = newProfile();
    const lost = recordRun(p, { ...run, phase: 'game-over', lostTo: 'rent' });
    expect(lost.reputation).toBe(0);
    expect(lost.almanac).toEqual([]);
    expect(lost.profile).toEqual({ ...p, endlessBest: { weeks: 9, season: 'summer' } });
    // A shorter run keeps the best; a run still going changes nothing.
    expect(recordRun(lost.profile, { ...run, seed: 'e2', endless: 0, phase: 'game-over', lostTo: 'rent' }).profile).toBe(lost.profile);
    expect(recordRun(p, { ...run, phase: 'morning' }).profile).toBe(p);
  });

  it('opens once the tutorial is done', () => {
    expect(endlessOpen(newProfile())).toBe(false);
    expect(endlessOpen({ ...newProfile(), tutorialDone: true })).toBe(true);
  });

  it('carries old saves over', () => {
    expect(migrateProfile({ ...newProfile(), version: 13, endlessBest: undefined }).endlessBest).toBeNull();
    expect(migrateProfile({ ...newProfile(), endlessBest: { weeks: 6, season: 'autumn', year: 7 } }).endlessBest).toEqual({ weeks: 6, season: 'autumn' });
    expect(migrateProfile({ ...newProfile(), endlessBest: { weeks: 'x' } }).endlessBest).toBeNull();
    const old: Partial<RunState> = { ...start('old'), version: 22 as never };
    delete old.endless;
    delete old.endlessMode;
    expect(migrateRun(old)).toMatchObject({ endless: 0, endlessMode: false });
  });
});
