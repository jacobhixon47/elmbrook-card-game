import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  dayAllowance, FAMILIAR_SCORE, fencePrice, FESTIVAL_DAY, FESTIVAL_WEEK, migrateRun, NIGHT_SHIFT_DAY, previewBrew, RELIC_RULES, relicSteps, RUN_VERSION, WEEKS,
  type Calendar, type FamiliarBrew, type Order, type RunState, type Season, type Weather,
} from '../src/core';
import { EFFECTS, type ScoreCtx } from '../src/core/effects';
import { brewing, ofType, ok, slotAll, start, withHand } from './helpers';

const sky = (weather: Weather): Calendar => ({
  weather: Array.from({ length: WEEKS }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => weather)),
  sky: null,
});

/** A run on this day with the shop open. */
function on(season: Season, week = 1, day = 1, weather: Weather = 'clear'): RunState {
  const s = { ...start('fairs', season), calendar: sky(weather) };
  return ok(ok(s, { type: 'debug', op: 'jumpToDay', week, day }).state, { type: 'openShop' }).state;
}

const give = (s: RunState, relics: string[]): RunState => relics.reduce((st, relic) => ok(st, { type: 'debug', op: 'giveRelic', relic }).state, s);
const ing = (id: string) => codex.ingredients.get(id)!;

/** What an ingredient effect adds to a brew of these ingredients. */
function effect(id: string, ings: string[], patch: Partial<ScoreCtx> = {}) {
  const c = { potency: 0, harmony: 0, ingredients: ings.map(ing), weather: 'clear', recipe: { family: 'healing' }, ...patch } as unknown as ScoreCtx;
  EFFECTS[id]!.onScore!(c);
  return { potency: c.potency, harmony: c.harmony };
}

const fam = (id: string, ids: string[], patch: Partial<FamiliarBrew> = {}) =>
  FAMILIAR_SCORE[id]!({ ingredients: ids.map(ing), firstPotency: 0, shelf: 0, night: false, firstBrew: false, ...patch });

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

/** Brew Elmroot and Creekwater for an order, from a state where that is the only order. */
function deliver(s: RunState, orders: Order[] = [order()]) {
  const [h, uids] = withHand(s, ['elmroot', 'creekwater']);
  return ok({ ...slotAll(h, uids), orders, fog: false }, { type: 'brew', deliverTo: 500 });
}

describe('the Firefly and Harvest Fairs', () => {
  it('each sets out 2 of 6 per stall, all festival-only', () => {
    for (const id of ['firefly-fair', 'harvest-fair']) {
      const fair = codex.fairs.get(id)!;
      expect(fair.stalls.map((st) => [st.stock.length, st.show])).toEqual([[6, 2], [6, 2], [6, 2]]);
      for (const item of fair.stalls.flatMap((st) => st.stock)) {
        const ref = 'card' in item ? item.card : 'familiar' in item ? item.familiar : item.relic;
        const entry = codex.ingredients.get(ref) ?? codex.tinctures.get(ref) ?? codex.familiars.get(ref) ?? codex.relics.get(ref);
        expect(entry?.pool, ref).toBe('event');
      }
    }
  });

  it('opens after closing on festival day in summer and autumn', () => {
    for (const [season, fair] of [['summer', 'firefly-fair'], ['autumn', 'harvest-fair']] as const) {
      const s = ok({ ...on(season, FESTIVAL_WEEK, FESTIVAL_DAY), gold: 100 }, { type: 'endDay' }).state;
      expect(s.offer).toMatchObject({ kind: 'fair', fair });
    }
  });
});

describe('Firefly Fair stock', () => {
  it('Sunpeach, Melon and Starfruit', () => {
    expect(effect('potency-3-if-heatwave', ['sunpeach'], { weather: 'heatwave' }).potency).toBe(3);
    expect(effect('potency-3-if-heatwave', ['sunpeach']).potency).toBe(0);
    expect(effect('harmony-2-if-heatwave', ['melon'], { weather: 'heatwave' }).harmony).toBe(2);
    expect(effect('harmony-per-fruit-in-brew', ['starfruit', 'sunberry', 'elmroot']).harmony).toBe(2);
  });

  it('Fruit shows as a mark on the cards that have it', () => {
    expect(['sunberry', 'blackberry', 'hollyberry', 'sunpeach', 'starfruit'].every((id) => ing(id).tags.includes('fruit'))).toBe(true);
  });

  it('the Firefly Jar draws 3, or 4 on a Night Shift', () => {
    for (const [day, n] of [[1, 3], [NIGHT_SHIFT_DAY, 4]] as const) {
      const [s, [jar]] = withHand(on('summer', 1, day), ['firefly-jar']);
      expect(ok(s, { type: 'playTincture', uid: jar! }).state.hand).toHaveLength(n);
    }
  });

  it('the Sun Bottle and the Prism', () => {
    for (const [weather, n] of [['clear', 4], ['heatwave', 8]] as const) {
      const [s, [bottle]] = withHand(on('summer', 1, 1, weather), ['sun-bottle']);
      expect(ok(s, { type: 'playTincture', uid: bottle! }).state.pending.potency).toBe(n);
    }
    const brew = (essenceHarmony: number) => {
      const [h, uids] = withHand(on('summer'), ['maybloom', 'creekwater']);
      const s = slotAll({ ...h, pending: { ...h.pending, essenceHarmony } }, uids);
      const p = previewBrew(s, s.cauldron, s.hand);
      return p.kind === 'potion' ? p.harmony : 0;
    };
    // Maybloom and Creekwater: Vital, Gale and Tide.
    expect(brew(1) - brew(0)).toBe(3);
  });

  it('the Dragonfly and the Cricket', () => {
    expect(fam('dragonfly', ['starfruit', 'elmroot'])?.potency).toBe(3);
    expect(fam('cricket', ['elmroot'], { weather: 'heatwave' })?.harmony).toBe(2);
    expect(fam('cricket', ['elmroot'], { weather: 'rain' })).toBeNull();
  });

  it('the Orchard Basket, Sun Bonnet, Lantern Glass and Straw Hat', () => {
    expect(relicSteps({ relics: ['orchard-basket'] }, [ing('sunberry'), ing('plum')])[0]!.step.potency).toBe(2);
    expect(relicSteps({ relics: ['sun-bonnet'], brewsToday: 0 }, [ing('elmroot')], 'heatwave')[0]!.step.harmony).toBe(RELIC_RULES.bonnetHarmony);
    expect(relicSteps({ relics: ['sun-bonnet'], brewsToday: 1 }, [ing('elmroot')], 'heatwave')).toEqual([]);
    const base = { brews: 4, discards: 3 };
    expect(dayAllowance({ relics: ['lantern-glass'], curses: [] }, base, true, 'clear').discards).toBe(4);
    expect(dayAllowance({ relics: ['lantern-glass'], curses: [] }, base, false, 'clear').discards).toBe(3);
    expect(dayAllowance({ relics: ['straw-hat'], curses: [] }, base, false, 'heatwave').discards).toBe(4);
    expect(dayAllowance({ relics: ['straw-hat'], curses: [] }, base, false, 'rain').discards).toBe(3);
  });

  it('the Bottle Rack adds a Shelf slot', () => {
    const s = brewing('fairs');
    expect(give(s, ['bottle-rack']).shelfSize).toBe(s.shelfSize + RELIC_RULES.rackShelf);
  });

  it('the Feathered Cap tips and the Picnic Blanket pays the day\'s first order', () => {
    const s = brewing('fairs');
    const plain = deliver(s).state.gold;
    expect(deliver(give(s, ['feathered-cap'])).state.gold).toBe(plain + RELIC_RULES.capTip);
    expect(deliver(give(s, ['picnic-blanket'])).state.gold).toBe(plain + RELIC_RULES.picnicGold);
    const filled = order({ id: 499, status: 'filled' });
    expect(deliver(give(s, ['picnic-blanket']), [filled, order()]).state.gold).toBe(deliver(s, [filled, order()]).state.gold);
  });
});

describe('Harvest Fair stock', () => {
  it('Hazelnut, Golden Wheat and Chestnut', () => {
    expect(effect('harmony-2-if-protection', ['hazelnut'], { recipe: { family: 'protection' } as ScoreCtx['recipe'] }).harmony).toBe(2);
    expect(effect('harmony-2-if-protection', ['hazelnut']).harmony).toBe(0);
    expect(effect('harmony-per-stone-in-brew', ['golden-wheat', 'river-clay', 'hazelnut']).harmony).toBe(2);
    expect(effect('potency-3-if-warming', ['chestnut'], { recipe: { family: 'warming' } as ScoreCtx['recipe'] }).potency).toBe(3);
  });

  it('the Prize Pumpkin ages 2 a day', () => {
    let s = brewing('fairs');
    s = { ...s, drawPile: [...s.drawPile, { uid: 900, card: 'prize-pumpkin' }, { uid: 901, card: 'plum' }] };
    s = ok(s, { type: 'endDay' }).state;
    const aged = (uid: number) => [...s.drawPile, ...s.discardPile, ...s.hand].find((c) => c.uid === uid)?.aged;
    expect([aged(900), aged(901)]).toEqual([2, 1]);
  });

  it('Mulling Spice adds Potency to Ember ingredients today', () => {
    const potency = (emberPotencyToday: number) => {
      const [h, uids] = withHand(on('autumn'), ['emberbloom', 'elmroot']);
      const s = slotAll({ ...h, emberPotencyToday }, uids);
      const p = previewBrew(s, s.cauldron, s.hand);
      return p.kind === 'potion' ? p.potency : 0;
    };
    expect(potency(2) - potency(0)).toBe(2);
    const [s, [spice]] = withHand(on('autumn'), ['mulling-spice']);
    expect(ok(s, { type: 'playTincture', uid: spice! }).state.emberPotencyToday).toBe(2);
  });

  it('the Scarecrow, Badger and Harvest Hare', () => {
    expect(fam('scarecrow', ['elmroot', 'golden-wheat'])?.harmony).toBe(2);
    expect(fam('badger', ['hazelnut', 'elmroot'])?.potency).toBe(3);
    expect(fam('harvest-hare', ['elmroot', 'creekwater', 'hazelnut'])?.potency).toBe(3);
    expect(fam('harvest-hare', ['elmroot', 'creekwater'])).toBeNull();
  });

  it('the Apple Press pays more at the Fence for Fine or better', () => {
    const p = (tier: 'crude' | 'fine') => ({ tier, ingredients: ['elmroot'], family: 'healing' as const });
    const s = { season: 'autumn' as const, relics: ['apple-press'] };
    expect(fencePrice(p('fine'), s)).toBe(fencePrice(p('fine'), { season: 'autumn' }) + RELIC_RULES.pressGold);
    expect(fencePrice(p('crude'), s)).toBe(fencePrice(p('crude'), { season: 'autumn' }));
  });

  it('the Corn Dolly doubles the week\'s first delivery only', () => {
    const s = brewing('fairs');
    const first = deliver(give(s, ['corn-dolly']));
    const filled = ofType(first.events, 'orderFilled')[0]!;
    expect(filled.pay).toBe(ofType(deliver(s).events, 'orderFilled')[0]!.pay * RELIC_RULES.dollyPay);
    expect(first.state.weekDeliveries).toBe(1);
    const second = deliver(first.state);
    expect(ofType(second.events, 'orderFilled')[0]!.pay).toBe(ofType(deliver(s).events, 'orderFilled')[0]!.pay);
  });

  it('the Harvest Wreath, the Wicker Basket and the Rush Lantern', () => {
    expect(relicSteps({ relics: ['harvest-wreath'], week: 4 }, [ing('elmroot')])[0]!.step.harmony).toBe(RELIC_RULES.wreathHarmony);
    expect(relicSteps({ relics: ['harvest-wreath'], week: 3 }, [ing('elmroot')])).toEqual([]);
    const forage = (relics: string[]) => {
      const s = ok(ok(give(brewing('fairs'), relics), { type: 'endDay' }).state, { type: 'skipReward' }).state;
      const r = ok(s, { type: 'debug', op: 'openErrand', errand: 'forage' }).state;
      return r.offer?.kind === 'forage' ? r.offer.picksLeft : 0;
    };
    expect(forage(['wicker-basket'])).toBe(forage([]) + RELIC_RULES.wickerPicks);
    const foggy = (relics: string[]) => give({ ...start('fairs', 'autumn'), calendar: sky('fog') }, relics);
    expect(ok(foggy([]), { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state.fog).toBe(true);
    expect(ok(foggy(['rush-lantern']), { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state.fog).toBe(false);
  });
});

describe('saves', () => {
  it('a version 15 run gains the fairs\' counters', () => {
    const s = brewing('migrate');
    const old: Record<string, unknown> = { ...s, version: 15, pending: { ...s.pending, essenceHarmony: undefined } };
    delete old.emberPotencyToday;
    delete old.weekDeliveries;
    expect(migrateRun(JSON.parse(JSON.stringify(old)))).toMatchObject({ version: RUN_VERSION, emberPotencyToday: 0, weekDeliveries: 0, pending: { essenceHarmony: 0 } });
  });
});
