// What drifts past the shop window: the season's own particles plus the day's weather.
// Pure and deterministic, so the scene animates exactly what the review sheets draw.
import type { Season, SkyTime, Weather } from '../core/calendar';
import type { PaletteKey } from './palette';

export type Area = { x0: number; y0: number; x1: number; y1: number };

export type Particle = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: PaletteKey;
  alpha: number;
  /** Velocity in px/s, a side-to-side sway amplitude, and a phase for sway and blinking. */
  vx: number;
  vy: number;
  sway: number;
  phase: number;
  blink: boolean;
  /** Draw this procedural texture instead of a plain w×h block. */
  texture?: string;
};

type Kind = {
  colors: readonly PaletteKey[];
  w: number;
  h: number;
  count: number;
  vx: [number, number];
  vy: [number, number];
  sway: number;
  blink?: boolean;
  alpha?: [number, number];
  /** Share of particles one size bigger (nearer the glass). */
  near?: number;
  texture?: string;
};

function seasonKind(season: Season, time: SkyTime): Kind {
  const dark = time === 'night' || time === 'twilight';
  switch (season) {
    case 'winter':
      return { colors: ['W', 'W', 'm', 'e'], w: 1, h: 1, count: 90, vx: [-4, 6], vy: [10, 22], sway: 4, near: 0.2 };
    case 'autumn':
      return { colors: ['o', 'R', 'y', 'B'], w: 2, h: 1, count: 20, vx: [8, 22], vy: [10, 20], sway: 6, near: 0.3 };
    case 'spring':
      return dark
        ? { colors: ['L', 'y'], w: 1, h: 1, count: 14, vx: [-4, 4], vy: [-4, 4], sway: 6, blink: true }
        : { colors: ['I', 'I', 'w'], w: 2, h: 1, count: 24, vx: [10, 24], vy: [4, 12], sway: 5, near: 0.2 };
    case 'summer':
      return dark
        ? { colors: ['L', 'y', 'Y'], w: 1, h: 1, count: 28, vx: [-4, 4], vy: [-5, 3], sway: 8, blink: true }
        : { colors: ['Y', 'w'], w: 1, h: 1, count: 16, vx: [-3, 5], vy: [-3, 2], sway: 6 };
  }
}

function weatherKinds(weather: Weather): Kind[] {
  switch (weather) {
    case 'clear':
      return [];
    case 'rain':
      return [
        // Far rain: thin and faint. Near rain: longer, brighter streaks.
        { colors: ['e', 'S'], w: 1, h: 5, count: 140, vx: [-14, -10], vy: [170, 210], sway: 0, alpha: [0.45, 0.6] },
        { colors: ['c', 'm'], w: 1, h: 9, count: 45, vx: [-22, -16], vy: [260, 320], sway: 0, alpha: [0.6, 0.8] },
      ];
    case 'fog':
      return [{ colors: ['m'], w: 96, h: 14, count: 16, vx: [4, 10], vy: [0, 0], sway: 1, alpha: [0.3, 0.5], texture: 'fx/fog' }];
    case 'heatwave':
      return [
        { colors: ['Y', 'y', 'w'], w: 1, h: 1, count: 30, vx: [-2, 4], vy: [-6, -1], sway: 5, blink: true },
        // Rising shimmer: faint warm wisps.
        { colors: ['Y', 'w'], w: 1, h: 6, count: 50, vx: [-1, 1], vy: [-14, -8], sway: 2, alpha: [0.2, 0.35] },
      ];
    case 'snow':
      return [{ colors: ['W', 'W', 'm', 'e'], w: 1, h: 1, count: 260, vx: [-6, 8], vy: [18, 34], sway: 6, near: 0.3 }];
  }
}

/** Every particle for a window, seeded so the same day always looks the same. */
export function windowParticles(season: Season, time: SkyTime, weather: Weather, area: Area): Particle[] {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const between = ([a, b]: [number, number]) => a + rnd() * (b - a);
  const extra = weatherKinds(weather);
  const seasonal = seasonKind(season, time);
  // Bad weather thins out the season's own particles (fewer fireflies in the rain).
  const kinds = [extra.length ? { ...seasonal, count: Math.ceil(seasonal.count / 3) } : seasonal, ...extra];
  const out: Particle[] = [];
  for (const k of kinds) {
    for (let i = 0; i < k.count; i++) {
      const near = rnd() < (k.near ?? 0) ? 1 : 0;
      out.push({
        x: area.x0 + rnd() * (area.x1 - area.x0),
        y: area.y0 + rnd() * (area.y1 - area.y0),
        w: k.w + near,
        h: k.h + near,
        color: k.colors[Math.floor(rnd() * k.colors.length)]!,
        alpha: k.alpha ? between(k.alpha) : 1,
        vx: between(k.vx),
        vy: between(k.vy),
        sway: k.sway,
        phase: rnd() * Math.PI * 2,
        blink: k.blink ?? false,
        ...(k.texture ? { texture: k.texture } : {}),
      });
    }
  }
  return out;
}
