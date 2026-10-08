import { codex } from '../codex';
import type { PotionFamily } from '../codex/schema';
import { NIGHT_SHIFT_DAY, type Errand, type Order, type OrderBonus, type RunState, type Tier } from '../core';

// Plain words for what the rules engine holds. Pure, so the wording is tested without a browser.

export const TIER_NAME: Record<Tier, string> = { crude: 'Crude', fine: 'Fine', superb: 'Superb', masterwork: 'Masterwork', legendary: 'Legendary' };

export const BONUS_TEXT: Record<OrderBonus, string> = {
  'no-umbra': 'No Umbra ingredients',
  'three-ingredients': 'Brewed with 3 ingredients',
  'wychwood-ingredient': 'Uses a Wychwood ingredient',
};

export const ERRAND_TEXT: Record<Errand, { name: string; text: string }> = {
  market: { name: 'Market Square', text: 'Spend gold on cards, a third cauldron slot or a bigger Shelf.' },
  forage: { name: 'Wychwood Forage', text: 'Pick 2 of 5 wild ingredients, free.' },
  hearth: { name: 'The Hearth', text: 'Burn one card you no longer want.' },
};

const FAMILY_LINE: Record<PotionFamily, string> = {
  healing: 'Something for these aches, please.',
  warming: "I can't get warm. Have you anything for it?",
  calming: "I haven't slept properly in days.",
  vigor: 'I need a little get-up-and-go.',
  protection: 'Something to keep me in one piece?',
  secrets: "Nothing anyone else needs to know about.",
  fortune: 'I could use a bit of luck.',
  illusion: 'I need to look like someone else for an evening.',
  lunar: 'Something that remembers the moon.',
};

export function familyName(f: PotionFamily): string {
  return f[0]!.toUpperCase() + f.slice(1);
}

export function recipeName(id: string): string {
  return codex.recipes.get(id)?.name ?? id;
}

export function cardName(id: string): string {
  return codex.ingredients.get(id)?.name ?? codex.tinctures.get(id)?.name ?? codex.junk.get(id)?.name ?? id;
}

/** What a card does, in one short line, for reward and shop screens. */
export function cardText(id: string): string {
  const ing = codex.ingredients.get(id);
  if (ing) {
    const ess = ing.essences.map((e) => e[0]!.toUpperCase() + e.slice(1)).join(', ');
    return `${ess} · Potency ${ing.potency}${ing.text ? `. ${ing.text}` : ''}`;
  }
  return codex.tinctures.get(id)?.text ?? codex.junk.get(id)?.text ?? '';
}

export function customerName(id: string): string {
  return codex.regulars.get(id)?.name ?? id;
}

export function requestText(order: Pick<Order, 'request'>): string {
  return order.request.kind === 'recipe' ? recipeName(order.request.recipe) : `any ${familyName(order.request.family)} potion`;
}

/** The customer's line, in character (GDD §15: customers speak, the UI states it plainly). */
export function customerLine(order: Pick<Order, 'request'>): string {
  if (order.request.kind === 'recipe') return `A ${recipeName(order.request.recipe)}, if you'd be so kind.`;
  return FAMILY_LINE[order.request.family];
}

export function orderTerms(order: Pick<Order, 'minTier' | 'pay'>): string {
  return `${TIER_NAME[order.minTier]} or better · ${order.pay}g`;
}

export function dayLabel(state: Pick<RunState, 'week' | 'day'>): string {
  return `Week ${state.week} · ${state.day === NIGHT_SHIFT_DAY ? 'Night Shift' : `Day ${state.day}`}`;
}
