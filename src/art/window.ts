// Regrades the painted view through the shop window for the season and time of day.
// Pure: takes the view's RGBA pixels (transparent outside the window) and returns new ones,
// so it runs the same in the browser (at boot) and in tests.

import type { Season, SkyTime, Weather } from '../core/calendar';
import { valueNoise } from './noise';

type Rgb = readonly [number, number, number];

const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Daylight colour of the hills, forest and hedge, dark to light. */
const LAND: Record<Season, readonly Rgb[]> = {
  spring: ['#1d3a30', '#2f6b45', '#4f9a52', '#8fcb68', '#d2ef9a'].map(rgb),
  summer: ['#132b26', '#1f4d38', '#356f43', '#5c9a4e', '#a3cd6e'].map(rgb),
  autumn: ['#2a1a22', '#61292a', '#a8492c', '#dc8538', '#f3c768'].map(rgb),
  winter: ['#1f2c3a', '#3e4f66', '#7d8fae', '#c9d3ea', '#f7f9ff'].map(rgb),
};

/** What flowers and other small bright things outside become. */
const BLOOMS: Record<Season, readonly Rgb[] | null> = {
  spring: ['#f39ac6', '#ffd6ea', '#fff6dc', '#c9a6f0'].map(rgb),
  summer: null, // keep the painting's own flowers
  autumn: ['#e8873a', '#d0473f', '#f7cf5a', '#8a2a40'].map(rgb),
  winter: ['#f7f9ff', '#d0d9ee', '#ffffff', '#b9c6e2'].map(rgb),
};

/** Sky gradients, top to horizon. Night keeps the painted sky (stars and moon). */
const SKY: Record<Exclude<SkyTime, 'night'>, readonly Rgb[]> = {
  afternoon: ['#6d8fc9', '#a9b8d8', '#f2d6a8', '#ffd58a'].map(rgb),
  sunset: ['#4a3f7a', '#a8508a', '#f07a5a', '#ffc06a'].map(rgb),
  twilight: ['#141d3a', '#26335f', '#4c4a85', '#b0708a'].map(rgb),
};
const WINTER_SKY: Record<Exclude<SkyTime, 'night'>, readonly Rgb[]> = {
  afternoon: ['#7f93bd', '#b2bdd6', '#ead9c8', '#f5d7aa'].map(rgb),
  sunset: ['#4b4a7c', '#9a6a98', '#e3948a', '#f4c08e'].map(rgb),
  twilight: ['#161f3c', '#2e3a66', '#5a5389', '#a8829a'].map(rgb),
};

/** Light over the land: a tint to mix toward, how much, and overall brightness. */
const LIGHT: Record<SkyTime, { tint: Rgb; mix: number; gain: number }> = {
  afternoon: { tint: rgb('#ffd9a0'), mix: 0.15, gain: 0.97 },
  sunset: { tint: rgb('#e0705a'), mix: 0.26, gain: 0.84 },
  twilight: { tint: rgb('#3a3a78'), mix: 0.38, gain: 0.62 },
  night: { tint: rgb('#33468a'), mix: 0.35, gain: 0.55 },
};

/** Weather over everything: a colour the air leans toward, how far, and how much the land greys out. */
const AIR: Record<Exclude<Weather, 'clear'>, Record<SkyTime, Rgb> & { sky: number; land: number; grey: number }> = {
  rain: { afternoon: rgb('#7d8597'), sunset: rgb('#8a7085'), twilight: rgb('#2f3550'), night: rgb('#1e2234'), sky: 0.7, land: 0.25, grey: 0.45 },
  fog: { afternoon: rgb('#d3d4dc'), sunset: rgb('#e2b9aa'), twilight: rgb('#4f5577'), night: rgb('#2b3150'), sky: 0.6, land: 0.5, grey: 0.3 },
  heatwave: { afternoon: rgb('#ffd58a'), sunset: rgb('#ffa060'), twilight: rgb('#7a4a6a'), night: rgb('#3a2c4a'), sky: 0.25, land: 0.18, grey: 0 },
  snow: { afternoon: rgb('#a9b1c6'), sunset: rgb('#b896a6'), twilight: rgb('#3a4266'), night: rgb('#262d48'), sky: 0.55, land: 0.1, grey: 0.2 },
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function dither(x: number, y: number): number {
  return ((BAYER[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
}

/** Picks from a ramp at t in [0,1], ordered-dithering between neighbouring steps (keeps it pixel-art). */
function ramp(colors: readonly Rgb[], t: number, x: number, y: number): Rgb {
  const pos = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const lo = Math.floor(pos);
  return colors[Math.min(colors.length - 1, pos - lo > dither(x, y) ? lo + 1 : lo)]!;
}

function lum(r: number, g: number, b: number): number {
  return (0.3 * r + 0.55 * g + 0.15 * b) / 255;
}

function isOutsideColour(r: number, g: number, b: number): boolean {
  return b > r + 12 && b >= g - 10;
}

function isSkyColour(r: number, g: number, b: number): boolean {
  return b - Math.max(r, g) > 40;
}

function hash(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export type ViewImage = { width: number; height: number; data: Uint8ClampedArray };

/**
 * Regrades the painted view. `skyTop`/`horizon` are the rows the sky gradient spans.
 * Summer nights return the painting unchanged; everything else is recoloured.
 */
export function gradeView(src: ViewImage, season: Season, time: SkyTime, skyTop: number, horizon: number, weather: Weather = 'clear'): Uint8ClampedArray {
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data);
  if (season === 'summer' && time === 'night' && weather === 'clear') return out;

  // Classify every window pixel as sky or land, and as painted-outside or a bright speck
  // (star, moon, flower). Specks take the majority class of their neighbourhood.
  const n = width * height;
  const kind = new Int8Array(n); // 0 none, 1 sky, 2 land
  const speck = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] === 0) continue;
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    if (!isOutsideColour(r, g, b)) speck[i] = 1;
    else kind[i] = isSkyColour(r, g, b) ? 1 : 2;
  }
  for (let i = 0; i < n; i++) {
    if (!speck[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    let sky = 0;
    let land = 0;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const k = kind[(y + dy) * width + (x + dx)];
        if (k === 1) sky++;
        else if (k === 2) land++;
      }
    }
    kind[i] = sky >= land ? 1 : 2;
  }

  // Land brightness range, so each season's ramp spans it.
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    if (kind[i] !== 2 || speck[i]) continue;
    const l = lum(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
  }
  const span = Math.max(0.01, hi - lo);
  const light = LIGHT[time];
  const skyRamp = time === 'night' ? null : (season === 'winter' ? WINTER_SKY : SKY)[time];
  const air = weather === 'clear' ? null : AIR[weather];
  // Rain, fog and snow hide the stars; clear twilight shows the first ones high in the sky.
  const starsVisible = (y: number) => !air || weather === 'heatwave' ? time === 'night' || (time === 'twilight' && y < skyTop + (horizon - skyTop) * 0.55) : false;
  const blooms = BLOOMS[season];

  for (let i = 0; i < n; i++) {
    if (!kind[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    let c: Rgb;
    if (kind[i] === 1) {
      const t = (y - skyTop) / Math.max(1, horizon - skyTop);
      if (speck[i] && starsVisible(y)) {
        c = [r, g, b]; // a star or the moon
      } else if (!skyRamp) {
        c = speck[i] ? [data[(i - 2) * 4]!, data[(i - 2) * 4 + 1]!, data[(i - 2) * 4 + 2]!] : [r, g, b]; // painted night sky
      } else {
        // Gradient by height, with a little of the painting's cloud texture.
        const cloud = speck[i] ? 0 : Math.max(-0.12, Math.min(0.12, (lum(r, g, b) - 0.3) * 0.5));
        c = ramp(skyRamp, t + cloud, x, y);
      }
      if (air) c = airOver(c, air[time], air.sky * (0.85 + valueNoise(x, y * 3, 24, 7) * 0.3), air.grey, x, y);
    } else if (speck[i]) {
      if (blooms) c = blooms[Math.floor(hash(x, y) * blooms.length)]!;
      else c = [r, g, b];
      c = applyLight(c, light);
    } else {
      // Winter: snow settles on the upper, brighter slopes first.
      const t = (lum(r, g, b) - lo) / span;
      const snowy = season === 'winter' ? Math.min(1, t * (time === 'night' ? 1 : 1.25) + 0.08) : t;
      c = applyLight(ramp(LAND[season], snowy + (weather === 'snow' ? 0.06 : 0), x, y), light);
    }
    if (air && kind[i] === 2) {
      // Farther land (higher in the window) disappears into the weather first; fog rolls in bands.
      const far = 1 - Math.max(0, Math.min(1, (y - skyTop) / Math.max(1, height - skyTop)));
      const band = weather === 'fog' ? (valueNoise(x * 0.5, y * 2, 18, 9) - 0.5) * 0.5 : 0;
      c = airOver(c, air[time], Math.max(0, Math.min(1, air.land + far * 0.35 + band)), air.grey, x, y);
    }
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
  }
  return out;
}

function applyLight(c: Rgb, light: { tint: Rgb; mix: number; gain: number }): Rgb {
  return [0, 1, 2].map((k) => Math.round((c[k]! * (1 - light.mix) + light.tint[k]! * light.mix) * light.gain)) as unknown as Rgb;
}

/** Leans a colour toward the weather's air colour (ordered-dithered) after greying it out a little. */
function airOver(c: Rgb, airColour: Rgb, amount: number, grey: number, x: number, y: number): Rgb {
  const l = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15);
  const g = [0, 1, 2].map((k) => c[k]! * (1 - grey) + l * grey);
  // Dither the mix amount in quarter steps so weather stays crisp pixel art, not a smooth wash.
  const stepped = Math.min(1, Math.floor(amount * 4 + dither(x, y)) / 4);
  return [0, 1, 2].map((k) => Math.round(g[k]! * (1 - stepped) + airColour[k]! * stepped)) as unknown as Rgb;
}
