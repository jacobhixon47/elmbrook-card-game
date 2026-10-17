import { codex } from '../src/codex';
import { describe, expect, it } from 'vitest';
import {
  allCards, bankFriendship, bestFriend, KEEPSAKE_SLOTS, keepsakesOpen, runKeepsakes, FAMILIAR_SCORE, familiarPool, fencePrice, friendUnlocks, recipeAvailable, satisfies, storyDue, storyKey, friendLevel, FRIENDSHIP, levelStartAt, payout, migrateProfile, migrateRun, newProfile, newStats, nextLevelAt, recordRun, reduce,
  type Order, type RunState,
} from '../src/core';
import { brewing, ofType, ok, slotAll, withHand } from './helpers';
import { townsfolkRows, friendshipLine, levelUpNote, storyScene } from '../src/view/townsfolk';

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
    // Level 3 is a story for Tobin; level 2 opens nothing more for him.
    expect(townsfolkRows({ friendship: {}, friendshipBase: { 'old-tobin': 20 } }).find((r) => r.id === 'old-tobin')!.nextOpens).toMatch(/A new story/);
    expect(townsfolkRows({ friendship: {}, friendshipBase: { 'old-tobin': 50 } }).find((r) => r.id === 'old-tobin')!.nextOpens).toBe("Their recipe, Miner's Balm, joins your pools.");
  });
});

describe('level-up toasts', () => {
  it('names the regular, the level and what it opens', () => {
    const s = { ...brewing('friends'), friendshipBase: { 'old-tobin': 14 } };
    expect(levelUpNote(deliver(s).events)).toBe('Old Tobin: Friendship 2! A gift at the Longest Night, and the Hearth Trader knows their name.');
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': 29 } }).events)).toBe('Old Tobin: Friendship 3! A new story, next time they come in.');
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': 74 } }).events)).toBe("Old Tobin: Friendship 5! Their recipe, Miner's Balm, joins your pools.");
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': 139 } }).events)).toBe('Old Tobin: Friendship 7! Their familiar, the Canary, joins your pools.');
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

  it('tip more gold than the same order would, so the harder ask pays (balance pass)', () => {
    const potion = { tier: 'crude' as const, ingredients: ['elmroot', 'mint-sprig'] };
    const plain = payout(potion, order());
    expect(payout(potion, order({ favourite: { tag: 'herb' } }))).toEqual({ ...plain, tip: plain.tip + FRIENDSHIP.favouriteTip });
  });
});

describe("regulars' recipes, familiars and stories (GDD §13)", () => {
  const at = (level: number) => FRIENDSHIP.levels[level - 1]!;

  it('a recipe joins the pools at level 5 and a familiar at 7, from the run start or the moment it is reached', () => {
    expect(friendUnlocks({ 'old-tobin': at(5) - 1 })).toEqual([]);
    expect(friendUnlocks({ 'old-tobin': at(5), 'bea-thornwick': at(7) })).toEqual(['rising-loaf-tonic', 'kitchen-mouse', 'miners-balm']);
    expect(friendUnlocks({ 'sister-alder': at(10) })).toEqual(['vesper-tea', 'dove']);
    expect(friendUnlocks({ 'marlowe-vance': at(10) })).toEqual(['silver-tongue', 'pack-mule']);
    // Every regular has their recipe and familiar now.
    for (const r of codex.regulars.values()) expect(friendUnlocks({ [r.id]: at(10) }), r.id).toHaveLength(2);
    const s = reduce(null, { type: 'startRun', seed: 'g', witch: 'hedge-witch', unlocks: ['fox'], friendship: { 'old-tobin': at(7) } }).state;
    expect(s.unlocks).toEqual(['fox', 'miners-balm', 'canary']);
    expect(recipeAvailable(codex.recipes.get('miners-balm')!, s)).toBe(true);
    expect(familiarPool(s).map((f) => f.id)).toContain('canary');
    expect(familiarPool({ ...s, unlocks: [] }).map((f) => f.id)).not.toContain('canary');
    // Reached mid-run: their recipe joins this run's pools.
    const r = deliver({ ...brewing('friends'), friendshipBase: { 'old-tobin': at(5) - 1 } });
    expect(r.state.unlocks).toContain('miners-balm');
    expect(deliver({ ...brewing('friends'), friendshipBase: { 'old-tobin': at(5) - 2 } }).state.unlocks).not.toContain('miners-balm');
  });

  it('the Kitchen Mouse likes Fruit, the Canary sings for a Mineral, the Squirrel likes the Wychwood and the Dove shuns Umbra', () => {
    const ing = (id: string) => codex.ingredients.get(id)!;
    const fruit = [...codex.ingredients.values()].find((i) => i.tags.includes('fruit'))!;
    const brew = (ids: string[]) => ({ ingredients: ids.map(ing), firstPotency: 0, shelf: 0, night: false, firstBrew: false });
    expect(FAMILIAR_SCORE['kitchen-mouse']!(brew([fruit.id, fruit.id]))).toMatchObject({ potency: 6 });
    expect(FAMILIAR_SCORE['kitchen-mouse']!(brew(['elmroot', 'creekwater']))).toBeNull();
    expect(FAMILIAR_SCORE.canary!(brew(['river-clay', 'river-clay']))).toMatchObject({ harmony: 2 });
    expect(FAMILIAR_SCORE.canary!(brew(['elmroot', 'creekwater']))).toBeNull();
    // Thistledown and Nightshade are from the Wychwood; Elmroot and Creekwater aren't.
    expect(FAMILIAR_SCORE.squirrel!(brew(['thistledown', 'nightshade']))).toMatchObject({ potency: 6 });
    expect(FAMILIAR_SCORE.squirrel!(brew(['elmroot', 'creekwater']))).toBeNull();
    expect(FAMILIAR_SCORE.dove!(brew(['elmroot', 'creekwater']))).toMatchObject({ harmony: 2 });
    expect(FAMILIAR_SCORE.dove!(brew(['elmroot', 'nightshade']))).toBeNull();
    expect(FAMILIAR_SCORE.nightjar!(brew(['moonpetal', 'starlit-dew']))).toMatchObject({ potency: 6 });
    expect(FAMILIAR_SCORE.nightjar!(brew(['elmroot', 'creekwater']))).toBeNull();
    // The Pack Mule pays at the Fence instead.
    const potion = { tier: 'fine' as const, ingredients: ['elmroot', 'creekwater'], family: 'healing' as const };
    expect(fencePrice(potion, { season: 'spring', familiars: ['pack-mule'] })).toBe(fencePrice(potion, { season: 'spring', familiars: [] }) + 2);
  });

  it('each story is in level order, at 3, 6, 9 and 10, for every regular', () => {
    for (const id of codex.regulars.keys()) expect(codex.regulars.get(id)!.story.map((b) => b.level)).toEqual([3, 6, 9, 10]);
    for (const r of codex.regulars.values()) {
      const levels = r.story.map((b) => b.level);
      expect(levels, r.id).toEqual([...levels].sort((a, b) => a - b));
      if (r.recipe) expect(codex.recipes.get(r.recipe)?.pool, r.id).toBe('friend');
      if (r.familiar) expect(codex.familiars.get(r.familiar)?.pool, r.id).toBe('friend');
    }
  });

  it('a story is due when a regular with an order has reached it, lowest first, once each', () => {
    const tobin = order({ customer: 'old-tobin' });
    const s = { orders: [tobin], friendship: {}, friendshipBase: { 'old-tobin': at(6) } };
    expect(storyDue(s, [])).toEqual({ regular: 'old-tobin', level: 3 });
    expect(storyDue(s, [storyKey('old-tobin', 3)])).toEqual({ regular: 'old-tobin', level: 6 });
    expect(storyDue(s, [storyKey('old-tobin', 3), storyKey('old-tobin', 6)])).toBeNull();
    // No order from them today, or the order is already filled: not today.
    expect(storyDue({ ...s, orders: [] }, [])).toBeNull();
    expect(storyDue({ ...s, orders: [{ ...tobin, status: 'filled' }] }, [])).toBeNull();
    expect(storyDue({ ...s, friendshipBase: { 'old-tobin': at(3) - 1 } }, [])).toBeNull();
    // Bea comes first in codex order.
    expect(storyDue({ orders: [tobin, order({ id: 501, customer: 'bea-thornwick' })], friendship: {}, friendshipBase: { 'old-tobin': at(3), 'bea-thornwick': at(3) } }, [])).toEqual({ regular: 'bea-thornwick', level: 3 });
  });

  it('the profile remembers stories seen; a version 10 profile has seen none, and junk is dropped', () => {
    expect(newProfile().storySeen).toEqual([]);
    expect(migrateProfile({ ...newProfile(), version: 10, storySeen: undefined }).storySeen).toEqual([]);
    expect(migrateProfile({ ...newProfile(), storySeen: ['old-tobin:6', 'old-tobin:4', 'nobody:3', 7, 'bea-thornwick:3'] }).storySeen).toEqual(['bea-thornwick:3', 'old-tobin:6']);
  });

  it('the Townsfolk page lists the stories seen, to read again', () => {
    const rows = townsfolkRows({ friendship: {}, friendshipBase: { 'old-tobin': at(6) } }, [storyKey('old-tobin', 3)]);
    expect(rows.find((r) => r.id === 'old-tobin')!.stories).toEqual([{ level: 3, title: 'The Cough' }]);
    expect(rows.find((r) => r.id === 'bea-thornwick')!.stories).toEqual([]);
    expect(storyScene('old-tobin', 10).name).toBe('Up Into the Light');
  });
});

describe('Friendship part 4: the level 8 vigil gift and the level 10 tip (GDD §13)', () => {
  const at = (level: number) => FRIENDSHIP.levels[level - 1]!;

  it('every regular has their own vigil gift, an event card', () => {
    for (const r of codex.regulars.values()) {
      expect(r.vigilGift, r.id).toBeDefined();
      const card = codex.ingredients.get(r.vigilGift!) ?? codex.tinctures.get(r.vigilGift!);
      expect(card?.pool, r.id).toBe('event');
    }
  });

  it('a regular at Friendship 10 tips 1 more gold on their orders, and no one else does', () => {
    const s = brewing('friends');
    const tip = (base: Record<string, number>, o: Partial<Order> = {}) =>
      ofType(deliver({ ...s, friendshipBase: base }, o).events, 'orderFilled')[0]!.tip;
    expect(tip({ 'old-tobin': at(10) }) - tip({ 'old-tobin': at(9) })).toBe(FRIENDSHIP.tipGold);
    expect(tip({ 'old-tobin': at(10) }, { customer: 'bea-thornwick' })).toBe(tip({}, { customer: 'bea-thornwick' }));
  });

  it('the level-up toasts name the gift and the tip', () => {
    const s = brewing('friends');
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': at(8) - 1 } }).events)).toBe('Old Tobin: Friendship 8! At the Longest Night they bring Lantern Coal.');
    expect(levelUpNote(deliver({ ...s, friendshipBase: { 'old-tobin': at(10) - 1 } }).events)).toMatch(/^Old Tobin: Friendship 10! \+1 gold tip on every order of theirs\./);
  });
});

describe('the keepsake box (GDD §13)', () => {
  const at8 = FRIENDSHIP.levels[FRIENDSHIP.vigilGiftLevel - 1]!;
  const run = (keepsakes: string[], extra: Partial<{ year: number; seed: string }> = {}) =>
    reduce(null, { type: 'startRun', seed: extra.seed ?? 'keep', witch: 'hedge-witch', keepsakes, ...(extra.year ? { year: extra.year } : {}) }).state;

  it('opens a regular\'s own vigil gift at Friendship 8, one slot for now', () => {
    expect(KEEPSAKE_SLOTS).toBe(1);
    expect(keepsakesOpen({})).toEqual([]);
    expect(keepsakesOpen({ 'old-tobin': at8, 'bea-thornwick': at8 - 1 })).toEqual(['lantern-coal']);
    expect(runKeepsakes({ keepsakes: ['lantern-coal'], friendship: { 'old-tobin': at8 } })).toEqual(['lantern-coal']);
    expect(runKeepsakes({ keepsakes: ['honey-loaf'], friendship: { 'old-tobin': at8 } })).toEqual([]);
  });

  it('adds the keepsake to the starting deck, on top of the usual cards', () => {
    const plain = run([]);
    const kept = run(['honey-loaf']);
    expect(allCards(kept)).toHaveLength(allCards(plain).length + 1);
    expect(allCards(kept).some((c) => c.card === 'honey-loaf')).toBe(true);
    expect(kept.stats.met).toContain('honey-loaf');
    // Night Lily is a Lunar card: it waits in the Night Satchel.
    expect(run(['night-lily']).satchel.map((c) => c.card)).toContain('night-lily');
    expect(() => run(['elmroot'])).toThrow(/not a keepsake/);
  });

  it('brings none on a run that starts Nameless', () => {
    for (let i = 0; i < 200; i++) {
      const s = run(['honey-loaf'], { year: 7, seed: `nameless-${i}` });
      if (!s.curses.includes('nameless')) continue;
      expect(allCards(s).some((c) => c.card === 'honey-loaf')).toBe(false);
      return;
    }
    throw new Error('no seed started Nameless');
  });

  it('is kept in the profile from version 12, holding only real keepsakes', () => {
    expect(newProfile().keepsakes).toEqual([]);
    expect(migrateProfile({ ...newProfile(), version: 11, keepsakes: undefined }).keepsakes).toEqual([]);
    expect(migrateProfile({ ...newProfile(), keepsakes: ['lantern-coal', 'elmroot', 'honey-loaf'] }).keepsakes).toEqual(['lantern-coal']);
  });
});
