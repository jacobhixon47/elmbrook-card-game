import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { previewBrew, type Action, type RunState } from '../src/core';
import { deckRows, guideSections, recipeRows, stages, undiscoveredLine } from '../src/view/guide';
import { cardInfo, GLOSSARY, termsIn, tierLadder } from '../src/view/inspect';
import { TIPS, TUTORIAL_SEED, TutorialProgress, type TutorialView } from '../src/view/tutorial';
import { brewing, ok, start } from './helpers';

describe('card inspect', () => {
  it('describes every card in the codex', () => {
    for (const id of [...codex.ingredients.keys(), ...codex.tinctures.keys(), ...codex.junk.keys()]) {
      const info = cardInfo(id);
      expect(info.title.length, id).toBeGreaterThan(0);
      expect(info.text.length, id).toBeGreaterThan(0);
      expect(info.terms.length, id).toBeLessThanOrEqual(3);
    }
  });

  it('names essences and potency and defines the terms a card uses', () => {
    const info = cardInfo('thistledown');
    expect(info.kind).toBe('Common ingredient · Wychwood · Flower');
    expect(info.essences).toEqual(['gale']);
    expect(info.text).toBe('Gale essence. Potency 3. When discarded, draw 1.');
    expect(info.terms.map(([t]) => t)).toEqual(['Essence', 'Potency', 'Discard']);
    expect(cardInfo('stir').terms.map(([t]) => t)).toContain('Harmony');
    expect(cardInfo('grave-moss').text).toMatch(/Night Shifts only/);
    expect(termsIn('-1 heart with the customer').map(([t]) => t)).toEqual(['Hearts']);
    expect(cardInfo('sludge').kind).toBe('Junk');
  });

  it('lists the tiers in order', () => {
    expect(tierLadder()).toBe('Crude under 10 · Fine 10+ · Superb 30+ · Masterwork 100+ · Legendary 300+');
  });
});

describe('Grimoire', () => {
  it('shows known recipes in full and counts the rest', () => {
    const rows = recipeRows(start());
    expect(rows.length).toBeLessThan(codex.recipes.size); // unlock and event recipes are left out
    const known = rows.filter((r) => r.known);
    expect(known.map((r) => r.id).sort()).toEqual([...start().knownRecipes].sort());
    expect(known[0]!.pattern).not.toBeNull();
    const hidden = rows.find((r) => !r.known)!;
    expect(hidden).toMatchObject({ name: '???', pattern: null, harmony: null });
    expect(undiscoveredLine(rows, 2)).toMatch(/with three ingredients \(needs 3 cauldron slots\)/);
    expect(undiscoveredLine(rows, 3)).not.toMatch(/needs/);
    expect(undiscoveredLine(known, 2)).toMatch(/every recipe/);
  });

  it('groups the deck and counts what is left to draw', () => {
    const s = brewing();
    const rows = deckRows(s);
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(s.drawPile.length + s.hand.length + s.discardPile.length + s.cauldron.length);
    expect(rows.reduce((n, r) => n + r.inDraw, 0)).toBe(s.drawPile.length);
    expect(rows.at(-1)!.card).toBe('stir'); // tinctures after ingredients
  });

  it('has a guide with the glossary', () => {
    const g = guideSections();
    expect(g.map((x) => x.title)).toEqual(['A run', 'A day', 'Brewing', 'The Night Market', 'Quality', 'Glossary']);
    expect(g.at(-1)!.body.split('\n')).toHaveLength(Object.keys(GLOSSARY).length);
  });
});

describe('stage ribbon', () => {
  it('marks the day of the week and the step of the day', () => {
    const s = start();
    expect(stages(s).days.map((d) => d.mark)).toEqual(['now', 'next', 'next', 'next', 'next']);
    expect(stages(s).steps.map((d) => d.mark)).toEqual(['now', 'next', 'next', 'next']);
    const b = brewing();
    expect(stages(b).steps.map((d) => d.mark)).toEqual(['done', 'now', 'next', 'next']);
    const dusk = ok(b, { type: 'endDay' }).state;
    expect(stages(dusk).steps[2]).toEqual({ label: 'Twilight', mark: 'now' });
    const errand = ok(dusk, { type: 'skipReward' }).state;
    expect(stages(errand).steps[3]).toEqual({ label: 'Errand', mark: 'now' });
    const night = { ...start(), day: 5, phase: 'night-market' as const, offer: { kind: 'night-market' as const, stalls: [], at: null } };
    expect(stages(night).days.at(-1)).toEqual({ label: 'Night', mark: 'now' });
    expect(stages(night).steps[3]).toEqual({ label: 'Night Market', mark: 'now' });
    expect(stages({ ...night, phase: 'victory', offer: null }).steps.every((x) => x.mark === 'done')).toBe(true);
  });
});

describe('tutorial', () => {
  const view = (s: RunState, v: Partial<TutorialView> = {}): TutorialView => ({
    dialog: false, book: false, preview: s.phase === 'brewing' ? previewBrew(s, s.cauldron, s.hand).kind : 'empty', ...v,
  });

  it('walks week 1 of the tutorial seed tip by tip', () => {
    const t = new TutorialProgress();
    let s = start(TUTORIAL_SEED);
    const act = (a: Action) => (s = ok(s, a).state);
    const tip = (v: Partial<TutorialView> = {}) => t.current(s, view(s, v))?.id ?? null;

    expect(tip()).toBe('welcome');
    expect(tip({ dialog: true })).toBe('order');
    expect(tip()).toBe('open');
    act({ type: 'openShop' });
    expect(tip()).toBe('hand');
    t.dismiss('hand');
    expect(tip()).toBe('grimoire');
    expect(tip({ book: true })).toBe(null);
    expect(tip()).toBe('slot');
    // The tip's advice works: Elmroot + Creekwater fills the first order.
    for (const card of ['elmroot', 'creekwater']) act({ type: 'slot', uid: s.hand.find((c) => c.card === card)!.uid });
    expect(tip()).toBe('preview');
    act({ type: 'brew', deliverTo: s.orders[0]!.id });
    expect(s.orders[0]!.status).toBe('filled');
    expect(tip()).toBe('day');
    t.dismiss('day');
    expect(tip()).toBe('end');
    t.dismiss('end');
    expect(tip()).toBe(null);
    act({ type: 'endDay' });
    expect(tip()).toBe('twilight');
    act({ type: 'skipReward' });
    expect(tip()).toBe('errand');
    const offer = s.offer as { options: string[] };
    act({ type: 'chooseErrand', errand: offer.options.includes('hearth') ? 'hearth' : offer.options[0] as 'market' });
    expect(tip()).toBe(null);
    act({ type: 'leaveErrand' });
    expect(tip()).toBe('day2');
    t.dismiss('day2');
    expect(tip()).toBe('weather');
    act({ type: 'debug', op: 'jumpToDay', week: 1, day: 5 });
    expect(tip()).toBe('night');
    expect(t.done.has('weather')).toBe(true); // skipped past
    expect(t.finished(s)).toBe(false);
    t.dismiss('night');
    expect(tip()).toBe('patron');
    act({ type: 'openShop' });
    act({ type: 'endDay' });
    act({ type: 'skipReward' });
    expect(tip()).toBe('gift');
    act({ type: 'takeGift', index: 0 });
    expect(s.satchel).toHaveLength(1);
    expect(tip()).toBe('fence');
    act({ type: 'debug', op: 'addGold', amount: 100 });
    act({ type: 'leaveMarket' });
    expect(s.week).toBe(2);
    expect(tip()).toBe('done');
    expect(t.finished(s)).toBe(false);
    t.dismiss('done');
    expect(t.finished(s)).toBe(true);
  });

  it('ends when the run does, and every tip has a way to close', () => {
    expect(new TutorialProgress().finished({ ...start(), phase: 'game-over' })).toBe(true);
    expect(new TutorialProgress().finished({ ...start(), week: 2, phase: 'brewing' })).toBe(true);
    expect(new Set(TIPS.map((x) => x.id)).size).toBe(TIPS.length);
  });
});
