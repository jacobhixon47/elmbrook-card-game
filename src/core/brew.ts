import { codex } from '../codex';
import { ESSENCES, type Essence, type Ingredient, type PotionFamily, type Recipe } from '../codex/schema';
import type { GameEvent } from './actions';
import { effectsOf, hasEffect, sumEffect, type ScoreCtx } from './effects';
import { activeEvents, NIGHT_SHIFT_DAY, todaysWeather, type Weather } from './calendar';
import { FAMILIAR_SCORE } from './familiars';
import { hasRelic, relicSteps } from './relics';
import { FROST_WARDEN_POTENCY, HEATWAVE_EMBER_POTENCY, RAIN_POTENCY, tierOf, tierStep, type Tier } from './rules';
import { twistNow } from './night';
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

export type RecipeAccess = Pick<RunState, 'knownRecipes' | 'unlocks'> & Partial<Pick<RunState, 'calendar' | 'week' | 'day'>>;

/**
 * Whether this run can brew a recipe: base-pool recipes always, unlock-pool ones once unlocked,
 * and anything already in the Grimoire. Eclipse and other event recipes only on their Calendar day.
 */
export function recipeAvailable(r: Recipe, s: RecipeAccess): boolean {
  const events = activeEvents(s);
  if (r.eclipseOnly && !events.includes('eclipse')) return false;
  if (s.knownRecipes.includes(r.id)) return true;
  if (r.pool === 'event') return r.event !== undefined && events.includes(r.event);
  return r.pool === 'base' || s.unlocks.includes(r.id);
}

/** How much today's weather adds to one ingredient's Potency. Weather only ever helps, once per card. */
export function weatherPotency(ing: Ingredient, weather: Weather): number {
  if (weather === 'rain') return ing.origin === 'creek' || ing.essences.includes('tide') ? RAIN_POTENCY : 0;
  if (weather === 'heatwave') return ing.essences.includes('ember') ? HEATWAVE_EMBER_POTENCY : 0;
  return 0;
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

/** A card's essences after any weaving (the Hollow Tailor): the woven one replaces the second. */
export function essencesOf(card: Pick<CardInstance, 'card' | 'woven'>): Essence[] {
  const base = codex.ingredients.get(card.card)?.essences ?? [];
  if (!card.woven || base.includes(card.woven)) return [...base];
  return [base[0]!, card.woven];
}

/** The ingredients these cards are, with any woven essence in place. Null if one isn't an ingredient. */
export function ingredientsOf(cards: readonly CardInstance[]): Ingredient[] | null {
  const out: Ingredient[] = [];
  for (const c of cards) {
    const ing = codex.ingredients.get(c.card);
    if (!ing) return null;
    out.push(c.woven ? { ...ing, essences: essencesOf(c) } : ing);
  }
  return out;
}

/**
 * What brewing these cards would make, with every scoring step (GDD §6.3). Pure; used by the
 * cauldron preview, the bot and `brew` itself, so the preview is never wrong.
 */
export type BrewState = Pick<RunState, 'knownRecipes' | 'unlocks' | 'pending' | 'week' | 'day' | 'calendar' | 'brewsToday' | 'orders'> & Partial<Pick<RunState, 'patrons' | 'familiars' | 'shelf' | 'relics' | 'curses'>>;

export function previewBrew(state: BrewState, cards: readonly CardInstance[], hand: readonly CardInstance[]): BrewPreview {
  const raw = ingredientsOf(cards);
  if (!raw || raw.length < 2) return { kind: 'empty' };
  // Moth Swarm: every ingredient also counts as Lunar for this brew.
  const swarm = state.pending.allLunar ? raw.map((i) => (i.essences.includes('lunar') ? i : { ...i, essences: [...i.essences, 'lunar' as const] })) : raw;
  // The Moth familiar: Lunar ingredients count as every essence.
  const ings = state.familiars?.includes('moth') ? swarm.map((i) => (i.essences.includes('lunar') ? { ...i, essences: [...ESSENCES] } : i)) : swarm;
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

  // Today's weather (GDD §4.2): Rain helps Creek and Tide ingredients; a Heatwave helps Ember.
  const weather = todaysWeather(state);
  const shift = ings.reduce((n, ing) => n + weatherPotency(ing, weather), 0);
  if (shift !== 0) {
    c.potency = Math.max(0, c.potency + shift);
    steps.push({ type: 'scoreStep', source: 'weather', id: weather, potency: c.potency, harmony: c.harmony, note: `${shift > 0 ? '+' : ''}${shift} Potency` });
  }

  // Relics and curses that change ingredients (the Pressed Flower, the Copper Ladle, Moonsick).
  for (const { id, source, step } of relicSteps(state, raw)) {
    c.potency = Math.max(0, c.potency + step.potency);
    c.harmony += step.harmony;
    steps.push({ type: 'scoreStep', source, id, potency: c.potency, harmony: c.harmony, note: step.note });
  }

  // Tonight's patron (GDD §10): Sir Bramble douses Ember, the Frost Warden chills the rest.
  const twist = twistNow(state);
  if (twist === 'ember-zero' || twist === 'non-frost-minus-2') {
    let cut = 0;
    cards.forEach((card, i) => {
      const ing = raw[i]!;
      if (twist === 'ember-zero' && ing.essences.includes('ember')) cut += ing.potency + (card.bonus ?? 0) + (hasEffect(ing.id, 'aged') ? card.aged ?? 0 : 0) + weatherPotency(ing, weather);
      if (twist === 'non-frost-minus-2' && !ing.tags.includes('frost')) cut += -FROST_WARDEN_POTENCY;
    });
    if (cut > 0) {
      c.potency = Math.max(0, c.potency - cut);
      steps.push({ type: 'scoreStep', source: 'patron', id: twist, potency: c.potency, harmony: c.harmony, note: `-${cut} Potency` });
    }
  }

  // Junk in hand that drags every brew down (Bad Omen).
  const drag = hand.reduce((n, card) => n + sumEffect(card.card, 'inHandHarmony'), 0);
  if (drag !== 0) {
    c.harmony = Math.max(1, c.harmony + drag);
    steps.push({ type: 'scoreStep', source: 'curse', id: 'in-hand', potency: c.potency, harmony: c.harmony, note: `${drag} Harmony` });
  }

  // 2. Tinctures played before this brew: flat bonuses, then multipliers.
  const p = state.pending;
  // Howl: every ingredient gets Potency for each Lunar card in the brew.
  const howl = p.lunarPotency * ings.length * raw.filter((i) => i.essences.includes('lunar')).length;
  if (p.harmony !== 0 || p.potency !== 0 || howl !== 0 || p.potencyMult !== 1 || p.harmonyMult !== 1) {
    c.potency = Math.floor((c.potency + p.potency + howl) * p.potencyMult);
    c.harmony = (c.harmony + p.harmony) * p.harmonyMult;
    steps.push({ type: 'scoreStep', source: 'tincture', id: 'pending', potency: c.potency, harmony: c.harmony });
  }

  // 3. Card modifiers resolve here once they exist (M3 part 5).

  // 4. Familiars, in slot order (GDD §11): a flat bonus before a multiplier gets multiplied.
  const first = cards[0]!;
  const familiarBrew = {
    ingredients: raw,
    firstPotency: raw[0]!.potency + (first.bonus ?? 0) + (hasEffect(raw[0]!.id, 'aged') ? first.aged ?? 0 : 0),
    shelf: state.shelf?.length ?? 0,
    night: state.day === NIGHT_SHIFT_DAY,
    firstBrew: c.firstBrew,
  };
  for (const id of state.familiars ?? []) {
    const step = FAMILIAR_SCORE[id]?.(familiarBrew);
    if (!step) continue;
    c.potency += step.potency;
    c.harmony = (c.harmony + step.harmony) * step.harmonyMult;
    steps.push({ type: 'scoreStep', source: 'familiar', id, potency: c.potency, harmony: c.harmony, note: step.note });
  }

  // 5. The cauldron resolves here once cauldrons exist (M4's run starts).

  // Harmony can be fractional after a ×1.5; quality rounds down.
  const quality = Math.floor(c.potency * c.harmony);
  const known = state.knownRecipes.includes(recipe.id);
  // An Experiment discovers the recipe but brews one tier lower (GDD §6.2), unless a Grimoire Page helps.
  const tier = known || p.fullExperiment || hasRelic(state, 'witchs-hatpin') ? tierOf(quality) : tierStep(tierOf(quality), -1);
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
