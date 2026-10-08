import { nextFloat, type RngState } from '../../core/rng';
import { cellRandom, fbm, valueNoise } from '../noise';
import type { PaletteKey } from '../palette';
import type { Pixmap } from '../pixmap';

// Shared pieces of Elmbrook's look: thatched fieldstone cottages, chimney
// smoke and soft stippled shapes. Used by the shop window and the title town.

export type Rng = { s: RngState };

export function rand(r: Rng): number {
  const [f, s] = nextFloat(r.s);
  r.s = s;
  return f;
}

export function pick<T>(r: Rng, items: readonly T[]): T {
  return items[Math.floor(rand(r) * items.length)] as T;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Sets a pixel only where the ordered-dither threshold passes: soft, see-through shapes. */
export function stipple(p: Pixmap, x: number, y: number, density: number, key: PaletteKey): void {
  const t = ((BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] ?? 0) + 0.5) / 16;
  if (density > t) p.set(x, y, key);
}

/** Soft rising chimney smoke, drifting right and thinning out. */
export function smoke(p: Pixmap, x: number, y: number, clipTop: number): void {
  for (let s = 0; s < 12; s++) {
    const cx = x + s * 2.2 + Math.sin(s * 0.9) * 2;
    const cy = y - s * 4.2;
    const rad = 2 + s * 0.45;
    for (let py = Math.floor(cy - rad); py <= cy + rad; py++) {
      if (py < clipTop) continue;
      for (let px = Math.floor(cx - rad); px <= cx + rad; px++) {
        const d = Math.hypot(px - cx, py - cy) / rad;
        if (d > 1) continue;
        const density = (1.2 - d) * (1 - s / 13);
        stipple(p, px, py, density, px > cx + rad * 0.2 ? 'v' : 'P');
      }
    }
  }
}

/** A thatched stone cottage seen across the valley at night. */
export function cottage(p: Pixmap, r: Rng, c: { x: number; base: number; w: number; wallH: number }, smokeTop = 0): void {
  const top = c.base - c.wallH;
  const MOONSTONE: readonly PaletteKey[] = ['K', 'k', 'q', 'Q', 'S', 'e'];
  // Fieldstone walls: small irregular stones, brighter on the moon side.
  for (let y = top; y < c.base; y++) {
    const row = Math.floor((y - top) / 3);
    for (let x = c.x; x < c.x + c.w; x++) {
      const sx = x + row * 3;
      const mortar = (y - top) % 3 === 2 || sx % (5 + (row % 2)) === 0;
      const side = (x - c.x) / c.w;
      p.shade(x, y, MOONSTONE, 0.3 + side * 0.25 + (mortar ? -0.22 : (valueNoise(x, y, 2, 31) - 0.5) * 0.3) - (y - top) / (c.wallH * 4));
    }
  }
  // Chimney (stone), drawn before the roof so the thatch overlaps its foot.
  const chx = c.x + c.w - Math.round(c.w * 0.28);
  const roofH = Math.round(c.wallH * 0.95);
  for (let y = top - roofH - 6; y < top - 2; y++) {
    for (let x = chx; x < chx + 5; x++) p.shade(x, y, MOONSTONE, 0.35 + (x - chx) * 0.06 + ((y % 3 === 0) ? -0.15 : 0));
  }
  p.hline(chx - 1, chx + 5, top - roofH - 7, 'S');
  // Thatch: a rounded, overhanging roof with straw strands and moss.
  const over = 4;
  for (let j = 0; j < roofH; j++) {
    const k = j / (roofH - 1);
    const half = (c.w / 2 + over) * Math.sqrt(0.15 + 0.85 * k);
    const mid = c.x + c.w / 2;
    for (let x = Math.round(mid - half); x <= mid + half; x++) {
      const strand = (valueNoise(x * 3, j, 3, 33) - 0.5) * 0.35;
      const side = (x - (mid - half)) / (2 * half);
      const moss = fbm(x, j, 5, 34) > 0.64;
      const y = top - roofH + j + (j === roofH - 1 && (x + c.x) % 3 === 0 ? 1 : 0);
      if (moss) p.shade(x, y, ['k', 'g', 'G', 'l'], 0.25 + side * 0.4 - k * 0.2);
      else p.shade(x, y, ['K', 'j', 'J', 'h', 'H'], 0.25 + side * 0.45 + strand - k * 0.25 + (j === 0 ? 0.15 : 0));
    }
  }
  // Shadow under the eaves.
  p.hline(c.x, c.x + c.w - 1, top + 1, 'K');
  // Cross-paned windows glowing warm, with a soft spill on the ground.
  const winY = top + Math.round(c.wallH * 0.32);
  const winH = Math.max(5, Math.round(c.wallH * 0.38));
  const door = c.x + Math.round(c.w * 0.5) - 3;
  for (const wx of [c.x + 5, c.x + c.w - 12]) {
    // Lamplight spilling onto the ground below the window.
    for (let y = c.base; y < c.base + 3; y++) for (let x = wx - 1; x < wx + 8; x++) stipple(p, x, y, 0.55 - (y - c.base) * 0.18, 'b');
    p.fillRect(wx - 1, winY - 1, 9, winH + 2, 'k');
    p.fillRect(wx, winY, 7, winH, 'y');
    p.fillRect(wx, winY, 3, 2, 'Y');
    p.hline(wx, wx + 6, winY + Math.floor(winH / 2), 'o');
    for (let y = winY; y < winY + winH; y++) p.set(wx + 3, y, 'o');
    p.hline(wx - 1, wx + 7, winY + winH + 1, 'H'); // sill
    if (rand(r) > 0.4) for (let x = wx; x < wx + 7; x += 2) p.set(x, winY + winH + 2, pick(r, ['i', 'I', 'v', 'G'] as const));
  }
  // Round-topped plank door with a lamp-warm glow at the threshold.
  const dh = Math.round(c.wallH * 0.6);
  for (let y = c.base - dh; y < c.base; y++) {
    for (let x = door; x < door + 7; x++) {
      if (y === c.base - dh && (x === door || x === door + 6)) continue;
      p.set(x, y, x === door || x === door + 6 ? 'k' : (x - door) % 2 === 0 ? 'b' : 'B');
    }
  }
  p.set(door + 5, c.base - Math.floor(dh / 2), 'y');
  // Ivy creeping up a corner.
  for (let y = c.base - 1; y > top + 2; y--) {
    const vx = c.x + 1 + Math.round(Math.sin(y * 0.7) * 1.2);
    if (cellRandom(vx, y, 35) > 0.25) p.set(vx, y, cellRandom(vx, y, 36) > 0.5 ? 'G' : 'g');
    if (cellRandom(vx, y, 37) > 0.88) p.set(vx + 1, y, 'I');
  }
  smoke(p, chx + 2, top - roofH - 9, smokeTop);
}

export const FOLIAGE: readonly PaletteKey[] = ['K', 'k', 'g', 'T', 'G', 'x'];

/** Snow-capped peaks lit from the moon side (up and to the right), with mist pooling at their feet. */
export function mountains(p: Pixmap, x0: number, x1: number, base: number, bottom: number, peaks: readonly { x: number; h: number }[], jag = 4): void {
  for (let x = x0; x <= x1; x++) {
    let ridge = bottom;
    let owner = peaks[0]!;
    for (const pk of peaks) {
      const top = base - pk.h + Math.abs(x - pk.x) * (0.95 + valueNoise(x, pk.x, 9, 21) * 0.5);
      if (top < ridge) {
        ridge = top;
        owner = pk;
      }
    }
    ridge = Math.round(ridge + (valueNoise(x, 0, 4, 22) - 0.5) * 4 + (fbm(x, 0, 18, 28) - 0.5) * jag * 3);
    const peakTop = base - owner.h;
    const lit = x > owner.x;
    const snowLine = peakTop + owner.h * 0.38 + (valueNoise(x, 1, 5, 24) - 0.5) * 14;
    for (let y = ridge; y <= base + 30 && y <= bottom; y++) {
      const depth = (y - ridge) / 60;
      // Rocky striations running down the slope.
      const rock = (fbm(x + (y - peakTop) * (lit ? -0.6 : 0.6), y * 0.3, 6, 25) - 0.5) * 0.35;
      if (y < snowLine) p.shade(x, y, ['q', 'Q', 'v', 'm', 'W'], (lit ? 0.7 : 0.3) + rock - depth * 0.8 + (y === ridge ? 0.2 : 0));
      else p.shade(x, y, ['K', 'z', 'Z', 'x', 'X'], (lit ? 0.5 : 0.22) + rock - depth * 0.6);
      const mist = (y - (base - 6)) / 24 + (fbm(x, y * 3, 30, 26) - 0.5) * 0.5;
      if (mist > 0.2) p.shade(x, y, ['Z', 'x', 'Q', 'v'], 0.2 + mist * 0.4);
    }
  }
}

/** A layered pine silhouette with a moonlit right edge. */
export function pine(p: Pixmap, tx: number, baseY: number, th: number, tone: number, x0 = 0, x1 = p.width - 1): void {
  for (let j = 0; j < th; j++) {
    const half = Math.floor((j / th) * th * 0.28 + (j % 4 === 3 ? 1 : 0));
    for (let x = tx - half; x <= tx + half; x++) {
      if (x < x0 || x > x1) continue;
      const rim = x === tx + half && j % 4 !== 0 ? 0.22 : 0;
      p.shade(x, baseY - th + j, FOLIAGE, tone + rim + (x < tx ? -0.06 : 0.04) + (valueNoise(x, j, 2, 27) - 0.5) * 0.15);
    }
  }
}

/** Night sky with drifting cloud, coloured stars and a haloed moon. */
export function nightSky(p: Pixmap, r: Rng, x0: number, x1: number, y0: number, horizon: number, moon: { x: number; y: number; r: number }): void {
  const SKY: readonly PaletteKey[] = ['K', 'z', 'Z', 'q', 'Q', 'P', 'X'];
  for (let y = y0; y <= horizon + 40; y++) {
    for (let x = x0; x <= x1; x++) p.shade(x, y, SKY, 0.15 + ((y - y0) / (horizon - y0)) * 0.7 + (valueNoise(x, y, 20, 4) - 0.5) * 0.12);
  }
  for (let y = y0 + 16; y < horizon - 10; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = fbm(x * 0.6, y * 2.2, 26, 11, 3);
      if (c > 0.62) p.shade(x, y, ['q', 'Q', 'P', 'v'], (c - 0.62) * 4.5);
    }
  }
  const area = (x1 - x0) * (horizon - y0);
  for (let i = 0; i < area / 260; i++) {
    const sx = x0 + Math.floor(rand(r) * (x1 - x0));
    const sy = y0 + Math.floor(rand(r) * (horizon - y0));
    p.set(sx, sy, pick(r, ['W', 'm', 'c', 'v', 'y', 'I'] as const));
    if (rand(r) > 0.93) p.set(sx - 1, sy, 'P').set(sx + 1, sy, 'P').set(sx, sy - 1, 'P').set(sx, sy + 1, 'P');
  }
  const halo = moon.r * 3.3;
  for (let y = Math.floor(moon.y - halo); y <= moon.y + halo; y++) {
    for (let x = Math.floor(moon.x - halo); x <= moon.x + halo; x++) {
      if (x < x0 || x > x1 || y < y0) continue;
      const d = Math.hypot(x - moon.x, y - moon.y);
      if (d < moon.r) p.shade(x, y, ['S', 'm', 'W'], 1.5 - d / moon.r * 0.6 - fbm(x, y, moon.r / 2, 2) * 0.9);
      else if (d < halo) p.shade(x, y, ['q', 'Q', 'P', 'v', 'm'], ((halo - d) / (halo - moon.r)) ** 2 * 0.8);
    }
  }
}

/** A broadleaf tree: gnarled trunk and clumped canopy, rim-lit by the moon. */
function oak(p: Pixmap, r: Rng, cx: number, ground: number, height: number, spread: number): void {
  const BARK: readonly PaletteKey[] = ['K', 'k', 'j', 'J', 'h'];
  for (let y = ground - height * 0.6; y <= ground; y++) {
    const k = (y - (ground - height * 0.6)) / (height * 0.6);
    const half = 8 + k * k * 14 + Math.sin(y * 0.15) * 2;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const bark = (valueNoise(x * 3, y * 0.4, 4, 51) - 0.5) * 0.4;
      p.shade(x, Math.floor(y), BARK, 0.15 + ((x - cx) / half) * 0.25 + bark);
    }
  }
  const top = ground - height;
  for (let i = 0; i < 26; i++) {
    const a = rand(r) * Math.PI;
    const bx = cx + Math.cos(a) * spread * rand(r);
    const by = top + height * 0.15 + Math.sin(a) * height * 0.32 * rand(r);
    const rad = 10 + rand(r) * 14;
    for (let y = Math.floor(by - rad); y <= by + rad; y++) {
      for (let x = Math.floor(bx - rad * 1.2); x <= bx + rad * 1.2; x++) {
        const d = Math.hypot((x - bx) / 1.2, y - by) / rad;
        const edge = fbm(x, y, 5, 52) * 0.45;
        if (d > 0.75 + edge) continue;
        // Light from up-right: lit where the clump faces the moon.
        const face = ((x - bx) / rad - (y - by) / rad) * 0.25;
        const leaf = (cellRandom(x >> 1, y >> 1, 53) - 0.5) * 0.25;
        p.shade(x, y, FOLIAGE, 0.18 + face + leaf - d * 0.15);
      }
    }
  }
}

/** A post lantern: iron post, glass lamp, warm glow stippled on the ground. */
function lampPost(p: Pixmap, x: number, ground: number): void {
  for (let y = ground - 26; y < ground; y++) p.set(x, y, 'k').set(x + 1, y, y % 5 === 0 ? 'S' : 's');
  p.hline(x - 2, x + 4, ground - 26, 'k');
  p.fillRect(x - 2, ground - 33, 6, 7, 'k');
  p.fillRect(x - 1, ground - 32, 4, 5, 'y');
  p.set(x, ground - 31, 'W').set(x, ground - 30, 'Y');
  p.hline(x - 1, x + 3, ground - 34, 'S');
}

/** Lamp centres on the title town, so the scene can add soft additive glows. */
export const TOWN_LAMPS = [
  { x: 258, y: 254 },
  { x: 380, y: 250 },
] as const;

/** Elmbrook by moonlight: thatched cottages on a meadow under mountains, framed by trees. 640x360. */
export function townBackdrop(p: Pixmap, r: Rng): void {
  const W = p.width;
  const H = p.height;
  const horizon = 190;
  nightSky(p, r, 0, W - 1, 0, horizon, { x: 462, y: 58, r: 15 });
  mountains(p, 0, W - 1, horizon + 22, H - 1, [
    { x: 40, h: 70 },
    { x: 130, h: 104 },
    { x: 236, h: 76 },
    { x: 330, h: 96 },
    { x: 430, h: 70 },
    { x: 540, h: 112 },
    { x: 620, h: 80 },
  ], 8);
  // Forest band.
  for (let x = 0; x < W; x++) {
    const edge = horizon + 18 + Math.round(Math.sin(x / 37) * 7 + valueNoise(x, 0, 9, 61) * 8);
    for (let y = edge; y < H; y++) p.shade(x, y, ['K', 'z', 'g', 'T'], 0.3 - (y - edge) / 60 + (y === edge ? 0.25 : 0));
  }
  for (let i = 0; i < 110; i++) pine(p, Math.floor(rand(r) * W), horizon + 26 + Math.floor(rand(r) * 18), 14 + Math.floor(rand(r) * 16), 0.12);
  // Meadow, rolling up to the village, with a cobbled path winding to the bottom.
  const ground = (x: number) => 244 + Math.round(Math.sin(x / 80) * 6 + valueNoise(x, 0, 30, 62) * 8);
  const pathX = (y: number) => 320 + Math.sin(y / 22) * 26 * ((y - 236) / 124);
  for (let x = 0; x < W; x++) {
    for (let y = ground(x); y < H; y++) {
      const k = (y - 240) / 120;
      const pw = 4 + k * 34;
      const onPath = Math.abs(x - pathX(y)) < pw;
      if (onPath) {
        const cob = valueNoise(x, y * 1.6, 3, 63);
        p.shade(x, y, ['K', 'q', 'j', 'J', 'h'], 0.25 + k * 0.25 + (cob > 0.6 ? 0.2 : cob < 0.3 ? -0.18 : 0));
      } else {
        // Grass in soft swells, with blade streaks and moonlit crests.
        const swell = fbm(x, y * 2, 40, 64) - 0.5;
        const blade = (valueNoise(x * 3, y * 0.35, 2, 70) - 0.5) * 0.22;
        p.shade(x, y, ['K', 'k', 'g', 'T', 'G'], 0.36 - k * 0.3 + swell * 0.5 + blade + (y === ground(x) ? 0.25 : 0));
        const patch = fbm(x, y, 14, 65) > 0.7;
        if (patch && cellRandom(x, y, 71) > 0.975) p.set(x, y, pick(r, ['i', 'I', 'v', 'w'] as const));
      }
    }
  }
  // The village: far cottages first.
  for (const h of [
    { x: 196, w: 40, wallH: 14 },
    { x: 410, w: 44, wallH: 15 },
  ]) {
    cottage(p, r, { ...h, base: ground(h.x + h.w / 2) + Math.round(h.wallH * 0.8) });
  }
  cottage(p, r, { x: 52, w: 92, wallH: 32, base: 306 });
  cottage(p, r, { x: 500, w: 96, wallH: 34, base: 312 });
  // Low drystone walls of rounded fieldstones, capped with moss.
  for (const [a, b, yy] of [[150, 236, 286], [404, 492, 284]] as const) {
    for (let row = 0; row < 2; row++) {
      for (let x = a + row * 3; x < b; x += 6) {
        const sx = x + Math.floor(cellRandom(x, row, 66) * 2);
        p.fillEllipse(sx + 3, yy + row * 4 + 2, 3.4, 2.4, 'K');
        p.fillEllipse(sx + 3, yy + row * 4 + 2, 2.6, 1.8, 'Q');
        p.fillEllipse(sx + 3.6, yy + row * 4 + 1.4, 1.6, 0.9, 'S');
      }
    }
    for (let x = a; x < b; x++) if (cellRandom(x, 1, 67) > 0.35) p.set(x, yy - 1 + (cellRandom(x, 2, 67) > 0.7 ? -1 : 0), pick(r, ['g', 'G', 'G', 'l'] as const));
  }
  lampPost(p, 258, 284);
  lampPost(p, 380, 280);
  // Framing trees at both edges.
  oak(p, r, 22, H, 330, 100);
  oak(p, r, W - 24, H, 340, 104);
  // Foreground ferns and glowing mushrooms along the bottom edge.
  for (let x = 0; x < W; x++) {
    const h = 8 + Math.round(valueNoise(x, 0, 6, 68) * 14);
    for (let y = H - h; y < H; y++) p.shade(x, y, FOLIAGE, 0.08 + (y === H - h ? 0.18 : 0) + (valueNoise(x * 2, y, 2, 69) - 0.5) * 0.2);
  }
  for (let i = 0; i < 9; i++) {
    const mx = 30 + Math.floor(rand(r) * (W - 60));
    if (Math.abs(mx - 320) < 70) continue;
    const my = H - 6 - Math.floor(rand(r) * 8);
    p.fillRect(mx, my, 1, 4, 'm');
    p.fillEllipse(mx + 0.5, my, 3, 1.6, rand(r) > 0.5 ? 'v' : 't');
    p.set(mx - 1, my - 1, 'W');
  }
  // Fireflies.
  for (let i = 0; i < 60; i++) {
    const fx = Math.floor(rand(r) * W);
    const fy = 200 + Math.floor(rand(r) * 150);
    p.set(fx, fy, pick(r, ['L', 'y', 'Y'] as const));
    if (rand(r) > 0.7) stipple(p, fx + 1, fy, 0.5, 'l');
  }
}
