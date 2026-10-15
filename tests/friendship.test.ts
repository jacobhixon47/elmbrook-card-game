import { codex } from '../src/codex';
import { describe, expect, it } from 'vitest';
import {
  bankFriendship, bestFriend, satisfies, friendLevel, FRIENDSHIP, levelStartAt, migrateProfile, migrateRun, newProfile, newStats, nextLevelAt, recordRun, reduce,
  type Order, type RunState,
} from '../src/core';
import { brewing, ofType, ok, slotAll, withHand } from './helpers';
import { townsfolkRows, friendshipLine, levelUpNote } from '../src/view/townsfolk';

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

/** Brew elmroot and creekwater straight into order 500. */
function deliver(s: RunState, o: Partial<Order> = {}) {
  const [h, uids] = withHand({ ...s, orders: [order(o)], fog: false }, ['elmroot', 'creekwater']);
  return reduce(slotAll(h, uids), { type: 'brew', deliverTo: 500 });
}

describe('Friendship levels (GDD §4.1)', () => {
  it('ten levels on a rising curve, from 5 points to 290', () => {
    expect(FRIENDSHIP.levels).toEqual([5, 15, 30, 50, 75, 105, 140, 180, 230, 290]);
    expect([0, 4, 5, 14, 15, 289, 290, 9999].map(friendLevel)).toEqual([0, 0, 1, 1, 2, 9, 10, 10]);
    expect(nextLevelAt(0)).toBe(5);
    expect(nextLevelAt(20)).toBe(30);
    expect(nextLevelAt(290)).toBeNull();
    expect(levelStartAt(20)).toBe(15);
    expect(levelStartAt(3)).toBe(0);
  });

  it('a delivery to a regular counts on top of the profile, and says when a level is reached', () => {
    const s = { ...brewing('friends'), friendshipBase: { 'old-tobin': 4 } };
    const r = deliver(s);
    expect(r.state.friendship['old-tobin']).toBe(1);
    expect(ofType(r.events, 'friendshipGained')).toEqual([{ type: 'friendshipGained', regular: 'old-tobin', points: 1, total: 5, level: 1, levelUp: true }]);
  });

  it('Nameless: no one remembers you, so nothing is earned', () => {
    const named = deliver({ ...brewing('friends'), curses: ['nameless'] });
    expect(named.state.friendship).toEqual({});
  });

  it('the best friend leads the Hearth Trader; no one has any at first', () => {
    const s = brewing('friends');
    expect(bestFriend(s)).toBeNull();
    expect(bestFriend({ ...s, friendshipBase: { 'sister-alder': 9 }, friendship: { 'old-tobin': 4, 'sister-alder': 1 } })).toBe('sister-alder');
  });
});

describe('Friendship across runs', () => {
  it('a run starts from the profile\'s Friendship, and banks what it earns, won or lost', () => {
    const s = ok(null as unknown as RunState, { type: 'startRun', seed: 'f', witch: 'hedge-witch', friendship: { 'old-tobin': 12, nobody: 3 } }).state;
    expect(s.friendshipBase).toEqual({ 'old-tobin': 12 });
    expect(s.friendship).toEqual({});
    const profile = { ...newProfile(), friendship: { 'old-tobin': 12 } };
    const lost = recordRun(profile, { seed: 'f1', season: 'spring', phase: 'game-over', week: 2, stats: newStats(), friendship: { 'old-tobin': 3, 'bea-thornwick': 2 } });
    expect(lost.profile.friendship).toEqual({ 'old-tobin': 15, 'bea-thornwick': 2 });
    const won = recordRun(lost.profile, { seed: 'f2', season: 'spring', phase: 'victory', week: 4, stats: newStats(), friendship: { 'old-tobin': 1 } });
    expect(won.profile.friendship['old-tobin']).toBe(16);
    // A run still going banks nothing.
    expect(recordRun(profile, { seed: 'f3', season: 'spring', phase: 'brewing', week: 2, stats: newStats(), friendship: { 'old-tobin': 9 } }).profile).toBe(profile);
    expect(bankFriendship({ a: 1 }, { 'old-tobin': 0 })).toEqual({ a: 1 });
  });

  it('a version 9 profile starts with no Friendship; junk is repaired', () => {
    expect(migrateProfile({ ...newProfile(), version: 9, friendship: undefined }).friendship).toEqual({});
    expect(migrateProfile({ ...newProfile(), friendship: { 'old-tobin': 7.6, 'sister-alder': -2, nobody: 4, 'bea-thornwick': 'x' } }).friendship).toEqual({ 'old-tobin': 7 });
  });

  it('a version 19 run\'s regulars\' hearts become Friendship earned this run', () => {
    const old: Record<string, unknown> = { ...brewing('friends'), version: 19, hearts: { 'old-tobin': 4, 'wisp-courier': 2, 'bea-thornwick': 0 } };
    delete old.friendship;
    delete old.friendshipBase;
    const s = migrateRun(old)!;
    expect(s.friendship).toEqual({ 'old-tobin': 4 });
    expect(s.friendshipBase).toEqual({});
    expect('hearts' in s).toBe(false);
  });
});

describe('the Townsfolk page', () => {
  it('lists every regular with their level, and their entry from level 1', () => {
    const rows = townsfolkRows({ friendship: { 'old-tobin': 3 }, friendshipBase: { 'old-tobin': 17 } });
    const tobin = rows.find((r) => r.id === 'old-tobin')!;
    expect(tobin).toMatchObject({ points: 20, level: 2, next: 30, thisRun: 3, progress: 1 / 3 });
    expect(tobin.blurb).toBeTruthy();
    expect(rows.find((r) => r.id === 'bea-thornwick')).toMatchObject({ level: 0, blurb: null, next: 5 });
    expect(rows.find((r) => r.id === 'the-gardener')!.nightOnly).toBe(true);
    expect(friendshipLine(20)).toBe('♥ 2 · 20/30');
    expect(friendshipLine(300)).toBe('♥ 10 · best friends');
  });

  it('says what the next level opens, and hides regulars you have never met', () => {
    const rows = townsfolkRows({ friendship: {}, friendshipBase: { 'old-tobin': 6 }, stats: { met: ['sister-alder'] } });
    expect(rows.find((r) => r.id === 'old-tobin')).toMatchObject({ level: 1, unmet: false, nextOpens: expect.stringMatching(/Longest Night/) as unknown as string });
    expect(rows.find((r) => r.id === 'sister-alder')).toMatchObject({ unmet: false, nextOpens: expect.stringMatching(/Townsfolk/) as unknown as string });
    expect(rows.find((r) => r.id === 'bea-thornwick')!.unmet).toBe(true);
    // Level 3 opens nothing yet.
    expect(townsfolkRows({ friendship: {}, friendshipBase: { 'old-tobin': 20 } }).find((r) => r.id === 'old-tobin')!.nextOpens).toBeNull();
  });
});

describe('level-up toasts', () => {
  it('names the regular, the level and what it opens', () => {
    const s = { ...brewing('friends'), friendshipBase: { 'old-tobin': 14 } };
    expect(levelUpNote(deliver(s).events)).toBe('Old Tobin: Friendship 2! A gift at the Longest Night, and the Hearth Trader knows their name.');
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': 29 } }).events)).toBe('Old Tobin: Friendship 3!');
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': 20 } }).events)).toBeNull();
  });
});

describe('favourite orders (Friendship level 4)', () => {
  const all = (points: number) => Object.fromEntries([...codex.regulars.keys()].map((id) => [id, points]));
  const day1 = (seed: string, points: number) => reduce(null, { type: 'startRun', seed, witch: 'hedge-witch', friendship: all(points) }).state;

  it('every regular has one: a family the recipes have and a tag some ingredient has', () => {
    for (const r of codex.regulars.values()) {
      expect(r.favourite, r.id).toBeDefined();
      expect([...codex.recipes.values()].some((x) => x.family === r.favourite!.family), r.id).toBe(true);
      expect([...codex.ingredients.values()].some((i) => i.tags.includes(r.favourite!.tag)), r.id).toBe(true);
    }
  });

  it('turn up from level 4, at most one a day, and never below', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `fav-${i}`);
    const below = seeds.flatMap((x) => day1(x, FRIENDSHIP.levels[FRIENDSHIP.favouriteLevel - 1]! - 1).orders);
    expect(below.some((o) => o.favourite)).toBe(false);
    const boards = seeds.map((x) => day1(x, FRIENDSHIP.levels[FRIENDSHIP.favouriteLevel - 1]!).orders);
    expect(boards.every((b) => b.filter((o) => o.favourite).length <= 1)).toBe(true);
    const favs = boards.flat().filter((o) => o.favourite);
    expect(favs.length).toBeGreaterThan(0);
    for (const o of favs) {
      const fav = codex.regulars.get(o.customer)!.favourite!;
      expect(o.request).toEqual({ kind: 'family', family: fav.family });
      expect(o.favourite).toEqual({ tag: fav.tag });
    }
  });

  it('need an ingredient of their tag, and earn +1 Friendship', () => {
    const fav = order({ request: { kind: 'family', family: 'healing' }, favourite: { tag: 'herb' } });
    const potion = { recipe: 'healing-draught', family: 'healing' as const, tier: 'fine' as const };
    expect(satisfies({ ...potion, ingredients: ['elmroot', 'creekwater'] }, fav)).toBe(false);
    const herb = [...codex.ingredients.values()].find((i) => i.tags.includes('herb'))!.id;
    expect(satisfies({ ...potion, ingredients: ['elmroot', herb] }, fav)).toBe(true);
    const s = { ...brewing('friends'), orders: [fav], shelf: [{ uid: 600, ...potion, quality: 14, ingredients: ['elmroot', herb], experiment: false, heartDelta: 0 }] };
    const r = ok(s, { type: 'deliver', order: 500, potion: 600 });
    expect(r.state.friendship['old-tobin']).toBe(1 + FRIENDSHIP.favouriteFriendship);
  });
});
