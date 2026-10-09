import { cardKind, codex } from '../codex';
import type { Essence } from '../codex/schema';
import { BREWS_PER_DAY, DISCARDS_PER_DAY, MAX_DISCARD, TIER_MIN, TIERS, type CardInstance } from '../core';

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
  Hearts: 'Hearts are a customer\'s fondness for you. Bonuses earn them.',
};

export type CardInfo = {
  title: string;
  kind: string;
  essences: Essence[];
  potency: number | null;
  text: string;
  terms: [string, string][];
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** What this copy carries beyond the printed card: a modifier, Infused or tempered Potency. */
export type CardExtras = Partial<Pick<CardInstance, 'modifier' | 'bonus'>>;

export function cardInfo(id: string, extras: CardExtras = {}): CardInfo {
  const kind = cardKind(id);
  if (kind === 'ingredient') {
    const ing = codex.ingredients.get(id)!;
    const essences = ing.essences.map(cap).join(' and ');
    const lines = [`${essences} essence${ing.essences.length > 1 ? 's' : ''}. Potency ${ing.potency}${extras.bonus ? ` (+${extras.bonus} on this copy)` : ''}.`];
    if (ing.text) lines.push(ing.text);
    const mod = extras.modifier && codex.modifiers.get(extras.modifier);
    if (mod) lines.push(`${mod.name}: ${mod.text}`);
    if (ing.nightOnly) lines.push('Kept in your Night Satchel: Night Shifts only.');
    const text = lines.join(' ');
    return {
      title: ing.name,
      kind: `${cap(ing.rarity)} ingredient · ${cap(ing.origin)}${ing.tags.length ? ` · ${ing.tags.map(cap).join(', ')}` : ''}`,
      essences: ing.essences,
      potency: ing.potency,
      text,
      terms: termsIn(`Essence Potency ${text}`),
    };
  }
  if (kind === 'tincture') {
    const t = codex.tinctures.get(id)!;
    if (t.rarity === 'lunar') {
      const text = `${t.text} Kept in your Night Satchel: Night Shifts only.`;
      return { title: t.name, kind: 'Omen · Lunar tincture', essences: [], potency: null, text, terms: termsIn(`Omen Tincture ${text}`) };
    }
    return { title: t.name, kind: `${cap(t.rarity)} tincture`, essences: [], potency: null, text: t.text, terms: termsIn(`Tincture ${t.text}`) };
  }
  const j = codex.junk.get(id)!;
  return { title: j.name, kind: 'Junk', essences: [], potency: null, text: j.text, terms: termsIn(`${j.name} ${j.text}`) };
}

/** Glossary entries for the terms a text mentions, in glossary order, at most three. */
export function termsIn(text: string): [string, string][] {
  return Object.entries(GLOSSARY).filter(([term]) => new RegExp(`\\b${term.replace(/s$/, '')}`, 'i').test(text)).slice(0, 3);
}

/** "Crude under 10 · Fine 10+ · ..." for the Guide and the preview tooltip. */
export function tierLadder(): string {
  return TIERS.map((t, i) => (i === 0 ? `${cap(t)} under ${TIER_MIN[TIERS[1]!]}` : `${cap(t)} ${TIER_MIN[t]}+`)).join(' · ');
}
