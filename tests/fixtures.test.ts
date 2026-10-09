import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reduce, type RunState, type Season, type Weather } from '../src/core';
import { stepAction } from '../src/debug/fixture-steps';
import type { Fixture } from '../src/debug/params';

// Every Run fixture's steps must still be legal: a rule change that makes one fail silently snaps the wrong screen.

const dir = new URL('../fixtures/', import.meta.url);
const runFixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Fixture] as const)
  .filter(([, fx]) => fx.scene === 'Run' && fx.steps?.length);

describe('fixtures', () => {
  it.each(runFixtures)('%s replays without a rejected step', (_, fx) => {
    let s: RunState = reduce(null, { type: 'startRun', seed: fx.seed ?? 'fixture', witch: 'hedge-witch', ...(fx.season ? { season: fx.season as Season } : {}) }).state;
    const today = () => {
      if (fx.today) s = reduce(s, { type: 'debug', op: 'setWeather', weather: fx.today as Weather }).state;
    };
    today();
    for (const step of fx.steps!) {
      const r = reduce(s, stepAction(s, step));
      expect(r.events.find((e) => e.type === 'rejected'), JSON.stringify(step)).toBeUndefined();
      s = r.state;
    }
  });
});
