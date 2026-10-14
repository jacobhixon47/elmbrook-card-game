import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { ok, start } from './helpers';

describe('order variety', () => {
  it('never names the same recipe twice on one board (Jacob\'s playtest: Panacea, again and again)', () => {
    let named = 0;
    for (let i = 0; i < 40; i++) {
      let s = ok(start(`variety-${i}`), { type: 'debug', op: 'learnRecipes', recipes: [...codex.recipes.keys()] }).state;
      for (const [week, day] of [[2, 1], [3, 2], [4, 1], [4, 3], [4, 5]] as const) {
        s = ok(s, { type: 'debug', op: 'jumpToDay', week, day }).state;
        const recipes = s.orders.flatMap((o) => (o.request.kind === 'recipe' ? [o.request.recipe] : []));
        named += recipes.length;
        expect(new Set(recipes).size).toBe(recipes.length);
      }
    }
    expect(named).toBeGreaterThan(150);
  });
});
