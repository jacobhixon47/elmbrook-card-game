import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import type { GameEvent, RunState } from '../src/core';
import { activityLines, LOG_CAP, LOG_COLOR, logFor, plain, record, resetLog } from '../src/view/activity';

const lines = (events: GameEvent[]) => activityLines(events).map(plain);

describe('activity log lines', () => {
  it('names the card that left the deck, in its own colour', () => {
    const [line] = activityLines([{ type: 'cardRemoved', uid: 4, card: 'emberbloom' }]);
    expect(plain(line!)).toBe('Emberbloom left your deck.');
    expect(line![0]).toEqual({ text: 'Emberbloom', color: LOG_COLOR.card });
    expect(line![1]!.color).toBe(LOG_COLOR.body);
  });

  it('covers cards gained, changed and lost', () => {
    expect(lines([
      { type: 'cardGained', card: 'mandrake', uid: 9, source: 'market' },
      { type: 'cardExpired', uid: 3, card: 'cobweb' },
      { type: 'cardTransformed', uid: 2, from: 'elmroot', to: 'mandrake' },
      { type: 'cardModified', uid: 2, card: 'elmroot', modifier: 'blessed', by: 'creek' },
    ])).toEqual([
      'Mandrake joined your deck. (bought)',
      'Cobweb faded from your deck.',
      'Elmroot became Mandrake.',
      'Elmroot is now Blessed.',
    ]);
  });

  it('names an infused card from the state the action led to', () => {
    const after = { drawPile: [{ uid: 7, card: 'elmroot' }], hand: [], discardPile: [], satchel: [], cauldron: [] } as unknown as RunState;
    expect(activityLines([{ type: 'cardInfused', uid: 7, bonus: 2 }], after).map(plain)).toEqual(['Elmroot was infused: +2 Potency.']);
  });

  it('notes recipes and friendship', () => {
    expect(lines([
      { type: 'recipeDiscovered', recipe: 'healing-draught' },
      { type: 'friendshipGained', regular: 'old-tobin', points: 1, total: 1, level: 0, levelUp: false },
      { type: 'friendshipGained', regular: 'old-tobin', points: 4, total: 5, level: 1, levelUp: true },
    ])).toEqual(['New recipe: Healing Draught.', 'Old Tobin +1 Friendship (1/5)', 'Old Tobin is now Friendship 1!']);
  });

  it("skips gold another line already explains, and debug moves", () => {
    expect(lines([
      { type: 'goldChanged', gold: 13, delta: 3, reason: 'order' },
      { type: 'goldChanged', gold: 5, delta: -8, reason: 'market' },
      { type: 'cardModified', uid: 1, card: 'elmroot', modifier: 'blessed', by: 'debug' },
      { type: 'cardDrawn', uid: 1, card: 'elmroot' },
    ])).toEqual([]);
    expect(lines([{ type: 'goldChanged', gold: 2, delta: -3, reason: 'omen' }])).toEqual(['-3 gold (Omen)']);
  });

  it("doesn't repeat a tarot's gold", () => {
    const sun = codex.tarot.get('the-sun')!;
    expect(lines([
      { type: 'goldChanged', gold: 30, delta: -11, reason: 'fortune' },
      { type: 'tarotDrawn', card: sun.id, price: 11 },
      { type: 'goldChanged', gold: 45, delta: sun.amount!, reason: 'fortune' },
    ])).toEqual([`Drew ${sun.name}: ${sun.text}`]);
  });
});

describe('the log', () => {
  const run = { seed: 'log-test', endlessMode: false, week: 1, day: 2, endless: 0 } as RunState;

  it('keeps lines stamped with their day, up to a cap, and starts over for a new run', () => {
    resetLog(run);
    const added = record(run, activityLines([{ type: 'cardRemoved', uid: 1, card: 'elmroot' }]), false);
    expect(added).toEqual([{ when: 'Week 1 · Day 2', line: expect.any(Array) }]);
    for (let i = 0; i < LOG_CAP + 10; i++) record(run, [[{ text: `line ${i}`, color: 'w' }]], false);
    expect(logFor(run)).toHaveLength(LOG_CAP);
    expect(plain(logFor(run).at(-1)!.line)).toBe(`line ${LOG_CAP + 9}`);
    expect(logFor({ ...run, seed: 'another' })).toEqual([]);
  });
});
