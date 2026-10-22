import type { Season } from '../../core';
import { seedRng } from '../../core/rng';
import { FESTIVAL_HOMES, HOMES, homesFor, SQUARE_H, SQUARE_W, type Home, type HomeId, type SquarePlace } from '../../view/market-square';
import { cellRandom, fbm, valueNoise } from '../noise';
import { PALETTE, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { rand, type Rng } from './town';

// The walkable Night Market (GDD §9): Elmbrook's square after dark, seen from above like the
// cottage, drawn from Jacob's four seasonal night concepts (Oct 19). Warm cobbles round a moon
// fountain on its stepped dais, eight cloth-hung stalls in a ring with a rug before each, a timber
// house in the top corner, a waterfall and stream down the right, trees thick down both sides, and
// along the front a fence, flower beds, the gate with its crescent banners and the steps down to
// the bridge, the fire pit in its clearing and dark water with a little dock.
// Square space is 320x180 (src/view/market-square.ts), drawn at 2x. The ground is one picture;
// each stall, the fountain, the tinker's cart and the fire pit are sprites the scene sorts with you.
// Light is a cool moonlit night baked in, darker toward the edges; the scene adds warm glows at
// `squareLights`, so the sprites carry only a touch of lamplight of their own.

/** `place` dresses the square for a fair or the vigil (market if left out); `gifts` is how many wait on the vigil's table. */
export type SquareOptions = { season: Season; snowedIn: boolean; place?: SquarePlace; gifts?: number };

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

/** The middle of the fountain's dais, and its radii (it is an ellipse, seen from above and in front). */
const DAIS = { x: 160, y: 92, rx: 44, ry: 26 };
/** The flagged lanes: north between the back stalls, south from the dais to the gate. */
const LANE = { x0: 145, x1: 175 };
/** The gate's banner poles either side of the lane, and the steps down to the bridge below it. */
const POLES = [140, 179] as const;
const POLE_TOP = 142;
const STEPS_Y = 168;
/** The fire pit's clearing below the fence. */
const CLEARING = { x: 74, y: 162, rx: 32, ry: 15 };
/** The stream runs down the right from the waterfall to the water along the front. */
const streamX = (y: number) => 288 + Math.sin(y / 15) * 5 + Math.sin(y / 6.5) * 1.2;

/** Moonlight on the ground, 0..1: open sky over the middle, shadow under the trees. */
function moon(x: number, y: number): number {
  const centre = 1 - Math.min(1, Math.hypot((x - 160) / 150, (y - 92) / 100));
  return 0.3 + centre * 0.5;
}

function snowPx(p: Pixmap, x: number, y: number, t: number): void {
  flat(p, x, y, SNOW, t);
}

const smoothstep = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- where things are

/** How far inside the cobbled plaza a point is: above 0 inside, with a ragged edge where it meets the gardens. */
function plaza(x: number, y: number): number {
  const sq = (Math.abs(x - 158) / 116) ** 4 + (Math.abs(y - 86) / 66) ** 4;
  let v = 1 - sq + (fbm(x, y, 5, 201) - 0.5) * 0.12;
  if (x >= LANE.x0 - 1 && x <= LANE.x1 + 1) v = Math.max(v, y < 40 || y > 130 ? 0.5 : v);
  const c = 1 - Math.hypot((x - CLEARING.x) / CLEARING.rx, (y - CLEARING.y) / CLEARING.ry) + (fbm(x, y, 4, 202) - 0.5) * 0.25;
  v = Math.max(v, c);
  // The path from the lane round under the flower bed to the clearing.
  if (y >= 161 && y <= 177 && x > 90 && x < LANE.x0) v = Math.max(v, 0.3);
  return v;
}

/** The water along the front right, fed by the stream. */
function isWater(x: number, y: number): boolean {
  const shore = 152 + Math.max(0, 204 - x) * 0.9 + (valueNoise(x, 0, 6, 203) - 0.5) * 4;
  if (x > 192 && y > shore) return true;
  return y < 160 && y > 26 && Math.abs(x - streamX(y)) < 3.6 + y / 60;
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

/** The gardens round the plaza: dark earth and grass, under the trees. */
function garden(p: Pixmap, season: Season): void {
  const ramp: readonly PaletteKey[] = season === 'autumn' ? ['K', 'k', 'g', 'b'] : season === 'summer' ? ['K', 'g', 'g', 'G'] : ['K', 'k', 'g', 'G'];
  for (let y = 0; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      const t = 0.35 + (fbm(x, y, 5, 211) - 0.5) * 0.7 + (cellRandom(x, y, 212) - 0.5) * 0.25;
      flat(p, x, y, ramp, t);
    }
  }
}

function cobbles(p: Pixmap, snowedIn: boolean): void {
  const mortar = (x: number, y: number) => {
    const c = cobbleCell(x, y, 8, 5, 11);
    return c.d2 - c.d1 < 1.05;
  };
  for (let y = 0; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      const inside = plaza(x, y);
      if (inside <= 0) continue;
      const c = cobbleCell(x, y, 8, 5, 11);
      // Where the plaza meets the gardens, stones go missing and moss creeps between them.
      if (inside < 0.06 && cellRandom(c.id, 5, 12) > inside * 12) continue;
      const tone = cellRandom(c.id, 3, 12);
      // Mostly warm mauve stone, as in Jacob's concepts, with the odd grey one.
      const ramp = snowedIn || tone > 0.9 ? COOL_COBBLE : WARM_COBBLE;
      if (c.d2 - c.d1 < 1.05) {
        p.set(x, y, inside < 0.1 ? 'g' : 'q');
        continue;
      }
      const step = stoneStep(moon(c.sx, c.sy), tone, cellRandom(c.id, 4, 12));
      const lit = mortar(x, y - 1) && !mortar(x, y + 1);
      const dark = mortar(x, y + 1) || mortar(x + 1, y);
      p.set(x, y, ramp[lit ? step + 1 : dark ? step - 1 : step]!);
    }
  }
}

/** The dais under the fountain: fitted stones in rings, a curb of paler stone at the edge. */
function dais(p: Pixmap, snowedIn: boolean): void {
  const R = DAIS.rx;
  const squash = DAIS.rx / DAIS.ry;
  for (let y = DAIS.y - DAIS.ry - 1; y <= DAIS.y + DAIS.ry + 1; y++) {
    for (let x = DAIS.x - R - 1; x <= DAIS.x + R + 1; x++) {
      const dx = x + 0.5 - DAIS.x;
      const dy = (y + 0.5 - DAIS.y) * squash;
      const rr = Math.hypot(dx, dy);
      if (rr > R) continue;
      const curb = rr > R - 5;
      const ringW = 6;
      const ring = curb ? 99 : Math.floor(rr / ringW);
      const theta = Math.atan2(dy, dx) + Math.PI;
      const segLen = curb ? 9 : 7;
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
      const edge = dy < 0 ? (inRing < 2 ? 1 : inRing > w - 1 ? -1 : 0) : inRing > w - 1 ? 1 : inRing < 2 ? -1 : 0;
      p.set(x, y, ramp[Math.max(1, Math.min(ramp.length - 1, step + edge))]!);
    }
  }
}

/** Big flagstones down the lanes: north between the back stalls, south from the dais to the gate. */
function lanes(p: Pixmap, snowedIn: boolean): void {
  for (let y = 0; y < STEPS_Y; y++) {
    if (y >= 40 && y < 112) continue;
    for (let x = LANE.x0; x <= LANE.x1; x++) {
      if (Math.hypot(x + 0.5 - DAIS.x, (y + 0.5 - DAIS.y) * (DAIS.rx / DAIS.ry)) < DAIS.rx) continue;
      const row = Math.floor((y + 70) / 7);
      const off = row % 2 ? 6 : 0;
      const col = Math.floor((x - LANE.x0 + off) / 10);
      const ry = (y + 70) % 7;
      const rx = (x - LANE.x0 + off) % 10;
      if (x === LANE.x0 || x === LANE.x1) {
        p.set(x, y, y % 4 === 0 ? 'k' : 'S');
        continue;
      }
      if (ry === 6 || rx === 9) {
        p.set(x, y, 'k');
        continue;
      }
      const tone = cellRandom(row, col, 31);
      const ramp = snowedIn || tone > 0.75 ? COOL_COBBLE : WARM_COBBLE;
      const step = stoneStep(moon(x, y) + 0.05, tone, cellRandom(row, col, 32));
      p.set(x, y, ramp[ry === 0 ? step + 1 : ry === 5 || rx === 8 ? step - 1 : step]!);
    }
  }
  // A low stone wall closing the north lane, under the trees.
  for (let x = LANE.x0 - 2; x <= LANE.x1 + 2; x++) {
    for (let y = 8; y < 13; y++) p.set(x, y, y === 8 ? 'e' : y === 12 ? 'k' : (x + (y > 10 ? 4 : 0)) % 8 === 0 ? 'k' : y < 10 ? 'S' : 's');
  }
}

// ---------------------------------------------------------------- the house

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
/** The timber house in the top-left corner, its windows lit. */
const HOUSES: readonly House[] = [
  { x: 40, w: 60, roof: 'shingle', gable: 24, door: 86, windows: [{ x: 47, y: 18, lit: true }, { x: 58, y: 18, lit: true }, { x: 69, y: 18, lit: true }, { x: 66, y: 6 }], chimney: 46 },
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

// ---------------------------------------------------------------- water

/** The waterfall at the top right, the stream it feeds, and the water along the front with a dock. */
function water(p: Pixmap, season: Season, frozen: boolean): void {
  // The rocks the waterfall drops from.
  for (let y = 0; y < 30; y++) {
    for (let x = 270; x < 312; x++) {
      const d = Math.hypot((x - 290) / 20, (y - 6) / 24);
      if (d > 1 + (fbm(x, y, 4, 221) - 0.5) * 0.4) continue;
      const k = cellRandom(Math.floor(x / 5), Math.floor(y / 4), 222);
      p.set(x, y, k > 0.7 ? 'S' : k > 0.3 ? 's' : 'k');
    }
  }
  for (let y = 0; y < SQUARE_H; y++) {
    for (let x = 180; x < SQUARE_W; x++) {
      const fall = y < 28 && Math.abs(x - 290) < 5;
      if (!fall && !isWater(x, y)) continue;
      if (fall) {
        // Falling water in streaks, foam at the foot.
        const streak = cellRandom(x, Math.floor((y + x * 3) / 3), 223);
        p.set(x, y, frozen ? (streak > 0.5 ? 'm' : 'e') : y > 24 ? (streak > 0.4 ? 'W' : 'c') : streak > 0.7 ? 'c' : streak > 0.3 ? 'U' : 'u');
        continue;
      }
      const edge = !isWater(x, y - 1) || !isWater(x - 1, y) || !isWater(x + 1, y);
      if (edge) {
        p.set(x, y, 'k');
        continue;
      }
      if (frozen) {
        const crack = valueNoise(x, y * 4, 5, 71) > 0.7;
        p.set(x, y, crack ? 'x' : cellRandom(x >> 2, y, 72) > 0.8 ? 'm' : 'e');
        continue;
      }
      const ripple = cellRandom(Math.floor((x + y * 3) / 4), y, 73) > 0.84;
      p.set(x, y, ripple ? 'u' : !isWater(x, y - 2) ? 'K' : 'z');
    }
  }
  if (!frozen) {
    // The moon on the water, broken into dashes, and lily pads out of winter.
    for (const [x, y, w] of [[232, 170, 3], [236, 172, 2], [288, 174, 3], [292, 176, 2], [262, 160, 2]] as const) p.hline(x, x + w - 1, y, 'X');
    if (season !== 'winter') {
      for (const [x, y] of [[214, 166], [222, 174], [244, 164], [276, 168], [300, 164], [306, 176], [284, 130], [210, 176]] as const) {
        p.hline(x, x + 2, y, 'G').set(x + 1, y + 1, 'g').set(x, y, 'l');
        if (season === 'spring' && x % 3 === 0) p.set(x + 1, y - 1, 'I');
      }
    }
  }
  // The dock: planks on posts, with a lantern at the end.
  for (let y = 164; y < SQUARE_H; y++) {
    for (let x = 252; x < 272; x++) {
      const plank = Math.floor((x - 252) / 4);
      p.set(x, y, (x - 252) % 4 === 3 ? 'b' : (y + plank * 5) % 11 === 0 ? 'b' : y === 164 ? 'n' : 'B');
    }
  }
  for (const [x, y] of [[251, 164], [271, 164], [251, 176], [271, 176]] as const) p.fillRect(x, y - 1, 2, 4, 'k').set(x, y - 1, 'b');
  if (season === 'winter') for (let x = 252; x < 272; x++) if (cellRandom(x, 1, 224) > 0.3) p.set(x, 164, 'm').set(x, 165, cellRandom(x, 2, 224) > 0.5 ? 'e' : 'B');
  lanternPx(p, 258, 160, true);
}

/** The wooden steps from the gate down to the bridge, with rails either side. */
function steps(p: Pixmap, snowy: boolean): void {
  const bx = LANE.x0;
  const w = LANE.x1 - LANE.x0 + 1;
  for (let y = STEPS_Y; y < SQUARE_H; y++) {
    const r = (y - STEPS_Y) % 4;
    for (let x = bx; x < bx + w; x++) {
      const plank = Math.floor((y - STEPS_Y) / 4);
      const end = (x - bx + plank * 7) % 13 === 0;
      p.set(x, y, r === 3 ? 'k' : end ? 'b' : r === 0 ? 'n' : 'B');
    }
  }
  if (snowy) for (let x = bx; x < bx + w; x++) for (let y = STEPS_Y; y < SQUARE_H; y += 4) if (cellRandom(x, y, 78) > 0.6 && (x < bx + 7 || x > bx + w - 8)) p.set(x, y, 'm');
  for (const rx of [bx - 1, bx + w]) for (let y = STEPS_Y - 2; y < SQUARE_H; y++) p.set(rx, y, y % 4 === 0 ? 'n' : 'b');
}

// ---------------------------------------------------------------- fences, beds, rugs

/** A rail fence: posts every few pixels with two rails, a little snow along the top in winter. */
function fence(p: Pixmap, x0: number, x1: number, y: number, winter: boolean): void {
  for (let x = x0; x <= x1; x++) {
    p.set(x, y + 1, 'B').set(x, y + 2, 'b').set(x, y + 4, 'B').set(x, y + 5, 'b');
    if (winter && cellRandom(x, y, 231) > 0.25) p.set(x, y, 'm');
  }
  for (let x = x0; x <= x1; x += 9) {
    for (let j = -1; j < 7; j++) p.set(x, y + j, j < 0 ? (winter ? 'm' : 'n') : 'B').set(x + 1, y + j, j < 0 ? (winter ? 'e' : 'B') : 'b');
  }
}

/** A flower bed: dark earth packed with leaves and flowers in the season's colours. */
function bed(p: Pixmap, x0: number, y0: number, x1: number, y1: number, season: Season): void {
  const flowers: readonly PaletteKey[] =
    season === 'spring' ? ['I', 'i', 'W', 'y'] : season === 'summer' ? ['y', 'W', 'i', 'o'] : season === 'autumn' ? ['o', 'R', 'y', 'B'] : ['m', 'e'];
  const leaf: readonly PaletteKey[] = season === 'winter' ? ['K', 'g', 'g', 'G'] : ['K', 'g', 'G', 'l'];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const n = fbm(x, y, 3, 241);
      if (n < 0.28) continue;
      const bloom = cellRandom(x, y, 242);
      if (bloom > (season === 'winter' ? 0.6 : 0.78)) p.set(x, y, flowers[Math.floor(cellRandom(x, y, 243) * flowers.length)]!);
      else flat(p, x, y, leaf, n - 0.1 + (y0 + y1 - 2 * y) * 0.03);
    }
  }
}

/** A rug's colours: its field, its dark border, and the gold of its pattern. */
type RugLook = { field: PaletteKey; border: PaletteKey; figure: PaletteKey };
const RUG_LOOK: Record<string, RugLook> = {
  red: { field: 'r', border: 'j', figure: 'B' },
  blue: { field: 'u', border: 'z', figure: 'B' },
  teal: { field: 'T', border: 'g', figure: 'B' },
  plum: { field: 'p', border: 'k', figure: 'B' },
  navy: { field: 'z', border: 'K', figure: 'B' },
};
/** The rugs laid on the stones: one before or beside each stall, and two either side of the lane by the gate. */
const RUGS: readonly { x: number; y: number; w: number; h: number; look: keyof typeof RUG_LOOK }[] = [
  { x: 64, y: 67, w: 32, h: 12, look: 'red' },
  { x: 111, y: 53, w: 32, h: 11, look: 'blue' },
  { x: 185, y: 53, w: 32, h: 11, look: 'teal' },
  { x: 226, y: 69, w: 32, h: 12, look: 'plum' },
  { x: 88, y: 84, w: 20, h: 19, look: 'red' },
  { x: 200, y: 86, w: 20, h: 19, look: 'plum' },
  { x: 67, y: 134, w: 32, h: 11, look: 'navy' },
  { x: 218, y: 134, w: 32, h: 11, look: 'red' },
  { x: 106, y: 122, w: 34, h: 20, look: 'plum' },
  { x: 183, y: 126, w: 28, h: 18, look: 'teal' },
];

/**
 * The rugs out tonight. At a festival the Fortune Tent's and the Name-Taker's are rolled up for the
 * fair's middle stall, which gets one of its own; at the vigil the one by the lane makes way for
 * the table of gifts.
 */
function rugsFor(place: SquarePlace): typeof RUGS {
  if (place === 'market') return RUGS;
  const keep = RUGS.filter((_, i) => i !== 1 && i !== 2 && !(place === 'vigil' && i === 9));
  return place === 'fair' ? [...keep, { x: 144, y: 55, w: 32, h: 11, look: 'blue' }] : keep;
}

/** A patterned rug: a gold-lined border, a lattice of gold flecks, a diamond medallion, fringe at the ends. */
function rug(p: Pixmap, x0: number, y0: number, w: number, h: number, look: RugLook): void {
  const { field, border, figure } = look;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const bx = Math.min(x - x0, x0 + w - 1 - x);
      const by = Math.min(y - y0, y0 + h - 1 - y);
      const b = Math.min(bx, by);
      if (b === 0) p.set(x, y, figure);
      else if (b === 1) p.set(x, y, border);
      else if (b === 2) p.set(x, y, (x + y) % 2 === 0 ? figure : border);
      else {
        const cx = x + 0.5 - (x0 + w / 2);
        const cy = y + 0.5 - (y0 + h / 2);
        const d = Math.abs(cx) / 1.6 + Math.abs(cy);
        const lattice = (Math.abs(Math.round(cx)) + Math.abs(Math.round(cy))) % 4 === 0 && (x + y) % 2 === 0;
        p.set(x, y, d < 1.2 ? 'n' : Math.abs(d - 3) < 0.6 ? figure : lattice ? figure : field);
      }
    }
  }
  for (let y = y0 + 1; y < y0 + h - 1; y += 2) p.set(x0 - 1, y, 'a').set(x0 + w, y, 'a');
}

// ---------------------------------------------------------------- trees and shrubs

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
    bareCrown(p, r, cx, base, size);
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

/**
 * A broadleaf in winter (Jacob, Oct 21): the same tree with its leaves gone, a crown of forking
 * branches filling the shape the leaves had, lit from the upper left, with snow along the tops.
 */
function bareCrown(p: Pixmap, r: Rng, cx: number, base: number, size: number): void {
  const crown = { x: cx, y: base - size * 1.1, rx: size * 0.95, ry: size * 0.95 };
  const inside = (x: number, y: number) => ((x - crown.x) / crown.rx) ** 2 + ((y - crown.y) / crown.ry) ** 2 <= 1.15;
  const limb = (x: number, y: number, angle: number, len: number, depth: number) => {
    let px = x;
    let py = y;
    for (let s = 0; s < len; s++) {
      px += Math.cos(angle);
      py += Math.sin(angle);
      const ix = Math.round(px);
      const iy = Math.round(py);
      if (s > 2 && !inside(ix, iy)) return;
      const lit = Math.cos(angle) < 0 ? 0.62 : 0.4;
      flat(p, ix, iy, WOOD, depth >= 3 ? lit - 0.1 : lit);
      if (depth >= 5) flat(p, ix + 1, iy, WOOD, 0.25);
      // Snow settles on the tops of the limbs that lie flattest.
      if (Math.abs(Math.sin(angle)) < 0.8 && cellRandom(ix, iy, 51) > 0.35) snowPx(p, ix, iy - 1, 0.6 + (cellRandom(ix, iy, 57) - 0.5) * 0.3);
    }
    if (depth <= 0) return;
    const kids = depth >= 4 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const spread = (k - (kids - 1) / 2) * (0.55 + rand(r) * 0.3) + (rand(r) - 0.5) * 0.25;
      limb(px, py, angle + spread, len * (0.62 + rand(r) * 0.18), depth - 1);
    }
  };
  // The trunk up into the crown, then the limbs.
  for (let y = base - 6; y > base - size * 0.6; y--) for (let x = cx - 1; x <= cx + 1; x++) flat(p, x, y, WOOD, 0.15 + (x - cx) * -0.08);
  limb(cx, base - size * 0.6, -Math.PI / 2, size * 0.6, 5);
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
 * The trees framing the square, as in the concepts: thick down both sides and along the back
 * behind the stalls, and in the bottom-left corner round the fire pit's clearing. Blossom in spring,
 * deep green in summer, red and gold in autumn, bare and snowy in winter with pines among them.
 */
const TREES: readonly TreeSpot[] = [
  // The back, behind the stalls and the house.
  { x: 104, base: 16, size: 12, pine: false },
  { x: 124, base: 10, size: 11, pine: false },
  { x: 140, base: 8, size: 9, pine: false },
  { x: 182, base: 8, size: 9, pine: false },
  { x: 200, base: 10, size: 12, pine: false },
  { x: 222, base: 16, size: 12, pine: false },
  { x: 244, base: 30, size: 13, pine: false },
  { x: 262, base: 22, size: 12, pine: false },
  { x: 30, base: 22, size: 14, pine: true },
  { x: 86, base: 6, size: 13, pine: false },
  { x: 160, base: 4, size: 10, pine: false },
  { x: 240, base: 12, size: 14, pine: false },
  // Down the left.
  { x: 14, base: 40, size: 14, pine: false },
  { x: 36, base: 52, size: 12, pine: false },
  { x: 6, base: 66, size: 26, pine: true },
  { x: 30, base: 80, size: 12, pine: false },
  { x: 12, base: 96, size: 14, pine: false },
  { x: 36, base: 112, size: 11, pine: false },
  { x: 8, base: 124, size: 13, pine: false },
  { x: 32, base: 140, size: 12, pine: false },
  { x: 10, base: 156, size: 14, pine: false },
  { x: 30, base: 180, size: 14, pine: false },
  { x: 4, base: 184, size: 24, pine: true },
  { x: 24, base: 62, size: 13, pine: false },
  { x: 22, base: 128, size: 14, pine: false },
  { x: 40, base: 168, size: 11, pine: false },
  { x: 2, base: 110, size: 15, pine: false },
  // Down the right, either side of the stream.
  { x: 272, base: 46, size: 12, pine: false },
  { x: 312, base: 40, size: 14, pine: false },
  { x: 270, base: 70, size: 12, pine: false },
  { x: 316, base: 74, size: 26, pine: true },
  { x: 274, base: 96, size: 12, pine: false },
  { x: 310, base: 104, size: 13, pine: false },
  { x: 272, base: 122, size: 11, pine: false },
  { x: 312, base: 134, size: 14, pine: false },
  { x: 274, base: 148, size: 11, pine: false },
  { x: 300, base: 58, size: 12, pine: false },
  { x: 304, base: 120, size: 12, pine: false },
  { x: 318, base: 156, size: 14, pine: false },
  { x: 280, base: 30, size: 10, pine: false },
];
/** In winter the broadleaves stand bare, with a pine every fourth tree among them (Jacob, Oct 21). */
const winterPine = (t: TreeSpot, i: number) => t.pine || i % 4 === 1;

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

/** Shrubs and potted plants between the stalls and along the plaza's edge, as in the concepts. */
const SHRUBS: readonly (readonly [number, number, number, number])[] = [
  [101, 50, 5, 4], [217, 50, 5, 4], [104, 30, 4, 3], [214, 30, 4, 3], [176, 30, 4, 3], [144, 30, 4, 3], [52, 66, 4, 3], [262, 68, 4, 4],
  [46, 106, 4, 4], [266, 106, 4, 4], [58, 140, 4, 3], [104, 140, 4, 3], [212, 142, 4, 3], [258, 142, 4, 3],
  [44, 140, 5, 4], [196, 152, 6, 4], [232, 150, 5, 3],
];

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

// ---------------------------------------------------------------- snow

/** How much snow lies here: deep everywhere off the paths people have trodden. */
function snowCover(x: number, y: number, snowedIn: boolean, place: SquarePlace = 'market'): number {
  const n = (fbm(x, y, 9, 91) - 0.5) * 0.6;
  const c = (snowedIn ? 1.5 : 1.15) + n;
  // Trodden paths: down both lanes, round the dais, to every stall and to the fire.
  const r = Math.hypot(x - DAIS.x, (y - DAIS.y) * (DAIS.rx / DAIS.ry));
  let clear = snowedIn ? smoothstep(DAIS.rx + 8, DAIS.rx, r) : smoothstep(9, 3, Math.abs(r - DAIS.rx - 3));
  if (y > 104 || y < 44) clear = Math.max(clear, smoothstep(9, 2, Math.max(LANE.x0 - x, x - LANE.x1, 0)));
  if (y > 160 && x > 80 && x < LANE.x0) clear = Math.max(clear, smoothstep(6, 1, Math.abs(y - 169)) * 0.9);
  for (const h of homesFor(place)) {
    const z = h.zone;
    const d = Math.hypot(Math.max(z.x - x, x - (z.x + z.w), 0), Math.max(z.y - y, y - (z.y + z.h), 0) * 1.3);
    clear = Math.max(clear, smoothstep(snowedIn ? 8 : 12, 0, d));
  }
  return c - clear * (snowedIn ? 1.1 : 0.85);
}

/** Snow over the whole square, thinning to a dusting on the trodden paths; open water stays dark. */
function groundSnow(p: Pixmap, snowedIn: boolean, place: SquarePlace): void {
  for (let y = 0; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      if (isWater(x, y) || (y >= STEPS_Y && x >= LANE.x0 && x <= LANE.x1)) continue;
      // The house keeps its own snow on the roof.
      if (HOUSES.some((h) => x >= h.x && x < h.x + h.w && y < 30)) continue;
      const c = snowCover(x, y, snowedIn, place);
      if (c < 0.15) {
        if (keyAt(p, x, y) === 'k' && cellRandom(x, y, 99) < (snowedIn ? 0.45 : 0.15)) p.set(x, y, 'x');
        continue;
      }
      if (c < 0.4) {
        const k = keyAt(p, x, y);
        if (k === 'k' || k === 'q' || dither(x, y) < (c - 0.15) * 1.2) p.set(x, y, c < 0.28 ? 'x' : 'X');
        continue;
      }
      const lip = snowCover(x, y + 1, snowedIn, place) < 0.4;
      const top = snowCover(x, y - 1, snowedIn, place) < 0.4;
      p.set(x, y, lip ? 'x' : top ? 'e' : fbm(x, y, 4, 92) * 0.5 + moon(x, y) > 0.78 ? 'e' : 'X');
    }
  }
}

// ---------------------------------------------------------------- seasonal dressing

/** Petals, leaves or grass scattered over the plaza, thicker toward its edges. */
function scatter(p: Pixmap, r: Rng, n: number, keys: readonly PaletteKey[], size = 1): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rand(r) * SQUARE_W);
    const y = Math.floor(rand(r) * SQUARE_H);
    const k = keys[Math.floor(rand(r) * keys.length)]!;
    const v = plaza(x, y);
    if (v <= 0 || rand(r) < v * 1.4) continue;
    p.set(x, y, k);
    if (size > 1 && rand(r) > 0.5) p.set(x + 1, y, k);
  }
}

/** Planters by the stalls: a tub of the season's flowers at the open end of each. */
function planters(p: Pixmap, season: Season, place: SquarePlace): void {
  const flowers: readonly PaletteKey[] = season === 'spring' ? ['I', 'i', 'W'] : season === 'summer' ? ['y', 'W', 'i'] : season === 'autumn' ? ['o', 'y', 'R'] : ['m', 'W', 'e'];
  for (const h of homesFor(place)) {
    if (h.kind !== 'stall') continue;
    const left = h.at.x + h.size.w / 2 > SQUARE_W / 2;
    const x = left ? h.at.x - 5 : h.at.x + h.size.w - 1;
    flowerTub(p, x, h.at.y + h.size.h, flowers, season === 'winter' ? 'g' : 'G');
  }
}

function dressing(p: Pixmap, r: Rng, season: Season, snowedIn: boolean, place: SquarePlace): void {
  if (season === 'spring') scatter(p, r, 900, ['I', 'i', 'i', 'w']);
  else if (season === 'summer') scatter(p, r, 500, ['G', 'g', 'l']);
  else if (season === 'autumn') {
    scatter(p, r, 1100, ['o', 'B', 'B', 'r', 'R', 'y'], 2);
    // Pumpkins by the stalls, the fence and the flower beds.
    for (const [x, b, rx, ry] of [[56, 70, 3, 2.2], [101, 56, 2.5, 2], [216, 56, 3, 2.2], [264, 72, 2.5, 2], [110, 146, 3, 2.2], [118, 148, 2, 1.6], [190, 150, 3, 2.2], [198, 152, 2.5, 2], [262, 106, 3, 2.2], [48, 138, 2.5, 2], [102, 160, 3, 2.2], [52, 172, 2.5, 2]] as const) pumpkin(p, x, b, rx, ry);
  } else groundSnow(p, snowedIn, place);
}

// ---------------------------------------------------------------- the way in

/** Fireflies drifting by the trees on summer nights; each gets a small glow. */
const FIREFLIES: readonly (readonly [number, number])[] = [
  [40, 50], [24, 90], [44, 120], [20, 146], [278, 60], [300, 92], [268, 130], [296, 150], [100, 22], [226, 22],
  [52, 160], [120, 164], [200, 140], [240, 156], [284, 112], [16, 70], [258, 40], [88, 154],
];

/** The gate: a pole either side of the lane with a crescent banner and a lantern, bunting strung between. */
function gate(p: Pixmap, season: Season): void {
  const winter = season === 'winter';
  for (const px of POLES) {
    for (let y = POLE_TOP; y < STEPS_Y; y++) p.set(px, y, 'b').set(px + 1, y, 'B');
    p.hline(px - 3, px + 4, POLE_TOP + 2, 'b');
    // The banner: deep blue, a pale crescent and a star, a pointed foot.
    for (let y = POLE_TOP + 3; y < POLE_TOP + 17; y++) {
      for (let x = px - 3; x <= px + 4; x++) {
        const foot = y - (POLE_TOP + 14);
        if (foot > 0 && Math.abs(x - px - 0.5) < foot * 1.3) continue;
        p.set(x, y, x === px - 3 || x === px + 4 ? 'z' : 'u');
      }
    }
    for (const [dx, dy] of [[0, 7], [-1, 8], [-1, 9], [-1, 10], [0, 11], [1, 7], [1, 11]] as const) p.set(px + dx, POLE_TOP + dy, 'm');
    p.set(px + 1, POLE_TOP + 4, 'n').set(px, POLE_TOP + 13, 'n');
    if (winter) p.hline(px - 3, px + 4, POLE_TOP + 3, 'm');
    lanternPx(p, px, POLE_TOP - 2, true);
  }
  // Bunting: a sagging rope between the poles, little flags hanging from it, two lanterns.
  const [a, b] = POLES;
  const flags: readonly PaletteKey[] = ['n', 'u', 'r', 'G'];
  for (let x = a + 2; x < b; x++) {
    const t = (x - a) / (b - a);
    const y = POLE_TOP + 1 + Math.round(Math.sin(t * Math.PI) * 4);
    p.set(x, y, 'k');
    const f = Math.floor((x - a - 2) / 5);
    const fx = (x - a - 2) % 5;
    if (fx < 3 && f % 1 === 0) {
      const k = flags[f % flags.length]!;
      p.set(x, y + 1, k);
      if (fx === 1) p.set(x, y + 2, k);
    }
  }
  for (const lx of [a + 12, b - 11]) lanternPx(p, lx, POLE_TOP + 6, true);
}

// ---------------------------------------------------------------- the square

/** The square without its stalls, fountain, cart or fire: ground, house, water, trees, beds and the gate. 320x180. */
export function squareGround(opts: SquareOptions, seed = 'elmbrook-square'): Pixmap {
  const { season } = opts;
  const snowedIn = opts.snowedIn && season === 'winter';
  const winter = season === 'winter';
  const p = new Pixmap(SQUARE_W, SQUARE_H);
  const r: Rng = { s: seedRng(seed) };

  garden(p, season);
  cobbles(p, snowedIn);
  lanes(p, snowedIn);
  dais(p, snowedIn);
  for (const h of HOUSES) house(p, h, winter);
  water(p, season, snowedIn);
  steps(p, winter);
  for (const g of rugsFor(opts.place ?? 'market')) rug(p, g.x, g.y, g.w, g.h, RUG_LOOK[g.look]!);
  // Log benches round the fire pit.
  for (const [x, y, w] of [[60, 172, 12], [44, 158, 4]] as const) p.fillRect(x, y, w, 3, 'B').hline(x, x + w - 1, y, 'n').hline(x, x + w - 1, y + 2, 'b').set(x + w - 1, y + 1, 'a');
  dressing(p, r, season, snowedIn, opts.place ?? 'market');
  bed(p, 104, 147, 144, 160, season);
  bed(p, 178, 147, 214, 157, season);
  fence(p, 46, 142, 145, winter);
  fence(p, 180, 230, 146, winter);
  planters(p, season, opts.place ?? 'market');

  // The night closes in at the edges; lamplight never darkens.
  for (let y = 0; y < SQUARE_H; y++) {
    for (let x = 0; x < SQUARE_W; x++) {
      const v = Math.max(0, Math.hypot((x - 160) / 170, (y - 90) / 120) - 0.92) * 3 + (y < 8 ? (8 - y) / 12 : 0);
      const steps = Math.min(1, Math.floor(v + dither(x, y)));
      if (steps <= 0) continue;
      const k = keyAt(p, x, y);
      if (!k || k === 'y' || k === 'Y' || k === 'o' || k === 'L') continue;
      darken(p, x, y, steps);
    }
  }
  // Shrubs and trees last, over the darkened edges, so they stand out against them.
  for (const [x, y, rx, ry] of SHRUBS) bush(p, x, y, rx, ry, season);
  TREES.forEach((t, i) => {
    if (t.pine || (winter && winterPine(t, i))) pineTree(p, t.x, t.base, Math.max(t.size, 18), season);
    else broadleaf(p, r, t.x, t.base, t.size, season);
  });
  if (season === 'summer') for (const [x, y] of FIREFLIES) p.set(x, y, 'L').set(x + 1, y, 'Y');
  gate(p, season);
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
  // The fairs' stalls, striped in cream for the festival (see `stall`).
  'flower-grower': { dark: 'r', base: 'i', light: 'I' },
  beekeeper: { dark: 'B', base: 'n', light: 'y' },
  'garland-weaver': { dark: 'g', base: 'G', light: 'l' },
  'orchard-keeper': { dark: 'j', base: 'R', light: 'o' },
  glassblower: { dark: 'u', base: 'U', light: 'c' },
  hatter: { dark: 'B', base: 'o', light: 'y' },
  farmer: { dark: 'g', base: 'G', light: 'l' },
  'cider-maker': { dark: 'j', base: 'r', light: 'R' },
  'straw-weaver': { dark: 'B', base: 'n', light: 'y' },
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

/** The figure on each home's cloth, as in the concepts: a crescent, a row of moons, hanging stars. */
const MOTIF: Partial<Record<HomeId, 'crescent' | 'moons' | 'hanging' | 'stars' | 'plain'>> = {
  lantern: 'crescent',
  fortune: 'moons',
  name: 'hanging',
  fence: 'crescent',
  west: 'plain',
  east: 'hanging',
  moth: 'stars',
  tailor: 'moons',
  top: 'plain',
};

const homeOf = (id: HomeId): Home => [...HOMES, ...FESTIVAL_HOMES].find((h) => h.id === id)!;

/** Where a stall's lantern hangs in its sprite: off the post nearer the middle of the square. */
function stallLantern(h: Home): { x: number; y: number } {
  return { x: h.at.x + h.size.w / 2 < SQUARE_W / 2 ? 38 : 1, y: 12 };
}

function lanternPx(p: Pixmap, x: number, y: number, lit: boolean): void {
  p.set(x, y - 2, 'k').set(x, y - 1, 'S');
  p.hline(x - 1, x + 1, y, 'k');
  p.set(x - 1, y + 1, 'k').set(x, y + 1, lit ? 'Y' : 's').set(x + 1, y + 1, 'k');
  p.set(x - 1, y + 2, 'k').set(x, y + 2, lit ? 'y' : 's').set(x + 1, y + 2, 'k');
  p.hline(x - 1, x + 1, y + 3, 'k');
}

/** The cloth's figure in a pale thread, over the cloth between x 4 and 35, y 5 and 13. */
function motif(p: Pixmap, kind: 'crescent' | 'moons' | 'hanging' | 'stars' | 'plain', thread: PaletteKey): void {
  if (kind === 'crescent') {
    for (let y = 4; y < 14; y++) {
      for (let x = 14; x < 26; x++) {
        const o = Math.hypot(x + 0.5 - 19.5, y + 0.5 - 9);
        const i = Math.hypot(x + 0.5 - 21.5, y + 0.5 - 8);
        if (o <= 4 && i > 3.4) p.set(x, y, thread);
      }
    }
    for (const [x, y] of [[9, 7], [29, 7], [12, 11], [27, 11], [24, 6]] as const) p.set(x, y, thread).set(x - 1, y, thread).set(x + 1, y, thread).set(x, y - 1, thread).set(x, y + 1, thread);
  } else if (kind === 'moons') {
    // A waxing crescent, a half, a full moon, a half and a waning crescent.
    [7, 13, 20, 27, 33].forEach((cx, i) => {
      for (let y = 6; y < 12; y++) {
        for (let x = cx - 3; x <= cx + 3; x++) {
          const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - 9);
          if (d > 2.6) continue;
          const lit = i === 2 || (i < 2 ? x - cx > (i === 0 ? 0.5 : -0.5) : x - cx < (i === 4 ? -0.5 : 0.5));
          if (lit || d > 1.8) p.set(x, y, thread);
        }
      }
    });
  } else if (kind === 'hanging') {
    for (const x of [9, 16, 23, 30]) {
      for (let y = 5; y < 10 + (x % 3); y++) p.set(x, y, thread);
      const y = 10 + (x % 3);
      p.set(x, y, thread).set(x - 1, y, thread).set(x + 1, y, thread).set(x, y - 1, thread).set(x, y + 1, thread);
    }
  } else if (kind === 'stars') {
    const pts = [[7, 9], [12, 6], [18, 10], [24, 7], [30, 11], [33, 6]] as const;
    pts.forEach(([x, y], i) => {
      p.set(x, y, thread).set(x - 1, y, thread).set(x + 1, y, thread).set(x, y - 1, thread).set(x, y + 1, thread);
      const next = pts[i + 1];
      if (next) for (let s = 1; s < 4; s++) p.set(Math.round(x + ((next[0] - x) * s) / 4), Math.round(y + ((next[1] - y) * s) / 4), thread);
    });
  }
}

function stall(h: Home, opts: SquareOptions & { open: boolean; stall: string | null }): Pixmap {
  const W = 40;
  const p = new Pixmap(W, 32);
  const id = opts.stall ?? RESIDENT[h.id] ?? null;
  let c = (id && CANOPIES[id]) || PLAIN;
  const open = opts.open && !!opts.stall;
  const fair = opts.place === 'fair';
  if (!open) c = { dark: DARKER[c.dark], base: c.dark, light: c.base };
  const lantern = stallLantern(h);
  const sag = (x: number) => Math.round(Math.sin((Math.PI * (x - 3)) / 33) * 2.5);

  // Shadow on the cobbles.
  for (let x = 1; x < W - 1; x++) {
    if ((x & 1) === 0) p.set(x, 30, 'K');
    if (x % 4 === 1) p.set(x, 31, 'K');
  }
  // The dark inside, a shelf of jars at the back.
  for (let y = 8; y < 20; y++) for (let x = 4; x < W - 4; x++) p.set(x, y, y < 12 ? 'K' : x % 6 === 0 ? 'K' : 'k');
  p.hline(5, W - 6, 15, 'b');
  for (let x = 7; x < W - 7; x += 4) p.set(x, 14, cellRandom(x, h.at.x, 105) > 0.5 ? 'u' : 'B').set(x, 13, 'k');
  // Posts, with a knob on top.
  for (const px of [3, W - 5]) {
    for (let y = 3; y < 30; y++) p.set(px, y, 'B').set(px + 1, y, 'b');
    p.set(px, 2, 'n').set(px + 1, 2, 'B');
  }

  if (open) {
    // The cloth: hung from a rod between the posts, sagging in the middle, a pale figure on it.
    p.hline(1, W - 2, 3, 'b');
    for (let x = 2; x < W - 2; x++) {
      const bottom = 12 + sag(x);
      for (let y = 4; y <= bottom; y++) {
        const fold = (x - 2) % 9 === 0;
        const t = y === bottom ? c.dark : fold ? c.dark : x < W / 2 && y < 8 ? c.light : c.base;
        // A fair's cloth is striped with cream, scalloped at the hem.
        const stripe = fair && (x - 2) % 6 >= 3;
        p.set(x, y, stripe && y < bottom ? (y < 6 ? 'W' : 'w') : t);
      }
      if (fair && (x - 2) % 3 === 1) p.set(x, 13 + sag(x), c.dark);
    }
    if (!fair) motif(p, MOTIF[h.id] ?? 'plain', 'a');
    else for (const [x, y] of [[8, 3], [20, 2], [32, 3]] as const) p.set(x, y, 'y').set(x, y - 1, 'Y');
    // Tone the figure down where it crosses a fold, so it sits in the cloth.
    for (let x = 2; x < W - 2; x++) if ((x - 2) % 9 === 0) for (let y = 4; y < 14; y++) if (keyAt(p, x, y) === 'a') p.set(x, y, 'n');
    // The table: a lamplit top with the wares on it, plank front, legs.
    for (let y = 19; y < 22; y++) for (let x = 3; x < W - 3; x++) {
      const near = 1 - Math.min(1, Math.abs(x - lantern.x) / 30);
      flat(p, x, y, WOOD, 0.4 + near * 0.3 + (y === 19 ? 0.12 : 0) - (y - 19) * 0.04);
    }
    for (let y = 22; y < 28; y++) for (let x = 3; x < W - 3; x++) flat(p, x, y, WOOD, (x - 3) % 6 === 0 ? 0.1 : 0.3 - (y - 22) * 0.02);
    p.hline(3, W - 4, 22, 'k');
    for (const lx of [4, W - 6]) p.fillRect(lx, 28, 2, 2, 'b');
    wares(p, opts.stall!, opts.season);
    // A crate at the foot of the table, by the lantern's post.
    const cx = lantern.x > W / 2 ? W - 11 : 4;
    p.fillRect(cx, 24, 7, 6, 'B').strokeRect(cx, 24, 7, 6, 'b').hline(cx, cx + 6, 24, 'n').set(cx + 3, 26, 'b');
    lanternPx(p, lantern.x, lantern.y, true);
  } else {
    // Shut: the cloth rolled up on its rod, a tarp roped down over the table.
    for (let x = 1; x < W - 1; x++) p.set(x, 3, 'k').set(x, 4, c.light).set(x, 5, c.base).set(x, 6, 'k');
    for (let y = 11; y < 30; y++) {
      const inset = y < 13 ? 13 - y : 0;
      for (let x = 2 + inset; x < W - 2 - inset; x++) {
        const fold = Math.sin((x + y * 0.4) / 2.2) > 0.75;
        p.set(x, y, y === 11 + 0 && inset > 0 ? 'k' : fold ? 'k' : y < 15 ? c.light : y > 26 ? 'k' : c.base);
      }
    }
    for (const tx of [9, W - 10]) for (let y = 11; y < 29; y++) p.set(tx, y, y % 3 ? 'b' : 'B');
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
      fairWares(p, id, top);
      break;
  }
  if (season === 'autumn' && id !== 'harvest-auction') p.set(4, top - 1, 'o').set(35, top, 'R');
}

/** Cheap seasonal touches on a stall: petals, a leaf, snow on whatever is on top. */
function stallSeason(p: Pixmap, opts: SquareOptions, open: boolean): void {
  const W = p.width;
  if (opts.season === 'spring') for (const [x, y] of [[7, 5], [26, 8], [15, 10]] as const) p.set(x, open ? y : 4, 'I');
  if (opts.season === 'autumn') for (const [x, y] of [[9, 6], [30, 9]] as const) p.set(x, open ? y : 5, 'o').set(x + 1, open ? y : 5, 'R');
  if (opts.season !== 'winter') return;
  const deep = opts.snowedIn;
  for (let x = 0; x < W; x++) {
    let y0 = 0;
    while (y0 < 28 && !p.isSet(x, y0)) y0++;
    if (y0 >= 28) continue;
    const d = deep ? 3 + Math.round(valueNoise(x, 0, 5, 102) * 4) + (open ? 0 : 1) : 1 + (valueNoise(x, 0, 4, 103) > 0.5 ? 1 : 0) + (open ? 0 : 1);
    for (let j = 0; j < d; j++) {
      const y = y0 + j;
      if (!p.isSet(x, y)) break;
      snowPx(p, x, y, 0.75 - j * 0.07 + (x < W / 2 ? 0.05 : 0));
    }
    // The shut tarps carry a full blanket, as in the winter concept.
    if (!open) for (let y = 11; y < 22; y++) if (p.isSet(x, y) && cellRandom(x, y, 106) > (deep ? 0.05 : 0.35)) snowPx(p, x, y, 0.6 + (y < 14 ? 0.15 : 0));
  }
  if (deep) {
    for (let x = 0; x < W; x++) {
      const d = 2 + Math.round(valueNoise(x, 4, 5, 104) * 3);
      for (let j = 0; j < d; j++) snowPx(p, x, 30 - j, 0.55 + (j === d - 1 ? 0.2 : 0));
    }
  }
}

// ---------------------------------------------------------------- the fountain, the cart, the fire pit

/** Where the fountain's orb glows in its sprite. */
const ORB = { x: 28, y: 13 };

/** The moon fountain on its dais: three round steps, potted plants, a glowing orb, a gold crescent. 56x52. */
function well(opts: SquareOptions & { open: boolean }): Pixmap {
  const p = new Pixmap(56, 52);
  const cx = 28;
  const frozen = opts.snowedIn && opts.season === 'winter';
  const winter = opts.season === 'winter';
  // The steps, bottom to top: each a round top face over a short front face.
  for (const [cy, rx, ry] of [[40, 26, 10], [34, 19, 7.5], [28, 12, 5]] as const) {
    for (let y = Math.floor(cy - ry); y <= cy + ry + 3; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const top = dx * dx + ((y + 0.5 - cy) / ry) ** 2 <= 1;
        const face = !top && y > cy && dx * dx + ((y + 0.5 - (cy + 3)) / ry) ** 2 <= 1;
        if (face) {
          const block = Math.floor((x + (y % 2) * 3) / 6);
          p.set(x, y, (x + (y % 2) * 3) % 6 === 0 ? 'k' : y === Math.floor(cy + ry + 3) ? 'k' : cellRandom(block, cy, 115) > 0.5 ? 's' : 'S');
          continue;
        }
        if (!top) continue;
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
        const block = Math.floor(((a + Math.PI) / (Math.PI * 2)) * (rx > 20 ? 22 : 14));
        const joint = Math.floor(((Math.atan2(y + 0.5 - cy, x + 1.5 - cx) + Math.PI) / (Math.PI * 2)) * (rx > 20 ? 22 : 14)) !== block;
        const rim = dx * dx + ((y + 0.5 - cy) / ry) ** 2 > 0.7;
        if (winter && !joint && cellRandom(block, rx, 113) > (frozen ? 0.05 : 0.3)) p.set(x, y, rim ? 'e' : 'm');
        else p.set(x, y, joint && rim ? 'k' : rim ? (x < cx ? 'e' : 'S') : cellRandom(block, rx, 112) > 0.5 ? 'S' : 's');
      }
    }
  }
  // The pedestal and the bowl that holds the orb.
  for (let y = 16; y < 30; y++) for (let x = cx - 3; x <= cx + 3; x++) flat(p, x, y, STONE, 0.42 + (cx - x) * 0.06 + (y % 4 === 0 ? -0.1 : 0));
  for (let y = 16; y < 22; y++) {
    for (let x = cx - 8; x <= cx + 8; x++) {
      const dx = (x + 0.5 - cx) / 8;
      const dy = (y + 0.5 - 18) / 2.8;
      if (dx * dx + dy * dy > 1) continue;
      flat(p, x, y, STONE, 0.5 + (cx - x) * 0.02 - (y - 16) * 0.05);
    }
  }
  if (winter) for (let x = cx - 7; x <= cx + 7; x++) if (cellRandom(x, 1, 114) > 0.3) p.set(x, 16, 'm');
  // The orb: deep blue at the rim to pale at the heart, a glint top-left.
  for (let y = ORB.y - 6; y <= ORB.y + 6; y++) {
    for (let x = ORB.x - 6; x <= ORB.x + 6; x++) {
      const d = Math.hypot(x + 0.5 - (ORB.x + 0.5), y + 0.5 - (ORB.y + 0.5));
      if (d > 5.6) continue;
      const swirl = Math.sin((x - ORB.x) * 0.9 + (y - ORB.y) * 1.3) > 0.6;
      p.set(x, y, d > 4.8 ? 'u' : d < 2 ? 'c' : swirl ? 'c' : 'U');
    }
  }
  p.set(ORB.x - 2, ORB.y - 3, 'W').set(ORB.x - 3, ORB.y - 2, 'W').set(ORB.x - 2, ORB.y - 2, 'c');
  // The gold crescent above it.
  for (let y = 0; y < 8; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      const o = Math.hypot(x + 0.5 - cx, y + 0.5 - 4);
      const i = Math.hypot(x + 0.5 - (cx + 1.8), y + 0.5 - 3.1);
      if (o <= 3.9 && i > 3.1) p.set(x, y, o > 3.2 ? 'n' : 'y');
    }
  }
  // Potted plants round the middle step, and two little lanterns at the foot.
  for (const [x, y] of [[11, 33], [45, 33], [17, 40], [39, 40]] as const) {
    p.fillRect(x - 3, y, 7, 4, 'B').hline(x - 3, x + 3, y, 'n').hline(x - 3, x + 3, y + 3, 'b');
    bush(p, x, y - 2, 4.5, 3.5, opts.season);
  }
  for (const x of [8, 48]) lanternPx(p, x, 41, true);
  if (opts.open) {
    // The Black Market: a dark cloth hung over the front of the bottom step, shady goods along it,
    // and its keeper, a hooded shape, sitting on the far side.
    for (let x = 18; x < 36; x++) {
      const hang = 48 + Math.round(Math.sin((x - 18) * 0.5) * 1.2) + (x > 22 && x < 31 ? 2 : 0);
      for (let y = 42; y <= Math.min(51, hang); y++) p.set(x, y, y === hang ? 'P' : (x - 18) % 4 === 0 ? 'k' : (x - 18) % 4 === 1 ? 'P' : 'p');
      p.set(x, 41, 'p');
    }
    p.fillRect(20, 37, 2, 4, 'g').set(20, 37, 'l').set(20, 36, 'k');
    p.fillRect(24, 38, 2, 3, 'P').set(24, 38, 'v').set(24, 37, 'k');
    p.fillRect(28, 38, 3, 3, 'm').set(28, 39, 'K').set(30, 39, 'K').set(29, 40, 'e');
    p.fillEllipse(34, 39.5, 1.5, 1.5, 'B').set(34, 38, 'n');
    for (let y = 20; y < 40; y++) {
      const half = y < 26 ? 2 + Math.sqrt(Math.max(0, (y - 19) * 1.6)) : Math.min(6, 4.2 + (y - 26) * 0.3);
      for (let x = Math.floor(49 - half); x <= 49 + half; x++) {
        const edge = x <= 49 - half + 0.8 || x >= 49 + half - 0.8;
        p.set(x, y, edge ? 'K' : x < 48 ? 'p' : 'k');
      }
    }
    p.fillEllipse(49.5, 25, 2, 2.2, 'K').set(48, 25, 'v').set(50, 25, 'v');
    p.set(44, 36, 'e').set(45, 36, 'm');
  }
  return p;
}

/** The Wandering Tinker's cart and trinkets, over the rug laid by the lane (the ground draws the rug). */
function rugSprite(opts: SquareOptions & { open: boolean }): Pixmap {
  const p = new Pixmap(40, 28);
  if (!opts.open) {
    // Just the pegs where the Tinker pitches.
    for (const [x, y] of [[5, 11], [36, 11], [5, 27], [36, 27]] as const) p.set(x, y, 'b').set(x, y - 1, 'B');
    return p;
  }
  // The cart at the back: a box under a canvas hood on a big wheel.
  p.fillRect(8, 3, 22, 10, 'B');
  for (let x = 8; x < 30; x++) p.set(x, 3, 'n').set(x, 12, 'b');
  for (let y = 0; y < 6; y++) for (let x = 9 + (y < 1 ? 2 : 0); x < 29 - (y < 1 ? 2 : 0); x++) flat(p, x, y, ['q', 'J', 'h', 'H', 'a'], 0.55 - y * 0.05 + ((x - 9) % 5 === 0 ? -0.15 : 0));
  p.fillEllipse(10, 12, 3.5, 3.5, 'k').fillEllipse(10, 12, 2, 2, 'B').set(10, 12, 'n');
  p.set(30, 10, 'b').set(31, 11, 'b').set(32, 12, 'b');
  // Trinkets on the rug: a kettle, a clock, a little mirror, a bundle of spoons.
  p.fillRect(8, 19, 4, 3, 'S').set(12, 20, 'S').set(9, 18, 'e').set(8, 19, 'e');
  p.fillEllipse(30.5, 19.5, 2.5, 2.5, 'n').set(30, 19, 'w').set(31, 19, 'k');
  p.fillRect(16, 21, 3, 3, 'c').strokeRect(15, 20, 5, 5, 'n');
  for (const x of [24, 25, 26]) p.set(x, 22, 'e').set(x, 21, 'S');
  lanternPx(p, 28, 4, true);
  if (opts.season === 'winter') for (let x = 9; x < 29; x++) if (cellRandom(x, 0, 121) > 0.2) snowPx(p, x, 0, 0.7);
  return p;
}

/** Where the fire pit's ring centres in its sprite; the flames sit over it. */
const FIRE_RING = { x: 20, y: 15 };

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

// ---------------------------------------------------------------- festivals

/** The fairs' wares on the counter (GDD §4.2): each draws itself with its bottom on `top`. */
function fairWares(p: Pixmap, id: string, top: number): void {
  switch (id) {
    case 'flower-grower':
      // Buckets of cut flowers in every colour.
      [['I', 'i', 5], ['y', 'W', 13], ['U', 'c', 21], ['W', 'I', 29]].forEach(([k1, k2, x]) => {
        const bx = x as number;
        p.fillRect(bx, top - 2, 5, 3, 'S').hline(bx, bx + 4, top - 2, 'e');
        for (let i = 0; i < 5; i++) p.set(bx + i, top - 3 - (i % 2), i % 2 ? (k1 as PaletteKey) : (k2 as PaletteKey)).set(bx + i, top - 4 - (i % 2), i === 2 ? (k1 as PaletteKey) : 'G');
      });
      break;
    case 'beekeeper':
      // A straw skep, honey jars, a candle.
      for (let y = 0; y < 6; y++) p.hline(6 + Math.floor(y / 2), 14 - Math.floor(y / 2), top - y, y % 2 ? 'n' : 'y');
      p.set(10, top - 1, 'k');
      for (const x of [18, 23]) p.fillRect(x, top - 3, 4, 4, 'y').hline(x, x + 3, top - 4, 'w').set(x, top - 2, 'Y');
      p.fillRect(29, top - 5, 2, 6, 'w').set(29, top - 6, 'y').set(30, top - 7, 'Y');
      break;
    case 'garland-weaver':
      // Wreaths of may blossom on the counter, one hung from the awning.
      for (const cx of [10, 20, 29]) {
        for (let a = 0; a < 12; a++) {
          const x = Math.round(cx + Math.cos((a / 12) * Math.PI * 2) * 3.4);
          const y = Math.round(top - 2 + Math.sin((a / 12) * Math.PI * 2) * 1.6);
          p.set(x, y, a % 3 === 0 ? 'I' : a % 3 === 1 ? 'W' : 'G');
        }
      }
      for (let a = 0; a < 10; a++) p.set(Math.round(20 + Math.cos((a / 10) * Math.PI * 2) * 3), Math.round(16 + Math.sin((a / 10) * Math.PI * 2) * 2), a % 2 ? 'I' : 'l');
      break;
    case 'orchard-keeper':
      // Baskets of peaches, cherries and plums.
      for (const [x, k, l] of [[5, 'o', 'y'], [15, 'R', 'r'], [25, 'P', 'v']] as const) {
        p.fillRect(x, top - 2, 9, 3, 'n').hline(x, x + 8, top, 'B');
        for (let i = 1; i < 8; i++) p.set(x + i, top - 3, i % 2 ? k : l).set(x + i, top - 4, i > 2 && i < 6 ? k : 'k');
      }
      break;
    case 'glassblower':
      // Bottles and jars that catch the light, a lens on a stand.
      [['c', 6, 6], ['t', 10, 4], ['U', 14, 5], ['L', 24, 4], ['c', 28, 6]].forEach(([k, x, h]) => {
        const bx = x as number;
        const bh = h as number;
        p.fillRect(bx, top - bh + 1, 3, bh, k as PaletteKey).set(bx + 1, top - bh, 'm').set(bx, top - bh + 2, 'W');
      });
      p.fillEllipse(19.5, top - 4, 2.5, 2.5, 'c').set(19, top - 5, 'W').set(19, top - 1, 'S').set(19, top, 'S');
      break;
    case 'hatter':
      // Straw hats with ribbons, a linen bonnet.
      for (const [x, k] of [[5, 'R'], [16, 'U'], [27, 'i']] as const) {
        p.hline(x, x + 8, top, 'n').hline(x + 2, x + 6, top - 1, 'y').hline(x + 2, x + 6, top - 2, k).hline(x + 3, x + 5, top - 3, 'y');
      }
      break;
    case 'farmer':
      // A pumpkin, sacks of grain, a basket of apples.
      p.fillEllipse(9, top - 2, 4, 3, 'o').set(9, top - 5, 'G').set(7, top - 3, 'y');
      for (const x of [16, 21]) p.fillRect(x, top - 4, 4, 5, 'a').hline(x + 1, x + 2, top - 5, 'n').set(x + 1, top - 3, 'H');
      p.fillRect(27, top - 1, 7, 2, 'B');
      for (let i = 0; i < 7; i++) p.set(27 + i, top - 2, i % 2 ? 'R' : 'r');
      break;
    case 'cider-maker':
      // Two barrels, mugs of cider, a jug.
      for (const x of [5, 27]) {
        p.fillRect(x, top - 6, 8, 7, 'B').hline(x, x + 7, top - 6, 'n');
        for (const y of [top - 4, top - 1]) p.hline(x, x + 7, y, 'S');
        p.set(x + 2, top - 3, 'n');
      }
      for (const x of [15, 19]) p.fillRect(x, top - 2, 3, 3, 'n').set(x + 3, top - 1, 'n').hline(x, x + 2, top - 2, 'y');
      p.fillRect(23, top - 3, 2, 4, 'w').set(23, top - 4, 'a');
      break;
    case 'straw-weaver':
      // Corn dollies standing up, a woven basket, a wreath of wheat.
      for (const x of [6, 11]) {
        for (let y = 0; y < 7; y++) p.set(x + (y < 2 ? 0 : y % 2), top - y, y < 2 ? 'n' : 'y');
        p.set(x - 1, top - 6, 'y').set(x + 2, top - 6, 'y').set(x, top - 7, 'Y');
      }
      p.fillRect(16, top - 2, 7, 3, 'n');
      for (let x = 16; x < 23; x++) p.set(x, top - 2 + (x % 2), 'y');
      for (let a = 0; a < 12; a++) p.set(Math.round(30 + Math.cos((a / 12) * Math.PI * 2) * 3), Math.round(top - 2 + Math.sin((a / 12) * Math.PI * 2) * 2), a % 2 ? 'y' : 'n');
      break;
    default:
      break;
  }
}

/**
 * The festive dressing where a Night Market stall would stand (Jacob, Oct 21, "festival only"):
 * two looks a season, set out in turn round the square. 40x32, like a stall.
 */
function decor(h: Home, opts: SquareOptions): Pixmap {
  const p = new Pixmap(40, 32);
  const first = decorFirst(h.id, opts.place ?? 'market');
  const season = opts.season;
  // Shadow on the cobbles.
  for (let x = 4; x < 36; x++) if ((x & 1) === 0) p.set(x, 30, 'K');
  if (first && season === 'spring') maypole(p);
  else if (first && season === 'summer') fireflyPosts(p);
  else if (first && season === 'autumn') hayBales(p);
  else if (first) yuleTree(p);
  else festiveTable(p, season);
  stallSeason(p, opts, true);
  return p;
}

/** Which of a season's two looks stands at a home, so they alternate round the square. */
function decorFirst(id: HomeId, place: SquarePlace): boolean {
  return place === 'vigil' ? id === 'lantern' || id === 'east' || id === 'moth' : id === 'lantern' || id === 'tailor';
}

/** A maypole: ribbons from a flower crown down to pegs, a ring of blossom at its foot. */
function maypole(p: Pixmap): void {
  const cx = 20;
  const ribbons: readonly PaletteKey[] = ['I', 'U', 'y', 'l', 'i', 'c'];
  [3, 9, 14, 26, 31, 37].forEach((fx, i) => {
    const k = ribbons[i]!;
    for (let t = 0; t <= 1; t += 0.04) p.set(Math.round(cx + (fx - cx) * t), Math.round(4 + (27 - 4) * t + Math.sin(t * Math.PI) * 2), k);
    p.set(fx, 28, 'b');
  });
  for (let y = 2; y < 29; y++) p.set(cx, y, 'w').set(cx + 1, y, y % 4 < 2 ? 'I' : 'a');
  for (let a = 0; a < 10; a++) p.set(Math.round(cx + 0.5 + Math.cos((a / 10) * Math.PI * 2) * 3), Math.round(3 + Math.sin((a / 10) * Math.PI * 2) * 1.2), a % 2 ? 'I' : 'G');
  p.set(cx, 0, 'y').set(cx + 1, 0, 'y').set(cx, 1, 'n');
  for (let a = 0; a < 16; a++) p.set(Math.round(cx + 0.5 + Math.cos((a / 16) * Math.PI * 2) * 5), Math.round(28 + Math.sin((a / 16) * Math.PI * 2) * 1.6), a % 3 ? 'G' : a % 2 ? 'I' : 'W');
}

/** Three posts strung with jars of fireflies. */
function fireflyPosts(p: Pixmap): void {
  for (const px of [6, 20, 33]) {
    for (let y = 4; y < 29; y++) p.set(px, y, 'b').set(px + 1, y, 'B');
    p.hline(px - 1, px + 2, 28, 'b');
  }
  // A rope between them, jars hanging off it.
  for (let x = 7; x < 33; x++) p.set(x, 5 + Math.round(Math.sin(((x - 7) % 13) / 13 * Math.PI) * 3), 'k');
  for (const [x, y] of [[11, 8], [16, 9], [25, 9], [29, 8]] as const) {
    p.set(x, y, 'k').fillRect(x - 1, y + 1, 3, 4, 'u').hline(x - 1, x + 1, y + 1, 'S');
    p.set(x, y + 2, 'L').set(x - 1, y + 3, 'Y');
  }
  for (const px of [6, 20, 33]) p.fillRect(px - 1, 1, 4, 4, 'u').hline(px - 1, px + 2, 1, 'S').set(px, 2, 'Y').set(px + 1, 3, 'L');
}

/** Hay bales stacked two high, pumpkins and a scarecrow keeping watch. */
function hayBales(p: Pixmap): void {
  const bale = (x: number, y: number, w: number) => {
    for (let j = 0; j < 6; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, j === 0 ? 'Y' : j === 5 ? 'n' : (i + j * 2) % 5 === 0 ? 'n' : 'y');
    p.set(x + 3, y + 1, 'B').set(x + 3, y + 4, 'B').set(x + w - 4, y + 1, 'B').set(x + w - 4, y + 4, 'B');
  };
  // The scarecrow behind: a cross of sticks, a sack head, a straw hat.
  for (let y = 4; y < 22; y++) p.set(29, y, 'b');
  p.hline(23, 35, 11, 'b').fillRect(26, 10, 7, 7, 'r').hline(26, 32, 12, 'R');
  p.fillEllipse(29.5, 6.5, 2.5, 2.5, 'a').set(28, 6, 'k').set(31, 6, 'k').hline(26, 33, 4, 'n').hline(27, 32, 3, 'y');
  bale(4, 18, 14);
  bale(18, 18, 14);
  bale(10, 12, 14);
  pumpkin(p, 7, 30, 3.5, 2.6);
  pumpkin(p, 34, 30, 3, 2.2);
  pumpkin(p, 17, 12, 2.5, 2);
}

/** A little fir hung with candles and red ribbon, for the Longest Night. */
function yuleTree(p: Pixmap): void {
  const cx = 20;
  for (let y = 2; y < 26; y++) {
    const tier = (y - 2) % 8;
    const half = Math.min(14, 2 + tier * 1.2 + (y - 2) * 0.35);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) p.set(x, y, x < cx - half + 1.5 ? 'g' : (x + y) % 5 === 0 ? 'G' : x > cx ? 'g' : 'G');
  }
  p.fillRect(cx - 2, 26, 4, 3, 'b').fillRect(cx - 5, 28, 10, 2, 'r').hline(cx - 5, cx + 4, 28, 'R');
  for (const [x, y] of [[cx, 7], [cx - 5, 13], [cx + 5, 12], [cx - 8, 20], [cx + 7, 21], [cx - 1, 18], [cx + 2, 24], [cx - 4, 24]] as const) p.set(x, y, 'W').set(x, y - 1, 'Y');
  for (let x = cx - 9; x < cx + 9; x++) p.set(x, 16 + Math.round((x - cx) * 0.25), 'R');
  p.set(cx, 0, 'y').set(cx - 1, 1, 'y').set(cx + 1, 1, 'y').set(cx, 1, 'Y').set(cx, 2, 'y');
}

/** A trestle table with a cloth and the season's food and drink, a bench before it. */
function festiveTable(p: Pixmap, season: Season): void {
  const cloth: PaletteKey = season === 'spring' ? 'W' : season === 'summer' ? 'w' : season === 'autumn' ? 'R' : 'r';
  const hem: PaletteKey = season === 'spring' ? 'I' : season === 'summer' ? 'U' : season === 'autumn' ? 'r' : 'j';
  for (let y = 12; y < 20; y++) for (let x = 3; x < 37; x++) p.set(x, y, y === 19 ? hem : (x + y) % 7 === 0 && season !== 'spring' ? hem : cloth);
  for (let y = 20; y < 24; y++) for (let x = 4; x < 36; x++) if (x % 3 !== 0) p.set(x, y, hem);
  for (const lx of [5, 33]) p.fillRect(lx, 24, 2, 4, 'b');
  // The bench in front.
  p.fillRect(6, 26, 28, 2, 'n').hline(6, 33, 28, 'b').set(8, 29, 'b').set(31, 29, 'b');
  const top = 13;
  if (season === 'spring') {
    // Cakes with icing, a vase of blossom.
    for (const x of [7, 26]) p.fillRect(x, top - 3, 6, 3, 'a').hline(x, x + 5, top - 3, 'W').set(x + 2, top - 4, 'I').set(x + 3, top - 4, 'R');
    p.fillRect(18, top - 3, 3, 4, 'c');
    for (const [x, y] of [[17, 7], [19, 6], [21, 7], [18, 5], [20, 8]] as const) p.set(x, y, 'I');
  } else if (season === 'summer') {
    // A jug of lemonade, cups, a bowl of fruit.
    p.fillRect(8, top - 5, 4, 5, 'y').set(8, top - 4, 'Y').set(12, top - 3, 'w');
    for (const x of [15, 18]) p.fillRect(x, top - 2, 2, 2, 'c');
    p.fillEllipse(27, top - 1, 4.5, 2, 'n');
    for (const [x, k] of [[24, 'R'], [26, 'o'], [28, 'P'], [30, 'l'], [27, 'y']] as const) p.set(x, top - 3, k).set(x, top - 2, k);
  } else if (season === 'autumn') {
    // Pies, a loaf, cider mugs.
    for (const x of [6, 25]) p.fillEllipse(x + 3, top - 1.5, 3.5, 1.8, 'n').hline(x + 1, x + 5, top - 2, 'a').set(x + 3, top - 2, 'B');
    p.fillEllipse(19, top - 2, 3, 2, 'H').set(18, top - 3, 'a');
    for (const x of [13, 33]) p.fillRect(x, top - 3, 2, 3, 'n').set(x, top - 3, 'y');
  } else {
    // A pot of mulled wine steaming, cups, a plate of gingerbread.
    p.fillRect(16, top - 5, 8, 5, 'k').hline(16, 23, top - 5, 'S').hline(17, 22, top - 4, 'r');
    for (const [x, y] of [[18, 4], [20, 3], [21, 5]] as const) p.set(x, y, 'e');
    for (const x of [8, 11, 28]) p.fillRect(x, top - 2, 2, 2, 'w');
    p.fillEllipse(32, top - 1, 3, 1.4, 'm');
    for (const x of [31, 33]) p.set(x, top - 2, 'B');
    // Evergreen laid along the cloth.
    for (let x = 4; x < 36; x += 2) p.set(x, 12, x % 4 ? 'G' : 'g');
  }
}

/** The Solstice Fire on the fountain's bottom step: a ring of stones, logs stacked tall. 48x30. */
function bonfire(opts: SquareOptions): Pixmap {
  const p = new Pixmap(48, 30);
  const cx = 24;
  const cy = 18;
  for (let y = 8; y < 30; y++) {
    for (let x = 0; x < 48; x++) {
      const dx = (x + 0.5 - cx) / 20;
      const dy = (y + 0.5 - cy) / 8;
      const face = (y + 0.5 - (cy + 3)) / 8;
      const outer = dx * dx + dy * dy <= 1;
      const front = !outer && y > cy && dx * dx + face * face <= 1;
      const ix = (x + 0.5 - cx) / 15;
      const iy = (y + 0.5 - cy) / 5.5;
      if (front) {
        flat(p, x, y, STONE, 0.2 + (x % 5 === 0 ? -0.12 : 0));
        continue;
      }
      if (!outer) continue;
      if (ix * ix + iy * iy <= 1) {
        p.set(x, y, cellRandom(x, y, 151) > 0.7 ? 'R' : cellRandom(x, y, 152) > 0.5 ? 'o' : 'b');
        continue;
      }
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      const stone = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16);
      const joint = Math.floor(((Math.atan2(y + 0.5 - cy, x + 1.5 - cx) + Math.PI) / (Math.PI * 2)) * 16) !== stone;
      if (opts.season === 'winter' && y < cy - 2 && !joint) snowPx(p, x, y, 0.7);
      else p.set(x, y, joint ? 'k' : y > cy + 2 ? 's' : cellRandom(stone, 0, 153) > 0.5 ? 'e' : 'S');
    }
  }
  // Logs leaned together in a cone over the embers.
  for (const [x0, x1] of [[12, 22], [36, 26], [16, 23], [32, 25], [20, 24], [28, 24]] as const) {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(cy + 2 - 14 * t);
      p.set(x, y, 'B').set(x + 1, y, 'b');
    }
  }
  return p;
}

/** The Solstice Fire's flames, 3 frames, 28x22. Drawn at (10, 0) in the bonfire's sprite. */
export function bonfireFlames(frame: 0 | 1 | 2): Pixmap {
  const p = new Pixmap(28, 22);
  const tongues = (
    [
      [[5, 9], [10, 16], [14, 21], [19, 15], [23, 10]],
      [[4, 11], [9, 18], [14, 19], [18, 17], [24, 9]],
      [[6, 8], [11, 15], [15, 22], [20, 14], [23, 12]],
    ] as const
  )[frame];
  for (const [cx, h] of tongues) {
    for (let j = 0; j < h; j++) {
      const half = Math.max(0, Math.round((1 - j / h) * 3.4));
      for (let i = -half; i <= half; i++) {
        const core = Math.abs(i) < half - 0.5 && j < h * 0.6;
        p.set(cx + i, 21 - j, core ? (j < h * 0.3 ? 'W' : 'Y') : j > h * 0.72 ? 'R' : 'o');
      }
    }
  }
  return p;
}

/** The table of gifts by the lane at the vigil: one wrapped parcel for each regular who brought one. 32x22. */
function giftTable(opts: SquareOptions): Pixmap {
  const p = new Pixmap(32, 22);
  for (let x = 2; x < 30; x++) if ((x & 1) === 0) p.set(x, 21, 'K');
  for (let y = 8; y < 13; y++) for (let x = 1; x < 31; x++) flat(p, x, y, WOOD, 0.55 - (y - 8) * 0.06);
  p.hline(1, 30, 13, 'b');
  for (let y = 14; y < 18; y++) for (let x = 2; x < 30; x++) if (x % 4 !== 0) p.set(x, y, 'B');
  for (const lx of [3, 27]) p.fillRect(lx, 18, 2, 3, 'b');
  const wraps: readonly [PaletteKey, PaletteKey][] = [['r', 'y'], ['G', 'R'], ['u', 'W'], ['P', 'y'], ['R', 'w'], ['T', 'y']];
  const n = Math.min(6, opts.gifts ?? 0);
  for (let i = 0; i < n; i++) {
    const [k, ribbon] = wraps[i]!;
    const x = 3 + i * 4.5;
    const h = 4 + (i % 2);
    const bx = Math.round(x);
    p.fillRect(bx, 10 - h, 4, h, k).set(bx + 1, 10 - h, ribbon).set(bx + 2, 10 - h, ribbon);
    for (let y = 10 - h; y < 10; y++) p.set(bx + 2, y, ribbon);
    p.set(bx + 1, 9 - h, ribbon).set(bx + 3, 9 - h, ribbon);
  }
  // A candle at each end.
  for (const x of [2, 29]) p.fillRect(x, 4, 1, 4, 'w').set(x, 3, 'Y');
  if (opts.season === 'winter') for (let x = 1; x < 31; x++) if (cellRandom(x, 2, 154) > 0.45 && !p.isSet(x, 7)) snowPx(p, x, 8, 0.7);
  return p;
}

/** Where the festoons hang from: the fountain's crescent, out to the stalls round the square. */
const FESTOON_HUB = { x: 160, y: 58 };
const FESTOON_ENDS: readonly (readonly [number, number])[] = [[62, 38], [258, 40], [50, 74], [270, 76], [104, 108], [216, 108]];

/** A string's sag: the point at t along a rope from a to b. */
function ropeAt(a: readonly [number, number], b: readonly [number, number], t: number, sag: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag];
}

/**
 * Bunting, or at the vigil strings of little lanterns, from the fountain's crescent out over the
 * square. Hung above everything, so it is its own layer. 320x180, mostly clear.
 */
export function squareFestoons(opts: SquareOptions): Pixmap {
  const p = new Pixmap(SQUARE_W, SQUARE_H);
  if ((opts.place ?? 'market') === 'market') return p;
  const flags: readonly PaletteKey[] =
    opts.season === 'spring' ? ['I', 'W', 'l', 'U', 'y'] : opts.season === 'summer' ? ['y', 'o', 'W', 'c', 'R'] : opts.season === 'autumn' ? ['o', 'R', 'y', 'B', 'n'] : ['R', 'G', 'W'];
  const lanterns = opts.place === 'vigil' || opts.season === 'summer';
  for (const end of FESTOON_ENDS) {
    const hub: [number, number] = [FESTOON_HUB.x, FESTOON_HUB.y];
    const len = Math.hypot(end[0] - hub[0], end[1] - hub[1]);
    const sag = len / 9;
    let last = -99;
    for (let i = 0; i <= len * 1.5; i++) {
      const t = i / (len * 1.5);
      const [x, y] = ropeAt(hub, end, t, sag);
      p.set(Math.round(x), Math.round(y), 'k');
      const at = t * len;
      if (at - last < 6 || at < 6 || at > len - 4) continue;
      last = at;
      const n = Math.round(at / 6);
      const fx = Math.round(x);
      const fy = Math.round(y) + 1;
      if (lanterns && n % 2 === 0) p.set(fx, fy, 'k').set(fx, fy + 1, 'Y').set(fx, fy + 2, 'y');
      else if (opts.place === 'fair') {
        const k = flags[n % flags.length]!;
        p.set(fx - 1, fy, k).set(fx, fy, k).set(fx + 1, fy, k).set(fx - 1, fy + 1, k).set(fx, fy + 1, k).set(fx + 1, fy + 1, k).set(fx, fy + 2, k);
      } else if (opts.place === 'vigil' && n % 2) p.set(fx, fy, flags[n % flags.length]!);
    }
  }
  return p;
}

/** The little lanterns on the festoons, for glows: summer's fair and the vigil hang lanterns on every other knot. */
function festoonLights(opts: SquareOptions): { x: number; y: number }[] {
  if (opts.place === 'fair' && opts.season !== 'summer') return [];
  if (opts.place !== 'fair' && opts.place !== 'vigil') return [];
  const out: { x: number; y: number }[] = [];
  for (const end of FESTOON_ENDS) {
    const hub: [number, number] = [FESTOON_HUB.x, FESTOON_HUB.y];
    const len = Math.hypot(end[0] - hub[0], end[1] - hub[1]);
    for (let at = 12; at < len - 4; at += 12) {
      const [x, y] = ropeAt(hub, end, at / len, len / 9);
      out.push({ x: Math.round(x), y: Math.round(y) + 2 });
    }
  }
  return out;
}

// ---------------------------------------------------------------- exports

/** One home's sprite, sized to HOMES[id].size. `stall` is the codex stall id standing there tonight (or null if none: shuttered/empty). */
export function homeSprite(id: HomeId, opts: SquareOptions & { open: boolean; stall: string | null }): Pixmap {
  const h = homeOf(id);
  const o = { ...opts, snowedIn: opts.snowedIn && opts.season === 'winter' };
  switch (h.kind) {
    case 'stall':
      return (o.place ?? 'market') !== 'market' && !o.open ? decor(h, o) : stall(h, o);
    case 'bonfire':
      return bonfire(o);
    case 'table':
      return giftTable(o);
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

/** Lights for glows, square pixels: lanterns of open stalls, the fire if lit, the fountain's orb, the house windows, the gate and the dock. */
export function squareLights(open: ReadonlySet<HomeId>, opts: SquareOptions): readonly { x: number; y: number; radius: number; color: 'y' | 'o' | 'L' | 'v' }[] {
  const out: { x: number; y: number; radius: number; color: 'y' | 'o' | 'L' | 'v' }[] = [];
  const place = opts.place ?? 'market';
  for (const h of homesFor(place)) {
    if (h.kind === 'well') out.push({ x: h.at.x + ORB.x, y: h.at.y + ORB.y, radius: 24, color: 'v' });
    // Festive dressing that glows: summer's firefly jars, the vigil's candlelit firs.
    const first = decorFirst(h.id, place);
    if (place !== 'market' && h.kind === 'stall' && !open.has(h.id) && first) {
      if (opts.season === 'summer') out.push({ x: h.at.x + 20, y: h.at.y + 8, radius: 20, color: 'L' });
      if (opts.season === 'winter') out.push({ x: h.at.x + 20, y: h.at.y + 16, radius: 22, color: 'y' });
    }
    if (h.kind === 'bonfire') out.push({ x: h.at.x + 24, y: h.at.y + 10, radius: 76, color: 'o' });
    if (h.kind === 'table') out.push({ x: h.at.x + 16, y: h.at.y + 6, radius: 16, color: 'y' });
    if (!open.has(h.id)) continue;
    if (h.kind === 'stall') {
      const l = stallLantern(h);
      out.push({ x: h.at.x + l.x, y: h.at.y + l.y + 2, radius: 30, color: 'y' });
    } else if (h.kind === 'well') out.push({ x: h.at.x + 49, y: h.at.y + 30, radius: 22, color: 'v' });
    else if (h.kind === 'rug') out.push({ x: h.at.x + 28, y: h.at.y + 6, radius: 22, color: 'y' });
    else if (h.kind === 'fire') out.push({ x: h.at.x + FIRE_RING.x, y: h.at.y + FIRE_RING.y - 2, radius: 50, color: 'o' });
  }
  for (const l of festoonLights(opts)) out.push({ ...l, radius: 8, color: 'y' });
  for (const w of LIT_WINDOWS) out.push({ x: w.x, y: w.y, radius: 16, color: 'o' });
  for (const px of POLES) out.push({ x: px, y: POLE_TOP, radius: 20, color: 'y' });
  for (const lx of [POLES[0] + 12, POLES[1] - 11]) out.push({ x: lx, y: POLE_TOP + 8, radius: 14, color: 'y' });
  out.push({ x: 258, y: 162, radius: 18, color: 'y' });
  if (opts.season === 'summer') for (const [x, y] of FIREFLIES) out.push({ x, y, radius: 6, color: 'L' });
  return out;
}

/** The moon over the square tonight: a full moon is the brightest night, a new moon the darkest. */
export type SquareMoon = 'full-moon' | 'quarter' | 'new-moon';

/** How dark the square is away from any light, by moon (Jacob, Oct 21: darker, so the lanterns matter). */
export const MOON_SHADE: Record<SquareMoon, number> = { 'full-moon': 0.22, quarter: 0.36, 'new-moon': 0.5 };

/** How deep the dusk is at a fair, away from any light. */
export const TWILIGHT_SHADE = 0.14;

/**
 * Night laid over the square, under the glows: deep blue-black whose depth follows the moon and
 * falls away near every light, stepped in eighths with an ordered dither so it stays pixel art.
 * RGBA at the square's own 320x180.
 */
export function squareShade(open: ReadonlySet<HomeId>, opts: SquareOptions, moon: SquareMoon): { width: number; height: number; data: Uint8ClampedArray } {
  const w = 320;
  const h = 180;
  const data = new Uint8ClampedArray(w * h * 4);
  const lights = squareLights(open, opts).filter((l) => l.radius >= 14);
  // A fair is held at twilight: a thin violet dusk rather than the night's blue-black.
  const twilight = opts.place === 'fair';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(PALETTE[twilight ? 'p' : 'K'].slice(i, i + 2), 16)) as [number, number, number];
  // Snow throws the moonlight back, so a winter night needs a little more dark to read as night.
  const max = twilight ? TWILIGHT_SHADE : MOON_SHADE[moon] + (opts.season === 'winter' ? 0.1 : 0);
  const STEPS = 8;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let lit = 0;
      for (const l of lights) {
        const d = Math.hypot(x - l.x, (y - l.y) * 1.15) / (l.radius * 1.6);
        if (d < 1) lit = Math.max(lit, (1 - d) ** 1.4);
      }
      const level = Math.min(STEPS, Math.floor((1 - lit) * STEPS + dither(x, y)));
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round((level / STEPS) * max * 255);
    }
  }
  return { width: w, height: h, data };
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
