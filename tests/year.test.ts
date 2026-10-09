import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  DISCARDS_PER_DAY, LOOP_ALMANAC, loopOpen, loopYear, MAX_YEAR, migrateProfile, migrateRun, newProfile, newRun, NIGHT_SHIFT_DAY, patronKnown, pickBoon, recordRun,
  rentOf, reputationFor, reputationMult, rollBoons, RUN_VERSION, START_GOLD, SHELF_SLOTS, FAMILIAR_SLOTS, newStats, yearModifiers, YEAR_RULES,
} from '../src/core';
import { calendarWeeks, dayRules } from '../src/view/calendar';
import { brewing } from './helpers';

const winterWin = (seed: string) => ({ seed, season: 'winter' as const, phase: 'victory' as const, week: 4, stats: newStats() });

describe('Year modifiers', () => {
  it('stack: each Year carries every modifier up to it', () => {
    expect(yearModifiers(1)).toEqual([]);
    expect(yearModifiers(3).map((m) => m.year)).toEqual([2, 3]);
    expect(yearModifiers(MAX_YEAR)).toHaveLength(MAX_YEAR - 1);
  });

  it('Year 3 raises rent, Year 4 lowers pay, Year 5 takes a Discard', () => {
    const y1 = newRun('year', 'hedge-witch').state;
    const y5 = newRun('year', 'hedge-witch', 'spring', [], [], 5).state;
    expect(y5.year).toBe(5);
    expect(rentOf({ ...y1, week: 2 })).toBeLessThan(rentOf({ ...y5, week: 2 }));
    expect(rentOf({ ...y1, week: 2, year: 3 })).toBe(Math.round(rentOf({ ...y1, week: 2 }) * YEAR_RULES.rentMult));
    expect(y5.discardsLeft).toBe(y1.discardsLeft - YEAR_RULES.discards);
    expect(y1.discardsLeft).toBeLessThanOrEqual(DISCARDS_PER_DAY + 1);
    const pay = (s: typeof y1) => s.orders.reduce((n, o) => n + o.pay, 0);
    const y4 = newRun('year', 'hedge-witch', 'spring', [], [], 4).state;
    expect(pay(y4)).toBeLessThan(pay(y1));
  });

  it('from Year 2 a patron is hidden until the day before their Night Shift', () => {
    const s = { ...brewing('patron'), year: 2 };
    expect(patronKnown({ ...s, week: 1, day: 1 }, 1)).toBe(false);
    expect(patronKnown({ ...s, week: 1, day: NIGHT_SHIFT_DAY - 1 }, 1)).toBe(true);
    expect(patronKnown({ ...s, week: 2, day: 1 }, 1)).toBe(true);
    expect(patronKnown({ ...s, year: 1, week: 1, day: 1 }, 3)).toBe(true);
    const hidden = calendarWeeks({ ...s, week: 1, day: 1 }).flatMap((w) => w.cells.flatMap((c) => c.marks));
    expect(hidden.filter((m) => m === 'A patron')).toHaveLength(4);
    expect(dayRules({ ...s, week: 1, day: 1 }, { week: 1, day: NIGHT_SHIFT_DAY, weather: 'clear' })[0]).toMatch(/^A patron/);
  });

  it('later Years earn more Reputation', () => {
    expect(reputationMult(1)).toBe(1);
    expect(reputationMult(2)).toBe(1.5);
    expect(reputationMult(3)).toBe(2);
    const stats = { ...newStats(), ordersFilled: 10 };
    expect(reputationFor({ phase: 'game-over', week: 3, stats, year: 3 })).toBe(2 * reputationFor({ phase: 'game-over', week: 3, stats }));
  });
});

describe('boons', () => {
  it('each changes how every run that Year starts', () => {
    const plain = newRun('boon', 'hedge-witch').state;
    const run = (boon: string) => newRun('boon', 'hedge-witch', 'spring', [], [], 2, boon).state;
    expect(run('winter-savings').gold).toBe(START_GOLD + 15);
    expect(run('tall-shelf').shelfSize).toBe(SHELF_SLOTS + 1);
    expect(run('another-perch').familiarSlots).toBe(FAMILIAR_SLOTS + 1);
    const lucky = run('lucky-find');
    expect(lucky.relics).toHaveLength(1);
    expect(codex.relics.get(lucky.relics[0]!)!.tier).toBe(1);
    const blessed = run('blessed-start');
    expect([...blessed.drawPile, ...blessed.hand].filter((c) => c.modifier === 'blessed')).toHaveLength(1);
    expect(plain.relics).toEqual([]);
    expect(() => run('nope')).toThrow(/unknown boon/);
  });
});

describe('looping the Year', () => {
  it('Year 1 always ends; the loop opens from the second Year won, or a quarter of the Almanac', () => {
    const first = recordRun(newProfile(), winterWin('w1'));
    expect(first).toMatchObject({ yearDone: true, canLoop: false, profile: { years: 1, year: 1 } });
    const second = recordRun(first.profile, winterWin('w2'));
    expect(second).toMatchObject({ yearDone: true, canLoop: true, profile: { years: 2 } });
    const almanac = [...codex.almanac.keys()].slice(0, LOOP_ALMANAC);
    expect(recordRun({ ...newProfile(), almanac }, winterWin('w3')).canLoop).toBe(true);
    expect(loopOpen({ years: 9, year: MAX_YEAR, almanac })).toBe(false);
  });

  it('a loop goes back to Spring in the next Year, with three boons to choose from', () => {
    const p = { ...newProfile(), years: 2, seasons: ['spring', 'summer', 'autumn', 'winter'] as ('spring' | 'summer' | 'autumn' | 'winter')[] };
    const looped = loopYear(p);
    expect(looped).toMatchObject({ year: 2, seasons: ['spring'], boon: null });
    expect(looped.boonOffer).toHaveLength(3);
    expect(looped.boonOffer).toEqual(rollBoons(2, 2));
    const picked = pickBoon(looped, looped.boonOffer![0]!);
    expect(picked).toMatchObject({ boon: looped.boonOffer![0], boonOffer: null });
    expect(() => pickBoon(picked, 'tall-shelf')).toThrow(/not on offer/);
    expect(() => loopYear(newProfile())).toThrow(/not open/);
  });

  it('the profile and saved runs migrate to Year 1', () => {
    expect(migrateProfile({ version: 4, tutorialDone: true })).toMatchObject({ year: 1, boon: null, boonOffer: null });
    expect(migrateProfile({ ...newProfile(), year: 99, boon: 'nope', boonOffer: ['tall-shelf', 7] })).toMatchObject({ year: MAX_YEAR, boon: null, boonOffer: null });
    const old: Record<string, unknown> = { ...brewing('migrate'), version: 13 };
    delete old.year;
    expect(migrateRun(old)).toMatchObject({ version: RUN_VERSION, year: 1 });
  });
});
