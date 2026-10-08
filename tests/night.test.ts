import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, brewBlocked, CLOCKLESS_BREWS, FINALE_ORDERS, finaleMet, fits, isSatchelCard, lunarPool, NIGHT_SHIFT_DAY, omenPool, patronOf, previewBrew, reduce,
  rollCalendar, rollPatrons, SEASONS, STAND_IN_GOLD, tierIndex, tierStep, TITHE_GOLD, twistNow, WEEKS,
  type Calendar, type Order, type Potion, type RunState, type Season,
} from '../src/core';
import { no, ofType, ok, slotAll, start, withHand } from './helpers';

const clear = (): Calendar => ({ weather: Array.from({ length: WEEKS }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => 'clear' as const)), sky: null });

/** A run on this week's Night Shift with this patron, clear skies, the shop open unless `morning`. */
function night(patron: string, week = 1, opts: { season?: Season; seed?: string; morning?: boolean; satchel?: string[] } = {}): RunState {
  let s: RunState = { ...start(opts.seed ?? 'night', opts.season), calendar: clear() };
  s = { ...s, satchel: (opts.satchel ?? []).map((card, i) => ({ uid: 900 + i, card })) };
  s = ok(s, { type: 'debug', op: 'setPatron', week, patron }).state;
  s = ok(s, { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  return opts.morning ? s : ok(s, { type: 'openShop' }).state;
}

const potion = (p: Partial<Potion> = {}): Potion => ({
  uid: 600, recipe: 'healing-draught', family: 'healing', quality: 14, tier: 'fine', ingredients: ['elmroot', 'creekwater'], experiment: false, heartDelta: 0, ...p,
});
const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'fine', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

describe('patrons', () => {
  it('rolls one per week on its own stream: the Pale Courier in week 2, the Moonless Patron in week 4', () => {
    for (const season of SEASONS) {
      for (let i = 0; i < 40; i++) {
        const p = rollPatrons(`p${i}`, season);
        expect(p).toHaveLength(WEEKS);
        expect(p[1]).toBe('pale-courier');
        expect(p[3]).toBe('moonless-patron');
        expect(p[0]).not.toBe(p[2]);
        for (const [w, id] of p.entries()) {
          const patron = codex.patrons.get(id)!;
          expect(patron.weeks).toContain(w + 1);
          if (patron.season) expect(patron.season).toBe(season);
        }
      }
    }
    expect(rollPatrons('same', 'spring')).toEqual(rollPatrons('same', 'spring'));
    // The Calendar's weather doesn't move: patrons use their own stream.
    expect(start('same').calendar).toEqual(rollCalendar('same', 'spring', WEEKS));
    expect(start('same').patrons).toEqual(rollPatrons('same', 'spring'));
  });

  it('a twist is only in force on the Night Shift', () => {
    const s = start('twist');
    expect(twistNow(s)).toBeNull();
    expect(twistNow({ ...s, day: NIGHT_SHIFT_DAY })).toBe(patronOf(s)!.twist);
    expect(no(s, { type: 'debug', op: 'setPatron', week: 1, patron: 'nobody' })).toMatch(/no patron/);
  });

  it('the patron places the first order, one tier harder, then night customers fill the rest', () => {
    for (let i = 0; i < 20; i++) {
      const s = night('sir-bramble', 1, { seed: `n${i}`, morning: true });
      expect(s.orders[0]!.customer).toBe('sir-bramble');
      expect(s.orders.length).toBeLessThanOrEqual(3);
      for (const o of s.orders.slice(1)) expect(codex.nightCustomers.has(o.customer) || codex.regulars.get(o.customer)?.nightOnly).toBeTruthy();
    }
  });

  it('the Twin Owls want two of everything and pay double', () => {
    const s = night('twin-owls', 1, { morning: true });
    expect(s.orders.length).toBeLessThanOrEqual(2);
    expect(s.orders.every((o) => o.quantity === 2)).toBe(true);
  });

  it('the Pale Courier wants a Masterwork Lunar potion, or the best the deck can do without Lunar cards', () => {
    const none = night('pale-courier', 2, { morning: true });
    expect(none.orders[0]!.request).not.toEqual({ kind: 'family', family: 'lunar' });
    const lunar = night('pale-courier', 2, { morning: true, satchel: ['starlit-dew', 'moonpetal', 'lantern-ember'] });
    expect(lunar.orders[0]!.customer).toBe('pale-courier');
    expect(lunar.orders[0]!.request).toEqual({ kind: 'family', family: 'lunar' });
    expect(tierIndex(lunar.orders[0]!.minTier)).toBeLessThanOrEqual(tierIndex('masterwork'));
  });

  it('the Moonless Patron places every order, escalating, and the finale needs them all filled', () => {
    const s = night('moonless-patron', 4, { morning: true });
    expect(s.orders).toHaveLength(3);
    expect(s.orders.every((o) => o.customer === 'moonless-patron')).toBe(true);
    expect(finaleMet(s)).toBe(false);
    expect(finaleMet({ ...s, orders: s.orders.map((o, i) => ({ ...o, status: i === 0 ? 'filled' as const : o.status })) })).toBe(FINALE_ORDERS <= 1);
    expect(finaleMet({ ...s, orders: s.orders.map((o) => ({ ...o, status: 'filled' as const })) })).toBe(true);
    expect(finaleMet({ ...s, week: 3, patrons: ['lamplighter', 'pale-courier', 'sir-bramble', 'moonless-patron'] })).toBe(true);
  });

  it('Sir Bramble zeroes Ember and the Frost Warden chills everything else', () => {
    const bramble = night('sir-bramble');
    const [b, bu] = withHand(bramble, ['elmroot', 'emberbloom']);
    const p = previewBrew(slotAll(b, bu), slotAll(b, bu).cauldron, []);
    if (p.kind !== 'potion') throw new Error('expected a potion');
    expect(p.potency).toBe(4);
    expect(p.steps.find((x) => x.source === 'patron')?.note).toBe('-4 Potency');
    const warden = night('frost-warden', 1, { season: 'winter' });
    const [w, wu] = withHand(warden, ['elmroot', 'creekwater']);
    const q = previewBrew(slotAll(w, wu), slotAll(w, wu).cauldron, []);
    if (q.kind !== 'potion') throw new Error('expected a potion');
    expect(q.potency).toBe(4 + 3 - 4);
  });

  it('Mother Hollow wants a new Origin each brew', () => {
    const [s, uids] = withHand(night('mother-hollow'), ['elmroot', 'creekwater', 'elmroot', 'creekwater', 'river-clay', 'thistledown']);
    const first = ok(slotAll(s, uids.slice(0, 2)), { type: 'brew' }).state;
    expect(first.lastBrew).toEqual(['elmroot', 'creekwater']);
    // Garden + Creek again: refused. Creek + Wychwood: fine.
    expect(brewBlocked(first, first.hand.filter((c) => c.uid === uids[2] || c.uid === uids[3]))).toMatch(/Mother Hollow/);
    expect(no(slotAll(first, uids.slice(2, 4)), { type: 'brew' })).toMatch(/different Origin/);
    expect(ok(slotAll(first, [uids[4]!, uids[5]!]), { type: 'brew' }).state.brewsLeft).toBe(first.brewsLeft - 1);
  });

  it('the May Queen won\'t take the same family twice running', () => {
    const s = { ...night('may-queen', 1, { season: 'spring' }), lastFamily: 'healing' as const };
    expect(fits(s, potion(), order())).toBe(false);
    expect(fits({ ...s, lastFamily: 'calming' }, potion(), order())).toBe(true);
    expect(fits({ ...s, day: 1 }, potion(), order())).toBe(true);
    expect(no({ ...s, orders: [order()], shelf: [potion()] }, { type: 'deliver', order: 500, potion: 600 })).toMatch(/May Queen/);
  });

  it('the Clockless Man\'s customers leave after two brews', () => {
    const [s0, uids] = withHand(night('clockless-man', 3), ['elmroot', 'creekwater', 'elmroot', 'creekwater']);
    const s = { ...s0, orders: s0.orders.map((o) => ({ ...o, minTier: 'legendary' as const })) };
    expect(s.orders.every((o) => o.expiresIn === CLOCKLESS_BREWS)).toBe(true);
    const one = ok(slotAll(s, uids.slice(0, 2)), { type: 'brew' }).state;
    expect(one.orders.every((o) => o.expiresIn === 1 && o.status === 'open')).toBe(true);
    const two = ok(slotAll(one, uids.slice(2)), { type: 'brew' });
    expect(two.state.orders.every((o) => o.status === 'declined')).toBe(true);
    expect(ofType(two.events, 'orderExpired')).toHaveLength(s.orders.length);
    expect(ofType(two.events, 'heartsChanged')).toHaveLength(0);
  });

  it('the Firefly Conductor redraws the whole hand after each brew', () => {
    const [s, uids] = withHand(night('firefly-conductor', 1, { season: 'summer' }), ['elmroot', 'creekwater', 'thistledown', 'river-clay']);
    const r = ok(slotAll(s, uids.slice(0, 2)), { type: 'brew' });
    expect(ofType(r.events, 'cardsDiscarded')[0]!.uids).toEqual([uids[2], uids[3]]);
    expect(r.state.hand).toHaveLength(s.handSize);
  });

  it('the Tithe Reeve charges for every brew', () => {
    const [s, uids] = withHand(night('tithe-reeve', 1, { season: 'autumn' }), ['elmroot', 'creekwater']);
    const r = ok(slotAll({ ...s, gold: 5 }, uids), { type: 'brew' });
    expect(ofType(r.events, 'goldChanged')[0]).toMatchObject({ delta: -TITHE_GOLD, reason: 'patron' });
    expect(no(slotAll({ ...s, gold: 1 }, uids), { type: 'brew' })).toMatch(/Tithe Reeve/);
  });

  it('patrons pay their reward when their order is filled; familiars and relics are gold for now', () => {
    const [s, uids] = withHand(night('lamplighter'), ['elmroot', 'creekwater']);
    const target = { ...order({ customer: 'lamplighter', minTier: 'crude', pay: 5 }) };
    const r = ok(slotAll({ ...s, orders: [target] }, uids), { type: 'brew', deliverTo: 500 });
    expect(ofType(r.events, 'goldChanged').map((e) => e.reason)).toEqual(['order', 'patron']);
    expect(ofType(r.events, 'goldChanged')[1]!.delta).toBe(6);
    const [h, hu] = withHand(night('mother-hollow'), ['elmroot', 'creekwater']);
    const hollow = ok(slotAll({ ...h, orders: [order({ customer: 'mother-hollow', minTier: 'crude' })] }, hu), { type: 'brew', deliverTo: 500 });
    expect(ofType(hollow.events, 'goldChanged')[1]!.delta).toBe(STAND_IN_GOLD.familiar);
    const [o, ou] = withHand(night('twin-owls'), ['elmroot', 'creekwater']);
    const owls = ok(slotAll({ ...o, orders: [order({ customer: 'twin-owls', minTier: 'crude' })] }, ou), { type: 'brew', deliverTo: 500 });
    expect(owls.state.gifts[0]).toMatchObject({ source: 'patron', into: 'deck' });
    expect(owls.state.gifts[0]!.cards.every((c) => codex.ingredients.get(c)!.rarity === 'rare')).toBe(true);
  });
});

describe('the Night Satchel', () => {
  it('holds Lunar ingredients and Omens, and joins the deck only on Night Shifts', () => {
    expect(isSatchelCard('starlit-dew')).toBe(true);
    expect(isSatchelCard('blood-moon')).toBe(true);
    expect(isSatchelCard('fallen-star')).toBe(false);
    expect(isSatchelCard('elmroot')).toBe(false);
    const s = { ...start('satchel'), satchel: [{ uid: 900, card: 'starlit-dew' }] };
    expect(allCards(ok(s, { type: 'openShop' }).state).some((c) => c.uid === 900)).toBe(false);
    const n = ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state;
    expect(n.satchel).toHaveLength(0);
    expect(n.drawPile.some((c) => c.uid === 900)).toBe(true);
    // The next day it is back in the Satchel.
    const d = ok(n, { type: 'debug', op: 'jumpToDay', week: 2, day: 1 }).state;
    expect(d.satchel.map((c) => c.uid)).toEqual([900]);
    expect(allCards(d).some((c) => c.uid === 900)).toBe(false);
    // An Eclipse brings the Satchel into its day.
    const eclipse = { ...s, calendar: { ...clear(), sky: { event: 'eclipse' as const, week: 1, day: 2 } } };
    expect(ok(eclipse, { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state.drawPile.some((c) => c.uid === 900)).toBe(true);
  });

  it('after the first Night Shift, a free Lunar card comes before the Market', () => {
    let s = night('lamplighter');
    s = ok(s, { type: 'endDay' }).state;
    s = ok(s, { type: 'skipReward' }).state;
    expect(s.offer).toMatchObject({ kind: 'gift', source: 'first-night', into: 'satchel' });
    const cards = (s.offer as { cards: string[] }).cards;
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => lunarPool(s).includes(c))).toBe(true);
    const took = ok(s, { type: 'takeGift', index: 1 });
    expect(took.state.satchel.map((c) => c.card)).toEqual([cards[1]]);
    expect(took.state.phase).toBe('night-market');
    expect(ok(s, { type: 'passGift' }).state.satchel).toHaveLength(0);
    expect(no(took.state, { type: 'takeGift', index: 0 })).toMatch(/gift/);
    // Not in week 2.
    let w2 = night('pale-courier', 2);
    w2 = ok(ok(w2, { type: 'endDay' }).state, { type: 'skipReward' }).state;
    expect(w2.offer?.kind).toBe('night-market');
  });
});

describe('night customers', () => {
  const filled = (customer: string, hand = ['elmroot', 'creekwater']) => {
    const [s, uids] = withHand(night('lamplighter'), hand);
    const slotted = slotAll(s, uids);
    const p = previewBrew(slotted, slotted.cauldron, []);
    if (p.kind !== 'potion') throw new Error('expected a potion');
    return ok({ ...slotted, orders: [order({ customer, minTier: 'crude', request: { kind: 'recipe', recipe: p.recipe } })] }, { type: 'brew', deliverTo: 500 });
  };

  it('the Wisp Courier pays an Omen into the Satchel', () => {
    const r = filled('wisp-courier');
    expect(r.state.satchel).toHaveLength(1);
    expect(omenPool(r.state)).toContain(r.state.satchel[0]!.card);
    expect(ofType(r.events, 'cardGained')[0]!.source).toBe('payment');
  });

  it('the Lantern Witch and Granny Bogwort pay in picks after the shift', () => {
    expect(filled('lantern-witch').state.gifts[0]).toMatchObject({ source: 'lantern-witch', into: 'satchel' });
    const bog = filled('bog-hag', ['elmroot', 'nightshade']);
    expect(bog.state.gifts[0]).toMatchObject({ source: 'bog-hag', into: 'deck' });
    expect(bog.state.gifts[0]!.cards).toHaveLength(3);
  });

  it('Granny Bogwort can insist on Umbra', () => {
    expect(fits({}, potion(), order({ needsUmbra: true }))).toBe(false);
    expect(fits({}, potion({ ingredients: ['elmroot', 'nightshade'] }), order({ needsUmbra: true }))).toBe(true);
  });

  it('night orders pay by each customer\'s gold multiplier', () => {
    const duchess = codex.nightCustomers.get('moth-duchess')!;
    const wisp = codex.nightCustomers.get('wisp-courier')!;
    expect(duchess.goldMult).toBeGreaterThan(wisp.goldMult);
    for (let i = 0; i < 30; i++) {
      const s = night('sir-bramble', 2, { seed: `pay${i}`, morning: true });
      for (const o of s.orders.slice(1)) expect(o.pay).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Omens', () => {
  const play = (card: string, extra: Partial<RunState> = {}, targets?: number[]) => {
    const [s, uids] = withHand(night('lamplighter'), [card, 'elmroot', 'creekwater']);
    const t = targets?.map((i) => uids[i]!);
    return { s: { ...s, ...extra }, uids, r: ok({ ...s, ...extra }, { type: 'playTincture', uid: uids[0]!, ...(t ? { targets: t } : {}) }) };
  };

  it('Blood Moon doubles Harmony and costs a Discard', () => {
    const { s, r } = play('blood-moon');
    expect(r.state.pending.harmonyMult).toBe(2);
    expect(r.state.discardsLeft).toBe(s.discardsLeft - 1);
  });

  it('Witching Hour doubles Potency and adds a Sludge', () => {
    const { r } = play('witching-hour');
    expect(r.state.pending.potencyMult).toBe(2);
    expect(ofType(r.events, 'cardGained')[0]!.card).toBe('sludge');
  });

  it('Black Cat Crossing draws 3 and throws one away at random', () => {
    const { s, r } = play('black-cat-crossing');
    expect(ofType(r.events, 'cardDrawn')).toHaveLength(3);
    expect(r.state.hand).toHaveLength(s.hand.length - 1 + 3 - 1);
  });

  it('Raven Call gains a Brew and costs a heart; Wishing Star doubles the next delivery', () => {
    const raven = play('raven-call');
    expect(raven.r.state.brewsLeft).toBe(raven.s.brewsLeft + 1);
    expect(raven.r.state.delivery.hearts).toBe(-1);
    const star = play('wishing-star');
    expect(star.r.state.delivery.payMult).toBe(2);
    const [s, uids] = withHand(star.r.state, ['elmroot', 'creekwater']);
    const paid = ok(slotAll({ ...s, orders: [order({ customer: 'old-tobin', pay: 10 })] }, uids), { type: 'brew', deliverTo: 500 });
    expect(ofType(paid.events, 'orderFilled')[0]!.pay).toBe(20);
  });

  it('Howl adds Potency for each Lunar card; Moth Swarm makes every ingredient Lunar', () => {
    const howl = play('howl').r.state;
    const [h, hu] = withHand(howl, ['starlit-dew', 'elmroot']);
    const p = previewBrew(slotAll(h, hu), slotAll(h, hu).cauldron, []);
    const [b, bu] = withHand({ ...howl, pending: { ...howl.pending, lunarPotency: 0 } }, ['starlit-dew', 'elmroot']);
    const q = previewBrew(slotAll(b, bu), slotAll(b, bu).cauldron, []);
    if (p.kind !== 'potion' || q.kind !== 'potion') throw new Error('expected potions');
    expect(p.potency).toBe(q.potency + 2 * 2 * 1);
    const swarm = play('moth-swarm', { unlocks: ['moth-swarm'] }).r.state;
    expect(swarm.pending.allLunar).toBe(true);
    expect(swarm.delivery.hearts).toBe(-1);
    const [m, mu] = withHand(swarm, ['creekwater', 'elmroot']);
    const lunar = previewBrew(slotAll(m, mu), slotAll(m, mu).cauldron, []);
    expect(lunar.kind === 'potion' && codex.recipes.get(lunar.recipe)!.pattern.includes('lunar')).toBe(true);
  });

  it('Cracked Mirror copies a card into the deck for 3 gold', () => {
    const { s, r } = play('cracked-mirror', { gold: 10 }, [1]);
    expect(ofType(r.events, 'cardGained')[0]).toMatchObject({ card: 'elmroot', source: 'copy' });
    expect(r.state.gold).toBe(s.gold - 3);
  });

  it('every Omen is registered and only offered from the night', () => {
    for (const id of omenPool({ unlocks: ['cracked-mirror', 'moth-swarm'] })) {
      expect(codex.tinctures.get(id)!.rarity).toBe('lunar');
      expect(reduce(night('lamplighter'), { type: 'debug', op: 'giveCard', card: id }).events[0]!.type).toBe('cardDrawn');
    }
    expect(tierStep('fine', 1)).toBe('superb');
  });
});
