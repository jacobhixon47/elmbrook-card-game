import { codex } from '../codex';
import { FRIENDSHIP, friendLevel, friendshipOf, levelStartAt, nextLevelAt, type GameEvent, type RunState } from '../core';

/**
 * What reaching a Friendship level opens, for the levels that open something so far (GDD §13). The rest
 * (story beats, recipes, familiars, the vigil upgrade, the finale) come with later parts.
 */
export const LEVEL_OPENS: Partial<Record<number, string>> = {
  1: 'Their Townsfolk entry, in the Grimoire.',
  [FRIENDSHIP.vigilLevel]: 'A gift at the Longest Night, and the Hearth Trader knows their name.',
  [FRIENDSHIP.traderBigLevel]: 'The Hearth Trader shows a third card on their name.',
};

/** The toast for Friendship levels an action reached: "Old Tobin: Friendship 2! ...". */
export function levelUpNote(events: readonly GameEvent[]): string | null {
  const lines = events.flatMap((e) => {
    if (e.type !== 'friendshipGained' || !e.levelUp) return [];
    const name = codex.regulars.get(e.regular)?.name ?? e.regular;
    const opens = LEVEL_OPENS[e.level];
    return [`${name}: Friendship ${e.level}!${opens ? ` ${opens}` : ''}`];
  });
  return lines.length ? lines.join(' ') : null;
}

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
  /** What the next level opens, when it opens something yet. */
  nextOpens: string | null;
  /** Never served: no Friendship at all, and not met this run. */
  unmet: boolean;
};

/** The Grimoire's Townsfolk page (GDD §4.1): each regular and your Friendship with them. */
export function townsfolkRows(s: Pick<RunState, 'friendship' | 'friendshipBase'> & { stats?: Pick<RunState['stats'], 'met'> }): TownsfolkRow[] {
  return [...codex.regulars.values()].map((r) => {
    const points = friendshipOf(s, r.id);
    const level = friendLevel(points);
    const next = nextLevelAt(points);
    const start = levelStartAt(points);
    return {
      id: r.id, name: r.name, blurb: level >= 1 ? r.blurb : null, nightOnly: r.nightOnly, points, level, next,
      progress: next === null ? 1 : (points - start) / (next - start), thisRun: s.friendship[r.id] ?? 0,
      nextOpens: next === null ? null : LEVEL_OPENS[level + 1] ?? null, unmet: points === 0 && !s.stats?.met.includes(r.id),
    };
  });
}
