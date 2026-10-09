import { codex } from '../codex';
import type { Ingredient, ModifierId } from '../codex/schema';
import type { GameEvent } from './actions';
import { changeGold, reject, type Ctx } from './ctx';
import { effectsOf, hasEffect, sumEffect, type ScoreCtx } from './effects';
import { allCards, type CardInstance, type RunState } from './state';

// Card modifiers (GDD §5.5): Balatro-style editions on one ingredient card each, for the run. The
// Creek Bank sells them (or tempers a card for free), the Name-Taker deals a Rare card with the
// Cursed one, and the Fortune Tent's Wheel of Fortune blesses a card.

export const MODIFIER_RULES = {
  moonlitHarmony: 2,
  gildedGold: 2,
  cursedHearts: -1,
  /** The Creek Bank's free option: permanent Potency on one card. */
  temperPotency: 2,
} as const;

type ScoreStep = Extract<GameEvent, { type: 'scoreStep' }>;

/** Aged by its own effect (Amber Sap) or by the modifier. */
export function isAged(card: Pick<CardInstance, 'card' | 'modifier'>): boolean {
  return card.modifier === 'aged' || hasEffect(card.card, 'aged');
}

/** One card's own Potency in a brew: printed, Infused or tempered, and Aged days. */
export function cardPotency(card: CardInstance, ing: Pick<Ingredient, 'potency'> = codex.ingredients.get(card.card) ?? { potency: 0 }): number {
  return ing.potency + (card.bonus ?? 0) + (isAged(card) ? card.aged ?? 0 : 0);
}

/** Why this card can't take this modifier, or null when it can. */
export function cantModify(card: Pick<CardInstance, 'card' | 'modifier'>, modifier: ModifierId): string | null {
  const ing = codex.ingredients.get(card.card);
  if (!ing) return 'only ingredients take a modifier';
  if (card.modifier) return `it is already ${codex.modifiers.get(card.modifier)!.name}`;
  if (modifier === 'aged' && hasEffect(card.card, 'aged')) return `${ing.name} is already Aged`;
  return null;
}

/** Deck cards that could take this modifier. */
export function modifiable(s: RunState, modifier: ModifierId): CardInstance[] {
  return allCards(s).filter((c) => cantModify(c, modifier) === null);
}

export function addModifier(ctx: Ctx, card: CardInstance, modifier: ModifierId, by: string): void {
  const why = cantModify(card, modifier);
  if (why) reject(why);
  card.modifier = modifier;
  ctx.ev.push({ type: 'cardModified', uid: card.uid, card: card.card, modifier, by });
}

/** Step 3 of scoring (GDD §6.3): each modified card in slot order. Mutates the running totals. */
export function modifierSteps(c: ScoreCtx, cards: readonly CardInstance[], ings: readonly Ingredient[]): ScoreStep[] {
  const steps: ScoreStep[] = [];
  cards.forEach((card, i) => {
    const ing = ings[i]!;
    let note: string;
    switch (card.modifier) {
      case 'moonlit':
        c.harmony += MODIFIER_RULES.moonlitHarmony;
        note = `+${MODIFIER_RULES.moonlitHarmony} Harmony`;
        break;
      case 'cursed': {
        const n = cardPotency(card, ing);
        c.potency += n;
        note = `+${n} Potency`;
        break;
      }
      case 'blessed': {
        // A retrigger: the card's Potency again, then its effects again.
        const n = cardPotency(card, ing);
        c.potency += n;
        const notes = [`+${n} Potency`];
        for (const e of effectsOf(ing.id)) {
          const more = e.onScore?.(c);
          if (more) notes.push(more);
        }
        note = notes.join(', ');
        break;
      }
      default:
        // Aged and Gilded don't touch the score here: Aged counts with the ingredient, Gilded pays on brewing.
        return;
    }
    steps.push({ type: 'scoreStep', source: 'modifier', id: card.modifier, potency: c.potency, harmony: c.harmony, note: `${ing.name}: ${note}` });
  });
  return steps;
}

/** How many times a card's own effects happen in a brew: twice when Blessed. */
const times = (card: CardInstance) => (card.modifier === 'blessed' ? 2 : 1);

/** Hearts a brewed potion adds or costs on delivery, from its cards (Heartstone, Grave Moss, Cursed). */
export function heartDeltaOf(cards: readonly CardInstance[]): number {
  return cards.reduce((n, c) => n + sumEffect(c.card, 'heartDelta') * times(c) + (c.modifier === 'cursed' ? MODIFIER_RULES.cursedHearts : 0), 0);
}

/** Cards drawn after a brew, from its cards. */
export function drawOnBrewOf(cards: readonly CardInstance[]): number {
  return cards.reduce((n, c) => n + sumEffect(c.card, 'drawOnBrew') * times(c), 0);
}

/** Gilded cards pay when brewed, Sludge or not. */
export function payGilded(ctx: Ctx, cards: readonly CardInstance[]): void {
  const n = cards.filter((c) => c.modifier === 'gilded').length * MODIFIER_RULES.gildedGold;
  if (n) changeGold(ctx, n, 'modifier');
}

// ------------------------------------------------------------------ the Creek Bank

function creekCard(ctx: Ctx, uid: number): CardInstance {
  const offer = ctx.s.offer;
  if (offer?.kind !== 'creek') reject('you are not at the Creek Bank');
  if (offer.done) reject('the Creek Bank does one card a visit');
  const card = allCards(ctx.s).find((c) => c.uid === uid);
  if (!card) reject(`card ${uid} is not in the deck`);
  return card;
}

/** The free option: +2 Potency on one ingredient for the run. */
export function temper(ctx: Ctx, uid: number): void {
  const card = creekCard(ctx, uid);
  if (!codex.ingredients.has(card.card)) reject('only ingredients can be tempered');
  card.bonus = (card.bonus ?? 0) + MODIFIER_RULES.temperPotency;
  ctx.ev.push({ type: 'cardInfused', uid, bonus: card.bonus });
  (ctx.s.offer as { done: boolean }).done = true;
}

/** The paid option: a modifier on one ingredient. */
export function enchant(ctx: Ctx, uid: number, modifier: ModifierId): void {
  const card = creekCard(ctx, uid);
  const price = codex.modifiers.get(modifier)?.price ?? null;
  if (price === null) reject(`the Creek Bank doesn't sell ${modifier}`);
  if (ctx.s.gold < price) reject('not enough gold');
  addModifier(ctx, card, modifier, 'creek');
  changeGold(ctx, -price, 'creek');
  (ctx.s.offer as { done: boolean }).done = true;
}
