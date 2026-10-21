import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { dayPool } from '../src/core/dusk';
import {
  allCards, brewBlocked, chooseMutation, familiarPool, lockMutation, marketMoon, migrateProfile, MUTATION_RULES, mutationChangeable, newProfile, newStats, priceAt,
  recordRun, reduce, rentOf, reputationFor, START_GOLD, type RunState,
} from '../src/core';

const run = (mutation?: string, seed = 'mut') => reduce(null, { type: 'startRun', seed, witch: 'hedge-witch', ...(mutation ? { mutation } : {}) }).state;
const vital = (id: string) => codex.ingredients.get(id)?.essences.includes('vital') ?? false;

describe('mutations', () => {
  it("No Vital: half the starter's Vital cards are Sludge, the rest gone, and none in the pools", () => {
    const before = allCards(run()).filter((c) => vital(c.card)).length;
    expect(before).toBeGreaterThan(0);
    const s = run('no-vital');
    expect(allCards(s).filter((c) => c.card === 'sludge').length).toBe(Math.ceil(before / 2));
    expect(allCards(s).length).toBe(allCards(run()).length - Math.floor(before / 2));
    expect(allCards(s).some((c) => vital(c.card))).toBe(false);
    expect(dayPool(s).some((c) => vital(c.id))).toBe(false);
  });

  it('Lone Witch: no familiar slots or offers, and a tier 2 relic', () => {
    const s = run('lone-witch');
    expect(s.familiarSlots).toBe(0);
    expect(familiarPool(s)).toEqual([]);
    expect(s.relics.map((r) => codex.relics.get(r)!.tier)).toContain(MUTATION_RULES.loneRelicTier);
  });

  it('Steady Hands: no Discards, a bigger hand', () => {
    const s = run('steady-hands');
    expect(s.discardsLeft).toBe(0);
    expect(s.handSize).toBe(run().handSize + MUTATION_RULES.steadyHand);
  });

  it("Three's Company: brews need three ingredients, with a third slot and one fewer Brew", () => {
    const s = run('threes-company');
    expect(s.cauldronSlots).toBeGreaterThanOrEqual(3);
    expect(s.brewsLeft).toBe(run().brewsLeft + MUTATION_RULES.threesBrews);
    const two = s.drawPile.slice(0, 2);
    expect(brewBlocked(s, two)).toMatch(/three or more/);
    expect(brewBlocked(s, s.drawPile.slice(0, 3))).toBeNull();
    expect(brewBlocked(run(), two)).toBeNull();
  });

  it('Open Market: the full moon every week, and dearer Night Market prices and rent', () => {
    const s = run('open-market');
    expect([1, 2, 3, 4].map((w) => marketMoon(s, w))).toEqual(['full-moon', 'full-moon', 'full-moon', 'full-moon']);
    const night = { ...s, offer: { kind: 'night-market' } } as unknown as RunState;
    expect(priceAt(night, { price: 20 })).toBe(Math.round(20 * MUTATION_RULES.openPrice));
    expect(priceAt({ ...night, mutation: null }, { price: 20 })).toBe(20);
    expect(rentOf({ ...s, week: 3 })).toBe(Math.round(rentOf({ ...run(), week: 3 }) * MUTATION_RULES.openRent));
  });

  it('Lean Times: no gold to start, lower rent', () => {
    const s = run('lean-times');
    expect(run().gold).toBe(START_GOLD);
    expect(s.gold).toBe(0);
    expect(rentOf({ ...s, week: 3 })).toBe(Math.round(rentOf({ ...run(), week: 3 }) * MUTATION_RULES.leanRent));
  });

  it('earns more Reputation', () => {
    const end = { phase: 'victory' as const, week: 4, stats: { ...newStats(), ordersFilled: 20 } };
    expect(reputationFor({ ...end, mutation: 'lean-times' })).toBe(Math.round(reputationFor(end) * MUTATION_RULES.reputation));
  });

  it('rejects an unknown mutation', () => {
    expect(() => run('nope')).toThrow(/unknown mutation/);
  });
});

describe('mutations on the profile', () => {
  const yearTwo = () => ({ ...newProfile(), years: 1, year: 2, yearSeasons: [['spring', 'summer', 'autumn', 'winter'], ['spring']] as never, boons: [null, null], mutations: [null, null], mutationLocked: [true, false] });

  it('open after the first Year, chosen per Year until a run sets out', () => {
    expect(mutationChangeable(newProfile())).toBe(false);
    const p = chooseMutation(yearTwo(), 'lean-times');
    expect(p.mutations).toEqual([null, 'lean-times']);
    const locked = lockMutation(p);
    expect(locked.mutationLocked).toEqual([true, true]);
    expect(lockMutation(locked)).toBe(locked);
    expect(() => chooseMutation(locked, null)).toThrow(/locked/);
  });

  it('ticks a mutation off when its Year\'s Winter is won with it on', () => {
    const p = { ...yearTwo(), yearSeasons: [['spring', 'summer', 'autumn', 'winter'], ['spring', 'summer', 'autumn', 'winter']] as never, mutations: [null, 'lean-times' as const] };
    const win = { seed: 'w', season: 'winter' as const, phase: 'victory' as const, week: 4, year: 2, stats: newStats() };
    expect(recordRun(p, { ...win, mutation: 'lean-times' }).profile.mutationsDone).toEqual(['lean-times']);
    expect(recordRun(p, win).profile.mutationsDone).toEqual([]);
    expect(recordRun(p, { ...win, season: 'autumn', mutation: 'lean-times' }).profile.mutationsDone).toEqual([]);
  });

  it('migrates older profiles, and repairs bad fields', () => {
    const old = migrateProfile({ ...newProfile(), version: 14, runs: 5, yearSeasons: [['spring'], ['spring']], mutations: undefined, mutationLocked: undefined, mutationsDone: undefined });
    expect(old).toMatchObject({ mutations: [null, null], mutationLocked: [true, false], mutationsDone: [] });
    expect(migrateProfile({ ...newProfile(), mutations: ['nope'], mutationsDone: ['lean-times', 'x'] })).toMatchObject({ mutations: [null], mutationsDone: ['lean-times'] });
  });
});
