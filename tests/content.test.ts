import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { matchRecipe, NIGHT_SHIFT_DAY, payout, previewBrew, reachableRecipes, reduce, type Order, type RunState } from '../src/core';
import { dayPool } from '../src/core/dusk';
import { EFFECTS, effectIds, targetsOf } from '../src/core/effects';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

const ings = (...ids: string[]) => ids.map((id) => codex.ingredients.get(id)!);

/** Play a tincture from a hand of these cards; the tincture is the first card. */
function play(cards: string[], targets: (uids: number[], s: RunState) => number[] = () => [], tweak?: (s: RunState) => void) {
  const [s, uids] = withHand(brewing(), cards);
  tweak?.(s);
  return { before: s, uids, ...ok(s, { type: 'playTincture', uid: uids[0]!, targets: targets(uids, s) }) };
}

describe('codex', () => {
  it('registers every effect a card uses', () => {
    for (const id of [...codex.ingredients.keys(), ...codex.tinctures.keys(), ...codex.junk.keys()]) {
      for (const e of effectIds(id)) expect(EFFECTS[e], `${id}: ${e}`).toBeDefined();
    }
  });

  it('has the Illusion family in place of Beauty', () => {
    const families = new Set([...codex.recipes.values()].map((r) => r.family));
    expect(families.has('illusion')).toBe(true);
    expect(families.has('beauty' as never)).toBe(false);
  });

  it('every recipe the starting witch knows is in the base pool', () => {
    for (const w of codex.witches.values()) {
      for (const r of w.knownRecipes) expect(codex.recipes.get(r)?.pool, r).toBe('base');
    }
  });
});

describe('pools', () => {
  it('rewards and the Market offer base cards, and unlock cards once unlocked', () => {
    const base = dayPool({ unlocks: [], season: 'spring' }).map((c) => c.id);
    expect(base).not.toContain('decant');
    expect(base).not.toContain('fallen-star');
    expect(base).toContain('infuse');
    expect(dayPool({ unlocks: ['decant'], season: 'spring' }).map((c) => c.id)).toContain('decant');
  });

  it('marks in-season ingredients', () => {
    const lily = (season: 'winter' | 'summer') => dayPool({ unlocks: [], season }).find((c) => c.id === 'ice-lily');
    expect(lily('winter')?.inSeason).toBe(true);
    expect(lily('summer')?.inSeason).toBe(false);
  });

  it('never matches or orders a recipe the run cannot reach', () => {
    const unlock = [...codex.recipes.values()].find((r) => r.pool === 'unlock')!;
    const pattern = unlock.pattern.filter((e) => e !== 'any');
    const pick = pattern.map((e) => [...codex.ingredients.values()].find((i) => i.essences.length === 1 && i.essences[0] === e)!);
    if (pick.length === unlock.pattern.length && pick.every(Boolean)) {
      expect(matchRecipe(pick, { knownRecipes: [], unlocks: [] })?.id).not.toBe(unlock.id);
    }
    const s = start();
    expect([...reachableRecipes(s, false).keys()].every((id) => {
      const r = codex.recipes.get(id)!;
      return r.pool === 'base' || s.knownRecipes.includes(id);
    })).toBe(true);
    const unlocked = reduce(null, { type: 'startRun', seed: 'test', witch: 'hedge-witch', unlocks: ['decant'] }).state;
    expect(unlocked.unlocks).toEqual(['decant']);
  });
});

describe('recipe tie-break', () => {
  const single = (e: string) => [...codex.ingredients.values()].find((i) => i.essences.length === 1 && i.essences[0] === e && !i.effects.includes('wild-essence'))!;
  const cards = ['lunar', 'tide', 'umbra'].map(single);

  it('picks the specific pattern over an "any" slot once it is available', () => {
    expect(matchRecipe(cards, { knownRecipes: [], unlocks: [] })?.id).toBe('moonglass-elixir');
    expect(matchRecipe(cards, { knownRecipes: [], unlocks: ['taste-of-memory'] })?.id).toBe('taste-of-memory');
  });

  it('never brews an Eclipse recipe outside its event', () => {
    const daybreak = ['lunar', 'gale', 'tide'].map(single);
    expect(matchRecipe(daybreak, { knownRecipes: [], unlocks: ['daybreak-elixir'] })?.id).toBe('moonglass-elixir');
  });
});

describe('new ingredient effects', () => {
  it('Stormseed draws 2 more after its brew', () => {
    const [s0, uids] = withHand(brewing(), ['stormseed', 'creekwater', 'elmroot']);
    s0.drawPile.push(...Array.from({ length: 10 }, (_, i) => ({ uid: 800 + i, card: 'elmroot' })));
    const s = slotAll(s0, uids.slice(0, 2));
    expect(previewBrew(s, s.cauldron, s.hand).kind).toBe('potion');
    const r = ok(s, { type: 'brew' });
    expect(r.state.hand.length).toBe(s.handSize + 2);
  });

  it('Heartstone potions earn an extra heart; Charm Sachet adds a heart and a tip once', () => {
    const order: Order = { id: 500, customer: 'old-tobin', request: { kind: 'family', family: 'healing' }, minTier: 'crude', pay: 10, bonus: null, status: 'open' };
    const potion = { uid: 600, recipe: 'healing-draught', family: 'healing' as const, quality: 14, tier: 'fine' as const, ingredients: ['elmroot', 'creekwater'], experiment: false };
    const base: RunState = { ...brewing(), orders: [order], hearts: { 'old-tobin': 0 } };
    const plain = ok({ ...base, shelf: [{ ...potion, heartDelta: 0 }] }, { type: 'deliver', order: 500, potion: 600 }).state;
    const hearty = ok({ ...base, shelf: [{ ...potion, heartDelta: 1 }] }, { type: 'deliver', order: 500, potion: 600 }).state;
    expect(hearty.hearts['old-tobin']).toBe(plain.hearts['old-tobin']! + 1);

    const charmed = play(['charm-sachet'], undefined, (s) => Object.assign(s, { orders: [order], shelf: [{ ...potion, heartDelta: 0 }], hearts: { 'old-tobin': 0 } }));
    expect(charmed.state.delivery).toEqual({ hearts: 1, tip: 3 });
    const r = ok(charmed.state, { type: 'deliver', order: 500, potion: 600 });
    expect(r.state.hearts['old-tobin']).toBe(plain.hearts['old-tobin']! + 1);
    expect(r.state.gold - charmed.state.gold).toBe(plain.gold - base.gold + 3);
    expect(r.state.delivery).toEqual({ hearts: 0, tip: 0 });
  });

  it('Wolfsbane costs a Discard when drawn on a Night Shift only', () => {
    const night = (day: number) => {
      const [s] = withHand(brewing(), []);
      s.day = day;
      s.drawPile = [{ uid: 900, card: 'wolfsbane' }, ...s.drawPile];
      return ok(s, { type: 'playTincture', ...withTincture(s) }).state;
    };
    const withTincture = (s: RunState) => {
      s.hand.push({ uid: 901, card: 'forage' });
      return { uid: 901 };
    };
    const day = night(1);
    const shift = night(NIGHT_SHIFT_DAY);
    expect(shift.hand.some((c) => c.uid === 900)).toBe(true);
    expect(day.discardsLeft - shift.discardsLeft).toBe(1);
  });

  it('Sunberry adds Harmony to the first brew of the day only', () => {
    const [s0] = withHand(brewing(), ['sunberry', 'creekwater']);
    const first = previewBrew(s0, s0.hand, []);
    const later = previewBrew({ ...s0, brewsToday: 1 }, s0.hand, []);
    if (first.kind !== 'potion' || later.kind !== 'potion') throw new Error('expected a potion');
    expect(first.harmony - later.harmony).toBe(2);
  });
});

describe('junk', () => {
  it('Cobweb blows away after 3 days', () => {
    let s = brewing();
    s = { ...s, discardPile: [...s.discardPile, { uid: 950, card: 'cobweb' }] };
    const cobweb = (x: RunState) => [...x.drawPile, ...x.hand, ...x.discardPile].some((c) => c.uid === 950);
    const day = (x: RunState) => {
      if (x.phase === 'morning') x = ok(x, { type: 'openShop' }).state;
      const r = ok(x, { type: 'endDay' });
      x = ok(r.state, { type: 'skipReward' }).state;
      x = ok(x, { type: 'chooseErrand', errand: (x.offer as { options: ('market' | 'forage' | 'hearth')[] }).options[0]! }).state;
      return { s: ok(x, { type: 'leaveErrand' }).state, events: r.events };
    };
    let r = day(s);
    expect(cobweb(r.s)).toBe(true);
    r = day(r.s);
    expect(cobweb(r.s)).toBe(true);
    r = day(r.s);
    expect(cobweb(r.s)).toBe(false);
    expect(ofType(r.events, 'cardExpired').map((e) => e.uid)).toEqual([950]);
  });

  it('Bad Omen in hand costs every brew 1 Harmony, never below 1', () => {
    const [s0, uids] = withHand(brewing(), ['elmroot', 'creekwater', 'bad-omen']);
    const s = slotAll(s0, uids.slice(0, 2));
    const cursed = previewBrew(s, s.cauldron, s.hand);
    const clean = previewBrew(s, s.cauldron, []);
    if (cursed.kind !== 'potion' || clean.kind !== 'potion') throw new Error('expected a potion');
    expect(cursed.harmony).toBe(Math.max(1, clean.harmony - 1));
    expect(cursed.steps.some((x) => x.source === 'curse')).toBe(true);
  });

  it('Fallen Star leaves when rent is paid', () => {
    let s = start();
    s = { ...s, day: NIGHT_SHIFT_DAY, gold: 999, drawPile: [...s.drawPile, { uid: 960, card: 'fallen-star' }] };
    s = ok(s, { type: 'openShop' }).state;
    s = ok(s, { type: 'endDay' }).state;
    s = ok(s, { type: 'skipReward' }).state;
    const r = ok(s, { type: 'leaveMarket' });
    expect(r.state.week).toBe(2);
    expect([...r.state.drawPile, ...r.state.hand].some((c) => c.uid === 960)).toBe(false);
    expect(ofType(r.events, 'cardExpired').map((e) => e.card)).toEqual(['fallen-star']);
  });
});

describe('new tinctures', () => {
  it('Simmer, Double Boil and Bottle Spare change the next brew', () => {
    expect(play(['simmer']).state.pending.potency).toBe(3);
    expect(play(['double-boil']).state.pending.harmonyMult).toBe(1.5);
    expect(play(['bottle-spare']).state.pending.copies).toBe(2);
    expect(play(['tidy-up']).state.discardsLeft).toBe(play(['stir']).state.discardsLeft + 1);
    expect(play(['second-wind']).state.brewsLeft).toBe(play(['stir']).state.brewsLeft + 1);
  });

  it('pending Potency and Harmony multiply after flat bonuses', () => {
    const [s0, uids] = withHand(brewing(), ['elmroot', 'creekwater']);
    const s = slotAll(s0, uids);
    const plain = previewBrew(s, s.cauldron, []);
    const boosted = previewBrew({ ...s, pending: { ...s.pending, potency: 3, harmonyMult: 1.5 } }, s.cauldron, []);
    if (plain.kind !== 'potion' || boosted.kind !== 'potion') throw new Error('expected a potion');
    expect(boosted.potency).toBe(plain.potency + 3);
    expect(boosted.harmony).toBe(plain.harmony * 1.5);
    expect(boosted.quality).toBe(Math.floor(boosted.potency * boosted.harmony));
  });

  it('Grimoire Page brews the next Experiment at full tier and waits for it', () => {
    const [s0, uids] = withHand(brewing(), ['elmroot', 'creekwater']);
    const s = slotAll({ ...s0, knownRecipes: s0.knownRecipes.filter((r) => r !== 'healing-draught') }, uids);
    const exp = previewBrew(s, s.cauldron, []);
    const full = previewBrew({ ...s, pending: { ...s.pending, fullExperiment: true } }, s.cauldron, []);
    if (exp.kind !== 'potion' || full.kind !== 'potion' || exp.known) throw new Error('expected an Experiment');
    expect(full.tier).not.toBe(exp.tier);
    // A known recipe brewed in between keeps the page for later.
    const [k0, kuids] = withHand(brewing(), ['elmroot', 'creekwater']);
    const k = slotAll({ ...k0, pending: { ...k0.pending, fullExperiment: true } }, kuids);
    expect(ok(k, { type: 'brew' }).state.pending.fullExperiment).toBe(true);
    const e = ok({ ...s, pending: { ...s.pending, fullExperiment: true } }, { type: 'brew' }).state;
    expect(e.pending.fullExperiment).toBe(false);
  });

  it('Infuse gives a hand ingredient +2 Potency for the run', () => {
    expect(targetsOf('infuse')).toBe('hand-one');
    const r = play(['infuse', 'elmroot', 'creekwater'], (u) => [u[1]!]);
    const card = r.state.hand.find((c) => c.uid === r.uids[1])!;
    expect(card.bonus).toBe(2);
    const s = slotAll(r.state, [r.uids[1]!, r.uids[2]!]);
    const p = previewBrew(s, s.cauldron, []);
    if (p.kind !== 'potion') throw new Error('expected a potion');
    expect(p.steps.some((x) => x.note?.includes('Infused +2'))).toBe(true);
    const [s1, u1] = withHand(brewing(), ['infuse', 'stir']);
    expect(no(s1, { type: 'playTincture', uid: u1[0]!, targets: [u1[1]!] })).toMatch(/ingredient/);
    expect(no(s1, { type: 'playTincture', uid: u1[0]!, targets: [] })).toMatch(/choose one/);
  });

  it('Taste Test puts the top 3 back in the chosen order', () => {
    expect(targetsOf('taste-test')).toBe('top-3');
    const r = play(['taste-test'], (_, s) => s.drawPile.slice(0, 3).map((c) => c.uid).reverse());
    expect(r.state.drawPile.slice(0, 3).map((c) => c.uid)).toEqual(r.before.drawPile.slice(0, 3).map((c) => c.uid).reverse());
    expect(ofType(r.events, 'drawPileReordered')).toHaveLength(1);
    const kept = play(['taste-test']);
    expect(kept.state.drawPile.map((c) => c.uid)).toEqual(kept.before.drawPile.map((c) => c.uid));
    const [s, u] = withHand(brewing(), ['taste-test']);
    expect(no(s, { type: 'playTincture', uid: u[0]!, targets: [s.drawPile[5]!.uid] })).toMatch(/top cards/);
  });

  it('Decant raises a Shelf potion one tier, up to Superb', () => {
    expect(targetsOf('decant')).toBe('shelf-one');
    const shelf = (tier: 'fine' | 'superb') => (s: RunState) => {
      s.shelf = [{ uid: 700, recipe: 'healing-draught', family: 'healing', quality: 14, tier, ingredients: [], experiment: false, heartDelta: 0 }];
    };
    const r = play(['decant'], () => [700], shelf('fine'));
    expect(r.state.shelf[0]!.tier).toBe('superb');
    const [s, u] = withHand(brewing(), ['decant']);
    shelf('superb')(s);
    expect(no(s, { type: 'playTincture', uid: u[0]!, targets: [700] })).toMatch(/up to Superb/);
    expect(no(s, { type: 'playTincture', uid: u[0]!, targets: [1] })).toMatch(/not on the Shelf/);
  });
});

describe('customers', () => {
  it('tip multipliers scale the tip, not the pay', () => {
    const potion = { tier: 'superb' as const, ingredients: ['elmroot', 'creekwater'] };
    const order = (customer: string): Order => ({ id: 1, customer, request: { kind: 'family', family: 'secrets' }, minTier: 'fine', pay: 20, bonus: null, status: 'open' });
    const plain = payout(potion, order('old-tobin'));
    const twins = payout(potion, order('pip-and-quill'));
    expect(twins.pay).toBe(plain.pay);
    expect(twins.tip).toBe(Math.round(plain.tip * codex.regulars.get('pip-and-quill')!.tipMult));
  });

  it('only offers bonuses from the customer’s own pool', () => {
    for (let i = 0; i < 20; i++) {
      for (const o of start(`bonus-${i}`).orders) {
        if (o.bonus) expect(codex.regulars.get(o.customer)!.bonusPool).toContain(o.bonus);
      }
    }
  });
});

it('matchRecipe still finds plain pairs', () => {
  expect(matchRecipe(ings('elmroot', 'creekwater'), { knownRecipes: [], unlocks: [] })?.id).toBe('healing-draught');
});

it('the debug giveCard op puts a card in hand', () => {
  const s = ok(brewing(), { type: 'debug', op: 'giveCard', card: 'decant' }).state;
  expect(s.hand.at(-1)!.card).toBe('decant');
  expect(no(s, { type: 'debug', op: 'giveCard', card: 'nope' })).toMatch(/no card/);
});

it('the debug learnRecipes op adds recipes to the Grimoire once', () => {
  const s = ok(brewing(), { type: 'debug', op: 'learnRecipes', recipes: ['whisper-ink', 'healing-draught'] }).state;
  expect(s.knownRecipes.filter((r) => r === 'healing-draught')).toHaveLength(1);
  expect(s.knownRecipes).toContain('whisper-ink');
  expect(no(s, { type: 'debug', op: 'learnRecipes', recipes: ['nope'] })).toMatch(/no recipe/);
});
