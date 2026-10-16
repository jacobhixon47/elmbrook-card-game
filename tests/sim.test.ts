import { describe, expect, it } from 'vitest';
import { replay } from '../src/core';
import { careerReport, playCareer } from '../src/sim/career';
import { report } from '../src/sim/report';
import { playRun } from '../src/sim/run';

describe('sim', () => {
  it('the greedy bot finishes runs without a single rejected action', () => {
    const runs = ['a', 'b', 'c', 'd'].map((seed) => playRun(seed, { strategy: 'greedy' }));
    for (const r of runs) {
      expect(r.error).toBeUndefined();
      expect(r.finished).toBe(true);
      expect(r.rejected).toBe(0);
      expect(r.won || r.lostWeek !== null).toBe(true);
    }
    expect(report(runs, 'test')).toMatch(/win rate/);
  });

  it('random play never crashes the rules', () => {
    for (const seed of ['r1', 'r2', 'r3']) {
      const r = playRun(seed, { strategy: 'random', season: 'summer' });
      expect(r.error).toBeUndefined();
      expect(r.finished).toBe(true);
    }
  });

  it('a run is fully determined by its seed and replays from its action log', () => {
    const a = playRun('same', { strategy: 'greedy' });
    const b = playRun('same', { strategy: 'greedy' });
    expect(b.actions).toEqual(a.actions);
    const r = replay(a.actions);
    expect(r.state.phase === 'victory').toBe(a.won);
  });

  it('each persona plays whole runs legally, the same way from the same seed', () => {
    for (const strategy of ['skilled', 'casual', 'novice'] as const) {
      const a = playRun(`p-${strategy}`, { strategy, season: 'autumn', unlocks: [], perks: [] });
      expect(a.error).toBeUndefined();
      expect(a.finished).toBe(true);
      expect(a.rejected).toBe(0);
      expect(playRun(`p-${strategy}`, { strategy, season: 'autumn', unlocks: [], perks: [] }).actions).toEqual(a.actions);
    }
  });

  it('a save climbs from a new profile, counting each run into it', () => {
    const c = playCareer('t', 'greedy', 12);
    expect(c.error).toBeUndefined();
    expect(c.runs).toHaveLength(12);
    // Reputation buys perks as the save goes on.
    expect(c.runs.at(-1)!.perks).toBeGreaterThan(0);
    expect(careerReport([c], 'test')).toMatch(/win rate by witch/);
  });
});
