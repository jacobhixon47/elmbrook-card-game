import { describe, expect, it } from 'vitest';
import { previewBrew, reduce } from '../src/core';
import { stepAction } from '../src/debug/fixture-steps';
import { cardText, customerLine, dayLabel, orderTerms, requestText } from '../src/view/describe';
import { bestOrderFor, previewPotion } from '../src/view/plan';
import { brewing, slotAll, withHand } from './helpers';

const order = (id: number, pay: number, minTier: 'fine' | 'superb' = 'fine') => ({
  id, customer: 'old-tobin', request: { kind: 'family' as const, family: 'healing' as const }, minTier, pay, bonus: null, status: 'open' as const, quantity: 1, delivered: 0, tagBonus: null,
});

describe('UI wording', () => {
  it('states orders plainly and lets customers speak in character', () => {
    expect(requestText({ request: { kind: 'recipe', recipe: 'healing-draught' } })).toBe('Healing Draught');
    expect(requestText({ request: { kind: 'family', family: 'calming' } })).toBe('any Calming potion');
    expect(customerLine({ request: { kind: 'recipe', recipe: 'sleep-syrup' } })).toMatch(/Sleep Syrup/);
    expect(customerLine({ request: { kind: 'family', family: 'healing' } })).toMatch(/aches/);
    expect(orderTerms({ minTier: 'superb', pay: 7 })).toBe('Superb or better · 7g');
    expect(dayLabel({ week: 2, day: 5 })).toBe('Week 2 · Night Shift');
    expect(cardText('thistledown')).toBe('Gale · Potency 3. When discarded, draw 1.');
    expect(cardText('stir')).toMatch(/Harmony/);
  });
});

describe('brew targeting', () => {
  it('sends a potion to the best-paying order it fills, unless one is pinned', () => {
    const [s0, uids] = withHand(brewing(), ['elmroot', 'creekwater']);
    const s = { ...slotAll(s0, uids), orders: [order(1, 3), order(2, 8), order(3, 20, 'superb')] };
    const potion = previewPotion(previewBrew(s, s.cauldron, s.hand), s.cauldron)!;
    expect(bestOrderFor(s, potion)?.id).toBe(2);
    expect(bestOrderFor(s, potion, 1)?.id).toBe(1);
    expect(bestOrderFor(s, potion, 3)?.id).toBe(2);
    expect(bestOrderFor({ orders: [] }, potion)).toBeNull();
    expect(previewPotion({ kind: 'empty' }, [])).toBeNull();
  });
});

describe('fixture steps', () => {
  it('turn readable steps into actions on the current state', () => {
    let s = reduce(null, { type: 'startRun', seed: 'steps', witch: 'hedge-witch' }).state;
    s = reduce(s, stepAction(s, 'openShop')).state;
    expect(stepAction(s, { slot: 0 })).toEqual({ type: 'slot', uid: s.hand[0]!.uid });
    expect(stepAction(s, { pick: 2 })).toEqual({ type: 'pickReward', index: 2 });
    expect(stepAction(s, { errand: 'hearth' })).toEqual({ type: 'chooseErrand', errand: 'hearth' });
    expect(stepAction(s, { jump: [2, 5] })).toMatchObject({ op: 'jumpToDay', week: 2, day: 5 });
    expect(stepAction(s, { gold: 5 })).toMatchObject({ op: 'addGold', amount: 5 });
    expect(stepAction(s, { removeAt: 0 })).toMatchObject({ type: 'removeCard' });
    expect(stepAction(s, 'skipReward')).toEqual({ type: 'skipReward' });
  });
});
