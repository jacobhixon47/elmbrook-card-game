import { codex } from '../codex';
import {
  almanacUnlocks, boonOf, buyPerk, cauldronOpen, chooseYear, friendLevel, keepsakesOpen, MAX_YEAR, newProfile, perkBlocked, pickBoon, recordRun, runKeepsakes, seasonsOf, witchOpen,
  type Profile, type Season,
} from '../core';
import { nextFloat, seedRng } from '../core/rng';
import type { Strategy } from './bot';
import { playRun } from './run';

// A whole save played from a new profile, the way a player climbs it: every run counted into the
// profile, perks bought, each new Year taken with a boon, a witch, cauldron and keepsake picked from
// what's open. It tests every system that decides a win together, as they arrive.

export type CareerRun = {
  year: number; season: Season; witch: string; cauldron: string; boon: string | null; perks: number; keepsake: string | null;
  /** Average Friendship level across the regulars when the run began. */
  friends: number;
  won: boolean; lostWeek: number | null;
};

export type CareerRecord = { seed: string; strategy: Strategy; runs: CareerRun[]; /** Years won (Winter wins in a new top Year count once each). */ years: number; error?: string };

export function playCareer(seed: string, strategy: Strategy, maxRuns: number): CareerRecord {
  let rng = seedRng(`career:${seed}`);
  const pick = <T>(xs: readonly T[]): T | undefined => {
    const [f, next] = nextFloat(rng);
    rng = next;
    return xs[Math.floor(f * xs.length)];
  };
  let p: Profile = { ...newProfile(), tutorialDone: true };
  const out: CareerRecord = { seed, strategy, runs: [], years: 0 };
  for (let i = 0; i < maxRuns; i++) {
    // At the cottage: buy what Reputation affords, in no particular order; go to the newest Year.
    for (let perk = pick([...codex.perks.keys()].filter((id) => !perkBlocked(p, id))); perk; perk = pick([...codex.perks.keys()].filter((id) => !perkBlocked(p, id)))) p = buyPerk(p, perk);
    if (p.year !== p.yearSeasons.length) p = chooseYear(p, p.yearSeasons.length);
    if (p.boonOffer) p = pickBoon(p, pick(p.boonOffer)!);
    const witch = pick([...codex.witches.keys()].filter((id) => witchOpen(p, id)))!;
    const cauldron = pick([...codex.cauldrons.keys()].filter((id) => cauldronOpen(p, id)))!;
    const open = keepsakesOpen(p.friendship);
    if (open.length && !runKeepsakes(p).length) p = { ...p, keepsakes: [pick(open)!] };
    // The newest season open: the one still to beat.
    const season = seasonsOf(p).at(-1)!;
    const unlocks = almanacUnlocks(p.almanac);
    const keepsakes = runKeepsakes(p);
    const boon = boonOf(p);
    const levels = [...codex.regulars.keys()].map((id) => p.friendship[id] ?? 0);
    const r = playRun(`${seed}-${i}`, {
      strategy, season, witch, cauldron, perks: p.perks, unlocks, year: p.year, friendship: p.friendship, keepsakes,
      ...(boon ? { boon } : {}),
    });
    if (r.error || !r.final) return { ...out, error: r.error ?? 'unfinished run' };
    out.runs.push({
      year: p.year, season, witch, cauldron, boon, perks: p.perks.length, keepsake: keepsakes[0] ?? null,
      friends: levels.reduce((a, pts) => a + friendLevel(pts), 0) / levels.length, won: r.won, lostWeek: r.lostWeek,
    });
    p = recordRun(p, r.final).profile;
    // Winter of the last Year won: the save is done.
    if (r.won && season === 'winter' && p.year === MAX_YEAR) break;
  }
  out.years = p.years;
  return out;
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '-');
const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

/** How saves climbed: runs taken to each milestone, and win rates by Year, season and everything picked. */
export function careerReport(careers: CareerRecord[], title: string): string {
  const lines = [`== ${title}: ${careers.length} saves, ${careers.reduce((a, c) => a + c.runs.length, 0)} runs ==`];
  const errors = careers.filter((c) => c.error);
  if (errors.length) lines.push(`errors        ${errors.length}  first: ${errors[0]!.seed}`);

  // Runs taken to reach each milestone, among saves that did.
  const milestone = (label: string, at: (c: CareerRecord) => number) => {
    const reached = careers.map(at).filter((i) => i >= 0).map((i) => i + 1);
    lines.push(`  ${label.padEnd(22)} ${pct(reached.length, careers.length).padStart(4)} of saves, median ${reached.length ? median(reached) : '-'} runs`);
  };
  lines.push('', 'runs to reach');
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) milestone(`win Year 1 ${season}`, (c) => c.runs.findIndex((r) => r.year === 1 && r.season === season && r.won));
  for (const year of [2, 3, 5, 8, 10]) milestone(`reach Year ${year}`, (c) => c.runs.findIndex((r) => r.year === year));
  milestone('win Year 10 winter', (c) => c.runs.findIndex((r) => r.year === 10 && r.season === 'winter' && r.won));

  const runs = careers.flatMap((c) => c.runs);
  const table = (label: string, key: (r: CareerRun) => string | number | null) => {
    const groups = new Map<string, CareerRun[]>();
    for (const r of runs) {
      const k = String(key(r) ?? 'none');
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    lines.push('', `win rate by ${label}`);
    for (const [k, rs] of [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
      lines.push(`  ${k.padEnd(22)} ${pct(rs.filter((r) => r.won).length, rs.length).padStart(4)}  (${rs.length} runs)`);
    }
  };
  table('Year', (r) => r.year);
  table('Year 1 season', (r) => (r.year === 1 ? r.season : null));
  table('season, Year 2+', (r) => (r.year > 1 ? r.season : null));
  table('witch', (r) => r.witch);
  table('witch and season', (r) => `${r.witch} ${r.season}`);
  table('cauldron', (r) => r.cauldron);
  table('boon', (r) => r.boon);
  table('keepsake', (r) => r.keepsake);
  table('Friendship (avg level)', (r) => `${Math.floor(r.friends / 2) * 2}-${Math.floor(r.friends / 2) * 2 + 1}`);

  // The longest run of losses in a row: how long a player is stuck before the next win.
  const streaks = careers.map((c) => {
    let best = 0;
    let now = 0;
    for (const r of c.runs) best = Math.max(best, (now = r.won ? 0 : now + 1));
    return best;
  });
  lines.push('', `longest losing streak  median ${median(streaks)}, worst ${Math.max(...streaks)}`);
  return lines.join('\n');
}
