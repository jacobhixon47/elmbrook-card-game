import { TAG_GLYPHS } from '../art/procedural';
import { cardKind, codex } from '../codex';
import { lore } from '../codex/lore';
import type { Essence } from '../codex/schema';
import { BREWS_PER_DAY, cardPotency, DISCARDS_PER_DAY, isAged, MAX_DISCARD, MODIFIER_RULES, TIER_MIN, TIERS, type CardInstance } from '../core';
import type { ModifierId } from '../codex/schema';

// What a hovered card says about itself (GDD §15.1). Pure, so tests can read every card.

/** One-line definitions of the game's terms, shown under any card text that uses them. */
export const GLOSSARY: Record<string, string> = {
  Essence: 'The coloured dots. Recipes ask for essences, not particular ingredients.',
  Potency: 'The number in the corner. A brew adds up its ingredients\' Potency.',
  Harmony: 'Set by the recipe, raised by cards. Quality = Potency × Harmony.',
  Quality: 'Potency × Harmony. Higher quality reaches a better tier and pays more.',
  Tincture: 'Played from your hand for an effect. Takes no cauldron slot and no Brew.',
  Brew: `You get ${BREWS_PER_DAY} Brews a day. Each one turns the cauldron into a potion.`,
  Discard: `You get ${DISCARDS_PER_DAY} a day. Throw away 1-${MAX_DISCARD} cards and draw that many.`,
  Aged: 'Gains Potency each day it stays in your deck; resets when brewed.',
  Sludge: 'What a mix that matches no recipe makes. A junk card that does nothing.',
  Hearth: 'An evening errand where you burn one card from your deck.',
  Lunar: 'Moonlight essence. Lunar cards live in the Night Satchel and only come out on Night Shifts.',
  Satchel: 'The Night Satchel: Lunar cards and Omens, shuffled into your deck only on Night Shifts.',
  Omen: 'A Night Satchel Tincture: strong, with a drawback.',
  Friendship: 'How close a regular is to you. Every delivery adds to it, bonuses more, and it lasts the whole save.',
};

export type CardInfo = {
  title: string;
  kind: string;
  essences: Essence[];
  /** Tags the rules read, shown in their marks' colours (Jacob, Oct 17); other tags stay in `kind`. */
  tags: string[];
  potency: number | null;
  text: string;
  terms: [string, string][];
  /** A line of Elmbrook (codex lore), shown under the rules. */
  lore: string | null;
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** What this copy carries beyond the printed card: a modifier, Infused Potency and Aged days. */
export type CardExtras = Partial<Pick<CardInstance, 'modifier' | 'bonus' | 'aged'>>;

/** One addition to a card's printed Potency, written in its own colour (Jacob, Oct 21). */
export type PotencyPart = { amount: number; tone: ModifierId | 'infused' };

/**
 * A copy's Potency as the printed number plus what was done to it: Infused, then its modifier's share
 * (Tempered's +2, Aged's days so far, or the second count from Blessed or Cursed). Moonlit adds Harmony, not Potency.
 */
export function potencyParts(id: string, extras: CardExtras = {}): { base: number; parts: PotencyPart[] } {
  const ing = codex.ingredients.get(id);
  if (!ing) return { base: 0, parts: [] };
  const parts: PotencyPart[] = [];
  const infused = extras.bonus ?? 0;
  if (infused) parts.push({ amount: infused, tone: 'infused' });
  const aged = isAged({ card: id, modifier: extras.modifier }) ? extras.aged ?? 0 : 0;
  const own = cardPotency({ uid: 0, card: id, ...extras } as CardInstance, ing);
  switch (extras.modifier) {
    case 'tempered': parts.push({ amount: MODIFIER_RULES.temperPotency, tone: 'tempered' }); break;
    case 'blessed': case 'cursed': if (aged) parts.push({ amount: aged, tone: 'aged' }); parts.push({ amount: own, tone: extras.modifier }); break;
    default: if (aged) parts.push({ amount: aged, tone: 'aged' });
  }
  return { base: ing.potency, parts };
}

/** What each addition is called, and what it is, for the tooltip. */
export function extraLines(id: string, extras: CardExtras = {}): { tone: ModifierId | 'infused'; text: string }[] {
  if (!codex.ingredients.has(id)) return [];
  const out: { tone: ModifierId | 'infused'; text: string }[] = [];
  if (extras.bonus) out.push({ tone: 'infused', text: `Infused: +${extras.bonus} Potency on this copy.` });
  const mod = extras.modifier && codex.modifiers.get(extras.modifier);
  if (mod) out.push({ tone: mod.id, text: `${mod.name}: ${mod.text}` });
  else if (isAged({ card: id })) out.push({ tone: 'aged', text: 'Aged: gains Potency each day in the deck.' });
  return out;
}

export function cardInfo(id: string): CardInfo {
  const kind = cardKind(id);
  if (kind === 'ingredient') {
    const ing = codex.ingredients.get(id)!;
    const essences = ing.essences.map(cap).join(' and ');
    const lines = [`${essences} essence${ing.essences.length > 1 ? 's' : ''}.`];
    if (ing.text) lines.push(ing.text);
    if (ing.nightOnly) lines.push('Kept in your Night Satchel: Night Shifts only.');
    const text = lines.join(' ');
    const ruled = Object.keys(TAG_GLYPHS).filter((t) => ing.tags.includes(t));
    const other = ing.tags.filter((t) => !ruled.includes(t));
    return {
      title: ing.name,
      kind: `${cap(ing.rarity)} ingredient · ${cap(ing.origin)}${other.length ? ` · ${other.map(cap).join(', ')}` : ''}`,
      essences: ing.essences,
      tags: ruled,
      potency: ing.potency,
      text,
      terms: termsIn(text),
      lore: lore[id] ?? null,
    };
  }
  if (kind === 'tincture') {
    const t = codex.tinctures.get(id)!;
    if (t.rarity === 'lunar') {
      const text = `${t.text} Kept in your Night Satchel: Night Shifts only.`;
      return { title: t.name, kind: 'Omen · Lunar tincture', essences: [], tags: [], potency: null, text, terms: termsIn(`Omen ${text}`), lore: lore[id] ?? null };
    }
    return { title: t.name, kind: `${cap(t.rarity)} tincture`, essences: [], tags: [], potency: null, text: t.text, terms: termsIn(t.text), lore: lore[id] ?? null };
  }
  const j = codex.junk.get(id)!;
  return { title: j.name, kind: 'Junk', essences: [], tags: [], potency: null, text: j.text, terms: termsIn(`${j.name} ${j.text}`), lore: lore[id] ?? null };
}

/**
 * Terms every card uses: the Guide's glossary explains them once, and card tooltips leave them out
 * (Jacob, Oct 16: an Essence and Potency definition on every card was noise).
 */
export const EVERYDAY_TERMS: readonly string[] = ['Essence', 'Potency', 'Harmony', 'Quality', 'Tincture', 'Brew', 'Discard'];

/** Glossary entries for the rarer terms a text mentions, in glossary order, at most three. */
export function termsIn(text: string): [string, string][] {
  return Object.entries(GLOSSARY)
    .filter(([term]) => !EVERYDAY_TERMS.includes(term) && new RegExp(`\\b${term.replace(/s$/, '')}`, 'i').test(text))
    .slice(0, 3);
}

/** "Crude under 10 · Fine 10+ · ..." for the Guide and the preview tooltip. */
export function tierLadder(): string {
  return TIERS.map((t, i) => (i === 0 ? `${cap(t)} under ${TIER_MIN[TIERS[1]!]}` : `${cap(t)} ${TIER_MIN[t]}+`)).join(' · ');
}
