import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  FAMILIAR_RULES, FAMILIAR_SCORE, FAMILIAR_SLOTS, familiarPool, familiarPrice, NIGHT_SHIFT_DAY, payout, previewBrew, sellPrice,
  type FamiliarBrew, type Order, type RunState,
} from '../src/core';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

/** A brewing run with these familiars in these slots. */
function withFamiliars(familiars: string[], s: RunState = brewing('familiars')): RunState {
  return familiars.reduce((st, familiar) => ok(st, { type: 'debug', op: 'giveFamiliar', familiar }).state, s);
}

/** Potency and Harmony of these ingredients brewed with these familiars. */
function score(familiars: string[], cards: string[], patch: Partial<RunState> = {}) {
  const [s, uids] = withHand(withFamiliars(familiars), cards);
  const slotted = { ...slotAll(s, uids), ...patch };
  const p = previewBrew(slotted, slotted.cauldron, slotted.hand);
  if (p.kind !== 'potion') throw new Error(`expected a potion from ${cards.join(' + ')}`);
  return p;
}

/** How much a familiar line-up changes Potency and Harmony over brewing with none. */
function delta(familiars: string[], cards: string[], patch: Partial<RunState> = {}) {
  const base = score([], cards, patch);
  const with_ = score(familiars, cards, patch);
  return { potency: with_.potency - base.potency, harmony: with_.harmony - base.harmony, base, with: with_ };
}

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

describe('familiars in the codex', () => {
  it('has the 20 from the balance tables, 4 of them unlocked by meta-progression', () => {
    expect(codex.familiars.size).toBe(20);
    expect([...codex.familiars.values()].filter((f) => f.pool === 'unlock').map((f) => f.id).sort()).toEqual(['fox', 'hob', 'magpie', 'old-hound']);
    for (const id of Object.keys(FAMILIAR_SCORE)) expect(codex.familiars.has(id), id).toBe(true);
  });

  it('prices by rarity and sells for half, rounded down', () => {
    expect(familiarPrice('hedgehog')).toBe(8);
    expect(familiarPrice('raven')).toBe(12);
    expect(familiarPrice('moth')).toBe(18);
    expect(sellPrice('hedgehog')).toBe(4);
    expect(sellPrice('moth')).toBe(9);
  });

  it('offers only base-pool familiars you lack, plus unlocked ones', () => {
    const s = withFamiliars(['hedgehog']);
    const pool = familiarPool(s).map((f) => f.id);
    expect(pool).not.toContain('hedgehog');
    expect(pool).not.toContain('fox');
    expect(familiarPool({ ...s, unlocks: ['fox'] }).map((f) => f.id)).toContain('fox');
    expect(familiarPool(s, 'rare').every((f) => f.rarity === 'rare')).toBe(true);
  });
});

describe('familiar slots', () => {
  it('starts with 4 empty slots', () => {
    const s = start('slots');
    expect(s.familiars).toEqual([]);
    expect(s.familiarSlots).toBe(FAMILIAR_SLOTS);
  });

  it('refuses a duplicate, an unknown familiar or a fifth one', () => {
    const s = withFamiliars(['hedgehog', 'heron', 'otter', 'moth']);
    expect(no(s, { type: 'debug', op: 'giveFamiliar', familiar: 'salamander' })).toMatch(/sell one first/);
    const three = withFamiliars(['hedgehog']);
    expect(no(three, { type: 'debug', op: 'giveFamiliar', familiar: 'hedgehog' })).toMatch(/already have the Hedgehog/);
    expect(no(three, { type: 'debug', op: 'giveFamiliar', familiar: 'griffin' })).toMatch(/unknown familiar/);
  });

  it('sells for half price and frees the slot', () => {
    const s = withFamiliars(['hedgehog', 'moth']);
    const r = ok(s, { type: 'sellFamiliar', index: 1 });
    expect(r.state.familiars).toEqual(['hedgehog']);
    expect(r.state.gold).toBe(s.gold + 9);
    expect(ofType(r.events, 'familiarSold')).toEqual([{ type: 'familiarSold', familiar: 'moth', price: 9 }]);
    expect(no(s, { type: 'sellFamiliar', index: 3 })).toMatch(/no familiar in slot 3/);
  });

  it('moves a familiar to another slot', () => {
    const s = withFamiliars(['hedgehog', 'heron', 'otter']);
    expect(ok(s, { type: 'moveFamiliar', from: 2, to: 0 }).state.familiars).toEqual(['otter', 'hedgehog', 'heron']);
    expect(ok(s, { type: 'moveFamiliar', from: 0, to: 1 }).state.familiars).toEqual(['heron', 'hedgehog', 'otter']);
    expect(no(s, { type: 'moveFamiliar', from: 0, to: 3 })).toMatch(/no such familiar slot/);
    expect(no(s, { type: 'moveFamiliar', from: 4, to: 0 })).toMatch(/no such familiar slot/);
  });
});

describe('familiars that score', () => {
  it('adds Potency per matching ingredient', () => {
    expect(delta(['hedgehog'], ['river-clay', 'elmroot']).potency).toBe(4);
    expect(delta(['heron'], ['elmroot', 'creekwater']).potency).toBe(3);
    expect(delta(['salamander'], ['emberbloom', 'elmroot']).potency).toBe(3);
    expect(delta(['garden-snail'], ['willow-bark', 'creekwater']).potency).toBe(2);
    expect(delta(['hedgehog'], ['elmroot', 'creekwater']).potency).toBe(0);
  });

  it('adds Harmony for the Shelf, pairs, Umbra, Night Shifts, Frost and distinct essences', () => {
    const [shelved] = withHand(brewing('familiars'), []);
    const shelf = [...shelved.shelf, { uid: 700, recipe: 'healing-draught', family: 'healing' as const, quality: 9, tier: 'fine' as const, ingredients: ['elmroot', 'creekwater'], experiment: false, heartDelta: 0 }];
    expect(delta(['hearth-toad'], ['elmroot', 'creekwater'], { shelf: [...shelf, { ...shelf[0]!, uid: 701 }] }).harmony).toBe(2);
    expect(delta(['otter'], ['elmroot', 'creekwater']).harmony).toBe(2);
    expect(delta(['black-cat'], ['nightshade', 'creekwater']).harmony).toBe(3);
    expect(delta(['firefly'], ['elmroot', 'creekwater']).harmony).toBe(0);
    expect(delta(['firefly'], ['elmroot', 'creekwater'], { day: NIGHT_SHIFT_DAY }).harmony).toBe(3);
    expect(delta(['frost-hare'], ['pine-resin', 'elmroot']).harmony).toBe(1);
    expect(delta(['jackdaw'], ['willow-bark', 'creekwater']).harmony).toBe(2);
    expect(delta(['jackdaw'], ['pine-resin', 'elmroot']).harmony).toBe(3);
  });

  it('the Will-o\'-Wisp doubles Harmony on the first brew of the day only', () => {
    const first = delta(['will-o-wisp'], ['elmroot', 'creekwater']);
    expect(first.with.harmony).toBe(first.base.harmony * 2);
    expect(delta(['will-o-wisp'], ['elmroot', 'creekwater'], { brewsToday: 1 }).harmony).toBe(0);
  });

  it('the Old Hound multiplies Harmony on three-ingredient brews', () => {
    const brew = (n: number): FamiliarBrew => ({
      ingredients: Array.from({ length: n }, () => codex.ingredients.get('elmroot')!), firstPotency: 4, shelf: 0, night: false, firstBrew: false,
    });
    expect(FAMILIAR_SCORE['old-hound']!(brew(3))?.harmonyMult).toBe(1.5);
    expect(FAMILIAR_SCORE['old-hound']!(brew(2))).toBeNull();
  });

  it('the Hob counts the first ingredient\'s Potency twice', () => {
    expect(delta(['hob'], ['river-clay', 'elmroot']).potency).toBe(5);
    expect(delta(['hob'], ['elmroot', 'river-clay']).potency).toBe(4);
  });

  it('resolves in slot order, so a flat bonus before a multiplier is multiplied', () => {
    const cards = ['elmroot', 'creekwater'];
    const base = score([], cards).harmony;
    expect(score(['jackdaw', 'will-o-wisp'], cards).harmony).toBe((base + 2) * 2);
    expect(score(['will-o-wisp', 'jackdaw'], cards).harmony).toBe(base * 2 + 2);
    const steps = score(['otter', 'heron'], cards).steps.filter((st) => st.source === 'familiar').map((st) => st.id);
    expect(steps).toEqual(['otter', 'heron']);
  });

  it('the Moth lets a Lunar ingredient stand in for any essence', () => {
    // Starlit Dew and Creekwater fit no two-ingredient recipe, so this is sludge without the Moth.
    const [s, uids] = withHand(withFamiliars(['moth']), ['starlit-dew', 'creekwater']);
    const slotted = slotAll(s, uids);
    const p = previewBrew(slotted, slotted.cauldron, slotted.hand);
    expect(p.kind).toBe('potion');
    const [bare, bu] = withHand(brewing('familiars'), ['starlit-dew', 'creekwater']);
    const plain = slotAll(bare, bu);
    expect(previewBrew(plain, plain.cauldron, plain.hand).kind).toBe('sludge');
  });
});

describe('familiars that pay or draw', () => {
  it('the Raven pays when you decline an order', () => {
    const s = withFamiliars(['raven']);
    const id = s.orders[0]!.id;
    expect(ok(s, { type: 'decline', order: id }).state.gold).toBe(s.gold + FAMILIAR_RULES.ravenGold);
    expect(ok(brewing('familiars'), { type: 'decline', order: id }).state.gold).toBe(s.gold);
  });

  it('the Magpie pays for each potion delivered', () => {
    const deliver = (familiars: string[]) => {
      const [s, uids] = withHand(withFamiliars(familiars), ['elmroot', 'creekwater']);
      const st = { ...slotAll(s, uids), orders: [order()] };
      return ok(st, { type: 'brew', deliverTo: 500 });
    };
    const without = deliver([]).state.gold;
    const r = deliver(['magpie']);
    expect(r.state.gold).toBe(without + FAMILIAR_RULES.magpieGold);
    expect(ofType(r.events, 'familiarFired').map((e) => e.familiar)).toEqual(['magpie']);
  });

  it('the Tortoise pays for each Brew left at the end of the day', () => {
    const s = withFamiliars(['tortoise']);
    const plain = ok(brewing('familiars'), { type: 'endDay' }).state.gold;
    expect(ok(s, { type: 'endDay' }).state.gold).toBe(plain + FAMILIAR_RULES.tortoiseGold * s.brewsLeft);
  });

  it('the Fox doubles the tip for beating the minimum tier', () => {
    const potion = { tier: 'superb' as const, ingredients: ['elmroot', 'creekwater'] };
    const plain = payout(potion, order({ minTier: 'fine' }));
    const fox = payout(potion, order({ minTier: 'fine' }), ['fox']);
    expect(plain.tip).toBeGreaterThan(0);
    expect(fox.tip).toBe(plain.tip * 2);
    expect(payout({ ...potion, tier: 'fine' }, order({ minTier: 'fine' }), ['fox']).tip).toBe(0);
  });

  it('the Ferret draws one more on every third Discard of the run', () => {
    let s = withFamiliars(['ferret']);
    s = { ...s, discardsLeft: 5 };
    const discard = (st: RunState) => ok(st, { type: 'discard', uids: [st.hand[0]!.uid] });
    const one = discard(s);
    const two = discard(one.state);
    const three = discard(two.state);
    expect(ofType(two.events, 'familiarFired')).toEqual([]);
    expect(ofType(three.events, 'familiarFired').map((e) => e.familiar)).toEqual(['ferret']);
    expect(three.state.hand.length).toBe(two.state.hand.length + 1);
  });
});

describe('getting familiars', () => {
  /** The Market Square on day 1. */
  function market(familiars: string[] = []): RunState {
    let s = withFamiliars(familiars, start('fx-3'));
    s = ok(s, { type: 'debug', op: 'addGold', amount: 100 }).state;
    for (const a of [{ type: 'openShop' }, { type: 'endDay' }, { type: 'skipReward' }, { type: 'debug', op: 'openErrand', errand: 'market' }] as const) s = ok(s, a).state;
    return s;
  }
  const familiarIndex = (s: RunState) => {
    if (s.offer?.kind !== 'market') throw new Error('expected the Market Square');
    return s.offer.stock.findIndex((i) => i.kind === 'familiar');
  };

  it('the Market Square stocks one familiar to buy', () => {
    const s = market();
    const i = familiarIndex(s);
    expect(i).toBeGreaterThanOrEqual(0);
    const item = s.offer?.kind === 'market' ? s.offer.stock[i]! : null;
    if (item?.kind !== 'familiar') throw new Error('expected a familiar');
    const r = ok(s, { type: 'buy', index: i });
    expect(r.state.familiars).toEqual([item.familiar]);
    expect(r.state.gold).toBe(s.gold - familiarPrice(item.familiar));
    expect(no(r.state, { type: 'buy', index: i })).toMatch(/already sold/);
  });

  it('won\'t sell you a familiar with every slot taken, and keeps it in stock', () => {
    const s = market(['hedgehog', 'heron', 'otter', 'salamander']);
    const i = familiarIndex(s);
    expect(no(s, { type: 'buy', index: i })).toMatch(/sell one first/);
    const freed = ok(s, { type: 'sellFamiliar', index: 0 }).state;
    expect(ok(freed, { type: 'buy', index: i }).state.familiars).toHaveLength(4);
  });

  it('a patron\'s familiar pick goes into a familiar slot', () => {
    let s = ok(start('familiars'), { type: 'debug', op: 'jumpToDay', week: 1, day: NIGHT_SHIFT_DAY }).state;
    s = ok(ok(s, { type: 'openShop' }).state, { type: 'debug', op: 'patronReward', patron: 'mother-hollow' }).state;
    s = { ...s, gifts: s.gifts.filter((g) => g.into === 'familiar') };
    expect(s.gifts[0]).toMatchObject({ source: 'patron', into: 'familiar' });
    expect(s.gifts[0]!.cards).toHaveLength(2);
    const picked = s.gifts[0]!.cards[1]!;
    s = ok(s, { type: 'endDay' }).state;
    s = ok(s, { type: 'skipReward' }).state;
    expect(s.offer?.kind).toBe('gift');
    expect(ok(s, { type: 'takeGift', index: 1 }).state.familiars).toEqual([picked]);
  });
});
