// The Elmbrook palette, tuned to the cozy reference art: shadows are deep
// violet-navy (never grey or black), midtones dusty mauve and wood, highlights
// warm lamplight, with small saturated accents (ivy, flowers, glass, potions).
// Single-character keys are used by sprite grids ('.' is transparent).

export const PALETTE = {
  // Ink and shadow
  K: '#0f0c1b', // deepest night
  k: '#1f1830', // outline
  q: '#2c2245', // shadow
  Q: '#483b6b', // lifted shadow
  // Night sky
  z: '#1b2341',
  Z: '#243e59',
  x: '#3a5671',
  X: '#5f86b0',
  // Glass and water
  u: '#2c4a7a',
  U: '#4f7fc4',
  c: '#9ad4e8',
  // Lamplit stone (brick ramp, dark to lit)
  j: '#3d2536',
  J: '#5a3d55',
  h: '#7d5a62',
  H: '#a77867',
  a: '#d9bd8d',
  // Wood
  b: '#4a2b2b',
  B: '#7a4a36',
  n: '#b5804f',
  // Parchment and light
  w: '#f2e4c4',
  W: '#fff6dc',
  // Lamp and ember
  y: '#f7cf5a',
  Y: '#ffe9a3',
  o: '#e8873a',
  // Reds and flowers
  r: '#8a2a40',
  R: '#d0473f',
  i: '#d9579b',
  I: '#f39ac6',
  // Greens
  g: '#1f3b35',
  G: '#3f7a4a',
  l: '#7fbf5f',
  L: '#c3e88a',
  // Violets and moonlight
  p: '#3d2a5c',
  P: '#6b4a9e',
  v: '#a98bd6',
  m: '#d6dcef',
  // Iron
  s: '#3a3850',
  S: '#646882',
  e: '#9aa0bd',
  // Teal (window frames, gale)
  T: '#2f5f5e',
  t: '#7fc8b8',
} as const;

export type PaletteKey = keyof typeof PALETTE;

export const TRANSPARENT = '.';

export function hex(key: PaletteKey): number {
  return parseInt(PALETTE[key].slice(1), 16);
}

/** Shading ramps, dark to light, for procedural lighting. */
export const RAMPS = {
  brick: ['j', 'J', 'h', 'H', 'a'],
  wood: ['b', 'B', 'n', 'a'],
  night: ['K', 'z', 'q', 'Q', 'P'],
  sky: ['z', 'Z', 'x', 'X'],
  ivy: ['g', 'G', 'l', 'L'],
  floor: ['K', 'q', 'j', 'J', 'h'],
  iron: ['k', 's', 'S', 'e'],
} as const satisfies Record<string, readonly PaletteKey[]>;

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
