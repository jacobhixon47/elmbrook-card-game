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
  /** From this level, each order of theirs may be their favourite: 1 in 4, at most one a day, +1 Friendship and a bigger tip. */
  favouriteLevel: 4,
  favouriteChance: 0.25,
  favouriteFriendship: 1,
  /** A favourite order also tips this much more gold, so it's worth the harder ask (balance pass, Oct 17). */
  favouriteTip: 6,
  /** A regular's recipe joins the pools at this level, and their familiar at the next (GDD §13). */
  recipeLevel: 5,
  familiarLevel: 7,
  /** From this level a regular brings their own vigil gift instead of a random one (GDD §13, Jacob, Oct 16). */
  vigilGiftLevel: 8,
  /** At this level each of their orders tips this much more gold. */
  tipLevel: 10,
  tipGold: 1,
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

/** What a regular at this level adds to the pools: their recipe from level 5, their familiar from 7. */
export function friendGifts(regular: string, level: number): string[] {
  const r = codex.regulars.get(regular);
  if (!r) return [];
  return [
    ...(r.recipe && level >= FRIENDSHIP.recipeLevel ? [r.recipe] : []),
    ...(r.familiar && level >= FRIENDSHIP.familiarLevel ? [r.familiar] : []),
  ];
}

/** The gold a regular's Friendship adds to the tip on their orders: +1 at level 10, none for anyone else. */
export function friendTip(s: Pick<RunState, 'friendship' | 'friendshipBase'>, customer: string): number {
  return isRegular(customer) && friendLevelOf(s, customer) >= FRIENDSHIP.tipLevel ? FRIENDSHIP.tipGold : 0;
}

/** Slots in the cottage's keepsake box (GDD §13); a second comes later, from an Almanac goal or a perk. */
export const KEEPSAKE_SLOTS = 1;

/** Every card that can be a keepsake: each regular's own vigil gift. */
export const allKeepsakes = () => [...codex.regulars.values()].flatMap((r) => (r.vigilGift ? [r.vigilGift] : []));

/** The keepsakes this Friendship opens: a regular's vigil gift from Friendship 8, in codex order. */
export function keepsakesOpen(friendship: Readonly<Record<string, number>>): string[] {
  return [...codex.regulars.values()].filter((r) => r.vigilGift && friendLevel(friendship[r.id] ?? 0) >= FRIENDSHIP.vigilGiftLevel).map((r) => r.vigilGift!);
}

/** The keepsakes a run sets out with: the box's, still open, up to the slots. */
export function runKeepsakes(p: { keepsakes: readonly string[]; friendship: Readonly<Record<string, number>> }): string[] {
  const open = keepsakesOpen(p.friendship);
  return p.keepsakes.filter((k) => open.includes(k)).slice(0, KEEPSAKE_SLOTS);
}

/** Everything every regular's Friendship adds to the pools: `newRun` adds it to the run's unlocks. */
export function friendUnlocks(friendship: Readonly<Record<string, number>>): string[] {
  return [...codex.regulars.keys()].flatMap((id) => friendGifts(id, friendLevel(friendship[id] ?? 0)));
}

/** A regular's story scene, as the profile remembers it was shown: "old-tobin:3". */
export const storyKey = (regular: string, level: number) => `${regular}:${level}`;

/** Every story scene's key, in codex order. */
export const allStoryKeys = () => [...codex.regulars.values()].flatMap((r) => r.story.map((b) => storyKey(r.id, b.level)));

/**
 * The story scene due this morning (GDD §13), if any: the first regular in codex order with an open
 * order today, and the lowest story level they've reached that hasn't been shown yet.
 */
export function storyDue(s: Pick<RunState, 'orders' | 'friendship' | 'friendshipBase'>, seen: readonly string[]): { regular: string; level: number } | null {
  for (const r of codex.regulars.values()) {
    if (!s.orders.some((o) => o.customer === r.id && o.status === 'open')) continue;
    const level = friendLevelOf(s, r.id);
    const beat = r.story.find((b) => b.level <= level && !seen.includes(storyKey(r.id, b.level)));
    if (beat) return { regular: r.id, level: beat.level };
  }
  return null;
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
  // A recipe or familiar reached mid-run joins this run's pools at once.
  for (const id of friendGifts(regular, level)) if (!s.unlocks.includes(id)) s.unlocks.push(id);
}

/** Friendship banked to the profile after a run: the profile's points plus the run's. */
export function bankFriendship(base: Readonly<Record<string, number>>, earned: Readonly<Record<string, number>>): Record<string, number> {
  const out = { ...base };
  for (const [id, n] of Object.entries(earned)) if (codex.regulars.has(id) && n > 0) out[id] = (out[id] ?? 0) + n;
  return out;
}
