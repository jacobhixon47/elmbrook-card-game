import { codex } from '../codex';
import type { Ingredient, PotionFamily, Recipe } from '../codex/schema';
import type { GameEvent } from './actions';
import { effectsOf, hasEffect, sumEffect, type ScoreCtx } from './effects';
import { tierOf, tierStep, type Tier } from './rules';
import type { CardInstance, RunState } from './state';

type ScoreStep = Extract<GameEvent, { type: 'scoreStep' }>;

export type BrewPreview =
  | { kind: 'empty' }
  | { kind: 'sludge'; discardCost: number }
  | {
      kind: 'potion';
      recipe: string;
      family: PotionFamily;
      known: boolean;
      potency: number;
      harmony: number;
      quality: number;
      tier: Tier;
      copies: number;
      discardCost: number;
      steps: ScoreStep[];
    };

const PERMS: Record<number, number[][]> = {
  2: [[0, 1], [1, 0]],
  3: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]],
};

/** Can these ingredients fill the pattern, one ingredient per slot, in any order? */
export function fillsPattern(ings: readonly Ingredient[], pattern: Recipe['pattern']): boolean {
  if (ings.length !== pattern.length) return false;
  const perms = PERMS[ings.length];
  if (!perms) return false;
  return perms.some((perm) =>
    perm.every((ii, slot) => {
      const ing = ings[ii]!;
      const want = pattern[slot]!;
      return want === 'any' || ing.essences.includes(want) || hasEffect(ing.id, 'wild');
    }),
  );
}

/**
 * The recipe these ingredients brew, if any. When several match, the highest base Harmony wins,
 * then a recipe you already know, then codex order.
 */
export function matchRecipe(ings: readonly Ingredient[], known: readonly string[]): Recipe | null {
  let best: Recipe | null = null;
  for (const r of codex.recipes.values()) {
    if (!fillsPattern(ings, r.pattern)) continue;
    if (!best || r.baseHarmony > best.baseHarmony || (r.baseHarmony === best.baseHarmony && known.includes(r.id) && !known.includes(best.id))) {
      best = r;
    }
  }
  return best;
}

export function ingredientsOf(cards: readonly CardInstance[]): Ingredient[] | null {
  const out: Ingredient[] = [];
  for (const c of cards) {
    const ing = codex.ingredients.get(c.card);
    if (!ing) return null;
    out.push(ing);
  }
  return out;
}

/**
 * What brewing these cards would make, with every scoring step (GDD §6.3). Pure; used by the
 * cauldron preview, the bot and `brew` itself, so the preview is never wrong.
 */
export function previewBrew(
  state: Pick<RunState, 'knownRecipes' | 'pending'>,
  cards: readonly CardInstance[],
  hand: readonly CardInstance[],
): BrewPreview {
  const ings = ingredientsOf(cards);
  if (!ings || ings.length < 2) return { kind: 'empty' };
  const discardCost = cards.reduce((n, c) => n + sumEffect(c.card, 'discardCost'), 0);
  const recipe = matchRecipe(ings, state.knownRecipes);
  if (!recipe) return { kind: 'sludge', discardCost };

  const steps: ScoreStep[] = [];
  const c: ScoreCtx = { potency: 0, harmony: recipe.baseHarmony, ingredients: ings, hand };
  steps.push({ type: 'scoreStep', source: 'recipe', id: recipe.id, potency: 0, harmony: c.harmony });

  // 1. Ingredients, in slot order.
  cards.forEach((card, i) => {
    const ing = ings[i]!;
    const notes: string[] = [];
    c.potency += ing.potency;
    if (hasEffect(ing.id, 'aged') && card.aged) {
      c.potency += card.aged;
      notes.push(`Aged +${card.aged}`);
    }
    for (const e of effectsOf(ing.id)) {
      const note = e.onScore?.(c);
      if (note) notes.push(note);
    }
    steps.push({ type: 'scoreStep', source: 'ingredient', id: ing.id, potency: c.potency, harmony: c.harmony, ...(notes.length ? { note: notes.join(', ') } : {}) });
  });

  // 2. Tinctures played before this brew.
  const { harmony, potencyMult } = state.pending;
  if (harmony !== 0 || potencyMult !== 1) {
    c.harmony += harmony;
    c.potency = Math.floor(c.potency * potencyMult);
    steps.push({ type: 'scoreStep', source: 'tincture', id: 'pending', potency: c.potency, harmony: c.harmony });
  }

  // 3-5. Card modifiers, familiars and the cauldron resolve here once they exist (M3).

  const quality = c.potency * c.harmony;
  const known = state.knownRecipes.includes(recipe.id);
  // An Experiment discovers the recipe but brews one tier lower (GDD §6.2).
  const tier = known ? tierOf(quality) : tierStep(tierOf(quality), -1);
  return {
    kind: 'potion',
    recipe: recipe.id,
    family: recipe.family,
    known,
    potency: c.potency,
    harmony: c.harmony,
    quality,
    tier,
    copies: state.pending.copies,
    discardCost,
    steps,
  };
}
