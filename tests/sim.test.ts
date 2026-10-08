import { describe, expect, it } from 'vitest';
import { replay } from '../src/core';
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
});
