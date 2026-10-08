import { z } from 'zod';

export const ESSENCES = ['vital', 'ember', 'tide', 'gale', 'stone', 'umbra', 'lunar'] as const;
export const Essence = z.enum(ESSENCES);
export type Essence = z.infer<typeof Essence>;

export const Rarity = z.enum(['common', 'uncommon', 'rare', 'lunar']);
export type Rarity = z.infer<typeof Rarity>;

export const Origin = z.enum(['garden', 'wychwood', 'creek', 'mine', 'market', 'night']);
export type Origin = z.infer<typeof Origin>;

const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case');

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
});
export type Ingredient = z.infer<typeof Ingredient>;

export const Tincture = z.object({
  id: Id,
  name: z.string().min(1),
  rarity: Rarity,
  effects: z.array(z.string()).min(1),
  text: z.string().min(1),
});
export type Tincture = z.infer<typeof Tincture>;

export const PotionFamily = z.enum([
  'healing', 'warming', 'calming', 'vigor', 'protection', 'secrets', 'fortune', 'lunar',
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
});
export type Recipe = z.infer<typeof Recipe>;

export const Regular = z.object({
  id: Id,
  name: z.string().min(1),
  blurb: z.string().min(1),
  prefers: z.array(z.union([PotionFamily, z.literal('rare')])).min(1),
  nightOnly: z.boolean().default(false),
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
