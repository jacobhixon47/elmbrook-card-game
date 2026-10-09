import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateProfile, migrateRun, newProfile, nextSeason, PROFILE_VERSION, recordRun, RUN_MIGRATIONS, RUN_VERSION } from '../src/core';
import { loadProfile, recordFinishedRun, saveProfile } from '../src/profile';
import { brewing } from './helpers';

const end = (season: 'spring' | 'summer' | 'autumn' | 'winter', phase: 'victory' | 'game-over' | 'morning', seed = 'r1') => ({ seed, season, phase }) as const;

describe('the profile', () => {
  it('migrates the M2.5 profile, keeping the tutorial', () => {
    const p = migrateProfile({ tutorialDone: true });
    expect(p).toEqual({ ...newProfile(), tutorialDone: true });
    expect(p.version).toBe(PROFILE_VERSION);
  });

  it('starts fresh from nothing, junk, or a newer build', () => {
    for (const raw of [null, 'x', 3, [], { version: PROFILE_VERSION + 1, tutorialDone: true }, { version: -1 }]) expect(migrateProfile(raw)).toEqual(newProfile());
  });

  it('repairs a current profile with bad fields', () => {
    const p = migrateProfile({ version: PROFILE_VERSION, seasons: ['winter', 'nope'], runs: -3, wins: { summer: 2.7, autumn: 'x' }, years: 1, lastRun: 4 });
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

describe('saved run migrations', () => {
  it('keeps a current run and refuses junk, newer or unmigratable runs', () => {
    const s = brewing('migrate');
    expect(migrateRun(JSON.parse(JSON.stringify(s)))).toEqual(s);
    for (const raw of [null, 'x', [], { version: 'ten' }, { ...s, version: RUN_VERSION + 1 }, { ...s, version: RUN_VERSION - 1 }]) expect(migrateRun(raw)).toBeNull();
  });

  it('walks each step up to the current version', () => {
    const s = brewing('migrate');
    RUN_MIGRATIONS[RUN_VERSION - 1] = (old) => ({ ...old, gold: 99 });
    try {
      expect(migrateRun({ ...s, version: RUN_VERSION - 1 })).toMatchObject({ version: RUN_VERSION, gold: 99 });
    } finally {
      delete RUN_MIGRATIONS[RUN_VERSION - 1];
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
    const s = { ...brewing('rec'), phase: 'victory' as const };
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
