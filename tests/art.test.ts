import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { BACKDROPS } from '../src/art/backdrops';
import { PALETTE } from '../src/art/palette';
import { proceduralTextures } from '../src/art/procedural';
import { spriteSize, validateSprite } from '../src/art/sprite';
import { SPRITES } from '../src/art/sprites';

describe('art', () => {
  it('every sprite grid is rectangular and on-palette', () => {
    for (const def of SPRITES) expect(validateSprite(def)).toEqual([]);
  });

  it('icons are 16x16', () => {
    for (const def of SPRITES) expect(spriteSize(def)).toEqual({ width: 16, height: 16 });
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
