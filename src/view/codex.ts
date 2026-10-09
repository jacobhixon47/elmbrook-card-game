import { codex } from '../codex';
import { CODEX_TABLES, type CodexTable } from '../core';
import { cap, familyName } from './describe';

// The cottage's Codex (GDD §13): every card, recipe, familiar, relic and customer, met or not.

export const CODEX_TABS: { id: CodexTable; name: string }[] = [
  { id: 'ingredients', name: 'Ingredients' },
  { id: 'tinctures', name: 'Tinctures' },
  { id: 'recipes', name: 'Recipes' },
  { id: 'familiars', name: 'Familiars' },
  { id: 'relics', name: 'Relics' },
  { id: 'townsfolk', name: 'Townsfolk' },
];

export type CodexEntry = { id: string; name: string; sub: string; text: string; met: boolean };

/** A tab's entries in codex order: name, a line of kind, and what it does or who they are. Unmet ones are hidden. */
export function codexEntries(table: CodexTable, met: readonly string[]): CodexEntry[] {
  return [...CODEX_TABLES[table].keys()].map((id) => {
    const seen = met.includes(id);
    if (!seen) return { id, name: '???', sub: 'Not met yet', text: '', met: false };
    return { id, ...describe(table, id), met: true };
  });
}

function describe(table: CodexTable, id: string): { name: string; sub: string; text: string } {
  switch (table) {
    case 'ingredients': {
      const c = codex.ingredients.get(id)!;
      return { name: c.name, sub: `${c.essences.map(cap).join(' + ')} · Potency ${c.potency} · ${cap(c.origin)}`, text: c.text };
    }
    case 'tinctures': {
      const c = codex.tinctures.get(id)!;
      return { name: c.name, sub: `${cap(c.rarity)} Tincture`, text: c.text };
    }
    case 'recipes': {
      const r = codex.recipes.get(id)!;
      return { name: r.name, sub: `${familyName(r.family)} · Harmony ${r.baseHarmony}`, text: r.pattern.map(cap).join(' + ') };
    }
    case 'familiars': {
      const f = codex.familiars.get(id)!;
      return { name: f.name, sub: `${cap(f.rarity)} familiar`, text: f.text };
    }
    case 'relics': {
      const r = codex.relics.get(id)!;
      return { name: r.name, sub: `Tier ${r.tier} relic`, text: r.text };
    }
    case 'townsfolk': {
      const regular = codex.regulars.get(id);
      if (regular) return { name: regular.name, sub: 'A regular', text: regular.blurb };
      const night = codex.nightCustomers.get(id);
      if (night) return { name: night.name, sub: 'A Night Shift customer', text: night.blurb };
      const p = codex.patrons.get(id)!;
      return { name: p.name, sub: 'A patron', text: `${p.blurb} ${p.text}` };
    }
  }
}
