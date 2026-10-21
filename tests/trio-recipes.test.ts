import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { ESSENCES, type Essence, type Ingredient } from '../src/codex/schema';
import { fillsPattern, matchRecipe, recipeAvailable } from '../src/core/brew';
import { start } from './helpers';

// Every trio of three different day essences brews something (added with Jacob, Oct 21; GDD §14).

const DAY = ESSENCES.filter((e) => e !== 'lunar');

const trios: Essence[][] = [];
for (let a = 0; a < DAY.length; a++) {
  for (let b = a + 1; b < DAY.length; b++) for (let c = b + 1; c < DAY.length; c++) trios.push([DAY[a]!, DAY[b]!, DAY[c]!]);
}

/** A plain day ingredient of just this essence, so a brew of three can only fill that trio. */
function plain(e: Essence): Ingredient {
  const ing = [...codex.ingredients.values()].find((i) => i.essences.length === 1 && i.essences[0] === e && !i.nightOnly && i.effects.length === 0);
  expect(ing, `a plain ${e} ingredient`).toBeDefined();
  return ing!;
}

const NEW_TRIOS: Record<string, Essence[]> = {
  'nightlight-broth': ['vital', 'ember', 'umbra'],
  'mountain-air-tonic': ['vital', 'gale', 'stone'],
  'foxfire-drops': ['vital', 'gale', 'umbra'],
  'barrow-balm': ['vital', 'stone', 'umbra'],
  'squall-tonic': ['ember', 'tide', 'gale'],
  'hot-spring-soak': ['ember', 'tide', 'stone'],
  'bog-lantern': ['ember', 'tide', 'umbra'],
  'coal-dark-ward': ['ember', 'stone', 'umbra'],
  'weatherglass-draught': ['tide', 'gale', 'stone'],
  'cavern-pool': ['tide', 'stone', 'umbra'],
  'cairn-whisper': ['gale', 'stone', 'umbra'],
};

describe('trio recipes', () => {
  it('has all 20 trios of three different day essences', () => {
    expect(trios).toHaveLength(20);
  });

  it.each(trios.map((t) => [t.join(' + '), t] as const))('%s matches a recipe in some pool', (_, trio) => {
    const ings = trio.map(plain);
    const found = [...codex.recipes.values()].filter((r) => fillsPattern(ings, r.pattern) && !r.pattern.includes('any'));
    expect(found.length).toBeGreaterThan(0);
  });

  it('adds the eleven missing trios to the base pool at Harmony 4', () => {
    for (const [id, pattern] of Object.entries(NEW_TRIOS)) {
      const r = codex.recipes.get(id);
      expect(r, id).toBeDefined();
      expect(r!.pool, id).toBe('base');
      expect(r!.baseHarmony, id).toBe(4);
      expect([...r!.pattern].sort(), id).toEqual([...pattern].sort());
    }
  });

  it('brews each new trio recipe from a fresh run, with nothing unlocked', () => {
    const s = start('trio-recipes');
    for (const [id, pattern] of Object.entries(NEW_TRIOS)) {
      expect(recipeAvailable(codex.recipes.get(id)!, s), id).toBe(true);
      expect(matchRecipe(pattern.map(plain), s)?.id, id).toBe(id);
    }
  });

  it('every distinct trio brews something once the unlock and friend recipes are in', () => {
    const s = start('trio-recipes');
    const unlocks = [...codex.recipes.values()].filter((r) => r.pool === 'unlock' || r.pool === 'friend').map((r) => r.id);
    for (const trio of trios) expect(matchRecipe(trio.map(plain), { ...s, unlocks }), trio.join(' + ')).not.toBeNull();
  });

  it('leaves only the seven unlock and friend trios as Sludge in a fresh run', () => {
    const s = start('trio-recipes');
    const sludge = trios.filter((t) => matchRecipe(t.map(plain), s) === null).map((t) => t.join('-'));
    expect(sludge).toHaveLength(7);
  });
});
