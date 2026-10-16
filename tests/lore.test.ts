import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { lore } from '../src/codex/lore';
import { CODEX_TABLES } from '../src/core';
import { codexEntries } from '../src/view/codex';
import { cardInfo } from '../src/view/inspect';

describe('codex lore (GDD §13)', () => {
  const ids = [...Object.values(CODEX_TABLES).flatMap((t) => [...t.keys()]), ...codex.junk.keys()];

  it('has a line for everything the Codex lists, and every card', () => {
    for (const id of ids) expect(lore[id], id).toBeTruthy();
    for (const id of [...codex.ingredients.keys(), ...codex.tinctures.keys(), ...codex.junk.keys()]) expect(cardInfo(id).lore, id).toBeTruthy();
  });

  it('has no line for something that is not in the codex', () => {
    for (const id of Object.keys(lore)) expect(ids, id).toContain(id);
  });

  it('keeps each line short enough for a tooltip, and never repeats the blurb', () => {
    for (const [id, line] of Object.entries(lore)) {
      expect(line.length, id).toBeLessThanOrEqual(120);
      const e = codexEntries('townsfolk', [id]).find((x) => x.id === id && x.met);
      if (e) expect(e.text, id).not.toContain(line);
    }
  });

  it('is shown only once an entry is met', () => {
    const [unmet] = codexEntries('ingredients', []);
    expect(unmet!.lore).toBe('');
    expect(codexEntries('ingredients', ['elmroot'])[0]!.lore).toBe(lore.elmroot);
  });
});
