import { z } from 'zod';
import * as raw from './content';
import { Curse, Familiar, Ingredient, Junk, NightCustomer, Patron, Recipe, Regular, Relic, Stall, Tarot, Tincture, Witch } from './schema';

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
  junk: table(Junk, raw.junk, 'junk'),
  recipes: table(Recipe, raw.recipes, 'recipe'),
  regulars: table(Regular, raw.regulars, 'regular'),
  nightCustomers: table(NightCustomer, raw.nightCustomers, 'night customer'),
  patrons: table(Patron, raw.patrons, 'patron'),
  familiars: table(Familiar, raw.familiars, 'familiar'),
  relics: table(Relic, raw.relics, 'relic'),
  curses: table(Curse, raw.curses, 'curse'),
  stalls: table(Stall, raw.stalls, 'stall'),
  tarot: table(Tarot, raw.tarot, 'tarot card'),
  witches: table(Witch, raw.witches, 'witch'),
};

export type CardKind = 'ingredient' | 'tincture' | 'junk';

export function cardKind(id: string): CardKind {
  if (codex.ingredients.has(id)) return 'ingredient';
  if (codex.tinctures.has(id)) return 'tincture';
  if (codex.junk.has(id)) return 'junk';
  throw new Error(`unknown card id: ${id}`);
}
