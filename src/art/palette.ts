// The Elmbrook palette. Every pixel in the game comes from here.
// Single-character keys are used by sprite grids ('.' is transparent).

export const PALETTE = {
  K: '#1a1423', // night ink (deepest shadow, background)
  k: '#2b1d2e', // outline
  W: '#fffaf0', // highlight
  w: '#f4e9d2', // parchment
  n: '#c49a6c', // tan
  B: '#8a5a3c', // wood
  b: '#5a3a2e', // dark wood
  l: '#8cc56b', // leaf light
  G: '#4f8a4b', // leaf
  g: '#2f5d3a', // leaf dark
  c: '#9ad4e8', // water light
  U: '#4f7fc4', // water
  u: '#2c4a7a', // water dark
  y: '#f2c94c', // gold
  o: '#e8873a', // ember
  R: '#d0473f', // red
  r: '#8a2a33', // red dark
  v: '#a98bd6', // violet light
  P: '#6b4a9e', // violet
  p: '#3d2a5c', // violet dark
  S: '#7a7a88', // stone
  s: '#4a4a55', // stone dark
  m: '#c8d0e0', // moonlight
  t: '#7fc8b8', // gale teal
} as const;

export type PaletteKey = keyof typeof PALETTE;

export const TRANSPARENT = '.';

export function hex(key: PaletteKey): number {
  return parseInt(PALETTE[key].slice(1), 16);
}

/** Essence colours used for pips, glows and potion tints. */
export const ESSENCE_COLOR = {
  vital: 'G',
  ember: 'o',
  tide: 'U',
  gale: 't',
  stone: 'B',
  umbra: 'P',
  lunar: 'm',
} as const satisfies Record<string, PaletteKey>;
