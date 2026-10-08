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

export type RecipeAccess = Pick<RunState, 'knownRecipes' | 'unlocks'>;

/**
 * Whether this run can brew a recipe: base-pool recipes always, unlock-pool ones once unlocked,
 * and anything already in the Grimoire. Eclipse and other event recipes wait for their event (M3 Calendar).
 */
export function recipeAvailable(r: Recipe, s: RecipeAccess): boolean {
  if (s.knownRecipes.includes(r.id)) return true;
  if (r.eclipseOnly || r.pool === 'event') return false;
  return r.pool === 'base' || s.unlocks.includes(r.id);
}

const anySlots = (r: Recipe) => r.pattern.filter((e) => e === 'any').length;

/**
 * The recipe these ingredients brew, if any. When several match, the most specific pattern wins
 * (fewest "any" slots), then the highest base Harmony, then a recipe you already know, then codex order.
 */
export function matchRecipe(ings: readonly Ingredient[], s: RecipeAccess): Recipe | null {
  let best: Recipe | null = null;
  const rank = (r: Recipe) => [-anySlots(r), r.baseHarmony, s.knownRecipes.includes(r.id) ? 1 : 0];
  for (const r of codex.recipes.values()) {
    if (!recipeAvailable(r, s) || !fillsPattern(ings, r.pattern)) continue;
    if (!best) {
      best = r;
      continue;
    }
    const [a, b] = [rank(r), rank(best)];
    const i = a.findIndex((v, k) => v !== b[k]);
    if (i >= 0 && a[i]! > b[i]!) best = r;
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
export type BrewState = Pick<RunState, 'knownRecipes' | 'unlocks' | 'pending' | 'week' | 'brewsToday' | 'orders'>;

export function previewBrew(state: BrewState, cards: readonly CardInstance[], hand: readonly CardInstance[]): BrewPreview {
  const ings = ingredientsOf(cards);
  if (!ings || ings.length < 2) return { kind: 'empty' };
  const discardCost = cards.reduce((n, c) => n + sumEffect(c.card, 'discardCost'), 0);
  const recipe = matchRecipe(ings, state);
  if (!recipe) return { kind: 'sludge', discardCost };

  const steps: ScoreStep[] = [];
  const c: ScoreCtx = {
    potency: 0,
    harmony: recipe.baseHarmony,
    recipe,
    ingredients: ings,
    hand,
    week: state.week,
    firstBrew: state.brewsToday === 0,
    filledToday: state.orders.filter((o) => o.status === 'filled').length,
  };
  steps.push({ type: 'scoreStep', source: 'recipe', id: recipe.id, potency: 0, harmony: c.harmony });

  // 1. Ingredients, in slot order.
  cards.forEach((card, i) => {
    const ing = ings[i]!;
    const notes: string[] = [];
    c.potency += ing.potency;
    if (card.bonus) {
      c.potency += card.bonus;
      notes.push(`Infused +${card.bonus}`);
    }
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

  // Junk in hand that drags every brew down (Bad Omen).
  const drag = hand.reduce((n, card) => n + sumEffect(card.card, 'inHandHarmony'), 0);
  if (drag !== 0) {
    c.harmony = Math.max(1, c.harmony + drag);
    steps.push({ type: 'scoreStep', source: 'curse', id: 'in-hand', potency: c.potency, harmony: c.harmony, note: `${drag} Harmony` });
  }

  // 2. Tinctures played before this brew: flat bonuses, then multipliers.
  const p = state.pending;
  if (p.harmony !== 0 || p.potency !== 0 || p.potencyMult !== 1 || p.harmonyMult !== 1) {
    c.potency = Math.floor((c.potency + p.potency) * p.potencyMult);
    c.harmony = (c.harmony + p.harmony) * p.harmonyMult;
    steps.push({ type: 'scoreStep', source: 'tincture', id: 'pending', potency: c.potency, harmony: c.harmony });
  }

  // 3-5. Card modifiers, familiars and the cauldron resolve here once they exist (M3).

  // Harmony can be fractional after a ×1.5; quality rounds down.
  const quality = Math.floor(c.potency * c.harmony);
  const known = state.knownRecipes.includes(recipe.id);
  // An Experiment discovers the recipe but brews one tier lower (GDD §6.2), unless a Grimoire Page helps.
  const tier = known || p.fullExperiment ? tierOf(quality) : tierStep(tierOf(quality), -1);
  const copies = Math.max(p.copies, ...cards.flatMap((card) => effectsOf(card.card).map((e) => e.copies ?? 1)));
  return {
    kind: 'potion',
    recipe: recipe.id,
    family: recipe.family,
    known,
    potency: c.potency,
    harmony: c.harmony,
    quality,
    tier,
    copies,
    discardCost,
    steps,
  };
}
