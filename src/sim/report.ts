import { codex } from '../codex';
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

  lines.push('', 'run lost in week');
  for (let w = 1; w <= WEEKS; w++) {
    const k = runs.filter((r) => r.lostWeek === w).length;
    lines.push(`  week ${w}  ${String(k).padStart(5)}  ${pct(k, n).padStart(6)}  ${bar(k, n)}`);
  }

  const finale = runs.filter((r) => r.finaleFailed).length;
  lines.push(`  of which week 4 rent paid, Moonless Patron not met: ${finale} (${pct(finale, n)})`);

  lines.push('', 'patron orders filled');
  for (let w = 1; w <= WEEKS; w++) {
    const posted = runs.reduce((k, r) => k + (r.patronPosted[w - 1] ?? 0), 0);
    const filled = runs.reduce((k, r) => k + (r.patronFilled[w - 1] ?? 0), 0);
    lines.push(`  week ${w}  ${pct(filled, posted).padStart(6)}  (${filled}/${posted})`);
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

  // Every Tincture in the pool should show up here; one that never gets played is untested.
  const plays = new Map<string, number>();
  for (const r of runs) for (const [card, k] of Object.entries(r.tinctures)) plays.set(card, (plays.get(card) ?? 0) + k);
  const unplayed = [...codex.tinctures.keys()].filter((id) => !plays.has(id));
  lines.push('', 'tinctures played (per 100 runs)');
  lines.push(...[...plays].sort((a, b) => b[1] - a[1]).map(([card, k]) => `  ${card.padEnd(16)} ${((100 * k) / n).toFixed(0).padStart(6)}`));
  if (unplayed.length) lines.push(`  never played: ${unplayed.join(', ')}`);

  // Which familiars, relics, curses and modifiers the bot ends up with, and how runs that had them did.
  const held = (title: string, ids: readonly string[], of: (r: RunRecord) => readonly string[]) => {
    const seen = new Map<string, { runs: number; wins: number }>();
    for (const r of runs) for (const id of new Set(of(r))) {
      const h = seen.get(id) ?? { runs: 0, wins: 0 };
      seen.set(id, { runs: h.runs + 1, wins: h.wins + (r.won ? 1 : 0) });
    }
    lines.push('', `${title} held at the end (${avg(runs.map((r) => of(r).length)).toFixed(1)} per run; per 100 runs, win rate when held)`);
    lines.push(...[...seen].sort((a, b) => b[1].runs - a[1].runs).map(([id, h]) => `  ${id.padEnd(17)} ${((100 * h.runs) / n).toFixed(0).padStart(5)}  ${pct(h.wins, h.runs).padStart(6)}`));
    const never = ids.filter((id) => !seen.has(id));
    if (never.length) lines.push(`  never held: ${never.join(', ')}`);
  };
  held('familiars', [...codex.familiars.keys()], (r) => r.familiars);
  held('relics', [...codex.relics.keys()], (r) => r.relics);
  held('curses', [...codex.curses.keys()], (r) => r.curses);
  held('modified cards', [...codex.modifiers.keys()], (r) => r.modifiers);
  return lines.join('\n');
}
