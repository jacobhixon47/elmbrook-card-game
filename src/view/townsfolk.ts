import { codex } from '../codex';
import { friendLevel, friendshipOf, levelStartAt, nextLevelAt, type RunState } from '../core';

/** A regular's Friendship as a short line: "♥ 2 · 21/30". */
export function friendshipLine(points: number): string {
  const next = nextLevelAt(points);
  return `♥ ${friendLevel(points)} · ${next === null ? 'best friends' : `${points}/${next}`}`;
}

export type TownsfolkRow = {
  id: string;
  name: string;
  /** Their entry, once you're friends (level 1). */
  blurb: string | null;
  nightOnly: boolean;
  points: number;
  level: number;
  /** 0 to 1 through the current level. */
  progress: number;
  next: number | null;
  /** Points earned this run, already in `points`. */
  thisRun: number;
};

/** The Grimoire's Townsfolk page (GDD §4.1): each regular and your Friendship with them. */
export function townsfolkRows(s: Pick<RunState, 'friendship' | 'friendshipBase'>): TownsfolkRow[] {
  return [...codex.regulars.values()].map((r) => {
    const points = friendshipOf(s, r.id);
    const level = friendLevel(points);
    const next = nextLevelAt(points);
    const start = levelStartAt(points);
    return {
      id: r.id, name: r.name, blurb: level >= 1 ? r.blurb : null, nightOnly: r.nightOnly, points, level, next,
      progress: next === null ? 1 : (points - start) / (next - start), thisRun: s.friendship[r.id] ?? 0,
    };
  });
}
