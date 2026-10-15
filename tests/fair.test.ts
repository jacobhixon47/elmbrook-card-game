import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  FAMILIAR_SCORE, fencePrice, FESTIVAL_DAY, FESTIVAL_WEEK, NIGHT_SHIFT_DAY, payout, previewBrew, RELIC_RULES, relicSteps, WEEKS, type Calendar, type RunState, type Season, type Weather,
} from '../src/core';
import { no, ofType, ok, slotAll, start, withHand } from './helpers';
import { EFFECTS, type ScoreCtx } from '../src/core/effects';

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
    expect(stallsOf(r.state).map((st) => st.id)).toEqual(['flower-grower', 'beekeeper', 'garland-weaver']);
    // Any other spring day still gets the reward pick.
    expect(ok(on('spring', FESTIVAL_DAY - 1), { type: 'endDay' }).state.offer?.kind).toBe('reward');
  });

  it('is not held in seasons whose fair isn\'t built yet', () => {
    for (const season of ['summer', 'autumn', 'winter'] as const) {
      expect(ok(on(season), { type: 'endDay' }).state.offer?.kind).toBe('reward');
    }
  });

  /** The open fair's stalls. */
  const stallsOf = (s: RunState) => {
    if (s.offer?.kind !== 'fair') throw new Error('expected the fair');
    return s.offer.stalls;
  };

  it('sells what its stalls set out for gold, once each', () => {
    let s = atFair();
    const item = stallsOf(s)[0]!.stock[0]!;
    if (item.kind !== 'card') throw new Error('the Flower Grower sells cards');
    s = ok(s, { type: 'buyAtFair', stall: 0, index: 0 }).state;
    expect(s.gold).toBe(100 - item.price);
    expect(s.discardPile.some((c) => c.card === item.card)).toBe(true);
    expect(no(s, { type: 'buyAtFair', stall: 0, index: 0 })).toMatch(/sold/);
    // Buy everything else on offer: familiars take a slot, relics join the run.
    stallsOf(s).forEach((st, si) => st.stock.forEach((it, i) => {
      if (!it.sold) s = ok(s, { type: 'buyAtFair', stall: si, index: i }).state;
    }));
    const bought = stallsOf(s).flatMap((st) => st.stock);
    expect(bought.every((i) => i.sold)).toBe(true);
    for (const i of bought) {
      if (i.kind === 'familiar') expect(s.familiars).toContain(i.familiar);
      if (i.kind === 'relic') expect(s.relics).toContain(i.relic);
    }
    expect(no({ ...atFair(), gold: 0 }, { type: 'buyAtFair', stall: 0, index: 1 })).toMatch(/gold/);
    expect(no(s, { type: 'buyAtFair', stall: 9, index: 0 })).toMatch(/no stock/);
  });

  it('sets out 2 of each stall\'s 6, a different few each fair', () => {
    const fair = codex.fairs.get('bloomtide')!;
    expect(fair.stalls.map((st) => [st.stock.length, st.show])).toEqual([[6, 2], [6, 2], [6, 2]]);
    const seen = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const s = { ...start(seed, 'spring'), calendar: sky('clear'), gold: 100 };
      const r = ok(ok(ok(s, { type: 'debug', op: 'jumpToDay', week: FESTIVAL_WEEK, day: FESTIVAL_DAY }).state, { type: 'openShop' }).state, { type: 'endDay' }).state;
      const stock = stallsOf(r)[0]!.stock;
      expect(stock).toHaveLength(2);
      seen.add(stock.map((i) => (i.kind === 'card' ? i.card : '')).join());
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('leaves out familiars and relics you already have', () => {
    let s = on('spring');
    const items = codex.fairs.get('bloomtide')!.stalls.flatMap((st) => st.stock);
    for (const i of items) {
      if ('familiar' in i) s = ok(s, { type: 'debug', op: 'giveFamiliar', familiar: i.familiar }).state;
      if ('relic' in i) s = ok(s, { type: 'debug', op: 'giveRelic', relic: i.relic }).state;
    }
    const stock = stallsOf(ok(s, { type: 'endDay' }).state).flatMap((st) => st.stock);
    expect(stock.length).toBeGreaterThan(0);
    expect(stock.every((i) => i.kind === 'card')).toBe(true);
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

  const ing = (id: string) => codex.ingredients.get(id)!;

  it('Snowdrop adds Harmony on the day\'s first brew only', () => {
    const first = brew(['snowdrop', 'creekwater']).p;
    const later = brew(['snowdrop', 'creekwater'], { brewsToday: 1 }).p;
    expect(first.harmony - later.harmony).toBe(2);
  });

  it('Daffodil adds 2 Potency for each other Flower', () => {
    const score = (ids: string[]) => {
      const c = { potency: 0, harmony: 0, ingredients: ids.map(ing) } as unknown as ScoreCtx;
      EFFECTS['potency-2-per-other-flower']!.onScore!(c);
      return c.potency;
    };
    expect([score(['daffodil', 'elmroot']), score(['daffodil', 'thistledown']), score(['daffodil', 'daffodil', 'primrose'])]).toEqual([0, 2, 4]);
  });

  it('Beeswax Candle, Spring Mead and Garland', () => {
    const [s, [candle, mead, garland]] = withHand(on('spring', 1), ['beeswax-candle', 'spring-mead', 'garland', 'thistledown', 'elmroot']);
    let r = ok(s, { type: 'playTincture', uid: candle! }).state;
    expect(r.pending.harmony).toBe(3);
    r = ok(r, { type: 'playTincture', uid: mead! }).state;
    expect(r.brewsLeft).toBe(s.brewsLeft + 1);
    r = ok(r, { type: 'playTincture', uid: garland! }).state;
    expect(r.flowerPotencyToday).toBe(2);
    const plain = brew(['thistledown', 'elmroot']).p;
    const garlanded = brew(['thistledown', 'elmroot'], { flowerPotencyToday: 2 }).p;
    expect(garlanded.potency - plain.potency).toBe(2);
  });

  it('the Queen Bee multiplies Harmony on brews with two Flowers', () => {
    const b = (ids: string[]) => FAMILIAR_SCORE['queen-bee']!({ ingredients: ids.map(ing), firstPotency: 0, shelf: 0, night: false, firstBrew: false });
    expect(b(['thistledown', 'elmroot'])).toBeNull();
    expect(b(['thistledown', 'maybloom'])?.harmonyMult).toBe(1.5);
  });

  it('the Hive Smoker draws one more on the first Discard each day', () => {
    const s = ok(on('spring', 1), { type: 'debug', op: 'giveRelic', relic: 'hive-smoker' }).state;
    const one = s.hand[0]!.uid;
    const r = ok(s, { type: 'discard', uids: [one] });
    expect(r.state.hand).toHaveLength(s.hand.length + 1);
    expect(ofType(r.events, 'relicFired')).toEqual([{ type: 'relicFired', relic: 'hive-smoker' }]);
    const again = ok(r.state, { type: 'discard', uids: [r.state.hand[0]!.uid] });
    expect(again.state.hand).toHaveLength(s.handSize);
    expect(ofType(again.events, 'relicFired')).toEqual([]);
  });

  it('the Daisy Chain gives Blessed cards +2 Potency', () => {
    const blessed = (relics: string[]) => {
      const [s, uids] = withHand({ ...on('spring', 1), relics }, ['elmroot', 'creekwater']);
      s.hand[0]!.modifier = 'blessed';
      const slotted = slotAll(s, uids);
      const p = previewBrew(slotted, slotted.cauldron, slotted.hand);
      return p.kind === 'potion' ? p.potency : 0;
    };
    expect(blessed(['daisy-chain']) - blessed([])).toBe(RELIC_RULES.daisyPotency);
  });

  it('the Maypole adds Harmony per distinct essence on the first brew', () => {
    const raw = [ing('maybloom'), ing('elmroot')];
    expect(relicSteps({ relics: ['maypole'], brewsToday: 0 }, raw)[0]!.step.harmony).toBe(2);
    expect(relicSteps({ relics: ['maypole'], brewsToday: 1 }, raw)).toEqual([]);
  });

  it('the Flower Basket holds one more card on Clear days', () => {
    const hand = (weather: Weather, relics: string[]) => {
      const s = { ...start('basket', 'spring'), calendar: sky(weather), relics };
      return ok(s, { type: 'openShop' }).state.hand.length;
    };
    expect(hand('clear', ['flower-basket'])).toBe(hand('clear', []) + RELIC_RULES.basketHand);
    expect(hand('rain', ['flower-basket'])).toBe(hand('rain', []));
  });

  it('the Ivy Wreath raises Fence prices by a quarter', () => {
    const p = { tier: 'fine' as const, ingredients: ['elmroot'], family: 'healing' as const };
    expect(fencePrice(p, { season: 'spring', relics: ['ivy-wreath'] })).toBe(Math.round(fencePrice(p, { season: 'spring' }) * RELIC_RULES.wreathFence));
  });
});
