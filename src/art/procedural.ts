import { seedRng } from '../core/rng';
import { ESSENCE_COLOR, type PaletteKey } from './palette';
import { Pixmap } from './pixmap';
import { shopBackdrop } from './scenes/shop';
import { townBackdrop } from './scenes/town';

// Procedural art: frames, props and backgrounds drawn by code, palette-locked.
// Every generator is deterministic so snaps and contact sheets are stable.

export const CARD_W = 56;
export const CARD_H = 76;

/** Parchment card face with a wood border and a framed illustration window. */
export function cardFrame(): Pixmap {
  const p = new Pixmap(CARD_W, CARD_H);
  p.fillRect(1, 1, CARD_W - 2, CARD_H - 2, 'w');
  p.strokeRect(0, 0, CARD_W, CARD_H, 'k');
  p.strokeRect(1, 1, CARD_W - 2, CARD_H - 2, 'n');
  // Rounded corners.
  for (const [x, y] of [[0, 0], [CARD_W - 1, 0], [0, CARD_H - 1], [CARD_W - 1, CARD_H - 1]] as const) p.clear(x, y);
  for (const [x, y] of [[1, 1], [CARD_W - 2, 1], [1, CARD_H - 2], [CARD_W - 2, CARD_H - 2]] as const) p.set(x, y, 'k');
  // Illustration window (32x32 art at 2x of a 16px icon).
  p.fillRect(11, 8, 34, 34, 'n');
  p.strokeRect(10, 7, 36, 36, 'B');
  // Light edge top-left, shade bottom-right.
  p.hline(2, CARD_W - 3, 2, 'W');
  p.hline(2, CARD_W - 3, CARD_H - 3, 'n');
  return p;
}

export function cardBack(): Pixmap {
  const p = new Pixmap(CARD_W, CARD_H);
  p.fillRect(1, 1, CARD_W - 2, CARD_H - 2, 'p');
  p.strokeRect(0, 0, CARD_W, CARD_H, 'k');
  p.strokeRect(2, 2, CARD_W - 4, CARD_H - 4, 'P');
  for (const [x, y] of [[0, 0], [CARD_W - 1, 0], [0, CARD_H - 1], [CARD_W - 1, CARD_H - 1]] as const) p.clear(x, y);
  // Crescent moon.
  p.fillEllipse(CARD_W / 2, CARD_H / 2, 12, 12, 'm');
  p.fillEllipse(CARD_W / 2 + 5, CARD_H / 2 - 3, 11, 11, 'p');
  return p;
}

/** A 5x5 essence pip. */
export function essencePip(essence: keyof typeof ESSENCE_COLOR): Pixmap {
  const p = new Pixmap(7, 7);
  p.fillEllipse(3.5, 3.5, 3.5, 3.5, 'k');
  p.fillEllipse(3.5, 3.5, 2.5, 2.5, ESSENCE_COLOR[essence]);
  p.set(2, 2, 'W');
  return p;
}

/**
 * Iron cauldron on three legs with a glowing brew. Shaded as a sphere lit from
 * the upper left, with a warm lamplight rim on the right and the brew's colour
 * reflected under the lip.
 */
export function cauldron(brew: PaletteKey = 'G', brewLight: PaletteKey = 'l'): Pixmap {
  const w = 72;
  const h = 58;
  const p = new Pixmap(w, h);
  const cx = w / 2;
  const IRON: readonly PaletteKey[] = ['K', 'k', 's', 'S', 'e', 'm'];
  // Legs: little cast-iron claws.
  for (const lx of [15, w - 20, cx - 2]) {
    for (let y = 44; y < h - 1; y++) {
      for (let x = lx; x < lx + 5; x++) p.shade(x, y, IRON, 0.35 - (x - lx) * 0.06 - (y - 44) * 0.015);
    }
    p.hline(lx - 1, lx + 5, h - 2, 'k');
  }
  // Body: a squashed sphere.
  const bcx = cx;
  const bcy = 32;
  const rx = 31;
  const ry = 21;
  for (let y = bcy - ry; y <= bcy + ry; y++) {
    for (let x = bcx - rx; x <= bcx + rx; x++) {
      const nx = (x + 0.5 - bcx) / rx;
      const ny = (y + 0.5 - bcy) / ry;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      // Key light from upper left, warm bounce from lower right.
      const key = Math.max(0, -nx * 0.55 - ny * 0.6 + nz * 0.55);
      const rim = Math.max(0, nx * 0.8 + ny * 0.2) ** 3 * (1 - nz) * 1.4;
      const t = 0.2 + key * 0.7 - Math.max(0, ny) * 0.15 + (cellRandomish(x, y) - 0.5) * 0.03;
      if (rim > 0.2 && nz < 0.7) p.shade(x, y, ['s', 'B', 'n', 'H'], rim * 1.2 - 0.1);
      else p.shade(x, y, IRON, t);
    }
  }
  // Specular highlight.
  p.fillEllipse(bcx - 13, bcy - 8, 4.5, 2.6, 'e');
  p.fillEllipse(bcx - 14, bcy - 9, 2.2, 1.2, 'm');
  p.set(bcx - 15, bcy - 9, 'W');
  // A rivetted band around the belly.
  for (let x = bcx - rx + 3; x <= bcx + rx - 3; x++) {
    const nx = (x - bcx) / rx;
    const by = Math.round(bcy + 4 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 3);
    p.set(x, by, 'k');
    p.set(x, by - 1, nx < -0.2 ? 'e' : nx < 0.5 ? 'S' : 's');
    if ((x - bcx) % 10 === 0) p.set(x, by - 1, 'm');
  }
  // Lip: a thick rolled rim, lit along its top edge.
  p.fillEllipse(cx, 15, 33, 7.5, 'k');
  for (let y = 8; y <= 22; y++) {
    for (let x = 2; x < w - 2; x++) {
      const nx = (x + 0.5 - cx) / 32;
      const ny = (y + 0.5 - 15) / 6.5;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1 || d2 < 0.62) continue;
      p.shade(x, y, IRON, 0.3 - ny * 0.35 - nx * 0.15);
    }
  }
  // Brew: glowing surface, brighter in the middle, the brew's colour bouncing on the inner lip.
  for (let y = 10; y <= 20; y++) {
    for (let x = 6; x < w - 6; x++) {
      const nx = (x + 0.5 - cx) / 27;
      const ny = (y + 0.5 - 15.5) / 4.2;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      p.shade(x, y, ['k', brew, brewLight], 1.15 - d2 * 0.9 + ny * 0.15);
    }
  }
  p.hline(cx - 22, cx + 22, 11, brew);
  // Bubbles on the surface.
  for (const [bx, by, r] of [[cx - 8, 15, 1.6], [cx + 6, 14, 1.2], [cx + 14, 16, 1], [cx - 16, 16, 0.9]] as const) {
    p.fillEllipse(bx, by, r + 0.6, r * 0.7 + 0.4, brewLight);
    p.set(bx - 1, by - 1, 'W');
  }
  p.outline('k');
  return p;
}

/** Tiny deterministic jitter for surface grain. */
function cellRandomish(x: number, y: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
}

/** Elmbrook by moonlight, behind the title. 640x360. */
export function nightBackdrop(seed = 'elmbrook'): Pixmap {
  const p = new Pixmap(640, 360);
  townBackdrop(p, { s: seedRng(seed) });
  return p;
}

export function bubble(): Pixmap {
  const p = new Pixmap(5, 5);
  p.fillEllipse(2.5, 2.5, 2.5, 2.5, 'l');
  p.set(1, 1, 'W');
  return p;
}

/** Labelled-by-colour stand-in for any texture that has no art yet. */
export function placeholder(width: number, height: number): Pixmap {
  const p = new Pixmap(width, height);
  p.fillRect(0, 0, width, height, 'R');
  p.strokeRect(0, 0, width, height, 'k');
  for (let i = 0; i < Math.min(width, height); i++) {
    p.set(i, i, 'y');
    p.set(width - 1 - i, i, 'y');
  }
  return p;
}

/** Every procedural texture the game registers at boot, by texture id. */
export function proceduralTextures(): Record<string, Pixmap> {
  const out: Record<string, Pixmap> = {
    'card/frame': cardFrame(),
    'card/back': cardBack(),
    'prop/cauldron': cauldron(),
    'prop/cauldron-lunar': cauldron('v', 'm'),
    'bg/night': nightBackdrop(),
    'bg/shop': shopBackdrop(),
    'fx/bubble': bubble(),
    'placeholder/16': placeholder(16, 16),
  };
  for (const e of Object.keys(ESSENCE_COLOR) as (keyof typeof ESSENCE_COLOR)[]) out[`pip/${e}`] = essencePip(e);
  return out;
}
