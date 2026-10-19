import { codex } from '../codex';
import { unlockName } from './describe';
import { FRIENDSHIP, friendLevel, friendshipOf, levelStartAt, nextLevelAt, storyKey, type GameEvent, type RunState } from '../core';

/**
 * What reaching a Friendship level opens for every regular (GDD §13). A regular's own recipe, familiar
 * and story come from the codex (`levelOpens`); the vigil upgrade comes with a later part.
 */
export const LEVEL_OPENS: Partial<Record<number, string>> = {
  1: 'Their Townsfolk entry, in the Grimoire.',
  [FRIENDSHIP.vigilLevel]: 'A gift at the Longest Night, and the Hearth Trader knows their name.',
  [FRIENDSHIP.favouriteLevel]: 'Their favourite order turns up now and then, for +1 Friendship.',
  [FRIENDSHIP.traderBigLevel]: 'The Hearth Trader shows a third card on their name.',
  [FRIENDSHIP.tipLevel]: '+1 gold tip on every order of theirs.',
};

/** What reaching this level with this regular opens, or null when nothing yet. */
export function levelOpens(regular: string, level: number): string | null {
  const r = codex.regulars.get(regular);
  const parts = [LEVEL_OPENS[level]];
  if (r?.recipe && level === FRIENDSHIP.recipeLevel) parts.push(`Their recipe, ${unlockName(r.recipe)}, joins your pools.`);
  if (r?.familiar && level === FRIENDSHIP.familiarLevel) parts.push(`Their familiar, the ${unlockName(r.familiar)}, joins your pools.`);
  if (r?.vigilGift && level === FRIENDSHIP.vigilGiftLevel) parts.push(`At the Longest Night they bring ${unlockName(r.vigilGift)}.`);
  if (r?.story.some((b) => b.level === level)) parts.push('A new story, next time they come in.');
  const out = parts.filter(Boolean).join(' ');
  return out || null;
}

/** The toast for Friendship levels an action reached: "Old Tobin: Friendship 2! ...". */
export function levelUpNote(events: readonly GameEvent[]): string | null {
  const lines = events.flatMap((e) => {
    if (e.type !== 'friendshipGained' || !e.levelUp) return [];
    const name = codex.regulars.get(e.regular)?.name ?? e.regular;
    const opens = levelOpens(e.regular, e.level);
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
  /** Their story scenes shown so far, to read again. */
  stories: { level: number; title: string }[];
};

/** The Grimoire's Townsfolk page (GDD §4.1): each regular and your Friendship with them. */
export function townsfolkRows(s: Pick<RunState, 'friendship' | 'friendshipBase'> & { stats?: Pick<RunState['stats'], 'met'> }, storySeen: readonly string[] = []): TownsfolkRow[] {
  return [...codex.regulars.values()].map((r) => {
    const points = friendshipOf(s, r.id);
    const level = friendLevel(points);
    const next = nextLevelAt(points);
    const start = levelStartAt(points);
    return {
      id: r.id, name: r.name, blurb: level >= 1 ? r.blurb : null, nightOnly: r.nightOnly, points, level, next,
      progress: next === null ? 1 : (points - start) / (next - start), thisRun: s.friendship[r.id] ?? 0,
      nextOpens: next === null ? null : levelOpens(r.id, level + 1), unmet: points === 0 && !s.stats?.met.includes(r.id),
      stories: r.story.filter((b) => storySeen.includes(storyKey(r.id, b.level))).map((b) => ({ level: b.level, title: b.title })),
    };
  });
}

/** A regular's story at this level, as a scene screen. */
export function storyScene(regular: string, level: number): { name: string; lines: string[]; portrait: string } {
  const beat = codex.regulars.get(regular)!.story.find((b) => b.level === level)!;
  return { name: beat.title, lines: beat.lines, portrait: regular };
}
