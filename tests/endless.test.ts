import { describe, expect, it } from 'vitest';
import { ENDLESS_RENT, ENDLESS_YEAR, endlessOpen, endlessWeeks, migrateProfile, migrateRun, newProfile, newStats, recordRun, rentDue, rentOf, runWeek, WEEKS, type RunState } from '../src/core';
import { no, ok, start } from './helpers';

/** A run that has just won its finale. */
function won(seed = 'endless'): RunState {
  return { ...structuredClone(start(seed)), phase: 'victory', week: WEEKS, day: 7, gold: 300 };
}

describe('Endless', () => {
  it('goes on after a won finale into a fresh month, keeping the deck and gold', () => {
    const s = won();
    const r = ok(s, { type: 'goEndless' });
    expect(r.events[0]).toEqual({ type: 'endlessMonth', month: 1 });
    expect(r.state).toMatchObject({ endless: 1, week: 1, day: 1, phase: 'morning', gold: 300, witch: s.witch });
    expect(r.state.patrons).not.toEqual(s.patrons);
    expect(r.state.calendar).not.toEqual(s.calendar);
    expect(runWeek(r.state)).toBe(WEEKS + 1);
  });

  it('only starts after a won finale', () => {
    expect(no(start('endless'), { type: 'goEndless' })).toMatch(/won finale/);
    expect(no({ ...won(), phase: 'game-over' }, { type: 'goEndless' })).toMatch(/won finale/);
  });

  it('keeps the finale\'s rent, then climbs it week by week', () => {
    const s = ok(won(), { type: 'goEndless' }).state;
    const finale = rentDue(s.season, WEEKS);
    expect(rentOf(s)).toBe(finale);
    expect(rentOf({ ...s, week: 2 })).toBe(Math.round(finale * ENDLESS_RENT));
    expect(rentOf({ ...s, endless: 2, week: 1 })).toBe(Math.round(finale * ENDLESS_RENT ** WEEKS));
    // Outside Endless, rent is the month's as ever.
    expect(rentOf(won())).toBe(finale);
  });

  it('counts the weeks lasted past the finale', () => {
    const s = { week: 3, endless: 1 };
    expect(endlessWeeks({ ...s, phase: 'game-over' as const, lostTo: 'rent' as const })).toBe(2);
    expect(endlessWeeks({ ...s, phase: 'morning' as const })).toBe(2);
    expect(endlessWeeks({ week: 4, endless: 1, phase: 'game-over' as const, lostTo: 'finale' as const })).toBe(4);
    expect(endlessWeeks({ week: 4, endless: 2, phase: 'victory' as const })).toBe(8);
    expect(endlessWeeks({ week: 4, phase: 'victory' as const })).toBe(0);
  });

  it('earns no progression, only a best', () => {
    const win = { seed: 'e1', season: 'summer' as const, phase: 'victory' as const, week: 4, year: 5, stats: { ...newStats(), ordersFilled: 30 } };
    const first = recordRun(newProfile(), win).profile;
    const lost = recordRun(first, { ...win, phase: 'game-over', endless: 2, week: 2, lostTo: 'rent', stats: { ...newStats(), ordersFilled: 90 } });
    expect(lost.reputation).toBe(0);
    expect(lost.almanac).toEqual([]);
    expect(lost.profile).toEqual({ ...first, endlessBest: { weeks: 5, season: 'summer', year: 5 } });
    // A shorter run keeps the best; counting the same run again changes nothing.
    expect(recordRun(lost.profile, { ...win, seed: 'e2', phase: 'game-over', endless: 1, week: 2, lostTo: 'rent' }).profile).toBe(lost.profile);
    expect(recordRun(lost.profile, { ...win, phase: 'game-over', endless: 2, week: 2, lostTo: 'rent' }).profile).toBe(lost.profile);
  });

  it(`opens at Year ${ENDLESS_YEAR}`, () => {
    const years = (n: number) => ({ ...newProfile(), yearSeasons: Array.from({ length: n }, () => ['spring' as const]) });
    expect(endlessOpen(years(ENDLESS_YEAR - 1))).toBe(false);
    expect(endlessOpen(years(ENDLESS_YEAR))).toBe(true);
  });

  it('carries old saves over', () => {
    expect(migrateProfile({ ...newProfile(), version: 13, endlessBest: undefined }).endlessBest).toBeNull();
    expect(migrateProfile({ ...newProfile(), endlessBest: { weeks: 6, season: 'autumn', year: 7 } }).endlessBest).toEqual({ weeks: 6, season: 'autumn', year: 7 });
    expect(migrateProfile({ ...newProfile(), endlessBest: { weeks: 'x' } }).endlessBest).toBeNull();
    const old: Partial<RunState> = { ...start('old'), version: 22 as never };
    delete old.endless;
    expect(migrateRun(old)?.endless).toBe(0);
  });
});
