import { describe, expect, it } from 'vitest';
import { cardKind, codex } from '../src/codex';

describe('codex', () => {
  it('loads and validates every table', () => {
    expect(codex.ingredients.size).toBeGreaterThanOrEqual(16);
    expect(codex.recipes.size).toBeGreaterThanOrEqual(12);
    expect(codex.regulars.size).toBeGreaterThanOrEqual(6);
  });

  it('witch decks and known recipes reference real entries', () => {
    for (const witch of codex.witches.values()) {
      for (const entry of witch.startingDeck) expect(() => cardKind(entry.card)).not.toThrow();
      for (const r of witch.knownRecipes) expect(codex.recipes.has(r)).toBe(true);
    }
  });

  it('ids are unique across cards', () => {
    const ids = [...codex.ingredients.keys(), ...codex.tinctures.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('night-only ingredients carry the lunar essence', () => {
    for (const ing of codex.ingredients.values()) {
      if (ing.nightOnly) expect(ing.essences).toContain('lunar');
    }
  });
});
