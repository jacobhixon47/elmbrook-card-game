import { cardKind, codex } from '../codex';
import type { Recipe } from '../codex/schema';
import {
  BREWS_PER_DAY, DAYS_PER_WEEK, DISCARDS_PER_DAY, NIGHT_SHIFT_DAY, RENT, WEEKS, type RunState,
} from '../core';
import { recipeAvailable } from '../core/brew';
import { familyName } from './describe';
import { GLOSSARY, tierLadder } from './inspect';

// What the Grimoire and the stage ribbon show (GDD §15.1). Pure, so tests can check it.

export type Mark = 'done' | 'now' | 'next';
export type Stage = { label: string; mark: Mark };

/** The days of this week and the steps of today, each marked done, now or next. */
export function stages(s: Pick<RunState, 'day' | 'phase' | 'offer'>): { days: Stage[]; steps: Stage[] } {
  const days = Array.from({ length: NIGHT_SHIFT_DAY }, (_, i): Stage => ({
    label: i + 1 === NIGHT_SHIFT_DAY ? 'Night' : String(i + 1),
    mark: i + 1 < s.day ? 'done' : i + 1 === s.day ? 'now' : 'next',
  }));
  const night = s.day === NIGHT_SHIFT_DAY;
  const labels = ['Orders', 'Brew', 'Twilight', night ? 'Night Market' : 'Errand'];
  const at = s.phase === 'morning' ? 0
    : s.phase === 'brewing' ? 1
      : s.phase === 'night-market' ? 3
        : s.phase === 'dusk' ? (s.offer?.kind === 'reward' ? 2 : 3)
          : 4;
  return { days, steps: labels.map((label, i) => ({ label, mark: i < at ? 'done' : i === at ? 'now' : 'next' })) };
}

export type RecipeRow = {
  id: string;
  known: boolean;
  name: string;
  /** The essence pattern, hidden until the recipe is known. */
  pattern: Recipe['pattern'] | null;
  slots: number;
  harmony: number | null;
  family: string | null;
  note: string;
};

/** Every recipe this run can brew: known ones in full, the rest as "???" with their size. */
export function recipeRows(s: Pick<RunState, 'knownRecipes' | 'unlocks' | 'cauldronSlots'>): RecipeRow[] {
  return [...codex.recipes.values()].filter((r) => recipeAvailable(r, s)).map((r) => {
    const known = s.knownRecipes.includes(r.id);
    const big = r.pattern.length > s.cauldronSlots;
    const note = big ? `Needs ${r.pattern.length} cauldron slots.` : known ? '' : 'Brew the right essences to discover it.';
    return {
      id: r.id,
      known,
      name: known ? r.name : '???',
      pattern: known ? [...r.pattern] : null,
      slots: r.pattern.length,
      harmony: known ? r.baseHarmony : null,
      family: known ? familyName(r.family) : null,
      note,
    };
  }).sort((a, b) => Number(b.known) - Number(a.known) || a.slots - b.slots);
}

/** One line on what is left to discover, by size. */
export function undiscoveredLine(rows: readonly RecipeRow[], cauldronSlots: number): string {
  const left = rows.filter((r) => !r.known);
  if (left.length === 0) return 'You have found every recipe you can brew this run.';
  const bySize = new Map<number, number>();
  for (const r of left) bySize.set(r.slots, (bySize.get(r.slots) ?? 0) + 1);
  const words = ['', 'one', 'two', 'three', 'four'];
  const parts = [...bySize].sort((a, b) => a[0] - b[0]).map(([n, k]) => `${k} with ${words[n] ?? n} ingredients${n > cauldronSlots ? ` (needs ${n} cauldron slots)` : ''}`);
  return `Still to discover: ${parts.join(', ')}. Brew the right essences to discover them.`;
}

export type DeckRow = { card: string; total: number; inDraw: number };

const KIND_ORDER = { ingredient: 0, tincture: 1, junk: 2 } as const;

/** The run's cards grouped by kind, with how many of each are still in the draw pile. */
export function deckRows(s: Pick<RunState, 'drawPile' | 'hand' | 'discardPile' | 'cauldron'>): DeckRow[] {
  const rows = new Map<string, DeckRow>();
  const add = (card: string, draw: boolean) => {
    const r = rows.get(card) ?? { card, total: 0, inDraw: 0 };
    r.total++;
    if (draw) r.inDraw++;
    rows.set(card, r);
  };
  for (const c of s.drawPile) add(c.card, true);
  for (const c of [...s.hand, ...s.discardPile, ...s.cauldron]) add(c.card, false);
  return [...rows.values()].sort((a, b) => KIND_ORDER[cardKind(a.card)] - KIND_ORDER[cardKind(b.card)] || a.card.localeCompare(b.card));
}

/** The Guide tab: how a run, a day and a brew work, then the glossary. */
export function guideSections(): { title: string; body: string }[] {
  return [
    {
      title: 'A run',
      body: `${WEEKS} weeks. Each has ${DAYS_PER_WEEK} days, then a Night Shift. After the Night Shift the Night Market opens and the Guild collects rent: ${RENT.join(', ')} gold. Miss a payment and the run is over; pay all ${WEEKS} and the stall is yours. The Calendar tab shows each day's weather, the week 3 festival and any sky event.`,
    },
    {
      title: 'A day',
      body: `Orders: read what customers want. Brew: you have ${BREWS_PER_DAY} Brews and ${DISCARDS_PER_DAY} Discards for the whole day. Twilight: take a card for your deck, or skip it for gold. Errand: shop at the Market, forage, or burn a card at the Hearth.`,
    },
    {
      title: 'Brewing',
      body: 'Put ingredients in the cauldron. If their essences match a recipe you know, you get that potion. A match you don\'t know yet is an Experiment: it teaches you the recipe at one tier lower. No match makes Sludge. A potion goes to the order it fills best, or onto the Shelf for later.',
    },
    { title: 'Quality', body: `Potency × Harmony. ${tierLadder()}. An order names the lowest tier it accepts; better tiers pay more.` },
    { title: 'Glossary', body: Object.entries(GLOSSARY).map(([t, d]) => `${t}: ${d}`).join('\n') },
  ];
}
