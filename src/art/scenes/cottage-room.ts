import { seedRng } from '../../core/rng';
import type { Season } from '../../core';
import { fbm, valueNoise } from '../noise';
import { PALETTE, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { pick, rand, type Rng } from './town';

// The walkable cottage (GDD §13, M4.5): a witch's cottage at dusk, seen from above like Stardew.
// Fieldstone walls between dark timbers, a flagstone floor, a big stone hearth in the middle of the
// back wall, and everything lit by the fire, candles and lanterns: light is baked into every pixel
// from `ROOM_LIGHTS`, so the corners fall into shadow. Room space is 320x180, drawn at 2x. Each
// station and prop is its own sprite (lit for where it stands) so the scene can sort it with you.

export const ROOM_SPRITE_W = 320;
export const ROOM_SPRITE_H = 180;

export type RoomLight = { x: number; y: number; radius: number; power: number; kind: 'fire' | 'candle' | 'lantern' | 'brew' };

/** Everything that gives light, in room pixels. The scene puts a flickering glow on each. */
export const ROOM_LIGHTS: readonly RoomLight[] = [
  { x: 160, y: 40, radius: 130, power: 1, kind: 'fire' },
  { x: 137, y: 15, radius: 34, power: 0.3, kind: 'candle' },
  { x: 183, y: 15, radius: 34, power: 0.3, kind: 'candle' },
  { x: 88, y: 30, radius: 44, power: 0.35, kind: 'candle' },
  { x: 228, y: 30, radius: 44, power: 0.35, kind: 'candle' },
  { x: 44, y: 92, radius: 60, power: 0.55, kind: 'candle' },
  { x: 299, y: 98, radius: 60, power: 0.55, kind: 'candle' },
  { x: 134, y: 164, radius: 62, power: 0.55, kind: 'lantern' },
  { x: 186, y: 164, radius: 62, power: 0.55, kind: 'lantern' },
  { x: 289, y: 52, radius: 40, power: 0.3, kind: 'brew' },
  { x: 57, y: 128, radius: 50, power: 0.45, kind: 'candle' },
];

/** How lit a spot is, 0 (dark) to 1, from every light in the room. */
export function roomLight(x: number, y: number): number {
  let total = 0.18;
  for (const l of ROOM_LIGHTS) {
    const d = Math.hypot(x - l.x, (y - l.y) * 1.15) / l.radius;
    total += l.power * Math.max(0, 1 - d) ** 1.3;
  }
  return Math.min(1, total);
}

const STONE: readonly PaletteKey[] = ['K', 'k', 'q', 'j', 'J', 'h', 'H', 'a'];
const FLAG: readonly PaletteKey[] = ['K', 'k', 'b', 'j', 'J', 'h', 'H', 'a'];
const WOOD: readonly PaletteKey[] = ['K', 'k', 'b', 'B', 'n', 'a'];
const BOOKS: readonly PaletteKey[] = ['r', 'R', 'U', 'G', 'P', 'y', 'o', 'T', 'i'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x: number, y: number) => ((BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] ?? 0) + 0.5) / 16;

/** One step darker for every palette colour, for lighting sprites by where they stand. */
const DARKER: Record<PaletteKey, PaletteKey> = {
  K: 'K', k: 'K', q: 'k', Q: 'q', z: 'K', Z: 'z', x: 'Z', X: 'x', u: 'z', U: 'u', c: 'U',
  j: 'k', J: 'j', h: 'J', H: 'h', a: 'H', b: 'k', B: 'b', n: 'B', w: 'a', W: 'w',
  y: 'y', Y: 'Y', o: 'B', r: 'j', R: 'r', i: 'r', I: 'i', g: 'K', G: 'g', l: 'G', L: 'l',
  p: 'k', P: 'p', v: 'P', m: 'e', s: 'k', S: 's', e: 'S', T: 'g', t: 'T',
};
const KEY_OF = new Map(Object.entries(PALETTE).map(([k, v]) => [v.slice(1).toLowerCase(), k as PaletteKey]));
const keyAt = (p: Pixmap, x: number, y: number): PaletteKey | null => {
  const i = (y * p.width + x) * 4;
  const hex = ((p.data[i]! << 16) | (p.data[i + 1]! << 8) | p.data[i + 2]!).toString(16).padStart(6, '0');
  return KEY_OF.get(hex) ?? null;
};

/**
 * Darkens a sprite for the light where it stands (its top-left at `at`, room pixels): up to two
 * dithered steps in the shadows, none by the fire. Flames and lit glass (y, Y) never darken.
 */
export function lightSprite(p: Pixmap, at: { x: number; y: number }): Pixmap {
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (!p.isSet(x, y)) continue;
      const key = keyAt(p, x, y);
      if (!key) continue;
      const dark = Math.max(0, 0.75 - roomLight(at.x + x, at.y + y)) * 2;
      let steps = Math.floor(dark + dither(at.x + x, at.y + y));
      let k = key;
      while (steps-- > 0) k = DARKER[k];
      if (k !== key) p.set(x, y, k);
    }
  }
  return p;
}

/** The code-drawn window view by season: sky, far hills, near hills. */
const VIEW: Record<Season, [PaletteKey, PaletteKey, PaletteKey]> = {
  spring: ['Q', 'G', 'g'],
  summer: ['P', 'l', 'G'],
  autumn: ['Q', 'o', 'B'],
  winter: ['x', 'm', 'e'],
};

/** Where the two windows' panes are, room pixels: the view shows through them. */
export const ROOM_WINDOWS = [
  { x: 56, y: 8, w: 34, h: 22 },
  { x: 224, y: 8, w: 34, h: 22 },
] as const;

// ---------------------------------------------------------------- the shell

/** Irregular fieldstones with worn corners, grain and the room's light. */
function fieldstone(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, y1: number, ramp: readonly PaletteKey[], base: number, size: [number, number], floor = false): void {
  let y = y0;
  while (y < y1) {
    const h = size[0] + Math.floor(rand(r) * 4);
    let x = x0 - Math.floor(rand(r) * 14);
    while (x < x1) {
      const w = size[1] + Math.floor(rand(r) * (floor ? 14 : 10));
      const tone = (rand(r) - 0.5) * 0.14;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = x + i;
          const py = y + j;
          if (px < x0 || px >= x1 || py >= y1 || py < y0) continue;
          const light = roomLight(px, py);
          const mortar = i === w - 1 || j === h - 1;
          // Flagstones are worn rounder at the corners.
          const ci = Math.min(i, w - 2 - i);
          const cj = Math.min(j, h - 2 - j);
          const corner = floor ? ci + cj < 2 : (i === 0 || i === w - 2) && (j === 0 || j === h - 2);
          if (mortar || corner) {
            p.shade(px, py, ramp, base * 0.3 + light * 0.22);
            continue;
          }
          const bevel = j === 0 ? 0.12 : i === 0 ? 0.06 : j === h - 2 ? -0.12 : 0;
          const grain = (fbm(px, py, 5, 7) - 0.5) * (floor ? 0.14 : 0.24);
          p.shade(px, py, ramp, base + light * 0.7 + tone + bevel + grain);
        }
      }
      x += w;
    }
    y += h;
  }
}

/** Dark timber with grain, lit by the room. */
function timber(p: Pixmap, x0: number, y0: number, w: number, h: number, vertical: boolean): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const along = vertical ? y : x;
      const across = vertical ? x : y;
      const grain = (valueNoise(along, across * 6, 9, 5) - 0.5) * 0.2;
      const edge = across === (vertical ? x0 : y0) ? 0.15 : across === (vertical ? x0 + w - 1 : y0 + h - 1) ? -0.2 : 0;
      p.shade(x, y, WOOD, 0.12 + roomLight(x, y) * 0.55 + grain + edge);
    }
  }
}

/** A window frame round one of `ROOM_WINDOWS`, panes left clear, with a deep sill and a candle. */
function windowFrame(p: Pixmap, w: { x: number; y: number; w: number; h: number }, candleX: number): void {
  for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) p.clear(x, y);
  timber(p, w.x - 3, w.y - 3, w.w + 6, 3, false);
  timber(p, w.x - 3, w.y, 3, w.h, true);
  timber(p, w.x + w.w, w.y, 3, w.h, true);
  // Four panes: a cross of mullions.
  const mx = w.x + Math.floor(w.w / 2) - 1;
  const my = w.y + Math.floor(w.h / 2);
  for (let y = w.y; y < w.y + w.h; y++) p.set(mx, y, 'b').set(mx + 1, y, 'k');
  p.hline(w.x, w.x + w.w - 1, my, 'b');
  // The sill, deep enough for a candle and a plant.
  timber(p, w.x - 5, w.y + w.h, w.w + 10, 4, false);
  p.hline(w.x - 5, w.x + w.w + 4, w.y + w.h + 4, 'K');
  candle(p, candleX, w.y + w.h - 5);
  // A little potted herb at the other end.
  const px = candleX < w.x + w.w / 2 ? w.x + w.w - 6 : w.x + 2;
  p.fillRect(px, w.y + w.h - 3, 5, 3, 'B').hline(px, px + 4, w.y + w.h - 3, 'n');
  for (const [dx, dy] of [[0, -4], [2, -6], [4, -4], [1, -2], [3, -2], [2, -3]] as const) p.set(px + dx, w.y + w.h + dy, dy < -3 ? 'l' : 'G');
}

/** A short candle with a flame, its bottom at y. */
function candle(p: Pixmap, x: number, y: number): void {
  p.fillRect(x, y + 1, 3, 4, 'w').set(x + 2, y + 2, 'a').hline(x - 1, x + 3, y + 5, 'S');
  p.set(x + 1, y, 'Y').set(x + 1, y - 1, 'y');
}

/** A bundle of herbs hung upside down to dry, from a nail at x, y. */
function herbs(p: Pixmap, x: number, y: number, leaf: readonly PaletteKey[]): void {
  p.set(x, y, 'k').set(x, y + 1, 'n').set(x, y + 2, 'n');
  for (let j = 0; j < 9; j++) {
    const half = Math.min(3, 1 + Math.floor(j / 2));
    for (let i = -half; i <= half; i++) if ((i + j) % 3 !== 0 || j > 5) p.set(x + i, y + 3 + j, leaf[(i + j + 9) % leaf.length]!);
  }
}

/** Walls, floor, hearth and windows: everything you walk on or can't reach. */
export function roomShell(): Pixmap {
  const p = new Pixmap(ROOM_SPRITE_W, ROOM_SPRITE_H);
  const rng: Rng = { s: seedRng('witch-cottage') };

  // The floor: big worn flagstones.
  fieldstone(p, rng, 0, ROOM_SPRITE_W, 48, ROOM_SPRITE_H, FLAG, 0.16, [10, 11], true);
  // Shadow along the foot of the back wall.
  for (let x = 0; x < ROOM_SPRITE_W; x++) for (let y = 48; y < 51; y++) if (dither(x, y) < (51 - y) / 4) p.set(x, y, 'k');

  // The back wall: fieldstone between timber posts, a beam along the top and a dark skirting.
  fieldstone(p, rng, 0, ROOM_SPRITE_W, 5, 46, STONE, 0.06, [7, 10]);
  timber(p, 0, 0, ROOM_SPRITE_W, 5, false);
  p.hline(0, ROOM_SPRITE_W - 1, 5, 'K');
  for (const bx of [8, 50, 94, 194, 264, 310]) {
    timber(p, bx, 5, 4, 41, true);
    p.set(bx + 1, 7, 'k').set(bx + 1, 40, 'k');
  }
  timber(p, 0, 44, ROOM_SPRITE_W, 4, false);
  p.hline(0, ROOM_SPRITE_W - 1, 47, 'K');

  // The chimney breast: bigger, paler stones standing out from the wall, the hearth in it.
  fieldstone(p, rng, 128, 192, 0, 48, STONE, 0.14, [8, 12]);
  for (let y = 0; y < 48; y++) p.set(127, y, 'K').set(192, y, 'K');
  // The hearth's mouth, an arch over the fire and its blackened back.
  for (let y = 24; y < 46; y++) {
    for (let x = 140; x < 180; x++) {
      const dx = (x - 159.5) / 20;
      const top = 24 + Math.round((1 - Math.sqrt(Math.max(0, 1 - dx * dx))) * 8);
      if (y < top) continue;
      p.set(x, y, y > 40 ? 'k' : dither(x, y) < (y - 24) / 30 ? 'K' : 'k');
    }
  }
  for (let x = 140; x < 180; x++) {
    const dx = (x - 159.5) / 20;
    const top = 24 + Math.round((1 - Math.sqrt(Math.max(0, 1 - dx * dx))) * 8);
    p.set(x, top - 1, 'j').set(x, top - 2, 'J');
  }
  // Logs and the grate (the flames are the scene's, so they can dance).
  p.fillRect(146, 40, 28, 3, 'b').hline(146, 173, 40, 'B').fillRect(150, 38, 20, 2, 'B').hline(150, 169, 38, 'n');
  p.hline(144, 175, 43, 'S').hline(144, 175, 44, 's');
  for (let x = 146; x < 175; x += 4) p.set(x, 42, 'S');
  // Log niches either side of the mouth.
  for (const nx of [130, 182]) {
    p.fillRect(nx, 30, 9, 15, 'K');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) p.fillEllipse(nx + 2.5 + i * 4, 33 + j * 4.5, 2, 2, j % 2 ? 'B' : 'n').set(nx + 2 + i * 4, 33 + j * 4, 'a');
  }
  // The mantel, with a candle at each end and a little painting above.
  timber(p, 128, 19, 64, 4, false);
  p.hline(128, 191, 23, 'K');
  candle(p, 136, 13);
  candle(p, 182, 13);
  p.fillRect(150, 5, 20, 13, 'b').fillRect(152, 7, 16, 9, 'Z');
  for (let x = 152; x < 168; x++) for (let y = 11 + Math.round(Math.sin(x / 2.5) * 1.5); y < 16; y++) p.set(x, y, y > 13 ? 'g' : 'G');
  p.set(164, 8, 'Y').hline(150, 169, 5, 'B');
  // The apron: one big hearthstone in front of the fire.
  for (let y = 48; y < 58; y++) for (let x = 130; x < 190; x++) {
    const edge = y === 57 || x === 130 || x === 189;
    p.shade(x, y, STONE, edge ? 0.15 : 0.3 + roomLight(x, y) * 0.55 + (fbm(x, y, 4, 3) - 0.5) * 0.2 + (y === 48 ? 0.15 : 0));
  }

  // The two windows, each with a sill candle and a pot.
  windowFrame(p, ROOM_WINDOWS[0], 82);
  windowFrame(p, ROOM_WINDOWS[1], 226);
  // Herbs drying from the beam, and a spare hat and broom on pegs above the cauldron.
  herbs(p, 104, 5, ['g', 'G', 'G']);
  herbs(p, 112, 5, ['G', 'l', 'g']);
  herbs(p, 208, 5, ['B', 'n', 'G']);
  herbs(p, 270, 5, ['g', 'G', 'l']);
  herbs(p, 278, 5, ['j', 'P', 'G']);
  // The hat, on its peg.
  p.set(297, 9, 'n');
  for (let i = 0; i < 7; i++) {
    const half = Math.max(0, 5 - Math.floor(i * 0.8));
    p.hline(297 - half, 297 + half, 18 - i, i === 1 ? 'y' : i === 0 ? 'p' : 'P');
  }
  p.hline(289, 305, 19, 'p').hline(290, 304, 18, 'P');
  // The broom, leaning by the hat.
  for (let y = 10; y < 40; y++) p.set(307 - Math.floor((y - 10) / 10), y, y > 31 ? 'n' : 'B');
  for (let y = 32; y < 42; y++) for (let x = -2; x <= 2; x++) if ((x + y) % 2 === 0 || y > 37) p.set(304 + x, y, y > 38 ? 'B' : 'n');

  // Side walls and the front wall: heavy timber.
  timber(p, 0, 0, 8, ROOM_SPRITE_H, true);
  timber(p, ROOM_SPRITE_W - 8, 0, 8, ROOM_SPRITE_H, true);
  for (let y = 0; y < ROOM_SPRITE_H; y++) p.set(8, y, 'K').set(ROOM_SPRITE_W - 9, y, 'K').set(0, y, 'K').set(ROOM_SPRITE_W - 1, y, 'K');
  timber(p, 0, 172, ROOM_SPRITE_W, 8, false);
  p.hline(0, ROOM_SPRITE_W - 1, 171, 'K');
  // The doorway, open onto the dark step, with a lantern on each side.
  p.fillRect(144, 171, 32, 9, 'K').fillRect(146, 172, 28, 8, 'k');
  for (const lx of [131, 183]) {
    p.fillRect(lx, 160, 7, 9, 'k').fillRect(lx + 1, 161, 5, 7, 'y').fillRect(lx + 2, 162, 3, 5, 'Y').hline(lx - 1, lx + 7, 159, 's').hline(lx, lx + 6, 169, 's');
    p.set(lx + 3, 158, 'S').set(lx + 3, 170, 'S');
  }
  // The corners fall away into shadow.
  for (let y = 0; y < ROOM_SPRITE_H; y++) {
    for (let x = 0; x < ROOM_SPRITE_W; x++) {
      const v = Math.max(0, Math.hypot((x - 160) / 175, (y - 80) / 120) - 0.78) * 3;
      if (v > dither(x, y) && p.isSet(x, y)) {
        const k = keyAt(p, x, y);
        if (k && k !== 'y' && k !== 'Y') p.set(x, y, DARKER[k]);
      }
    }
  }
  return p;
}

/** The window's view drawn in code, for ?backdrops=code. 34x22. */
export function roomView(season: Season): Pixmap {
  const p = new Pixmap(34, 22);
  const [sky, far, near] = VIEW[season];
  p.fillRect(0, 0, 34, 22, sky);
  for (let x = 0; x < 34; x++) {
    const h1 = 9 + Math.round(Math.sin(x / 6) * 2);
    const h2 = 15 + Math.round(Math.sin(x / 4 + 1) * 1.5);
    for (let y = h1; y < 22; y++) p.set(x, y, y >= h2 ? near : far);
  }
  if (season === 'winter') for (let x = 0; x < 34; x += 3) p.set(x, 9 + Math.round(Math.sin(x / 6) * 2), 'W');
  p.set(26, 3, 'w').set(8, 5, 'W').set(17, 2, 'w');
  return p;
}

// ---------------------------------------------------------------- furniture

/** A station's or prop's sprite, unlit (see `lightSprite`). */
export function roomSprite(id: string): Pixmap {
  switch (id) {
    case 'bookshelf': return bookshelf();
    case 'lectern': return lectern();
    case 'pinboard': return pinboard();
    case 'calendar': return calendar();
    case 'cauldron': return cauldron();
    case 'workbench': return workbench();
    case 'door': return door();
    case 'rug': return rug();
    case 'cat': return cat(0);
    case 'cat-1': return cat(1);
    case 'armchair': return armchair();
    case 'side-table': return sideTable();
    case 'bed': return bed();
    case 'plant': return plant();
    case 'nightstand': return nightstand();
    case 'round-rug': return roundRug();
    case 'garland-spring': return garland(['I', 'i', 'W'], 'l');
    case 'garland-autumn': return garland(['o', 'R', 'y'], 'n');
    case 'garland-winter': return garland(['R', 'R', 'W'], 'G');
    case 'blossoms': return blossoms();
    case 'firefly-jar': return fireflyJar();
    case 'sunflowers': return sunflowers();
    case 'pumpkins': return pumpkins();
    case 'leaves': return leaves();
    case 'sill-snow': return sillSnow();
    case 'snowdrift': return snowdrift();
    default: throw new Error(`no room sprite ${id}`);
  }
}

/** The same sprite with a bright 1px outline, for when you can use it. One pixel bigger all round. */
export function litSprite(src: Pixmap): Pixmap {
  const p = new Pixmap(src.width + 2, src.height + 2);
  p.blit(src, 1, 1);
  return p.outline('Y');
}

/** The fire in the hearth, three frames of flames over the logs. 28x14. */
export function fire(frame: 0 | 1 | 2): Pixmap {
  const p = new Pixmap(28, 14);
  const tongues: readonly (readonly [number, number])[] = (
    [
      [[5, 6], [10, 11], [14, 13], [18, 10], [23, 6]],
      [[4, 5], [9, 9], [14, 12], [19, 11], [24, 5]],
      [[6, 7], [11, 12], [15, 10], [19, 12], [22, 6]],
    ] as const
  )[frame];
  for (const [cx, h] of tongues) {
    for (let j = 0; j < h; j++) {
      const half = Math.max(0, Math.round((1 - j / h) * 3.2));
      for (let i = -half; i <= half; i++) {
        const core = Math.abs(i) < half - 1 && j < h * 0.6;
        p.set(cx + i, 13 - j, core ? (j < h * 0.35 ? 'W' : 'Y') : j > h * 0.7 ? 'R' : 'o');
      }
    }
  }
  p.hline(3, 24, 13, 'y');
  return p;
}

/** A puff of steam off the cauldron. 5x5. */
export function steam(): Pixmap {
  return new Pixmap(5, 5).fillEllipse(2.5, 2.5, 2.5, 2.5, 'm').set(1, 1, 'W');
}

function bookshelf(): Pixmap {
  const p = new Pixmap(36, 54);
  const rng: Rng = { s: seedRng('bookshelf') };
  p.fillRect(0, 2, 36, 52, 'b').strokeRect(0, 2, 36, 52, 'k').fillRect(1, 2, 34, 3, 'B').hline(1, 34, 2, 'n');
  for (let s = 0; s < 4; s++) {
    const y0 = 6 + s * 11;
    p.fillRect(3, y0, 30, 9, 'k');
    let x = 4;
    while (x < 32) {
      // Now and then a jar or a skull instead of books.
      if ((s === 1 && x > 22) || (s === 3 && x < 9)) {
        p.fillRect(x, y0 + 3, 5, 6, s === 1 ? 'T' : 'G').set(x + 1, y0 + 4, 't').hline(x, x + 4, y0 + 2, 'n');
        x += 6;
        continue;
      }
      const w = pick(rng, [2, 2, 3, 3, 4]);
      const c = pick(rng, BOOKS);
      const h = 6 + ((x * 5 + s) % 3);
      if (x + w > 32) break;
      p.fillRect(x, y0 + 9 - h, w, h, c).set(x, y0 + 9 - h, 'w');
      x += w + ((x + s) % 5 === 0 ? 1 : 0);
    }
    p.hline(1, 34, y0 + 9, 'B').hline(1, 34, y0 + 10, 'b');
  }
  // A trailing plant on top.
  for (const [x, y] of [[26, 0], [28, 1], [30, 0], [27, 2], [31, 3], [32, 6], [33, 9], [33, 12], [29, 1]] as const) p.set(x, y, x % 2 ? 'G' : 'l');
  return p.outline('K');
}

function lectern(): Pixmap {
  const p = new Pixmap(18, 24);
  p.fillRect(7, 10, 4, 12, 'B').set(7, 10, 'n').fillRect(3, 21, 12, 3, 'b').hline(3, 14, 21, 'B');
  p.fillRect(0, 3, 18, 8, 'b').strokeRect(0, 3, 18, 8, 'k');
  // The Almanac, open, with a ribbon and a moon on its page.
  p.fillRect(1, 0, 8, 8, 'w').fillRect(9, 0, 8, 8, 'W').hline(2, 7, 2, 'h').hline(2, 6, 4, 'h').hline(10, 15, 5, 'h');
  p.set(12, 2, 'y').set(13, 2, 'y').set(13, 1, 'y');
  p.fillRect(8, 0, 2, 9, 'r').set(8, 9, 'R');
  return p.outline('K');
}

function pinboard(): Pixmap {
  const p = new Pixmap(28, 24);
  p.fillRect(0, 0, 28, 24, 'b').fillRect(2, 2, 24, 20, 'n');
  for (let y = 2; y < 22; y++) for (let x = 2; x < 26; x++) if ((x * 7 + y * 3) % 11 === 0) p.set(x, y, 'B');
  for (const [x, y, w, h, c] of [[4, 4, 8, 7, 'w'], [14, 3, 9, 6, 'a'], [5, 13, 7, 7, 'I'], [15, 11, 9, 9, 'w']] as const) {
    p.fillRect(x + 1, y + 1, w, h, 'b').fillRect(x, y, w, h, c).set(x + Math.floor(w / 2), y, 'R');
    p.hline(x + 1, x + w - 2, y + 3, 'h');
  }
  // A dried flower and a ribbon tucked in the corner.
  p.set(24, 3, 'i').set(23, 4, 'I').set(24, 5, 'G').set(24, 6, 'G');
  return p.outline('K');
}

function calendar(): Pixmap {
  const p = new Pixmap(18, 22);
  p.set(9, 0, 'k').set(8, 1, 'n').set(10, 1, 'n');
  p.fillRect(1, 2, 16, 20, 'w').strokeRect(1, 2, 16, 20, 'h').fillRect(1, 2, 16, 5, 'p');
  // The moon's phases across the top, the days below.
  for (let i = 0; i < 4; i++) p.set(4 + i * 3, 4, i === 2 ? 'W' : 'v');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) p.set(4 + c * 3, 9 + r * 3, r === 1 && c === 2 ? 'R' : 'h');
  return p.outline('K');
}

function cauldron(): Pixmap {
  const p = new Pixmap(36, 32);
  // Three iron legs on a hearthstone.
  p.fillEllipse(18, 28, 16, 4, 'J').fillEllipse(18, 27.5, 14, 3, 'h');
  for (const lx of [8, 17, 27]) p.fillRect(lx, 22, 2, 5, 'k');
  // The pot: round iron, a rim, a bubbling green brew.
  p.fillEllipse(18, 16, 15, 10, 's').fillEllipse(16, 15, 11, 7, 'S');
  for (let y = 7; y < 26; y++) for (let x = 3; x < 33; x++) if (p.isSet(x, y) && (x - 18) ** 2 / 225 + (y - 16) ** 2 / 100 > 0.82) p.set(x, y, 'k');
  p.fillEllipse(18, 8, 14, 4, 'k').fillEllipse(18, 8, 12, 3, 'g').fillEllipse(18, 7.5, 10, 2.2, 'G');
  for (const [x, y] of [[12, 7], [20, 8], [24, 7], [16, 8]] as const) p.set(x, y, 'L');
  p.set(14, 6, 'l').set(22, 6, 'l');
  // A ladle resting in it.
  for (let i = 0; i < 9; i++) p.set(25 + Math.floor(i / 2), 6 - i, 'n');
  p.set(30, -3, 'n');
  // Highlights on the iron.
  p.hline(9, 13, 12, 'e').set(8, 14, 'e').set(8, 15, 'e');
  return p.outline('K');
}

function workbench(): Pixmap {
  const p = new Pixmap(40, 32);
  p.fillRect(0, 8, 40, 12, 'B').strokeRect(0, 8, 40, 12, 'k').hline(1, 38, 9, 'n');
  for (let x = 2; x < 38; x += 7) p.set(x, 13, 'b');
  p.fillRect(2, 20, 4, 12, 'b').fillRect(34, 20, 4, 12, 'b').fillRect(2, 25, 36, 2, 'k');
  // On it: bottles, a mortar and pestle, an open book of recipes, a candle.
  p.fillRect(3, 1, 5, 9, 'T').strokeRect(3, 1, 5, 9, 'k').set(4, 2, 't').fillRect(4, 0, 3, 1, 'n');
  p.fillRect(9, 4, 4, 6, 'r').strokeRect(9, 4, 4, 6, 'k').set(10, 5, 'I').set(10, 3, 'n');
  p.fillEllipse(17, 9, 3, 2, 'S').fillEllipse(17, 8.5, 2, 1, 'k').set(18, 6, 'e').set(19, 5, 'e');
  p.fillRect(21, 9, 11, 6, 'w').fillRect(26, 9, 1, 6, 'h').hline(22, 25, 11, 'h').hline(27, 30, 12, 'h');
  p.fillRect(33, 4, 3, 5, 'w').set(34, 3, 'Y').set(34, 2, 'y').hline(32, 36, 9, 'S');
  return p.outline('K');
}

function door(): Pixmap {
  const p = new Pixmap(32, 20);
  // A woven mat inside the door.
  p.fillRect(3, 1, 26, 9, 'B').strokeRect(3, 1, 26, 9, 'b');
  for (let y = 2; y < 9; y++) for (let x = 4; x < 28; x++) if ((x + y) % 3 === 0) p.set(x, y, 'n');
  // The threshold, a worn stone step.
  p.fillRect(0, 11, 32, 3, 'h').hline(0, 31, 11, 'H').hline(0, 31, 14, 'k');
  return p;
}

function rug(): Pixmap {
  const p = new Pixmap(104, 40);
  p.fillRect(0, 2, 104, 36, 'r').strokeRect(0, 2, 104, 36, 'j');
  p.strokeRect(3, 5, 98, 30, 'o').strokeRect(5, 7, 94, 26, 'j');
  // A diamond medallion and little crosses around the border.
  for (let y = 9; y < 31; y++) {
    const half = Math.round((1 - Math.abs(y - 20) / 11) * 22);
    for (let x = 52 - half; x <= 52 + half; x++) p.set(x, y, Math.abs(x - 52) + Math.abs(y - 20) * 2 > 18 ? 'R' : 'r');
  }
  p.fillRect(48, 18, 9, 5, 'o').set(52, 20, 'y');
  for (let x = 9; x < 96; x += 8) p.set(x, 4, 'a').set(x, 36, 'a');
  // Fringe at each end.
  for (let x = 1; x < 103; x += 2) p.set(x, 0, 'a').set(x, 1, 'a').set(x, 38, 'a').set(x, 39, 'a');
  return p;
}

/** The cat, asleep in a curl; frame 1 is a breath in. 16x10. */
function cat(frame: 0 | 1): Pixmap {
  const p = new Pixmap(16, 10);
  const b = frame;
  p.fillEllipse(8, 6, 7 + b * 0.4, 4 + b * 0.3, 'o').fillEllipse(9, 6.5, 4, 2.5, 'n');
  // Stripes, a white chest and the tail curled round.
  for (const x of [5, 8, 11]) p.set(x, 3 - b, 'B').set(x, 4 - b, 'B');
  p.fillEllipse(4, 7, 2.5, 2, 'w');
  for (let x = 6; x < 14; x++) p.set(x, 9, 'o');
  p.set(14, 8, 'o').set(14, 7, 'w');
  // Ears and a closed eye.
  p.set(2, 4, 'o').set(3, 3, 'o').set(5, 3, 'o').hline(3, 4, 6, 'k');
  return p.outline('K');
}

/** A deep armchair turned to the fire, a throw over its back. 28x30. */
function armchair(): Pixmap {
  const p = new Pixmap(28, 30);
  p.fillRect(2, 4, 24, 24, 'r').strokeRect(2, 4, 24, 24, 'j');
  p.fillRect(0, 6, 5, 20, 'R').fillRect(23, 6, 5, 20, 'R').strokeRect(0, 6, 5, 20, 'j').strokeRect(23, 6, 5, 20, 'j');
  p.fillRect(6, 4, 16, 14, 'R').hline(6, 21, 4, 'I');
  p.fillRect(4, 18, 20, 10, 'r').hline(5, 22, 18, 'j');
  // The throw, cream with a stripe, over the back.
  p.fillRect(3, 20, 22, 8, 'w').hline(3, 24, 23, 'h').hline(3, 24, 27, 'a');
  for (let x = 4; x < 25; x += 2) p.set(x, 28, 'a');
  return p.outline('K');
}

function sideTable(): Pixmap {
  const p = new Pixmap(20, 20);
  p.fillEllipse(10, 10, 9, 6, 'B').fillEllipse(10, 9.5, 8, 5, 'n');
  p.fillRect(8, 15, 4, 5, 'b');
  // A candle, a cup and a book.
  p.fillRect(8, 1, 3, 6, 'w').set(10, 2, 'a').set(9, 0, 'Y').hline(7, 11, 7, 'S');
  p.fillRect(13, 8, 3, 3, 'e').set(16, 9, 'e').set(14, 8, 'k');
  p.fillRect(3, 9, 5, 4, 'U').hline(3, 7, 9, 'c');
  return p.outline('K');
}

function bed(): Pixmap {
  const p = new Pixmap(36, 38);
  p.fillRect(0, 0, 36, 7, 'b').strokeRect(0, 0, 36, 7, 'k').hline(1, 34, 1, 'B');
  for (const x of [2, 33]) p.fillRect(x - 1, 0, 3, 38, 'b');
  p.fillRect(2, 6, 32, 30, 'w').fillRect(4, 8, 28, 8, 'W').strokeRect(4, 8, 28, 8, 'a');
  // A green quilt, stitched in squares.
  p.fillRect(2, 17, 32, 19, 'G').hline(2, 33, 17, 'l');
  for (let y = 21; y < 36; y += 5) p.hline(3, 32, y, 'g');
  for (let x = 7; x < 33; x += 6) for (let y = 18; y < 36; y++) p.set(x, y, 'g');
  p.fillRect(0, 35, 36, 3, 'b').hline(0, 35, 35, 'B');
  return p.outline('K');
}

/** A stool by the bed with a candle in a dish. 12x16. */
function nightstand(): Pixmap {
  const p = new Pixmap(12, 16);
  p.fillRect(1, 6, 10, 5, 'B').hline(1, 10, 6, 'n').fillRect(2, 11, 2, 5, 'b').fillRect(8, 11, 2, 5, 'b');
  p.fillEllipse(6, 6, 3, 1.2, 'S').fillRect(5, 1, 3, 5, 'w').set(7, 2, 'a').set(6, 0, 'Y');
  return p.outline('K');
}

/** A round braided rug, blue-green, by the door. 60x28. */
function roundRug(): Pixmap {
  const p = new Pixmap(60, 28);
  const rings: readonly PaletteKey[] = ['g', 'T', 'x', 'T', 'g', 'T', 'G'];
  for (let k = 0; k < rings.length; k++) p.fillEllipse(30, 14, 30 - k * 3.6, 14 - k * 1.7, rings[k]!);
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    p.set(Math.round(30 + Math.cos(t) * 25), Math.round(14 + Math.sin(t) * 11.5), 'k');
  }
  return p;
}

function plant(): Pixmap {
  const p = new Pixmap(16, 24);
  p.fillRect(3, 16, 10, 8, 'B').strokeRect(3, 16, 10, 8, 'b').hline(2, 13, 16, 'n');
  for (const [cx, cy, rx, ry] of [[8, 9, 6, 5], [4, 7, 3, 4], [12, 6, 3, 4], [8, 3, 3, 3]] as const) p.fillEllipse(cx, cy, rx, ry, 'G');
  for (const [x, y] of [[6, 6], [10, 4], [5, 10], [11, 9], [8, 2], [3, 5], [13, 5]] as const) p.set(x, y, 'l');
  for (const [x, y] of [[7, 12], [9, 13], [4, 11]] as const) p.set(x, y, 'g');
  return p.outline('K');
}

// The season's dressing (M4.5 part 2): what the house puts out for the season you'll play next.
// Where each goes is `DRESSING` in view/room.ts.
export const DRESSING_SPRITES = ['garland-spring', 'garland-autumn', 'garland-winter', 'blossoms', 'firefly-jar', 'sunflowers', 'pumpkins', 'leaves', 'sill-snow', 'snowdrift'] as const;

/** A swag of leaves and blooms over a window: `bloom` colours on a `leaf` vine. 44x12. */
function garland(bloom: readonly PaletteKey[], leaf: PaletteKey): Pixmap {
  const p = new Pixmap(44, 12);
  const sag = (x: number) => 2 + Math.round(Math.sin((x / 43) * Math.PI) * 5);
  for (let x = 0; x < 44; x++) {
    const y = sag(x);
    p.set(x, y, leaf).set(x, y + 1, leaf);
    // Leaf tufts above and below the vine.
    if (x % 3 === 0) p.set(x, y - 1, leaf).set(x + 1, y + 2, leaf);
  }
  for (let i = 0, x = 3; x < 41; x += 5, i++) {
    const y = sag(x);
    p.fillRect(x, y - 1, 2, 2, bloom[i % bloom.length]!).set(x + 1, y + 1, bloom[(i + 1) % bloom.length]!);
  }
  p.fillRect(0, 0, 2, 4, 'b').fillRect(42, 0, 2, 4, 'b');
  return p.outline('k');
}

/** Spring: blossom branches in a tall jug by the door. 18x30. */
function blossoms(): Pixmap {
  const p = new Pixmap(18, 30);
  p.fillRect(5, 18, 8, 12, 'm').strokeRect(5, 18, 8, 12, 'e').fillRect(6, 16, 6, 3, 'm').hline(6, 11, 16, 'e');
  p.hline(6, 11, 22, 'U').hline(6, 11, 23, 'U');
  // Branches, then the blossom along them.
  for (const [x0, x1, top] of [[8, 3, 4], [9, 14, 2], [9, 9, 0], [8, 1, 10], [10, 16, 9]] as const) {
    for (let y = 17; y >= top; y--) p.set(Math.round(x0 + ((x1 - x0) * (17 - y)) / (17 - top)), y, 'B');
  }
  for (const [x, y] of [[3, 4], [4, 7], [14, 2], [12, 5], [9, 0], [9, 4], [1, 10], [3, 12], [16, 9], [14, 12], [6, 9], [11, 9]] as const) {
    p.fillRect(x - 1, y, 2, 2, 'I').set(x, y, 'W');
  }
  return p.outline('k');
}

/** Summer: a jar of fireflies on the windowsill. 10x12. */
function fireflyJar(): Pixmap {
  const p = new Pixmap(10, 12);
  p.fillRect(1, 3, 8, 9, 'Z').strokeRect(1, 3, 8, 9, 'c').fillRect(2, 0, 6, 3, 'B').hline(2, 7, 2, 'n');
  for (const [x, y] of [[3, 5], [6, 6], [3, 8], [5, 9], [7, 9]] as const) p.set(x, y, 'L');
  p.set(5, 5, 'Y').set(4, 7, 'Y');
  return p.outline('k');
}

/** Summer: sunflowers in a pot. 16x24. */
function sunflowers(): Pixmap {
  const p = new Pixmap(16, 24);
  p.fillRect(3, 17, 10, 7, 'H').strokeRect(3, 17, 10, 7, 'h').hline(2, 13, 17, 'h');
  for (const [cx, cy, stem] of [[5, 4, 5], [11, 7, 11], [8, 2, 8]] as const) {
    for (let y = cy + 2; y < 17; y++) p.set(stem, y, 'G');
    p.fillEllipse(cx, cy, 3, 3, 'y').fillEllipse(cx, cy, 1.5, 1.5, 'B');
  }
  p.set(7, 11, 'l').set(9, 13, 'l').set(6, 14, 'l');
  return p;
}

/** Autumn: pumpkins by the hearth. 24x14. */
function pumpkins(): Pixmap {
  const p = new Pixmap(24, 14);
  const one = (cx: number, cy: number, rx: number, ry: number) => {
    p.fillEllipse(cx, cy, rx, ry, 'o');
    for (const dx of [-rx / 2, 0, rx / 2]) for (let y = Math.round(cy - ry + 1); y < cy + ry - 1; y++) p.set(Math.round(cx + dx), y, 'R');
    p.fillRect(cx - 1, cy - ry - 2, 2, 3, 'G');
  };
  one(7, 8, 6.5, 5.5);
  one(18, 10, 5, 4);
  return p.outline('k');
}

/** Autumn: a few leaves blown in over the step. 40x14, flat on the floor. */
function leaves(): Pixmap {
  const p = new Pixmap(40, 14);
  for (const [x, y, c] of [[4, 10, 'o'], [10, 6, 'R'], [17, 11, 'y'], [24, 4, 'o'], [30, 9, 'R'], [35, 12, 'o'], [14, 2, 'y']] as const) {
    p.fillRect(x, y, 3, 2, c).set(x + 1, y - 1, c).set(x + 3, y + 1, 'n');
  }
  return p;
}

/** Winter: snow along a windowsill. 44x4. */
function sillSnow(): Pixmap {
  const p = new Pixmap(44, 4);
  for (let x = 1; x < 43; x++) {
    const h = 2 + Math.round(Math.sin(x / 3) * 0.8 + Math.sin(x / 7));
    for (let y = 4 - h; y < 4; y++) p.set(x, y, y === 4 - h ? 'W' : 'm');
  }
  return p;
}

/** Winter: snow blown in over the step, in low drifts. 44x9, flat on the floor. */
function snowdrift(): Pixmap {
  const p = new Pixmap(44, 9);
  for (let x = 0; x < 44; x++) {
    const edge = Math.min(x, 43 - x);
    const h = Math.min(edge / 2, 3 + Math.round(Math.sin(x / 3) * 1.2 + Math.sin(x / 5 + 2)));
    for (let y = Math.round(9 - h); y < 9; y++) p.set(x, y, y === Math.round(9 - h) ? 'W' : 'm');
  }
  for (const [x, y] of [[4, 3], [12, 1], [30, 2], [39, 4], [21, 0]] as const) p.set(x, y, 'W');
  return p;
}

export type WizardFacing = 'down' | 'up' | 'left' | 'right';

/**
 * You (GDD §13): a small round being in wizard's robes and a pointed hat, no stats of its own.
 * 16x20, facing four ways, with two walking frames (frame 0 is also standing).
 */
export function wizard(face: WizardFacing, frame: 0 | 1): Pixmap {
  const p = new Pixmap(16, 20);
  const bob = frame;
  // Robe: a soft bell shape, darker at the hem.
  for (let y = 9; y < 18; y++) {
    const half = 3 + Math.min(4, Math.floor((y - 9) / 1.6));
    for (let x = 8 - half; x < 8 + half; x++) p.set(x, y + bob, y >= 16 ? 'p' : x < 8 - half + 2 ? 'p' : 'P');
  }
  // Feet peeking out, stepping on frame 1.
  if (frame) p.set(5, 19, 'k').set(10, 18, 'k');
  else p.set(5, 18, 'k').set(10, 18, 'k');
  // Face: a shadow under the brim, with two glints of eyes.
  p.fillRect(5, 7 + bob, 6, 3, 'q');
  if (face === 'down') p.set(6, 8 + bob, 'W').set(9, 8 + bob, 'W');
  if (face === 'left') p.set(5, 8 + bob, 'W').set(7, 8 + bob, 'W');
  if (face === 'right') p.set(8, 8 + bob, 'W').set(10, 8 + bob, 'W');
  // Hat: a wide brim and a cone that flops toward where you're looking.
  p.hline(2, 13, 7 + bob, 'p').hline(3, 12, 6 + bob, 'P');
  const lean = face === 'left' ? -1 : face === 'right' ? 1 : 0;
  for (let i = 0; i < 6; i++) {
    const half = Math.max(0, 4 - Math.floor(i * 0.75));
    const cx = 8 + Math.round((lean * i) / 2);
    p.hline(cx - half, cx + half - 1, 5 - i + bob, i === 1 ? 'y' : 'P');
  }
  if (face === 'up') p.hline(4, 11, 10 + bob, 'p');
  return p.outline('k');
}
