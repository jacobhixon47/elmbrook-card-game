import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { BACKDROPS } from '../src/art/backdrops';
import { gradeView } from '../src/art/window';
import { PALETTE } from '../src/art/palette';
import { proceduralTextures, TAG_GLYPHS, tagGlyph } from '../src/art/procedural';
import { codex } from '../src/codex';
import { spriteSize, validateSprite } from '../src/art/sprite';
import { PORTRAITS, SPRITES } from '../src/art/sprites';
import { portraitStatus } from '../src/art/status';

describe('art', () => {
  it('every sprite grid is rectangular and on-palette', () => {
    for (const def of SPRITES) expect(validateSprite(def)).toEqual([]);
  });

  it('icons are 16x16', () => {
    for (const def of SPRITES) expect(spriteSize(def)).toEqual({ width: 16, height: 16 });
  });

  it('tag marks are 7x7 line drawings in one palette colour, for tags cards carry', () => {
    const tags = new Set([...codex.ingredients.values()].flatMap((i) => i.tags));
    for (const [tag, g] of Object.entries(TAG_GLYPHS)) {
      expect(tags.has(tag), tag).toBe(true);
      expect(g.rows).toHaveLength(7);
      expect(g.rows.every((r) => r.length === 7 && /^[.#]+$/.test(r))).toBe(true);
      expect(PALETTE[g.color]).toBeDefined();
      expect(PALETTE[g.text]).toBeDefined();
      expect(tagGlyph(tag).width).toBe(8);
    }
  });

  it('every rule-read tag has a mark, and no tag is on just one card', () => {
    const count = new Map<string, number>();
    for (const i of codex.ingredients.values()) for (const t of i.tags) count.set(t, (count.get(t) ?? 0) + 1);
    for (const tag of ['flower', 'frost', 'fruit', 'herb', 'mineral', 'spice', 'water']) expect(TAG_GLYPHS[tag], tag).toBeDefined();
    for (const [tag, n] of count) expect(n, tag).toBeGreaterThan(1);
  });

  it('portraits are 32x32, on-palette, and every customer has one', () => {
    for (const def of PORTRAITS) {
      expect(validateSprite(def)).toEqual([]);
      expect(spriteSize(def), def.id).toEqual({ width: 32, height: 32 });
    }
    expect(portraitStatus().filter((p) => !p.done).map((p) => p.id)).toEqual([]);
    expect(new Set(PORTRAITS.map((s) => s.id)).size).toBe(PORTRAITS.length);
  });

  it('sprite ids are unique', () => {
    expect(new Set(SPRITES.map((s) => s.id)).size).toBe(SPRITES.length);
  });

  it('procedural textures only use palette colours', () => {
    const allowed = new Set(Object.values(PALETTE).map((h) => h.toLowerCase()));
    for (const [key, pm] of Object.entries(proceduralTextures())) {
      for (let i = 0; i < pm.data.length; i += 4) {
        if (pm.data[i + 3] === 0) continue;
        const hex = '#' + [0, 1, 2].map((k) => (pm.data[i + k] ?? 0).toString(16).padStart(2, '0')).join('');
        expect(allowed.has(hex), `${key} uses ${hex}`).toBe(true);
      }
    }
  });
});

describe('painted backdrops', () => {
  it('every backdrop file exists at 640x360', () => {
    for (const [id, b] of Object.entries(BACKDROPS)) {
      const png = PNG.sync.read(readFileSync(`public/${b.file}`));
      expect({ id, width: png.width, height: png.height }).toEqual({ id, width: 640, height: 360 });
    }
  });
});

describe('window view grading', () => {
  const view = PNG.sync.read(readFileSync('public/backdrops/shop-view.png'));
  const img = { width: view.width, height: view.height, data: new Uint8ClampedArray(view.data) };

  it('keeps the painting for summer nights', () => {
    expect(gradeView(img, 'summer', 'night', 24, 150)).toEqual(img.data);
  });

  it('only touches pixels inside the window', () => {
    const out = gradeView(img, 'winter', 'afternoon', 24, 150, 'snow');
    let changed = 0;
    for (let i = 0; i < out.length; i += 4) {
      if (img.data[i + 3] === 0) expect(out[i + 3]).toBe(0);
      else if (out[i] !== img.data[i] || out[i + 1] !== img.data[i + 1] || out[i + 2] !== img.data[i + 2]) changed++;
    }
    expect(changed).toBeGreaterThan(10000);
  });
});
