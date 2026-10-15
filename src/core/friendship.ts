import { codex } from '../codex';
import type { Ctx } from './ctx';
import { hasCurse } from './relics';
import type { RunState } from './state';

// Friendship (GDD §4.1, decided with Jacob, Oct 15): one meter per regular that only ever rises and
// lasts the whole save. A run counts what it earns on top of the profile's points, and the points bank
// to the profile when the run ends, won or lost.

export const FRIENDSHIP = {
  /** Points to reach each level, cumulative: level 1 at 5, level 10 at 290. */
  levels: [5, 15, 30, 50, 75, 105, 140, 180, 230, 290],
  /** The level at which a regular brings a gift to the Longest Night vigil. */
  vigilLevel: 2,
  /** The Hearth Trader trades on the name of a regular at this level, for gold. */
  traderLevel: 2,
  traderGold: 6,
  /** At this level the Hearth Trader shows all three Rare cards instead of two. */
  traderBigLevel: 6,
  traderCards: 2,
  traderBigCards: 3,
  traderFamiliars: 1,
} as const;

export const MAX_FRIEND_LEVEL = FRIENDSHIP.levels.length;

/** Whether this customer is a regular, the only ones with Friendship. */
export const isRegular = (id: string) => codex.regulars.has(id);

/** The level these points reach, 0 to 10. */
export function friendLevel(points: number): number {
  return FRIENDSHIP.levels.filter((at) => points >= at).length;
}

/** Points needed for the next level, or null at the top. */
export function nextLevelAt(points: number): number | null {
  return FRIENDSHIP.levels.find((at) => points < at) ?? null;
}

/** Points the level before `points`' next one starts at (0 below level 1). */
export function levelStartAt(points: number): number {
  const level = friendLevel(points);
  return level === 0 ? 0 : FRIENDSHIP.levels[level - 1]!;
}

/** A regular's Friendship: the profile's points plus what this run has earned. */
export function friendshipOf(s: Pick<RunState, 'friendship' | 'friendshipBase'>, regular: string): number {
  return (s.friendshipBase[regular] ?? 0) + (s.friendship[regular] ?? 0);
}

export const friendLevelOf = (s: Pick<RunState, 'friendship' | 'friendshipBase'>, regular: string) => friendLevel(friendshipOf(s, regular));

/** The regular with the most Friendship, first in codex order on a tie, or null when no one has any. */
export function bestFriend(s: Pick<RunState, 'friendship' | 'friendshipBase'>): string | null {
  let best: string | null = null;
  for (const id of codex.regulars.keys()) if (friendshipOf(s, id) > (best ? friendshipOf(s, best) : 0)) best = id;
  return best;
}

/** Friendship earned with a regular. Nameless: no one remembers you, so nothing is earned. Others aren't regulars and have none. */
export function befriend(ctx: Ctx, regular: string, points: number): void {
  const s = ctx.s;
  if (points <= 0 || !codex.regulars.has(regular) || hasCurse(s, 'nameless')) return;
  const before = friendshipOf(s, regular);
  s.friendship[regular] = (s.friendship[regular] ?? 0) + points;
  const total = before + points;
  const level = friendLevel(total);
  ctx.ev.push({ type: 'friendshipGained', regular, points, total, level, levelUp: level > friendLevel(before) });
}

/** Friendship banked to the profile after a run: the profile's points plus the run's. */
export function bankFriendship(base: Readonly<Record<string, number>>, earned: Readonly<Record<string, number>>): Record<string, number> {
  const out = { ...base };
  for (const [id, n] of Object.entries(earned)) if (codex.regulars.has(id) && n > 0) out[id] = (out[id] ?? 0) + n;
  return out;
}
