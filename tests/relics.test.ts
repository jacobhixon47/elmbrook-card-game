import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, BLACK_MARKET_RELIC, CURSE_RULES, DISCARDS_PER_DAY, NIGHT_SHIFT_DAY, previewBrew, RELIC_FALLBACK_GOLD, RELIC_RULES, relicSteps, rentDue, rentOf,
  rewardCount, rewardWeights, tierStep, WEEKS, type Order, type RunState,
} from '../src/core';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

const give = (s: RunState, relics: string[] = [], curses: string[] = []): RunState => {
  let out = relics.reduce((st, relic) => ok(st, { type: 'debug', op: 'giveRelic', relic }).state, s);
  out = curses.reduce((st, curse) => ok(st, { type: 'debug', op: 'giveCurse', curse }).state, out);
  return out;
};

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

/** Preview these cards brewed in this state. */
function preview(s: RunState, cards: string[]) {
  const [h, uids] = withHand(s, cards);
  const slotted = slotAll(h, uids);
  return previewBrew(slotted, slotted.cauldron, slotted.hand);
}

/** Brew these cards for the order at 500, from a state with only that order open. */
function deliver(s: RunState, cards: string[] = ['elmroot', 'creekwater'], o: Partial<Order> = {}) {
  const [h, uids] = withHand(s, cards);
  return ok({ ...slotAll(h, uids), orders: [order(o)], fog: false }, { type: 'brew', deliverTo: 500 });
}

/** The Night Market on a week's night, with plenty of gold. */
function market(week: number, seed = 'relics'): RunState {
  let s = ok(start(seed), { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  s = ok(s, { type: 'debug', op: 'addGold', amount: 500 }).state;
  for (const a of [{ type: 'openShop' }, { type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
  while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
  return s;
}

describe('relics and curses in the codex', () => {
  it('has the 12 relics and 6 curses from the balance tables', () => {
    expect(codex.relics.size).toBe(12);
    expect(codex.curses.size).toBe(6);
    expect([1, 2, 3].map((t) => [...codex.relics.values()].filter((r) => r.tier === t).length)).toEqual([6, 4, 2]);
    expect([1, 2, 3].map((n) => [...codex.curses.values()].filter((c) => c.severity === n).length)).toEqual([2, 2, 2]);
  });

  it('starts a run with none', () => {
    const s = start('relics');
    expect([s.relics, s.curses]).toEqual([[], []]);
  });

  it('refuses a relic or curse you already have, or one that doesn\'t exist', () => {
    const s = give(brewing('relics'), ['guild-seal'], ['nameless']);
    expect(no(s, { type: 'debug', op: 'giveRelic', relic: 'guild-seal' })).toMatch(/already have/);
    expect(no(s, { type: 'debug', op: 'giveCurse', curse: 'nameless' })).toMatch(/already carry/);
    expect(no(s, { type: 'debug', op: 'giveRelic', relic: 'crown' })).toMatch(/unknown relic/);
    expect(no(s, { type: 'debug', op: 'giveCurse', curse: 'hexed' })).toMatch(/unknown curse/);
  });
});

describe('relics that change the rules', () => {
  it('the Guild Seal and Unpaid Debt change the rent', () => {
    const s = start('relics');
    expect(rentOf(s)).toBe(rentDue('spring', 1));
    expect(rentOf({ ...s, relics: ['guild-seal'] }, WEEKS)).toBe(Math.round(rentDue('spring', WEEKS) * RELIC_RULES.sealRent));
    expect(rentOf({ ...s, curses: ['unpaid-debt'] }, WEEKS)).toBe(Math.round(rentDue('spring', WEEKS) * CURSE_RULES.debtRent));
  });

  it('the Lucky Horseshoe and Sour Luck change reward picks', () => {
    const s = start('relics');
    expect(rewardCount(s)).toBe(3);
    expect(rewardCount({ ...s, relics: ['lucky-horseshoe'] })).toBe(4);
    expect(rewardCount({ ...s, curses: ['sour-luck'] })).toBe(2);
    expect(rewardWeights({ ...s, skipStreak: 3, curses: ['sour-luck'] })).toEqual(rewardWeights({ ...s, skipStreak: 0 }));
    const lucky = ok(give(brewing('relics'), ['lucky-horseshoe']), { type: 'endDay' }).state;
    expect(lucky.offer?.kind === 'reward' && lucky.offer.cards).toHaveLength(4);
  });

  it('the Spare Satchel adds a card to the hand and Leaky Roof takes a Shelf slot', () => {
    const s = brewing('relics');
    const more = give(s, ['spare-satchel'], ['leaky-roof']);
    expect(more.handSize).toBe(s.handSize + 1);
    expect(more.shelfSize).toBe(s.shelfSize - 1);
  });

  it('the Old Almanac, Heavy Hands and the Moon Locket change a day\'s Brews and Discards', () => {
    const rainy = (s: RunState) => {
      const wet = ok(s, { type: 'debug', op: 'setWeather', weather: 'rain' }).state;
      return ok(wet, { type: 'debug', op: 'jumpToDay', week: 1, day: 1 }).state;
    };
    const base = rainy(start('relics'));
    expect(base.discardsLeft).toBe(DISCARDS_PER_DAY);
    expect(rainy(give(start('relics'), ['old-almanac'])).discardsLeft).toBe(DISCARDS_PER_DAY + 1);
    expect(rainy(give(start('relics'), ['old-almanac'], ['heavy-hands'])).discardsLeft).toBe(DISCARDS_PER_DAY);
    const night = (s: RunState) => ok(s, { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state;
    expect(night(give(start('relics'), ['moon-locket'])).brewsLeft).toBe(night(start('relics')).brewsLeft + 1);
    expect(ok(give(start('relics'), ['moon-locket']), { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state.brewsLeft).toBe(ok(start('relics'), { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state.brewsLeft);
  });
});

describe('relics and curses on a brew', () => {
  it('the Pressed Flower adds Potency per Flower ingredient', () => {
    const s = brewing('relics');
    const plain = preview(s, ['emberbloom', 'elmroot']);
    const pressed = preview(give(s, ['pressed-flower']), ['emberbloom', 'elmroot']);
    if (plain.kind !== 'potion' || pressed.kind !== 'potion') throw new Error('expected potions');
    expect(pressed.potency - plain.potency).toBe(RELIC_RULES.flowerPotency);
    expect(pressed.steps.some((st) => st.source === 'relic' && st.id === 'pressed-flower')).toBe(true);
  });

  it('Moonsick takes Potency from Night Satchel cards', () => {
    const s = brewing('relics');
    const plain = preview(s, ['moonpetal', 'creekwater']);
    const sick = preview(give(s, [], ['moonsick']), ['moonpetal', 'creekwater']);
    if (plain.kind !== 'potion' || sick.kind !== 'potion') throw new Error('expected potions');
    expect(sick.potency - plain.potency).toBe(CURSE_RULES.moonsickPotency);
  });

  it('the Copper Ladle adds Harmony to three-ingredient brews only', () => {
    const elm = codex.ingredients.get('elmroot')!;
    expect(relicSteps({ relics: ['copper-ladle'] }, [elm, elm, elm]).map((x) => x.step.harmony)).toEqual([RELIC_RULES.ladleHarmony]);
    expect(relicSteps({ relics: ['copper-ladle'] }, [elm, elm])).toEqual([]);
  });

  it('the Witch\'s Hatpin brews Experiments at full quality', () => {
    const s = brewing('relics');
    const cards = ['thistledown', 'emberbloom'];
    const plain = preview(s, cards);
    const pinned = preview(give(s, ['witchs-hatpin']), cards);
    if (plain.kind !== 'potion' || pinned.kind !== 'potion') throw new Error('expected potions');
    expect(plain.known).toBe(false);
    expect(pinned.tier).toBe(tierStep(plain.tier, 1));
  });

  it('the Iron Lid catches the first failed brew each day', () => {
    const s = give(brewing('relics'), ['iron-lid']);
    const fail = (st: RunState) => {
      const [h, uids] = withHand(st, ['creekwater', 'creekwater']);
      return ok(slotAll(h, uids), { type: 'brew' });
    };
    const first = fail(s);
    expect(ofType(first.events, 'relicFired')).toEqual([{ type: 'relicFired', relic: 'iron-lid' }]);
    expect(allCards(first.state).filter((c) => c.card === 'sludge')).toHaveLength(0);
    const second = fail(first.state);
    expect(ofType(second.events, 'sludge')).toHaveLength(1);
  });

  it('the Kettle of Plenty shelves potions a tier higher once every order is resolved', () => {
    const s = { ...give(brewing('relics'), ['kettle-of-plenty']), orders: [] };
    const plain = preview(s, ['elmroot', 'creekwater']);
    if (plain.kind !== 'potion') throw new Error('expected a potion');
    const [h, uids] = withHand(s, ['elmroot', 'creekwater']);
    const r = ok(slotAll(h, uids), { type: 'brew' });
    expect(r.state.shelf.at(-1)!.tier).toBe(tierStep(plain.tier, 1));
    const busy = { ...s, orders: [order()] };
    const [b, bu] = withHand(busy, ['elmroot', 'creekwater']);
    expect(ok(slotAll(b, bu), { type: 'brew' }).state.shelf.at(-1)!.tier).toBe(plain.tier);
  });
});

describe('relics and curses on a delivery', () => {
  it('the Apprentice\'s Ledger pays a gold per order filled', () => {
    expect(deliver(give(brewing('relics'), ['apprentice-ledger'])).state.gold).toBe(deliver(brewing('relics')).state.gold + RELIC_RULES.ledgerGold);
  });

  it('the Silver Bell adds a heart for regulars, and Nameless stops hearts', () => {
    const hearts = (s: RunState) => deliver(s).state.hearts['old-tobin'] ?? 0;
    const plain = hearts(brewing('relics'));
    expect(hearts(give(brewing('relics'), ['silver-bell']))).toBe(plain + RELIC_RULES.bellHearts);
    expect(hearts(give(brewing('relics'), ['silver-bell'], ['nameless']))).toBe(0);
  });
});

describe('getting relics', () => {
  it('a patron\'s relic reward gives a relic of that tier, or gold once you hold them all', () => {
    const r = ok(brewing('relics'), { type: 'debug', op: 'patronReward', patron: 'clockless-man' });
    const [gained] = ofType(r.events, 'relicGained');
    expect(codex.relics.get(gained!.relic)!.tier).toBe(1);
    const all = { ...brewing('relics'), relics: [...codex.relics.keys()] };
    const full = ok(all, { type: 'debug', op: 'patronReward', patron: 'clockless-man' });
    expect(full.state.gold).toBe(all.gold + RELIC_FALLBACK_GOLD[1]);
  });

  it('falls back to a nearby tier when every relic of the asked tier is held', () => {
    const tier1 = [...codex.relics.values()].filter((r) => r.tier === 1).map((r) => r.id);
    const r = ok({ ...brewing('relics'), relics: tier1 }, { type: 'debug', op: 'patronReward', patron: 'clockless-man' });
    expect(codex.relics.get(ofType(r.events, 'relicGained')[0]!.relic)!.tier).toBe(2);
  });

  it('the Black Market and the Name-Taker never offer the same relic in one night', () => {
    for (let i = 0; i < 20; i++) {
      const s = market(WEEKS, `bm${i}`);
      if (s.offer?.kind !== 'night-market') throw new Error('expected the Night Market');
      const offered = s.offer.stalls.flatMap((st) => (st.id === 'name-taker' ? st.deals.map((d) => d.relic) : 'stock' in st ? st.stock.flatMap((x) => (x.kind === 'relic' ? [x.relic] : [])) : []));
      expect(new Set(offered).size).toBe(offered.length);
      const bm = s.offer.stalls.find((st) => st.id === 'black-market');
      if (bm && 'stock' in bm) expect(bm.stock.filter((x) => x.kind === 'relic').every((x) => x.kind === 'relic' && codex.relics.get(x.relic)!.tier === BLACK_MARKET_RELIC.tier)).toBe(true);
    }
  });

  it('buying the Black Market\'s relic adds it', () => {
    let s = market(WEEKS);
    if (s.offer?.kind !== 'night-market') throw new Error('expected the Night Market');
    s = ok(s, { type: 'visitStall', index: s.offer.stalls.findIndex((st) => st.id === 'black-market') }).state;
    const stock = s.offer?.kind === 'night-market' && s.offer.at !== null ? (s.offer.stalls[s.offer.at] as { stock: { kind: string; relic?: string }[] }).stock : [];
    const i = stock.findIndex((x) => x.kind === 'relic');
    const r = ok(s, { type: 'buy', index: i });
    expect(r.state.relics).toEqual([stock[i]!.relic]);
    expect(r.state.gold).toBe(s.gold - BLACK_MARKET_RELIC.price);
  });
});

describe('the Name-Taker', () => {
  const nameTaker = (seed = 'relics') => {
    const s = market(2, seed);
    if (s.offer?.kind !== 'night-market') throw new Error('expected the Night Market');
    return ok(s, { type: 'visitStall', index: s.offer.stalls.findIndex((st) => st.id === 'name-taker') }).state;
  };
  const stall = (s: RunState) => {
    const st = s.offer?.kind === 'night-market' && s.offer.at !== null ? s.offer.stalls[s.offer.at] : undefined;
    if (st?.id !== 'name-taker') throw new Error('expected the Name-Taker');
    return st;
  };

  it('opens with the full moon and offers two deals, each relic\'s tier matching its Curse\'s severity', () => {
    const s = nameTaker();
    const deals = stall(s).deals;
    expect(deals).toHaveLength(2);
    for (const d of deals) expect(codex.relics.get(d.relic)!.tier).toBe(codex.curses.get(d.curse)!.severity);
    expect(new Set(deals.map((d) => d.curse)).size).toBe(2);
  });

  it('takes a deal once a night: the Curse and the relic', () => {
    const s = nameTaker();
    const deal = stall(s).deals[1]!;
    const r = ok(s, { type: 'takeDeal', index: 1 });
    expect(r.state.curses).toEqual([deal.curse]);
    expect(r.state.relics).toEqual([deal.relic]);
    expect(no(r.state, { type: 'takeDeal', index: 0 })).toMatch(/one deal a night/);
    expect(no(s, { type: 'takeDeal', index: 5 })).toMatch(/no deal 5/);
  });

  it('only offers Curses you don\'t carry', () => {
    const carried = ['nameless', 'leaky-roof', 'sour-luck', 'moonsick', 'heavy-hands'];
    let s = give(start('relics'), [], carried);
    s = ok(s, { type: 'debug', op: 'jumpToDay', week: 2, day: NIGHT_SHIFT_DAY }).state;
    s = ok(s, { type: 'debug', op: 'addGold', amount: 500 }).state;
    for (const a of [{ type: 'openShop' }, { type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
    while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
    if (s.offer?.kind !== 'night-market') throw new Error('expected the Night Market');
    const nt = s.offer.stalls.find((st) => st.id === 'name-taker');
    expect(nt && 'deals' in nt ? nt.deals.map((d) => d.curse) : []).toEqual(['unpaid-debt']);
  });
});

describe('lifting curses', () => {
  it('the Hearth can lift a Curse instead of burning a card', () => {
    let s = give(start('relics'), [], ['leaky-roof', 'nameless']);
    for (const a of [{ type: 'openShop' }, { type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
    if (s.offer?.kind !== 'errands' || !s.offer.options.includes('hearth')) s = { ...s, offer: { kind: 'hearth', removed: false } };
    else s = ok(s, { type: 'chooseErrand', errand: 'hearth' }).state;
    expect(no(s, { type: 'liftCurse', curse: 'sour-luck' })).toMatch(/don't carry/);
    const r = ok(s, { type: 'liftCurse', curse: 'leaky-roof' });
    expect(r.state.curses).toEqual(['nameless']);
    expect(r.state.shelfSize).toBe(s.shelfSize + 1);
    expect(ofType(r.events, 'curseLifted')).toEqual([{ type: 'curseLifted', curse: 'leaky-roof', by: 'hearth' }]);
    expect(no(r.state, { type: 'liftCurse', curse: 'nameless' })).toMatch(/one card a night/);
    expect(no(r.state, { type: 'removeCard', uid: allCards(r.state)[0]!.uid })).toMatch(/one card a night/);
  });

  it('the Sleepless Miller lifts your oldest Curse', () => {
    let s = ok(start('relics'), { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state;
    s = give(ok(s, { type: 'openShop' }).state, [], ['nameless', 'moonsick']);
    const r = deliver(s, ['elmroot', 'creekwater'], { customer: 'sleepless-miller', request: { kind: 'family', family: 'healing' } });
    expect(r.state.curses).toEqual(['moonsick']);
    expect(ofType(r.events, 'curseLifted')[0]).toMatchObject({ curse: 'nameless', by: 'sleepless-miller' });
  });
});
