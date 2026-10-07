import { nextFloat, seedRng, type RngState } from '../core/rng';
import { ESSENCE_COLOR, type PaletteKey } from './palette';
import { Pixmap } from './pixmap';
import { shopBackdrop } from './scenes/shop';

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

/** Iron cauldron on three legs with a glowing brew surface of the given colour. */
export function cauldron(brew: PaletteKey = 'G', brewLight: PaletteKey = 'l'): Pixmap {
  const w = 72;
  const h = 56;
  const p = new Pixmap(w, h);
  const cx = w / 2;
  // Legs.
  p.fillRect(14, 46, 5, 8, 's').fillRect(w - 19, 46, 5, 8, 's').fillRect(cx - 2, 48, 5, 7, 's');
  // Body.
  p.fillEllipse(cx, 32, 30, 20, 's');
  p.fillEllipse(cx - 3, 29, 26, 17, 'S');
  p.fillEllipse(cx - 9, 24, 8, 6, 'm');
  p.fillEllipse(cx - 8, 25, 7, 5, 'S');
  // Rim and brew surface.
  p.fillEllipse(cx, 15, 32, 7, 'k');
  p.fillEllipse(cx, 15, 30, 5.5, 's');
  p.fillEllipse(cx, 15.5, 27, 4, brew);
  p.fillEllipse(cx - 6, 14.5, 12, 1.6, brewLight);
  p.outline('k');
  return p;
}

function rand(state: { s: RngState }): number {
  const [f, s] = nextFloat(state.s);
  state.s = s;
  return f;
}

/** Night sky over the rooftops of Elmbrook. 640x360. */
export function nightBackdrop(seed = 'elmbrook'): Pixmap {
  const W = 640;
  const H = 360;
  const p = new Pixmap(W, H);
  const r = { s: seedRng(seed) };

  p.ditherV(0, 140, 'K', 'p');
  p.ditherV(141, 260, 'p', 'P');

  // Stars.
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rand(r) * W);
    const y = Math.floor(rand(r) * 220);
    p.set(x, y, rand(r) > 0.8 ? 'W' : 'm');
    if (rand(r) > 0.93) {
      p.set(x - 1, y, 'v').set(x + 1, y, 'v').set(x, y - 1, 'v').set(x, y + 1, 'v');
    }
  }

  // Moon with a soft halo.
  p.fillEllipse(520, 70, 34, 34, 'P');
  p.fillEllipse(520, 70, 28, 28, 'v');
  p.fillEllipse(520, 70, 24, 24, 'm');
  p.fillEllipse(512, 62, 5, 4, 'S').fillEllipse(530, 80, 4, 3, 'S').fillEllipse(527, 60, 2, 2, 'S');

  // Far hills, moonlit.
  for (let x = 0; x < W; x++) {
    const hill = 236 + Math.round(Math.sin(x / 70) * 12 + Math.sin(x / 23) * 4);
    for (let y = hill; y < H; y++) p.shade(x, y, ['z', 'Z', 'x', 'X'], y === hill ? 1 : 0.5 - (y - hill) / 80);
  }

  // The tree-town: great elms with round lit windows, little doors and rope bridges.
  const trees: { x: number; w: number; top: number }[] = [];
  for (let x = 20; x < W; x += 70 + Math.floor(rand(r) * 40)) {
    trees.push({ x, w: 18 + Math.floor(rand(r) * 16), top: 150 + Math.floor(rand(r) * 60) });
  }
  const ground = 300;
  for (const t of trees) {
    for (let y = t.top; y < ground + 6; y++) {
      const k = (y - t.top) / (ground - t.top);
      const half = (t.w / 2) * (0.75 + k * 0.25) + (k > 0.8 ? ((k - 0.8) / 0.2) ** 2 * t.w : 0);
      for (let x = Math.round(t.x - half); x <= t.x + half; x++) p.set(x, y, x < t.x - half / 3 ? 'K' : x > t.x + half * 0.5 ? 'q' : 'k');
    }
    for (let c = 0; c < 7; c++) {
      const ccx = t.x + (rand(r) - 0.5) * t.w * 3;
      const ccy = t.top - 8 + (rand(r) - 0.5) * 22;
      const rr = t.w * (0.8 + rand(r) * 0.6);
      for (let y = Math.floor(ccy - rr); y <= ccy + rr; y++) {
        for (let x = Math.floor(ccx - rr * 1.3); x <= ccx + rr * 1.3; x++) {
          if (((x - ccx) / (rr * 1.3)) ** 2 + ((y - ccy) / rr) ** 2 > 1) continue;
          p.shade(x, y, ['K', 'g', 'T', 'x'], 0.2 + ((ccy - y) / rr) * 0.45 + (rand(r) - 0.5) * 0.15);
        }
      }
    }
    for (let wy = t.top + 16; wy < ground - 24; wy += 22) {
      if (rand(r) > 0.3) p.fillEllipse(t.x + (rand(r) - 0.5) * t.w * 0.4, wy, 3, 3, rand(r) > 0.3 ? 'y' : 'o');
    }
    p.fillRect(t.x - 3, ground - 9, 7, 9, 'o').hline(t.x - 2, t.x + 2, ground - 10, 'o').set(t.x, ground - 6, 'y');
  }
  // Rope bridges with lanterns between neighbouring trees.
  for (let i = 0; i + 1 < trees.length; i++) {
    const a = trees[i]!;
    const b = trees[i + 1]!;
    if (rand(r) > 0.6) continue;
    const by = Math.max(a.top, b.top) + 30;
    for (let x = a.x; x <= b.x; x++) {
      const y = by + Math.round(Math.sin(((x - a.x) / (b.x - a.x)) * Math.PI) * 8);
      p.set(x, y, 'B');
      if ((x - a.x) % 18 === 9) p.set(x, y + 1, 'k').set(x, y + 2, 'y').set(x, y + 3, 'Y');
    }
  }
  // Mossy ground, a winding path, and fireflies.
  for (let y = ground; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const path = Math.abs(x - 320 - Math.sin(y / 9) * 14) < (y - ground) * 0.9 + 4;
      p.shade(x, y, path ? ['k', 'j', 'J', 'h'] : ['K', 'g', 'G'], path ? 0.35 : 0.25 + Math.sin(x / 3 + y) * 0.08);
    }
  }
  for (let i = 0; i < 40; i++) {
    p.set(Math.floor(rand(r) * W), 200 + Math.floor(rand(r) * 140), rand(r) > 0.5 ? 'L' : 'y');
  }
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
