import { describe, expect, it } from 'vitest';
import { type Potion, type RunState } from '../src/core';
import { fencePrice } from '../src/core/reduce';
import { potionLines } from '../src/view/plan';
import { brewing, no, ofType, ok } from './helpers';

const potion = (uid: number, over: Partial<Potion> = {}): Potion => ({
  uid, recipe: 'four-leaf-tea', family: 'fortune', quality: 14, tier: 'crude', ingredients: ['elmroot', 'thistledown'], experiment: false, heartDelta: 0, ...over,
});

const withShelf = (s: RunState, ...shelf: Potion[]): RunState => ({ ...s, shelf });

describe('pouring out a Shelf potion', () => {
  it('removes it for a Discard while brewing', () => {
    const s = withShelf({ ...brewing('pour'), discardsLeft: 2 }, potion(900), potion(901));
    const r = ok(s, { type: 'pourOut', uid: 900 });
    expect(r.state.shelf.map((p) => p.uid)).toEqual([901]);
    expect(r.state.gold).toBe(s.gold);
    expect(r.state.discardsLeft).toBe(1);
    expect(r.state.stats.discardsUsed).toBe(s.stats.discardsUsed + 1);
    expect(ofType(r.events, 'potionPoured')).toEqual([{ type: 'potionPoured', uid: 900 }]);
  });

  it('refuses with no Discard left, outside a day, or a potion not on the Shelf', () => {
    const s = withShelf({ ...brewing('pour'), discardsLeft: 1 }, potion(900));
    expect(no({ ...s, discardsLeft: 0 }, { type: 'pourOut', uid: 900 })).toMatch(/takes a Discard/);
    expect(no(s, { type: 'pourOut', uid: 1 })).toMatch(/not on the Shelf/);
    expect(no({ ...s, phase: 'game-over' }, { type: 'pourOut', uid: 900 })).toBeTruthy();
    expect(no({ ...s, phase: 'dusk' }, { type: 'pourOut', uid: 900 })).toBeTruthy();
  });
});

describe('a Shelf potion tooltip', () => {
  it('says what it is, what it is made of and what the Fence pays', () => {
    const p = potion(900, { heartDelta: 1 });
    const lines = potionLines(withShelf(brewing('pour'), p), p);
    expect(lines[0]).toMatch(/Crude \(quality 14\)/);
    expect(lines).toContain('Made with Elmroot, Thistledown.');
    expect(lines).toContain('+1 Friendship on delivery.');
    expect(lines).toContain(`The Fence pays ${fencePrice(p)}g after the Night Shift.`);
  });

  it('names the order it would fill while brewing', () => {
    const s = brewing('pour');
    const order = s.orders[0]!;
    const fits: Potion = order.request.kind === 'recipe'
      ? potion(900, { recipe: order.request.recipe, tier: 'legendary', quality: 400 })
      : potion(900, { family: order.request.family, tier: 'legendary', quality: 400 });
    const lines = potionLines({ ...s, fog: false }, fits);
    expect(lines.some((l) => l.startsWith('Fills '))).toBe(true);
    expect(potionLines({ ...s, phase: 'dusk' }, fits).some((l) => l.startsWith('Fills ') || l.startsWith('No open'))).toBe(false);
  });
});
