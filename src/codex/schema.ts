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
