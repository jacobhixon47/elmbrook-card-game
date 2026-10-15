import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  FESTIVAL_DAY, FESTIVAL_WEEK, NIGHT_SHIFT_DAY, payout, previewBrew, RELIC_RULES, WEEKS, type Calendar, type RunState, type Season, type Weather,
} from '../src/core';
import { no, ofType, ok, slotAll, start, withHand } from './helpers';

const sky = (weather: Weather): Calendar => ({
  weather: Array.from({ length: WEEKS }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => weather)),
  sky: null,
});

/** A run on this day with the shop open. */
function on(season: Season, day = FESTIVAL_DAY, weather: Weather = 'clear'): RunState {
  const s = { ...start('fair', season), calendar: sky(weather) };
  const r = ok(s, { type: 'debug', op: 'jumpToDay', week: FESTIVAL_WEEK, day }).state;
  return ok(r, { type: 'openShop' }).state;
}

/** Closing on Bloomtide, with gold to spend. */
function atFair(patch: Partial<RunState> = {}): RunState {
  return ok({ ...on('spring'), gold: 100, ...patch }, { type: 'endDay' }).state;
}

describe('the Bloomtide Fair', () => {
  it('opens after closing on festival day, in place of the reward and the errand', () => {
    const r = ok({ ...on('spring'), gold: 100 }, { type: 'endDay' });
    expect(ofType(r.events, 'fairOpened')).toEqual([{ type: 'fairOpened', fair: 'bloomtide' }]);
    const offer = r.state.offer!;
    if (offer.kind !== 'fair') throw new Error('expected the fair');
    expect(offer.stalls.map((st) => st.id)).toEqual(['flower-grower', 'beekeeper', 'garland-weaver']);
    // Any other spring day still gets the reward pick.
    expect(ok(on('spring', FESTIVAL_DAY - 1), { type: 'endDay' }).state.offer?.kind).toBe('reward');
  });

  it('is not held in seasons whose fair isn\'t built yet', () => {
    for (const season of ['summer', 'autumn', 'winter'] as const) {
      expect(ok(on(season), { type: 'endDay' }).state.offer?.kind).toBe('reward');
    }
  });

  it('sells cards, familiars and relics for gold, once each', () => {
    let s = atFair();
    s = ok(s, { type: 'buyAtFair', stall: 0, index: 0 }).state;
    expect(s.gold).toBe(90);
    expect(s.discardPile.some((c) => c.card === 'maybloom')).toBe(true);
    expect(no(s, { type: 'buyAtFair', stall: 0, index: 0 })).toMatch(/sold/);
    s = ok(s, { type: 'buyAtFair', stall: 1, index: 0 }).state;
    expect(s.familiars).toContain('bumblebee');
    s = ok(s, { type: 'buyAtFair', stall: 2, index: 0 }).state;
    expect(s.relics).toContain('may-crown');
    expect(s.gold).toBe(100 - 10 - 14 - 18);
    expect(no({ ...s, gold: 0 }, { type: 'buyAtFair', stall: 0, index: 1 })).toMatch(/gold/);
    expect(no(s, { type: 'buyAtFair', stall: 9, index: 0 })).toMatch(/no stock/);
  });

  it('leaves out familiars and relics you already have', () => {
    let s = on('spring');
    s = ok(s, { type: 'debug', op: 'giveFamiliar', familiar: 'bumblebee' }).state;
    s = ok(s, { type: 'debug', op: 'giveRelic', relic: 'may-crown' }).state;
    const offer = ok(s, { type: 'endDay' }).state.offer!;
    if (offer.kind !== 'fair') throw new Error('expected the fair');
    expect(offer.stalls[1]!.stock.map((i) => i.kind)).toEqual(['card']);
    expect(offer.stalls[2]!.stock).toEqual([]);
  });

  it('a stall with more stock than it shows sets out a rolled few', () => {
    const fair = codex.fairs.get('bloomtide')!;
    const grower = fair.stalls[0]!;
    const original = grower.show;
    grower.show = 2;
    try {
      const seen = new Set<string>();
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
        const s = { ...start(seed, 'spring'), calendar: sky('clear') };
        const r = ok(ok(ok(s, { type: 'debug', op: 'jumpToDay', week: FESTIVAL_WEEK, day: FESTIVAL_DAY }).state, { type: 'openShop' }).state, { type: 'endDay' }).state;
        if (r.offer?.kind !== 'fair') throw new Error('expected the fair');
        const stock = r.offer.stalls[0]!.stock;
        expect(stock).toHaveLength(2);
        seen.add(stock.map((i) => (i.kind === 'card' ? i.card : '')).join());
      }
      expect(seen.size).toBeGreaterThan(1);
    } finally {
      grower.show = original;
    }
  });

  it('leaving goes home to the next morning', () => {
    const s = ok(atFair(), { type: 'leaveErrand' }).state;
    expect([s.day, s.phase, s.offer]).toEqual([FESTIVAL_DAY + 1, 'morning', null]);
  });

  it('keeps its stock in the event pool, off rewards and the Market', () => {
    const ids = codex.fairs.get('bloomtide')!.stalls.flatMap((st) => st.stock.map((i) => ('card' in i ? i.card : 'familiar' in i ? i.familiar : i.relic)));
    for (const id of ids) {
      const entry = codex.ingredients.get(id) ?? codex.tinctures.get(id) ?? codex.familiars.get(id) ?? codex.relics.get(id);
      expect(entry?.pool, id).toBe('event');
    }
  });
});

describe('Bloomtide stock', () => {
  function brew(cards: string[], patch: Partial<RunState> = {}) {
    const [s, uids] = withHand({ ...on('spring', 1), ...patch }, cards);
    const slotted = slotAll(s, uids);
    const p = previewBrew(slotted, slotted.cauldron, slotted.hand);
    if (p.kind !== 'potion') throw new Error(`expected a potion from ${cards.join(' + ')}`);
    return { p, state: slotted };
  }

  it('Primrose gains 1 Potency each time it is brewed', () => {
    const { state } = brew(['primrose', 'creekwater']);
    const uid = state.cauldron[0]!.uid;
    const r = ok(state, { type: 'brew' });
    expect(ofType(r.events, 'cardInfused')).toEqual([{ type: 'cardInfused', uid, bonus: 1 }]);
    expect([...r.state.discardPile, ...r.state.drawPile, ...r.state.hand].find((c) => c.uid === uid)?.bonus).toBe(1);
  });

  it('Bluebell has +3 Potency in the rain', () => {
    const dry = brew(['bluebell', 'creekwater']).p;
    const wet = brew(['bluebell', 'creekwater'], { calendar: sky('rain') }).p;
    // Rain also gives Tide +2 to each Tide card (Bluebell and Creekwater).
    expect(wet.potency - dry.potency).toBe(3 + 2 * 2);
  });

  it('Maybloom adds Harmony for each Flower in the brew', () => {
    const one = brew(['maybloom', 'elmroot']).p;
    const two = brew(['maybloom', 'thistledown']).p;
    expect(two.harmony).toBeGreaterThan(one.harmony);
  });

  it('the Bumblebee adds 3 Potency per Flower ingredient', () => {
    const plain = brew(['thistledown', 'elmroot']).p;
    const bee = brew(['thistledown', 'elmroot'], { familiars: ['bumblebee'] }).p;
    expect(bee.potency - plain.potency).toBe(3);
  });

  it('Royal Jelly blesses a card in hand', () => {
    const [s, [jelly, card]] = withHand(on('spring', 1), ['royal-jelly', 'elmroot']);
    const r = ok(s, { type: 'playTincture', uid: jelly!, targets: [card!] });
    expect(r.state.hand.find((c) => c.uid === card)?.modifier).toBe('blessed');
    expect(no(s, { type: 'playTincture', uid: jelly!, targets: [] })).toMatch(/choose one/);
  });

  it('the May Crown pays ×1.25 for potions with a Flower ingredient', () => {
    const s = ok(start('crown', 'spring'), { type: 'debug', op: 'giveRelic', relic: 'may-crown' }).state;
    const day2 = ok(ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state, { type: 'openShop' }).state;
    const o = { ...day2.orders[0]!, minTier: 'fine' as const };
    expect(o.tagBonus).toEqual({ tag: 'flower', mult: RELIC_RULES.mayCrownPay });
    const potion = (ingredients: string[]) => ({ tier: 'fine' as const, ingredients });
    expect(payout(potion(['thistledown']), o).pay).toBe(Math.round(payout(potion(['elmroot']), o).pay * RELIC_RULES.mayCrownPay));
  });
});
