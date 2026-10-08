// pnpm sim --runs 2000 --strategy greedy [--season spring] [--seed prefix]
// pnpm sim --replay path/to/run.json   (a {seed?, actions[]} log from a crash, the sim or the dev overlay)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { replay, SEASONS, type Action, type Season } from '../src/core';
import type { Strategy } from '../src/sim/bot';
import { report } from '../src/sim/report';
import { playRun } from '../src/sim/run';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const replayPath = arg('replay');
if (replayPath) {
  const log = JSON.parse(readFileSync(replayPath, 'utf8')) as { actions: Action[] };
  const r = replay(log.actions);
  const s = r.state;
  console.log(`replayed ${log.actions.length} actions (${r.rejected} rejected)`);
  console.log(`week ${s.week} day ${s.day} · ${s.phase} · ${s.gold} gold · deck ${s.drawPile.length + s.hand.length + s.discardPile.length + s.cauldron.length}`);
  process.exit(0);
}

const runs = Number(arg('runs') ?? 200);
const strategy = (arg('strategy') ?? 'greedy') as Strategy;
const season = arg('season') as Season | undefined;
if (season && !SEASONS.includes(season)) throw new Error(`unknown season ${season}`);
const prefix = arg('seed') ?? 'sim';

const t0 = performance.now();
const records = Array.from({ length: runs }, (_, i) => playRun(`${prefix}-${i}`, { strategy, ...(season ? { season } : {}) }));
const secs = ((performance.now() - t0) / 1000).toFixed(1);

console.log(report(records, `${strategy}${season ? ` · ${season}` : ''}`));
console.log(`\n${secs}s`);

const failed = records.filter((r) => r.error);
if (failed.length) {
  mkdirSync('.sim', { recursive: true });
  for (const r of failed.slice(0, 5)) {
    const path = `.sim/${r.seed}.json`;
    writeFileSync(path, JSON.stringify({ seed: r.seed, actions: r.actions }, null, 1));
    console.error(`\n${r.seed} crashed; replay with: pnpm sim --replay ${path}\n${r.error}`);
  }
  process.exit(1);
}
