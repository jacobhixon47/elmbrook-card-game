import type { Season } from '../../core';
import { seedRng } from '../../core/rng';
import { cellRandom, fbm, valueNoise } from '../noise';
import { PALETTE, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { pick, rand, stipple, type Rng } from './town';

// The Elmbrook merchants' guild hall on an evening errand: a tall timber-framed stone hall where the
// witch pays rent and takes commissions from the clerk. A high arched window at the back shows the
// moonlit sky over the town's roofs (and a branch that changes with the season); guild banners hang
// either side of it. The notice board of commissions is on the left with a standing candelabra, the
// clerk's high desk and shelves of ledgers on the right. Warm candlelight inside, cool moonlight
// through the window falling across the rug. The centre stays calm and dark for the UI panels.
// 640x360, deterministic for a seed.

export const GUILD_W = 640;
export const GUILD_H = 360;
const FLOOR = 258;

/** The arched window: a round head of radius (x1 - x0) / 2 sprung at `spring`. */
const WIN = { x0: 268, x1: 372, top: 32, sill: 182 };
const WIN_R = (WIN.x1 - WIN.x0) / 2;
const WIN_CX = (WIN.x0 + WIN.x1) / 2;
const WIN_SPRING = WIN.top + WIN_R;

/** Lamp centres (flames) in 640x360 coords, for soft additive glows. */
export const GUILD_LIGHTS = [
  { x: 141, y: 86, scale: 0.7 }, // sconce on the left post
  { x: 499, y: 86, scale: 0.7 }, // sconce on the right post
  { x: 108, y: 171, scale: 0.9 }, // standing candelabra by the notice board
  { x: 563, y: 173, scale: 0.75 }, // the clerk's desk candle
] as const;

const WARM = [
  { x: 141, y: 88, radius: 150, power: 0.6 },
  { x: 499, y: 88, radius: 150, power: 0.6 },
  { x: 108, y: 172, radius: 175, power: 0.85 },
  { x: 563, y: 176, radius: 165, power: 0.9 },
  { x: 320, y: 240, radius: 320, power: 0.2 },
];

function lightAt(x: number, y: number): number {
  let total = 0;
  for (const l of WARM) {
    const d = Math.hypot(x - l.x, (y - l.y) * 1.1) / l.radius;
    total += l.power * Math.max(0, 1 - d) ** 1.4;
  }
  return Math.min(1, total);
}

/** Moonlight through the window: a soft shaft falling down and to the left across the floor. */
function moonAt(x: number, y: number): number {
  if (y < FLOOR) return 0;
  const k = (y - FLOOR) / (GUILD_H - FLOOR);
  const shift = -28 - k * 46;
  const half = 44 + k * 26;
  const cx = WIN_CX + shift;
  const d = Math.abs(x - cx) / half;
  if (d > 1) return 0;
  // The centre mullion's shadow, and the transom's.
  const mullion = Math.abs(x - cx) < 1 + k * 1.5 ? 0.6 : 1;
  const transom = Math.abs(k - 0.42) < 0.035 ? 0.55 : 1;
  return (1 - d ** 3) * (0.35 + k * 0.35) * mullion * transom;
}

const STONE: readonly PaletteKey[] = ['K', 'q', 'j', 'J', 'h', 'H', 'a'];
const WOOD: readonly PaletteKey[] = ['K', 'k', 'b', 'B', 'n', 'a'];
const FLAG: readonly PaletteKey[] = ['K', 'k', 'q', 'j', 'J', 'h', 'H'];
const MOONSTONE: readonly PaletteKey[] = ['K', 'k', 'q', 'Q', 'S', 'e'];
const SKY: readonly PaletteKey[] = ['K', 'z', 'Z', 'q', 'Q', 'P', 'X'];
const PAPER: readonly PaletteKey[] = ['J', 'h', 'H', 'a', 'w', 'W'];
const IRON: readonly PaletteKey[] = ['K', 'k', 's', 'S', 'e'];

// ---------------------------------------------------------------- the shell

/** Dressed stones with bevels and grain, warm-lit, cooling toward the window. */
function stoneWall(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, y1: number): void {
  let y = y0;
  while (y < y1) {
    const h = 10 + Math.floor(rand(r) * 6);
    let x = x0 - Math.floor(rand(r) * 20);
    while (x < x1) {
      const w = 16 + Math.floor(rand(r) * 20);
      const tone = (rand(r) - 0.5) * 0.16;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = x + i;
          const py = y + j;
          if (px < x0 || px >= x1 || py >= y1) continue;
          const light = lightAt(px, py);
          const mortar = i === w - 1 || j === h - 1;
          const corner = (i === 0 || i === w - 2) && (j === 0 || j === h - 2);
          if (mortar || corner) {
            p.shade(px, py, STONE, 0.04 + light * 0.25);
            continue;
          }
          const bevel = i === 0 || j === 0 ? 0.14 : i === w - 2 || j === h - 2 ? -0.12 : 0;
          const grain = (fbm(px, py, 6, 3) - 0.5) * 0.26;
          p.shade(px, py, STONE, 0.06 + light * 0.7 + tone + bevel + grain);
        }
      }
      x += w;
    }
    y += h;
  }
}

function timber(p: Pixmap, x0: number, y0: number, w: number, h: number, vertical: boolean, lift = 0): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const along = vertical ? y : x;
      const across = vertical ? x : y;
      const grain = Math.sin(across * 1.7 + valueNoise(along, across, 14, 9) * 6) * 0.07 + (valueNoise(along, across * 6, 9, 5) - 0.5) * 0.18;
      const edge = across === (vertical ? x0 : y0) ? 0.2 : across === (vertical ? x0 + w - 1 : y0 + h - 1) ? -0.25 : 0;
      p.shade(x, y, WOOD, 0.14 + lightAt(x, y) * 0.6 + grain + edge + lift);
    }
  }
  if (vertical) {
    for (let y = y0; y < y0 + h; y++) p.set(x0 - 1, y, 'K').set(x0 + w, y, 'K');
  } else {
    p.hline(x0, x0 + w - 1, y0 + h, 'K');
  }
}

/** A diagonal knee brace from (x0, y0) rising to (x1, y1). */
function brace(p: Pixmap, x0: number, y0: number, x1: number, y1: number, width: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    for (let j = 0; j < width; j++) {
      const t = j === 0 ? 0.18 : j === width - 1 ? -0.22 : 0;
      p.shade(x, y + j, WOOD, 0.14 + lightAt(x, y) * 0.55 + t + (valueNoise(s, j * 5, 9, 5) - 0.5) * 0.16);
    }
    p.set(x, y + width, 'K');
  }
}

function ceiling(p: Pixmap): void {
  // Dark boarded ceiling with joist ends along the wall plate.
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < GUILD_W; x++) {
      const board = x % 24 === 0 ? -0.2 : 0;
      p.shade(x, y, WOOD, 0.02 + lightAt(x, y) * 0.25 + board + (valueNoise(x, y * 6, 10, 77) - 0.5) * 0.12 + y / 120);
    }
  }
  for (let x = 6; x < GUILD_W; x += 36) {
    for (let y = 0; y < 16; y++) for (let i = 0; i < 10; i++) p.shade(x + i, y, WOOD, 0.08 + lightAt(x + i, y) * 0.4 + (i === 0 ? 0.15 : i === 9 ? -0.2 : 0) + y / 80);
    p.hline(x, x + 9, 16, 'K');
  }
  timber(p, 0, 22, GUILD_W, 8, false, 0.05);
}

/** Oak wainscot panelling with a moulded rail, below the stone. */
function wainscot(p: Pixmap): void {
  const top = 204;
  for (let y = top; y < FLOOR; y++) {
    for (let x = 0; x < GUILD_W; x++) {
      const px = x % 46;
      const frame = px < 5 || y < top + 7 || y > FLOOR - 7;
      const inset = !frame && (px === 5 || y === top + 7) ? -0.25 : !frame && (px === 45 || y === FLOOR - 7) ? 0.1 : 0;
      const raised = !frame && px > 9 && px < 41 && y > top + 11 && y < FLOOR - 11 ? 0.06 : 0;
      const grain = (valueNoise(x * 4, y, 10, 61) - 0.5) * 0.14;
      p.shade(x, y, WOOD, 0.08 + lightAt(x, y) * 0.55 + (frame ? 0.06 : -0.04) + inset + raised + grain);
    }
  }
  for (let x = 0; x < GUILD_W; x++) {
    p.shade(x, top - 3, WOOD, 0.35 + lightAt(x, top) * 0.5);
    p.shade(x, top - 2, WOOD, 0.55 + lightAt(x, top) * 0.45);
    p.shade(x, top - 1, WOOD, 0.2 + lightAt(x, top) * 0.3);
  }
  p.hline(0, GUILD_W - 1, top, 'K');
  // Skirting shadow where wall meets floor.
  p.hline(0, GUILD_W - 1, FLOOR - 1, 'K');
}

/** Big flagstones receding toward the back wall, warm by the candles, cool in the moonbeam. */
function floor(p: Pixmap, r: Rng): void {
  let y = FLOOR;
  let row = 0;
  while (y < GUILD_H) {
    const h = 6 + row * 2 + Math.floor(rand(r) * 2);
    const k = (y - FLOOR) / (GUILD_H - FLOOR);
    let x = -Math.floor(rand(r) * 30);
    while (x < GUILD_W) {
      const w = Math.round((24 + rand(r) * 20) * (1 + k * 1.2));
      const tone = (rand(r) - 0.5) * 0.14;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = x + i;
          const py = y + j;
          if (px < 0 || px >= GUILD_W || py >= GUILD_H) continue;
          const warm = lightAt(px, py - 20);
          const moon = moonAt(px, py);
          const mortar = i === w - 1 || j === h - 1;
          const ci = Math.min(i, w - 2 - i);
          const cj = Math.min(j, h - 2 - j);
          const corner = ci + cj < 2;
          const ramp = moon > warm * 0.8 ? MOONSTONE : FLAG;
          const lit = Math.max(warm, moon * 1.1);
          if (mortar || corner) {
            p.shade(px, py, ramp, 0.05 + lit * 0.3);
            continue;
          }
          const bevel = j === 0 ? 0.12 : j === h - 2 ? -0.1 : 0;
          const grain = (fbm(px, py * 1.5, 6, 7) - 0.5) * 0.18;
          p.shade(px, py, ramp, 0.2 + lit * 0.75 + tone + bevel + grain - k * 0.1);
        }
      }
      x += w;
    }
    y += h;
    row++;
  }
}

/** A long guild rug in perspective: madder red field, gold border, a medallion. */
function rug(p: Pixmap): void {
  const y0 = 282;
  const y1 = 350;
  const RED: readonly PaletteKey[] = ['K', 'k', 'j', 'r', 'R'];
  const GOLD: readonly PaletteKey[] = ['k', 'b', 'B', 'o', 'y'];
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) / (y1 - y0);
    const half = 104 + k * 34;
    const cx = 320;
    for (let x = Math.round(cx - half); x <= cx + half; x++) {
      const u = (x - (cx - half)) / (2 * half); // 0..1 across
      const bx = Math.min(x - (cx - half), cx + half - x) / (1 + k * 0.4);
      const by = Math.min(y - y0, y1 - y);
      const border = bx < 8 || by < 5;
      const line = Math.abs(bx - 10) < 1 || Math.abs(by - 7) < 0.6;
      const warm = lightAt(x, y - 20);
      const moon = moonAt(x, y);
      const lit = 0.24 + warm * 0.55 + moon * 0.7 + (valueNoise(x * 2, y, 3, 88) - 0.5) * 0.12;
      if (border) {
        // Little stepped diamonds round the border.
        const motif = (Math.round(u * 60) + by) % 4 === 0 && bx > 2 && by > 1;
        p.shade(x, y, motif ? RED : GOLD, lit + (motif ? 0.2 : -0.05));
      } else if (line) {
        p.shade(x, y, GOLD, lit + 0.1);
      } else {
        // Medallion: a stepped diamond in the middle, smaller ones in the field.
        const du = Math.abs(u - 0.5) * 2.4;
        const dv = Math.abs((y - (y0 + y1) / 2) / ((y1 - y0) / 2));
        const md = du + dv;
        const medallion = md < 0.55;
        const ring = Math.abs(md - 0.62) < 0.05;
        const field = (Math.floor(u * 14) + Math.floor(k * 5)) % 2 === 0 && md > 0.75 && cellRandom(Math.floor(u * 14), Math.floor(k * 5), 89) > 0.5;
        if (ring) p.shade(x, y, GOLD, lit);
        else if (medallion) p.shade(x, y, md < 0.25 ? GOLD : RED, lit + (md < 0.25 ? -0.1 : 0.12));
        else p.shade(x, y, RED, lit - 0.05 + (field ? 0.1 : 0));
      }
    }
    // Fringe at the near and far ends.
  }
  for (let x = 216; x <= 424; x += 2) p.set(x, y0 - 1, 'H');
  for (let x = 182; x <= 458; x += 2) p.set(x, y1 + 1, 'a').set(x, y1 + 2, 'H');
}

// ---------------------------------------------------------------- the window

function inWindow(x: number, y: number): boolean {
  if (x < WIN.x0 || x > WIN.x1 || y > WIN.sill) return false;
  if (y >= WIN_SPRING) return true;
  return Math.hypot(x + 0.5 - WIN_CX, y + 0.5 - WIN_SPRING) <= WIN_R;
}

type Tree = { leaf: readonly PaletteKey[]; accent: readonly PaletteKey[]; density: number; snow: boolean };
const TREES: Record<Season, Tree> = {
  spring: { leaf: ['k', 'r', 'i', 'I', 'W'], accent: ['I', 'W', 'i'], density: 0.75, snow: false },
  summer: { leaf: ['K', 'g', 'T', 'G', 'l'], accent: ['L', 'y'], density: 0.85, snow: false },
  autumn: { leaf: ['k', 'b', 'B', 'o', 'y'], accent: ['R', 'o', 'y'], density: 0.6, snow: false },
  winter: { leaf: ['k', 'q', 'Q', 'e', 'm'], accent: ['W', 'm'], density: 0, snow: true },
};

function windowView(p: Pixmap, r: Rng, season: Season): void {
  const horizon = WIN.sill - 26;
  const tree = TREES[season];
  for (let y = WIN.top; y <= WIN.sill; y++) {
    for (let x = WIN.x0; x <= WIN.x1; x++) {
      if (!inWindow(x, y)) continue;
      const t = (y - WIN.top) / (horizon - WIN.top);
      p.shade(x, y, SKY, 0.12 + t * 0.72 + (valueNoise(x, y, 20, 4) - 0.5) * 0.12);
    }
  }
  // Clouds catching moonlight.
  for (let y = WIN.top + 30; y < horizon - 10; y++) {
    for (let x = WIN.x0; x <= WIN.x1; x++) {
      if (!inWindow(x, y)) continue;
      const c = fbm(x * 0.6, y * 2.2, 26, 13, 3);
      if (c > 0.6) p.shade(x, y, ['q', 'Q', 'P', 'v'], (c - 0.6) * 4.5);
    }
  }
  // Stars (veiled in winter by snow cloud), then the moon.
  const stars = tree.snow ? 30 : 70;
  for (let i = 0; i < stars; i++) {
    const sx = WIN.x0 + Math.floor(rand(r) * (WIN.x1 - WIN.x0));
    const sy = WIN.top + Math.floor(rand(r) * (horizon - WIN.top - 10));
    if (!inWindow(sx, sy)) continue;
    p.set(sx, sy, pick(r, ['W', 'm', 'c', 'v', 'y', 'I'] as const));
    if (rand(r) > 0.92) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (inWindow(sx + dx, sy + dy)) p.set(sx + dx, sy + dy, 'P');
  }
  const mx = 344;
  const my = 66;
  for (let y = my - 30; y <= my + 30; y++) {
    for (let x = mx - 30; x <= mx + 30; x++) {
      if (!inWindow(x, y)) continue;
      const d = Math.hypot(x - mx, y - my);
      if (d < 9) p.shade(x, y, ['S', 'm', 'W'], 1.5 - (d / 9) * 0.6 - fbm(x, y, 4, 2) * 0.9);
      else if (d < 30) p.shade(x, y, ['q', 'Q', 'P', 'v', 'm'], ((30 - d) / 21) ** 2 * 0.8);
    }
  }
  // Elmbrook's rooftops: gables, chimneys and the bell tower, a few windows still lit.
  const roofs = [
    { x: 262, w: 30, h: 20, peak: 12 },
    { x: 288, w: 22, h: 28, peak: 10 },
    { x: 330, w: 34, h: 18, peak: 14 },
    { x: 356, w: 24, h: 24, peak: 11 },
  ];
  const tower = { x: 312, w: 12, top: horizon - 34 };
  for (let x = tower.x; x < tower.x + tower.w; x++) {
    for (let y = tower.top; y <= WIN.sill; y++) p.shade(x, y, MOONSTONE, 0.25 + (x - tower.x) * 0.03 + (y % 5 === 0 ? -0.1 : 0));
  }
  for (let j = 0; j < 16; j++) {
    const half = Math.round(((j + 1) / 16) * (tower.w / 2 + 2));
    for (let x = tower.x + tower.w / 2 - half; x < tower.x + tower.w / 2 + half; x++) p.shade(x, tower.top - 16 + j, ['K', 'k', 'q', 'Q'], 0.25 + (x > tower.x + tower.w / 2 ? 0.35 : 0) + (tree.snow && j < 12 ? 0.5 : 0));
  }
  p.set(tower.x + tower.w / 2, tower.top - 18, 'y').set(tower.x + tower.w / 2, tower.top - 17, 'o');
  p.fillRect(tower.x + 4, tower.top + 6, 4, 5, 'k').fillRect(tower.x + 5, tower.top + 7, 2, 4, 'y');
  for (const rf of roofs) {
    const base = horizon + 4 + Math.floor(rand(r) * 6);
    const wallTop = base - rf.h + rf.peak;
    for (let x = rf.x; x < rf.x + rf.w; x++) for (let y = wallTop; y <= WIN.sill; y++) p.shade(x, y, MOONSTONE, 0.18 + ((x - rf.x) / rf.w) * 0.15 + (valueNoise(x, y, 2, 31) - 0.5) * 0.15);
    for (let j = 0; j < rf.peak; j++) {
      const half = Math.round(((j + 1) / rf.peak) * (rf.w / 2 + 2));
      const mid = rf.x + rf.w / 2;
      for (let x = Math.round(mid - half); x < mid + half; x++) {
        const snowy = tree.snow && j < rf.peak - 2;
        p.shade(x, wallTop - rf.peak + j, snowy ? ['Q', 'e', 'm', 'W'] : ['K', 'j', 'J', 'h'], (snowy ? 0.3 : 0.15) + (x > mid ? 0.35 : 0) + (valueNoise(x * 3, j, 3, 33) - 0.5) * 0.3);
      }
    }
    const chx = rf.x + Math.floor(rf.w * 0.7);
    p.fillRect(chx, wallTop - rf.peak - 2, 3, rf.peak - 2, 'q').set(chx + 2, wallTop - rf.peak - 2, 'S');
    if (rand(r) > 0.3) {
      const wx = rf.x + 4 + Math.floor(rand(r) * (rf.w - 10));
      p.fillRect(wx - 1, wallTop + 3, 6, 6, 'k').fillRect(wx, wallTop + 4, 4, 4, 'y').set(wx, wallTop + 4, 'Y').hline(wx, wx + 3, wallTop + 6, 'o');
    }
  }
  // Treetops along the bottom of the view, in the season's colours.
  for (let x = WIN.x0; x <= WIN.x1; x++) {
    const top = WIN.sill - 10 + Math.round(valueNoise(x, 0, 7, 41) * 9 - 3);
    for (let y = top; y <= WIN.sill; y++) {
      if (tree.snow) p.shade(x, y, y < top + 2 ? ['Q', 'e', 'm'] : ['K', 'k', 'g', 'q'], y < top + 2 ? 0.6 : 0.3 + fbm(x, y, 3, 42) * 0.3);
      else p.shade(x, y, tree.leaf, 0.25 + fbm(x, y, 3, 42) * 0.55 - (y - top) / 30);
    }
  }
  // A branch reaching across the top of the window from the left.
  const branch = (s: number) => ({ x: WIN.x0 - 4 + s, y: 92 - s * 0.55 + Math.sin(s / 9) * 4 });
  for (let s = 0; s < 70; s++) {
    const { x, y } = branch(s);
    const thick = s < 30 ? 2 : 1;
    for (let j = 0; j < thick; j++) if (inWindow(x, Math.round(y) + j)) p.set(x, Math.round(y) + j, j === 0 && thick > 1 ? 'b' : 'k');
    if (tree.snow && inWindow(x, Math.round(y) - 1) && cellRandom(x, 0, 47) > 0.25) p.set(x, Math.round(y) - 1, cellRandom(x, 1, 47) > 0.5 ? 'W' : 'm');
    if (s % 14 === 7) {
      for (let t = 1; t < 12; t++) {
        const tx = x + Math.round(t * 0.6);
        const ty = Math.round(y + (s % 28 === 7 ? t * 0.7 : -t * 0.8));
        if (inWindow(tx, ty)) p.set(tx, ty, 'k');
        if (tree.snow && inWindow(tx, ty - 1) && t % 2 === 0) p.set(tx, ty - 1, 'm');
      }
    }
  }
  if (tree.density > 0) {
    for (let i = 0; i < 26; i++) {
      const s = Math.floor(rand(r) * 66);
      const { x, y } = branch(s);
      const cx = x + (rand(r) - 0.3) * 10;
      const cy = y + (rand(r) - 0.5) * 12;
      const rad = 2.5 + rand(r) * 3.5;
      for (let py = Math.floor(cy - rad); py <= cy + rad; py++) {
        for (let px = Math.floor(cx - rad); px <= cx + rad; px++) {
          if (!inWindow(px, py)) continue;
          const d = Math.hypot(px - cx, py - cy) / rad;
          if (d > 0.7 + fbm(px, py, 3, 43) * 0.5) continue;
          if (cellRandom(px, py, 44) > tree.density + 0.15) continue;
          p.shade(px, py, tree.leaf, 0.45 + (px - cx) / rad * 0.15 - (py - cy) / rad * 0.25 + (cellRandom(px, py, 45) - 0.5) * 0.4);
        }
      }
    }
  }
  // Drifting motes: petals, fireflies, falling leaves or snow.
  const motes = tree.snow ? 60 : season === 'summer' ? 14 : 18;
  for (let i = 0; i < motes; i++) {
    const fx = WIN.x0 + Math.floor(rand(r) * (WIN.x1 - WIN.x0));
    const fy = WIN.top + 20 + Math.floor(rand(r) * (WIN.sill - WIN.top - 24));
    if (inWindow(fx, fy)) p.set(fx, fy, pick(r, tree.accent));
  }
  // Snow on the outside of the sill in winter.
  if (tree.snow) for (let x = WIN.x0; x <= WIN.x1; x++) for (let y = WIN.sill - 2 - Math.round(valueNoise(x, 0, 5, 46) * 2); y <= WIN.sill; y++) p.set(x, y, y === WIN.sill ? 'e' : 'm');
}

/** Stone surround (voussoirs, jambs, deep sill) and leaded glazing over the view. */
function windowFrame(p: Pixmap): void {
  // Leaded quarries: a faint diamond lattice.
  for (let y = WIN.top; y <= WIN.sill; y++) {
    for (let x = WIN.x0; x <= WIN.x1; x++) {
      if (!inWindow(x, y)) continue;
      const a = (x + y) % 14 === 0;
      const b = (x - y + 1400) % 14 === 0;
      if ((a || b) && cellRandom(x, y, 90) > 0.35 && Math.hypot(x - 344, y - 66) > 11) p.set(x, y, 'q');
    }
  }
  // Iron mullion and transoms.
  for (let y = WIN.top; y <= WIN.sill; y++) if (inWindow(WIN_CX, y)) p.set(WIN_CX - 1, y, 'k').set(WIN_CX, y, 'K').set(WIN_CX + 1, y, 's');
  for (const ty of [WIN_SPRING, WIN_SPRING + 50]) for (let x = WIN.x0; x <= WIN.x1; x++) p.set(x, ty, 'k').set(x, ty + 1, 'K');
  // Voussoirs round the head, jamb stones down the sides.
  const ring = 9;
  for (let y = WIN.top - ring; y <= WIN.sill; y++) {
    for (let x = WIN.x0 - ring; x <= WIN.x1 + ring; x++) {
      if (inWindow(x, y)) continue;
      let along: number;
      let depth: number;
      if (y < WIN_SPRING) {
        const d = Math.hypot(x + 0.5 - WIN_CX, y + 0.5 - WIN_SPRING);
        if (d > WIN_R + ring || d < WIN_R) continue;
        depth = d - WIN_R;
        along = Math.atan2(WIN_SPRING - y, x - WIN_CX) * 9;
        const joint = Math.abs(along - Math.round(along)) < 0.08 * (WIN_R / d) * 2;
        const key = Math.abs(along - 9 * (Math.PI / 2)) < 0.6;
        const t = 0.25 + lightAt(x, y) * 0.5 + (depth < 2 ? -0.15 : depth > ring - 2 ? -0.1 : 0.08) + (key ? 0.12 : 0) + (fbm(x, y, 4, 91) - 0.5) * 0.2;
        p.shade(x, y, STONE, joint ? 0.05 : t);
      } else {
        const side = x < WIN.x0 ? WIN.x0 - 1 - x : x - WIN.x1 - 1;
        if (side < 0 || side >= ring) continue;
        const course = Math.floor((y - WIN_SPRING) / 13);
        const long = course % 2 === 0 ? ring : ring - 3;
        if (side >= long) continue;
        const joint = (y - WIN_SPRING) % 13 === 12 || side === long - 1;
        const t = 0.22 + lightAt(x, y) * 0.55 + (side < 2 ? -0.18 : 0.05) + (fbm(x, y, 4, 91) - 0.5) * 0.2;
        p.shade(x, y, STONE, joint ? 0.05 : t);
      }
    }
  }
  // A cool moonlit rim on the inside of the reveal.
  for (let y = WIN.top; y <= WIN.sill; y++) {
    for (let x = WIN.x0 - 2; x <= WIN.x1 + 2; x++) {
      if (inWindow(x, y)) continue;
      const near = inWindow(x + 1, y) || inWindow(x - 1, y) || inWindow(x, y + 1) || inWindow(x, y + 2);
      if (near) p.set(x, y, x > WIN_CX ? 'S' : 's');
    }
  }
  // Deep stone sill.
  for (let y = WIN.sill + 1; y <= WIN.sill + 6; y++) {
    for (let x = WIN.x0 - ring - 4; x <= WIN.x1 + ring + 4; x++) {
      const t = y === WIN.sill + 1 ? 0.55 : y === WIN.sill + 2 ? 0.45 : y === WIN.sill + 6 ? 0.02 : 0.22;
      p.shade(x, y, MOONSTONE, t + (valueNoise(x, y, 5, 92) - 0.5) * 0.12 + lightAt(x, y) * 0.2);
    }
  }
}

// ---------------------------------------------------------------- banners

const CAULDRON_KEY = [
  '.....yYy.......',
  '....y...y......',
  '....y...y......',
  '.....yyy.......',
  '......y........',
  '......yoo......',
  '......y........',
  '......yoo......',
  '..yyyyyyyyyyy..',
  '.oyYYyyyyyyyyo.',
  '.yYyyyyyyyyyoy.',
  '.yyyyyyyyyyyoy.',
  '..yyyyyyyyyoy..',
  '...oyyyyyyoo...',
  '...y.......y...',
  '..oo.......oo..',
];

const WHEAT_COIN = [
  'y.............y',
  'Yy...........yY',
  '.yy.........yy.',
  'Yy...ooooo...yY',
  '.yy.oyYYyyo.yy.',
  '..yoyYyyyyyoy..',
  '..yoyyyoyyyoy..',
  '..yoyyoooyyoy..',
  '..yoyyyoyyyoy..',
  '...yoyyyyyo.y..',
  '...y.ooooo..y..',
  '....y.....y....',
  '.....y...y.....',
  '......y.y......',
  '.......y.......',
];

function banner(p: Pixmap, x0: number, w: number, top: number, len: number, cloth: readonly PaletteKey[], crest: readonly string[]): void {
  const notch = 12;
  for (let y = top; y < top + len; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const u = (x - x0) / (w - 1);
      // Swallowtail: a V cut into the bottom.
      const vDepth = (1 - Math.abs(u - 0.5) * 2) * notch;
      if (y > top + len - 1 - vDepth) continue;
      const fold = Math.sin(u * Math.PI * 3 + 0.4) * 0.14;
      const trim = x < x0 + 2 || x > x0 + w - 3 || y > top + len - 3 - vDepth;
      const lit = 0.3 + lightAt(x, y) * 0.7 + fold - (y - top) / (len * 3);
      if (trim) p.shade(x, y, ['k', 'b', 'B', 'o', 'y'], lit + 0.1);
      else p.shade(x, y, cloth, lit + (valueNoise(x, y * 4, 3, 93) - 0.5) * 0.1);
    }
  }
  // Gold edge line inside the trim.
  for (let y = top + 3; y < top + len - notch - 4; y++) p.set(x0 + 3, y, 'b').set(x0 + w - 4, y, 'b');
  // The crest, centred.
  const cw = crest[0]!.length * 2;
  const cx = x0 + Math.floor((w - cw) / 2);
  const cy = top + 14;
  crest.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i]!;
      if (c === '.') continue;
      for (let d = 0; d < 4; d++) {
        const px = cx + i * 2 + (d % 2);
        const py = cy + j * 2 + (d >> 1);
        const lit = lightAt(px, py) + (d === 0 ? 0.1 : 0);
        const key: PaletteKey = c === 'Y' ? (lit > 0.25 ? 'Y' : 'y') : c === 'y' ? (lit > 0.12 ? 'y' : 'o') : 'B';
        p.set(px, py, key);
      }
      // A dark stitched shadow under each gold thread.
      if (!crest[j + 1]?.[i] || crest[j + 1]![i] === '.') p.set(cx + i * 2 + 1, cy + j * 2 + 2, 'k');
    }
  });
  // A thin gold band above and below the crest.
  for (let x = x0 + 5; x < x0 + w - 5; x++) {
    if (x % 2 === 0) p.set(x, cy - 5, 'o');
    if (x % 2 === 1) p.set(x, cy + crest.length * 2 + 4, 'o');
  }
  // Hanging rod with finials and cords up to the beam.
  for (let x = x0 - 4; x < x0 + w + 4; x++) p.set(x, top - 2, 'S').set(x, top - 1, 'k');
  p.fillRect(x0 - 6, top - 3, 3, 3, 'o').fillRect(x0 + w + 3, top - 3, 3, 3, 'o');
  for (let y = 30; y < top - 2; y++) {
    const dx = Math.round(((y - 30) / (top - 32)) * 4);
    p.set(x0 + 2 - dx, y, 'b').set(x0 + w - 3 + dx, y, 'b');
  }
  // Tassels at the tails.
  for (const tx of [x0 + 1, x0 + w - 2]) {
    p.set(tx, top + len, 'y').set(tx, top + len + 1, 'o').set(tx - 1, top + len + 2, 'o').set(tx + 1, top + len + 2, 'b');
  }
}

// ---------------------------------------------------------------- notice board

function noticeBoard(p: Pixmap, r: Rng): void {
  const x0 = 14;
  const x1 = 126;
  const y0 = 96;
  const y1 = 194;
  // Cork with speckle.
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const speck = cellRandom(x, y, 94) > 0.8 ? 0.15 : cellRandom(x, y, 95) > 0.85 ? -0.15 : 0;
      p.shade(x, y, ['K', 'k', 'b', 'B', 'n'], 0.15 + lightAt(x, y) * 0.6 + speck + (fbm(x, y, 5, 96) - 0.5) * 0.15);
    }
  }
  // Commission papers, pinned and sealed, overlapping.
  for (let i = 0; i < 16; i++) {
    const w = 17 + Math.floor(rand(r) * 8);
    const h = 20 + Math.floor(rand(r) * 10);
    const col = i < 12 ? i % 4 : Math.floor(rand(r) * 4);
    const rowI = i < 12 ? Math.floor(i / 4) : Math.floor(rand(r) * 3);
    const px = Math.min(x1 - w - 2, x0 + 3 + col * 27 + Math.floor(rand(r) * 7) - (i >= 12 ? 12 : 0));
    const py = Math.min(y1 - h - 3, y0 + 3 + rowI * 31 + Math.floor(rand(r) * 6) + (i >= 12 ? 14 : 0));
    const tone = (rand(r) - 0.5) * 0.15 + (rand(r) > 0.7 ? -0.15 : 0);
    const curl = rand(r) > 0.5;
    for (let y = py; y < py + h; y++) {
      for (let x = px; x < px + w; x++) {
        const dc = x - px + (py + h - 1 - y);
        if (curl && x > px + w - 4 && y > py + h - 4 && x - (px + w - 4) + (y - (py + h - 4)) > 2) continue;
        const shadowEdge = x === px + w - 1 || y === py + h - 1;
        p.shade(x, y, PAPER, (shadowEdge ? 0.1 : 0.2) + lightAt(x, y) * 0.7 + tone + (dc < 2 ? -0.05 : 0));
      }
    }
    p.hline(px + 1, px + w, py + h, 'k');
    for (let y = py + 1; y <= py + h; y++) p.set(px + w, y, 'k');
    // Heading and lines of writing.
    p.hline(px + 3, px + w - 5, py + 4, 'J');
    for (let y = py + 8; y < py + h - 5; y += 3) {
      const len = 4 + Math.floor(rand(r) * (w - 9));
      for (let x = px + 3; x < px + 3 + len; x++) if (cellRandom(x, y, 97) > 0.2) p.set(x, y, 'h');
    }
    // A wax seal at the foot, or a pin at the top.
    if (rand(r) > 0.4) {
      const sx = px + Math.floor(w / 2) - 1;
      const sy = py + h - 5;
      const wax = pick(r, [['r', 'R'], ['p', 'P'], ['g', 'G']] as const);
      p.fillRect(sx, sy, 3, 3, wax[0]).set(sx, sy, wax[1]).set(sx - 1, sy + 1, wax[0]).set(sx + 3, sy + 1, wax[0]).set(sx + 1, sy + 3, wax[0]);
      p.set(sx + 1, sy + 4, wax[0]).set(sx + 2, sy + 5, wax[0]);
    }
    p.set(px + Math.floor(w / 2), py + 1, 'k').set(px + Math.floor(w / 2), py, pick(r, ['R', 'y', 'e'] as const));
  }
  // Frame, with a carved header plank and two brass studs.
  timber(p, x0 - 5, y0 - 5, x1 - x0 + 10, 5, false, 0.1);
  timber(p, x0 - 5, y1, x1 - x0 + 10, 5, false);
  timber(p, x0 - 5, y0, 5, y1 - y0, true);
  timber(p, x1, y0, 5, y1 - y0, true);
  timber(p, x0 + 20, y0 - 15, x1 - x0 - 40, 9, false, 0.12);
  p.set(x0 + 23, y0 - 11, 'y').set(x1 - 24, y0 - 11, 'y');
  // "Commissions" suggested by a row of carved marks.
  for (let x = x0 + 29; x < x1 - 30; x++) if (x % 3 !== 0 || x % 7 === 0) p.set(x, y0 - 11 + (x % 5 === 0 ? 1 : 0), 'b');
}

// ---------------------------------------------------------------- ledgers and the clerk's desk

const LEATHER: readonly (readonly PaletteKey[])[] = [
  ['K', 'k', 'r', 'R'],
  ['K', 'k', 'u', 'U'],
  ['K', 'k', 'g', 'G'],
  ['K', 'k', 'b', 'B'],
  ['K', 'k', 'p', 'P'],
  ['K', 'b', 'B', 'n'],
  ['K', 'k', 'T', 't'],
];

function shelfOfLedgers(p: Pixmap, r: Rng, x0: number, x1: number, base: number, room: number): void {
  let x = x0 + 2;
  while (x < x1 - 4) {
    const roll = rand(r);
    if (roll < 0.1) {
      // A stack lying flat.
      const n = 2 + Math.floor(rand(r) * 3);
      const w = 12 + Math.floor(rand(r) * 6);
      if (x + w > x1 - 2) break;
      for (let k = 0; k < n; k++) {
        const ramp = pick(r, LEATHER);
        for (let y = base - (k + 1) * 4; y < base - k * 4; y++) for (let i = 0; i < w - k; i++) p.shade(x + i, y, ramp, 0.25 + lightAt(x + i, y) * 0.6 + (y === base - (k + 1) * 4 ? 0.2 : 0));
        p.hline(x + 1, x + w - k - 2, base - k * 4 - 2, 'w');
      }
      x += w + 2;
    } else if (roll < 0.17) {
      // Rolled scrolls.
      for (let k = 0; k < 3; k++) {
        p.fillEllipse(x + 3 + k * 4, base - 3, 2.2, 2.2, 'a').set(x + 3 + k * 4, base - 3, 'H');
      }
      p.fillEllipse(x + 7, base - 7, 2.2, 2.2, 'w').set(x + 7, base - 7, 'H');
      x += 15;
    } else {
      const w = 4 + Math.floor(rand(r) * 3);
      const h = Math.min(room - 3, 16 + Math.floor(rand(r) * 12));
      const ramp = pick(r, LEATHER);
      const lean = rand(r) > 0.9 ? 1 : 0;
      for (let y = base - h; y < base; y++) {
        for (let i = 0; i < w; i++) {
          const sx = x + i + (lean && y < base - h / 2 ? 1 : 0);
          const band = y === base - h + 3 || y === base - 4;
          if (band && i > 0 && i < w - 1) p.set(sx, y, lightAt(sx, y) > 0.3 ? 'y' : 'o');
          else p.shade(sx, y, ramp, 0.3 + lightAt(sx, y) * 0.6 + (i === 0 ? 0.15 : i === w - 1 ? -0.25 : 0));
        }
      }
      if (rand(r) > 0.6) p.fillRect(x + 1, base - Math.floor(h / 2) - 2, w - 2, 3, 'a');
      x += w + (rand(r) > 0.8 ? 1 : 0);
    }
  }
}

function bookshelf(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, y1: number, shelves: readonly number[]): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) p.shade(x, y, ['K', 'k', 'q', 'j'], 0.1 + lightAt(x, y) * 0.5 + (fbm(x, y, 8, 51) - 0.5) * 0.1);
  let prev = y0;
  for (const sy of shelves) {
    shelfOfLedgers(p, r, x0, x1, sy, sy - prev);
    timber(p, x0, sy, x1 - x0, 4, false, 0.15);
    prev = sy + 4;
  }
  timber(p, x0 - 6, y0 - 6, 6, y1 - y0 + 6, true);
  timber(p, x1, y0 - 6, 6, y1 - y0 + 6, true);
  timber(p, x0 - 9, y0 - 11, x1 - x0 + 18, 6, false, 0.1);
}

function candle(p: Pixmap, x: number, y: number, h: number): void {
  // Candle from y down h pixels, a drip, and a flame above.
  for (let j = 0; j < h; j++) p.set(x - 1, y + j, 'a').set(x, y + j, 'w').set(x + 1, y + j, j < 2 ? 'W' : 'a');
  p.set(x + 1, y + 2, 'w').set(x + 1, y + 3, 'w');
  p.set(x, y - 1, 'k');
  p.set(x, y - 2, 'y').set(x, y - 3, 'Y').set(x, y - 4, 'W').set(x, y - 5, 'Y').set(x - 1, y - 3, 'o').set(x + 1, y - 3, 'y').set(x, y - 6, 'y');
}

function clerkDesk(p: Pixmap, r: Rng): void {
  const x0 = 512;
  const x1 = 628;
  const top = 196;
  // Legs and stretcher.
  for (const lx of [x0 + 4, x1 - 9]) timber(p, lx, top + 8, 5, FLOOR + 8 - top - 8, true);
  timber(p, x0 + 9, FLOOR - 8, x1 - x0 - 18, 3, false, -0.05);
  // Front panel: a deep apron with two framed panels.
  for (let y = top + 6; y < top + 40; y++) {
    for (let x = x0; x < x1; x++) {
      const px = (x - x0) % 57;
      const frame = px < 4 || px > 52 || y < top + 10 || y > top + 35;
      const inset = !frame && (px === 4 || y === top + 10) ? -0.25 : 0;
      p.shade(x, y, WOOD, 0.15 + lightAt(x, y) * 0.6 + (frame ? 0.08 : 0) + inset + (valueNoise(x * 3, y, 10, 63) - 0.5) * 0.14);
    }
  }
  p.hline(x0, x1 - 1, top + 40, 'K');
  // Slanted writing top with a lip.
  for (let y = top - 4; y < top + 6; y++) {
    for (let x = x0 - 4; x < x1 + 2; x++) {
      const t = y === top - 4 ? 0.7 : y > top + 3 ? 0.15 : 0.5 - (y - top) * 0.04;
      p.shade(x, y, WOOD, t + lightAt(x, y) * 0.35 + (valueNoise(x * 3, y, 12, 62) - 0.5) * 0.12);
    }
  }
  p.hline(x0 - 4, x1 + 1, top + 6, 'K');
  // The open ledger.
  const bx = 524;
  p.fillRect(bx - 1, top - 7, 34, 4, 'r').hline(bx - 1, bx + 32, top - 4, 'k');
  for (let y = top - 9; y < top - 4; y++) {
    for (let x = bx; x < bx + 32; x++) {
      if (x === bx + 15 || x === bx + 16) {
        p.set(x, y, 'H');
        continue;
      }
      p.shade(x, y, PAPER, 0.45 + lightAt(x, y) * 0.55 - (y === top - 9 ? 0.15 : 0));
    }
  }
  for (let x = bx + 2; x < bx + 30; x++) if (x !== bx + 15 && x !== bx + 16 && cellRandom(x, 0, 98) > 0.3) p.set(x, top - 7, 'h');
  // Inkwell and quill.
  p.fillRect(548, top - 9, 6, 5, 'k').hline(549, 552, top - 10, 's').set(549, top - 8, 'U');
  for (let j = 0; j < 14; j++) p.set(552 + Math.round(j * 0.5), top - 11 - j, j < 3 ? 'k' : 'm');
  for (let j = 4; j < 14; j++) p.set(553 + Math.round(j * 0.5), top - 11 - j, j % 2 ? 'w' : 'e');
  // The candle in a brass dish.
  p.hline(559, 567, top - 4, 'o').hline(560, 566, top - 5, 'y').set(568, top - 5, 'o').set(569, top - 6, 'o');
  candle(p, 563, top - 20, 15);
  // Coins stacked for the rent, a brass bell, and a pile of ledgers at the end.
  for (const [cx, n] of [[574, 4], [580, 2], [585, 3]] as const) for (let k = 0; k < n; k++) p.hline(cx, cx + 4, top - 5 - k, k === n - 1 ? 'Y' : k % 2 ? 'y' : 'o');
  p.fillEllipse(594, top - 7, 3.5, 3.5, 'o').fillRect(591, top - 7, 7, 3, 'o').hline(590, 598, top - 5, 'y').set(593, top - 9, 'Y').set(594, top - 12, 'k');
  for (let k = 0; k < 5; k++) {
    const ramp = pick(r, LEATHER);
    const w = 20 - (k % 2) * 2;
    const sx = 602 + (k % 2);
    for (let y = top - 4 - (k + 1) * 5; y < top - 4 - k * 5; y++) for (let i = 0; i < w; i++) p.shade(sx + i, y, ramp, 0.25 + lightAt(sx + i, y) * 0.6 + (y === top - 4 - (k + 1) * 5 ? 0.2 : 0) + (i === w - 1 ? -0.2 : 0));
    p.hline(sx + 1, sx + w - 3, top - 4 - k * 5 - 2, 'w');
  }
}

/** The guild's iron-bound rent coffer on the floor by the desk. */
function coffer(p: Pixmap, x0: number, base: number): void {
  const w = 40;
  const h = 18;
  const lid = 8;
  for (let y = base - h - lid; y < base; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const inLid = y < base - h;
      const dy = base - h - y;
      if (inLid && (x - x0 < lid - dy || x0 + w - 1 - x < lid - dy) && dy > lid - 4) continue;
      const strap = (x - x0) % 13 < 3 || y === base - h || y === base - 1;
      const t = 0.28 + lightAt(x, y) * 0.7 + (inLid ? 0.12 - dy * 0.01 : 0) + (x === x0 ? 0.1 : x === x0 + w - 1 ? -0.2 : 0);
      if (strap) p.shade(x, y, IRON, t + 0.1);
      else p.shade(x, y, WOOD, t + (valueNoise(x * 4, y, 8, 99) - 0.5) * 0.15);
    }
  }
  for (let x = x0 - 1; x <= x0 + w; x++) p.set(x, base, 'K');
  // Lock plate and a few stud highlights.
  p.fillRect(x0 + w / 2 - 3, base - h - 2, 6, 7, 'o').fillRect(x0 + w / 2 - 2, base - h - 1, 4, 5, 'y').set(x0 + w / 2 - 1, base - h + 1, 'k').set(x0 + w / 2 - 1, base - h + 2, 'k');
  for (let x = x0 + 1; x < x0 + w; x += 13) for (let y = base - h + 3; y < base - 2; y += 5) p.set(x, y, 'e');
}

// ---------------------------------------------------------------- lights

function sconce(p: Pixmap, x: number, y: number): void {
  // Iron backplate on the post, a curled arm, a drip cup and a candle.
  p.fillRect(x - 2, y + 4, 5, 12, 'k').fillRect(x - 1, y + 5, 3, 10, 's').set(x, y + 7, 'S').set(x, y + 12, 'S');
  p.hline(x - 4, x + 4, y + 3, 'k').hline(x - 3, x + 3, y + 2, 'S').hline(x - 4, x + 4, y + 1, 'o');
  candle(p, x, y - 6, 7);
}

function candelabra(p: Pixmap, x: number, ground: number): void {
  // Tripod feet.
  for (let i = 0; i < 8; i++) p.set(x - i, ground - 2 + Math.floor(i / 3), 'k').set(x + i, ground - 2 + Math.floor(i / 3), 'k').set(x - i, ground - 3 + Math.floor(i / 3), i < 6 ? 's' : 'k');
  // Twisted shaft with knops.
  for (let y = 180; y < ground - 2; y++) p.set(x - 1, y, 'k').set(x, y, y % 4 === 0 ? 'S' : 's').set(x + 1, y, 'k');
  for (const ky of [196, 222, ground - 8]) p.fillRect(x - 2, ky, 5, 3, 'k').hline(x - 1, x + 1, ky, 'S');
  // Arms curving up to three cups.
  for (let i = 1; i <= 12; i++) {
    const ay = 186 - Math.round(Math.sin((i / 12) * Math.PI * 0.5) * 6);
    p.set(x - i, ay, 'k').set(x + i, ay, 'k').set(x - i, ay - 1, 's').set(x + i, ay - 1, 'S');
  }
  for (const cx of [x - 12, x, x + 12]) {
    const cy = cx === x ? 177 : 179;
    p.hline(cx - 2, cx + 2, cy, 'k').hline(cx - 2, cx + 2, cy - 1, 'S');
    candle(p, cx, cy - (cx === x ? 9 : 7), cx === x ? 8 : 6);
  }
}

// ---------------------------------------------------------------- finish

function vignette(p: Pixmap): void {
  const darker = new Map<string, PaletteKey>();
  for (const ramp of [STONE, WOOD, SKY, MOONSTONE, ['K', 'k', 'q', 'j'] as const]) {
    for (let i = 1; i < ramp.length; i++) if (!darker.has(PALETTE[ramp[i]!])) darker.set(PALETTE[ramp[i]!], ramp[i - 1]!);
  }
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < GUILD_H; y++) {
    for (let x = 0; x < GUILD_W; x++) {
      const v = Math.max(0, Math.hypot((x - 320) / 330, (y - 170) / 210) - 0.6) * 2.2;
      if (v <= ((bayer[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16) continue;
      const i = (y * GUILD_W + x) * 4;
      const hexKey = '#' + [0, 1, 2].map((k) => (p.data[i + k] ?? 0).toString(16).padStart(2, '0')).join('');
      const d = darker.get(hexKey);
      if (d) p.set(x, y, d);
    }
  }
}

/**
 * The guild hall interior, 640x360. `season` changes the view through the arched window
 * (blossom, summer leaves, autumn leaves, snow); everything else is the same all year.
 */
export function guildHallBackdrop(opts: { season: Season } = { season: 'summer' }, seed = 'elmbrook-guild'): Pixmap {
  const p = new Pixmap(GUILD_W, GUILD_H);
  const r: Rng = { s: seedRng(seed) };
  stoneWall(p, r, 0, GUILD_W, 30, 204);
  windowView(p, r, opts.season);
  windowFrame(p);
  wainscot(p);
  floor(p, r);
  rug(p);
  // Shadow pooled along the foot of the wall.
  for (let x = 0; x < GUILD_W; x++) for (let y = FLOOR; y < FLOOR + 6; y++) stipple(p, x, y, (FLOOR + 6 - y) / 7, 'k');
  ceiling(p);
  // Timber posts carrying the wall plate, with knee braces.
  for (const px of [136, 494]) {
    timber(p, px, 30, 10, FLOOR - 30, true);
    brace(p, px + 10, 66, px + 46, 30, 6);
    brace(p, px - 36, 30, px, 66, 6);
  }
  noticeBoard(p, r);
  bookshelf(p, r, 518, 630, 44, 160, [80, 120, 160]);
  banner(p, 192, 44, 40, 100, ['K', 'k', 'j', 'r', 'R'], CAULDRON_KEY);
  banner(p, 404, 44, 40, 100, ['K', 'k', 'z', 'u', 'U'], WHEAT_COIN);
  clerkDesk(p, r);
  coffer(p, 462, 276);
  candelabra(p, 108, FLOOR + 6);
  sconce(p, 141, 92);
  sconce(p, 499, 92);
  vignette(p);
  return p;
}
