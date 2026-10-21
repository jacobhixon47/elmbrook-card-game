// pnpm sim --runs 2000 --strategy greedy [--season spring] [--seed prefix] [--unlocks all] [--perks all|tier|a,b] [--year 2] [--boon id] [--friends 10]
// pnpm sim --runs 200 --endless [--unlocks all --perks all]   (Endless runs; prints the weeks lasted)
// pnpm sim --career 20 --strategy casual [--max-runs 250]   (whole saves from a new profile; see src/sim/career.ts)
// pnpm sim --replay path/to/run.json   (a {seed?, actions[]} log from a crash, the sim or the dev overlay)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { codex } from '../src/codex';
import { almanacUnlocks, FRIENDSHIP, replay, SEASONS, type Action, type Season } from '../src/core';
import type { Strategy } from '../src/sim/bot';
import { careerReport, playCareer } from '../src/sim/career';
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
if (!['greedy', 'skilled', 'casual', 'novice', 'random'].includes(strategy)) throw new Error(`unknown strategy ${strategy}`);
const season = arg('season') as Season | undefined;
if (season && !SEASONS.includes(season)) throw new Error(`unknown season ${season}`);
const prefix = arg('seed') ?? 'sim';
// --unlocks all: play as if every Almanac entry were done, so locked cards, recipes, familiars and relics get tested too.
const unlocks = arg('unlocks') === 'all' ? almanacUnlocks([...codex.almanac.keys()]) : undefined;
// --perks all: every cottage perk bought; --perks 2 every perk up to tier 2; --perks a,b just those.
const perksArg = arg('perks');
const perks = !perksArg ? undefined
  : perksArg === 'all' ? [...codex.perks.keys()]
    : /^\d$/.test(perksArg) ? [...codex.perks.values()].filter((p) => p.tier <= Number(perksArg)).map((p) => p.id)
      : perksArg.split(',');
// --year n: play under Year n's modifiers; --boon id: with that Year's boon.
const year = arg('year') ? Number(arg('year')) : undefined;
const boon = arg('boon');
// --friends n: every regular at Friendship level n, as a long save would have them.
const friendsArg = arg('friends');
const friendship = friendsArg ? Object.fromEntries([...codex.regulars.keys()].map((id) => [id, Number(friendsArg) > 0 ? FRIENDSHIP.levels[Number(friendsArg) - 1]! : 0])) : undefined;

// --career n: n whole saves instead of single runs.
const careers = arg('career');
if (careers) {
  const t = performance.now();
  const saves = Array.from({ length: Number(careers) }, (_, i) => playCareer(`${prefix}-${i}`, strategy, Number(arg('max-runs') ?? 250)));
  console.log(careerReport(saves, `${strategy} saves`));
  console.log(`\n${((performance.now() - t) / 1000).toFixed(1)}s`);
  process.exit(saves.some((c) => c.error) ? 1 : 0);
}

// --endless: Endless runs (Year 1 rules, no boon), each going until the rent or a finale beats it.
const endless = process.argv.includes('--endless');

const t0 = performance.now();
const records = Array.from({ length: runs }, (_, i) => playRun(`${prefix}-${i}`, { strategy, ...(season ? { season } : {}), ...(unlocks ? { unlocks } : {}), ...(perks ? { perks } : {}), ...(year ? { year } : {}), ...(boon ? { boon } : {}), ...(friendship ? { friendship } : {}), ...(endless ? { endless } : {}) }));
const secs = ((performance.now() - t0) / 1000).toFixed(1);

console.log(report(records, `${strategy}${season ? ` · ${season}` : ''}${unlocks ? ' · all unlocked' : ''}${perks ? ` · ${perksArg === 'all' ? 'all perks' : `perks ${perksArg}`}` : ''}${year ? ` · Year ${year}` : ''}${boon ? ` · ${boon}` : ''}${friendsArg ? ` · Friendship ${friendsArg}` : ''}`));
if (endless) {
  const weeks = records.map((r) => r.endlessWeeks).sort((a, b) => a - b);
  const at = (q: number) => weeks[Math.min(weeks.length - 1, Math.floor(q * weeks.length))] ?? 0;
  const counts = new Map<number, number>();
  for (const w of weeks) counts.set(w, (counts.get(w) ?? 0) + 1);
  console.log(`\nEndless (${weeks.length} runs): weeks lasted median ${at(0.5)}, p10 ${at(0.1)}, p90 ${at(0.9)}, best ${weeks.at(-1) ?? 0}`);
  console.log(`  ${[...counts].map(([w, n]) => `${w}w:${n}`).join(' ')}`);
  const unfinished = records.filter((r) => !r.finished).length;
  if (unfinished) console.log(`  ${unfinished} runs hit the action cap`);
}
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
