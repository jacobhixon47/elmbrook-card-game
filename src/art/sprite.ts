import { PALETTE, TRANSPARENT, type PaletteKey } from './palette';

/**
 * Art as code: a sprite is a grid of palette keys, one string per row.
 * `recolor` produces variants (e.g. potion tints) without new grids.
 */
export type SpriteDef = {
  id: string;
  rows: readonly string[];
};

export type Rgba = [number, number, number, number];

export function spriteSize(def: SpriteDef): { width: number; height: number } {
  return { width: def.rows[0]?.length ?? 0, height: def.rows.length };
}

export function recolor(def: SpriteDef, id: string, map: Partial<Record<PaletteKey, PaletteKey>>): SpriteDef {
  return {
    id,
    rows: def.rows.map((row) =>
      [...row].map((ch) => (ch in map ? map[ch as PaletteKey] : ch)).join(''),
    ),
  };
}

/** Problems with a sprite grid; empty when valid. */
export function validateSprite(def: SpriteDef): string[] {
  const errors: string[] = [];
  const { width } = spriteSize(def);
  if (width === 0) errors.push(`${def.id}: empty sprite`);
  def.rows.forEach((row, y) => {
    if (row.length !== width) errors.push(`${def.id}: row ${y} is ${row.length} wide, expected ${width}`);
    for (const ch of row) {
      if (ch !== TRANSPARENT && !(ch in PALETTE)) errors.push(`${def.id}: row ${y} uses unknown colour '${ch}'`);
    }
  });
  return errors;
}

/** RGBA pixels, row-major. Used by both the game (canvas textures) and node scripts (PNG). */
export function rasterize(def: SpriteDef): { width: number; height: number; data: Uint8ClampedArray } {
  const { width, height } = spriteSize(def);
  const data = new Uint8ClampedArray(width * height * 4);
  def.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === TRANSPARENT) return;
      const color = PALETTE[ch as PaletteKey];
      const i = (y * width + x) * 4;
      data[i] = parseInt(color.slice(1, 3), 16);
      data[i + 1] = parseInt(color.slice(3, 5), 16);
      data[i + 2] = parseInt(color.slice(5, 7), 16);
      data[i + 3] = 255;
    });
  });
  return { width, height, data };
}
