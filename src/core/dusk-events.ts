import { codex } from '../codex';
import type { ModifierId } from '../codex/schema';
import { addHearts, changeGold, gainCard, pick, pickWeighted, reject, removeCard, type Ctx } from './ctx';
import { dayPool, rarityOf } from './dusk';
import { addModifier, modifiable } from './modifiers';
import { MIN_DECK, type ShopRarity } from './rules';
import { allCards, type CardInstance, type RunState } from './state';

// Dusk events (GDD §7): the Event errand. Each event's choices are code here, by event id and
// choice index; the codex holds their names and text. One choice an event, and you head home.

/** Gold the events ask for or give. */
export const EVENT_GOLD = {
  shrine: 6,
  spillHelp: 4,
  purse: 10,
  binUncommon: 3,
  binRare: 7,
  miceStash: 3,
} as const;

type Choice = {
  /** Why this choice can't be made now, or null. */
  blocked?: (s: RunState) => string | null;
  /** Asks for a card from the deck: these are the ones it can be. */
  cards?: (s: RunState) => CardInstance[];
  /** Does it and says what happened. `card` is the chosen card when the choice asks for one. */
  run: (ctx: Ctx, card: CardInstance | null) => string;
};

const NOTHING: Choice = { run: () => 'Nothing happens.' };

const costs = (gold: number) => (s: RunState) => (s.gold < gold ? `you need ${gold} gold` : null);

const nameOf = (id: string) => codex.ingredients.get(id)?.name ?? codex.tinctures.get(id)?.name ?? codex.junk.get(id)?.name ?? id;

/** A modifier on a random ingredient that can take it; says what happened. */
function modifyRandom(ctx: Ctx, modifier: ModifierId): string {
  const cards = modifiable(ctx.s, modifier);
  const name = codex.modifiers.get(modifier)!.name;
  if (!cards.length) return `No ingredient could take ${name}.`;
  const card = pick(ctx, cards);
  addModifier(ctx, card, modifier, 'event');
  return `${nameOf(card.card)} is now ${name}.`;
}

/** A random day card of this rarity into the deck. */
function gainOfRarity(ctx: Ctx, rarity: ShopRarity): string {
  const pool = dayPool(ctx.s).filter((c) => c.rarity === rarity);
  if (!pool.length) return 'The bin is empty.';
  const card = pick(ctx, pool).id;
  gainCard(ctx, card, 'event');
  return `You find ${nameOf(card)}.`;
}

const NEXT_RARITY: Partial<Record<ShopRarity, ShopRarity>> = { common: 'uncommon', uncommon: 'rare' };

/** Deck cards the Fairy Ring could change: anything below Rare that isn't junk. */
export function transformable(s: RunState): CardInstance[] {
  return allCards(s).filter((c) => !codex.junk.has(c.card) && NEXT_RARITY[rarityOf(c.card)] !== undefined);
}

/** One card becomes a random card of the next rarity up, of the same kind (ingredient or Tincture). */
function transform(ctx: Ctx): string {
  const cards = transformable(ctx.s);
  if (!cards.length) return 'The ring hums, and nothing changes.';
  const card = pick(ctx, cards);
  const to = NEXT_RARITY[rarityOf(card.card)]!;
  const sameKind = (id: string) => codex.ingredients.has(id) === codex.ingredients.has(card.card);
  const pool = dayPool(ctx.s).filter((c) => c.rarity === to && sameKind(c.id) && c.id !== card.card);
  if (!pool.length) return 'The ring hums, and nothing changes.';
  const from = card.card;
  const next = pick(ctx, pool).id;
  // A new card: its old Potency bonus, age and modifier don't carry over.
  card.card = next;
  delete card.bonus;
  delete card.aged;
  delete card.modifier;
  ctx.ev.push({ type: 'cardTransformed', uid: card.uid, from, to: next });
  return `${nameOf(from)} turns into ${nameOf(next)}.`;
}

export const EVENT_CHOICES: Record<string, Choice[]> = {
  'shrine-blessing': [
    {
      blocked: (s) => costs(EVENT_GOLD.shrine)(s) ?? (modifiable(s, 'blessed').length ? null : 'no ingredient can take Blessed'),
      cards: (s) => modifiable(s, 'blessed'),
      run: (ctx, card) => {
        changeGold(ctx, -EVENT_GOLD.shrine, 'event');
        addModifier(ctx, card!, 'blessed', 'event');
        return `${nameOf(card!.card)} is now Blessed.`;
      },
    },
    NOTHING,
  ],
  'moonlit-walk': [{ run: (ctx) => modifyRandom(ctx, 'moonlit') }],
  'kettle-explodes': [
    {
      run: (ctx) => {
        gainCard(ctx, 'sludge', 'event');
        return `A Sludge joins your deck. ${modifyRandom(ctx, 'aged')}`;
      },
    },
  ],
  'spilled-cauldron': [
    {
      run: (ctx) => {
        gainCard(ctx, 'cobweb', 'event');
        return 'A Cobweb joins your deck.';
      },
    },
    {
      blocked: costs(EVENT_GOLD.spillHelp),
      run: (ctx) => {
        changeGold(ctx, -EVENT_GOLD.spillHelp, 'event');
        return 'The neighbours mop it up for you.';
      },
    },
  ],
  'found-coin-purse': [
    {
      run: (ctx) => {
        const regular = pick(ctx, [...codex.regulars.values()]);
        addHearts(ctx, regular.id, 1);
        return `It was ${regular.name}'s. +1 heart.`;
      },
    },
    {
      run: (ctx) => {
        changeGold(ctx, EVENT_GOLD.purse, 'event');
        gainCard(ctx, 'bad-omen', 'event');
        return `+${EVENT_GOLD.purse} gold. A Bad Omen joins your deck.`;
      },
    },
  ],
  'bargain-bin': [
    {
      blocked: costs(EVENT_GOLD.binUncommon),
      run: (ctx) => {
        changeGold(ctx, -EVENT_GOLD.binUncommon, 'event');
        return gainOfRarity(ctx, 'uncommon');
      },
    },
    {
      blocked: costs(EVENT_GOLD.binRare),
      run: (ctx) => {
        changeGold(ctx, -EVENT_GOLD.binRare, 'event');
        return gainOfRarity(ctx, 'rare');
      },
    },
    NOTHING,
  ],
  'mice-in-the-pantry': [
    {
      run: (ctx) => {
        const commons = allCards(ctx.s).filter((c) => !codex.junk.has(c.card) && rarityOf(c.card) === 'common');
        if (!commons.length || allCards(ctx.s).length <= MIN_DECK) return 'The traps stay empty.';
        const card = pick(ctx, commons);
        removeCard(ctx, card);
        return `The mice got your ${nameOf(card.card)}.`;
      },
    },
    {
      run: (ctx) => {
        gainCard(ctx, 'cobweb', 'event');
        changeGold(ctx, EVENT_GOLD.miceStash, 'event');
        return `A Cobweb joins your deck, and +${EVENT_GOLD.miceStash} gold from their stash.`;
      },
    },
  ],
  'fairy-ring': [{ run: transform }, NOTHING],
};

export function choicesOf(event: string): Choice[] {
  const c = EVENT_CHOICES[event];
  if (!c) throw new Error(`dusk event ${event} has no rules`);
  return c;
}

/** Why this choice can't be made now, or null. */
export function eventChoiceBlocked(s: RunState, event: string, index: number): string | null {
  return choicesOf(event)[index]?.blocked?.(s) ?? null;
}

/** The cards a choice asks you to pick from, or null when it doesn't ask for one. */
export function eventChoiceCards(s: RunState, event: string, index: number): CardInstance[] | null {
  return choicesOf(event)[index]?.cards?.(s) ?? null;
}

/** You can head home once you've chosen, or when no choice is open to you. */
export function eventDone(s: RunState, offer: { event: string; chose: number | null }): boolean {
  return offer.chose !== null || choicesOf(offer.event).every((_, i) => eventChoiceBlocked(s, offer.event, i) !== null);
}

/** A dusk event, by weight. */
export function rollEvent(ctx: Ctx): string {
  return pickWeighted(ctx, [...codex.duskEvents.values()].map((e) => [e.id, e.weight] as const));
}

export function openEvent(ctx: Ctx, event: string): void {
  if (!codex.duskEvents.has(event)) reject(`no dusk event ${event}`);
  ctx.s.offer = { kind: 'event', event, chose: null, outcome: null };
}

export function chooseEvent(ctx: Ctx, index: number, uid?: number): void {
  const offer = ctx.s.offer;
  if (offer?.kind !== 'event') reject('there is no event here');
  if (offer.chose !== null) reject('you already chose');
  const choice = choicesOf(offer.event)[index];
  if (!choice) reject(`no choice ${index}`);
  const why = choice.blocked?.(ctx.s);
  if (why) reject(why);
  let card: CardInstance | null = null;
  if (choice.cards) {
    card = choice.cards(ctx.s).find((c) => c.uid === uid) ?? null;
    if (!card) reject('choose a card for it');
  }
  const outcome = choice.run(ctx, card);
  offer.chose = index;
  offer.outcome = outcome;
  ctx.ev.push({ type: 'eventChosen', event: offer.event, choice: index, outcome });
}
