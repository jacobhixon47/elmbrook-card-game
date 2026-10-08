import { NIGHT_SHIFT_DAY, WEEKS } from '../core';
import type { RunRecord } from './run';

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const bar = (n: number, d: number, width = 30) => '█'.repeat(d ? Math.round((width * n) / d) : 0);

/** The balance report from docs/tech.md: win rate, rent-failure weeks, quality, picks, gold curve. */
export function report(runs: RunRecord[], title: string): string {
  const lines: string[] = [];
  const n = runs.length;
  const wins = runs.filter((r) => r.won).length;
  const errors = runs.filter((r) => r.error);
  const unfinished = runs.filter((r) => !r.finished && !r.error).length;

  lines.push(`== ${title}: ${n} runs ==`);
  lines.push(`win rate      ${pct(wins, n)} (${wins}/${n})`);
  lines.push(`errors        ${errors.length}${errors[0] ? `  first: ${errors[0].seed}` : ''}`);
  lines.push(`unfinished    ${unfinished}`);
  lines.push(`rejected acts ${avg(runs.map((r) => r.rejected)).toFixed(1)} per run`);
  lines.push(`orders        ${avg(runs.map((r) => r.ordersFilled)).toFixed(1)} filled, ${avg(runs.map((r) => r.ordersDeclined)).toFixed(1)} declined per run`);

  lines.push('', 'rent failed in week');
  for (let w = 1; w <= WEEKS; w++) {
    const k = runs.filter((r) => r.lostWeek === w).length;
    lines.push(`  week ${w}  ${String(k).padStart(5)}  ${pct(k, n).padStart(6)}  ${bar(k, n)}`);
  }

  lines.push('', 'average quality brewed (potions)');
  for (let w = 1; w <= WEEKS; w++) {
    const qs = runs.flatMap((r) => r.quality[w - 1] ?? []);
    lines.push(`  week ${w}  ${avg(qs).toFixed(1).padStart(6)}  (${qs.length})`);
  }

  lines.push('', 'gold at the start of each day (runs still alive)');
  for (let w = 1; w <= WEEKS; w++) {
    const cells: string[] = [];
    for (let d = 1; d <= NIGHT_SHIFT_DAY; d++) {
      const gs = runs.map((r) => r.gold[w - 1]?.[d - 1]).filter((g): g is number => g !== undefined);
      cells.push(gs.length ? avg(gs).toFixed(0).padStart(4) : '   -');
    }
    lines.push(`  week ${w}  ${cells.join(' ')}   (day 1-${NIGHT_SHIFT_DAY - 1}, night)`);
  }

  const offered = new Map<string, number>();
  const picked = new Map<string, number>();
  for (const r of runs) {
    for (const c of r.offered) offered.set(c, (offered.get(c) ?? 0) + 1);
    for (const c of r.picked) picked.set(c, (picked.get(c) ?? 0) + 1);
  }
  const rates = [...offered].map(([card, o]) => ({ card, rate: (picked.get(card) ?? 0) / o, picks: picked.get(card) ?? 0 })).sort((a, b) => b.rate - a.rate);
  const fmt = (x: (typeof rates)[number]) => `  ${x.card.padEnd(16)} ${pct(x.rate, 1).padStart(6)} of offers (${x.picks})`;
  lines.push('', 'most picked rewards');
  lines.push(...rates.slice(0, 5).map(fmt));
  lines.push('least picked rewards');
  lines.push(...rates.slice(-5).map(fmt));
  return lines.join('\n');
}
