import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { allCards, matchRecipe, previewBrew, tierOf, tierStep, type RunState } from '../src/core';
import { EFFECTS } from '../src/core/effects';
import { brewing, no, ofType, ok, slotAll, withHand } from './helpers';

const ings = (...ids: string[]) => ids.map((id) => codex.ingredients.get(id)!);
const knownRecipes = ['healing-draught', 'hearthwarm-tonic', 'calm-waters', 'sleep-syrup'];
const known = { knownRecipes, unlocks: [] };

/** Brew these cards from a fresh brewing state; returns the result. */
function brewCards(cards: string[], tweak?: (s: RunState) => void) {
  const [s0, uids] = withHand(brewing(), cards);
  tweak?.(s0);
  const s = slotAll(s0, uids.slice(0, Math.min(s0.cauldronSlots, cards.length)));
  return { before: s, ...ok(s, { type: 'brew' }) };
}

describe('recipe matching', () => {
  it('matches essence patterns in any order', () => {
    expect(matchRecipe(ings('elmroot', 'creekwater'), known)?.id).toBe('healing-draught');
    expect(matchRecipe(ings('creekwater', 'elmroot'), known)?.id).toBe('healing-draught');
    expect(matchRecipe(ings('elmroot', 'elmroot', 'creekwater'), known)?.id).toBe('greater-restorative');
    expect(matchRecipe(ings('elmroot', 'elmroot'), known)).toBeNull();
    expect(matchRecipe(ings('elmroot'), known)).toBeNull();
  });

  it('prefers the highest base Harmony, then a known recipe', () => {
    // Mistcap (Tide, Umbra) + Thistledown (Gale): Calm Waters (2) or Whisper Ink (3).
    expect(matchRecipe(ings('mistcap', 'thistledown'), known)?.id).toBe('whisper-ink');
    // Honeycomb + Willow Bark make Healing Draught or Hearthwarm Tonic (both 2).
    expect(matchRecipe(ings('honeycomb', 'willow-bark'), known)?.id).toBe('healing-draught');
    expect(matchRecipe(ings('honeycomb', 'willow-bark'), { knownRecipes: ['hearthwarm-tonic'], unlocks: [] })?.id).toBe('hearthwarm-tonic');
  });

  it('wild essences and "any" slots match anything', () => {
    expect(matchRecipe(ings('moonmoth-wing', 'creekwater'), known)).not.toBeNull();
    expect(matchRecipe(ings('starlit-dew', 'creekwater', 'river-clay'), known)?.id).toBe('moonglass-elixir');
  });
});

describe('scoring', () => {
  it('Quality = Potency x Harmony, with an event per step (GDD §6.3 sanity check)', () => {
    const { events, state } = brewCards(['elmroot', 'creekwater']);
    const steps = ofType(events, 'scoreStep');
    expect(steps.map((s) => s.source)).toEqual(['recipe', 'ingredient', 'ingredient']);
    expect(steps.at(-1)).toMatchObject({ potency: 7, harmony: 2 });
    const brewed = ofType(events, 'brewed')[0]!;
    expect(brewed.potion).toMatchObject({ recipe: 'healing-draught', quality: 14, tier: 'fine', experiment: false });
    expect(state.brewsLeft).toBe(3);
    expect(state.shelf).toHaveLength(1);
    expect(state.hand).toHaveLength(8);
  });

  it('quality tiers follow GDD §6.4', () => {
    expect([9, 10, 29, 30, 99, 100, 299, 300].map(tierOf)).toEqual(['crude', 'fine', 'fine', 'superb', 'superb', 'masterwork', 'masterwork', 'legendary']);
    expect(tierStep('crude', -1)).toBe('crude');
    expect(tierStep('legendary', 1)).toBe('legendary');
  });

  it('an Experiment discovers the recipe and brews one tier lower', () => {
    const { events, state } = brewCards(['river-clay', 'elmroot']);
    expect(ofType(events, 'recipeDiscovered')).toEqual([{ type: 'recipeDiscovered', recipe: 'ironhide-salve' }]);
    expect(ofType(events, 'brewed')[0]!.potion).toMatchObject({ quality: 18, tier: 'crude', experiment: true });
    expect(state.knownRecipes).toContain('ironhide-salve');
  });

  it('an invalid mix makes Sludge: no potion, a junk card, and the Brew is spent', () => {
    const { events, state } = brewCards(['elmroot', 'elmroot']);
    expect(ofType(events, 'sludge')).toHaveLength(1);
    expect(ofType(events, 'brewed')).toHaveLength(0);
    expect(state.shelf).toHaveLength(0);
    expect(allCards(state).some((c) => c.card === 'sludge')).toBe(true);
    expect(state.brewsLeft).toBe(3);
  });

  it('the preview is exactly what brewing produces', () => {
    const [s0, uids] = withHand(brewing(), ['willow-bark', 'creekwater', 'nightshade']);
    const s = slotAll(s0, uids.slice(0, 2));
    const preview = previewBrew(s, s.cauldron, s.hand);
    const brewed = ofType(ok(s, { type: 'brew' }).events, 'brewed')[0]!;
    expect(preview).toMatchObject({ kind: 'potion', quality: brewed.potion.quality, tier: brewed.potion.tier });
    expect(previewBrew(s, s.cauldron.slice(0, 1), s.hand)).toEqual({ kind: 'empty' });
    expect(previewBrew(s, [{ uid: 1, card: 'stir' }, { uid: 2, card: 'elmroot' }], [])).toEqual({ kind: 'empty' });
  });
});

describe('ingredient effects', () => {
  it('every effect id in the codex is registered', () => {
    const ids = [...codex.ingredients.values(), ...codex.tinctures.values()].flatMap((c) => c.effects);
    for (const id of ids) expect(EFFECTS[id], id).toBeDefined();
  });

  it('Quartz Dust: +2 Harmony with 3 ingredients', () => {
    // Quartz (Stone, Gale) + Thistledown (Gale) + Elmroot (Vital) = Philter of Luck (4).
    const { events } = brewCards(['quartz-dust', 'thistledown', 'elmroot'], (s) => (s.cauldronSlots = 3));
    const last = ofType(events, 'scoreStep').at(-1)!;
    expect(last).toMatchObject({ potency: 11, harmony: 6 });
  });

  it('Crow Feather: +1 Harmony per Umbra card left in hand', () => {
    const { events } = brewCards(['crow-feather', 'nightshade', 'nightshade', 'mistcap']);
    // Whisper Ink 3 + 2 Umbra cards still in hand.
    const steps = ofType(events, 'scoreStep');
    expect(steps[1]).toMatchObject({ id: 'crow-feather', note: '+2 Harmony' });
    expect(steps.at(-1)).toMatchObject({ potency: 11, harmony: 5 });
  });

  it('Dragon Pepper costs a Discard to brew, and cannot be brewed without one', () => {
    const { state } = brewCards(['dragon-pepper', 'elmroot']);
    expect(state.discardsLeft).toBe(2);
    const [s0, uids] = withHand(brewing(), ['dragon-pepper', 'elmroot']);
    const s = slotAll({ ...s0, discardsLeft: 0 }, uids);
    expect(no(s, { type: 'brew' })).toMatch(/Discards/);
  });

  it('Amber Sap ages a Potency each day and resets when brewed', () => {
    const { events, state } = brewCards(['amber-sap', 'elmroot'], (s) => (s.hand[0]!.aged = 3));
    expect(ofType(events, 'scoreStep')[1]).toMatchObject({ potency: 10, note: 'Aged +3' });
    expect(allCards(state).find((c) => c.card === 'amber-sap')!.aged).toBeUndefined();

    const [s0] = withHand(brewing(), ['amber-sap']);
    const after = ok(s0, { type: 'endDay' }).state;
    const sap = [...after.drawPile, ...after.hand, ...after.discardPile].find((c) => c.card === 'amber-sap')!;
    expect(sap.aged).toBe(1);
  });

  it('Thistledown draws a card when discarded', () => {
    const [s] = withHand(brewing(), ['thistledown', 'elmroot', 'elmroot', 'elmroot', 'elmroot', 'elmroot', 'elmroot', 'elmroot']);
    const r = ok(s, { type: 'discard', uids: [s.hand[0]!.uid] });
    expect(r.state.hand).toHaveLength(9);
    expect(r.state.discardsLeft).toBe(2);
  });
});

describe('cauldron and discards', () => {
  it('only ingredients fit, and only as many as there are slots', () => {
    const [s, uids] = withHand(brewing(), ['elmroot', 'creekwater', 'emberbloom', 'stir']);
    expect(no(s, { type: 'slot', uid: uids[3]! })).toMatch(/only ingredients/);
    const full = slotAll(s, uids.slice(0, 2));
    expect(no(full, { type: 'slot', uid: uids[2]! })).toMatch(/full/);
    const back = ok(full, { type: 'unslot', uid: uids[0]! }).state;
    expect(back.cauldron.map((c) => c.uid)).toEqual([uids[1]]);
    expect(no(back, { type: 'unslot', uid: uids[0]! })).toMatch(/not in the cauldron/);
    expect(no(s, { type: 'slot', uid: 9999 })).toMatch(/not in hand/);
  });

  it('a brew needs two ingredients and a Brew left', () => {
    const [s, uids] = withHand(brewing(), ['elmroot', 'creekwater']);
    expect(no(slotAll(s, uids.slice(0, 1)), { type: 'brew' })).toMatch(/two ingredients/);
    expect(no({ ...slotAll(s, uids), brewsLeft: 0 }, { type: 'brew' })).toMatch(/no Brews/);
  });

  it('discarding spends a Discard and draws back up', () => {
    const s = brewing();
    const r = ok(s, { type: 'discard', uids: [s.hand[0]!.uid, s.hand[1]!.uid] });
    expect(r.state.discardsLeft).toBe(2);
    expect(r.state.hand).toHaveLength(8);
    expect(no(s, { type: 'discard', uids: [] })).toMatch(/discard 1 to 5/);
    expect(no({ ...s, discardsLeft: 0 }, { type: 'discard', uids: [s.hand[0]!.uid] })).toMatch(/no Discards/);
  });

  it('the draw pile reshuffles the discards when it runs out', () => {
    const s = brewing();
    const r = ok({ ...s, drawPile: [], discardPile: [{ uid: 900, card: 'elmroot' }] }, { type: 'discard', uids: [s.hand[0]!.uid] });
    expect(ofType(r.events, 'deckShuffled')).toHaveLength(1);
    expect(r.state.hand).toHaveLength(8);
    // Nothing left anywhere: the hand just stays short.
    const [bare, uids] = withHand({ ...s, drawPile: [], discardPile: [] }, ['forage']);
    expect(ok(bare, { type: 'playTincture', uid: uids[0]! }).state.hand).toHaveLength(0);
  });
});

describe('tinctures', () => {
  it('Stir and Steep buff the next brew only', () => {
    const [s0, uids] = withHand(brewing(), ['stir', 'steep', 'elmroot', 'creekwater']);
    let s = ok(s0, { type: 'playTincture', uid: uids[0]! }).state;
    s = ok(s, { type: 'playTincture', uid: uids[1]! }).state;
    expect(s.pending).toEqual({ harmony: 1, harmonyMult: 1, potency: 0, potencyMult: 1.5, copies: 1, fullExperiment: false });
    s = slotAll(s, uids.slice(2));
    const r = ok(s, { type: 'brew' });
    // floor(7 x 1.5) = 10, Harmony 2 + 1.
    expect(ofType(r.events, 'scoreStep').at(-1)).toMatchObject({ source: 'tincture', potency: 10, harmony: 3 });
    expect(r.state.pending).toEqual({ harmony: 0, harmonyMult: 1, potency: 0, potencyMult: 1, copies: 1, fullExperiment: false });
  });

  it('Bottle Spare makes two potions', () => {
    const [s0, uids] = withHand(brewing(), ['bottle-spare', 'elmroot', 'creekwater']);
    const s = slotAll(ok(s0, { type: 'playTincture', uid: uids[0]! }).state, uids.slice(1));
    const r = ok(s, { type: 'brew' });
    expect(ofType(r.events, 'brewed')[0]!.copies).toBe(2);
    expect(r.state.shelf).toHaveLength(2);
  });

  it('Forage draws 2 and Sift redraws without spending a Discard', () => {
    const [s0, uids] = withHand(brewing(), ['forage', 'sift', 'elmroot', 'elmroot']);
    const foraged = ok(s0, { type: 'playTincture', uid: uids[0]! }).state;
    expect(foraged.hand).toHaveLength(5);
    const sifted = ok(foraged, { type: 'playTincture', uid: uids[1]!, targets: [uids[2]!, uids[3]!] });
    expect(sifted.state.hand).toHaveLength(4);
    expect(sifted.state.discardsLeft).toBe(3);
    expect(no(foraged, { type: 'playTincture', uid: uids[1]! })).toMatch(/at least one/);
    expect(no(foraged, { type: 'playTincture', uid: uids[1]!, targets: [uids[1]!] })).toMatch(/itself/);
    expect(no(foraged, { type: 'playTincture', uid: uids[2]! })).toMatch(/only Tinctures/);
  });
});
