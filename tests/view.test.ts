import { describe, expect, it } from 'vitest';
import { CODEX_TABLES, previewBrew, reduce } from '../src/core';
import { CODEX_TABS, codexEntries } from '../src/view/codex';
import { stepAction } from '../src/debug/fixture-steps';
import { cardText, customerBlurb, customerLine, customerName, dayLabel, extraPay, orderNeeds, orderTerms, requestText } from '../src/view/describe';
import { FONT_BODY, FONT_DISPLAY } from '../src/view/text';
import { cardInfo } from '../src/view/inspect';
import { bestOrderFor, previewPotion } from '../src/view/plan';
import { brewing, slotAll, withHand } from './helpers';

const order = (id: number, pay: number, minTier: 'fine' | 'superb' = 'fine') => ({
  id, customer: 'old-tobin', request: { kind: 'family' as const, family: 'healing' as const }, minTier, pay, bonus: null, status: 'open' as const, quantity: 1, delivered: 0, tagBonus: null, needsUmbra: false, expiresIn: null,
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

  it('names night customers and patrons, and says what they pay beyond gold', () => {
    expect(customerName('wisp-courier')).toBe('The Wisp Courier');
    expect(customerName('moonless-patron')).toBe('The Moonless Patron');
    expect(customerBlurb('lamplighter')).toMatch(/lamps/);
    expect(customerLine({ request: { kind: 'family', family: 'lunar' }, customer: 'pale-courier' })).toMatch(/moonlight/);
    expect(orderTerms({ minTier: 'fine', pay: 4, customer: 'wisp-courier' })).toBe('Fine+ · 4g + Omen');
    expect(orderTerms({ minTier: 'fine', pay: 4, customer: 'lantern-witch' })).toBe('Fine+ · 4g + Lunar');
    expect(orderTerms({ minTier: 'fine', pay: 4, customer: 'bog-hag' })).toBe('Fine+ · 4g + Rare');
    expect(extraPay('lamplighter')).toBe('+6g');
    expect(extraPay('twin-owls')).toBe('pick 1 of 3 Rare cards');
    expect(extraPay('mother-hollow')).toMatch(/familiar/);
    expect(extraPay('pale-courier')).toMatch(/relic/);
    expect(extraPay('moonless-patron')).toBe('the month');
    expect(extraPay('moth-duchess')).toBeNull();
    expect(extraPay('old-tobin')).toBeNull();
    expect(orderNeeds({ needsUmbra: true, expiresIn: 1, status: 'open' })).toBe('Needs Umbra, leaves in 1 brew');
    expect(orderNeeds({ needsUmbra: false, expiresIn: null, status: 'open' })).toBeNull();
    expect(cardInfo('blood-moon').kind).toMatch(/Omen/);
    expect(cardInfo('starlit-dew').text).toMatch(/Night Satchel/);
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
    // Not at the errand pick: the step opens the errand anyway.
    expect(stepAction(s, { errand: 'hearth' })).toEqual({ type: 'debug', op: 'openErrand', errand: 'hearth' });
    const picking = { ...s, offer: { kind: 'errands' as const, options: ['hearth' as const, 'market' as const] } };
    expect(stepAction(picking, { errand: 'hearth' })).toEqual({ type: 'chooseErrand', errand: 'hearth' });
    expect(stepAction(s, { duskEvent: 'fairy-ring' })).toEqual({ type: 'debug', op: 'openEvent', event: 'fairy-ring' });
    expect(stepAction(s, { chooseEvent: 1 })).toEqual({ type: 'chooseEvent', index: 1 });
    expect(stepAction(s, { takeCommission: 0 })).toEqual({ type: 'takeCommission', index: 0 });
    expect(stepAction(s, { jump: [2, 5] })).toMatchObject({ op: 'jumpToDay', week: 2, day: 5 });
    expect(stepAction(s, { gold: 5 })).toMatchObject({ op: 'addGold', amount: 5 });
    expect(stepAction(s, { removeAt: 0 })).toMatchObject({ type: 'removeCard' });
    expect(stepAction(s, 'skipReward')).toEqual({ type: 'skipReward' });
  });
});

describe('the Codex', () => {
  it('hides what you have not met and describes what you have', () => {
    const rows = codexEntries('ingredients', ['creekwater']);
    expect(rows.find((r) => r.id === 'creekwater')).toMatchObject({ name: 'Creekwater', met: true, sub: expect.stringContaining('Tide') as unknown as string });
    expect(rows.find((r) => r.id === 'elmroot')).toMatchObject({ name: '???', met: false, text: '' });
    for (const tab of CODEX_TABS) for (const r of codexEntries(tab.id, [...CODEX_TABLES[tab.id].keys()])) expect(r.name).not.toBe('???');
    expect(codexEntries('townsfolk', ['lamplighter'])[0]).toBeDefined();
    expect(codexEntries('townsfolk', ['lamplighter']).find((r) => r.id === 'lamplighter')!.text).toMatch(/face-down/);
  });
});

describe('fonts', () => {
  // Pixelify Sans's 5 reads as S and its 3 as 8 at small sizes (seen in the ingredient tooltip).
  it('draws digits from the clearer digit faces first', () => {
    expect(FONT_BODY.startsWith('"Elmbrook Digits"')).toBe(true);
    expect(FONT_DISPLAY.startsWith('"Elmbrook Display Digits"')).toBe(true);
  });
});
