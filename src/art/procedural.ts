import { nextFloat, seedRng, type RngState } from '../core/rng';
import { ESSENCE_COLOR, type PaletteKey } from './palette';
import { Pixmap } from './pixmap';

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

  // Far hills.
  for (let x = 0; x < W; x++) {
    const hill = 250 + Math.round(Math.sin(x / 70) * 10 + Math.sin(x / 23) * 4);
    for (let y = hill; y < H; y++) p.set(x, y, 'p');
  }

  // Town silhouette: houses with pitched roofs and lit windows.
  let x = -10;
  while (x < W) {
    const hw = 34 + Math.floor(rand(r) * 30);
    const hh = 30 + Math.floor(rand(r) * 34);
    const base = 300;
    const top = base - hh;
    p.fillRect(x, top, hw, H - top, 'k');
    const roof = Math.floor(hw / 2);
    for (let i = 0; i <= roof; i++) p.hline(x + i, x + hw - 1 - i, top - i, 'k');
    if (rand(r) > 0.4) p.fillRect(x + hw - 10, top - roof + 2, 5, roof, 'k'); // chimney
    for (let wy = top + 6; wy < base - 8; wy += 14) {
      for (let wx = x + 6; wx < x + hw - 8; wx += 12) {
        if (rand(r) > 0.55) p.fillRect(wx, wy, 4, 5, rand(r) > 0.3 ? 'y' : 'o');
      }
    }
    x += hw + Math.floor(rand(r) * 8);
  }

  // Cobbled square in the foreground.
  p.ditherV(300, H - 1, 'k', 'K');
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
    'fx/bubble': bubble(),
    'placeholder/16': placeholder(16, 16),
  };
  for (const e of Object.keys(ESSENCE_COLOR) as (keyof typeof ESSENCE_COLOR)[]) out[`pip/${e}`] = essencePip(e);
  return out;
}
