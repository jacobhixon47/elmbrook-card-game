import type { Season } from '../../core';
import type { Moon } from '../../core/calendar';
import { seedRng } from '../../core/rng';
import { cellRandom, fbm, valueNoise } from '../noise';
import { PALETTE, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { cottage, FOLIAGE, mountains, pick, pine, rand, stipple, type Rng } from './town';

// The Night Market: Elmbrook's lane after dark, lined with striped stalls under
// a string of paper lanterns, thatched fieldstone cottages behind, cobbles in
// front and the week's moon overhead. Dressed for the season; when the town is
// snowed in, drifts bury the closed stalls and only the Hearth Trader's fire
// still burns. 640x360, deterministic for a seed.
//
// Layout follows the UI on top: the title, subtitle and stall cards sit in the
// centre (x 130-510, y 36-270), so the detail lives at the sides, in the sky
// band and along the bottom, and the bottom corners stay quiet for the deck
// pile and familiar slots.

export const MARKET_W = 640;
export const MARKET_H = 360;

const LANE_TOP = 236;

type StripeKind = 'red' | 'teal' | 'violet' | 'gold' | 'green';
type Goods = 'produce' | 'herbs' | 'jars' | 'hearth';
type StallSpec = { x0: number; x1: number; base: number; h: number; stripe: StripeKind; goods: Goods; hearth?: boolean };

const STALLS: readonly StallSpec[] = [
  { x0: 150, x1: 228, base: 258, h: 60, stripe: 'teal', goods: 'herbs' },
  { x0: 524, x1: 604, base: 256, h: 60, stripe: 'violet', goods: 'jars' },
  { x0: 14, x1: 136, base: 304, h: 92, stripe: 'red', goods: 'produce' },
  { x0: 398, x1: 516, base: 312, h: 94, stripe: 'gold', goods: 'hearth', hearth: true },
];

function awningBottom(s: StallSpec): number {
  return s.base - s.h + Math.round(s.h * 0.28);
}

/** Where each stall's lamp hangs: under the awning, toward the lane. */
function stallLamp(s: StallSpec): { x: number; y: number } {
  const left = s.x0 < 320;
  return { x: left ? s.x1 - 14 : s.x0 + 14, y: awningBottom(s) + 9 };
}

/** The Hearth Trader's brazier, in the lane in front of its stall. */
const FIRE = { x: 380, y: 322 };

/** A lamp post on the near side of the lane. */
const POST = { x: 158, ground: 338 };
const POST_LAMP = { x: POST.x + 1, y: POST.ground - 60 };

// The string of paper lanterns and bunting crossing above the lane.
const STRING = { x0: -12, x1: 652, y: 112, sag: 46 };
function stringY(x: number): number {
  const u = (x - (STRING.x0 + STRING.x1) / 2) / ((STRING.x1 - STRING.x0) / 2);
  return STRING.y + STRING.sag * (1 - u * u);
}
const STRING_LANTERN_XS = [34, 96, 158, 482, 544, 606] as const;
const STRING_LANTERNS = STRING_LANTERN_XS.map((x) => ({ x, y: Math.round(stringY(x)) + 7 }));

/** Lamp centres for a normal market night, for soft additive glows. */
export const NIGHT_MARKET_LIGHTS: readonly { x: number; y: number; scale: number }[] = [
  ...STALLS.map((s) => ({ ...stallLamp(s), scale: s.h > 80 ? 0.9 : 0.6 })),
  ...STRING_LANTERNS.map((l) => ({ x: l.x, y: l.y, scale: 0.4 })),
  { ...POST_LAMP, scale: 0.7 },
  { x: FIRE.x, y: FIRE.y - 8, scale: 0.9 },
];

const SNOWED_IN_LIGHTS: readonly { x: number; y: number; scale: number }[] = [
  { ...stallLamp(STALLS[3]!), scale: 0.9 },
  { x: FIRE.x, y: FIRE.y - 8, scale: 1.3 },
];

/** Lamp centres for the market: every lantern on a normal night, only the Hearth Trader's when snowed in. */
export function nightMarketLights(snowedIn: boolean): readonly { x: number; y: number; scale: number }[] {
  return snowedIn ? SNOWED_IN_LIGHTS : NIGHT_MARKET_LIGHTS;
}

// ---------------------------------------------------------------- light

type Lamp = { x: number; y: number; radius: number; power: number };

function lampsFor(snowedIn: boolean): Lamp[] {
  const fire: Lamp = { x: FIRE.x, y: FIRE.y - 8, radius: snowedIn ? 150 : 110, power: snowedIn ? 1 : 0.8 };
  if (snowedIn) return [fire, { ...stallLamp(STALLS[3]!), radius: 90, power: 0.7 }];
  return [
    fire,
    ...STALLS.map((s) => ({ ...stallLamp(s), radius: s.h > 80 ? 110 : 70, power: s.h > 80 ? 0.9 : 0.75 })),
    ...STRING_LANTERNS.map((l) => ({ x: l.x, y: l.y, radius: 46, power: 0.4 })),
    { ...POST_LAMP, radius: 90, power: 0.75 },
  ];
}

type Ctx = {
  p: Pixmap;
  r: Rng;
  season: Season;
  snowedIn: boolean;
  winter: boolean;
  light: (x: number, y: number) => number;
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x: number, y: number): number {
  return ((BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] ?? 0) + 0.5) / 16;
}

const SKY: readonly PaletteKey[] = ['K', 'z', 'Z', 'q', 'Q', 'P', 'X'];
const WOOD: readonly PaletteKey[] = ['K', 'k', 'b', 'B', 'n', 'a'];
const COBBLE: readonly PaletteKey[] = ['K', 'k', 'q', 'Q', 'J', 'h', 'H'];
const SNOW_COOL: readonly PaletteKey[] = ['q', 'Q', 'S', 'e', 'm', 'W'];
const SNOW_WARM: readonly PaletteKey[] = ['j', 'J', 'h', 'H', 'a', 'w', 'W'];

const STRIPES: Record<StripeKind, readonly [readonly PaletteKey[], readonly PaletteKey[]]> = {
  red: [['k', 'j', 'r', 'R', 'I'], ['q', 'J', 'h', 'H', 'a', 'w']],
  teal: [['k', 'g', 'T', 't', 'c'], ['q', 'J', 'h', 'H', 'a', 'w']],
  violet: [['k', 'p', 'P', 'v', 'm'], ['q', 'J', 'h', 'H', 'a', 'w']],
  gold: [['k', 'b', 'B', 'o', 'y'], ['k', 'j', 'r', 'R', 'I']],
  green: [['k', 'g', 'G', 'l', 'L'], ['q', 'J', 'h', 'H', 'a', 'w']],
};

/** Snow, moonlit violet in the dark and warm cream where a lamp reaches it. */
function snow(c: Ctx, x: number, y: number, t: number): void {
  const l = c.light(x, y);
  if (l * 1.6 > bayer(x + 1, y + 2)) c.p.shade(x, y, SNOW_WARM, t * 0.8 + l * 0.5);
  else c.p.shade(x, y, SNOW_COOL, t);
}

// ---------------------------------------------------------------- sky

const MOON = { x: 92, y: 86, r: 13 };

function sky(c: Ctx, moon: Moon): void {
  const { p, r } = c;
  const horizon = 214;
  for (let y = 0; y <= horizon + 20; y++) {
    for (let x = 0; x < MARKET_W; x++) {
      const t = 0.12 + (y / horizon) * 0.62 + (valueNoise(x, y, 20, 4) - 0.5) * 0.12 - (moon === 'new' ? 0.06 : 0);
      p.shade(x, y, SKY, t);
    }
  }
  // Wisps of cloud, kept thin behind the title and subtitle.
  for (let y = 14; y < horizon - 30; y++) {
    for (let x = 0; x < MARKET_W; x++) {
      const calm = x > 110 && x < 530 && y > 30 && y < 86 ? 0.12 : 0;
      const cl = fbm(x * 0.6, y * 2.2, 26, 11, 3) - calm;
      if (cl > 0.62) p.shade(x, y, ['q', 'Q', 'P', 'v'], (cl - 0.62) * (moon === 'new' ? 3 : 4.5));
    }
  }
  // Stars: many more on a moonless night, fewer near the moon.
  const count = moon === 'new' ? 560 : 300;
  for (let i = 0; i < count; i++) {
    const sx = Math.floor(rand(r) * MARKET_W);
    const sy = Math.floor(rand(r) * (horizon - 20));
    const nearMoon = Math.hypot(sx - MOON.x, sy - MOON.y) < MOON.r * (moon === 'full' ? 3.6 : 2.6);
    if (nearMoon && moon !== 'new') continue;
    p.set(sx, sy, pick(r, ['W', 'm', 'c', 'v', 'y', 'I'] as const));
    if (rand(r) > 0.94) p.set(sx - 1, sy, 'P').set(sx + 1, sy, 'P').set(sx, sy - 1, 'P').set(sx, sy + 1, 'P');
  }
  moonDisc(p, moon);
}

/** The week's moon: full, a lit half (waxing on the right, waning on the left), or a new moon's faint ring. */
function moonDisc(p: Pixmap, moon: Moon): void {
  const { x: mx, y: my, r: R } = MOON;
  const halo = moon === 'full' ? R * 3.3 : moon === 'new' ? R * 1.6 : R * 2.5;
  const hx = moon === 'first-quarter' ? mx + R * 0.4 : moon === 'last-quarter' ? mx - R * 0.4 : mx;
  for (let y = Math.floor(my - halo - 2); y <= my + halo + 2; y++) {
    for (let x = Math.floor(mx - halo - 2); x <= mx + halo + 2; x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      const dx = x + 0.5 - mx;
      if (d < R) {
        const lit = moon === 'full' || (moon === 'first-quarter' && dx > 0) || (moon === 'last-quarter' && dx < 0);
        if (lit) p.shade(x, y, ['S', 'm', 'W'], 1.5 - (d / R) * 0.6 - fbm(x, y, R / 2, 2) * 0.9);
        else if (moon === 'new') p.shade(x, y, ['K', 'z', 'q'], 0.35 + (d / R) * 0.4);
        else p.shade(x, y, ['K', 'z', 'q'], 0.5 + (fbm(x, y, R / 2, 2) - 0.5) * 0.4 + (d > R - 1.2 ? 0.35 : 0));
        continue;
      }
      if (moon === 'new') {
        // A faint ring where the dark disc meets the sky.
        if (d < R + 1.2) stipple(p, x, y, 0.75, 'Q');
        else if (d < halo) stipple(p, x, y, ((halo - d) / (halo - R)) ** 2 * 0.35, 'q');
        continue;
      }
      const dh = Math.hypot(x + 0.5 - hx, y + 0.5 - my);
      const strength = moon === 'full' ? 0.8 : 0.55;
      const glow = ((halo - dh) / (halo - R)) ** 2 * strength;
      if (dh < halo && (moon === 'full' || glow > 0.22)) p.shade(x, y, ['q', 'Q', 'P', 'v', 'm'], glow);
    }
  }
}

// ---------------------------------------------------------------- town behind

/** The cottage roof's outline (matching town.ts), for laying snow on it. */
function roofSnow(c: Ctx, h: { x: number; base: number; w: number; wallH: number }, depth: number): void {
  const top = h.base - h.wallH;
  const roofH = Math.round(h.wallH * 0.95);
  const mid = h.x + h.w / 2;
  const over = 4;
  for (let x = h.x - over - 1; x <= h.x + h.w + over + 1; x++) {
    let first = -1;
    for (let j = 0; j < roofH; j++) {
      const k = j / (roofH - 1);
      const half = (h.w / 2 + over) * Math.sqrt(0.15 + 0.85 * k);
      if (Math.abs(x - mid) <= half) {
        first = j;
        break;
      }
    }
    if (first < 0) continue;
    const y0 = top - roofH + first - 1;
    const d = depth + Math.round(valueNoise(x, 0, 4, 81) * 2) + (first < 3 ? 1 : 0);
    for (let y = y0; y < y0 + d; y++) snow(c, x, y, 0.55 + (x - mid) / (h.w + 8) * 0.5 + (y === y0 ? 0.2 : 0) - (y - y0) * 0.06);
    // Icicles at the eaves.
    const eave = top - 1;
    if (y0 + d > eave - 2 && cellRandom(x, 1, 82) > 0.6) for (let y = eave; y < eave + 1 + Math.floor(cellRandom(x, 2, 82) * 3); y++) c.p.set(x, y, 'm');
  }
  // Snow banked against the walls.
  const bank = c.snowedIn ? 9 : 3;
  for (let x = h.x - 3; x < h.x + h.w + 3; x++) {
    const bh = bank + Math.round(valueNoise(x, 3, 7, 83) * (c.snowedIn ? 5 : 2));
    for (let y = h.base - bh; y < h.base + 2; y++) snow(c, x, y, 0.4 + (y === h.base - bh ? 0.25 : 0) + (x - h.x) / h.w * 0.15);
  }
}

/** A small broadleaf tree dressed for the season. */
function tree(c: Ctx, cx: number, ground: number, height: number): void {
  const { p, r, season } = c;
  const BARK: readonly PaletteKey[] = ['K', 'k', 'j', 'J', 'h'];
  const trunkTop = ground - height * 0.55;
  for (let y = Math.floor(trunkTop); y < ground; y++) {
    const k = (y - trunkTop) / (ground - trunkTop);
    const half = 1.5 + k * k * 3;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) p.shade(x, y, BARK, 0.2 + ((x - cx) / half) * 0.25 + (valueNoise(x * 3, y * 0.4, 3, 84) - 0.5) * 0.3);
  }
  const top = ground - height;
  if (season === 'winter') {
    // Bare branches with snow along their tops.
    for (let b = 0; b < 9; b++) {
      const dir = b % 2 === 0 ? -1 : 1;
      const by = trunkTop + 4 - b * 3;
      const len = 6 + rand(r) * 12;
      for (let s = 0; s < len; s++) {
        const x = Math.round(cx + dir * s);
        const y = Math.round(by - s * (0.7 + rand(r) * 0.15));
        p.set(x, y, s % 4 === 0 ? 'j' : 'k');
        if (s > 1 && cellRandom(x, y, 85) > 0.35) snow(c, x, y - 1, 0.6);
      }
    }
    return;
  }
  const LEAF: Record<Exclude<Season, 'winter'>, readonly PaletteKey[]> = {
    spring: ['k', 'g', 'G', 'i', 'I', 'W'],
    summer: ['K', 'k', 'g', 'G', 'l', 'L'],
    autumn: ['k', 'j', 'r', 'B', 'o', 'y'],
  };
  const ramp = LEAF[season];
  for (let i = 0; i < 14; i++) {
    const a = rand(r) * Math.PI;
    const bx = cx + Math.cos(a) * height * 0.32 * rand(r);
    const by = top + height * 0.2 + Math.sin(a) * height * 0.14 * rand(r);
    const rad = height * (0.13 + rand(r) * 0.1);
    for (let y = Math.floor(by - rad); y <= by + rad; y++) {
      for (let x = Math.floor(bx - rad * 1.2); x <= bx + rad * 1.2; x++) {
        const d = Math.hypot((x - bx) / 1.2, y - by) / rad;
        if (d > 0.75 + fbm(x, y, 4, 86) * 0.45) continue;
        const face = ((x - bx) / rad - (y - by) / rad) * 0.22;
        const leaf = (cellRandom(x >> 1, y >> 1, 87) - 0.5) * 0.3;
        p.shade(x, y, ramp, (season === 'spring' ? 0.42 : 0.22) + face + leaf - d * 0.15 + c.light(x, y) * 0.4);
      }
    }
  }
}

const COTTAGES = [
  { x: -6, w: 104, wallH: 34 },
  { x: 134, w: 72, wallH: 24 },
  { x: 238, w: 64, wallH: 22 },
  { x: 334, w: 70, wallH: 24 },
  { x: 432, w: 80, wallH: 26 },
  { x: 546, w: 100, wallH: 34 },
] as const;

function town(c: Ctx): void {
  const { p, r } = c;
  // Far peaks, low and dim so the centre stays calm under the stall cards.
  mountains(p, 0, MARKET_W - 1, 206, MARKET_H - 1, [
    { x: 60, h: 64 },
    { x: 190, h: 48 },
    { x: 300, h: 58 },
    { x: 420, h: 44 },
    { x: 560, h: 70 },
  ], 6);
  for (let x = 0; x < MARKET_W; x++) {
    const edge = 196 + Math.round(Math.sin(x / 29) * 4 + valueNoise(x, 0, 9, 88) * 6);
    for (let y = edge; y < LANE_TOP + 4; y++) p.shade(x, y, ['K', 'z', 'g', 'T'], 0.28 - (y - edge) / 50 + (y === edge ? 0.25 : 0));
  }
  for (let i = 0; i < 70; i++) pine(p, Math.floor(rand(r) * MARKET_W), 206 + Math.floor(rand(r) * 14), 12 + Math.floor(rand(r) * 14), 0.1);
  if (c.winter) {
    for (let x = 0; x < MARKET_W; x++) for (let y = 190; y < LANE_TOP; y++) if (p.isSet(x, y) && fbm(x, y, 3, 89) > 0.68 && cellRandom(x, y, 90) > 0.5) stipple(p, x, y, 0.6, 'S');
  }
  // Trees between the houses.
  tree(c, 120, LANE_TOP + 2, 64);
  tree(c, 322, LANE_TOP + 2, 48);
  tree(c, 528, LANE_TOP + 2, 62);
  for (const h of COTTAGES) {
    const spec = { ...h, base: LANE_TOP };
    cottage(p, r, spec);
    if (c.winter) roofSnow(c, spec, c.snowedIn ? 6 : 4);
    else if (c.season === 'spring' || c.season === 'summer') flowerBox(c, h.x + h.w / 2 - 3, LANE_TOP - 1, 7);
  }
}

/** A trough of flowers along a wall foot. */
function flowerBox(c: Ctx, x: number, base: number, w: number): void {
  const { p, r } = c;
  p.fillRect(x - 1, base - 3, w + 2, 3, 'b').hline(x - 1, x + w, base - 3, 'B');
  const blooms: readonly PaletteKey[] = c.season === 'spring' ? ['I', 'i', 'w', 'v', 'y'] : ['y', 'R', 'I', 'w', 'o'];
  for (let i = 0; i < w + 2; i++) {
    const hgt = 2 + Math.floor(rand(r) * 3);
    for (let j = 0; j < hgt; j++) p.shade(x - 1 + i, base - 4 - j, FOLIAGE, 0.35 + rand(r) * 0.3 + c.light(x, base) * 0.3);
    if (rand(r) > 0.45) p.set(x - 1 + i, base - 4 - hgt, pick(r, blooms));
  }
}

// ---------------------------------------------------------------- the lane

function lane(c: Ctx): void {
  const { p } = c;
  // Cobbles in perspective: rows deepen toward the viewer and the joints fan out
  // from the far end of the lane; each stone is rounded and lit from above.
  let y = LANE_TOP + 2;
  let row = 0;
  while (y < MARKET_H) {
    const v = (y - LANE_TOP) / (MARKET_H - LANE_TOP);
    const rh = Math.round(3 + v * 8);
    const spread = 0.38 + v * 0.62;
    const sw = 13;
    const off = cellRandom(row, 0, 91) * sw;
    for (let j = 0; j < rh; j++) {
      const py = y + j;
      if (py >= MARKET_H) break;
      for (let x = 0; x < MARKET_W; x++) {
        const gx = (x - 320) / spread + off + 4000;
        const stone = Math.floor(gx / sw);
        const wobble = (cellRandom(stone, row, 104) - 0.5) * 0.3;
        const fx = (gx % sw) / sw;
        const dx = (fx - 0.5) * 2;
        const dy = ((j + 0.5) / rh - 0.5) * 2;
        const l = c.light(x, py);
        if (dx * dx * (1.1 + wobble) + dy * dy * 0.9 > 1.02 || j === rh - 1) {
          p.shade(x, py, COBBLE, 0.02 + l * 0.3);
          continue;
        }
        const tone = (cellRandom(stone, row, 92) - 0.5) * 0.2;
        const grain = (fbm(x, py, 3, 93) - 0.5) * 0.16;
        const dome = -dy * 0.14 - dx * 0.05;
        p.shade(x, py, COBBLE, 0.16 + v * 0.04 + l * 0.66 + tone + grain + dome - Math.abs(x - 320) / 2400);
      }
    }
    y += rh;
    row++;
  }
  // A worn gutter where the lane meets the house fronts.
  for (let x = 0; x < MARKET_W; x++) p.set(x, LANE_TOP, 'K').set(x, LANE_TOP + 1, cellRandom(x, 0, 94) > 0.5 ? 'k' : 'q');
  if (c.winter) laneSnow(c);
}

/** Snow on the cobbles: patches along the edges in winter, a deep blanket with a dug path when snowed in. */
function laneSnow(c: Ctx): void {
  for (let y = LANE_TOP; y < MARKET_H; y++) {
    const v = (y - LANE_TOP) / (MARKET_H - LANE_TOP);
    for (let x = 0; x < MARKET_W; x++) {
      const n = fbm(x * (1 - v * 0.5), y * 1.6, 18, 95);
      if (c.snowedIn) {
        // A trodden path from the bottom toward the Hearth Trader's fire.
        const pathX = 340 + (FIRE.x - 340) * (1 - v) + Math.sin(y / 14) * 6;
        const onPath = Math.abs(x - pathX) < 10 + v * 26 && y > FIRE.y - 6;
        if (onPath && n < 0.62) continue;
        const wave = Math.sin(x / (10 + v * 20) + n * 4) * 0.12;
        snow(c, x, y, 0.3 + wave + (n - 0.5) * 0.4 - v * 0.1);
      } else {
        const edge = Math.min(Math.abs(x - 320) / 320, 1);
        if (n + edge * 0.35 > 0.72) snow(c, x, y, 0.42 + (n - 0.6) * 0.8);
      }
    }
  }
}

// ---------------------------------------------------------------- stalls

function crate(c: Ctx, x: number, bottom: number, w: number, h: number, fill: PaletteKey[] | 'pumpkins' | null): void {
  const { p, r } = c;
  for (let y = bottom - h; y < bottom; y++) {
    for (let i = 0; i < w; i++) {
      const slat = (y - (bottom - h)) % 4 === 3 ? -0.2 : 0;
      const edge = i === 0 ? 0.12 : i === w - 1 ? -0.2 : 0;
      p.shade(x + i, y, WOOD, 0.3 + c.light(x + i, y) * 0.55 + slat + edge);
    }
  }
  p.hline(x, x + w - 1, bottom - h, 'k');
  if (fill === 'pumpkins') {
    for (let px = x + 3; px < x + w - 3; px += 7) pumpkin(c, px, bottom - h, 3.5, 2.6);
  } else if (fill) {
    for (let px = x + 1; px < x + w - 1; px++) {
      const mound = Math.round(Math.sin(((px - x) / w) * Math.PI) * 3);
      for (let y = bottom - h - mound - 1; y < bottom - h; y++) {
        if ((px + y) % 2 === 0) p.set(px, y, fill[0]!);
        else p.set(px, y, pick(r, fill));
        if (cellRandom(px, y, 96) > 0.86) p.set(px, y, 'W');
      }
    }
  }
}

function pumpkin(c: Ctx, cx: number, bottom: number, rx: number, ry: number): void {
  const { p } = c;
  for (let y = Math.floor(bottom - ry * 2); y < bottom; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - (bottom - ry)) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const rib = Math.abs(Math.round(x - cx)) === Math.round(rx / 2) ? -0.25 : 0;
      p.shade(x, y, ['k', 'b', 'B', 'o', 'y'], 0.4 + c.light(x, y) * 0.5 + rib - dy * 0.15);
    }
  }
  p.set(Math.round(cx), Math.floor(bottom - ry * 2) - 1, 'G');
}

function jarRow(c: Ctx, x0: number, x1: number, bottom: number): void {
  const { p, r } = c;
  const GLASS: readonly (readonly [PaletteKey, PaletteKey])[] = [['u', 'U'], ['r', 'R'], ['g', 'G'], ['p', 'P'], ['B', 'o'], ['T', 't']];
  let x = x0;
  while (x < x1 - 4) {
    const w = 3 + Math.floor(rand(r) * 3);
    const h = 4 + Math.floor(rand(r) * 5);
    const g = pick(r, GLASS);
    const glow = c.light(x, bottom) > 0.35;
    for (let y = bottom - h; y < bottom; y++) for (let i = 0; i < w; i++) p.set(x + i, y, y < bottom - h + 2 ? 'Q' : i === 0 ? (glow ? 'W' : 'm') : i === w - 1 ? g[0] : g[1]);
    p.fillRect(x + Math.floor(w / 2) - 1, bottom - h - 2, 2, 2, 'B');
    p.set(x - 1, bottom - 1, 'k');
    x += w + 1 + Math.floor(rand(r) * 2);
  }
}

function lantern(c: Ctx, x: number, y: number, lit: boolean): void {
  const { p } = c;
  for (let j = y - 7; j < y - 4; j++) p.set(x, j, 'k');
  p.fillRect(x - 2, y - 4, 5, 1, 'k');
  p.fillRect(x - 3, y - 3, 7, 7, 'k');
  if (lit) {
    p.fillRect(x - 2, y - 3, 5, 6, 'y');
    p.fillRect(x - 1, y - 2, 3, 4, 'Y');
    p.set(x, y - 1, 'W');
  } else {
    p.fillRect(x - 2, y - 3, 5, 6, 's');
    p.set(x - 1, y - 2, 'S');
  }
  p.hline(x - 3, x + 3, y + 4, 'b');
}

function stall(c: Ctx, s: StallSpec): void {
  const { p, r, season, snowedIn } = c;
  const closed = snowedIn && !s.hearth;
  const top = s.base - s.h;
  const awnBot = awningBottom(s);
  const counterTop = s.base - Math.round(s.h * 0.36);
  const sag = closed ? 6 : 0;
  const lamp = stallLamp(s);
  const lit = !closed;
  // Back of the stall: a dim canvas wall, warm where the lamp reaches it.
  for (let y = awnBot; y < counterTop; y++) for (let x = s.x0 + 2; x < s.x1 - 2; x++) p.shade(x, y, ['K', 'k', 'q', 'j', 'J', 'h'], 0.12 + c.light(x, y) * 0.6 + (fbm(x, y, 5, 97) - 0.5) * 0.1);
  if (!closed) {
    // A back shelf of wares and bundles of herbs hung to dry.
    const shelfY = awnBot + Math.round((counterTop - awnBot) * 0.55);
    jarRow(c, s.x0 + 6, s.x1 - 6, shelfY);
    p.hline(s.x0 + 3, s.x1 - 4, shelfY, 'B').hline(s.x0 + 3, s.x1 - 4, shelfY + 1, 'k');
    for (let x = s.x0 + 7; x < s.x1 - 7; x += 9) {
      if (Math.abs(x - lamp.x) < 6) continue;
      const len = 4 + Math.floor(rand(r) * 4);
      const herb: readonly PaletteKey[] = season === 'autumn' ? ['B', 'o', 'n'] : season === 'winter' ? ['g', 'G', 'h'] : ['g', 'G', 'l'];
      for (let j = 0; j < len; j++) p.set(x + (j > 1 && j % 2 === 0 ? 1 : 0), awnBot + 1 + j, pick(r, herb)).set(x - 1, awnBot + 2 + j, j % 2 === 0 ? herb[0]! : herb[1]!);
    }
  } else {
    // Shuttered for the snow: rough boards nailed across the front.
    for (let y = awnBot + 1; y < counterTop; y++) {
      for (let x = s.x0 + 3; x < s.x1 - 3; x++) {
        const plank = (x - s.x0) % 7 === 0 ? -0.2 : 0;
        p.shade(x, y, WOOD, 0.22 + plank + (valueNoise(x * 3, y, 8, 98) - 0.5) * 0.15);
      }
    }
    for (const yy of [awnBot + 5, counterTop - 6]) p.hline(s.x0 + 3, s.x1 - 4, yy, 'b').hline(s.x0 + 3, s.x1 - 4, yy + 1, 'k');
  }
  // Posts.
  for (const px of [s.x0, s.x1 - 3]) {
    for (let y = top + 2; y < s.base; y++) for (let i = 0; i < 3; i++) p.shade(px + i, y, WOOD, 0.28 + c.light(px, y) * 0.5 + (i === 0 ? 0.12 : i === 2 ? -0.18 : 0));
  }
  // Counter: a lit worktop over a plank front.
  for (let y = counterTop; y < s.base; y++) {
    for (let x = s.x0 - 1; x < s.x1 + 1; x++) {
      if (y < counterTop + 3) {
        p.shade(x, y, WOOD, (y === counterTop ? 0.62 : 0.42) + c.light(x, y) * 0.35);
        continue;
      }
      const plank = (x - s.x0) % 8 === 0 ? -0.18 : 0;
      p.shade(x, y, WOOD, 0.18 + c.light(x, y - 10) * 0.42 + plank + (valueNoise(x * 4, y, 10, 99) - 0.5) * 0.12 - (y - counterTop) / 160);
    }
  }
  p.hline(s.x0 - 1, s.x1, counterTop + 3, 'K');
  if (!closed) wares(c, s, counterTop);
  // Striped canvas awning, sloping out toward the lane, with a scalloped valance.
  const [rampA, rampB] = STRIPES[s.stripe];
  const awnH = awnBot - top;
  const stripes = Math.max(6, Math.round((s.x1 - s.x0) / 11));
  for (let j = 0; j < awnH; j++) {
    const k = j / awnH;
    const out = 2 + k * 5;
    const xa = s.x0 - out;
    const xb = s.x1 + out;
    for (let x = Math.floor(xa); x <= xb; x++) {
      const u = (x - xa) / (xb - xa);
      const droop = Math.round(Math.sin(u * Math.PI) * sag * k);
      const idx = Math.floor(u * stripes);
      const ramp = idx % 2 === 0 ? rampA : rampB;
      const fold = (u * stripes) % 1;
      const crease = fold < 0.15 ? -0.12 : fold > 0.85 ? 0.08 : 0;
      p.shade(x, top + j + droop, ramp, 0.22 + k * 0.32 + c.light(x, top + j + 12) * 0.35 + crease);
    }
  }
  // Valance scallops.
  const xa = s.x0 - 7;
  const xb = s.x1 + 7;
  const sw = (xb - xa) / stripes;
  for (let i = 0; i < stripes; i++) {
    const sx = xa + i * sw;
    const ramp = i % 2 === 0 ? rampA : rampB;
    for (let x = Math.floor(sx); x < sx + sw; x++) {
      const u = (x - xa) / (xb - xa);
      const droop = Math.round(Math.sin(u * Math.PI) * sag);
      const depth = Math.round(Math.sin(((x - sx) / sw) * Math.PI) * 3);
      for (let j = 0; j <= depth; j++) p.shade(x, awnBot + j + droop, ramp, 0.42 + c.light(x, awnBot + 10) * 0.4 - j * 0.08);
      p.set(x, awnBot + depth + 1 + droop, 'k');
    }
  }
  p.hline(s.x0 - 2, s.x1 + 1, top - 1, 'k');
  if (c.winter) {
    // Snow piled on the canvas: deep and heavy when snowed in.
    const depth = snowedIn ? 7 : 3;
    for (let x = s.x0 - 4; x <= s.x1 + 3; x++) {
      const u = (x - s.x0) / (s.x1 - s.x0);
      const d = depth + Math.round(Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * (snowedIn ? 3 : 1) + valueNoise(x, 4, 5, 100) * 2);
      for (let y = top - d; y < top + 2; y++) snow(c, x, y, 0.5 + u * 0.25 + (y === top - d ? 0.2 : 0) - (y - top + d) * 0.03);
    }
    // Snow along the valance and the worktop.
    for (let x = s.x0 - 6; x <= s.x1 + 5; x++) if (cellRandom(x, 5, 101) > 0.35) snow(c, x, awnBot - 1 + Math.round(Math.sin(((x - xa) / (xb - xa)) * Math.PI) * sag), 0.62);
    for (let x = s.x0; x < s.x1; x++) if (closed || cellRandom(x, 6, 101) > 0.7) snow(c, x, counterTop - 1, 0.6);
  }
  // The stall's lamp.
  lantern(c, lamp.x, lamp.y, lit);
  // Season dressing at the stall foot.
  if (!closed) footDressing(c, s);
}

function wares(c: Ctx, s: StallSpec, counterTop: number): void {
  const { p, season } = c;
  if (s.goods === 'hearth') {
    // The Hearth Trader: firewood, a kettle on a little stove, wool and candles.
    const sx = s.x0 + 10;
    for (let y = counterTop - 10; y < counterTop; y++) for (let x = sx; x < sx + 14; x++) p.shade(x, y, ['k', 's', 'S', 'e'], 0.3 + c.light(x, y) * 0.5 + (x === sx ? 0.15 : 0));
    p.fillRect(sx + 4, counterTop - 6, 6, 4, 'o').fillRect(sx + 5, counterTop - 5, 4, 2, 'y');
    p.fillRect(sx + 3, counterTop - 15, 8, 5, 'S').hline(sx + 4, sx + 9, counterTop - 16, 'e').set(sx + 11, counterTop - 13, 'S').set(sx + 12, counterTop - 14, 'S');
    for (let i = 0; i < 6; i++) stipple(p, sx + 6 + i, counterTop - 18 - i * 2, 0.5, 'v');
    let lx = sx + 18;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5 - row; i++) {
        const cx = lx + i * 5 + row * 2.5;
        const cy = counterTop - 3 - row * 4;
        p.fillEllipse(cx, cy, 2.6, 2.1, 'b');
        p.fillEllipse(cx + 0.4, cy - 0.4, 1.4, 1.1, c.light(cx, cy) > 0.4 ? 'n' : 'B');
      }
    }
    lx += 30;
    for (const col of ['R', 'U', 'w', 'G'] as const) {
      p.fillEllipse(lx + 3, counterTop - 4, 3.5, 3, col);
      p.set(lx + 2, counterTop - 6, 'W');
      lx += 8;
    }
    for (let i = 0; i < 3; i++) {
      const x = s.x1 - 14 + i * 4;
      p.fillRect(x, counterTop - 7 - i, 2, 7 + i, 'w');
      p.set(x, counterTop - 8 - i, 'y').set(x, counterTop - 9 - i, 'Y');
    }
    return;
  }
  if (s.goods === 'jars') {
    jarRow(c, s.x0 + 5, s.x1 - 5, counterTop);
    return;
  }
  // Produce and herbs: crates of the season's harvest.
  const FILL: Record<Season, PaletteKey[]> = {
    spring: ['G', 'l', 'L', 'I'],
    summer: ['r', 'R', 'P', 'p'],
    autumn: ['r', 'R', 'R', 'o'],
    winter: ['h', 'H', 'J', 'a'],
  };
  const HERBS: Record<Season, PaletteKey[]> = {
    spring: ['I', 'i', 'w', 'G'],
    summer: ['G', 'l', 'L', 'y'],
    autumn: ['o', 'y', 'B', 'n'],
    winter: ['G', 'g', 'm', 'v'],
  };
  const big = s.h > 80;
  const cw = big ? 20 : 14;
  const ch = big ? 9 : 6;
  let x = s.x0 + 4;
  let n = 0;
  while (x + cw < s.x1 - 2) {
    const kind = s.goods === 'herbs' ? HERBS[season] : n % 2 === 1 && season === 'autumn' ? 'pumpkins' : n % 3 === 2 ? HERBS[season] : FILL[season];
    crate(c, x, counterTop, cw, ch, kind);
    x += cw + 3;
    n++;
  }
}

/** What sits on the cobbles at a stall's foot, by season. */
function footDressing(c: Ctx, s: StallSpec): void {
  const { p, r, season } = c;
  const big = s.h > 80;
  if (!big) return;
  const fx = s.x0 < 320 ? s.x1 + 6 : s.x0 - 18;
  if (season === 'autumn') {
    pumpkin(c, fx + 6, s.base + 2, 6, 4.5);
    pumpkin(c, fx + 14, s.base + 3, 4, 3);
    crate(c, fx - 2, s.base + 6, 16, 8, ['r', 'R', 'R', 'o']);
  } else if (season === 'spring' || season === 'summer') {
    // A bucket of cut flowers.
    p.fillRect(fx + 2, s.base - 6, 10, 8, 's').hline(fx + 2, fx + 11, s.base - 6, 'S').hline(fx + 2, fx + 11, s.base - 2, 'k');
    const blooms: readonly PaletteKey[] = season === 'spring' ? ['I', 'i', 'w', 'v', 'W'] : ['y', 'R', 'o', 'w', 'I'];
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.15 + rand(r) * 0.7);
      const d = 3 + rand(r) * 9;
      const x = Math.round(fx + 7 + Math.cos(a) * d);
      const y = Math.round(s.base - 7 - Math.sin(a) * d);
      p.set(x, y, rand(r) > 0.45 ? pick(r, blooms) : 'G');
    }
  } else {
    // Winter: a stack of sacks dusted with snow.
    for (let i = 0; i < 2; i++) {
      p.fillEllipse(fx + 5 + i * 8, s.base - 3, 4.5, 4, 'J');
      p.fillEllipse(fx + 4 + i * 8, s.base - 4, 2.5, 2, 'h');
      snow(c, fx + 3 + i * 8, s.base - 7, 0.6);
      snow(c, fx + 4 + i * 8, s.base - 7, 0.6);
    }
  }
}

/** The Hearth Trader's brazier: an iron bowl of coals on three legs. */
function brazier(c: Ctx): void {
  const { p, r } = c;
  const { x, y } = FIRE;
  for (const lx of [-6, 0, 6]) for (let j = 0; j < 9; j++) p.set(x + lx + Math.sign(lx) * Math.floor(j / 4), y - 8 + j, j % 3 === 0 ? 'S' : 'k');
  p.fillEllipse(x + 0.5, y - 10, 10, 4, 'k');
  p.fillEllipse(x + 0.5, y - 11, 9, 3, 's');
  p.hline(x - 8, x + 9, y - 13, 'S');
  // Coals and flames.
  for (let i = 0; i < 70; i++) {
    const fx = x - 7 + Math.floor(rand(r) * 16);
    const hgt = (1 - Math.abs(fx - x) / 9) * 12;
    const fy = y - 13 - Math.floor(rand(r) * hgt);
    const t = (y - 13 - fy) / 12;
    p.set(fx, fy, t < 0.15 ? pick(r, ['o', 'R'] as const) : t < 0.45 ? pick(r, ['y', 'o'] as const) : t < 0.8 ? pick(r, ['Y', 'y'] as const) : 'W');
  }
  p.fillRect(x - 1, y - 18, 3, 5, 'Y').set(x, y - 20, 'y');
  // Sparks.
  for (let i = 0; i < 8; i++) p.set(x - 6 + Math.floor(rand(r) * 14), y - 24 - Math.floor(rand(r) * 18), pick(r, ['y', 'o', 'Y'] as const));
  // Warm light pooling on the ground.
  for (let yy = y - 2; yy < y + 4; yy++) for (let xx = x - 16; xx < x + 17; xx++) stipple(p, xx, yy, 0.35 - Math.abs(xx - x) / 60, 'o');
}

/** Snow drifts heaped against the closed stalls, burying their counters. */
function drifts(c: Ctx): void {
  for (const s of STALLS) {
    if (s.hearth) continue;
    const counterTop = s.base - Math.round(s.h * 0.36);
    const depth = s.base - counterTop;
    for (let x = s.x0 - 22; x < s.x1 + 22; x++) {
      const u = (x - (s.x0 - 22)) / (s.x1 - s.x0 + 44);
      const crest = s.base + 3 - depth * 1.2 * Math.sin(u * Math.PI) ** 0.6 * (0.85 + valueNoise(x, 7, 9, 102) * 0.3);
      for (let y = Math.floor(crest); y < s.base + 4; y++) snow(c, x, y, 0.42 + (y - crest < 2 ? 0.25 : 0) + u * 0.15 - (y - crest) * 0.01);
    }
  }
}

// ---------------------------------------------------------------- foreground

function barrel(c: Ctx, x: number, bottom: number, w: number, h: number): void {
  const { p } = c;
  for (let y = bottom - h; y < bottom; y++) {
    const k = (y - (bottom - h)) / h;
    const bulge = Math.round(Math.sin(k * Math.PI) * 2);
    for (let i = -bulge; i < w + bulge; i++) {
      const u = (i + bulge) / (w + bulge * 2);
      const hoop = Math.abs(k - 0.22) < 0.06 || Math.abs(k - 0.78) < 0.06;
      if (hoop) p.shade(x + i, y, ['k', 's', 'S', 'e'], 0.25 + c.light(x + i, y) * 0.5 + (0.5 - Math.abs(u - 0.4)) * 0.4);
      else p.shade(x + i, y, WOOD, 0.15 + c.light(x + i, y) * 0.55 + (0.5 - Math.abs(u - 0.35)) * 0.5 + (Math.round(u * 6) !== u * 6 && (i + bulge) % 4 === 0 ? -0.15 : 0));
    }
  }
  p.fillEllipse(x + w / 2, bottom - h, w / 2, 2, 'b');
  p.fillEllipse(x + w / 2, bottom - h, w / 2 - 1, 1.2, 'k');
  if (c.winter) for (let i = -1; i <= w; i++) for (let j = 0; j < (c.snowedIn ? 4 : 2); j++) snow(c, x + i, bottom - h - 2 - j + (i < 1 || i > w - 2 ? 1 : 0), 0.55 + j * 0.05);
}

function lampPost(c: Ctx): void {
  const { p } = c;
  const { x, ground } = POST;
  const top = ground - 54;
  for (let y = top; y < ground; y++) p.set(x, y, 'k').set(x + 1, y, y % 6 === 0 ? 'S' : 's').set(x + 2, y, 'k');
  p.fillRect(x - 2, ground - 4, 7, 4, 'k').hline(x - 1, x + 3, ground - 4, 's');
  p.hline(x - 3, x + 5, top, 'k').hline(x - 2, x + 4, top - 1, 'S');
  lantern(c, POST_LAMP.x, POST_LAMP.y + 2, !c.snowedIn);
  if (c.winter) for (let i = -3; i <= 5; i++) snow(c, x + i, POST_LAMP.y - 7, 0.7);
}

/** Barrels, baskets and the lamp post along the near edge of the lane, clear of the HUD corners. */
function foreground(c: Ctx): void {
  const { p, r, season } = c;
  barrel(c, 176, 344, 13, 18);
  barrel(c, 192, 348, 13, 18);
  const fill: Record<Season, PaletteKey[]> = { spring: ['G', 'l', 'I', 'w'], summer: ['R', 'r', 'y', 'G'], autumn: ['R', 'r', 'o', 'y'], winter: ['h', 'H', 'J', 'm'] };
  crate(c, 208, 350, 24, 11, season === 'autumn' ? 'pumpkins' : fill[season]);
  // A wicker basket by the Hearth Trader.
  for (let y = 336; y < 348; y++) for (let x = 528; x < 552; x++) p.shade(x, y, WOOD, 0.3 + c.light(x, y) * 0.5 + ((x + y) % 3 === 0 ? -0.2 : 0) + ((y - 336) % 4 === 0 ? 0.12 : 0));
  p.hline(527, 552, 335, 'b');
  for (let i = 0; i < 26; i++) p.set(529 + Math.floor(rand(r) * 22), 333 + Math.floor(rand(r) * 3), pick(r, season === 'winter' ? (['b', 'B', 'n'] as const) : fill[season]));
  lampPost(c);
}

// ---------------------------------------------------------------- above the lane

function lanternString(c: Ctx): void {
  const { p, snowedIn } = c;
  const BUNTING: readonly PaletteKey[][] = [['j', 'r', 'R'], ['g', 'T', 't'], ['b', 'B', 'o'], ['p', 'P', 'v'], ['q', 'J', 'h']];
  for (let x = 0; x < MARKET_W; x++) {
    const y = Math.round(stringY(x));
    p.set(x, y, x % 5 === 0 ? 'S' : 'k');
    if (c.winter && cellRandom(x, 8, 103) > 0.3) snow(c, x, y - 1, 0.6);
  }
  // Pennants, flagging toward the middle where the cards sit.
  for (let x = 6, i = 0; x < MARKET_W; x += 11, i++) {
    if (x > 196 && x < 444) continue;
    if (STRING_LANTERN_XS.some((lx) => Math.abs(lx - x) < 7)) continue;
    const ramp = BUNTING[i % BUNTING.length]!;
    const y0 = Math.round(stringY(x)) + 1;
    const len = snowedIn ? 5 : 7;
    for (let j = 0; j < len; j++) {
      const half = Math.round((1 - j / len) * 3.5);
      for (let k = -half; k <= half; k++) {
        const tilt = snowedIn ? Math.floor(j / 3) : 0;
        p.shade(x + k + tilt, y0 + j, ramp, 0.3 + c.light(x, y0) * 0.6 + (k < 0 ? -0.15 : 0.05));
      }
    }
    if (c.winter) snow(c, x - 1, y0, 0.7);
  }
  // Paper lanterns.
  for (const l of STRING_LANTERNS) {
    p.set(l.x, l.y - 6, 'k').set(l.x, l.y - 5, 'k');
    p.fillRect(l.x - 2, l.y - 4, 5, 1, 'k');
    const body: readonly PaletteKey[] = snowedIn ? ['K', 'k', 'q', 'Q'] : ['r', 'o', 'y', 'Y', 'W'];
    for (let y = l.y - 3; y <= l.y + 3; y++) {
      for (let x = l.x - 4; x <= l.x + 4; x++) {
        const dx = (x - l.x) / 4.5;
        const dy = (y - l.y) / 3.6;
        if (dx * dx + dy * dy > 1) continue;
        const rib = y === l.y - 1 || y === l.y + 2 ? -0.25 : 0;
        p.shade(x, y, body, 0.8 - Math.hypot(dx, dy) * 0.6 + rib);
      }
    }
    p.fillRect(l.x - 2, l.y + 4, 5, 1, 'k');
    p.set(l.x, l.y + 5, snowedIn ? 'q' : 'R');
    if (c.winter) for (let x = l.x - 2; x <= l.x + 2; x++) snow(c, x, l.y - 4, 0.7);
  }
}

// ---------------------------------------------------------------- the season in the air

function seasonAir(c: Ctx): void {
  const { p, r, season, snowedIn } = c;
  const inCentre = (x: number, y: number) => x > 128 && x < 512 && y > 30 && y < 272;
  if (season === 'summer') {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rand(r) * MARKET_W);
      const y = 150 + Math.floor(rand(r) * 200);
      if (inCentre(x, y) && rand(r) > 0.25) continue;
      p.set(x, y, pick(r, ['L', 'y', 'Y'] as const));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) stipple(p, x + dx, y + dy, 0.45, 'l');
    }
  } else if (season === 'spring') {
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(rand(r) * MARKET_W);
      const y = 120 + Math.floor(rand(r) * 240);
      if (inCentre(x, y) && rand(r) > 0.2) continue;
      p.set(x, y, pick(r, ['I', 'I', 'i', 'w'] as const));
      if (rand(r) > 0.5) p.set(x + 1, y, 'I');
    }
  } else if (season === 'autumn') {
    // Leaves drifting and lying on the cobbles.
    for (let i = 0; i < 220; i++) {
      const x = Math.floor(rand(r) * MARKET_W);
      const lying = rand(r) > 0.3;
      const y = lying ? LANE_TOP + 4 + Math.floor(rand(r) * (MARKET_H - LANE_TOP - 4)) : 130 + Math.floor(rand(r) * 120);
      if (inCentre(x, y) && rand(r) > 0.25) continue;
      const col = pick(r, ['o', 'R', 'y', 'B', 'r'] as const);
      p.set(x, y, col);
      if (lying) p.set(x + 1, y, rand(r) > 0.5 ? col : 'B');
      else p.set(x + 1, y + 1, col);
    }
  } else {
    const n = snowedIn ? 420 : 200;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rand(r) * MARKET_W);
      const y = Math.floor(rand(r) * MARKET_H);
      if (inCentre(x, y) && rand(r) > 0.3) continue;
      const big = rand(r) > 0.85;
      p.set(x, y, big ? 'W' : pick(r, ['m', 'e', 'v'] as const));
      if (big) p.set(x + 1, y, 'm').set(x, y + 1, 'm');
    }
  }
}

// ---------------------------------------------------------------- finish

const DARKER: Partial<Record<string, PaletteKey>> = {};
for (const [from, to] of [
  ['a', 'H'], ['H', 'h'], ['h', 'J'], ['J', 'j'], ['j', 'q'], ['q', 'k'], ['k', 'K'], ['Q', 'q'], ['P', 'Q'], ['v', 'P'],
  ['X', 'x'], ['x', 'Z'], ['Z', 'z'], ['z', 'K'], ['n', 'B'], ['B', 'b'], ['b', 'k'], ['S', 's'], ['s', 'k'], ['e', 'S'],
  ['m', 'e'], ['G', 'g'], ['g', 'k'], ['l', 'G'], ['T', 'g'], ['r', 'j'], ['R', 'r'], ['p', 'k'],
] as const) DARKER[PALETTE[from]] = to;

/** Steps pixels one shade darker toward the corners, where the HUD sits. */
function vignette(p: Pixmap): void {
  for (let y = 0; y < MARKET_H; y++) {
    for (let x = 0; x < MARKET_W; x++) {
      const v = Math.max(0, Math.hypot((x - 320) / 330, (y - 170) / 210) - 0.62) * 2.4;
      if (v <= bayer(x, y)) continue;
      const i = (y * MARKET_W + x) * 4;
      const key = '#' + [0, 1, 2].map((k) => (p.data[i + k] ?? 0).toString(16).padStart(2, '0')).join('');
      const d = DARKER[key];
      if (d) p.set(x, y, d);
    }
  }
}

export type NightMarketOptions = { season: Season; moon: Moon; snowedIn: boolean };

/** The Night Market street for a season and moon; `snowedIn` (winter only) buries all but the Hearth Trader. */
export function nightMarketBackdrop(opts: NightMarketOptions, seed = 'elmbrook-night-market'): Pixmap {
  const p = new Pixmap(MARKET_W, MARKET_H);
  const r: Rng = { s: seedRng(seed) };
  const snowedIn = opts.snowedIn && opts.season === 'winter';
  const lamps = lampsFor(snowedIn);
  const light = (x: number, y: number): number => {
    let total = 0;
    for (const l of lamps) {
      const d = Math.hypot(x - l.x, (y - l.y) * 1.15) / l.radius;
      if (d < 1) total += l.power * (1 - d) ** 1.5;
    }
    return Math.min(1, total);
  };
  const c: Ctx = { p, r, season: opts.season, snowedIn, winter: opts.season === 'winter', light };
  sky(c, opts.moon);
  town(c);
  lane(c);
  for (const s of STALLS) stall(c, s);
  brazier(c);
  if (snowedIn) drifts(c);
  foreground(c);
  lanternString(c);
  seasonAir(c);
  vignette(p);
  return p;
}
