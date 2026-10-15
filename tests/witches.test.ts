import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  cauldronOpen, CAULDRON_SLOTS, DISCARDS_PER_DAY, handSizeToday, migrateProfile, migrateRun, newProfile, newStats, previewBrew, recordRun, reduce, rentOf,
  runStartChoice, tierStep, WITCH_RULES, witchOpen, type Order, type RunState, type Season,
} from '../src/core';
import { ofType, ok, slotAll, withHand } from './helpers';

const start = (witch: string, cauldron = 'copper', seed = 'kit', season?: Season): RunState =>
  ok(null as unknown as RunState, { type: 'startRun', seed, witch, cauldron, ...(season ? { season } : {}) }).state;
const brewing = (witch: string, cauldron = 'copper', seed = 'kit', season?: Season) => ok(start(witch, cauldron, seed, season), { type: 'openShop' }).state;

function preview(s: RunState, cards: string[]) {
  const [h, uids] = withHand(s, cards);
  const slotted = slotAll(h, uids);
  const p = previewBrew(slotted, slotted.cauldron, slotted.hand);
  if (p.kind !== 'potion') throw new Error('expected a potion');
  return p;
}

const order = (o: Partial<Order> = {}): Order => ({
  id: 500, customer: 'old-tobin', request: { kind: 'recipe', recipe: 'greater-restorative' }, minTier: 'crude', pay: 10, bonus: null, status: 'open',
  quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null, ...o,
});

/** Brew these cards for the order at 500, the only one open. */
function deliver(s: RunState, cards: string[], o: Partial<Order> = {}) {
  const [h, uids] = withHand(s, cards);
  return reduce({ ...slotAll(h, uids), orders: [order(o)], fog: false }, { type: 'brew', deliverTo: 500 });
}

describe('witches (GDD §12)', () => {
  it('each starts with its own deck and recipes, and only the Hedge Witch is open at first', () => {
    for (const w of codex.witches.values()) {
      const s = start(w.id);
      expect(s.knownRecipes).toEqual(w.knownRecipes);
      expect(s.drawPile.length + s.hand.length).toBe(w.startingDeck.reduce((n, e) => n + e.count, 0));
      expect(witchOpen(newProfile(), w.id)).toBe(w.id === 'hedge-witch');
    }
    expect([...codex.witches.values()].map((w) => w.unlockSeason)).toEqual([null, 'spring', 'summer', 'autumn', 'winter']);
  });

  it('a season\'s first win opens its witch', () => {
    const p = { ...newProfile(), wins: { spring: 1, summer: 0, autumn: 0, winter: 0 } };
    expect(witchOpen(p, 'bloom-witch')).toBe(true);
    expect(witchOpen(p, 'alchemist')).toBe(false);
    const out = recordRun(newProfile(), { seed: 'r1', season: 'spring', phase: 'victory', week: 4, stats: newStats() });
    expect(out.witches).toEqual(['bloom-witch']);
    expect(recordRun(out.profile, { seed: 'r2', season: 'spring', phase: 'victory', week: 4, stats: newStats() }).witches).toEqual([]);
  });

  it('the Bloom Witch: the day\'s first brew with a Flower gets +2 Harmony, once', () => {
    const cards = ['elmroot', 'thistledown'];
    const base = preview(brewing('hedge-witch'), cards).harmony;
    const s = brewing('bloom-witch');
    expect(preview(s, cards).harmony).toBe(base + WITCH_RULES.bloomHarmony);
    expect(preview(s, cards).steps.some((st) => st.source === 'witch')).toBe(true);
    // No Flower: no bonus, and the quirk is still waiting.
    expect(preview(s, ['elmroot', 'creekwater']).steps.some((st) => st.source === 'witch')).toBe(false);
    const [h, uids] = withHand(s, cards);
    const after = ok(slotAll(h, uids), { type: 'brew' }).state;
    expect(after.quirkUsed).toBe(true);
    expect(preview(after, cards).harmony).toBe(base);
  });

  it('the Alchemist: the first Experiment each day brews at full quality', () => {
    const s = brewing('alchemist');
    expect(s.knownRecipes).not.toContain('healing-draught');
    const full = preview(s, ['elmroot', 'creekwater']);
    expect(full.known).toBe(false);
    const used = preview({ ...s, quirkUsed: true }, ['elmroot', 'creekwater']);
    expect(used.tier).toBe(tierStep(full.tier, -1));
    const [h, uids] = withHand(s, ['elmroot', 'creekwater']);
    expect(ok(slotAll(h, uids), { type: 'brew' }).state.quirkUsed).toBe(true);
    // A known recipe doesn't spend it.
    const [h2, uids2] = withHand(s, ['nightshade', 'creekwater']);
    const known = previewBrew(slotAll(h2, uids2), slotAll(h2, uids2).cauldron, []);
    if (known.kind === 'potion' && known.known) expect(ok(slotAll(h2, uids2), { type: 'brew' }).state.quirkUsed).toBe(false);
  });

  it('the Illusionist: once a day, a potion fills an order for another recipe of its family', () => {
    const s = brewing('illusionist');
    const r = deliver(s, ['elmroot', 'creekwater']);
    expect(ofType(r.events, 'orderFilled')).toHaveLength(1);
    expect(ofType(r.events, 'glamourUsed')).toHaveLength(1);
    expect(r.state.quirkUsed).toBe(true);
    // Not twice in a day, not for another family, and not for anyone else.
    const filled = (x: { events: Parameters<typeof ofType>[0] }) => ofType(x.events, 'orderFilled').length;
    expect(filled(deliver(r.state, ['elmroot', 'creekwater']))).toBe(0);
    expect(filled(deliver(s, ['elmroot', 'creekwater'], { request: { kind: 'recipe', recipe: 'whisper-ink' } }))).toBe(0);
    expect(filled(deliver(brewing('hedge-witch'), ['elmroot', 'creekwater']))).toBe(0);
    // A new day brings it back.
    const next = ok(r.state, { type: 'debug', op: 'jumpToDay', week: 1, day: 2 }).state;
    expect(next.quirkUsed).toBe(false);
  });

  it('the Frost Witch: +1 card in hand on Snow days', () => {
    const s = start('frost-witch', 'copper', 'kit', 'winter');
    expect(handSizeToday(s, 'snow')).toBe(s.handSize + WITCH_RULES.frostHand);
    expect(handSizeToday(s, 'clear')).toBe(s.handSize);
    expect(handSizeToday(start('hedge-witch', 'copper', 'kit', 'winter'), 'snow')).toBe(start('hedge-witch').handSize);
  });
});

describe('cauldrons (GDD §12)', () => {
  it('Copper is open from the start; the rest each open with an Almanac entry', () => {
    expect([...codex.cauldrons.values()].map((c) => [c.id, c.unlock])).toEqual([
      ['copper', null], ['iron', 'open-for-business'], ['glass', 'masterwork'], ['bone', 'nameless-deal'], ['silver', 'legend-thrice'],
    ]);
    for (const c of codex.cauldrons.values()) {
      expect(cauldronOpen(newProfile(), c.id)).toBe(c.id === 'copper');
      if (c.unlock) expect(cauldronOpen({ almanac: [c.unlock] }, c.id)).toBe(true);
    }
  });

  it('refuses a cauldron that doesn\'t exist', () => {
    expect(() => reduce(null, { type: 'startRun', seed: 'x', witch: 'hedge-witch', cauldron: 'gold' })).toThrow(/unknown cauldron/);
  });

  it('Iron: 3 slots from the start, one Brew fewer a day', () => {
    const copper = brewing('hedge-witch');
    const iron = brewing('hedge-witch', 'iron');
    expect(copper.cauldronSlots).toBe(CAULDRON_SLOTS);
    expect(iron.cauldronSlots).toBe(3);
    expect(iron.brewsLeft).toBe(copper.brewsLeft - 1);
  });

  it('Glass: +2 Harmony on every brew, one card fewer in hand', () => {
    const copper = brewing('hedge-witch');
    const glass = brewing('hedge-witch', 'glass');
    expect(glass.handSize).toBe(copper.handSize - 1);
    expect(preview(glass, ['elmroot', 'creekwater']).harmony).toBe(preview(copper, ['elmroot', 'creekwater']).harmony + 2);
  });

  it('Bone: two Lunar ingredients in the Night Satchel, rent +25%', () => {
    const copper = start('hedge-witch');
    const bone = start('hedge-witch', 'bone');
    const lunar = bone.satchel.filter((c) => codex.ingredients.get(c.card)?.essences.includes('lunar'));
    expect(bone.satchel.length - copper.satchel.length).toBe(2);
    expect(lunar.length).toBeGreaterThanOrEqual(2);
    expect(rentOf(bone)).toBe(Math.round(rentOf(copper) * 1.25));
  });

  it('Silver: +1 Discard a day, orders pay 10% less', () => {
    const copper = brewing('hedge-witch');
    const silver = brewing('hedge-witch', 'silver');
    expect(copper.discardsLeft).toBe(DISCARDS_PER_DAY);
    expect(silver.discardsLeft).toBe(DISCARDS_PER_DAY + 1);
    const pay = (s: RunState) => s.orders.reduce((n, o) => n + o.pay, 0);
    expect(silver.orders.map((o) => o.customer)).toEqual(copper.orders.map((o) => o.customer));
    expect(pay(silver)).toBeLessThan(pay(copper));
  });
});

describe('choosing at the cottage', () => {
  it('remembers the last pick, and falls back when it is locked', () => {
    const open = { ...newProfile(), wins: { spring: 1, summer: 0, autumn: 0, winter: 0 }, almanac: ['masterwork'], witch: 'bloom-witch', cauldron: 'glass' };
    expect(runStartChoice(open)).toEqual({ witch: 'bloom-witch', cauldron: 'glass' });
    expect(runStartChoice({ ...newProfile(), witch: 'frost-witch', cauldron: 'silver' })).toEqual({ witch: 'hedge-witch', cauldron: 'copper' });
  });

  it('a version 7 profile starts from the Hedge Witch in Copper; junk is repaired', () => {
    expect(migrateProfile({ version: 7, tutorialDone: true })).toMatchObject({ witch: 'hedge-witch', cauldron: 'copper' });
    expect(migrateProfile({ ...newProfile(), witch: 'nope', cauldron: 3 })).toMatchObject({ witch: 'hedge-witch', cauldron: 'copper' });
  });

  it('a version 17 run was the Hedge Witch\'s, in Copper', () => {
    const old: Record<string, unknown> = { ...brewing('hedge-witch'), version: 17 };
    delete old.cauldronKind;
    delete old.quirkUsed;
    expect(migrateRun(old)).toMatchObject({ cauldronKind: 'copper', quirkUsed: false });
  });

  it('a run opening a cauldron says so', () => {
    const s = { seed: 'r1', season: 'spring' as const, phase: 'game-over' as const, week: 2, stats: { ...newStats(), ordersFilled: 25 } };
    expect(recordRun(newProfile(), s).cauldrons).toEqual(['iron']);
  });

});
