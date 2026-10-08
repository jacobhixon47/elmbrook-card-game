import { z } from 'zod';
import * as raw from './content';
import { Ingredient, Recipe, Regular, Tincture, Witch } from './schema';

export * from './schema';

function table<T extends z.ZodTypeAny>(schema: T, rows: unknown[], kind: string): ReadonlyMap<string, z.output<T>> {
  const map = new Map<string, z.output<T>>();
  for (const row of rows) {
    const parsed = schema.parse(row) as z.output<T> & { id: string };
    if (map.has(parsed.id)) throw new Error(`duplicate ${kind} id: ${parsed.id}`);
    map.set(parsed.id, parsed);
  }
  return map;
}

export const codex = {
  ingredients: table(Ingredient, raw.ingredients, 'ingredient'),
  tinctures: table(Tincture, raw.tinctures, 'tincture'),
  recipes: table(Recipe, raw.recipes, 'recipe'),
  regulars: table(Regular, raw.regulars, 'regular'),
  witches: table(Witch, raw.witches, 'witch'),
};

export type CardKind = 'ingredient' | 'tincture';

export function cardKind(id: string): CardKind {
  if (codex.ingredients.has(id)) return 'ingredient';
  if (codex.tinctures.has(id)) return 'tincture';
  throw new Error(`unknown card id: ${id}`);
}
