import { describe, expect, it } from 'vitest';
import { nextFloat, reduce, seedRng, shuffle } from '../src/core';

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
