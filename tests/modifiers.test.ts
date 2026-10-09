import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import type { ModifierId } from '../src/codex/schema';
import {
  allCards, cardPotency, drawOnBrewOf, heartDeltaOf, MODIFIER_RULES, NIGHT_SHIFT_DAY, previewBrew, type CardInstance, type Order, type RunState,
} from '../src/core';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

/** A hand of these cards, the first `mods.length` of them modified, slotted in order. */
function slotted(s: RunState, cards: string[], mods: (ModifierId | undefined)[] = []): RunState {
  const [h, uids] = withHand(s, cards);
  h.hand.forEach((c, i) => {
    if (mods[i]) c.modifier = mods[i];
  });
  return slotAll(h, uids);
}

function preview(s: RunState, cards: string[], mods: (ModifierId | undefined)[] = []) {
  const k = slotted(s, cards, mods);
  const p = previewBrew(k, k.cauldron, k.hand);
  if (p.kind !== 'potion') throw new Error(`expected a potion, got ${p.kind}`);
  return p;
}

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

function deliver(s: RunState, cards: string[], mods: (ModifierId | undefined)[] = []) {
  return ok({ ...slotted(s, cards, mods), orders: [order()], fog: false }, { type: 'brew', deliverTo: 500 });
}

/** Dusk with the Creek Bank open and this much gold. */
function creek(gold = 50): RunState {
  let s = brewing('modifiers');
  for (const a of [{ type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
  return { ...s, gold, offer: { kind: 'creek', done: false } };
}

/** The Night Market on a week's night, with plenty of gold. */
function market(week: number, seed = 'modifiers', gold = 500): RunState {
  let s = ok(start(seed), { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  s = ok(s, { type: 'debug', op: 'addGold', amount: gold }).state;
  for (const a of [{ type: 'openShop' }, { type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
  while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
  return s;
}

function visit(s: RunState, stall: string): RunState {
  if (s.offer?.kind !== 'night-market') throw new Error('expected the Night Market');
  const index = s.offer.stalls.findIndex((st) => st.id === stall);
  if (index < 0) throw new Error(`${stall} isn't open`);
  return ok(s, { type: 'visitStall', index }).state;
}

describe('modifiers in the codex', () => {
  it('has the four modifiers from the balance tables, Cursed not for sale', () => {
    expect([...codex.modifiers.values()].map((m) => [m.id, m.price])).toEqual([
      ['moonlit', 6], ['aged', 3], ['blessed', 12], ['cursed', null],
    ]);
  });

  it('Wheel of Fortune is in the tarot deck', () => {
    expect(codex.tarot.get('wheel-of-fortune')).toMatchObject({ kind: 'boon', weight: 8, effect: 'bless' });
  });
});

describe('scoring with modifiers', () => {
  const s = brewing('modifiers');

  it('Moonlit adds +2 Harmony after the tinctures', () => {
    const plain = preview(s, ['elmroot', 'creekwater']);
    const lit = preview(s, ['elmroot', 'creekwater'], ['moonlit']);
    expect(lit.harmony).toBe(plain.harmony + MODIFIER_RULES.moonlitHarmony);
    expect(lit.potency).toBe(plain.potency);
    const sources = lit.steps.map((x) => x.source);
    expect(sources[sources.length - 1]).toBe('modifier');
    expect(lit.steps.at(-1)).toMatchObject({ id: 'moonlit', note: 'Elmroot: +2 Harmony' });
  });

  it('Blessed counts its Potency and its effect twice', () => {
    const plain = preview(s, ['mint-sprig', 'creekwater']);
    const blessed = preview(s, ['mint-sprig', 'creekwater'], ['blessed']);
    expect(blessed.potency).toBe(plain.potency + 3);
    expect(blessed.harmony).toBe(plain.harmony + 1);
  });

  it('Cursed counts its Potency twice, Infused and tempered Potency included', () => {
    const k = slotted(s, ['elmroot', 'creekwater'], ['cursed']);
    k.cauldron[0]!.bonus = 2;
    const p = previewBrew(k, k.cauldron, k.hand);
    const plain = preview(s, ['elmroot', 'creekwater']);
    expect(p.kind === 'potion' && p.potency).toBe(plain.potency + 2 + 6);
  });

  it('Cursed costs a heart with the customer; Blessed doubles a card\'s hearts and draws', () => {
    const plain = deliver(brewing('modifiers'), ['elmroot', 'creekwater']);
    const cursed = deliver(brewing('modifiers'), ['elmroot', 'creekwater'], ['cursed']);
    const hearts = (r: typeof plain) => ofType(r.events, 'heartsChanged')[0]?.delta ?? 0;
    expect(hearts(cursed)).toBe(hearts(plain) - 1);
    const card = (id: string, modifier?: ModifierId): CardInstance => ({ uid: 1, card: id, ...(modifier ? { modifier } : {}) });
    expect(heartDeltaOf([card('heartstone', 'blessed')])).toBe(2);
    expect(heartDeltaOf([card('grave-moss', 'cursed')])).toBe(-2);
    expect(drawOnBrewOf([card('stormseed', 'blessed'), card('fae-dust')])).toBe(5);
  });

  it('Aged gains 2 Potency each day in the deck (Amber Sap\'s own Aged, 1) and resets when brewed', () => {
    let k = brewing('modifiers');
    const target = k.drawPile.find((c) => c.card === 'elmroot')!;
    k = ok(k, { type: 'debug', op: 'setModifier', uid: target.uid, modifier: 'aged' }).state;
    k = ok(k, { type: 'endDay' }).state;
    const aged = allCards(k).find((c) => c.uid === target.uid)!;
    expect(aged.aged).toBe(MODIFIER_RULES.agedPerDay);
    expect(cardPotency(aged)).toBe(codex.ingredients.get('elmroot')!.potency + MODIFIER_RULES.agedPerDay);
    expect(no(k, { type: 'debug', op: 'setModifier', uid: target.uid, modifier: 'moonlit' })).toMatch(/already Aged/);
  });
});

describe('who can take a modifier', () => {
  it('ingredients only, one each, and never Aged on an Aged card', () => {
    const [s, [sap, stir]] = withHand(brewing('modifiers'), ['amber-sap', 'stir']);
    expect(no(s, { type: 'debug', op: 'setModifier', uid: sap!, modifier: 'aged' })).toMatch(/already Aged/);
    expect(no(s, { type: 'debug', op: 'setModifier', uid: stir!, modifier: 'moonlit' })).toMatch(/only ingredients/);
    const r = ok(s, { type: 'debug', op: 'setModifier', uid: sap!, modifier: 'blessed' });
    expect(ofType(r.events, 'cardModified')).toEqual([{ type: 'cardModified', uid: sap, card: 'amber-sap', modifier: 'blessed', by: 'debug' }]);
    expect(no(r.state, { type: 'debug', op: 'setModifier', uid: sap!, modifier: 'moonlit' })).toMatch(/already Blessed/);
  });
});

describe('the Creek Bank', () => {
  it('is one of the dusk errands', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      let s = brewing(`creek-${i}`);
      for (const a of [{ type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
      if (s.offer?.kind === 'errands') s.offer.options.forEach((o) => seen.add(o));
    }
    expect([...seen].sort()).toEqual(['creek', 'forage', 'guild', 'hearth', 'market']);
  });

  it('opens from the errand pick and lets you leave', () => {
    let s = brewing('modifiers');
    for (const a of [{ type: 'endDay' }, { type: 'skipReward' }] as const) s = ok(s, a).state;
    s = { ...s, offer: { kind: 'errands', options: ['creek', 'market'] } };
    s = ok(s, { type: 'chooseErrand', errand: 'creek' }).state;
    expect(s.offer).toEqual({ kind: 'creek', done: false });
    expect(ok(s, { type: 'leaveErrand' }).state.day).toBe(2);
  });

  it('tempers a card for +2 Potency, free, once a visit', () => {
    const s = creek();
    const card = allCards(s).find((c) => c.card === 'elmroot')!;
    const r = ok(s, { type: 'temper', uid: card.uid });
    expect(allCards(r.state).find((c) => c.uid === card.uid)!.bonus).toBe(MODIFIER_RULES.temperPotency);
    expect(r.state.gold).toBe(s.gold);
    expect(no(r.state, { type: 'temper', uid: card.uid })).toMatch(/one card a visit/);
    const stir = allCards(s).find((c) => c.card === 'stir')!;
    expect(no(s, { type: 'temper', uid: stir.uid })).toMatch(/only ingredients/);
  });

  it('sells a modifier at its price, but never Cursed', () => {
    const s = creek(10);
    const card = allCards(s).find((c) => c.card === 'creekwater')!;
    expect(no(s, { type: 'enchant', uid: card.uid, modifier: 'blessed' })).toMatch(/not enough gold/);
    expect(no(s, { type: 'enchant', uid: card.uid, modifier: 'cursed' })).toMatch(/doesn't sell/);
    const r = ok(s, { type: 'enchant', uid: card.uid, modifier: 'moonlit' });
    expect(allCards(r.state).find((c) => c.uid === card.uid)!.modifier).toBe('moonlit');
    expect(r.state.gold).toBe(10 - 6);
    const other = allCards(s).find((c) => c.card === 'elmroot')!;
    expect(no(r.state, { type: 'enchant', uid: other.uid, modifier: 'aged' })).toMatch(/one card a visit/);
  });

  it('is only open at the Creek Bank', () => {
    const s = brewing('modifiers');
    expect(no(s, { type: 'temper', uid: s.hand[0]!.uid })).toMatch(/Creek Bank/);
  });
});

describe('the Name-Taker\'s Cursed card', () => {
  it('each deal offers a Rare ingredient as well as its relic', () => {
    const s = visit(market(2), 'name-taker');
    const st = s.offer?.kind === 'night-market' ? s.offer.stalls[s.offer.at!] : undefined;
    if (st?.id !== 'name-taker') throw new Error('expected the Name-Taker');
    for (const d of st.deals) expect(codex.ingredients.get(d.card!)?.rarity).toBe('rare');
    const deal = st.deals[0]!;
    const r = ok(s, { type: 'takeDeal', index: 0, take: 'card' });
    expect(r.state.curses).toEqual([deal.curse]);
    expect(r.state.relics).toEqual([]);
    const gained = ofType(r.events, 'cardGained')[0]!;
    expect(gained.card).toBe(deal.card);
    expect(allCards(r.state).find((c) => c.uid === gained.uid)!.modifier).toBe('cursed');
  });
});

describe('Wheel of Fortune', () => {
  /** Draw at the Fortune Tent until Wheel of Fortune comes up. */
  function spin(s: RunState) {
    for (let i = 0; i < 60; i++) {
      const r = ok(s, { type: 'drawTarot' });
      if (ofType(r.events, 'tarotDrawn')[0]!.card === 'wheel-of-fortune') return r;
      s = r.state;
    }
    throw new Error('no Wheel of Fortune in 60 draws');
  }

  it('blesses a random ingredient in the deck', () => {
    const r = spin(visit(market(2, 'modifiers', 20000), 'fortune-tent'));
    const [mod] = ofType(r.events, 'cardModified');
    expect(mod).toMatchObject({ modifier: 'blessed', by: 'fortune' });
    expect(codex.ingredients.has(mod!.card)).toBe(true);
  });

  it('pays its gold when no card can take it', () => {
    const s = visit(market(2, 'modifiers', 20000), 'fortune-tent');
    for (const c of allCards(s)) if (codex.ingredients.has(c.card)) c.modifier = 'moonlit';
    const r = spin(s);
    expect(ofType(r.events, 'cardModified')).toEqual([]);
    expect(ofType(r.events, 'goldChanged').at(-1)).toMatchObject({ delta: 8, reason: 'fortune' });
  });
});
