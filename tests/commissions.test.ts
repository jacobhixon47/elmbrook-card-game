import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { COMMISSIONS, commissionPool, dueWeekOf, goalOf, guildOpen, NIGHT_SHIFT_DAY, type Order, type RunState } from '../src/core';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

const hold = (s: RunState, ...ids: string[]) => ids.reduce((st, commission) => ok(st, { type: 'debug', op: 'giveCommission', commission }).state, s);

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

/** Brew these cards for one open order (Healing from Elmroot and Creekwater by default). */
function deliver(s: RunState, cards = ['elmroot', 'creekwater'], o: Partial<Order> = {}) {
  const [h, uids] = withHand(s, cards);
  return ok({ ...slotAll(h, uids), brewsLeft: 4, orders: [order(o)], fog: false }, { type: 'brew', deliverTo: 500 });
}

/** The Guild Hall at dusk on day 1. */
function guild(seed = 'guild'): RunState {
  let s = brewing(seed);
  for (const a of [{ type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
  return ok({ ...s, offer: { kind: 'errands', options: ['guild', 'market'] } }, { type: 'chooseErrand', errand: 'guild' }).state;
}

describe('Guild Commissions in the codex', () => {
  it('has the ten from the balance tables, each with a goal', () => {
    expect(codex.commissions.size).toBe(10);
    for (const id of codex.commissions.keys()) expect(goalOf(id).target).toBeGreaterThan(0);
  });

  it('offers only commissions for this week that you don\'t hold', () => {
    const w1 = commissionPool({ week: 1, commissions: [] }).map((c) => c.id);
    expect(w1).toContain('full-moon-favour');
    expect(w1).not.toContain('masters-proof');
    const w3 = commissionPool({ week: 3, commissions: [{ id: 'masters-proof', progress: 0, dueWeek: 4, customers: [] }] }).map((c) => c.id);
    expect(w3).not.toContain('full-moon-favour');
    expect(w3).not.toContain('masters-proof');
  });
});

describe('the Guild Hall', () => {
  it('offers two commissions and gives one a visit', () => {
    const s = guild();
    if (s.offer?.kind !== 'guild') throw new Error('expected the Guild Hall');
    expect(s.offer.options).toHaveLength(COMMISSIONS.offered);
    const r = ok(s, { type: 'takeCommission', index: 1 });
    const id = s.offer.options[1]!;
    expect(r.state.commissions).toEqual([{ id, progress: 0, dueWeek: codex.commissions.get(id)!.dueWeek ?? 1, customers: [] }]);
    expect(ofType(r.events, 'commissionTaken')[0]).toMatchObject({ commission: id });
    expect(no(r.state, { type: 'takeCommission', index: 0 })).toMatch(/one commission a visit/);
    expect(ok(r.state, { type: 'leaveErrand' }).state.day).toBe(2);
  });

  it('holds at most two, and isn\'t offered as an errand when full', () => {
    const s = hold(guild(), 'miners-mend', 'no-shadows');
    expect(no(s, { type: 'takeCommission', index: 0 })).toMatch(/hold 2/);
    expect(guildOpen(s)).toBe(false);
    for (let i = 0; i < 20; i++) {
      let d = hold(brewing(`full-${i}`), 'miners-mend', 'no-shadows');
      for (const a of [{ type: 'endDay' }, { type: 'skipReward' }] as const) d = ok(d, a).state;
      if (d.offer?.kind === 'errands') expect(d.offer.options).not.toContain('guild');
    }
  });

  it('is only open at the Guild Hall', () => {
    expect(no(brewing('guild'), { type: 'takeCommission', index: 0 })).toMatch(/Guild Hall/);
  });
});

describe('commission goals', () => {
  it('counts deliveries and pays gold when done', () => {
    let s = hold(brewing('guild'), 'miners-mend');
    s = deliver(s).state;
    s = deliver(s).state;
    expect(s.commissions[0]!.progress).toBe(2);
    const r = deliver(s);
    expect(r.state.commissions).toEqual([]);
    expect(ofType(r.events, 'commissionDone')).toEqual([{ type: 'commissionDone', commission: 'miners-mend' }]);
    expect(ofType(r.events, 'goldChanged').find((e) => e.reason === 'commission')?.delta).toBe(12);
  });

  it('counts only deliveries that match (No Shadows skips Umbra)', () => {
    const s = hold(brewing('guild'), 'no-shadows');
    const umbra = deliver(s, ['nightshade', 'creekwater'], { request: { kind: 'family', family: 'calming' } });
    const brewed = ofType(umbra.events, 'brewed')[0]!.potion;
    expect(brewed.ingredients).toContain('nightshade');
    expect(umbra.state.commissions[0]!.progress).toBe(0);
    expect(deliver(s).state.commissions[0]!.progress).toBe(1);
  });

  it('The Whole Town counts different customers once each', () => {
    let s = hold(brewing('guild'), 'the-whole-town');
    s = deliver(s).state;
    s = deliver(s).state;
    expect(s.commissions[0]!.progress).toBe(1);
    s = deliver(s, undefined, { customer: 'bea' }).state;
    expect(s.commissions[0]).toMatchObject({ progress: 2, customers: ['old-tobin', 'bea'] });
  });

  it('counts brews, and a relic reward grants a relic', () => {
    let s = hold(brewing('guild'), 'masters-proof');
    s = deliver(s).state;
    expect(s.commissions[0]!.progress).toBe(0);
    // A Masterwork: Potency × Harmony of 100 or more.
    const [h, uids] = withHand({ ...s, pending: { ...s.pending, potencyMult: 10 } }, ['elmroot', 'creekwater']);
    const r = ok({ ...slotAll(h, uids), fog: false }, { type: 'brew' });
    expect(ofType(r.events, 'brewed')[0]!.potion.tier).toMatch(/masterwork|legendary/);
    expect(ofType(r.events, 'commissionDone')).toHaveLength(1);
    expect(ofType(r.events, 'relicGained')[0]).toMatchObject({ source: 'commission' });
    expect(codex.relics.get(r.state.relics[0]!)!.tier).toBe(2);
  });

  it('Full Shelf checks the Shelf when the day ends', () => {
    const s = hold(brewing('guild'), 'full-shelf');
    const potion = { uid: 900, recipe: 'healing-draught', family: 'healing' as const, quality: 14, tier: 'fine' as const, ingredients: [], experiment: false, heartDelta: 0 };
    const full = { ...s, shelf: Array.from({ length: s.shelfSize }, (_, i) => ({ ...potion, uid: 900 + i })) };
    expect(ok(s, { type: 'endDay' }).state.commissions).toHaveLength(1);
    const r = ok(full, { type: 'endDay' });
    expect(ofType(r.events, 'commissionDone')).toHaveLength(1);
  });

  it('a card-pick reward is a free pick before the errands', () => {
    let s = hold(brewing('guild'), 'no-shadows');
    for (let i = 0; i < 5; i++) s = deliver(s).state;
    expect(s.gifts).toHaveLength(1);
    s = ok(ok(s, { type: 'endDay' }).state, { type: 'skipReward' }).state;
    expect(s.offer).toMatchObject({ kind: 'gift', source: 'commission', into: 'deck' });
    s = ok(s, { type: 'takeGift', index: 0 }).state;
    expect(s.offer?.kind).toBe('errands');
  });

  it('lapses after its Night Shift if not done', () => {
    let s = hold(start('guild'), 'miners-mend', 'night-owl');
    s = ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state;
    s = ok(s, { type: 'openShop' }).state;
    const r = ok(s, { type: 'endDay' });
    expect(r.state.commissions).toEqual([]);
    expect(ofType(r.events, 'commissionFailed').map((e) => e.commission).sort()).toEqual(['miners-mend', 'night-owl']);
  });

  it('taken after day 2, its deadline starts next week, never past the last week', () => {
    const c = codex.commissions.get('miners-mend')!;
    expect(dueWeekOf({ week: 1, day: 2 }, c)).toBe(1);
    expect(dueWeekOf({ week: 1, day: 3 }, c)).toBe(2);
    expect(dueWeekOf({ week: 2, day: 3 }, codex.commissions.get('masters-proof')!)).toBe(4);
    expect(dueWeekOf({ week: 4, day: 4 }, c)).toBe(4);
    expect(dueWeekOf({ week: 2, day: 4 }, codex.commissions.get('full-moon-favour')!)).toBe(2);
  });

  it('a commission due next week survives this week\'s Night Shift', () => {
    let s = ok(start('guild'), { type: 'debug', op: 'jumpToDay', week: 2, day: 1 }).state;
    s = hold(s, 'masters-proof');
    expect(s.commissions[0]!.dueWeek).toBe(3);
    s = ok(ok(s, { type: 'debug', op: 'jumpToDay', week: 2, day: NIGHT_SHIFT_DAY }).state, { type: 'openShop' }).state;
    expect(ok(s, { type: 'endDay' }).state.commissions).toHaveLength(1);
  });

  it('Night Owl is done when every Night Shift order is filled', () => {
    let s = hold(start('guild'), 'night-owl');
    s = ok(ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state, { type: 'openShop' }).state;
    const filled = { ...s, orders: s.orders.map((o) => ({ ...o, status: 'filled' as const })) };
    const r = ok(filled, { type: 'endDay' });
    expect(ofType(r.events, 'commissionDone')).toEqual([{ type: 'commissionDone', commission: 'night-owl' }]);
    expect(ofType(r.events, 'commissionFailed')).toEqual([]);
  });
});
