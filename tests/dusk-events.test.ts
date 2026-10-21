import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, EVENT_CHOICES, EVENT_GOLD, EVENT_RULES, friendshipOf, migrateRun, MIN_DECK, NIGHT_SHIFT_DAY, patronKnown, transformable,
  type Potion, type RunState, type Tier,
} from '../src/core';
import { rarityOf } from '../src/core/dusk';
import { brewing, no, ofType, ok } from './helpers';

/** At dusk on day 1 with this event open, and this much gold. */
function at(event: string, gold = 20, seed = 'events'): RunState {
  let s = ok(ok(brewing(seed), { type: 'endDay' }).state, { type: 'skipReward' }).state;
  s = { ...s, gold };
  return ok(s, { type: 'debug', op: 'openEvent', event }).state;
}

const choose = (s: RunState, index: number, uid?: number, pick?: string) =>
  ok(s, { type: 'chooseEvent', index, ...(uid !== undefined ? { uid } : {}), ...(pick !== undefined ? { pick } : {}) });

/** A potion of this recipe and tier for the Shelf. */
function potion(s: RunState, recipe: string, tier: Tier, quality = 12): [RunState, Potion] {
  const r = codex.recipes.get(recipe)!;
  const p: Potion = { uid: s.nextUid, recipe, family: r.family, quality, tier, ingredients: [], experiment: false, heartDelta: 0 };
  return [{ ...s, shelf: [...s.shelf, p], nextUid: s.nextUid + 1 }, p];
}

/** Head home and open the next day's shop. */
const nextDay = (s: RunState) => ok(ok(s, { type: 'leaveErrand' }).state, { type: 'openShop' }).state;

describe('dusk events', () => {
  it('every codex event has rules for each of its choices', () => {
    for (const e of codex.duskEvents.values()) expect(EVENT_CHOICES[e.id]?.length, e.id).toBe(e.choices.length);
    expect(codex.duskEvents.size).toBe(20);
    for (const e of codex.duskEvents.values()) if (e.needs) expect((codex.tinctures.get(e.needs) ?? codex.ingredients.get(e.needs))?.pool, e.id).toBe('unlock');
  });

  it('is one of the dusk errands and rolls an event', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      let s = ok(brewing(`ev-${i}`), { type: 'endDay' }).state;
      s = ok(s, { type: 'skipReward' }).state;
      if (s.offer?.kind !== 'errands' || !s.offer.options.includes('event')) continue;
      s = ok(s, { type: 'chooseErrand', errand: 'event' }).state;
      if (s.offer?.kind === 'event') seen.add(s.offer.event);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('one choice, then home; not home before choosing', () => {
    let s = at('fairy-ring');
    expect(no(s, { type: 'leaveErrand' })).toMatch(/choose/);
    s = choose(s, 1).state;
    expect(s.offer).toMatchObject({ chose: 1, outcome: 'Nothing happens.' });
    expect(no(s, { type: 'chooseEvent', index: 0 })).toMatch(/already/);
    expect(ok(s, { type: 'leaveErrand' }).state.day).toBe(2);
  });

  it('can head home when no choice is open', () => {
    const s = at('spilled-cauldron', 0);
    // Mopping up is always open.
    expect(no(s, { type: 'leaveErrand' })).toMatch(/choose/);
    const shrine = at('shrine-blessing', 0);
    expect(no(shrine, { type: 'chooseEvent', index: 0 })).toMatch(/6 gold/);
    expect(no(shrine, { type: 'chooseErrand', errand: 'market' })).toBeTruthy();
    expect(no(shrine, { type: 'chooseEvent', index: 5 })).toMatch(/no choice/);
  });

  it('the Shrine Blessing blesses the card you choose for 3 gold', () => {
    const s = at('shrine-blessing');
    expect(no(s, { type: 'chooseEvent', index: 0 })).toMatch(/choose a card/);
    const card = allCards(s).find((c) => codex.ingredients.has(c.card))!;
    const r = choose(s, 0, card.uid);
    expect(allCards(r.state).find((c) => c.uid === card.uid)!.modifier).toBe('blessed');
    expect(r.state.gold).toBe(20 - EVENT_GOLD.shrine);
  });

  it('the Moonlit Walk and the Kettle modify a random ingredient', () => {
    const walk = choose(at('moonlit-walk'), 0);
    expect(ofType(walk.events, 'cardModified')[0]).toMatchObject({ modifier: 'moonlit', by: 'event' });
    const kettle = choose(at('kettle-explodes'), 0);
    expect(ofType(kettle.events, 'cardGained')[0]!.card).toBe('sludge');
    expect(ofType(kettle.events, 'cardModified')[0]!.modifier).toBe('aged');
  });

  it('says so when no ingredient can take the modifier', () => {
    const s = at('moonlit-walk');
    for (const c of allCards(s)) c.modifier = 'cursed';
    expect(choose(s, 0).state.offer).toMatchObject({ outcome: 'No ingredient could take Moonlit.' });
  });

  it('the Spilled Cauldron costs a Cobweb or 4 gold', () => {
    expect(ofType(choose(at('spilled-cauldron'), 0).events, 'cardGained')[0]!.card).toBe('cobweb');
    expect(choose(at('spilled-cauldron'), 1).state.gold).toBe(20 - EVENT_GOLD.spillHelp);
    expect(no(at('spilled-cauldron', 3), { type: 'chooseEvent', index: 1 })).toMatch(/4 gold/);
  });

  it('the Found Coin Purse: Friendship for returning it, gold and a Bad Omen for keeping it', () => {
    const back = choose(at('found-coin-purse'), 0);
    expect(ofType(back.events, 'friendshipGained')[0]!.points).toBe(1);
    const kept = choose(at('found-coin-purse'), 1);
    expect(kept.state.gold).toBe(20 + EVENT_GOLD.purse);
    expect([...kept.state.satchel, ...allCards(kept.state)].some((c) => c.card === 'bad-omen')).toBe(true);
  });

  it('the Bargain Bin sells an Uncommon or a Rare card', () => {
    const cheap = choose(at('bargain-bin'), 0);
    expect(rarityOf(ofType(cheap.events, 'cardGained')[0]!.card)).toBe('uncommon');
    expect(cheap.state.gold).toBe(20 - EVENT_GOLD.binUncommon);
    const deep = choose(at('bargain-bin'), 1);
    expect(rarityOf(ofType(deep.events, 'cardGained')[0]!.card)).toBe('rare');
    expect(choose(at('bargain-bin', 0), 2).state.gold).toBe(0);
  });

  it('Mice: lose a Common card, or a Cobweb and 3 gold', () => {
    const s = at('mice-in-the-pantry');
    const traps = choose(s, 0);
    const gone = ofType(traps.events, 'cardRemoved')[0]!;
    expect(rarityOf(gone.card)).toBe('common');
    expect(allCards(traps.state)).toHaveLength(allCards(s).length - 1);
    const adopt = choose(s, 1);
    expect(adopt.state.gold).toBe(20 + EVENT_GOLD.miceStash);
    expect(ofType(adopt.events, 'cardGained')[0]!.card).toBe('cobweb');
  });

  it('Mice leave a deck at its minimum alone', () => {
    const s = at('mice-in-the-pantry');
    s.drawPile = allCards(s).slice(0, MIN_DECK);
    s.hand = [];
    s.discardPile = [];
    expect(choose(s, 0).state.offer).toMatchObject({ outcome: 'The traps stay empty.' });
  });

  it('the Fairy Ring turns a card into one of the next rarity up, of the same kind', () => {
    const s = at('fairy-ring');
    const r = choose(s, 0);
    const t = ofType(r.events, 'cardTransformed')[0]!;
    const up = { common: 'uncommon', uncommon: 'rare' } as Record<string, string>;
    expect(rarityOf(t.to)).toBe(up[rarityOf(t.from)]);
    expect(codex.ingredients.has(t.to)).toBe(codex.ingredients.has(t.from));
    const card = allCards(r.state).find((c) => c.uid === t.uid)!;
    expect(card.card).toBe(t.to);
    expect(card.modifier).toBeUndefined();
  });

  it('the Fairy Ring does nothing to a deck of Rare cards and junk', () => {
    const s = at('fairy-ring');
    for (const c of allCards(s)) c.card = 'sludge';
    expect(transformable(s)).toEqual([]);
    expect(choose(s, 0).state.offer).toMatchObject({ outcome: 'The ring hums, and nothing changes.' });
  });

  it('the debug op refuses outside dusk and unknown events', () => {
    expect(no(brewing('events'), { type: 'debug', op: 'openEvent', event: 'fairy-ring' })).toBeTruthy();
    const s = ok(ok(brewing('events'), { type: 'endDay' }).state, { type: 'skipReward' }).state;
    expect(no(s, { type: 'debug', op: 'openEvent', event: 'nope' })).toMatch(/no dusk event/);
    expect(no(s, { type: 'chooseEvent', index: 0 })).toMatch(/no event/);
  });
});

describe('dusk events: the last 12 (approved by Jacob, Oct 16)', () => {
  it('A Fae Bargain: a Lunar ingredient in the Satchel for the next dusk reward', () => {
    let s = choose(at('fae-bargain'), 0).state;
    expect(s.satchel.length).toBe(at('fae-bargain').satchel.length + 1);
    expect(codex.ingredients.get(s.satchel.at(-1)!.card)!.nightOnly).toBe(true);
    expect(s.forfeitReward).toBe(true);
    s = nextDay(s);
    const r = ok(s, { type: 'endDay' });
    expect(ofType(r.events, 'rewardForfeited')).toHaveLength(1);
    expect(r.state.offer?.kind).not.toBe('reward');
    expect(r.state.forfeitReward).toBe(false);
    expect(no(choose(at('fae-bargain'), 1).state, { type: 'chooseEvent', index: 0 })).toMatch(/already/);
  });

  it('the Pixie Thief: -1 Discard tomorrow and +4 gold, or lose 4 gold', () => {
    const base = nextDay(choose(at('fairy-ring'), 1).state).discardsLeft;
    const chased = choose(at('pixie-thief'), 0).state;
    expect(chased.gold).toBe(20 + EVENT_GOLD.pixie);
    expect(nextDay(chased).discardsLeft).toBe(base - 1);
    expect(nextDay(chased).tomorrow).toEqual({ brews: 0, discards: 0 });
    expect(choose(at('pixie-thief'), 1).state.gold).toBe(20 - EVENT_GOLD.pixie);
    expect(choose(at('pixie-thief', 2), 1).state.gold).toBe(0);
  });

  it('a Changeling Bottle lifts the Shelf potion you choose one tier', () => {
    expect(no(at('changeling-bottle'), { type: 'chooseEvent', index: 0 })).toMatch(/below Legendary/);
    const [one, p] = potion(at('changeling-bottle'), 'healing-draught', 'fine');
    const [s] = potion(one, 'calm-waters', 'legendary', 400);
    expect(no(s, { type: 'chooseEvent', index: 0 })).toMatch(/Shelf potion/);
    expect(no(s, { type: 'chooseEvent', index: 0, uid: s.shelf[1]!.uid })).toMatch(/Shelf potion/);
    const r = choose(s, 0, p.uid);
    expect(r.state.shelf[0]).toMatchObject({ tier: 'superb', quality: 30 });
    expect(ofType(r.events, 'potionUpgraded')).toHaveLength(1);
  });

  it('a Cracked Shelf costs 5 gold or a random Shelf potion', () => {
    let s = at('cracked-shelf');
    [s] = potion(s, 'healing-draught', 'fine');
    expect(choose(s, 0).state).toMatchObject({ gold: 20 - EVENT_GOLD.shelfRepair, shelf: [{ recipe: 'healing-draught' }] });
    expect(choose(s, 1).state.shelf).toEqual([]);
    expect(choose(at('cracked-shelf'), 1).state.offer).toMatchObject({ outcome: 'The Shelf was empty, so nothing fell.' });
  });

  it('Market Day opens the Market Square at 25% off', () => {
    const s = choose(at('market-day'), 0).state;
    expect(s.offer).toMatchObject({ kind: 'market', off: EVENT_RULES.marketDayOff });
    const stock = (s.offer as { stock: { kind: string; price: number }[] }).stock;
    expect(stock.find((i) => i.kind === 'shelf-slot')?.price).toBe(Math.round(6 * 0.75));
    expect(ok(s, { type: 'leaveErrand' }).state.day).toBe(2);
  });

  it('the Spice Merchant sells a Spice of your choice, or both free with a Bad Omen', () => {
    const s = at('spice-merchant');
    expect(no(s, { type: 'chooseEvent', index: 0, pick: 'elmroot' })).toMatch(/choose a card/);
    const bought = choose(s, 0, undefined, 'dragon-pepper').state;
    expect(bought.gold).toBe(20 - EVENT_GOLD.spice);
    expect(allCards(bought).filter((c) => c.card === 'dragon-pepper').length).toBe(allCards(s).filter((c) => c.card === 'dragon-pepper').length + 1);
    // Ginger Root only once unlocked.
    const both = choose({ ...s, unlocks: [...s.unlocks, 'ginger-root'] }, 1).state;
    expect(allCards(both).some((c) => c.card === 'ginger-root')).toBe(true);
    expect([...both.satchel, ...allCards(both)].some((c) => c.card === 'bad-omen')).toBe(true);
    expect(both.gold).toBe(20);
  });

  it('Sell a Recipe forgets a recipe you learned this run for 12 gold', () => {
    let s = at('sell-a-recipe');
    expect(no(s, { type: 'chooseEvent', index: 0 })).toMatch(/learned no recipes/);
    s = { ...s, knownRecipes: [...s.knownRecipes, 'courage-cordial'] };
    expect(no(s, { type: 'chooseEvent', index: 0, pick: s.knownRecipes[0]! })).toMatch(/choose a recipe/);
    const r = choose(s, 0, undefined, 'courage-cordial').state;
    expect(r.knownRecipes).not.toContain('courage-cordial');
    expect(r.gold).toBe(20 + EVENT_GOLD.recipeSale);
  });

  it("Pip & Quill's Dare: +2 Friendship, and the next brew is blind", () => {
    let s = choose(at('childrens-dare'), 0).state;
    expect(friendshipOf(s, 'pip-and-quill')).toBe(EVENT_RULES.dareFriendship);
    expect(s.blindBrew).toBe(true);
    s = nextDay(s);
    expect(s.blindBrew).toBe(true);
    const ing = s.hand.filter((c) => codex.ingredients.has(c.card)).slice(0, 2);
    for (const c of ing) s = ok(s, { type: 'slot', uid: c.uid }).state;
    s = ok(s, { type: 'brew' }).state;
    expect(s.blindBrew).toBe(false);
    expect(friendshipOf(choose(at('childrens-dare'), 1).state, 'pip-and-quill')).toBe(0);
  });

  it("Old Tobin's Stories: Friendship and a Geode", () => {
    const s = choose(at('tobins-stories'), 0).state;
    expect(friendshipOf(s, 'old-tobin')).toBe(EVENT_RULES.tobinFriendship);
    expect(allCards(s).some((c) => c.card === 'geode')).toBe(true);
  });

  it("Bea's Bake Sale: your lowest Warming potion for gold and Friendship, or a bun for a Brew tomorrow", () => {
    let s = at('bake-sale');
    expect(no(s, { type: 'chooseEvent', index: 0 })).toMatch(/Warming/);
    [s] = potion(s, 'hearthwarm-tonic', 'superb', 40);
    [s] = potion(s, 'ginger-toddy', 'fine');
    const helped = choose(s, 0).state;
    expect(helped.shelf.map((p) => p.recipe)).toEqual(['hearthwarm-tonic']);
    expect(helped.gold).toBe(20 + EVENT_GOLD.bakeSale);
    expect(friendshipOf(helped, 'bea-thornwick')).toBe(EVENT_RULES.beaFriendship);
    const base = nextDay(choose(at('fairy-ring'), 1).state).brewsLeft;
    const bun = choose(s, 1).state;
    expect(bun.gold).toBe(20 - EVENT_GOLD.bun);
    expect(nextDay(bun).brewsLeft).toBe(base + 1);
  });

  it('An Apprentice Asks: a card of yours for a recipe you don\'t know', () => {
    const s = at('apprentice-asks');
    const card = allCards(s)[0]!;
    const r = choose(s, 0, card.uid).state;
    expect(allCards(r)).toHaveLength(allCards(s).length - 1);
    expect(r.knownRecipes).toHaveLength(s.knownRecipes.length + 1);
    // Not below the minimum deck.
    const thin = { ...s, drawPile: s.drawPile.slice(0, MIN_DECK - s.hand.length - s.discardPile.length) };
    expect(no(thin, { type: 'chooseEvent', index: 0, uid: card.uid })).toMatch(/below/);
  });

  it('An Old Cookbook comes once the Grimoire Page is unlocked', () => {
    const seen = (unlocks: string[]) => {
      const out = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const s = ok(ok(brewing(`cook-${i}`), { type: 'endDay' }).state, { type: 'skipReward' }).state;
        const t = ok({ ...s, unlocks }, { type: 'debug', op: 'openErrand', errand: 'event' }).state;
        if (t.offer?.kind === 'event') out.add(t.offer.event);
      }
      return out;
    };
    expect(seen([]).has('old-cookbook')).toBe(false);
    expect(seen(['grimoire-page']).has('old-cookbook')).toBe(true);
    const bought = choose(at('old-cookbook'), 0).state;
    expect(allCards(bought).some((c) => c.card === 'grimoire-page')).toBe(true);
    expect(bought.gold).toBe(20 - EVENT_GOLD.cookbook);
  });

  it('leafing through the Old Cookbook shows every patron from Year 2', () => {
    const y1 = choose(at('old-cookbook'), 1).state;
    expect(y1.patronsRead).toBe(false);
    const y2 = { ...at('old-cookbook'), year: 2 };
    expect(patronKnown(y2, 3)).toBe(false);
    const read = choose(y2, 1).state;
    expect(patronKnown(read, 3)).toBe(true);
    expect(patronKnown({ ...y2, day: NIGHT_SHIFT_DAY - 1, week: 3 }, 3)).toBe(true);
  });

  it('a run saved before these events continues without them', () => {
    const old: Record<string, unknown> = { ...at('fairy-ring'), version: 21 };
    for (const k of ['tomorrow', 'forfeitReward', 'blindBrew', 'patronsRead']) delete old[k];
    expect(migrateRun(old)).toMatchObject({ tomorrow: { brews: 0, discards: 0 }, forfeitReward: false, blindBrew: false, patronsRead: false });
  });
});
