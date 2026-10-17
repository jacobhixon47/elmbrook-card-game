// pnpm balance [--quick] [--systems]
// The balance check (docs/balance-check.md): every player persona in each Year 1 season, then whole
// saves per persona, and with --systems each cauldron, witch and Friendship level. Jobs run in
// parallel child processes; the report prints and is saved to .sim/balance-<stamp>.md.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { codex } from '../src/codex';
import { FRIENDSHIP, SEASONS, type Season } from '../src/core';
import type { Strategy } from '../src/sim/bot';
import { careerReport, playCareer, type CareerRecord } from '../src/sim/career';
import { playRun, type SimOptions } from '../src/sim/run';

type Cell = { kind: 'cell'; group: string; label: string; strategy: Strategy; season: Season; runs: number; witch?: string; cauldron?: string; friends?: number };
type Save = { kind: 'save'; strategy: Strategy; seed: string; maxRuns: number };
type Job = Cell | Save;

const PERSONAS: Strategy[] = ['greedy', 'skilled', 'casual', 'novice'];
const NAME: Record<string, string> = { greedy: 'expert', skilled: 'skilled', casual: 'casual', novice: 'novice' };
// Year 1 cells play with the tier 1 perks, as a player has after their first few runs.
const TIER1 = [...codex.perks.values()].filter((p) => p.tier <= 1).map((p) => p.id);

function runJob(job: Job): unknown {
  if (job.kind === 'save') return playCareer(job.seed, job.strategy, job.maxRuns);
  const opts: SimOptions = {
    strategy: job.strategy, season: job.season, perks: TIER1,
    ...(job.witch ? { witch: job.witch } : {}), ...(job.cauldron ? { cauldron: job.cauldron } : {}),
    ...(job.friends ? { friendship: Object.fromEntries([...codex.regulars.keys()].map((id) => [id, FRIENDSHIP.levels[job.friends! - 1]!])) } : {}),
  };
  let wins = 0;
  let errors = 0;
  for (let i = 0; i < job.runs; i++) {
    const r = playRun(`balance-${i}`, opts);
    if (r.error) errors++;
    else if (r.won) wins++;
  }
  return { ...job, win: (100 * wins) / job.runs, errors };
}

const jobArg = process.argv.indexOf('--job');
if (jobArg >= 0) {
  console.log(JSON.stringify(runJob(JSON.parse(process.argv[jobArg + 1]!) as Job)));
  process.exit(0);
}

const quick = process.argv.includes('--quick');
const systems = process.argv.includes('--systems');
const RUNS = quick ? 150 : 300;
const SAVES = quick ? 6 : 16;
const MAX_RUNS = quick ? 150 : 250;

const jobs: Job[] = [];
for (const strategy of PERSONAS) for (const season of SEASONS) jobs.push({ kind: 'cell', group: 'year1', label: season, strategy, season, runs: RUNS });
for (const strategy of PERSONAS) for (let i = 0; i < SAVES; i++) jobs.push({ kind: 'save', strategy, seed: `balance-${i}`, maxRuns: MAX_RUNS });
if (systems) {
  for (const strategy of ['greedy', 'casual'] as const) {
    for (const cauldron of codex.cauldrons.keys()) for (const season of ['spring', 'winter'] as const) jobs.push({ kind: 'cell', group: 'cauldron', label: `${cauldron} ${season}`, strategy, season, cauldron, runs: RUNS });
    for (const [id, w] of codex.witches) for (const season of SEASONS) if (w.unlockSeason === season || id === 'hedge-witch') jobs.push({ kind: 'cell', group: 'witch', label: `${id} ${season}`, strategy, season, witch: id, runs: RUNS });
    for (const friends of [0, 4, 7, 10]) for (const season of ['spring', 'winter'] as const) jobs.push({ kind: 'cell', group: 'friendship', label: `level ${friends} ${season}`, strategy, season, ...(friends ? { friends } : {}), runs: RUNS });
  }
}

// Saves are the long jobs: start them first so the pool ends together.
jobs.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'save' ? -1 : 1));
const tsx = execFileSync('node', ['-e', "process.stdout.write(require.resolve('tsx/cli'))"], { encoding: 'utf8' });
const results: unknown[] = [];
let next = 0;
let done = 0;
const t0 = performance.now();

function work(): Promise<void> {
  const job = jobs[next++];
  if (!job) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [tsx, 'scripts/balance.ts', '--job', JSON.stringify(job)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`job failed: ${JSON.stringify(job)}`));
      results.push(JSON.parse(out));
      process.stderr.write(`\r${++done}/${jobs.length} jobs`);
      resolve();
    });
  }).then(work);
}

await Promise.all(Array.from({ length: Math.max(1, cpus().length) }, work));
process.stderr.write('\n');

const cells = results.filter((r): r is Cell & { win: number; errors: number } => (r as Job).kind === 'cell');
const saves = results.filter((r): r is CareerRecord => 'runs' in (r as object) && Array.isArray((r as CareerRecord).runs));
const pct = (n: number) => `${n.toFixed(0)}%`;
const lines: string[] = [`# Balance check${quick ? ' (quick)' : ''}`, '', `${RUNS} runs a cell, tier 1 perks; ${SAVES} saves per persona, up to ${MAX_RUNS} runs each. Compare with the targets in docs/balance-check.md.`, ''];

const table = (group: string, title: string) => {
  const rows = cells.filter((c) => c.group === group);
  if (!rows.length) return;
  const labels = [...new Set(rows.map((c) => c.label))];
  const strategies = PERSONAS.filter((p) => rows.some((c) => c.strategy === p));
  lines.push(`## ${title}`, '', `| | ${strategies.map((s) => NAME[s]).join(' | ')} |`, `|---|${strategies.map(() => '---').join('|')}|`);
  for (const label of labels) lines.push(`| ${label} | ${strategies.map((s) => { const c = rows.find((x) => x.label === label && x.strategy === s); return c ? pct(c.win) : '-'; }).join(' | ')} |`);
  lines.push('');
};
table('year1', 'Year 1 win rate');

lines.push('## Whole saves', '', '| | finish Year 1 | reach Year 3 | reach Year 5 | reach Year 8 | reach Year 10 | win Year 10 Winter |', '|---|---|---|---|---|---|---|');
const reach = (cs: CareerRecord[], at: (c: CareerRecord) => number) => {
  const hit = cs.map(at).filter((i) => i >= 0).map((i) => i + 1).sort((a, b) => a - b);
  if (!hit.length) return 'none';
  const median = hit[Math.floor(hit.length / 2)]!;
  return hit.length === cs.length ? `${median}` : `${median} (${Math.round((100 * hit.length) / cs.length)}%)`;
};
for (const strategy of PERSONAS) {
  const cs = saves.filter((c) => c.strategy === strategy);
  const year = (y: number) => (c: CareerRecord) => c.runs.findIndex((r) => r.year === y);
  lines.push(`| ${NAME[strategy]} | ${[reach(cs, year(2)), reach(cs, year(3)), reach(cs, year(5)), reach(cs, year(8)), reach(cs, year(10)), reach(cs, (c) => c.runs.findIndex((r) => r.year === 10 && r.season === 'winter' && r.won))].join(' | ')} |`);
}
lines.push('', 'Median runs to reach each milestone; a share in brackets when not every save did.', '');
lines.push('### Win rate by Year', '', `| Year | ${PERSONAS.map((s) => NAME[s]).join(' | ')} |`, `|---|${PERSONAS.map(() => '---').join('|')}|`);
for (let y = 1; y <= 10; y++) {
  lines.push(`| ${y} | ${PERSONAS.map((s) => { const rs = saves.filter((c) => c.strategy === s).flatMap((c) => c.runs.filter((r) => r.year === y)); return rs.length >= 20 ? pct((100 * rs.filter((r) => r.won).length) / rs.length) : '-'; }).join(' | ')} |`);
}
lines.push('');

table('cauldron', 'Cauldrons');
table('witch', 'Witches in their home season (the Hedge Witch in every season)');
table('friendship', 'Friendship (every regular at the level)');

const errors = cells.reduce((n, c) => n + c.errors, 0) + saves.filter((c) => c.error).length;
lines.push(`Errors: ${errors}. ${((performance.now() - t0) / 60000).toFixed(1)} minutes.`);

const report = lines.join('\n');
console.log(report);
mkdirSync('.sim', { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
writeFileSync(`.sim/balance-${stamp}.md`, report);
// Each persona's full save report, for digging in.
writeFileSync(`.sim/balance-${stamp}-saves.txt`, PERSONAS.map((s) => careerReport(saves.filter((c) => c.strategy === s), NAME[s]!)).join('\n\n'));
console.error(`saved .sim/balance-${stamp}.md and -saves.txt`);
process.exit(errors ? 1 : 0);
