import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEASONS, type Season, allCards, almanacMet, CODEX_TABLES, codexMet, almanacUnlocks, ALMANAC_GOALS, buyPerk, newStats, relicPool, migrateProfile, newRun, SHELF_SLOTS, START_GOLD, FAMILIAR_SLOTS, migrateRun, newProfile, nextSeason, perkBlocked, perkTierOpen, perkTierGoal, PERK_TIERS, CAULDRON_SLOTS, PROFILE_VERSION, recordRun, replay, REPUTATION, reputationFor, RUN_MIGRATIONS, RUN_VERSION } from '../src/core';
import { loadProfile, recordFinishedRun, saveProfile } from '../src/profile';
import { playRun } from '../src/sim/run';
import { brewing } from './helpers';
import { codex } from '../src/codex';

const end = (season: 'spring' | 'summer' | 'autumn' | 'winter', phase: 'victory' | 'game-over' | 'morning', seed = 'r1', week = 4) =>
  ({ seed, season, phase, week, stats: { ...newStats(), ordersFilled: 20, potionsSold: 3 } });

describe('the profile', () => {
  it('migrates the M2.5 profile, keeping the tutorial', () => {
    const p = migrateProfile({ tutorialDone: true });
    expect(p).toEqual({ ...newProfile(), tutorialDone: true });
    expect(p.version).toBe(PROFILE_VERSION);
  });

  it('starts fresh from nothing, junk, or a newer build', () => {
    for (const raw of [null, 'x', 3, [], { version: PROFILE_VERSION + 1, tutorialDone: true }, { version: -1 }]) expect(migrateProfile(raw)).toEqual(newProfile());
  });

  it('migrates a version 1 profile, adding Reputation and perks', () => {
    const p = migrateProfile({ version: 1, tutorialDone: true, seasons: ['spring', 'summer'], runs: 4, wins: { spring: 2 }, years: 0, lastRun: 'x' });
    expect(p).toMatchObject({ version: PROFILE_VERSION, yearSeasons: [['spring', 'summer']], runs: 4, reputation: 0, reputationEarned: 0, perks: [] });
  });

  it('repairs a current profile with bad fields', () => {
    const p = migrateProfile({ version: PROFILE_VERSION, yearSeasons: [['winter', 'nope']], runs: -3, wins: { summer: 2.7, autumn: 'x' }, years: 1, lastRun: 4, perks: ['nest-egg', 'nope'], reputation: 'lots' });
    expect(p.perks).toEqual(['nest-egg']);
    expect(p.reputation).toBe(0);
    expect(p.yearSeasons).toEqual([['spring', 'winter']]);
    expect(p.runs).toBe(0);
    expect(p.wins).toEqual({ spring: 0, summer: 2, autumn: 0, winter: 0 });
    expect(p.years).toBe(1);
    expect(p.lastRun).toBeNull();
  });

  it('a win opens the next season, once', () => {
    const won = recordRun(newProfile(), end('spring', 'victory'));
    expect(won.opened).toBe('summer');
    expect(won.profile).toMatchObject({ yearSeasons: [['spring', 'summer']], runs: 1, wins: { spring: 1 }, lastRun: 'r1' });
    // The same run again changes nothing; another win in Spring opens nothing new.
    expect(recordRun(won.profile, end('spring', 'victory')).profile).toBe(won.profile);
    expect(recordRun(won.profile, end('spring', 'victory', 'r2')).opened).toBeNull();
  });

  it('a loss counts the run and opens nothing; a run still going is not counted', () => {
    const lost = recordRun(newProfile(), end('spring', 'game-over'));
    expect(lost).toMatchObject({ opened: null, yearDone: false, profile: { runs: 1, yearSeasons: [['spring']] } });
    const p = newProfile();
    expect(recordRun(p, end('spring', 'morning')).profile).toBe(p);
  });

  it('winning Winter completes a Year', () => {
    const p = { ...newProfile(), yearSeasons: [[...SEASONS]] };
    const out = recordRun(p, end('winter', 'victory'));
    expect(out).toMatchObject({ opened: null, yearDone: true, profile: { years: 1 } });
    expect(nextSeason('autumn')).toBe('winter');
    expect(nextSeason('winter')).toBeNull();
  });

  it('keeps seasons in Year order when one opens out of turn', () => {
    const p = { ...newProfile(), yearSeasons: [['spring', 'winter'] as Season[]] };
    expect(recordRun(p, end('spring', 'victory')).profile.yearSeasons).toEqual([['spring', 'summer', 'winter']]);
  });
});

describe('Reputation and perks', () => {
  it('pays for weeks survived, orders, potions sold and a win', () => {
    const stats = { ...newStats(), ordersFilled: 20, potionsSold: 3 };
    expect(reputationFor({ phase: 'victory', week: 4, stats })).toBe(4 * REPUTATION.week + 20 + 3 + REPUTATION.win);
    expect(reputationFor({ phase: 'game-over', week: 3, stats })).toBe(2 * REPUTATION.week + 23);
    expect(reputationFor({ phase: 'game-over', week: 1, stats: newStats() })).toBe(0);
  });

  it('a finished run adds its Reputation once, win or lose', () => {
    const lost = recordRun(newProfile(), end('spring', 'game-over', 'r1', 3));
    expect(lost.reputation).toBe(2 * REPUTATION.week + 23);
    expect(lost.profile).toMatchObject({ reputation: lost.reputation, reputationEarned: lost.reputation });
    expect(recordRun(lost.profile, end('spring', 'game-over', 'r1', 3)).reputation).toBe(0);
  });

  it('perks change how a run starts', () => {
    const plain = newRun('perks', 'hedge-witch').state;
    const s = newRun('perks', 'hedge-witch', 'spring', [], ['nest-egg', 'deep-shelf', 'old-spoon', 'spare-perch']).state;
    expect(s.gold).toBe(START_GOLD + 5);
    expect(s.shelfSize).toBe(SHELF_SLOTS + 1);
    expect(s.familiarSlots).toBe(FAMILIAR_SLOTS + 1);
    expect(allCards(s).length).toBe(allCards(plain).length + 1);
    expect(allCards(s).filter((c) => c.card === 'stir').length).toBe(allCards(plain).filter((c) => c.card === 'stir').length + 1);
    expect(() => newRun('perks', 'hedge-witch', 'spring', [], ['nope'])).toThrow(/unknown perk/);
  });

  it('counts orders filled and potions sold as the run goes', () => {
    expect(newRun('stats', 'hedge-witch').state.stats).toEqual({ ...newStats(), met: expect.arrayContaining(['stir']) as unknown as string[] });
    const rec = playRun('stats', { strategy: 'greedy' });
    const { state, events } = replay(rec.actions);
    expect(state.stats.ordersFilled).toBe(rec.ordersFilled);
    expect(state.stats.potionsSold).toBe(events.filter((e) => e.type === 'potionSold').length);
    expect(state.stats.ordersFilled).toBeGreaterThan(0);
    expect(state.stats.rentsPaid).toBe(events.filter((e) => e.type === 'rentPaid').length);
    expect(state.stats.bestTier).toBeGreaterThanOrEqual(0);
  });

  it('perks cost Reputation, once each', () => {
    const p = { ...newProfile(), reputation: 30 };
    expect(perkBlocked(p, 'spare-perch')).toMatch(/35 Reputation/);
    expect(perkBlocked(p, 'nope')).toMatch(/no perk/);
    const bought = buyPerk(p, 'deep-shelf');
    expect(bought).toMatchObject({ reputation: 10, perks: ['deep-shelf'] });
    expect(perkBlocked(bought, 'deep-shelf')).toMatch(/already/);
    expect(() => buyPerk(bought, 'deep-shelf')).toThrow(/already/);
  });
});

describe('the tiered perk board', () => {
  const tiers = [1, ...PERK_TIERS.map((r) => r.tier)];
  const almanac = (n: number) => [...codex.almanac.keys()].slice(0, n);

  it('has every tier filled, four perks at most each, dearer as it climbs', () => {
    const perks = [...codex.perks.values()];
    for (const t of tiers) expect(perks.filter((p) => p.tier === t).length).toBeGreaterThan(0);
    for (const t of tiers) expect(perks.filter((p) => p.tier === t).length).toBeLessThanOrEqual(4);
    for (const t of tiers.slice(1)) {
      const cheapest = Math.min(...perks.filter((p) => p.tier === t).map((p) => p.cost));
      expect(cheapest).toBeGreaterThan(Math.max(...perks.filter((p) => p.tier === t - 1).map((p) => p.cost)));
    }
    for (const card of perks.flatMap((p) => p.start.cards ?? [])) expect(codex.tinctures.has(card) || codex.ingredients.has(card)).toBe(true);
  });

  it('opens later tiers with Years and the Almanac', () => {
    const fresh = newProfile();
    expect(tiers.filter((t) => perkTierOpen(fresh, t))).toEqual([1]);
    expect(perkTierOpen({ ...fresh, years: 1 }, 2)).toBe(true);
    expect(perkTierOpen({ ...fresh, almanac: almanac(4) }, 2)).toBe(true);
    expect(perkTierOpen({ ...fresh, almanac: almanac(3) }, 2)).toBe(false);
    expect(perkTierOpen({ ...fresh, yearSeasons: [['spring'], ['spring'], ['spring']] }, 3)).toBe(true);
    expect(perkTierOpen({ ...fresh, almanac: almanac(8) }, 3)).toBe(true);
    expect(perkTierOpen({ ...fresh, almanac: almanac(8) }, 4)).toBe(false);
    expect(perkTierOpen({ ...fresh, almanac: almanac(codex.almanac.size) }, 4)).toBe(true);
    expect(perkTierOpen({ ...fresh, yearSeasons: Array.from({ length: 6 }, () => ['spring' as const]) }, 4)).toBe(true);
    expect(perkTierGoal(2)).toBe('Win a Year or 4 Almanac entries to open.');
    expect(perkTierGoal(4)).toBe('Reach Year 6 or the whole Almanac to open.');
  });

  it("a locked tier's perks can't be bought, and say what opens them", () => {
    const p = { ...newProfile(), reputation: 1000 };
    expect(perkBlocked(p, 'full-purse')).toBe(perkTierGoal(2));
    expect(() => buyPerk(p, 'full-purse')).toThrow(/Win a Year/);
    expect(buyPerk({ ...p, years: 1 }, 'full-purse').perks).toEqual(['full-purse']);
  });

  it('a run says which tiers it opened', () => {
    expect(recordRun(newProfile(), end('winter', 'victory')).perkTiers).toEqual([2]);
    expect(recordRun({ ...newProfile(), years: 1 }, end('winter', 'victory')).perkTiers).toEqual([]);
    expect(recordRun(newProfile(), end('spring', 'game-over')).perkTiers).toEqual([]);
  });

  it('later perks start runs with relics, Blessed cards and a bigger cauldron', () => {
    const all = [...codex.perks.keys()];
    const plain = newRun('tiers', 'hedge-witch').state;
    const s = newRun('tiers', 'hedge-witch', 'spring', [], all).state;
    expect(s.relics.length).toBe(2);
    expect(allCards(s).filter((c) => c.modifier === 'blessed').length).toBe(2);
    expect(s.cauldronSlots).toBe(CAULDRON_SLOTS + 1);
    expect(s.shelfSize).toBe(SHELF_SLOTS + 2);
    expect(s.gold).toBeGreaterThanOrEqual(START_GOLD + 20);
    expect(allCards(s).length).toBe(allCards(plain).length + 5);
  });
});

describe('the Codex', () => {
  it('a run meets its starting deck and recipes, then what it draws, is offered and serves', () => {
    const start = newRun('codex', 'hedge-witch').state;
    expect(start.stats.met).toEqual(expect.arrayContaining([...start.knownRecipes, ...start.drawPile.map((c) => c.card)]));
    const rec = playRun('codex', { strategy: 'greedy' });
    const { state, events } = replay(rec.actions);
    const served = events.flatMap((e) => (e.type === 'orderPosted' ? [e.order.customer] : []));
    const offered = events.flatMap((e) => (e.type === 'rewardOffered' ? e.cards : []));
    expect(state.stats.met).toEqual(expect.arrayContaining([...served, ...offered, ...state.familiars, ...state.relics]));
    expect(new Set(state.stats.met).size).toBe(state.stats.met.length);
  });

  it('a finished run adds what it met to the profile, once, and only codex ids', () => {
    const stats = { ...newStats(), met: ['lavender', 'bea-thornwick', 'sludge', 'nope'] };
    const p = recordRun({ ...newProfile(), codex: ['lavender'] }, { ...end('spring', 'game-over'), stats }).profile;
    expect(p.codex).toEqual(['lavender', 'bea-thornwick']);
    expect(codexMet(p.codex, { stats })).toEqual([]);
    expect(migrateProfile({ ...p, codex: ['lavender', 'nope', 'lavender', 7] }).codex).toEqual(['lavender']);
    expect(migrateProfile({ version: 3 }).codex).toEqual([]);
  });

  it('shows every ingredient, tincture, recipe, familiar, relic and customer', () => {
    const sizes = Object.values(CODEX_TABLES).map((t) => t.size);
    expect(sizes.reduce((a, b) => a + b)).toBe(codex.ingredients.size + codex.tinctures.size + codex.recipes.size + codex.familiars.size + codex.relics.size + codex.regulars.size + codex.nightCustomers.size + codex.patrons.size);
  });
});

describe('the Almanac', () => {
  it('has a goal for every entry, and unlocks every locked card, recipe, familiar and relic exactly once', () => {
    expect(Object.keys(ALMANAC_GOALS).sort()).toEqual([...codex.almanac.keys()].sort());
    const locked = [codex.ingredients, codex.tinctures, codex.recipes, codex.familiars, codex.relics].flatMap((t) => [...t.values()].filter((x) => x.pool === 'unlock').map((x) => x.id));
    const all = almanacUnlocks([...codex.almanac.keys()]);
    expect([...all].sort()).toEqual([...locked].sort());
  });

  it('a first run draws from the starter relics only', () => {
    const s = newRun('relics', 'hedge-witch').state;
    expect(relicPool(s)).toHaveLength([...codex.relics.values()].filter((r) => r.pool === 'base').length);
    expect(relicPool(s)).not.toContain('lucky-horseshoe');
    expect(relicPool({ ...s, unlocks: ['lucky-horseshoe'] })).toContain('lucky-horseshoe');
  });

  it('records entries a run meets, won or lost, once each', () => {
    const lost = recordRun(newProfile(), { ...end('spring', 'game-over', 'r1', 3), stats: { ...newStats(), bestTier: 3, mostFamiliars: 3 } });
    expect(lost.almanac).toEqual(['superb-work', 'masterwork', 'menagerie']);
    expect(lost.profile.almanac).toEqual(lost.almanac);
    const won = recordRun(lost.profile, { ...end('spring', 'victory', 'r2'), stats: { ...newStats(), bestTier: 3, rentsPaid: 4 } });
    expect(won.almanac).toEqual(['paid-up', 'spring-won']);
    expect(almanacMet(won.profile.almanac, { season: 'spring', phase: 'victory', stats: { ...newStats(), bestTier: 4 } })).toEqual(['legendary']);
    expect(almanacUnlocks(['spring-won'])).toEqual(codex.almanac.get('spring-won')!.unlocks);
  });

  it('migrates a version 2 profile with nothing done, and drops unknown entries', () => {
    expect(migrateProfile({ version: 2, tutorialDone: true }).almanac).toEqual([]);
    expect(migrateProfile({ version: PROFILE_VERSION, almanac: ['spring-won', 'nope', 'spring-won', 3] }).almanac).toEqual(['spring-won']);
  });
});

describe('saved run migrations', () => {
  it('keeps a current run and refuses junk, newer or unmigratable runs', () => {
    const s = brewing('migrate');
    expect(migrateRun(JSON.parse(JSON.stringify(s)))).toEqual(s);
    for (const raw of [null, 'x', [], { version: 'ten' }, { ...s, version: RUN_VERSION + 1 }, { ...s, version: 9 }]) expect(migrateRun(raw)).toBeNull();
  });

  it('a version 11 run gains the Almanac stats, from the run so far', () => {
    const old: Record<string, unknown> = { ...brewing('migrate'), version: 11, week: 3, relics: ['guild-seal'], stats: { ordersFilled: 5, potionsSold: 1 } };
    expect(migrateRun(old)?.stats).toMatchObject({ ...newStats(), ordersFilled: 5, potionsSold: 1, rentsPaid: 2, mostRelics: 1, met: expect.arrayContaining(['guild-seal']) as unknown as string[] });
  });

  it('a version 12 run gains the Codex ids it has met, from what it holds', () => {
    const s = brewing('migrate');
    const old: Record<string, unknown> = { ...s, version: 12, familiars: ['heron'], stats: { ...s.stats, met: undefined } };
    const met = migrateRun(old)!.stats.met;
    expect(met).toEqual(expect.arrayContaining(['heron', ...s.knownRecipes, s.hand[0]!.card, s.orders[0]!.customer]));
    expect(new Set(met).size).toBe(met.length);
  });

  it('a version 10 run gains empty stats', () => {
    const old: Record<string, unknown> = { ...brewing('migrate'), version: 10 };
    delete old.stats;
    expect(migrateRun(old)).toMatchObject({ version: RUN_VERSION, stats: { ordersFilled: 0, potionsSold: 0 } });
  });

  it('walks each step up to the current version', () => {
    const s = brewing('migrate');
    const step = RUN_MIGRATIONS[9];
    RUN_MIGRATIONS[9] = (old) => ({ ...old, gold: 99 });
    try {
      expect(migrateRun({ ...s, version: 9 })).toMatchObject({ version: RUN_VERSION, gold: 99, stats: { ordersFilled: 0, potionsSold: 0 } });
    } finally {
      if (step) RUN_MIGRATIONS[9] = step;
      else delete RUN_MIGRATIONS[9];
    }
  });
});

describe('the stored profile', () => {
  const g = globalThis as { localStorage?: unknown };
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    g.localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it('migrates what an older build stored', () => {
    data.set('elmbrook.profile', JSON.stringify({ tutorialDone: true }));
    expect(loadProfile()).toMatchObject({ version: PROFILE_VERSION, tutorialDone: true, yearSeasons: [['spring']] });
    data.set('elmbrook.profile', '{not json');
    expect(loadProfile()).toEqual(newProfile());
  });

  it('records a finished run once and keeps other fields', () => {
    saveProfile({ tutorialDone: true });
    const s = { ...brewing('rec'), phase: 'victory' as const, week: 4 };
    expect(recordFinishedRun(s).opened).toBe('summer');
    expect(recordFinishedRun(s).opened).toBeNull();
    expect(loadProfile()).toMatchObject({ tutorialDone: true, runs: 1, yearSeasons: [['spring', 'summer']] });
  });

  it('works without storage', () => {
    delete g.localStorage;
    expect(loadProfile()).toEqual(newProfile());
    expect(saveProfile({ tutorialDone: true }).tutorialDone).toBe(true);
  });
});
