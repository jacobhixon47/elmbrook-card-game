import { codex } from '../codex';
import type { ModifierId } from '../codex/schema';
import { recipeAvailable } from './brew';
import { changeGold, gainCard, pick, pickWeighted, reject, removeCard, type Ctx } from './ctx';
import { dayPool, openMarket, rarityOf } from './dusk';
import { befriend } from './friendship';
import { forgettable } from './market';
import { addModifier, modifiable } from './modifiers';
import { lunarPool } from './night';
import { MIN_DECK, TIER_MIN, tierIndex, tierStep, TIERS, type ShopRarity } from './rules';
import { allCards, type CardInstance, type Potion, type RunState } from './state';
import { yearRule } from './year';

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
  pixie: 4,
  shelfRepair: 5,
  spice: 6,
  recipeSale: 12,
  bakeSale: 8,
  bun: 1,
  cookbook: 8,
} as const;

/** The rest of the events' numbers (the balance tables', untuned until the balance pass). */
export const EVENT_RULES = {
  /** Market Day: off every Market Square price. */
  marketDayOff: 0.25,
  /** Friendship from Pip & Quill's Dare, Old Tobin's Stories and Bea's Bake Sale. */
  dareFriendship: 2,
  tobinFriendship: 1,
  beaFriendship: 1,
} as const;

/** What a choice asks you to pick, and what it can be. */
export type EventAsk =
  | { kind: 'deck'; cards: CardInstance[] }
  | { kind: 'shelf'; potions: Potion[] }
  | { kind: 'recipe'; recipes: string[] }
  /** A new card to gain (the Spice Merchant). */
  | { kind: 'card'; cards: string[] };

/** What was picked for a choice that asks for something. */
type Picked = { card?: CardInstance; potion?: Potion; recipe?: string; id?: string };

type Choice = {
  /** Why this choice can't be made now, or null. */
  blocked?: (s: RunState) => string | null;
  /** Asks for a pick: a deck card, a Shelf potion, a recipe or a new card. */
  ask?: (s: RunState) => EventAsk;
  /** Does it and says what happened, with what was picked when the choice asks for something. */
  run: (ctx: Ctx, picked: Picked) => string;
};

const NOTHING: Choice = { run: () => 'Nothing happens.' };

const costs = (gold: number) => (s: RunState) => (s.gold < gold ? `you need ${gold} gold` : null);

const nameOf = (id: string) => codex.ingredients.get(id)?.name ?? codex.tinctures.get(id)?.name ?? codex.junk.get(id)?.name ?? id;
const recipeNameOf = (id: string) => codex.recipes.get(id)?.name ?? id;
const potionName = (p: Potion) => `${p.tier[0]!.toUpperCase()}${p.tier.slice(1)} ${recipeNameOf(p.recipe)}`;

/** A regular's name, for an outcome line. */
const regularName = (id: string) => codex.regulars.get(id)!.name;

/** Spices on sale from the Spice Merchant: Dragon Pepper, and Ginger Root once unlocked. */
export function spices(s: Pick<RunState, 'unlocks' | 'season'>): string[] {
  return dayPool(s).filter((c) => codex.ingredients.get(c.id)?.tags.includes('spice')).map((c) => c.id);
}

/** Shelf potions a Changeling Bottle can lift: any below Legendary. */
export function changeable(s: Pick<RunState, 'shelf'>): Potion[] {
  return s.shelf.filter((p) => tierIndex(p.tier) < TIERS.length - 1);
}

/** The Warming Shelf potion Bea takes: your lowest. */
export function bakeSalePotion(s: Pick<RunState, 'shelf'>): Potion | null {
  return s.shelf.filter((p) => p.family === 'warming').sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier) || a.quality - b.quality)[0] ?? null;
}

/** Recipes you could still learn this run. */
function unknownRecipes(s: RunState): string[] {
  return [...codex.recipes.values()].filter((r) => !r.eclipseOnly && r.pool !== 'event' && !s.knownRecipes.includes(r.id) && recipeAvailable(r, s)).map((r) => r.id);
}

/** Take a Shelf potion away. */
function takePotion(ctx: Ctx, potion: Potion, how: 'potionSpilled' | 'potionTraded'): void {
  ctx.s.shelf = ctx.s.shelf.filter((p) => p.uid !== potion.uid);
  ctx.ev.push({ type: how, uid: potion.uid });
}

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
      ask: (s) => ({ kind: 'deck', cards: modifiable(s, 'blessed') }),
      run: (ctx, { card }) => {
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
        befriend(ctx, regular.id, 1);
        return `It was ${regular.name}'s. +1 Friendship.`;
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
  'fae-bargain': [
    {
      blocked: (s) => (s.forfeitReward ? 'the fae already have your next reward' : null),
      run: (ctx) => {
        ctx.s.forfeitReward = true;
        const pool = lunarPool(ctx.s);
        if (!pool.length) return 'Your next dusk reward is theirs, and the hedge goes quiet.';
        const card = pick(ctx, pool);
        gainCard(ctx, card, 'event');
        return `Your next dusk reward is theirs. ${nameOf(card)} is in your Night Satchel.`;
      },
    },
    NOTHING,
  ],
  'pixie-thief': [
    {
      run: (ctx) => {
        ctx.s.tomorrow.discards -= 1;
        changeGold(ctx, EVENT_GOLD.pixie, 'event');
        return `You catch it by the wing. +${EVENT_GOLD.pixie} gold, and -1 Discard tomorrow.`;
      },
    },
    {
      run: (ctx) => {
        const lost = Math.min(EVENT_GOLD.pixie, ctx.s.gold);
        changeGold(ctx, -lost, 'event');
        return lost ? `The pixie keeps ${lost} gold.` : 'Your purse was empty. The pixie looks hurt.';
      },
    },
  ],
  'changeling-bottle': [
    {
      blocked: (s) => (changeable(s).length ? null : 'no Shelf potion below Legendary'),
      ask: (s) => ({ kind: 'shelf', potions: changeable(s) }),
      run: (ctx, { potion }) => {
        const p = potion!;
        const before = potionName(p);
        p.tier = tierStep(p.tier, 1);
        p.quality = Math.max(p.quality, TIER_MIN[p.tier]);
        ctx.ev.push({ type: 'potionUpgraded', uid: p.uid, tier: p.tier });
        return `Your ${before} is now ${potionName(p)}.`;
      },
    },
    NOTHING,
  ],
  'cracked-shelf': [
    {
      blocked: costs(EVENT_GOLD.shelfRepair),
      run: (ctx) => {
        changeGold(ctx, -EVENT_GOLD.shelfRepair, 'event');
        return 'Good as new.';
      },
    },
    {
      run: (ctx) => {
        if (!ctx.s.shelf.length) return 'The Shelf was empty, so nothing fell.';
        const p = pick(ctx, ctx.s.shelf);
        takePotion(ctx, p, 'potionSpilled');
        return `Your ${potionName(p)} slides off and breaks.`;
      },
    },
  ],
  'market-day': [
    {
      run: (ctx) => {
        openMarket(ctx, EVENT_RULES.marketDayOff);
        return 'Every price is 25% off.';
      },
    },
  ],
  'spice-merchant': [
    {
      blocked: (s) => costs(EVENT_GOLD.spice)(s) ?? (spices(s).length ? null : 'the cart is empty'),
      ask: (s) => ({ kind: 'card', cards: spices(s) }),
      run: (ctx, { id }) => {
        changeGold(ctx, -EVENT_GOLD.spice, 'event');
        gainCard(ctx, id!, 'event');
        return `${nameOf(id!)} joins your deck.`;
      },
    },
    {
      blocked: (s) => (spices(s).length ? null : 'the cart is empty'),
      run: (ctx) => {
        const got = spices(ctx.s);
        for (const id of got) gainCard(ctx, id, 'event');
        gainCard(ctx, 'bad-omen', 'event');
        return `${got.map(nameOf).join(' and ')} for nothing, and a muttered curse: a Bad Omen joins your deck.`;
      },
    },
  ],
  'sell-a-recipe': [
    {
      blocked: (s) => (forgettable(s).length ? null : 'you have learned no recipes this run'),
      ask: (s) => ({ kind: 'recipe', recipes: forgettable(s) }),
      run: (ctx, { recipe }) => {
        ctx.s.knownRecipes = ctx.s.knownRecipes.filter((r) => r !== recipe);
        ctx.ev.push({ type: 'recipeForgotten', recipe: recipe!, cards: [] });
        changeGold(ctx, EVENT_GOLD.recipeSale, 'event');
        return `You forget ${recipeNameOf(recipe!)}. +${EVENT_GOLD.recipeSale} gold. Brew it again to relearn it.`;
      },
    },
    NOTHING,
  ],
  'childrens-dare': [
    {
      run: (ctx) => {
        ctx.s.blindBrew = true;
        befriend(ctx, 'pip-and-quill', EVENT_RULES.dareFriendship);
        return `Blindfold on for your next brew. +${EVENT_RULES.dareFriendship} Friendship with ${regularName('pip-and-quill')}.`;
      },
    },
    NOTHING,
  ],
  'tobins-stories': [
    {
      run: (ctx) => {
        befriend(ctx, 'old-tobin', EVENT_RULES.tobinFriendship);
        gainCard(ctx, 'geode', 'event');
        return `+${EVENT_RULES.tobinFriendship} Friendship with ${regularName('old-tobin')}. He gives you a Geode from his pocket.`;
      },
    },
  ],
  'bake-sale': [
    {
      blocked: (s) => (bakeSalePotion(s) ? null : 'no Warming potion on your Shelf'),
      run: (ctx) => {
        const p = bakeSalePotion(ctx.s)!;
        takePotion(ctx, p, 'potionTraded');
        changeGold(ctx, EVENT_GOLD.bakeSale, 'event');
        befriend(ctx, 'bea-thornwick', EVENT_RULES.beaFriendship);
        return `Your ${potionName(p)} sells out. +${EVENT_GOLD.bakeSale} gold and +${EVENT_RULES.beaFriendship} Friendship with ${regularName('bea-thornwick')}.`;
      },
    },
    {
      blocked: costs(EVENT_GOLD.bun),
      run: (ctx) => {
        changeGold(ctx, -EVENT_GOLD.bun, 'event');
        ctx.s.tomorrow.brews += 1;
        return 'A warm bun, and +1 Brew tomorrow.';
      },
    },
  ],
  'apprentice-asks': [
    {
      // Not junk: the apprentice wants something worth learning from.
      blocked: (s) => (allCards(s).length <= MIN_DECK ? `the deck can't go below ${MIN_DECK} cards` : unknownRecipes(s).length ? null : 'you know every recipe you could learn'),
      ask: (s) => ({ kind: 'deck', cards: allCards(s).filter((c) => !codex.junk.has(c.card)) }),
      run: (ctx, { card }) => {
        removeCard(ctx, card!);
        const r = pick(ctx, unknownRecipes(ctx.s));
        ctx.s.knownRecipes.push(r);
        ctx.ev.push({ type: 'recipeDiscovered', recipe: r });
        return `The apprentice takes your ${nameOf(card!.card)} and leaves their notes: ${recipeNameOf(r)}.`;
      },
    },
    NOTHING,
  ],
  'old-cookbook': [
    {
      blocked: costs(EVENT_GOLD.cookbook),
      run: (ctx) => {
        changeGold(ctx, -EVENT_GOLD.cookbook, 'event');
        gainCard(ctx, 'grimoire-page', 'event');
        return 'A Grimoire Page joins your deck.';
      },
    },
    {
      run: (ctx) => {
        if (!yearRule(ctx.s, 2)) return 'A list of this month\'s patrons. You knew them already.';
        ctx.s.patronsRead = true;
        return 'A list of this month\'s patrons. Every one is on your Calendar now.';
      },
    },
  ],
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

/** What a choice asks you to pick, or null when it doesn't ask for anything. */
export function eventChoiceAsk(s: RunState, event: string, index: number): EventAsk | null {
  return choicesOf(event)[index]?.ask?.(s) ?? null;
}

/** You can head home once you've chosen, or when no choice is open to you. */
export function eventDone(s: RunState, offer: { event: string; chose: number | null }): boolean {
  return offer.chose !== null || choicesOf(offer.event).every((_, i) => eventChoiceBlocked(s, offer.event, i) !== null);
}

/** A dusk event, by weight. Some only come once their card is unlocked (the Old Cookbook). */
export function rollEvent(ctx: Ctx): string {
  const open = [...codex.duskEvents.values()].filter((e) => !e.needs || ctx.s.unlocks.includes(e.needs));
  return pickWeighted(ctx, open.map((e) => [e.id, e.weight] as const));
}

export function openEvent(ctx: Ctx, event: string): void {
  if (!codex.duskEvents.has(event)) reject(`no dusk event ${event}`);
  ctx.s.offer = { kind: 'event', event, chose: null, outcome: null };
}

export function chooseEvent(ctx: Ctx, index: number, uid?: number, pickId?: string): void {
  const offer = ctx.s.offer;
  if (offer?.kind !== 'event') reject('there is no event here');
  if (offer.chose !== null) reject('you already chose');
  const choice = choicesOf(offer.event)[index];
  if (!choice) reject(`no choice ${index}`);
  const why = choice.blocked?.(ctx.s);
  if (why) reject(why);
  const picked: Picked = {};
  const ask = choice.ask?.(ctx.s);
  if (ask?.kind === 'deck' && !(picked.card = ask.cards.find((c) => c.uid === uid))) reject('choose a card for it');
  if (ask?.kind === 'shelf' && !(picked.potion = ask.potions.find((p) => p.uid === uid))) reject('choose a Shelf potion for it');
  if (ask?.kind === 'recipe' && !(picked.recipe = ask.recipes.find((r) => r === pickId))) reject('choose a recipe for it');
  if (ask?.kind === 'card' && !(picked.id = ask.cards.find((c) => c === pickId))) reject('choose a card for it');
  const outcome = choice.run(ctx, picked);
  // Market Day opens the Market Square in the event's place, so there is no event offer to mark.
  offer.chose = index;
  offer.outcome = outcome;
  ctx.ev.push({ type: 'eventChosen', event: offer.event, choice: index, outcome });
}
