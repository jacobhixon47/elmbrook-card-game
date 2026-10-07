import { nextFloat, seedRng, type RngState } from '../../core/rng';
import { PALETTE, RAMPS, type PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';

// The potion shop at night: a room hollowed out of a great elm in the
// tree-town of Elmbrook. Living-wood walls, a round leaded window onto the
// moonlit forest and its lit tree-houses, carved shelves of bottles, drying
// herbs, candle-jar lanterns, and the live-edge counter where cards are played.
// 640x360, deterministic for a seed.

export const SHOP_W = 640;
export const SHOP_H = 360;

/** Warm light sources, in backdrop pixels. Exported so the scene can add glows. */
export const SHOP_LIGHTS = [
  { x: 200, y: 92, radius: 200, power: 1 },
  { x: 440, y: 92, radius: 200, power: 1 },
  { x: 80, y: 140, radius: 110, power: 0.45 },
  { x: 560, y: 150, radius: 110, power: 0.4 },
] as const;

export const SHOP_LANTERNS = [
  { x: 200, y: 92, chain: 70 },
  { x: 440, y: 92, chain: 70 },
] as const;

const WIN = { cx: 320, cy: 116, r: 82 };
export const COUNTER_TOP = 236;

type Rng = { s: RngState };

function rand(r: Rng): number {
  const [f, s] = nextFloat(r.s);
  r.s = s;
  return f;
}

function pick<T>(r: Rng, items: readonly T[]): T {
  return items[Math.floor(rand(r) * items.length)] as T;
}

/** Combined warm light at a point, 0..1. */
export function lightAt(x: number, y: number): number {
  let total = 0;
  for (const l of SHOP_LIGHTS) {
    const d = Math.hypot(x - l.x, (y - l.y) * 1.1) / l.radius;
    total += l.power * Math.max(0, 1 - d) ** 1.5;
  }
  return Math.min(1, total);
}

/** Is (x, y) inside the hollow of the trunk? Outside it is the tree's dark heartwood. */
function inHollow(x: number, y: number): boolean {
  return ((x - 320) / 372) ** 2 + ((y - 380) / 382) ** 2 <= 1;
}

function livingWoodWall(p: Pixmap): void {
  for (let y = 0; y < SHOP_H; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      // Wavy vertical grain lines that bend around the room.
      const wave = x + Math.sin(y / 37 + x / 70) * 7 + Math.sin(y / 11) * 1.5;
      const grain = ((wave % 13) + 13) % 13;
      const line = grain < 1.2 ? -0.18 : grain < 2.2 ? -0.07 : 0;
      const t = 0.08 + lightAt(x, y) * 0.7 + line + Math.sin(wave / 5) * 0.03;
      if (inHollow(x, y)) {
        p.shade(x, y, ['k', 'b', 'B', 'n', 'a'], t);
      } else {
        // Heartwood beyond the arch: near-black with faint growth rings.
        const ring = Math.hypot((x - 320) / 372, (y - 380) / 382);
        p.shade(x, y, ['K', 'k', 'b'], 0.15 + (Math.sin(ring * 90) > 0.6 ? 0.25 : 0) + lightAt(x, y) * 0.25);
      }
    }
  }
  // Arch edge: a lit rim where the hollow meets the heartwood.
  for (let x = 0; x < SHOP_W; x++) {
    for (let y = 0; y < SHOP_H; y++) {
      if (inHollow(x, y) && !inHollow(x, y - 2)) {
        p.set(x, y, 'k');
        p.set(x, y + 1, lightAt(x, y) > 0.35 ? 'n' : 'B');
        break;
      }
    }
  }
  // Knots.
  for (const [kx, ky] of [[168, 210], [520, 60], [600, 200], [58, 104]] as const) {
    for (let ring = 7; ring >= 1; ring -= 2) p.fillEllipse(kx, ky, ring * 1.3, ring, ring % 4 === 1 ? 'b' : 'B');
    p.fillEllipse(kx, ky, 1.5, 1, 'k');
  }
}

function forestView(p: Pixmap, r: Rng): void {
  const { cx, cy, r: R } = WIN;
  const inside = (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= (R - 6) ** 2;
  const top = cy - R;
  const bottom = cy + R;
  const horizon = cy + 26;

  for (let y = top; y <= bottom; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      if (!inside(x, y)) continue;
      const t = (y - top) / (horizon - top);
      if (t < 0.5) p.shade(x, y, ['K', 'z', 'q'], t / 0.5);
      else p.shade(x, y, ['q', 'Q', 'P', 'X'], (t - 0.5) / 0.65);
    }
  }
  for (let i = 0; i < 80; i++) {
    const sx = cx - R + Math.floor(rand(r) * R * 2);
    const sy = top + Math.floor(rand(r) * (horizon - top - 20));
    if (!inside(sx, sy)) continue;
    p.set(sx, sy, pick(r, ['W', 'm', 'c', 'I', 'y', 'v'] as const));
  }
  // Moon with halo.
  const mx = cx + 34;
  const my = cy - 40;
  for (let y = my - 26; y <= my + 26; y++) {
    for (let x = mx - 26; x <= mx + 26; x++) {
      if (!inside(x, y)) continue;
      const d = Math.hypot(x - mx, y - my);
      if (d < 9) p.set(x, y, d < 6.5 ? 'W' : 'Y');
      else if (d < 26) p.shade(x, y, ['q', 'Q', 'P', 'v'], ((26 - d) / 17) ** 1.8 * 0.9);
    }
  }
  // Far hills, moonlit.
  for (let x = cx - R; x <= cx + R; x++) {
    const hill = horizon - 8 + Math.round(Math.sin(x / 23) * 7 + Math.sin(x / 9) * 2);
    for (let y = hill; y <= bottom; y++) if (inside(x, y)) p.shade(x, y, RAMPS.sky, y === hill ? 1 : 0.5 - (y - hill) / 60);
  }
  // Great trees of the town: tapering trunks with root flares, big soft
  // canopies, and a few round lit windows and doors (tree-houses, not towers).
  const trees = [
    { x: cx - 50, w: 16, top: cy - 6 },
    { x: cx + 4, w: 12, top: cy + 8 },
    { x: cx + 54, w: 18, top: cy - 14 },
  ];
  for (const t of trees) {
    for (let y = t.top; y <= bottom; y++) {
      const k = (y - t.top) / (bottom - t.top);
      const half = t.w / 2 * (0.7 + k * 0.3) + (k > 0.75 ? ((k - 0.75) / 0.25) ** 2 * t.w * 0.9 : 0);
      for (let x = Math.round(t.x - half); x <= t.x + half; x++) {
        if (inside(x, y)) p.set(x, y, x < t.x - half / 3 ? 'k' : x > t.x + half * 0.6 ? 'p' : 'q');
      }
    }
    // Canopy: overlapping soft clumps, moonlit on top.
    for (let c = 0; c < 6; c++) {
      const ccx = t.x + (rand(r) - 0.5) * t.w * 2.6;
      const ccy = t.top - 6 + (rand(r) - 0.5) * 14;
      const rr = t.w * (0.7 + rand(r) * 0.5);
      for (let y = Math.floor(ccy - rr); y <= ccy + rr; y++) {
        for (let x = Math.floor(ccx - rr * 1.3); x <= ccx + rr * 1.3; x++) {
          const d = ((x - ccx) / (rr * 1.3)) ** 2 + ((y - ccy) / rr) ** 2;
          if (d > 1 || !inside(x, y)) continue;
          p.shade(x, y, ['K', 'g', 'T', 'x'], 0.25 + (ccy - y) / rr * 0.45 + (rand(r) - 0.5) * 0.2);
        }
      }
    }
    // A round window or two, and a little arched door at the base.
    const wy = Math.round(t.top + (bottom - t.top) * 0.35);
    if (inside(t.x, wy)) p.fillEllipse(t.x, wy, 2.5, 2.5, 'y').set(t.x - 1, wy - 1, 'Y');
    if (rand(r) > 0.4 && inside(t.x, wy + 14)) p.fillEllipse(t.x + 1, wy + 14, 2, 2, 'o');
    const dy = bottom - 16;
    if (inside(t.x, dy)) {
      p.fillRect(t.x - 2, dy - 3, 5, 7, 'o').hline(t.x - 1, t.x + 1, dy - 4, 'o').set(t.x, dy - 2, 'y');
    }
  }
  // A lantern-lit rope bridge between the outer trees.
  for (let x = trees[0]!.x; x <= trees[2]!.x; x++) {
    const sag = Math.round(Math.sin(((x - trees[0]!.x) / (trees[2]!.x - trees[0]!.x)) * Math.PI) * 7);
    const by = cy + 14 + sag;
    if (inside(x, by)) p.set(x, by, 'B');
    if (x % 9 === 0 && inside(x, by - 1)) p.set(x, by - 1, x % 27 === 0 ? 'y' : 'b');
  }
  // Fireflies.
  for (let i = 0; i < 18; i++) {
    const fx = cx - R + Math.floor(rand(r) * R * 2);
    const fy = horizon - 10 + Math.floor(rand(r) * 50);
    if (inside(fx, fy)) p.set(fx, fy, pick(r, ['L', 'y', 'Y'] as const));
  }

  // Leaded panes: a ring and a cross of dark lead.
  for (let y = top; y <= bottom; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      if (!inside(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - 40) < 1 || Math.abs(x - cx) < 1.5 || Math.abs(y - cy) < 1.5) p.set(x, y, 'k');
    }
  }
  // Thick carved frame.
  for (let y = top - 12; y <= bottom + 12; y++) {
    for (let x = cx - R - 12; x <= cx + R + 12; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= R - 6 && d < R + 8) {
        const lit = lightAt(x, y);
        const edge = d < R - 4.5 || d > R + 6.5;
        const bevel = y < cy ? 0.15 : -0.1;
        if (edge) p.set(x, y, 'k');
        else p.shade(x, y, RAMPS.wood, 0.3 + lit * 0.6 + bevel + (Math.abs(d - R) < 1 ? 0.2 : 0));
      }
    }
  }
}

function bottle(p: Pixmap, r: Rng, x: number, baseY: number, tall: boolean): number {
  const glass = pick(r, [
    ['u', 'U', 'c'],
    ['r', 'R', 'I'],
    ['g', 'G', 'l'],
    ['p', 'P', 'v'],
    ['o', 'y', 'Y'],
    ['T', 't', 'c'],
    ['J', 'h', 'H'],
  ] as const);
  const w = tall ? 5 + Math.floor(rand(r) * 3) : 7 + Math.floor(rand(r) * 5);
  const h = tall ? 12 + Math.floor(rand(r) * 8) : 7 + Math.floor(rand(r) * 5);
  const top = baseY - h;
  const neck = tall ? Math.max(2, Math.floor(w / 2) - 1) : w - 2;
  const neckH = tall ? 4 : 1;
  p.fillRect(x, top + neckH, w, h - neckH, glass[1]);
  p.fillRect(x, top + neckH + Math.floor((h - neckH) / 3), w, Math.ceil(((h - neckH) * 2) / 3), glass[0]);
  p.fillRect(x + 1, top + neckH + 1, 1, Math.max(1, h - neckH - 3), glass[2]);
  const nx = x + Math.floor((w - neck) / 2);
  p.fillRect(nx, top, neck, neckH, glass[1]);
  p.fillRect(nx, top - 2, neck, 2, tall ? 'B' : 'n');
  return w;
}

function mushroom(p: Pixmap, x: number, y: number, size: number): void {
  p.fillRect(x - 1, y - size, 3, size, 'w');
  p.fillEllipse(x + 0.5, y - size, size * 0.9 + 1, size * 0.5 + 0.5, 'R');
  p.set(x - 1, y - size - 1, 'W').set(x + 2, y - size, 'W');
}

/** An arched alcove carved into the trunk, lined with shelves. */
function alcove(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, y1: number, shelves: number[]): void {
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const archBottom = y0 + rx * 0.7;
  const isIn = (x: number, y: number) => x >= x0 && x < x1 && y < y1 && (y >= archBottom || ((x - cx) / rx) ** 2 + ((y - archBottom) / (rx * 0.7)) ** 2 <= 1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!isIn(x, y)) continue;
      const rim = !isIn(x - 2, y) || !isIn(x + 2, y) || !isIn(x, y - 2);
      p.shade(x, y, rim ? RAMPS.wood : ['K', 'q', 'j'], rim ? 0.15 + lightAt(x, y) * 0.5 : 0.2 + lightAt(x, y) * 0.55);
    }
  }
  for (const sy of shelves) {
    let bx = x0 + 6;
    while (bx < x1 - 14) {
      const w = bottle(p, r, bx, sy, rand(r) > 0.45);
      bx += w + 1 + Math.floor(rand(r) * 3);
    }
    for (let y = sy; y < sy + 4; y++) for (let x = x0 + 2; x < x1 - 2; x++) p.shade(x, y, RAMPS.wood, (y === sy ? 0.55 : 0.3) + lightAt(x, y) * 0.5);
    p.hline(x0 + 2, x1 - 3, sy + 4, 'k');
  }
}

function wallShelf(p: Pixmap, r: Rng, x0: number, x1: number, y: number): void {
  let bx = x0 + 3;
  while (bx < x1 - 12) {
    const w = bottle(p, r, bx, y, rand(r) > 0.6);
    bx += w + 2 + Math.floor(rand(r) * 4);
  }
  // A branch-like shelf: thicker in the middle.
  for (let x = x0; x < x1; x++) {
    const th = 3 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 2);
    for (let j = 0; j < th; j++) p.shade(x, y + j, RAMPS.wood, (j === 0 ? 0.6 : 0.3) + lightAt(x, y) * 0.4);
    p.set(x, y + th, 'k');
  }
}

function herbBundle(p: Pixmap, r: Rng, x: number, len: number, kind: 'lavender' | 'sage' | 'flower'): void {
  for (let y = 0; y < len; y++) p.set(x, y, 'n');
  const cols: readonly PaletteKey[] = kind === 'lavender' ? ['P', 'v', 'p'] : kind === 'sage' ? ['G', 'l', 'g'] : ['i', 'I', 'G'];
  p.fillRect(x - 3, len, 7, 3, 'B').hline(x - 3, x + 3, len, 'n');
  for (let i = 0; i < 110; i++) {
    const dy = Math.floor(rand(r) * 28);
    const spread = 1.5 + dy / 4;
    const dx = Math.round((rand(r) - 0.5) * 2 * spread);
    p.set(x + dx, len + 3 + dy, pick(r, cols));
  }
}

function lantern(p: Pixmap, x: number, y: number, chain: number): void {
  for (let c = 0; c < chain; c++) p.set(x, y - chain + c - 10, c % 2 ? 'S' : 'k');
  // Glass jar lantern with a candle.
  p.fillRect(x - 5, y - 11, 11, 2, 'k').fillRect(x - 3, y - 13, 7, 2, 'k');
  p.fillRect(x - 6, y - 9, 13, 17, 'k');
  p.fillRect(x - 5, y - 8, 11, 15, 'y');
  p.fillRect(x - 4, y - 7, 9, 13, 'Y');
  p.fillRect(x - 1, y - 3, 3, 8, 'W');
  p.fillRect(x, y - 6, 1, 3, 'o');
  p.set(x - 4, y - 7, 'W').set(x - 4, y - 6, 'W');
  p.fillRect(x - 6, y + 8, 13, 2, 'k');
}

function roots(p: Pixmap, r: Rng): void {
  // Thick roots curving in along the base of both walls.
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 2; k++) {
      const y0 = 176 + k * 30 + Math.floor(rand(r) * 8);
      const reach = 110 - k * 40;
      const amp = 6 + rand(r) * 6;
      for (let s = 0; s < reach; s++) {
        const x = side < 0 ? s : SHOP_W - 1 - s;
        const y = Math.round(y0 + (s / reach) ** 2 * 40 + Math.sin(s / 14) * amp * 0.3);
        if (y > COUNTER_TOP) break;
        const thick = Math.max(1, Math.round((9 - k * 3) * (1 - s / reach)));
        for (let j = -thick; j <= thick; j++) {
          const t = 0.2 + lightAt(x, y) * 0.5 + (j < 0 ? 0.25 * (-j / thick) : -0.15 * (j / thick));
          p.shade(x, y + j, ['k', 'b', 'B', 'n'], t);
        }
        p.set(x, y - thick - 1, 'k').set(x, y + thick + 1, 'k');
      }
    }
  }
}

function counter(p: Pixmap, r: Rng): void {
  // Front: a split log with bark grooves and a carved vine band.
  for (let y = COUNTER_TOP + 8; y < SHOP_H; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      const groove = ((x + Math.sin(y / 9 + x / 40) * 3) % 9 + 9) % 9 < 1.4;
      const t = 0.1 + lightAt(x, y - 120) * 0.45 - (groove ? 0.12 : 0) - (y - COUNTER_TOP) / 500;
      p.shade(x, y, ['k', 'b', 'B', 'n'], t + 0.32);
    }
  }
  // Live-edge worktop: irregular front lip, warm and polished.
  for (let x = 0; x < SHOP_W; x++) {
    const lip = COUNTER_TOP + 7 + Math.round(Math.sin(x / 17) * 1.5 + Math.sin(x / 5.3) * 0.7);
    for (let y = COUNTER_TOP; y <= lip; y++) {
      const t = (y === COUNTER_TOP ? 0.85 : y === lip ? 0.2 : 0.5) + lightAt(x, y) * 0.3 + Math.sin(x / 3.7 + y) * 0.04;
      p.shade(x, y, RAMPS.wood, t);
    }
    p.set(x, lip + 1, 'k');
  }
  p.hline(0, SHOP_W - 1, COUNTER_TOP - 1, 'k');

  // Clutter on the worktop, leaving the middle clear for the cauldron.
  for (const cx of [128, 152, 196, 444, 468, 548, 574, 600]) bottle(p, r, cx + Math.floor(rand(r) * 6), COUNTER_TOP, rand(r) > 0.5);
  // A stack of old books.
  (['r', 'T', 'P'] as const).forEach((col, i) => {
    p.fillRect(500 - i, COUNTER_TOP - 4 - i * 4, 26 - i * 3, 4, col);
    p.hline(500 - i, 523 - i * 3, COUNTER_TOP - 4 - i * 4, 'w');
  });
  // Candle with a drip.
  p.fillRect(236, COUNTER_TOP - 10, 4, 10, 'w').set(236, COUNTER_TOP - 6, 'W').set(237, COUNTER_TOP - 12, 'o').set(237, COUNTER_TOP - 13, 'Y');
  // Mortar and pestle.
  p.fillEllipse(410, COUNTER_TOP - 4, 8, 4, 'S').fillEllipse(410, COUNTER_TOP - 6, 7, 2, 's').fillRect(413, COUNTER_TOP - 14, 2, 9, 'n');
  mushroom(p, 96, COUNTER_TOP, 4);
  mushroom(p, 104, COUNTER_TOP, 3);
}

/** Darkens the edges by stepping pixels down their ramp, for a cozy, lamplit focus. */
function vignette(p: Pixmap): void {
  const darker: Record<string, PaletteKey> = {};
  for (const ramp of Object.values(RAMPS)) {
    for (let i = 1; i < ramp.length; i++) darker[PALETTE[ramp[i] as PaletteKey]] ??= ramp[i - 1] as PaletteKey;
  }
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < SHOP_H; y++) {
    for (let x = 0; x < SHOP_W; x++) {
      const v = Math.max(0, Math.hypot((x - 320) / 340, (y - 160) / 240) - 0.6) * 2.2;
      const threshold = ((bayer[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
      if (v <= threshold) continue;
      const i = (y * SHOP_W + x) * 4;
      const hexKey = '#' + [0, 1, 2].map((k) => (p.data[i + k] ?? 0).toString(16).padStart(2, '0')).join('');
      const d = darker[hexKey];
      if (d) p.set(x, y, d);
    }
  }
}

export function shopBackdrop(seed = 'elmbrook-shop'): Pixmap {
  const p = new Pixmap(SHOP_W, SHOP_H);
  const r: Rng = { s: seedRng(seed) };
  livingWoodWall(p);
  forestView(p, r);
  roots(p, r);
  alcove(p, r, 26, 150, 44, COUNTER_TOP, [104, 150, 196, 232]);
  wallShelf(p, r, 486, 616, 104);
  wallShelf(p, r, 474, 604, 160);
  wallShelf(p, r, 490, 612, 214);
  herbBundle(p, r, 168, 22, 'lavender');
  herbBundle(p, r, 250, 14, 'sage');
  herbBundle(p, r, 392, 16, 'flower');
  herbBundle(p, r, 472, 26, 'sage');
  for (const l of SHOP_LANTERNS) lantern(p, l.x, l.y, l.chain);
  counter(p, r);
  vignette(p);
  return p;
}
