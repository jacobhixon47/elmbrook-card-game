import { seedRng } from '../../core/rng';
import { fbm, valueNoise } from '../noise';
import { PALETTE, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { cottage, FOLIAGE, mountains, pick, pine, rand, type Rng } from './town';

// The potion shop at night, from behind the counter: a stone-walled, timber-
// framed room in a moonlit forest town. A wide window looks out on mountains,
// pines and thatched cottages with smoking chimneys; shelves overflow with
// bottles; vines hang from the beams; two lanterns light the counter.
// 640x360, deterministic for a seed.

export const SHOP_W = 640;
export const SHOP_H = 360;
export const COUNTER_TOP = 230;

const WIN = { x0: 198, x1: 442, y0: 32, y1: COUNTER_TOP - 1 };

/** Lantern positions, exported so the scene can add soft glows. */
export const SHOP_LANTERNS = [
  { x: 252, y: 78, chain: 44 },
  { x: 388, y: 72, chain: 38 },
] as const;

/** Warm light sources (lanterns plus spill from the shelves). */
const LIGHTS = [
  { x: 252, y: 80, radius: 230, power: 1 },
  { x: 388, y: 74, radius: 220, power: 0.95 },
  { x: 96, y: 120, radius: 120, power: 0.35 },
  { x: 548, y: 120, radius: 120, power: 0.35 },
];

const STONE: readonly PaletteKey[] = ['K', 'q', 'j', 'J', 'h', 'H', 'a'];
const WOOD: readonly PaletteKey[] = ['K', 'k', 'b', 'B', 'n', 'a'];
const SKY: readonly PaletteKey[] = ['K', 'z', 'Z', 'q', 'Q', 'P', 'X'];

export function lightAt(x: number, y: number): number {
  let total = 0;
  for (const l of LIGHTS) {
    const d = Math.hypot(x - l.x, (y - l.y) * 1.1) / l.radius;
    total += l.power * Math.max(0, 1 - d) ** 1.4;
  }
  return Math.min(1, total);
}

// ---------------------------------------------------------------- walls

/** Irregular dressed stones with bevelled edges, noise grain and warm lighting. */
function stoneWall(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, y1: number): void {
  let y = y0;
  while (y < y1) {
    const h = 9 + Math.floor(rand(r) * 6);
    let x = x0 - Math.floor(rand(r) * 20);
    while (x < x1) {
      const w = 14 + Math.floor(rand(r) * 18);
      const tone = (rand(r) - 0.5) * 0.18;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = x + i;
          const py = y + j;
          if (px < x0 || px >= x1 || py >= y1) continue;
          const mortar = i === w - 1 || j === h - 1;
          // Rounded corners read as worn stone.
          const corner = (i === 0 || i === w - 2) && (j === 0 || j === h - 2);
          if (mortar || corner) {
            p.shade(px, py, STONE, 0.05 + lightAt(px, py) * 0.25);
            continue;
          }
          const bevel = i === 0 || j === 0 ? 0.16 : i === w - 2 || j === h - 2 ? -0.14 : 0;
          const grain = (fbm(px, py, 6, 3) - 0.5) * 0.28;
          p.shade(px, py, STONE, 0.1 + lightAt(px, py) * 0.72 + tone + bevel + grain);
        }
      }
      x += w;
    }
    y += h;
  }
}

/** Wood with long grain, darker streaks, bevelled edges and lighting. */
function timber(p: Pixmap, x0: number, y0: number, w: number, h: number, vertical: boolean, lift = 0): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const along = vertical ? y : x;
      const across = vertical ? x : y;
      const grain = Math.sin(across * 1.7 + valueNoise(along, across, 14, 9) * 6) * 0.08 + (valueNoise(along, across * 6, 9, 5) - 0.5) * 0.18;
      const edge = across === (vertical ? x0 : y0) ? 0.2 : across === (vertical ? x0 + w - 1 : y0 + h - 1) ? -0.25 : 0;
      p.shade(x, y, WOOD, 0.22 + lightAt(x, y) * 0.55 + grain + edge + lift);
    }
  }
  if (vertical) {
    for (let y = y0; y < y0 + h; y++) p.set(x0 - 1, y, 'K').set(x0 + w, y, 'K');
  } else {
    p.hline(x0, x0 + w - 1, y0 + h, 'K');
  }
}

function roofRafters(p: Pixmap): void {
  // Sloped roof beams in the top corners.
  for (const side of [0, 1] as const) {
    for (let k = 0; k < 3; k++) {
      for (let s = 0; s < 120; s++) {
        const x = side === 0 ? s : SHOP_W - 1 - s;
        const y = Math.round(60 - s * 0.5) + k * 14 - 20;
        for (let j = 0; j < 6; j++) {
          if (y + j < 0) continue;
          p.shade(x, y + j, WOOD, 0.12 + lightAt(x, y) * 0.4 + (j === 0 ? 0.15 : j === 5 ? -0.2 : 0));
        }
      }
    }
  }
}

// ---------------------------------------------------------------- the view

function windowView(p: Pixmap, r: Rng): void {
  const { x0, x1, y0, y1 } = WIN;
  const horizon = y1 - 70;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = (y - y0) / (horizon - y0);
      p.shade(x, y, SKY, 0.15 + t * 0.7 + (valueNoise(x, y, 20, 4) - 0.5) * 0.12);
    }
  }
  // Wispy clouds catching moonlight.
  for (let y = y0 + 20; y < horizon - 10; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = fbm(x * 0.6, y * 2.2, 26, 11, 3);
      if (c > 0.62) p.shade(x, y, ['q', 'Q', 'P', 'v'], (c - 0.62) * 4.5);
    }
  }
  // Stars of several colours, a few twinkling crosses.
  for (let i = 0; i < 140; i++) {
    const sx = x0 + Math.floor(rand(r) * (x1 - x0));
    const sy = y0 + Math.floor(rand(r) * (horizon - y0));
    p.set(sx, sy, pick(r, ['W', 'm', 'c', 'v', 'y', 'I'] as const));
    if (rand(r) > 0.93) p.set(sx - 1, sy, 'P').set(sx + 1, sy, 'P').set(sx, sy - 1, 'P').set(sx, sy + 1, 'P');
  }
  // Moon and halo.
  const mx = 370;
  const my = 66;
  for (let y = my - 40; y <= my + 40; y++) {
    for (let x = mx - 40; x <= mx + 40; x++) {
      if (x < x0 || x > x1 || y < y0) continue;
      const d = Math.hypot(x - mx, y - my);
      if (d < 12) p.shade(x, y, ['m', 'W'], 1 - d / 14 + (valueNoise(x, y, 4, 2) - 0.5) * 0.6);
      else if (d < 40) p.shade(x, y, ['q', 'Q', 'P', 'v', 'm'], ((40 - d) / 28) ** 2 * 0.8);
    }
  }
  // Mountains: far snow-capped peaks lit from the moon side, then a mist band.
  mountains(p, x0, x1, horizon + 18, y1, [
    { x: 205, h: 62 },
    { x: 262, h: 92 },
    { x: 318, h: 58 },
    { x: 362, h: 80 },
    { x: 432, h: 66 },
  ]);
  // Forested ridge: a dark band of pine silhouettes.
  for (let x = x0; x <= x1; x++) {
    const near = horizon + 14 + Math.round(Math.sin(x / 31) * 6 + valueNoise(x, 0, 8, 23) * 6);
    for (let y = near; y <= y1; y++) p.shade(x, y, ['K', 'z', 'g', 'T'], 0.32 - (y - near) / 50 + (y === near ? 0.25 : 0));
  }
  for (let i = 0; i < 46; i++) {
    const tx = x0 + Math.floor(rand(r) * (x1 - x0));
    pine(p, tx, horizon + 20 + Math.floor(rand(r) * 16), 14 + Math.floor(rand(r) * 14), 0.12, x0, x1);
  }
  for (let i = 0; i < 14; i++) {
    const tx = x0 + Math.floor(rand(r) * (x1 - x0));
    pine(p, tx, horizon + 42 + Math.floor(rand(r) * 12), 22 + Math.floor(rand(r) * 18), 0.2, x0, x1);
  }
  // Thatched stone cottages, far to near, with lit windows and chimney smoke.
  cottage(p, r, { x: 380, base: horizon + 44, w: 38, wallH: 14 }, y0 + 2);
  cottage(p, r, { x: 212, base: horizon + 50, w: 44, wallH: 16 }, y0 + 2);
  cottage(p, r, { x: 290, base: horizon + 62, w: 60, wallH: 20 }, y0 + 2);
  // Fireflies and a flowering hedge along the sill.
  for (let i = 0; i < 26; i++) p.set(x0 + Math.floor(rand(r) * (x1 - x0)), horizon + Math.floor(rand(r) * 60), pick(r, ['L', 'y', 'Y'] as const));
  for (let x = x0; x <= x1; x++) {
    const hedge = y1 - 12 + Math.round(valueNoise(x, 0, 6, 41) * 8);
    for (let y = hedge; y <= y1; y++) p.shade(x, y, FOLIAGE, 0.2 + fbm(x, y, 3, 42) * 0.5 + lightAt(x, y) * 0.3);
    if (rand(r) > 0.82) p.set(x, hedge + 1 + Math.floor(rand(r) * 6), pick(r, ['I', 'i', 'v', 'w'] as const));
  }
}

// ---------------------------------------------------------------- props

type Glass = readonly [PaletteKey, PaletteKey, PaletteKey];
const GLASSES: readonly Glass[] = [
  ['u', 'U', 'c'],
  ['r', 'R', 'I'],
  ['g', 'G', 'l'],
  ['p', 'P', 'v'],
  ['b', 'o', 'y'],
  ['T', 't', 'c'],
  ['J', 'h', 'H'],
];

/** A bottle or jar with outline, liquid level, glass highlight and cork. Returns its width. */
function bottle(p: Pixmap, r: Rng, x: number, baseY: number, kind: 'tall' | 'jar' | 'round'): number {
  const g = pick(r, GLASSES);
  const w = kind === 'tall' ? 5 + Math.floor(rand(r) * 3) : kind === 'jar' ? 9 + Math.floor(rand(r) * 5) : 8 + Math.floor(rand(r) * 3);
  const h = kind === 'tall' ? 14 + Math.floor(rand(r) * 8) : kind === 'jar' ? 10 + Math.floor(rand(r) * 5) : 9 + Math.floor(rand(r) * 3);
  const top = baseY - h;
  const neckW = kind === 'jar' ? w - 2 : Math.max(2, Math.floor(w / 2) - 1);
  const neckH = kind === 'tall' ? 5 : kind === 'round' ? 3 : 1;
  const bodyTop = top + neckH;
  const level = bodyTop + Math.floor((h - neckH) * (0.15 + rand(r) * 0.35));
  for (let y = bodyTop; y < baseY; y++) {
    for (let i = 0; i < w; i++) {
      const roundCut = kind === 'round' && (y - bodyTop < 2 || baseY - y < 2) && (i === 0 || i === w - 1);
      if (roundCut) continue;
      const liquid = y >= level;
      const key = liquid ? (i < w / 3 ? g[2] : i > (w * 2) / 3 ? g[0] : g[1]) : i === 1 ? 'm' : 'Q';
      p.set(x + i, y, key);
    }
  }
  for (let y = bodyTop; y < baseY; y++) p.set(x - 1, y, 'k').set(x + w, y, 'k');
  p.hline(x, x + w - 1, baseY, 'k');
  for (let y = bodyTop + 1; y < baseY - 2; y++) if (y % 4 !== 3) p.set(x + 1, y, 'W');
  const nx = x + Math.floor((w - neckW) / 2);
  const lid = kind === 'jar' ? 1 : 0;
  p.fillRect(nx, top, neckW, neckH, 'Q');
  p.fillRect(nx - lid, top - 2, neckW + lid * 2, 2, kind === 'jar' ? 'n' : 'B');
  p.hline(nx - lid, nx + neckW - 1 + lid, top - 3, 'k');
  if (kind === 'jar' && rand(r) > 0.4) p.fillRect(x + 2, bodyTop + Math.floor((h - neckH) / 2), w - 4, 3, 'w');
  return w;
}

function shelfRow(p: Pixmap, r: Rng, x0: number, x1: number, y: number): void {
  let bx = x0 + 3;
  while (bx < x1 - 10) {
    const w = bottle(p, r, bx, y - 1, pick(r, ['tall', 'tall', 'jar', 'round'] as const));
    bx += w + 2 + Math.floor(rand(r) * 3);
  }
  timber(p, x0, y, x1 - x0, 4, false, 0.15);
}

function cabinet(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, y1: number, shelves: number[]): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) p.shade(x, y, ['K', 'k', 'q', 'j'], 0.15 + lightAt(x, y) * 0.5 + (fbm(x, y, 8, 51) - 0.5) * 0.1);
  for (const sy of shelves) shelfRow(p, r, x0, x1, sy);
  timber(p, x0 - 6, y0 - 6, 6, y1 - y0 + 6, true);
  timber(p, x1, y0 - 6, 6, y1 - y0 + 6, true);
  timber(p, x0 - 8, y0 - 10, x1 - x0 + 16, 5, false, 0.1);
}

function vines(p: Pixmap, r: Rng, x0: number, x1: number, y: number, maxLen: number): void {
  for (let x = x0; x < x1; x += 2 + Math.floor(rand(r) * 4)) {
    const len = Math.floor(rand(r) ** 2 * maxLen);
    let vx = x;
    for (let j = 0; j < len; j++) {
      if (rand(r) > 0.7) vx += rand(r) > 0.5 ? 1 : -1;
      p.shade(vx, y + j, FOLIAGE, 0.25 + lightAt(vx, y + j) * 0.5);
      if (j % 3 === 1) {
        const side = rand(r) > 0.5 ? 1 : -1;
        p.shade(vx + side, y + j, FOLIAGE, 0.45 + lightAt(vx, y + j) * 0.5);
        p.shade(vx + side * 2, y + j - 1, FOLIAGE, 0.55 + lightAt(vx, y + j) * 0.45);
      }
      if (rand(r) > 0.95) p.set(vx + 1, y + j, pick(r, ['I', 'i', 'v', 'W'] as const)).set(vx + 2, y + j, 'i');
    }
  }
}

function lantern(p: Pixmap, x: number, y: number, chain: number): void {
  for (let c = 0; c < chain; c++) p.set(x, y - 14 - chain + c, c % 3 === 0 ? 'S' : 'k');
  // A brass pendant lamp: cap, glass body, base.
  p.fillRect(x - 3, y - 14, 7, 2, 'k').fillRect(x - 6, y - 12, 13, 3, 'b').hline(x - 5, x + 5, y - 12, 'n');
  p.fillRect(x - 7, y - 9, 15, 13, 'k');
  p.fillRect(x - 6, y - 9, 13, 12, 'y');
  p.fillRect(x - 5, y - 8, 11, 10, 'Y');
  p.fillRect(x - 2, y - 6, 5, 7, 'W');
  for (let i = -6; i <= 6; i += 4) for (let j = y - 9; j < y + 3; j++) p.set(x + i, j, 'o');
  p.fillRect(x - 6, y + 3, 13, 2, 'b').hline(x - 5, x + 5, y + 3, 'n');
  p.fillRect(x - 1, y + 5, 3, 2, 'b');
}

function counter(p: Pixmap, r: Rng): void {
  // Front: framed panels in dark wood, light falling off toward the floor.
  for (let y = COUNTER_TOP + 8; y < SHOP_H; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      const panelX = x % 80;
      const frame = panelX < 6 || panelX > 73 || y < COUNTER_TOP + 16 || (y > COUNTER_TOP + 96 && y < COUNTER_TOP + 102);
      const board = x % 10 === 9 && !frame ? -0.15 : 0;
      const inset = !frame && (panelX === 6 || y === COUNTER_TOP + 16) ? -0.25 : !frame && panelX === 73 ? 0.12 : 0;
      const grain = (valueNoise(x * 4, y, 10, 61) - 0.5) * 0.15;
      p.shade(x, y, WOOD, 0.18 + lightAt(x, y - 140) * 0.45 + (frame ? 0.1 : 0) + board + inset + grain - (y - COUNTER_TOP) / 520);
    }
  }
  // Thick worktop with a bright lamplit front edge.
  for (let y = COUNTER_TOP; y < COUNTER_TOP + 8; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      const t = y === COUNTER_TOP ? 0.6 : y === COUNTER_TOP + 5 ? 0.85 : y > COUNTER_TOP + 5 ? 0.25 : 0.45;
      p.shade(x, y, WOOD, t + lightAt(x, y) * 0.35 + (valueNoise(x * 3, y, 12, 62) - 0.5) * 0.12);
    }
  }
  p.hline(0, SHOP_W - 1, COUNTER_TOP - 1, 'k');
  p.hline(0, SHOP_W - 1, COUNTER_TOP + 8, 'K');

  // Clutter on the worktop, leaving the middle clear for the cauldron.
  for (const [from, to] of [[92, 250], [404, 560]] as const) {
    let bx = from;
    while (bx < to) bx += bottle(p, r, bx, COUNTER_TOP - 1, pick(r, ['tall', 'jar', 'round'] as const)) + 3 + Math.floor(rand(r) * 8);
  }
  // Potted herbs at both ends.
  for (const px of [40, 590]) {
    p.fillRect(px - 8, COUNTER_TOP - 12, 17, 12, 'B').hline(px - 9, px + 9, COUNTER_TOP - 12, 'n').hline(px - 8, px + 8, COUNTER_TOP - 1, 'b');
    for (let i = 0; i < 160; i++) {
      const a = rand(r) * Math.PI;
      const d = rand(r) * 16;
      const lx = Math.round(px + Math.cos(a) * d * 1.2);
      const ly = Math.round(COUNTER_TOP - 13 - Math.sin(a) * d);
      p.shade(lx, ly, FOLIAGE, 0.3 + (ly < COUNTER_TOP - 20 ? 0.25 : 0) + rand(r) * 0.3);
    }
  }
}

/** Darkens the edges by stepping pixels one shade down, for a cozy, lamplit focus. */
function vignette(p: Pixmap): void {
  const darker = new Map<string, PaletteKey>();
  for (const ramp of [STONE, WOOD, SKY, FOLIAGE]) {
    for (let i = 1; i < ramp.length; i++) if (!darker.has(PALETTE[ramp[i]!])) darker.set(PALETTE[ramp[i]!], ramp[i - 1]!);
  }
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < SHOP_H; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      const v = Math.max(0, Math.hypot((x - 320) / 330, (y - 150) / 230) - 0.55) * 2.2;
      if (v <= ((bayer[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16) continue;
      const i = (y * SHOP_W + x) * 4;
      const hexKey = '#' + [0, 1, 2].map((k) => (p.data[i + k] ?? 0).toString(16).padStart(2, '0')).join('');
      const d = darker.get(hexKey);
      if (d) p.set(x, y, d);
    }
  }
}

export function shopBackdrop(seed = 'elmbrook-shop'): Pixmap {
  const p = new Pixmap(SHOP_W, SHOP_H);
  const r: Rng = { s: seedRng(seed) };
  stoneWall(p, r, 0, SHOP_W, 18, COUNTER_TOP);
  windowView(p, r);
  timber(p, WIN.x0 - 10, WIN.y0 - 4, 10, WIN.y1 - WIN.y0 + 4, true);
  timber(p, WIN.x1 + 1, WIN.y0 - 4, 10, WIN.y1 - WIN.y0 + 4, true);
  timber(p, WIN.x0 - 14, WIN.y0 - 14, WIN.x1 - WIN.x0 + 28, 10, false, 0.05);
  timber(p, 0, 0, SHOP_W, 18, false, -0.1);
  roofRafters(p);
  cabinet(p, r, 22, 168, 46, COUNTER_TOP, [86, 128, 170, 212]);
  cabinet(p, r, 474, 618, 54, COUNTER_TOP, [94, 136, 178, 216]);
  vines(p, r, 0, SHOP_W, 18, 34);
  vines(p, r, WIN.x0 - 14, WIN.x1 + 14, WIN.y0 - 4, 30);
  for (const l of SHOP_LANTERNS) lantern(p, l.x, l.y, l.chain);
  counter(p, r);
  vignette(p);
  return p;
}
