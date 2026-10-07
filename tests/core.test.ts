import { describe, expect, it } from 'vitest';
import { nextFloat, NIGHT_SHIFT_DAY, reduce, SEASON_WEATHER, SEASONS, seedRng, shuffle, skyTime } from '../src/core';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = nextFloat(seedRng('elmbrook'));
    const b = nextFloat(seedRng('elmbrook'));
    expect(a).toEqual(b);
    expect(a[0]).toBeGreaterThanOrEqual(0);
    expect(a[0]).toBeLessThan(1);
  });

  it('shuffle is a permutation and reproducible', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const [a] = shuffle(items, seedRng(42));
    const [b] = shuffle(items, seedRng(42));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items);
  });
});

describe('run start', () => {
  it('builds the witch starting deck and draws to hand size', () => {
    const start = reduce(null, { type: 'startRun', seed: 'test', witch: 'hedge-witch' });
    expect(start.state.drawPile).toHaveLength(14);
    expect(start.state.knownRecipes).toContain('healing-draught');

    const drawn = reduce(start.state, { type: 'drawToHandSize' });
    expect(drawn.state.hand).toHaveLength(8);
    expect(drawn.state.drawPile).toHaveLength(6);
    expect(drawn.events.filter((e) => e.type === 'cardDrawn')).toHaveLength(8);
    expect(new Set(drawn.state.hand.map((c) => c.uid)).size).toBe(8);
  });

  it('same seed gives the same opening hand; different seeds differ', () => {
    const hand = (seed: string) => {
      const s = reduce(null, { type: 'startRun', seed, witch: 'hedge-witch' }).state;
      return reduce(s, { type: 'drawToHandSize' }).state.hand.map((c) => c.card);
    };
    expect(hand('a')).toEqual(hand('a'));
    expect(['b', 'c', 'd', 'e'].some((s) => hand(s).join() !== hand('a').join())).toBe(true);
  });

  it('state is JSON round-trippable (saves and fixtures)', () => {
    const s = reduce(null, { type: 'startRun', seed: 'json', witch: 'hedge-witch' }).state;
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('rejects unknown witches', () => {
    expect(() => reduce(null, { type: 'startRun', seed: 'x', witch: 'nobody' })).toThrow(/unknown witch/);
  });
});

describe('calendar', () => {
  it('runs default to spring and can start in another season', () => {
    expect(reduce(null, { type: 'startRun', seed: 's', witch: 'hedge-witch' }).state.season).toBe('spring');
    expect(reduce(null, { type: 'startRun', seed: 's', witch: 'hedge-witch', season: 'winter' }).state.season).toBe('winter');
  });

  it('derives the sky from the phase of the day', () => {
    expect(skyTime({ day: 1, phase: 'morning' })).toBe('afternoon');
    expect(skyTime({ day: 2, phase: 'brewing' })).toBe('sunset');
    expect(skyTime({ day: 3, phase: 'dusk' })).toBe('twilight');
    expect(skyTime({ day: NIGHT_SHIFT_DAY, phase: 'brewing' })).toBe('night');
    expect(skyTime({ day: 2, phase: 'night-market' })).toBe('night');
  });
});

describe('weather', () => {
  it('keeps snow to winter and heatwaves to summer', () => {
    for (const season of SEASONS) {
      expect(SEASON_WEATHER[season].includes('snow')).toBe(season === 'winter');
      expect(SEASON_WEATHER[season].includes('heatwave')).toBe(season === 'summer');
      expect(SEASON_WEATHER[season]).toContain('clear');
    }
  });
});
