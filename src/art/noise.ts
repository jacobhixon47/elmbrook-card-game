// Seeded value noise for procedural texture (stone grain, wood grain, moss).
// Pure and deterministic: the same seed and coordinates always give the same value.

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1] at a given cell scale. */
export function valueNoise(x: number, y: number, scale: number, seed = 1): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Fractal noise: several octaves of value noise, in [0, 1]. */
export function fbm(x: number, y: number, scale: number, seed = 1, octaves = 3): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, scale / 2 ** o, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Stable per-cell random in [0, 1). */
export function cellRandom(x: number, y: number, seed = 1): number {
  return hash(x, y, seed);
}
