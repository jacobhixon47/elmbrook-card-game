import type { Season } from '../../core';
import { seedRng } from '../../core/rng';
import { EXIT, HOMES, SQUARE_H, SQUARE_W, type Home, type HomeId } from '../../view/market-square';
import { cellRandom, fbm, valueNoise } from '../noise';
import { PALETTE, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { pick, rand, type Rng } from './town';

// The walkable Night Market (GDD §9): Elmbrook's square after dark, seen from above like the
// cottage. Cobbles round a stone well, timber-and-plaster houses with steep roofs along the back,
// a low wall over dark water along the front with the bridge you came in by, trees at the edges.
// Square space is 320x180 (src/view/market-square.ts), drawn at 2x. The ground is one picture;
// each stall, the well, the tinker's rug and the fire pit are sprites the scene sorts with you.
// Light is a cool moonlit night baked in, darker toward the edges; the scene adds warm glows at
// `squareLights`, so the sprites carry only a touch of lamplight of their own.

export type SquareOptions = { season: Season; snowedIn: boolean };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x: number, y: number) => ((BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] ?? 0) + 0.5) / 16;

/** One step darker, keeping snow and moonlight cold (never warm parchment). */
const DARKER: Record<PaletteKey, PaletteKey> = {
  K: 'K', k: 'K', q: 'k', Q: 'q', z: 'K', Z: 'z', x: 'Z', X: 'x', u: 'z', U: 'u', c: 'U',
  j: 'k', J: 'j', h: 'J', H: 'h', a: 'H', b: 'k', B: 'b', n: 'B', w: 'a', W: 'm',
  y: 'n', Y: 'y', o: 'B', r: 'j', R: 'r', i: 'r', I: 'i', g: 'K', G: 'g', l: 'G', L: 'l',
  p: 'k', P: 'p', v: 'P', m: 'e', s: 'k', S: 's', e: 'S', T: 'g', t: 'T',
};
const KEY_OF = new Map(Object.entries(PALETTE).map(([k, v]) => [v.slice(1).toLowerCase(), k as PaletteKey]));
function keyAt(p: Pixmap, x: number, y: number): PaletteKey | null {
  if (!p.isSet(x, y)) return null;
  const i = (y * p.width + x) * 4;
  const hex = ((p.data[i]! << 16) | (p.data[i + 1]! << 8) | p.data[i + 2]!).toString(16).padStart(6, '0');
  return KEY_OF.get(hex) ?? null;
}
function darken(p: Pixmap, x: number, y: number, steps = 1): void {
  let k = keyAt(p, x, y);
  if (!k) return;
  while (steps-- > 0) k = DARKER[k];
  p.set(x, y, k);
}

const WARM_COBBLE: readonly PaletteKey[] = ['k', 'q', 'j', 'J', 'h', 'H'];
const COOL_COBBLE: readonly PaletteKey[] = ['k', 'q', 'Q', 's', 'S', 'e'];
const SNOW: readonly PaletteKey[] = ['x', 'X', 'e', 'm', 'W'];
const WOOD: readonly PaletteKey[] = ['K', 'k', 'b', 'B', 'n', 'a'];
const STONE: readonly PaletteKey[] = ['K', 'k', 's', 'S', 'e', 'm'];

/** The well's middle, where the paving rings are centred. */
const WELL_C = { x: 160, y: 88 };
/** The paved lane from the well down to the bridge. */
const LANE = { x0: 148, x1: 171 };
const WALL_Y = 172;
const WATER_Y = 176;

/** Moonlight on the ground, 0..1: open sky over the middle, shadow under the houses and trees. */
function moon(x: number, y: number): number {
  const centre = 1 - Math.min(1, Math.hypot((x - 160) / 190, (y - 96) / 120));
  const eaves = y < 40 ? (40 - y) / 40 : 0;
  return 0.3 + centre * 0.5 - eaves * 0.25;
}

function snowPx(p: Pixmap, x: number, y: number, t: number): void {
  flat(p, x, y, SNOW, t);
}

// ---------------------------------------------------------------- the ground

/** Nearest and second-nearest jittered seeds: Voronoi cobbles, offset every other row. */
function cobbleCell(x: number, y: number, cw: number, ch: number, seed: number): { d1: number; d2: number; id: number; sx: number; sy: number } {
  const gy = Math.floor(y / ch);
  let d1 = 1e9;
  let d2 = 1e9;
  let id = 0;
  let sx = 0;
  let sy = 0;
  for (let j = gy - 1; j <= gy + 1; j++) {
    const off = (j & 1) * cw * 0.5;
    const gx = Math.floor((x - off) / cw);
    for (let i = gx - 1; i <= gx + 1; i++) {
      const px = i * cw + off + cw * (0.2 + cellRandom(i, j, seed) * 0.6);
      const py = j * ch + ch * (0.2 + cellRandom(i, j, seed + 1) * 0.6);
      const d = Math.hypot((x - px) / cw, (y - py) / ch) * Math.min(cw, ch);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = i * 7919 + j * 104729;
        sx = px;
        sy = py;
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id, sx, sy };
}

/** A ramp step without dithering: flat colours read better than stipple at this size. */
function flat(p: Pixmap, x: number, y: number, ramp: readonly PaletteKey[], t: number): void {
  p.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))]!);
}

/** A stone's body colour: one step up in the moonlit middle, chosen per stone so light falls in whole stones. */
function stoneStep(light: number, tone: number, pick2: number): number {
  const v = light + (tone - 0.5) * 0.3;
  return v > 0.42 + pick2 * 0.22 ? 3 : v < 0.12 + pick2 * 0.16 ? 1 : 2;
}

function cobbles(p: Pixmap, snowedIn: boolean): void {
  const mortar = (x: number, y: number) => {
    const c = cobbleCell(x, y, 8, 5, 11);
    return c.d2 - c.d1 < 1.05;
  };
  for (let y = 24; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      const c = cobbleCell(x, y, 8, 5, 11);
      const tone = cellRandom(c.id, 3, 12);
      // Mostly warm mauve stone, as in Jacob's concepts (Oct 19), with the odd grey one.
      const ramp = snowedIn || tone > 0.9 ? COOL_COBBLE : WARM_COBBLE;
      if (c.d2 - c.d1 < 1.05) {
        p.set(x, y, 'q');
        continue;
      }
      const step = stoneStep(moon(c.sx, c.sy), tone, cellRandom(c.id, 4, 12));
      const lit = mortar(x, y - 1) && !mortar(x, y + 1);
      const dark = mortar(x, y + 1) || mortar(x + 1, y);
      p.set(x, y, ramp[lit ? step + 1 : dark ? step - 1 : step]!);
    }
  }
}

/** Fitted stones in rings round the well, with a curb of paler stone at the edge. */
function paving(p: Pixmap, snowedIn: boolean): void {
  const R = 54;
  for (let y = 40; y < 140; y++) {
    for (let x = 90; x < 230; x++) {
      const dx = x + 0.5 - WELL_C.x;
      const dy = (y + 0.5 - WELL_C.y) * 1.4;
      const rr = Math.hypot(dx, dy);
      if (rr > R) continue;
      const curb = rr > R - 5;
      const ringW = 6;
      const ring = curb ? 99 : Math.floor(rr / ringW);
      const theta = Math.atan2(dy, dx) + Math.PI;
      const segLen = curb ? 10 : 8;
      const along = (theta * (curb ? R - 2.5 : (ring + 0.5) * ringW)) / segLen + (ring % 2) * 0.5;
      const seg = Math.floor(along);
      const inRing = curb ? rr - (R - 5) : rr - ring * ringW;
      const w = curb ? 5 : ringW;
      if (inRing < 1 || (along - seg) * segLen < 1 || rr > R - 1) {
        p.set(x, y, 'k');
        continue;
      }
      const tone = cellRandom(ring, seg, 21);
      const ramp = snowedIn || curb || tone > 0.75 ? COOL_COBBLE : WARM_COBBLE;
      const step = curb ? 3 : stoneStep(moon(x, y) + 0.05, tone, cellRandom(ring, seg, 22));
      // Lit on the side away from the well (the moon is high), shadowed toward it.
      const edge = dy < 0 ? (inRing < 2 ? 1 : inRing > w - 1 ? -1 : 0) : inRing > w - 1 ? 1 : inRing < 2 ? -1 : 0;
      p.set(x, y, ramp[Math.max(1, Math.min(ramp.length - 1, step + edge))]!);
    }
  }
}

/** Big flagstones down the middle, from the well's rings to the bridge. */
function lane(p: Pixmap, snowedIn: boolean): void {
  const y0 = 118;
  for (let y = 30; y < WALL_Y; y++) {
    if (y >= 60 && y < y0) continue;
    for (let x = LANE.x0; x <= LANE.x1; x++) {
      const dx = x + 0.5 - WELL_C.x;
      const dy = (y + 0.5 - WELL_C.y) * 1.4;
      if (Math.hypot(dx, dy) < 54) continue;
      const row = Math.floor((y - y0 + 70) / 7);
      const off = row % 2 ? 6 : 0;
      const col = Math.floor((x - LANE.x0 + off) / 12);
      const ry = (y - y0 + 70) % 7;
      const rx = (x - LANE.x0 + off) % 12;
      if (x === LANE.x0 || x === LANE.x1) {
        p.set(x, y, y % 4 === 0 ? 'k' : 'S');
        continue;
      }
      if (ry === 6 || rx === 11) {
        p.set(x, y, 'k');
        continue;
      }
      const tone = cellRandom(row, col, 31);
      const ramp = snowedIn || tone > 0.75 ? COOL_COBBLE : WARM_COBBLE;
      const step = stoneStep(moon(x, y) + 0.05, tone, cellRandom(row, col, 32));
      p.set(x, y, ramp[ry === 0 ? step + 1 : ry === 5 || rx === 10 ? step - 1 : step]!);
    }
  }
}

// ---------------------------------------------------------------- the houses

type House = {
  x: number;
  w: number;
  roof: 'slate' | 'shingle';
  /** A gable facing the square: its width (the whole house, or a cross-gable over the door). */
  gable?: number;
  door?: number;
  windows: readonly { x: number; y: number; lit?: boolean }[];
  chimney?: number;
};

const EAVE = 15;
const HOUSES: readonly House[] = [
  { x: -6, w: 36, roof: 'slate', windows: [{ x: 21, y: 22 }], chimney: 8 },
  { x: 30, w: 34, roof: 'shingle', gable: 34, windows: [{ x: 45, y: 7 }] },
  { x: 64, w: 32, roof: 'shingle', door: 70, windows: [{ x: 82, y: 22, lit: true }, { x: 82, y: 16 }], chimney: 86 },
  { x: 96, w: 36, roof: 'slate', gable: 36, windows: [{ x: 112, y: 7 }] },
  { x: 132, w: 56, roof: 'shingle', gable: 26, door: 157, windows: [{ x: 140, y: 22, lit: true }, { x: 176, y: 22 }, { x: 158, y: 9 }, { x: 140, y: 16 }, { x: 176, y: 16 }], chimney: 178 },
  { x: 188, w: 38, roof: 'slate', windows: [], chimney: 200 },
  { x: 226, w: 28, roof: 'shingle', gable: 28, windows: [{ x: 238, y: 9 }, { x: 232, y: 22 }, { x: 244, y: 22 }] },
  { x: 254, w: 38, roof: 'slate', windows: [], chimney: 280 },
  { x: 292, w: 34, roof: 'shingle', gable: 34, windows: [{ x: 307, y: 7 }, { x: 296, y: 22 }] },
];

/** The two lit windows' middles, for glows. */
const LIT_WINDOWS = HOUSES.flatMap((h) => h.windows.filter((w) => w.lit).map((w) => ({ x: w.x + 2, y: w.y + 2 })));

function facadeTop(h: House, x: number): number {
  if (!h.gable) return EAVE;
  const mid = h.x + h.w / 2;
  const half = h.gable / 2;
  const d = Math.abs(x + 0.5 - mid);
  if (d >= half) return EAVE;
  const peak = 1;
  return Math.round(peak + (d / half) * (EAVE - peak));
}

function house(p: Pixmap, h: House, winter: boolean): void {
  const roof: readonly PaletteKey[] = h.roof === 'slate' ? ['K', 'k', 'q', 'Q'] : ['K', 'k', 'j', 'J'];
  const mid = h.x + h.w / 2;
  for (let x = h.x; x < h.x + h.w; x++) {
    const top = facadeTop(h, x);
    const inGable = !!h.gable && Math.abs(x + 0.5 - mid) < h.gable / 2;
    // The roof: courses of shingles, the left slope of a gable a touch brighter under the moon.
    for (let y = 0; y < top; y++) {
      const course = Math.floor((y + 1) / 3);
      const joint = (y + 1) % 3 === 0;
      const seam = (x + course * 2) % 5 === 0;
      const lit = inGable ? x < mid : y > top - 5;
      if (winter) {
        if (joint && cellRandom(x >> 1, course, 41) > 0.55) p.set(x, y, 'Z');
        else p.set(x, y, inGable ? (x < mid ? 'X' : 'x') : y > top - 4 ? 'X' : 'x');
        continue;
      }
      p.set(x, y, joint ? 'K' : seam ? roof[1]! : lit && cellRandom(x >> 1, course, 43) > 0.4 ? roof[3]! : roof[2]!);
    }
    if (inGable && Math.abs(x + 0.5 - mid) < 1 && !winter) for (let y = 0; y < top; y++) p.set(x, y, 'K');
    // Barge boards along the gable, and the dark eave line.
    p.set(x, top - 1, 'k');
    if (top < EAVE) p.set(x, top, 'B');
    // The facade: plaster between dark timbers, on a stone footing.
    for (let y = top + (top < EAVE ? 1 : 0); y < 30; y++) {
      if (y >= 28) {
        p.set(x, y, (x + (y === 28 ? 0 : 3)) % 6 === 0 ? 'k' : y === 28 ? 'S' : 's');
        continue;
      }
      const lx = x - h.x;
      const post = lx === 0 || lx === h.w - 1 || (lx % 10 === 5 && h.w > 30) || (inGable && Math.abs(x + 0.5 - mid) < 1);
      const beam = y === 21 || y === EAVE;
      if (post || beam) {
        p.set(x, y, post && (lx === 0 || x === Math.floor(mid)) ? 'k' : 'b');
        continue;
      }
      p.set(x, y, y === top + (top < EAVE ? 1 : 0) || y === 22 ? 'J' : inGable && x < mid ? 'H' : 'h');
    }
    // Braces in the gable.
    if (inGable && top < EAVE) {
      const d = Math.abs(x + 0.5 - mid);
      const by = Math.round(EAVE - d * 0.6);
      if (by > top + 1 && by < EAVE && d > 3) p.set(x, by, 'b').set(x, by + 1, 'J');
    }
  }
  if (h.chimney !== undefined) {
    const cx = h.chimney;
    for (let y = 0; y < 9; y++) for (let x = cx; x < cx + 5; x++) p.set(x, y, y % 3 === 2 ? 'k' : x === cx ? 'S' : 's');
    p.hline(cx - 1, cx + 5, 0, winter ? 'm' : 'S').hline(cx, cx + 4, 1, 'K');
  }
  if (h.door !== undefined) door(p, h.door, 22);
  for (const w of h.windows) houseWindow(p, w.x, w.y, !!w.lit);
  if (winter) {
    // Icicles hanging off the eaves.
    for (let x = h.x; x < h.x + h.w; x++) {
      const top = facadeTop(h, x);
      if (top === EAVE && cellRandom(x, 9, 45) > 0.62) {
        const len = 1 + Math.floor(cellRandom(x, 10, 45) * 3);
        for (let j = 0; j < len; j++) p.set(x, EAVE + j, j === 0 ? 'm' : 'c');
      }
    }
  }
}

function houseWindow(p: Pixmap, x: number, y: number, lit: boolean): void {
  p.strokeRect(x - 1, y - 1, 6, 6, 'k');
  if (lit) {
    p.fillRect(x, y, 4, 4, 'y').fillRect(x + 1, y + 1, 2, 2, 'Y').set(x, y + 3, 'o').set(x + 3, y + 3, 'o');
    p.hline(x, x + 3, y + 1, 'B');
    p.set(x + 1, y, 'B').set(x + 1, y + 2, 'B').set(x + 1, y + 3, 'B');
  } else {
    p.fillRect(x, y, 4, 4, 'z').set(x, y, 'Z').set(x + 2, y + 2, 'u');
    p.hline(x, x + 3, y + 1, 'b');
    p.set(x + 1, y + 2, 'b').set(x + 1, y + 3, 'b');
  }
  // A little sill.
  p.hline(x - 1, x + 4, y + 5, 'B');
}

function door(p: Pixmap, x: number, y: number): void {
  p.fillRect(x - 1, y - 1, 8, 7, 'k');
  p.fillRect(x, y, 6, 6, 'b');
  for (let j = y; j < y + 6; j++) p.set(x + 2, j, 'k').set(x + 4, j, 'B');
  p.hline(x + 1, x + 4, y - 1, 'b');
  p.set(x + 5, y + 3, 'n');
}

// ---------------------------------------------------------------- trees

const LEAVES: Record<Season, readonly PaletteKey[]> = {
  spring: ['k', 'g', 'G', 'l', 'L'],
  summer: ['K', 'g', 'T', 'G', 'l'],
  autumn: ['k', 'j', 'r', 'B', 'o', 'y'],
  winter: ['K', 'k', 'g', 'G'],
};

/** A broadleaf tree from above-and-in-front: a short trunk under a clumpy crown. */
function broadleaf(p: Pixmap, r: Rng, cx: number, base: number, size: number, season: Season): void {
  // Trunk.
  for (let y = base - 6; y <= base; y++) for (let x = cx - 1; x <= cx + 1; x++) flat(p, x, y, WOOD, 0.15 + (x - cx) * -0.08);
  const top = base - size * 2;
  if (season === 'winter') {
    // Bare branches, snow along their tops.
    for (let b = 0; b < 7; b++) {
      const dir = b % 2 ? 1 : -1;
      const by = base - 5 - b * (size / 4);
      const len = size * (0.5 + rand(r) * 0.5);
      for (let s = 0; s < len; s++) {
        const x = Math.round(cx + dir * s * 0.9);
        const y = Math.round(by - s * 0.7);
        p.set(x, y, 'k');
        if (cellRandom(x, y, 51) > 0.4) snowPx(p, x, y - 1, 0.55);
      }
    }
    for (let y = Math.round(top); y < base - 5; y++) p.set(cx, y, 'k');
    return;
  }
  const ramp = LEAVES[season];
  const crownY = top + size * 0.9;
  for (let i = 0; i < 9; i++) {
    const a = rand(r) * Math.PI * 2;
    const d = rand(r) * size * 0.5;
    const bx = cx + Math.cos(a) * d;
    const by = crownY + Math.sin(a) * d * 0.8;
    const rad = size * (0.4 + rand(r) * 0.2);
    for (let y = Math.floor(by - rad); y <= by + rad; y++) {
      for (let x = Math.floor(bx - rad); x <= bx + rad; x++) {
        const dd = Math.hypot(x - bx, y - by) / rad;
        if (dd > 0.8 + fbm(x, y, 3, 52) * 0.35) continue;
        const face = (-(x - bx) / rad - (y - by) / rad) * 0.2;
        const clump = (cellRandom(x >> 1, y >> 1, 53) - 0.5) * 0.25;
        flat(p, x, y, ramp, 0.45 + face + clump - dd * 0.18);
      }
    }
  }
  if (season === 'spring') {
    // Pink blossom over the green.
    for (let y = Math.floor(top); y < base - 4; y++) {
      for (let x = cx - size - 2; x <= cx + size + 2; x++) {
        const k = keyAt(p, x, y);
        if ((k === 'g' || k === 'G' || k === 'l' || k === 'L') && cellRandom(x, y, 54) > 0.2) p.set(x, y, cellRandom(x, y, 55) > 0.7 ? 'W' : cellRandom(x, y, 56) > 0.4 ? 'I' : 'i');
      }
    }
  }
}

/** A pine in tiers, as in the reference, with snow on every tier in winter. */
function pineTree(p: Pixmap, cx: number, base: number, h: number, season: Season): void {
  p.fillRect(cx - 1, base - 3, 3, 4, 'b').set(cx + 1, base - 3, 'k');
  const tiers = Math.max(3, Math.round(h / 7));
  for (let j = 0; j < h - 3; j++) {
    const y = base - 3 - j;
    const k = j / (h - 3);
    const tier = Math.floor(k * tiers);
    const inTier = k * tiers - tier;
    const half = Math.max(0, (1 - k) * h * 0.36 * (0.55 + 0.45 * (1 - inTier)));
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const side = (cx - x) / Math.max(1, half);
      const rim = Math.abs(x - cx) > half - 1;
      if (season === 'winter' && inTier > 0.5 && cellRandom(x, y, 61) > 0.2) p.set(x, y, side > 0 && inTier > 0.7 ? 'm' : 'e');
      else flat(p, x, y, ['K', 'g', 'T', 'G', 'l'], 0.42 + side * 0.25 + (rim ? -0.15 : 0) + inTier * -0.25 + (valueNoise(x, y, 2, 62) - 0.5) * 0.15);
    }
  }
}

type TreeSpot = { x: number; base: number; size: number; pine: boolean };
/**
 * The square is framed in trees down both sides, as in Jacob's seasonal concepts (Oct 19): blossom in
 * spring, deep green in summer, red and gold in autumn, and in winter the broadleaves stand bare
 * among the snowy pines. They stand behind the stalls, which are sprites drawn over the ground.
 */
const TREES: readonly TreeSpot[] = [
  { x: 6, base: 30, size: 30, pine: true },
  { x: 311, base: 30, size: 14, pine: false },
  { x: 8, base: 48, size: 13, pine: false },
  { x: 312, base: 50, size: 13, pine: false },
  { x: 2, base: 62, size: 14, pine: false },
  { x: 322, base: 64, size: 24, pine: true },
  { x: 10, base: 80, size: 11, pine: false },
  { x: 310, base: 84, size: 12, pine: false },
  { x: -3, base: 112, size: 24, pine: true },
  { x: 9, base: 104, size: 12, pine: false },
  { x: 312, base: 106, size: 13, pine: false },
  { x: 8, base: 134, size: 12, pine: false },
  { x: 312, base: 134, size: 12, pine: false },
  { x: 10, base: 156, size: 11, pine: false },
  { x: -2, base: 170, size: 14, pine: false },
  { x: 322, base: 170, size: 24, pine: true },
  { x: 310, base: 158, size: 11, pine: false },
];
/** A low round shrub, lit from the upper left; snow-capped in winter, flowering in spring and summer. */
function bush(p: Pixmap, cx: number, cy: number, rx: number, ry: number, season: Season): void {
  const ramp = season === 'winter' ? (['K', 'K', 'g', 'T'] as const) : LEAVES[season];
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 0.85 + fbm(x, y, 2, 141) * 0.3) continue;
      const tone = 0.4 - dx * 0.12 - dy * 0.18 + (cellRandom(x >> 1, y >> 1, 142) - 0.5) * 0.25 - d * 0.12;
      if (season === 'winter' && dy < 0.35 && cellRandom(x, y, 143) > 0.12) p.set(x, y, dx < 0.2 ? 'm' : 'e');
      else flat(p, x, y, ramp, tone);
      if (season === 'spring' && tone > 0.3 && cellRandom(x, y, 144) > 0.72) p.set(x, y, cellRandom(x, y, 145) > 0.5 ? 'I' : 'W');
      if (season === 'summer' && tone > 0.38 && cellRandom(x, y, 146) > 0.93) p.set(x, y, cellRandom(x, y, 147) > 0.5 ? 'y' : 'W');
    }
  }
}

/**
 * Hedges and shrubs filling the edges between the trees, as in the concepts: down both sides, in the
 * top corners by the houses and along the wall, leaving the way in and the walking zones clear.
 */
function hedges(p: Pixmap, season: Season): void {
  const spots: [number, number, number, number][] = [];
  for (let y = 36; y < 168; y += 7) {
    spots.push([2 + cellRandom(y, 0, 148) * 3, y, 5 + cellRandom(y, 1, 148) * 2, 4]);
    spots.push([317 - cellRandom(y, 2, 148) * 3, y, 5 + cellRandom(y, 3, 148) * 2, 4]);
  }
  for (const [x, y] of [[20, 40], [74, 38], [140, 36], [180, 36], [246, 38], [300, 40]] as const) spots.push([x, y, 5, 3.5]);
  const clear = (x: number) => Math.abs(x - (EXIT.x + EXIT.w / 2)) < EXIT.w / 2 + 12 || HOMES.some((h) => x > h.zone.x - 4 && x < h.zone.x + h.zone.w + 4 && h.zone.y + h.zone.h > 150);
  for (let x = 10; x < SQUARE_W - 10; x += 9) if (!clear(x)) spots.push([x, 168, 5.5, 3.5]);
  spots.forEach(([x, y, rx, ry], i) => {
    bush(p, x, y, rx, ry, season);
    if (season === 'autumn' && i % 5 === 2) pumpkin(p, x + rx - 1, y + ry + 1, 2.5, 2);
  });
}

/** In winter some of the broadleaves are pines instead, so the edges stay dark and snowy. */
const winterPine = (t: TreeSpot, i: number) => t.pine || i % 3 === 0;

// ---------------------------------------------------------------- the front: wall, water, bridge

function water(p: Pixmap, frozen: boolean): void {
  for (let y = WATER_Y; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      if (y === WATER_Y) {
        p.set(x, y, 'K');
        continue;
      }
      if (frozen) {
        const crack = valueNoise(x, y * 4, 5, 71) > 0.7;
        p.set(x, y, crack ? 'x' : cellRandom(x >> 2, y, 72) > 0.8 ? 'm' : 'e');
        continue;
      }
      const ripple = cellRandom(Math.floor((x + y * 3) / 4), y, 73) > 0.82;
      p.set(x, y, ripple ? 'u' : y === WATER_Y + 1 ? 'K' : 'z');
    }
  }
  // The moon on the water, broken into dashes.
  if (!frozen) for (const [x, y, w] of [[60, 177, 3], [64, 178, 2], [100, 178, 2], [232, 177, 2], [236, 179, 3], [290, 178, 2]] as const) p.hline(x, x + w - 1, y, 'X');
}

function wall(p: Pixmap, x0: number, x1: number): void {
  for (let x = x0; x <= x1; x++) {
    // Coping stones on top, then the face down to the water.
    const cap = Math.floor(x / 8);
    const capJoint = x % 8 === 0;
    const tone = cellRandom(cap, 1, 74) > 0.5;
    p.set(x, WALL_Y, capJoint ? 'S' : tone ? 'e' : 'S');
    p.set(x, WALL_Y + 1, capJoint ? 's' : 'S');
    p.set(x, WALL_Y + 2, 'k');
    for (let y = WALL_Y + 3; y < WATER_Y; y++) p.set(x, y, (x + (y - WALL_Y) * 3) % 6 === 0 ? 'k' : 'q');
  }
}

function bridge(p: Pixmap, snowy: boolean): void {
  const { x: bx, w } = EXIT;
  const y0 = WALL_Y - 3;
  // Planks across the way, over the gap in the wall.
  for (let y = y0; y < SQUARE_H; y++) {
    const r = (y - y0) % 3;
    for (let x = bx; x < bx + w; x++) {
      const plank = Math.floor((y - y0) / 3);
      const end = (x - bx + plank * 7) % 13 === 0;
      p.set(x, y, r === 2 ? 'b' : end ? 'b' : r === 0 ? 'n' : 'B');
    }
  }
  if (snowy) for (let x = bx; x < bx + w; x++) for (let y = y0; y < SQUARE_H; y += 3) if (cellRandom(x, y, 78) > 0.75 && (x < bx + 6 || x > bx + w - 7)) p.set(x, y, 'm');
  // Rails and posts either side.
  for (const rx of [bx, bx + w - 1]) {
    for (let y = y0; y < SQUARE_H; y++) p.set(rx, y, 'k');
    for (const py of [y0 - 1, SQUARE_H - 4]) {
      p.fillRect(rx - 1, py, 3, 3, 'B').hline(rx - 1, rx + 1, py, snowy ? 'm' : 'n').set(rx + 1, py + 2, 'b');
    }
  }
  // Pillars where the wall meets the bridge.
  for (const px of [bx - 5, bx + w + 1]) {
    p.fillRect(px, WALL_Y - 3, 4, 2, snowy ? 'm' : 'e').fillRect(px, WALL_Y - 1, 4, 3, 'S').fillRect(px, WALL_Y + 2, 4, WATER_Y - WALL_Y - 2, 's');
    p.set(px + 3, WALL_Y - 1, 's').set(px + 3, WALL_Y, 's');
  }
}

/** The side edges: a low drystone wall under the trees. */
function sides(p: Pixmap): void {
  for (let y = 30; y < WALL_Y + 2; y++) {
    const block = Math.floor(y / 6);
    const joint = y % 6 === 0;
    for (const [x0, dir] of [[0, 1], [SQUARE_W - 1, -1]] as const) {
      p.set(x0, y, 'k');
      for (let i = 1; i <= 3; i++) p.set(x0 + dir * i, y, joint ? 's' : i === 3 ? 'k' : cellRandom(block, x0, 79) > 0.5 ? 'e' : 'S');
    }
  }
}

// ---------------------------------------------------------------- seasonal dressing

/** Spots along the house fronts (bottom at y 29) and on the wall's coping for tubs, pumpkins and bales. */
const FRONT_SPOTS = [22, 78, 89, 135, 150, 167, 184, 229, 249, 296] as const;
const WALL_SPOTS = [24, 62, 108, 214, 258, 298] as const;

function flowerTub(p: Pixmap, x: number, bottom: number, flowers: readonly PaletteKey[], leaf: PaletteKey = 'G'): void {
  p.fillRect(x, bottom - 3, 6, 3, 'B').hline(x, x + 5, bottom - 3, 'n').hline(x, x + 5, bottom - 1, 'b');
  for (const [dx, dy] of [[0, -4], [1, -5], [2, -4], [3, -5], [4, -4], [5, -4], [1, -4], [3, -4], [2, -6]] as const) p.set(x + dx, bottom + dy, leaf);
  [[1, -5], [3, -6], [5, -5], [2, -4]].forEach(([dx, dy], i) => p.set(x + dx!, bottom + dy!, flowers[i % flowers.length]!));
}

function pumpkin(p: Pixmap, cx: number, bottom: number, rx: number, ry: number): void {
  for (let y = Math.floor(bottom - ry * 2); y < bottom; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - (bottom - ry)) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const rib = Math.abs(Math.round(x - cx)) === Math.round(rx / 2) ? -0.25 : 0;
      flat(p, x, y, ['k', 'b', 'B', 'o', 'y'], 0.5 + rib - dy * 0.15 - dx * 0.1);
    }
  }
  p.set(Math.round(cx), Math.floor(bottom - ry * 2) - 1, 'G');
}

function hayBale(p: Pixmap, x: number, bottom: number): void {
  for (let y = bottom - 5; y < bottom; y++) for (let i = 0; i < 9; i++) flat(p, x + i, y, ['b', 'B', 'n', 'a'], 0.55 + (y === bottom - 5 ? 0.2 : 0) - (y - bottom + 5) * 0.08 + (cellRandom(x + i, y, 81) - 0.5) * 0.3);
  for (let y = bottom - 5; y < bottom; y++) p.set(x + 3, y, 'b');
}

function scatter(p: Pixmap, r: Rng, n: number, keys: readonly PaletteKey[], edgeBias: number, size = 1): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(4 + rand(r) * (SQUARE_W - 8));
    const y = Math.floor(31 + rand(r) * (WALL_Y - 32));
    const edge = Math.max(0, 1 - Math.min(x - 4, SQUARE_W - 4 - x, y - 30, WALL_Y - y) / 40);
    if (rand(r) > edge * edgeBias + (1 - edgeBias)) continue;
    const k = pick(r, keys);
    p.set(x, y, k);
    if (size > 1 && rand(r) > 0.5) p.set(x + 1, y, k);
  }
}

const smoothstep = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** How much snow lies here: deep at the edges and against the houses and wall, clear where people walk. */
function snowCover(x: number, y: number, snowedIn: boolean): number {
  const edge = Math.min(x, SQUARE_W - 1 - x, (y - 28) * 1.6, (WALL_Y - y) * 1.6);
  const n = (fbm(x, y, 9, 91) - 0.5) * 0.8;
  const c = (snowedIn ? 1.5 : 1.2) - edge / (snowedIn ? 120 : 220) + n;
  // Trodden paths: round the well, down the lane, and in front of every stall.
  // A ring trodden round the fountain; snowed in, the whole ring is dug out.
  const r = Math.hypot(x - WELL_C.x, (y - WELL_C.y) * 1.4);
  let clear = snowedIn ? smoothstep(66, 50, r) : smoothstep(10, 4, Math.abs(r - 44));
  if (y > 110 || y < 60) clear = Math.max(clear, smoothstep(10, 2, Math.max(LANE.x0 - x, x - LANE.x1, 0)));
  for (const h of HOMES) {
    const z = h.zone;
    const d = Math.hypot(Math.max(z.x - x, x - (z.x + z.w), 0), Math.max(z.y - y, y - (z.y + z.h), 0) * 1.3);
    clear = Math.max(clear, smoothstep(snowedIn ? 10 : 14, 0, d));
  }
  return c - clear * (snowedIn ? 1.1 : 0.9);
}

function groundSnow(p: Pixmap, snowedIn: boolean): void {
  for (let y = 28; y < WALL_Y + 2; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      const c = snowCover(x, y, snowedIn);
      if (c < 0.15) {
        // Even the trodden cobbles keep a little snow between them.
        if (keyAt(p, x, y) === 'k' && cellRandom(x, y, 99) < (snowedIn ? 0.45 : 0.12)) p.set(x, y, 'x');
        continue;
      }
      if (c < 0.4) {
        // A dusting in the cobbles' hollows first.
        const k = keyAt(p, x, y);
        if (k === 'k' || dither(x, y) < (c - 0.15) * 1.2) p.set(x, y, c < 0.28 ? 'x' : 'X');
        continue;
      }
      const lip = snowCover(x, y + 1, snowedIn) < 0.4;
      const top = snowCover(x, y - 1, snowedIn) < 0.4;
      p.set(x, y, lip ? 'x' : top ? 'm' : (fbm(x, y, 4, 92) + moon(x, y) * 0.4 > 0.5 ? 'e' : 'X'));
    }
  }
  // Snow on the wall's coping.
  for (let x = 0; x < SQUARE_W; x++) {
    if (x >= EXIT.x - 6 && x < EXIT.x + EXIT.w + 6) continue;
    const d = snowedIn ? 2 + Math.round(valueNoise(x, 0, 5, 93) * 2) : 1 + (valueNoise(x, 0, 4, 93) > 0.5 ? 1 : 0);
    for (let j = 0; j < d; j++) p.set(x, WALL_Y + 2 - d + j - (snowedIn ? 1 : 0), j === 0 ? 'm' : 'e');
  }
}

/** Puddles holding the moon, or ice in winter. */
function puddles(p: Pixmap, frozen: boolean): void {
  for (const [cx, cy, rx, ry] of [[62, 104, 6, 2.2], [238, 158, 5, 1.8], [104, 64, 4, 1.6], [214, 112, 3.5, 1.4]] as const) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        if (d > 1 + (valueNoise(x, y, 2, 98) - 0.5) * 0.4) continue;
        p.set(x, y, frozen ? (d < 0.5 ? 'm' : 'e') : y < cy - ry * 0.3 ? 'Z' : 'z');
      }
    }
    if (!frozen) p.hline(Math.round(cx - 1), Math.round(cx + 1), Math.round(cy), 'X').set(Math.round(cx + 2), Math.round(cy - 1), 'm');
  }
}

function dressing(p: Pixmap, r: Rng, season: Season, snowedIn: boolean): void {
  if (season === 'spring') {
    scatter(p, r, 160, ['I', 'i', 'i', 'w'], 0.8);
    FRONT_SPOTS.forEach((x, i) => {
      if (i % 2 === 0) flowerTub(p, x - 2, 29, i % 4 === 0 ? ['I', 'i', 'W'] : ['y', 'W', 'I'], 'l');
    });
    WALL_SPOTS.forEach((x, i) => flowerTub(p, x, WALL_Y + 1, i % 2 ? ['I', 'W'] : ['i', 'y'], 'G'));
  } else if (season === 'summer') {
    // Grass in the gaps between cobbles near the edges.
    for (let y = 30; y < WALL_Y; y++) {
      for (let x = 4; x < SQUARE_W - 4; x++) {
        const k = keyAt(p, x, y);
        if (k !== 'K' && k !== 'k') continue;
        const edge = Math.min(x - 4, SQUARE_W - 4 - x, y - 30, WALL_Y - y);
        if (fbm(x, y, 7, 94) + (edge < 24 ? 0.12 : -0.1) > 0.74 && cellRandom(x, y, 97) > 0.35) p.set(x, y, cellRandom(x, y, 95) > 0.5 ? 'G' : 'g');
      }
    }
    FRONT_SPOTS.forEach((x, i) => {
      if (i % 3 === 0) flowerTub(p, x - 2, 29, ['l', 'L'], 'G');
    });
    WALL_SPOTS.forEach((x, i) => {
      if (i % 2 === 0) flowerTub(p, x, WALL_Y + 1, ['y', 'W', 'i'], 'G');
    });
  } else if (season === 'autumn') {
    scatter(p, r, 200, ['o', 'B', 'B', 'r', 'R'], 0.9, 2);
    FRONT_SPOTS.forEach((x, i) => {
      if (i % 3 === 1) hayBale(p, x - 4, 30);
      else if (i % 3 === 0) {
        pumpkin(p, x, 30, 3, 2.2);
        pumpkin(p, x + 5, 30, 2, 1.6);
      }
    });
    WALL_SPOTS.forEach((x, i) => {
      if (i % 2 === 0) pumpkin(p, x + 3, WALL_Y + 1, 2.5, 2);
    });
  } else {
    groundSnow(p, snowedIn);
    // Snow banked against the house fronts.
    for (let x = 0; x < SQUARE_W; x++) {
      const d = (snowedIn ? 4 : 2) + Math.round(valueNoise(x, 5, 6, 96) * (snowedIn ? 3 : 1));
      for (let j = 0; j < d; j++) p.set(x, 30 - d + j, j === 0 ? 'm' : j === d - 1 ? 'X' : 'e');
    }
  }
}

// ---------------------------------------------------------------- rugs, lily pads, the way in

/** Fireflies drifting by the trees on summer nights; each gets a small glow. */
const FIREFLIES: readonly (readonly [number, number])[] = [
  [12, 52], [8, 128], [308, 82], [312, 140], [20, 160], [300, 160], [30, 36], [292, 38],
  [18, 88], [24, 112], [296, 104], [304, 120], [10, 70], [314, 62], [60, 40], [262, 42], [70, 168], [252, 166],
];

/** A rug's colours: its field, border and the diamonds through it. */
const RUG_COLOURS: readonly (readonly [PaletteKey, PaletteKey, PaletteKey])[] = [
  ['r', 'j', 'B'],
  ['u', 'z', 'U'],
  ['T', 'g', 't'],
  ['p', 'k', 'P'],
];

/** A patterned rug laid on the stones in front of every stall, where you stand to trade. */
function rugs(p: Pixmap): void {
  HOMES.filter((h) => h.kind === 'stall').forEach((h, i) => {
    const [field, border, figure] = RUG_COLOURS[i % RUG_COLOURS.length]!;
    const x0 = h.zone.x + 2;
    const y0 = h.zone.y - 1;
    const w = h.zone.w - 4;
    const ht = h.zone.h - 1;
    for (let y = y0; y < y0 + ht; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const bx = Math.min(x - x0, x0 + w - 1 - x);
        const by = Math.min(y - y0, y0 + ht - 1 - y);
        if (bx === 0 || by === 0) p.set(x, y, border);
        else if (bx === 1 || by === 1) p.set(x, y, (x + y) % 3 === 0 ? 'n' : field);
        else {
          // One diamond medallion in the middle of a plain field.
          const d = Math.abs(x + 0.5 - (x0 + w / 2)) / 2 + Math.abs(y + 0.5 - (y0 + ht / 2));
          p.set(x, y, d < 1.5 ? 'n' : d < 2.5 ? figure : d < 3.3 ? border : field);
        }
      }
    }
    // Fringe at the ends.
    for (let y = y0 + 1; y < y0 + ht - 1; y += 2) p.set(x0 - 1, y, 'a').set(x0 + w, y, 'a');
  });
}

/** Lily pads on the water below the wall, with a flower or two in spring. */
function lilyPads(p: Pixmap, season: Season): void {
  for (const [x, y] of [[30, 178], [44, 177], [84, 178], [196, 177], [214, 178], [270, 177], [302, 178]] as const) {
    p.hline(x, x + 2, y, 'G').set(x + 1, y + 1, 'g').set(x, y, 'l');
    if (season === 'spring' && x % 3 === 0) p.set(x + 1, y - 1, 'I');
  }
}

/** Where the way in's two banner poles stand, either side of the bridge. */
const POLES = [EXIT.x - 5, EXIT.x + EXIT.w + 3] as const;
const POLE_TOP = WALL_Y - 22;

/** The way in: a pole either side of the bridge with a crescent banner and a lantern on top. */
function entrance(p: Pixmap, season: Season): void {
  const winter = season === 'winter';
  for (const px of POLES) {
    for (let y = POLE_TOP; y < WALL_Y; y++) p.set(px, y, 'b').set(px + 1, y, 'B');
    p.hline(px - 3, px + 4, POLE_TOP + 2, 'b');
    // The banner: deep blue, a pale crescent, a pointed foot.
    for (let y = POLE_TOP + 3; y < POLE_TOP + 15; y++) {
      for (let x = px - 3; x <= px + 4; x++) {
        const foot = y - (POLE_TOP + 12);
        if (foot > 0 && Math.abs(x - px - 0.5) < foot * 1.3) continue;
        p.set(x, y, x === px - 3 || x === px + 4 ? 'z' : 'u');
      }
    }
    for (const [dx, dy] of [[0, 6], [-1, 7], [-1, 8], [-1, 9], [0, 10], [1, 6], [1, 10]] as const) p.set(px + dx, POLE_TOP + dy, 'm');
    p.set(px + 2, POLE_TOP + 4, 'y');
    if (winter) p.hline(px - 3, px + 4, POLE_TOP + 3, 'm');
    lanternPx(p, px, POLE_TOP - 2, true);
  }
}

// ---------------------------------------------------------------- the square

/** The square without its stalls/well/rug/fire: ground, houses, trees, wall, water, bridge, seasonal dressing. 320x180. */
export function squareGround(opts: SquareOptions, seed = 'elmbrook-square'): Pixmap {
  const { season } = opts;
  const snowedIn = opts.snowedIn && season === 'winter';
  const winter = season === 'winter';
  const p = new Pixmap(SQUARE_W, SQUARE_H);
  const r: Rng = { s: seedRng(seed) };

  cobbles(p, snowedIn);
  paving(p, snowedIn);
  lane(p, snowedIn);
  // A soft shadow under the eaves.
  for (let x = 0; x < SQUARE_W; x++) for (let y = 30; y < 34; y++) if (dither(x, y) < (34 - y) / 5) darken(p, x, y);

  for (const h of HOUSES) house(p, h, winter);
  sides(p);
  water(p, snowedIn);
  wall(p, 0, EXIT.x - 1);
  wall(p, EXIT.x + EXIT.w, SQUARE_W - 1);
  bridge(p, winter);
  if (!snowedIn) puddles(p, winter);
  rugs(p);
  if (!winter) lilyPads(p, season);
  dressing(p, r, season, snowedIn);

  // The night closes in at the edges; lamplight never darkens.
  for (let y = 0; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      const v = Math.max(0, Math.hypot((x - 160) / 170, (y - 90) / 120) - 0.92) * 3 + (y < 8 ? (8 - y) / 12 : 0);
      const steps = Math.min(1, Math.floor(v + dither(x, y)));
      if (steps <= 0) continue;
      const k = keyAt(p, x, y);
      if (!k || k === 'y' || k === 'Y' || k === 'o' || k === 'L' || (winter && (k === 'm' || k === 'e'))) continue;
      darken(p, x, y, steps);
    }
  }
  // Shrubs and trees last, over the darkened edges, so they stand out against them.
  hedges(p, season);
  TREES.forEach((t, i) => {
    if (t.pine || (winter && winterPine(t, i))) pineTree(p, t.x, t.base, Math.max(t.size, 18), season);
    else broadleaf(p, r, t.x, t.base, t.size, season);
  });
  // Summer's fireflies, over the trees.
  if (season === 'summer') for (const [x, y] of FIREFLIES) p.set(x, y, 'L').set(x + 1, y, 'Y');
  entrance(p, season);
  return p;
}

// ---------------------------------------------------------------- stalls

type Canopy = { dark: PaletteKey; base: PaletteKey; light: PaletteKey };

const CANOPIES: Record<string, Canopy> = {
  'lantern-seller': { dark: 'z', base: 'u', light: 'U' },
  'fortune-tent': { dark: 'p', base: 'P', light: 'v' },
  'name-taker': { dark: 'g', base: 'T', light: 'S' },
  fence: { dark: 'k', base: 'b', light: 'B' },
  'moth-broker': { dark: 'q', base: 'Q', light: 'v' },
  'hollow-tailor': { dark: 'j', base: 'r', light: 'R' },
  'seed-swapper': { dark: 'g', base: 'G', light: 'l' },
  'blossom-oracle': { dark: 'r', base: 'i', light: 'I' },
  'firefly-games': { dark: 'G', base: 'l', light: 'L' },
  'nectar-trader': { dark: 'B', base: 'n', light: 'y' },
  'cider-press': { dark: 'B', base: 'o', light: 'y' },
  'harvest-auction': { dark: 'b', base: 'B', light: 'R' },
};
const PLAIN: Canopy = { dark: 's', base: 'S', light: 'e' };

/** Which stall stands at a home when nothing says otherwise, for shuttered colours. */
const RESIDENT: Partial<Record<HomeId, string>> = {
  lantern: 'lantern-seller',
  fortune: 'fortune-tent',
  name: 'name-taker',
  fence: 'fence',
  moth: 'moth-broker',
  tailor: 'hollow-tailor',
};

const homeOf = (id: HomeId): Home => HOMES.find((h) => h.id === id)!;

/** Where a stall's one lantern hangs in its sprite: at the end nearer the middle of the square. */
function stallLantern(h: Home): { x: number; y: number } {
  return { x: h.at.x + h.size.w / 2 < SQUARE_W / 2 ? 33 : 6, y: 15 };
}

function lanternPx(p: Pixmap, x: number, y: number, lit: boolean): void {
  p.set(x, y - 2, 'k').set(x, y - 1, 'S');
  p.hline(x - 1, x + 1, y, 'k');
  p.set(x - 1, y + 1, 'k').set(x, y + 1, lit ? 'Y' : 's').set(x + 1, y + 1, 'k');
  p.set(x - 1, y + 2, 'k').set(x, y + 2, lit ? 'y' : 's').set(x + 1, y + 2, 'k');
  p.hline(x - 1, x + 1, y + 3, 'k');
}

function stall(h: Home, opts: SquareOptions & { open: boolean; stall: string | null }): Pixmap {
  const W = 40;
  const p = new Pixmap(W, 32);
  const id = opts.stall ?? RESIDENT[h.id] ?? null;
  let c = (id && CANOPIES[id]) || PLAIN;
  const open = opts.open && !!opts.stall;
  if (!open) c = { dark: DARKER[c.dark], base: c.dark, light: c.base };
  const lantern = stallLantern(h);

  // Shadow on the cobbles.
  for (let x = 1; x < W - 1; x++) {
    if ((x & 1) === 0) p.set(x, 30, 'K');
    if (x % 4 === 1) p.set(x, 31, 'K');
  }
  // Posts.
  for (const px of [1, W - 3]) for (let y = open ? 9 : 2; y < 30; y++) p.set(px, y, 'B').set(px + 1, y, 'b');
  // The dark inside, and the back boards.
  for (let y = 10; y < 19; y++) for (let x = 3; x < W - 3; x++) p.set(x, y, y < 12 ? 'K' : (x % 5 === 0 ? 'K' : 'k'));

  if (open) {
    // The awning: stripes sloping toward you, scalloped at the front.
    for (let y = 0; y < 13; y++) {
      const inset = y < 2 ? 2 - y : 0;
      for (let x = inset; x < W - inset; x++) {
        const stripe = Math.floor((x - 2) / 4) & 1;
        if (y >= 10) {
          const s = (x - 2) & 3;
          if (y === 11 && s === 3) continue;
          if (y === 12 && s !== 1 && s !== 2) continue;
          p.set(x, y, y === 12 ? c.dark : stripe ? c.base : c.light);
          continue;
        }
        const far = y < 3 || x < 2 || x > W - 3;
        p.set(x, y, stripe ? (far ? c.dark : c.base) : far ? c.base : c.light);
      }
      p.set(inset, y, 'k').set(W - 1 - inset, y, 'k');
    }
    p.hline(2, W - 3, 0, 'k');
    p.hline(0, W - 1, 9, c.dark);
  } else {
    // Rolled up: a fat roll of canvas over the bare frame.
    p.hline(1, W - 2, 3, 'b');
    for (let x = 0; x < W; x++) {
      p.set(x, 0, 'k').set(x, 1, c.light).set(x, 2, c.base).set(x, 3, c.dark).set(x, 4, 'k');
      if (x % 6 === 0) p.set(x, 2, c.dark);
    }
    for (const tx of [9, W - 10]) p.set(tx, 1, 'B').set(tx, 2, 'b').set(tx, 3, 'B');
    for (let y = 5; y < 10; y++) for (let x = 3; x < W - 3; x++) p.set(x, y, x % 7 === 0 ? 'b' : 'K');
  }

  if (open) {
    // The counter: a lamplit top with the wares on it, a cloth in the stall's colour down the front.
    for (let y = 19; y < 23; y++) for (let x = 2; x < W - 2; x++) {
      const near = 1 - Math.min(1, Math.abs(x - lantern.x) / 30);
      flat(p, x, y, WOOD, 0.4 + near * 0.3 + (y === 19 ? 0.12 : 0) - (y - 19) * 0.04);
    }
    for (let y = 23; y < 30; y++) for (let x = 2; x < W - 2; x++) {
      if (y < 27) p.set(x, y, y === 26 && x % 2 ? c.dark : (x - 2) % 8 < 4 ? c.base : c.light);
      else flat(p, x, y, WOOD, 0.25 + (x % 5 === 0 ? -0.15 : 0));
    }
    p.hline(2, W - 3, 23, c.dark);
    p.hline(2, W - 3, 29, 'k');
    wares(p, opts.stall!, opts.season);
    lanternPx(p, lantern.x, lantern.y, true);
  } else {
    // Boarded up.
    for (let y = 14; y < 30; y++) {
      const plank = Math.floor((y - 14) / 4);
      for (let x = 2; x < W - 2; x++) {
        const gap = (y - 14) % 4 === 3;
        flat(p, x, y, WOOD, gap ? 0.08 : 0.22 + (cellRandom(plank, Math.floor(x / 9), 101) - 0.5) * 0.12 + ((y - 14) % 4 === 0 ? 0.06 : 0));
      }
    }
    for (let x = 4; x < W - 4; x++) {
      const y = 15 + Math.round(((x - 4) / (W - 8)) * 12);
      p.set(x, y, 'B').set(x, y + 1, 'b');
    }
    for (const nx of [4, W - 5]) for (const ny of [15, 27]) p.set(nx, ny, 'S');
  }

  stallSeason(p, opts, open);
  return p;
}

/** A row of little things on the counter: each draws itself with its bottom on y. */
function wares(p: Pixmap, id: string, season: Season): void {
  const top = 19;
  switch (id) {
    case 'lantern-seller':
      for (const x of [6, 12, 18, 24]) {
        p.hline(x, x + 2, top - 5, 'n').set(x + 1, top - 6, 'n');
        p.set(x, top - 4, 'n').set(x + 1, top - 4, 'a').set(x + 2, top - 4, 'n');
        p.set(x, top - 3, 'n').set(x + 1, top - 3, 'H').set(x + 2, top - 3, 'n');
        p.hline(x, x + 2, top - 2, 'B');
      }
      // Paper lanterns hanging under the awning, unlit.
      for (const x of [10, 22]) p.set(x, 13, 'k').fillRect(x - 1, 14, 3, 2, 'u').set(x, 14, 'U');
      break;
    case 'fortune-tent':
      // A crystal ball on its stand, cards fanned out, a star on the tent.
      p.fillEllipse(19.5, top - 4, 3.5, 3.5, 'U').set(18, top - 6, 'c').set(17, top - 5, 'W').set(21, top - 3, 'u');
      p.hline(16, 23, top - 1, 'n').hline(17, 22, top, 'B');
      for (const [x, k] of [[7, 'w'], [9, 'v'], [11, 'w'], [27, 'w'], [29, 'P']] as const) p.fillRect(x, top - 2, 2, 3, k).set(x, top - 2, 'k');
      p.set(19, 3, 'y').set(18, 4, 'y').set(20, 4, 'y').set(19, 5, 'y').set(19, 4, 'Y');
      break;
    case 'name-taker':
      // An open ledger, a quill in an inkpot, and a candle-stub's worth of wax seals.
      p.fillRect(10, top - 3, 14, 4, 'w').set(17, top - 3, 'a').set(17, top - 2, 'a');
      for (const y of [top - 2, top]) {
        p.hline(11, 15, y, 'S');
        p.hline(19, 23, y, 'S');
      }
      p.fillRect(27, top - 2, 3, 3, 'k').set(28, top - 3, 'k');
      for (let j = 0; j < 5; j++) p.set(29 + (j >> 1), top - 4 - j, j > 2 ? 'W' : 'w');
      p.set(6, top - 1, 'R').set(7, top - 1, 'R').set(6, top, 'r');
      break;
    case 'fence':
      // Bottles of every colour, nothing labelled.
      [['R', 5], ['G', 9], ['P', 13], ['t', 17], ['y', 21], ['U', 25], ['i', 29]].forEach(([k, x], i) => {
        const h = 4 + (i % 3);
        const bx = x as number;
        p.fillRect(bx, top - h + 1, 3, h - 1, k as PaletteKey).set(bx + 1, top - h, 'k').set(bx + 1, top - h - 1, 'n').set(bx, top - h + 1, 'W');
      });
      break;
    case 'moth-broker':
      // Jars of pale moths, and moths loose under the awning.
      for (const x of [7, 14, 21]) {
        p.fillRect(x, top - 4, 5, 5, 'u').hline(x, x + 4, top - 5, 'S');
        p.set(x + 1, top - 3, 'm').set(x + 3, top - 2, 'v').set(x + 2, top - 1, 'm');
      }
      for (const [x, y] of [[9, 13], [18, 15], [27, 12], [30, 16], [12, 16]] as const) p.set(x, y, 'm').set(x + 1, y, 'v').set(x - 1, y, 'v');
      break;
    case 'hollow-tailor':
      // Bolts of cloth, a spool, and a length hanging from the awning.
      for (const [x, k, l] of [[5, 'P', 'v'], [11, 'T', 't'], [17, 'R', 'I']] as const) {
        p.fillRect(x, top - 3, 5, 4, k).hline(x, x + 4, top - 3, l).set(x, top - 1, 'k');
      }
      p.fillRect(25, top - 3, 3, 4, 'w').hline(24, 28, top - 3, 'n').hline(24, 28, top, 'n');
      for (let y = 12; y < 18; y++) p.set(31, y, y % 2 ? 'r' : 'R').set(32, y, 'r');
      break;
    case 'seed-swapper':
      // Paper packets and pots of seedlings.
      for (const [x, k] of [[6, 'R'], [10, 'y'], [14, 'i']] as const) p.fillRect(x, top - 3, 3, 4, 'w').set(x + 1, top - 2, k).set(x, top - 3, 'a');
      for (const x of [20, 26]) {
        p.fillRect(x, top - 2, 4, 3, 'B').hline(x, x + 3, top - 2, 'n');
        p.set(x + 1, top - 3, 'l').set(x + 2, top - 4, 'L').set(x + 3, top - 3, 'G');
      }
      break;
    case 'blossom-oracle':
      // A vase of blossom branches, petals on the counter.
      p.fillRect(17, top - 3, 4, 4, 'c').set(17, top - 3, 'W');
      for (const [x, y] of [[15, 10], [16, 12], [18, 9], [20, 11], [22, 10], [23, 12], [19, 13], [14, 13], [21, 14]] as const) p.set(x, y + 1, 'I').set(x + 1, y + 1, 'i');
      for (let y = 12; y < top - 3; y++) p.set(18, y, 'b').set(20, y - 1, 'b');
      for (const x of [7, 10, 26, 29]) p.set(x, top, 'I');
      break;
    case 'firefly-games':
      // Jars with fireflies in, a ring-toss peg.
      for (const x of [6, 13, 24]) {
        p.fillRect(x, top - 4, 4, 5, 'u').hline(x, x + 3, top - 5, 'n');
        p.set(x + 1, top - 3, 'L').set(x + 2, top - 1, 'Y');
      }
      p.set(19, top - 4, 'n').set(19, top - 3, 'n').set(19, top - 2, 'n').hline(17, 21, top - 1, 'R');
      break;
    case 'nectar-trader':
      // Honey pots with dippers.
      for (const x of [6, 13, 20, 27]) {
        p.fillEllipse(x + 2, top - 1.5, 2.5, 2.5, 'y').set(x + 1, top - 3, 'Y').hline(x, x + 4, top - 4, 'B');
        p.set(x + 3, top - 5, 'n').set(x + 3, top - 6, 'n');
      }
      break;
    case 'cider-press':
      // A barrel at the end, mugs and apples.
      p.fillRect(24, top - 6, 8, 8, 'B');
      for (const y of [top - 5, top - 1]) p.hline(24, 31, y, 'S');
      p.hline(24, 31, top - 6, 'n').set(25, top - 4, 'n').set(28, top - 2, 'k');
      for (const x of [6, 10]) p.fillRect(x, top - 2, 3, 3, 'n').set(x + 3, top - 1, 'n').set(x, top - 2, 'a');
      for (const x of [15, 17, 19, 16, 18]) p.set(x, x % 2 ? top : top - 1, 'R').set(x, top - 2, x === 17 ? 'G' : 'R');
      break;
    case 'harvest-auction':
      // Crates heaped with the harvest.
      for (const [x, k, k2] of [[5, 'o', 'y'], [15, 'R', 'r'], [25, 'l', 'G']] as const) {
        p.fillRect(x, top - 2, 9, 3, 'B').hline(x, x + 8, top - 2, 'n');
        for (let i = 0; i < 9; i++) p.set(x + i, top - 3, (i & 1) ? k : k2).set(x + i, top - 4, i > 1 && i < 7 ? ((i & 1) ? k2 : k) : 'k');
      }
      p.set(13, 5, 'w').fillRect(12, 6, 3, 2, 'w');
      break;
    default:
      break;
  }
  if (season === 'autumn' && id !== 'harvest-auction') p.set(4, top - 1, 'o').set(35, top, 'R');
}

/** Cheap seasonal touches on a stall: petals, a leaf, snow on the canopy. */
function stallSeason(p: Pixmap, opts: SquareOptions, open: boolean): void {
  const W = p.width;
  if (opts.season === 'spring') for (const [x, y] of [[7, 3], [26, 6], [15, 8]] as const) p.set(x, open ? y : 2, 'I');
  if (opts.season === 'autumn') for (const [x, y] of [[9, 4], [30, 7]] as const) p.set(x, open ? y : 1, 'o').set(x + 1, open ? y : 1, 'R');
  if (opts.season !== 'winter') return;
  const deep = opts.snowedIn;
  for (let x = 0; x < W; x++) {
    const d = deep ? 3 + Math.round(valueNoise(x, 0, 5, 102) * 4) + (open ? 0 : 1) : 1 + (valueNoise(x, 0, 4, 103) > 0.6 ? 1 : 0);
    const y0 = open ? (x < 2 || x > W - 3 ? 2 : 0) : 0;
    for (let j = 0; j < d; j++) {
      const y = y0 + j;
      if (!p.isSet(x, y) && j > 0) continue;
      snowPx(p, x, y, 0.75 - j * 0.07 + (x < W / 2 ? 0.05 : 0));
    }
  }
  if (deep) {
    // Drifts banked against the counter.
    for (let x = 0; x < W; x++) {
      const d = 2 + Math.round(valueNoise(x, 4, 5, 104) * 3);
      for (let j = 0; j < d; j++) snowPx(p, x, 30 - j, 0.55 + (j === d - 1 ? 0.2 : 0));
    }
  }
}

// ---------------------------------------------------------------- the well, the rug, the fire pit

function well(opts: SquareOptions & { open: boolean }): Pixmap {
  const p = new Pixmap(56, 48);
  const cx = 28;
  const cy = 30;
  const frozen = opts.snowedIn && opts.season === 'winter';
  const winter = opts.season === 'winter';
  // The basin: a ring of dressed stone, its outer face dropping to the paving.
  for (let y = 16; y < 48; y++) {
    for (let x = 0; x < 56; x++) {
      const dx = (x + 0.5 - cx) / 25;
      const dyTop = (y + 0.5 - cy) / 11;
      const inOuter = dx * dx + dyTop * dyTop <= 1;
      // The front face: the lower half of the ellipse pushed down 6px.
      const dyFace = (y + 0.5 - (cy + 6)) / 11;
      const inFace = !inOuter && y > cy && dx * dx + dyFace * dyFace <= 1;
      if (inFace) {
        const course = Math.floor((y - cy) / 3);
        const joint = (y - cy) % 3 === 0 || Math.floor((x + course * 4) / 8) !== Math.floor((x + 1 + course * 4) / 8);
        p.set(x, y, joint ? 'k' : dx < -0.55 ? 'S' : 's');
        continue;
      }
      if (!inOuter) continue;
      const ix = (x + 0.5 - cx) / 20;
      const iy = (y + 0.5 - (cy - 1)) / 7.5;
      if (ix * ix + iy * iy <= 1) {
        // The water inside.
        const d = Math.hypot(ix, iy);
        const lip = iy < 0 && d > 0.78;
        if (frozen) p.set(x, y, lip ? 'X' : valueNoise(x, y * 3, 4, 111) > 0.68 ? 'm' : 'e');
        else p.set(x, y, lip ? 'K' : Math.abs(d - 0.62) < 0.05 || Math.abs(d - 0.36) < 0.06 ? 'u' : 'z');
        continue;
      }
      // The rim's top, paler toward the moon.
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      const block = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18);
      const joint = Math.floor(((Math.atan2(y + 0.5 - cy, x + 1.5 - cx) + Math.PI) / (Math.PI * 2)) * 18) !== block;
      const outerEdge = dx * dx + dyTop * dyTop > 0.86;
      if (winter && y < cy + 2 && !joint && cellRandom(block, 1, 113) > (frozen ? 0.05 : 0.4)) p.set(x, y, outerEdge ? 'e' : 'm');
      else p.set(x, y, joint ? 's' : outerEdge && y > cy ? 'S' : cellRandom(block, 0, 112) > 0.5 || x < cx - 14 ? 'e' : 'S');
    }
  }
  if (!frozen) p.hline(cx - 11, cx - 9, cy + 2, 'X').set(cx - 10, cy + 3, 'm');
  // The column, the upper bowl and the crescent moon on top.
  for (let y = 12; y < cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) flat(p, x, y, STONE, 0.42 + (cx - x) * 0.06 + (y % 4 === 0 ? -0.1 : 0));
  p.fillEllipse(cx, cy + 1, 4, 1.5, 'k');
  for (let y = 9; y < 15; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dx = (x + 0.5 - cx) / 8;
      const dy = (y + 0.5 - 11) / 2.6;
      if (dx * dx + dy * dy > 1) continue;
      const rim = dx * dx + dy * dy > 0.55;
      if (rim || y > 11) flat(p, x, y, STONE, 0.5 + (cx - x) * 0.02 - (y - 9) * 0.04);
      else p.set(x, y, frozen ? 'e' : 'u');
    }
  }
  if (winter) for (let x = cx - 7; x <= cx + 7; x++) if (cellRandom(x, 1, 114) > 0.3) p.set(x, 9, 'm');
  if (winter) for (const x of [cx - 6, cx - 2, cx + 3, cx + 6]) p.set(x, 15, 'c').set(x, 16, x % 2 ? 'c' : 'm');
  else for (const [x, y] of [[cx - 7, 16], [cx + 7, 17], [cx - 8, 19], [cx + 8, 21], [cx - 8, 23]] as const) p.set(x, y, 'c');
  // The crescent.
  for (let y = 0; y < 9; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      const o = Math.hypot(x + 0.5 - cx, y + 0.5 - 4.5);
      const i = Math.hypot(x + 0.5 - (cx + 1.8), y + 0.5 - 3.6);
      if (o <= 4.2 && i > 3.3) p.set(x, y, o > 3.4 ? 'n' : 'w');
    }
  }
  p.set(cx, 8, 'S').set(cx, 9, 'S');
  // Planters either side of the basin.
  for (const x of [5, 50]) {
    p.fillRect(x - 3, 40, 7, 6, 'B').hline(x - 3, x + 3, 40, 'n').hline(x - 3, x + 3, 45, 'b');
    for (let y = 41; y < 45; y++) p.set(x + 3, y, 'b');
    bush(p, x, 37, 4.5, 3.5, opts.season);
  }
  // Floating petals or leaves.
  if (!frozen) {
    const bits: readonly PaletteKey[] = opts.season === 'spring' ? ['I', 'W'] : opts.season === 'autumn' ? ['o', 'R'] : [];
    [[14, 28], [38, 31], [20, 33], [34, 26]].forEach(([x, y], i) => {
      const k = bits[i % 2];
      if (k) p.set(x!, y!, k);
    });
  }
  if (opts.open) {
    // The Black Market: a dark cloth hung over the front of the rim, shady goods along the top,
    // and its keeper, a hooded shape, sitting on the far side.
    for (let x = 9; x < 27; x++) {
      const hang = 41 + Math.round(Math.sin((x - 9) * 0.5) * 1.2) + (x > 13 && x < 22 ? 2 : 0);
      for (let y = 32; y <= hang; y++) p.set(x, y, y === hang ? 'P' : (x - 9) % 4 === 0 ? 'k' : (x - 9) % 4 === 1 ? 'P' : 'p');
      p.set(x, 31, 'p');
      if (x % 3 === 0) p.set(x, hang + 1, 'v');
    }
    // Goods on the rim: a green bottle, a violet vial, a little skull, a coin purse.
    p.fillRect(10, 27, 2, 4, 'g').set(10, 27, 'l').set(10, 26, 'k').set(11, 30, 'k');
    p.fillRect(14, 28, 2, 3, 'P').set(14, 28, 'v').set(14, 27, 'k');
    p.fillRect(18, 28, 3, 3, 'm').set(18, 29, 'K').set(20, 29, 'K').set(19, 30, 'e');
    p.fillEllipse(24, 29.5, 1.5, 1.5, 'B').set(24, 28, 'n');
    // The keeper: hood, shoulders, a robe pooling on the rim.
    for (let y = 16; y < 36; y++) {
      const half = y < 22 ? 2 + Math.sqrt(Math.max(0, (y - 15) * 1.6)) : Math.min(7, 4.2 + (y - 22) * 0.35);
      for (let x = Math.floor(46 - half); x <= 46 + half; x++) {
        const edge = x <= 46 - half + 0.8 || x >= 46 + half - 0.8;
        p.set(x, y, edge ? 'K' : x < 45 ? 'p' : 'k');
      }
    }
    p.fillEllipse(46.5, 21, 2, 2.2, 'K').set(45, 21, 'v').set(47, 21, 'v');
    p.set(41, 30, 'P').set(42, 33, 'P').set(49, 31, 'K');
    // A pale hand on the rim.
    p.set(40, 33, 'e').set(41, 33, 'm');
  }
  return p;
}

function rugSprite(opts: SquareOptions & { open: boolean }): Pixmap {
  const p = new Pixmap(40, 28);
  if (!opts.open) {
    // Just the pegs where the Tinker pitches, and a scuff on the stones.
    for (const [x, y] of [[4, 13], [35, 13], [4, 25], [35, 25]] as const) p.set(x, y, 'b').set(x, y - 1, 'B');
    return p;
  }
  // The rug: a border, a field of diamonds, a medallion.
  for (let y = 11; y < 27; y++) {
    for (let x = 2; x < 38; x++) {
      const bx = Math.min(x - 2, 37 - x);
      const by = Math.min(y - 11, 26 - y);
      const border = bx < 2 || by < 2;
      if (border) {
        p.set(x, y, bx === 0 || by === 0 ? 'j' : (x + y) % 3 === 0 ? 'n' : 'r');
        continue;
      }
      const d = (Math.abs(x - 20) + Math.abs(y - 18.5) * 2) % 8;
      p.set(x, y, d < 1 ? 'B' : d < 2 ? 'r' : 'p');
    }
  }
  p.fillEllipse(20, 19, 4, 2.5, 'r').fillEllipse(20, 19, 2, 1.2, 'n');
  for (const x of [2, 37]) for (let y = 11; y < 27; y += 2) p.set(x === 2 ? 1 : 38, y, 'a');
  // The Tinker's cart at the back: a box under a canvas hood on a big wheel.
  p.fillRect(8, 3, 22, 10, 'B');
  for (let x = 8; x < 30; x++) p.set(x, 3, 'n').set(x, 12, 'b');
  for (let y = 0; y < 6; y++) for (let x = 9 + (y < 1 ? 2 : 0); x < 29 - (y < 1 ? 2 : 0); x++) flat(p, x, y, ['q', 'J', 'h', 'H', 'a'], 0.55 - y * 0.05 + ((x - 9) % 5 === 0 ? -0.15 : 0));
  p.fillEllipse(10, 12, 3.5, 3.5, 'k').fillEllipse(10, 12, 2, 2, 'B').set(10, 12, 'n');
  p.set(30, 10, 'b').set(31, 11, 'b').set(32, 12, 'b');
  // Trinkets on the rug: a kettle, a clock, a little mirror, a bundle of spoons.
  p.fillRect(6, 19, 4, 3, 'S').set(10, 20, 'S').set(7, 18, 'e').set(6, 19, 'e');
  p.fillEllipse(30.5, 19.5, 2.5, 2.5, 'n').set(30, 19, 'w').set(31, 19, 'k');
  p.fillRect(14, 22, 3, 3, 'c').strokeRect(13, 21, 5, 5, 'n');
  for (const x of [24, 25, 26]) p.set(x, 23, 'e').set(x, 22, 'S');
  // A lantern hanging from the hood.
  lanternPx(p, 28, 4, true);
  if (opts.season === 'winter') for (let x = 9; x < 29; x++) if (cellRandom(x, 0, 121) > 0.2) snowPx(p, x, 0, 0.7);
  return p;
}

/** Where the fire pit's ring centres in its sprite; the flames sit over it. */
const FIRE_RING = { x: 20, y: 15 };
// squareFire (16x12) goes with its top-left at (FIRE_RING.x - 8, FIRE_RING.y - 10) = (12, 5) in the fire
// pit sprite, which is (96, 133) in square space (the fire home's `at` is (84, 128)).

function firePit(opts: SquareOptions & { open: boolean }): Pixmap {
  const p = new Pixmap(40, 28);
  const { x: cx, y: cy } = FIRE_RING;
  const winter = opts.season === 'winter';
  // A log to sit on, on the left.
  p.fillRect(1, 17, 7, 4, 'B').hline(1, 7, 17, 'n').hline(1, 7, 20, 'b').fillEllipse(7.5, 18.5, 1.5, 2, 'a').set(7, 18, 'n');
  for (let y = 7; y < 24; y++) {
    for (let x = 6; x < 35; x++) {
      const dx = (x + 0.5 - cx) / 12;
      const dy = (y + 0.5 - cy) / 6.5;
      const dyFace = (y + 0.5 - (cy + 2)) / 6.5;
      const outer = dx * dx + dy * dy <= 1;
      const face = !outer && y > cy && dx * dx + dyFace * dyFace <= 1;
      const ix = (x + 0.5 - cx) / 7.5;
      const iy = (y + 0.5 - cy) / 3.6;
      const inner = ix * ix + iy * iy <= 1;
      if (face) {
        flat(p, x, y, STONE, 0.18 + (x % 4 === 0 ? -0.1 : 0));
        continue;
      }
      if (!outer) continue;
      if (inner) {
        if (opts.open) p.set(x, y, cellRandom(x, y, 131) > 0.75 ? 'R' : cellRandom(x, y, 132) > 0.6 ? 'b' : 'K');
        else if (winter && opts.snowedIn) snowPx(p, x, y, 0.5);
        else p.set(x, y, cellRandom(x, y, 133) > 0.85 ? 'S' : iy < -0.4 ? 'k' : 's');
        continue;
      }
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      const stone = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 11);
      const joint = Math.floor(((Math.atan2(y + 0.5 - cy, x + 1.5 - cx) + Math.PI) / (Math.PI * 2)) * 11) !== stone;
      if (winter && !opts.open && y < cy && !joint) snowPx(p, x, y, 0.6);
      else p.set(x, y, joint ? 'k' : y > cy + 2 ? 's' : cellRandom(stone, 0, 134) > 0.5 ? 'e' : 'S');
    }
  }
  if (opts.open) {
    // Crossed logs glowing at the ends; the flames are squareFire, laid over (12, 5).
    for (let i = -5; i <= 5; i++) {
      p.set(cx + i, cy + Math.round(i * 0.3), 'b').set(cx + i, cy + 1 + Math.round(i * 0.3), 'B');
      p.set(cx + i, cy - Math.round(i * 0.3), 'B');
    }
    p.set(cx - 5, cy - 1, 'o').set(cx + 5, cy + 2, 'o').set(cx - 2, cy + 2, 'y').set(cx + 3, cy - 1, 'R');
    // The Hearth Trader's crate of goods on the right: kindling, a kettle, jars of embers.
    p.fillRect(31, 12, 8, 9, 'B');
    for (let y = 12; y < 21; y += 3) p.hline(31, 38, y, 'b');
    p.hline(31, 38, 12, 'n').strokeRect(31, 12, 8, 9, 'k');
    p.fillRect(32, 9, 2, 3, 'o').set(32, 9, 'y').fillRect(35, 9, 2, 3, 'R').set(35, 9, 'o');
    for (const x of [33, 35, 37]) p.set(x, 8, 'n').set(x - 1, 7, 'B');
    if (winter && opts.snowedIn) p.hline(31, 38, 12, 'm');
  } else {
    // A charred log in the cold ash.
    for (let i = -3; i <= 3; i++) p.set(cx + i, cy + Math.round(i * 0.2), 'k');
  }
  if (winter) p.hline(1, 7, 16, 'm');
  return p;
}

// ---------------------------------------------------------------- exports

/** One home's sprite, sized to HOMES[id].size. `stall` is the codex stall id standing there tonight (or null if none: shuttered/empty). */
export function homeSprite(id: HomeId, opts: SquareOptions & { open: boolean; stall: string | null }): Pixmap {
  const h = homeOf(id);
  const o = { ...opts, snowedIn: opts.snowedIn && opts.season === 'winter' };
  switch (h.kind) {
    case 'stall':
      return stall(h, o);
    case 'well':
      return well(o);
    case 'rug':
      return rugSprite(o);
    case 'fire':
      return firePit(o);
  }
}

/** Same sprite with a bright 1px 'Y' outline, one pixel bigger all round (like litSprite in cottage-room). */
export function litHomeSprite(src: Pixmap): Pixmap {
  const p = new Pixmap(src.width + 2, src.height + 2);
  p.blit(src, 1, 1);
  return p.outline('Y');
}

/** Lights for glows, square pixels: lanterns of open stalls, the fire if lit, a couple of house windows. Few. */
export function squareLights(open: ReadonlySet<HomeId>, opts: SquareOptions): readonly { x: number; y: number; radius: number; color: 'y' | 'o' | 'L' | 'v' }[] {
  const out: { x: number; y: number; radius: number; color: 'y' | 'o' | 'L' | 'v' }[] = [];
  for (const h of HOMES) {
    if (!open.has(h.id)) continue;
    if (h.kind === 'stall') {
      const l = stallLantern(h);
      out.push({ x: h.at.x + l.x, y: h.at.y + l.y + 2, radius: 30, color: 'y' });
    } else if (h.kind === 'well') out.push({ x: h.at.x + 47, y: h.at.y + 26, radius: 26, color: 'v' });
    else if (h.kind === 'rug') out.push({ x: h.at.x + 28, y: h.at.y + 6, radius: 22, color: 'y' });
    else out.push({ x: h.at.x + FIRE_RING.x, y: h.at.y + FIRE_RING.y - 2, radius: 50, color: 'o' });
  }
  for (const w of LIT_WINDOWS) out.push({ x: w.x, y: w.y, radius: 16, color: 'o' });
  for (const px of POLES) out.push({ x: px, y: POLE_TOP, radius: 20, color: 'y' });
  if (opts.season === 'summer') for (const [x, y] of FIREFLIES) out.push({ x, y, radius: 6, color: 'L' });
  return out;
}

/** Fire pit flames, 3 frames, 16x12. Draw at (12, 5) in the fire pit sprite: (96, 133) in square space. */
export function squareFire(frame: 0 | 1 | 2): Pixmap {
  const p = new Pixmap(16, 12);
  const tongues = (
    [
      [[4, 6], [8, 10], [11, 7]],
      [[3, 5], [7, 9], [11, 8]],
      [[5, 7], [8, 11], [12, 6]],
    ] as const
  )[frame];
  for (const [cx, h] of tongues) {
    for (let j = 0; j < h; j++) {
      const half = Math.max(0, Math.round((1 - j / h) * 2.4));
      for (let i = -half; i <= half; i++) {
        const core = Math.abs(i) < half && j < h * 0.55;
        p.set(cx + i, 11 - j, core ? (j < h * 0.3 ? 'W' : 'Y') : j > h * 0.7 ? 'R' : 'o');
      }
    }
  }
  p.hline(3, 12, 11, 'y');
  return p;
}
