import { z } from 'zod';

export const ESSENCES = ['vital', 'ember', 'tide', 'gale', 'stone', 'umbra', 'lunar'] as const;
export const Essence = z.enum(ESSENCES);
export type Essence = z.infer<typeof Essence>;

export const Rarity = z.enum(['common', 'uncommon', 'rare', 'lunar']);
export type Rarity = z.infer<typeof Rarity>;

export const Origin = z.enum(['garden', 'wychwood', 'creek', 'mine', 'market', 'night']);
export type Origin = z.infer<typeof Origin>;

const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case');

export const Season = z.enum(['spring', 'summer', 'autumn', 'winter']);

/**
 * Where content comes from: `base` is offered from a player's first run, `unlock` only once the
 * run lists it in `unlocks` (meta-progression, M4), `event` only from the named calendar event.
 */
export const Pool = z.enum(['base', 'unlock', 'event']);
export type Pool = z.infer<typeof Pool>;

export const Ingredient = z.object({
  id: Id,
  name: z.string().min(1),
  essences: z.array(Essence).min(1).max(2),
  potency: z.number().int().min(0).max(30),
  rarity: Rarity,
  origin: Origin,
  /** Effect ids resolved by the core effects table (M1+). */
  effects: z.array(z.string()).default([]),
  text: z.string().default(''),
  nightOnly: z.boolean().default(false),
  /** Kinds of thing it is (flower, frost, mineral...), for effects and events that care. */
  tags: z.array(z.string()).default([]),
  /** Offered three times as often in these seasons. */
  inSeason: z.array(Season).default([]),
  pool: Pool.default('base'),
  event: z.string().optional(),
});
export type Ingredient = z.infer<typeof Ingredient>;

export const Tincture = z.object({
  id: Id,
  name: z.string().min(1),
  rarity: Rarity,
  effects: z.array(z.string()).min(1),
  text: z.string().min(1),
  pool: Pool.default('base'),
});
export type Tincture = z.infer<typeof Tincture>;

/** Junk clogs the hand and does nothing (Sludge from a failed brew). Remove it at the Hearth. */
export const Junk = z.object({
  id: Id,
  name: z.string().min(1),
  effects: z.array(z.string()).default([]),
  text: z.string().min(1),
});
export type Junk = z.infer<typeof Junk>;

export const PotionFamily = z.enum([
  'healing', 'warming', 'calming', 'vigor', 'protection', 'secrets', 'fortune', 'illusion', 'lunar',
]);
export type PotionFamily = z.infer<typeof PotionFamily>;

/** 'any' matches any essence in that slot. */
export const RecipeSlot = z.union([Essence, z.literal('any')]);

export const Recipe = z.object({
  id: Id,
  name: z.string().min(1),
  pattern: z.array(RecipeSlot).min(2).max(3),
  baseHarmony: z.number().int().min(1),
  family: PotionFamily,
  pool: Pool.default('base'),
  event: z.string().optional(),
  /** Only brews during an Eclipse (GDD §5.4). */
  eclipseOnly: z.boolean().default(false),
});
export type Recipe = z.infer<typeof Recipe>;

export const Regular = z.object({
  id: Id,
  name: z.string().min(1),
  blurb: z.string().min(1),
  prefers: z.array(z.union([PotionFamily, z.literal('rare')])).min(1),
  nightOnly: z.boolean().default(false),
  /** How often they come in, relative to the others. */
  weight: z.number().positive().default(1),
  payMult: z.number().positive().default(1),
  tipMult: z.number().positive().default(1),
  bonusChance: z.number().min(0).max(1).default(0.25),
  bonusPool: z.array(z.enum(['no-umbra', 'three-ingredients', 'wychwood-ingredient'])).min(1).default(['no-umbra', 'three-ingredients', 'wychwood-ingredient']),
});
export type Regular = z.infer<typeof Regular>;

/** What a night customer gives on top of (or instead of) gold (GDD §4.1). */
export const NightPayment = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gold') }),
  /** A random Omen into the Night Satchel. */
  z.object({ kind: z.literal('omen') }),
  /** Pick 1 of 2 Lunar ingredients into the Night Satchel. */
  z.object({ kind: z.literal('lunar-card') }),
  /** Pick 1 of 3 Rare day ingredients. */
  z.object({ kind: z.literal('rare-card') }),
  /** Lifts your oldest Curse; pays `noCurseMult` × gold instead when you have none. */
  z.object({ kind: z.literal('lift-curse'), noCurseMult: z.number().positive() }),
]);
export type NightPayment = z.infer<typeof NightPayment>;

/** Customers who only come on Night Shifts, after the patron (GDD §4.1). */
export const NightCustomer = z.object({
  id: Id,
  name: z.string().min(1),
  blurb: z.string().min(1),
  prefers: z.array(PotionFamily).min(1),
  weight: z.number().positive().default(1),
  /** Scales the order's normal gold pay. */
  goldMult: z.number().min(0),
  paysIn: NightPayment,
  /** The potion must have an Umbra ingredient in it (Granny Bogwort). */
  requiresUmbra: z.boolean().default(false),
});
export type NightCustomer = z.infer<typeof NightCustomer>;

/** Rule twists a patron puts on their Night Shift (GDD §10). Each is handled by id in the core. */
export const TWISTS = [
  'hand-hidden', 'origin-chain', 'orders-double', 'ember-zero', 'orders-expire-2', 'family-chain', 'hand-refresh',
  'brew-costs-gold-2', 'non-frost-minus-2', 'pale-courier', 'grimoire-hidden',
] as const;
export const Twist = z.enum(TWISTS);
export type Twist = z.infer<typeof Twist>;

/** What filling the patron's order gives on top of its pay. */
export const PatronReward = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gold'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('card-pick'), rarity: z.enum(['common', 'uncommon', 'rare']), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('familiar-pick'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('relic'), tier: z.number().int().min(1).max(3) }),
  /** The finale: filling every order of the shift is what wins the run. */
  z.object({ kind: z.literal('win') }),
]);
export type PatronReward = z.infer<typeof PatronReward>;

const TierName = z.enum(['crude', 'fine', 'superb', 'masterwork', 'legendary']);

/** The featured guest of a Night Shift, with a rule twist (GDD §10). */
export const Patron = z.object({
  id: Id,
  name: z.string().min(1),
  blurb: z.string().min(1),
  /** Which weeks' Night Shifts can roll them. */
  weeks: z.array(z.number().int().min(1).max(4)).min(1),
  /** Only in this season. */
  season: Season.optional(),
  twist: Twist,
  /** The twist in a sentence, for the Calendar and the HUD. */
  text: z.string().min(1),
  /** Orders the shift posts in all: the patron's, then night customers. */
  orderCount: z.number().int().min(1),
  /** Pay multiplier on every order that night. */
  payMult: z.number().positive().default(1),
  reward: PatronReward,
  /** The patron's order is always this (The Pale Courier), capped by what the deck can reach. */
  fixedOrder: z.object({ family: PotionFamily, minTier: TierName }).optional(),
  /** Every order is the patron's, at these minimum tiers (The Moonless Patron). */
  ladder: z.array(TierName).optional(),
});
export type Patron = z.infer<typeof Patron>;

export const DeckEntry = z.object({ card: Id, count: z.number().int().min(1) });

export const Witch = z.object({
  id: Id,
  name: z.string().min(1),
  focus: z.string().min(1),
  quirk: z.string().min(1),
  handSize: z.number().int().min(1),
  startingDeck: z.array(DeckEntry).min(1),
  knownRecipes: z.array(Id).min(1),
});
export type Witch = z.infer<typeof Witch>;

/** The Night Market's stalls (GDD §9). Their trades need code, so each id is handled in core/market.ts. */
export const STALLS = ['lantern-seller', 'fence', 'moth-broker', 'hollow-tailor', 'fortune-tent', 'name-taker', 'wandering-tinker', 'black-market'] as const;
export const StallId = z.enum(STALLS);
export type StallId = z.infer<typeof StallId>;

export const Stall = z.object({
  id: StallId,
  name: z.string().min(1),
  /** What it takes instead of (or as well as) gold, shown on its sign. */
  currency: z.string().min(1),
  /** The trade in a sentence, for its sign on the street. */
  text: z.string().min(1),
  /**
   * Which nights it opens: `always` every night, `drawn` one of them on quarter-moon nights and all
   * of them at the full and new moon, or only on that moon.
   */
  opens: z.enum(['always', 'drawn', 'full-moon', 'new-moon']),
});
export type Stall = z.infer<typeof Stall>;

/** What a tarot card does; each is handled by id in core/market.ts. */
export const TAROT_EFFECTS = ['gold', 'lunar-card', 'learn-recipe', 'hearts', 'familiar', 'relic', 'bless', 'fewer-orders', 'harder-orders', 'fog-week', 'bad-omen', 'lose-card'] as const;
export const TarotEffect = z.enum(TAROT_EFFECTS);
export type TarotEffect = z.infer<typeof TarotEffect>;

/** The Fortune Tent's deck (GDD §9). Boons happen at once; twists change next week. */
export const Tarot = z.object({
  id: Id,
  name: z.string().min(1),
  kind: z.enum(['boon', 'twist']),
  /** Draw chance, relative to the others. */
  weight: z.number().positive(),
  effect: TarotEffect,
  /** Gold, hearts or the like, when the effect takes an amount. */
  amount: z.number().int().optional(),
  /** It changes next week's days, so it isn't drawn in the last week. */
  nextWeek: z.boolean().default(false),
  text: z.string().min(1),
});
export type Tarot = z.infer<typeof Tarot>;

/** Familiars (GDD §11): passive helpers in slots, resolved in slot order. Their rules are code, by id, in core/familiars.ts. */
export const Familiar = z.object({
  id: Id,
  name: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare']),
  text: z.string().min(1),
  pool: Pool.default('base'),
});
export type Familiar = z.infer<typeof Familiar>;

/** Relics (balance tables): run-long passives with no slot limit, never sold for gold. Rules live in core/relics.ts. */
export const Relic = z.object({
  id: Id,
  name: z.string().min(1),
  tier: z.number().int().min(1).max(3),
  text: z.string().min(1),
});
export type Relic = z.infer<typeof Relic>;

/** Curses (GDD §9): run debuffs taken at the Name-Taker for a relic. Rules live in core/relics.ts. */
export const Curse = z.object({
  id: Id,
  name: z.string().min(1),
  severity: z.number().int().min(1).max(3),
  text: z.string().min(1),
});
export type Curse = z.infer<typeof Curse>;

/** Card modifiers (GDD §5.5): one per ingredient card, for the run. Rules live in core/modifiers.ts. */
export const MODIFIERS = ['moonlit', 'aged', 'blessed', 'cursed'] as const;
export const ModifierId = z.enum(MODIFIERS);
export type ModifierId = z.infer<typeof ModifierId>;

export const Modifier = z.object({
  id: ModifierId,
  name: z.string().min(1),
  text: z.string().min(1),
  /** Gold at the Creek Bank; null when it isn't sold (Cursed comes from the Name-Taker). */
  price: z.number().int().positive().nullable(),
});
export type Modifier = z.infer<typeof Modifier>;

/** Guild Commissions (GDD §7): goals taken at the Guild Hall, due by a Night Shift. Goals are code, by id, in core/commissions.ts. */
export const Commission = z.object({
  id: Id,
  name: z.string().min(1),
  goal: z.string().min(1),
  /** Night Shifts from the week it's taken: 1 is this week's. */
  deadline: z.number().int().min(1).max(4),
  /** Due by this week's Night Shift whenever it's taken (Full Moon Favour). */
  dueWeek: z.number().int().min(1).max(4).optional(),
  reward: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('gold'), amount: z.number().int().positive() }),
    z.object({ kind: z.literal('relic'), tier: z.number().int().min(1).max(3) }),
    z.object({ kind: z.literal('card-pick'), rarity: z.enum(['common', 'uncommon', 'rare']), count: z.number().int().min(1) }),
  ]),
  /** Offered only in these weeks. */
  minWeek: z.number().int().min(1).max(4).default(1),
  maxWeek: z.number().int().min(1).max(4).default(4),
});
export type Commission = z.infer<typeof Commission>;

/** Dusk events (GDD §7): the Event errand. Each choice's rule is code, by event id and choice, in core/dusk-events.ts. */
export const DuskEvent = z.object({
  id: Id,
  name: z.string().min(1),
  tags: z.array(z.enum(['fae', 'mishap', 'market', 'town'])).min(1),
  /** Roll chance, relative to the others. */
  weight: z.number().positive(),
  /** What you come across, in a line or two. */
  text: z.string().min(1),
  choices: z.array(z.object({ label: z.string().min(1), text: z.string().min(1) })).min(1).max(3),
});
export type DuskEvent = z.infer<typeof DuskEvent>;
