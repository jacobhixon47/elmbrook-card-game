import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allCards, buyPerk, migrateProfile, newRun, SHELF_SLOTS, START_GOLD, FAMILIAR_SLOTS, migrateRun, newProfile, nextSeason, perkBlocked, PROFILE_VERSION, recordRun, replay, REPUTATION, reputationFor, RUN_MIGRATIONS, RUN_VERSION } from '../src/core';
import { loadProfile, recordFinishedRun, saveProfile } from '../src/profile';
import { playRun } from '../src/sim/run';
import { brewing } from './helpers';

const end = (season: 'spring' | 'summer' | 'autumn' | 'winter', phase: 'victory' | 'game-over' | 'morning', seed = 'r1', week = 4) =>
  ({ seed, season, phase, week, stats: { ordersFilled: 20, potionsSold: 3 } }) as const;

describe('the profile', () => {
  it('migrates the M2.5 profile, keeping the tutorial', () => {
    const p = migrateProfile({ tutorialDone: true });
    expect(p).toEqual({ ...newProfile(), tutorialDone: true });
    expect(p.version).toBe(PROFILE_VERSION);
  });

  it('starts fresh from nothing, junk, or a newer build', () => {
    for (const raw of [null, 'x', 3, [], { version: PROFILE_VERSION + 1, tutorialDone: true }, { version: -1 }]) expect(migrateProfile(raw)).toEqual(newProfile());
  });

  it('migrates a version 1 profile, adding Reputation and perks', () => {
    const p = migrateProfile({ version: 1, tutorialDone: true, seasons: ['spring', 'summer'], runs: 4, wins: { spring: 2 }, years: 0, lastRun: 'x' });
    expect(p).toMatchObject({ version: PROFILE_VERSION, seasons: ['spring', 'summer'], runs: 4, reputation: 0, reputationEarned: 0, perks: [] });
  });

  it('repairs a current profile with bad fields', () => {
    const p = migrateProfile({ version: PROFILE_VERSION, seasons: ['winter', 'nope'], runs: -3, wins: { summer: 2.7, autumn: 'x' }, years: 1, lastRun: 4, perks: ['nest-egg', 'nope'], reputation: 'lots' });
    expect(p.perks).toEqual(['nest-egg']);
    expect(p.reputation).toBe(0);
    expect(p.seasons).toEqual(['spring', 'winter']);
    expect(p.runs).toBe(0);
    expect(p.wins).toEqual({ spring: 0, summer: 2, autumn: 0, winter: 0 });
    expect(p.years).toBe(1);
    expect(p.lastRun).toBeNull();
  });

  it('a win opens the next season, once', () => {
    const won = recordRun(newProfile(), end('spring', 'victory'));
    expect(won.opened).toBe('summer');
    expect(won.profile).toMatchObject({ seasons: ['spring', 'summer'], runs: 1, wins: { spring: 1 }, lastRun: 'r1' });
    // The same run again changes nothing; another win in Spring opens nothing new.
    expect(recordRun(won.profile, end('spring', 'victory')).profile).toBe(won.profile);
    expect(recordRun(won.profile, end('spring', 'victory', 'r2')).opened).toBeNull();
  });

  it('a loss counts the run and opens nothing; a run still going is not counted', () => {
    const lost = recordRun(newProfile(), end('spring', 'game-over'));
    expect(lost).toMatchObject({ opened: null, yearDone: false, profile: { runs: 1, seasons: ['spring'] } });
    const p = newProfile();
    expect(recordRun(p, end('spring', 'morning')).profile).toBe(p);
  });

  it('winning Winter completes a Year', () => {
    const p = { ...newProfile(), seasons: ['spring', 'summer', 'autumn', 'winter'] as const };
    const out = recordRun({ ...p, seasons: [...p.seasons] }, end('winter', 'victory'));
    expect(out).toMatchObject({ opened: null, yearDone: true, profile: { years: 1 } });
    expect(nextSeason('autumn')).toBe('winter');
    expect(nextSeason('winter')).toBeNull();
  });

  it('keeps seasons in Year order when one opens out of turn', () => {
    const p = { ...newProfile(), seasons: ['spring', 'winter'] as ('spring' | 'winter')[] };
    expect(recordRun(p, end('spring', 'victory')).profile.seasons).toEqual(['spring', 'summer', 'winter']);
  });
});

describe('Reputation and perks', () => {
  it('pays for weeks survived, orders, potions sold and a win', () => {
    const stats = { ordersFilled: 20, potionsSold: 3 };
    expect(reputationFor({ phase: 'victory', week: 4, stats })).toBe(4 * REPUTATION.week + 20 + 3 + REPUTATION.win);
    expect(reputationFor({ phase: 'game-over', week: 3, stats })).toBe(2 * REPUTATION.week + 23);
    expect(reputationFor({ phase: 'game-over', week: 1, stats: { ordersFilled: 0, potionsSold: 0 } })).toBe(0);
  });

  it('a finished run adds its Reputation once, win or lose', () => {
    const lost = recordRun(newProfile(), end('spring', 'game-over', 'r1', 3));
    expect(lost.reputation).toBe(2 * REPUTATION.week + 23);
    expect(lost.profile).toMatchObject({ reputation: lost.reputation, reputationEarned: lost.reputation });
    expect(recordRun(lost.profile, end('spring', 'game-over', 'r1', 3)).reputation).toBe(0);
  });

  it('perks change how a run starts', () => {
    const plain = newRun('perks', 'hedge-witch').state;
    const s = newRun('perks', 'hedge-witch', 'spring', [], ['nest-egg', 'deep-shelf', 'old-spoon', 'spare-perch']).state;
    expect(s.gold).toBe(START_GOLD + 5);
    expect(s.shelfSize).toBe(SHELF_SLOTS + 1);
    expect(s.familiarSlots).toBe(FAMILIAR_SLOTS + 1);
    expect(allCards(s).length).toBe(allCards(plain).length + 1);
    expect(allCards(s).filter((c) => c.card === 'stir').length).toBe(allCards(plain).filter((c) => c.card === 'stir').length + 1);
    expect(() => newRun('perks', 'hedge-witch', 'spring', [], ['nope'])).toThrow(/unknown perk/);
  });

  it('counts orders filled and potions sold as the run goes', () => {
    expect(newRun('stats', 'hedge-witch').state.stats).toEqual({ ordersFilled: 0, potionsSold: 0 });
    const rec = playRun('stats', { strategy: 'greedy' });
    const { state, events } = replay(rec.actions);
    expect(state.stats.ordersFilled).toBe(rec.ordersFilled);
    expect(state.stats.potionsSold).toBe(events.filter((e) => e.type === 'potionSold').length);
    expect(state.stats.ordersFilled).toBeGreaterThan(0);
  });

  it('perks cost Reputation, once each', () => {
    const p = { ...newProfile(), reputation: 30 };
    expect(perkBlocked(p, 'spare-perch')).toMatch(/35 Reputation/);
    expect(perkBlocked(p, 'nope')).toMatch(/no perk/);
    const bought = buyPerk(p, 'deep-shelf');
    expect(bought).toMatchObject({ reputation: 10, perks: ['deep-shelf'] });
    expect(perkBlocked(bought, 'deep-shelf')).toMatch(/already/);
    expect(() => buyPerk(bought, 'deep-shelf')).toThrow(/already/);
  });
});

describe('saved run migrations', () => {
  it('keeps a current run and refuses junk, newer or unmigratable runs', () => {
    const s = brewing('migrate');
    expect(migrateRun(JSON.parse(JSON.stringify(s)))).toEqual(s);
    for (const raw of [null, 'x', [], { version: 'ten' }, { ...s, version: RUN_VERSION + 1 }, { ...s, version: 9 }]) expect(migrateRun(raw)).toBeNull();
  });

  it('a version 10 run gains empty stats', () => {
    const old: Record<string, unknown> = { ...brewing('migrate'), version: 10 };
    delete old.stats;
    expect(migrateRun(old)).toMatchObject({ version: RUN_VERSION, stats: { ordersFilled: 0, potionsSold: 0 } });
  });

  it('walks each step up to the current version', () => {
    const s = brewing('migrate');
    const step = RUN_MIGRATIONS[9];
    RUN_MIGRATIONS[9] = (old) => ({ ...old, gold: 99 });
    try {
      expect(migrateRun({ ...s, version: 9 })).toMatchObject({ version: RUN_VERSION, gold: 99, stats: { ordersFilled: 0, potionsSold: 0 } });
    } finally {
      if (step) RUN_MIGRATIONS[9] = step;
      else delete RUN_MIGRATIONS[9];
    }
  });
});

describe('the stored profile', () => {
  const g = globalThis as { localStorage?: unknown };
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    g.localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it('migrates what an older build stored', () => {
    data.set('elmbrook.profile', JSON.stringify({ tutorialDone: true }));
    expect(loadProfile()).toMatchObject({ version: PROFILE_VERSION, tutorialDone: true, seasons: ['spring'] });
    data.set('elmbrook.profile', '{not json');
    expect(loadProfile()).toEqual(newProfile());
  });

  it('records a finished run once and keeps other fields', () => {
    saveProfile({ tutorialDone: true });
    const s = { ...brewing('rec'), phase: 'victory' as const, week: 4 };
    expect(recordFinishedRun(s).opened).toBe('summer');
    expect(recordFinishedRun(s).opened).toBeNull();
    expect(loadProfile()).toMatchObject({ tutorialDone: true, runs: 1, seasons: ['spring', 'summer'] });
  });

  it('works without storage', () => {
    delete g.localStorage;
    expect(loadProfile()).toEqual(newProfile());
    expect(saveProfile({ tutorialDone: true }).tutorialDone).toBe(true);
  });
});
