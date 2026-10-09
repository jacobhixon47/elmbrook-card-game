import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { allCards, EVENT_CHOICES, EVENT_GOLD, MIN_DECK, transformable, type RunState } from '../src/core';
import { rarityOf } from '../src/core/dusk';
import { brewing, no, ofType, ok } from './helpers';

/** At dusk on day 1 with this event open, and this much gold. */
function at(event: string, gold = 20, seed = 'events'): RunState {
  let s = ok(ok(brewing(seed), { type: 'endDay' }).state, { type: 'skipReward' }).state;
  s = { ...s, gold };
  return ok(s, { type: 'debug', op: 'openEvent', event }).state;
}

const choose = (s: RunState, index: number, uid?: number) => ok(s, { type: 'chooseEvent', index, ...(uid !== undefined ? { uid } : {}) });

describe('dusk events', () => {
  it('every codex event has rules for each of its choices', () => {
    for (const e of codex.duskEvents.values()) expect(EVENT_CHOICES[e.id]?.length, e.id).toBe(e.choices.length);
    expect(codex.duskEvents.size).toBe(8);
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
    expect(no(shrine, { type: 'chooseEvent', index: 0 })).toMatch(/3 gold/);
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

  it('the Found Coin Purse: a heart for returning it, gold and a Bad Omen for keeping it', () => {
    const back = choose(at('found-coin-purse'), 0);
    expect(ofType(back.events, 'heartsChanged')[0]!.delta).toBe(1);
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
