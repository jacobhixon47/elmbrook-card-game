import type { Season } from '../core';

// The walkable Night Market (GDD §9, Jacob, Oct 19): the town square after a Night Shift, seen from
// above like the cottage, with a fountain in the middle and stalls round it. Each stall has a home
// of its own, so the Fence is always in the same corner; the ones not open tonight stand shuttered.
// Square space is a 320x180 grid drawn at 2x. Pure, so tests can walk it.

export const SQUARE_W = 320;
export const SQUARE_H = 180;
export const SQUARE_SCALE = 2;
/** Square pixels walked per second. */
export const WALK_SPEED = 72;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** Where a stall stands. Every stall in the codex has one, and seasonal stalls share theirs. */
export type HomeId = 'lantern' | 'fortune' | 'name' | 'fence' | 'west' | 'east' | 'moth' | 'tailor' | 'well' | 'rug' | 'fire' | 'top' | 'solstice' | 'gifts';

/**
 * What the square is dressed for tonight: the Night Market, a seasonal fair at twilight, or the
 * Longest Night vigil (GDD §4.2, Jacob, Oct 21: festivals in festive versions of the square).
 */
export type SquarePlace = 'market' | 'fair' | 'vigil';

export type Home = {
  id: HomeId;
  /** What stands there: a canopied stall, the well in the middle, a trader's rug, or the fire pit. */
  kind: 'stall' | 'well' | 'rug' | 'fire' | 'bonfire' | 'table';
  /** Where its sprite sits (top-left, square pixels), and its size. */
  at: Point;
  size: { w: number; h: number };
  /** The ground it stands on, which you can't walk through. */
  solid: Rect;
  /** Stand with your feet in here to use it. */
  zone: Rect;
};

export const HOMES: readonly Home[] = [
  // Laid out as in Jacob's seasonal concepts (Oct 19): eight stalls in a ring round the fountain,
  // each with a rug before it, the Tinker's rug by the way in and the fire pit down in the corner.
  { id: 'lantern', kind: 'stall', at: { x: 59, y: 36 }, size: { w: 40, h: 32 }, solid: { x: 60, y: 46, w: 38, h: 20 }, zone: { x: 62, y: 66, w: 36, h: 14 } },
  { id: 'fortune', kind: 'stall', at: { x: 107, y: 22 }, size: { w: 40, h: 32 }, solid: { x: 108, y: 32, w: 38, h: 20 }, zone: { x: 109, y: 52, w: 36, h: 13 } },
  { id: 'name', kind: 'stall', at: { x: 181, y: 22 }, size: { w: 40, h: 32 }, solid: { x: 182, y: 32, w: 38, h: 20 }, zone: { x: 183, y: 52, w: 36, h: 13 } },
  { id: 'fence', kind: 'stall', at: { x: 222, y: 38 }, size: { w: 40, h: 32 }, solid: { x: 223, y: 48, w: 38, h: 20 }, zone: { x: 224, y: 68, w: 36, h: 14 } },
  // The sides: this season's two stalls, their rugs beside them, then the Moth Broker and the Hollow Tailor.
  { id: 'west', kind: 'stall', at: { x: 47, y: 72 }, size: { w: 40, h: 32 }, solid: { x: 48, y: 82, w: 38, h: 20 }, zone: { x: 87, y: 86, w: 22, h: 16 } },
  { id: 'east', kind: 'stall', at: { x: 222, y: 74 }, size: { w: 40, h: 32 }, solid: { x: 223, y: 84, w: 38, h: 20 }, zone: { x: 199, y: 88, w: 22, h: 16 } },
  { id: 'moth', kind: 'stall', at: { x: 63, y: 104 }, size: { w: 40, h: 32 }, solid: { x: 64, y: 114, w: 38, h: 20 }, zone: { x: 65, y: 134, w: 36, h: 12 } },
  { id: 'tailor', kind: 'stall', at: { x: 214, y: 104 }, size: { w: 40, h: 32 }, solid: { x: 215, y: 114, w: 38, h: 20 }, zone: { x: 216, y: 134, w: 36, h: 12 } },
  // The fountain in the middle, where the Black Market sets up at the new moon.
  { id: 'well', kind: 'well', at: { x: 132, y: 56 }, size: { w: 56, h: 52 }, solid: { x: 140, y: 80, w: 40, h: 26 }, zone: { x: 140, y: 106, w: 40, h: 12 } },
  // A rug by the way in, for the Wandering Tinker at the full moon.
  { id: 'rug', kind: 'rug', at: { x: 176, y: 116 }, size: { w: 40, h: 28 }, solid: { x: 182, y: 124, w: 28, h: 10 }, zone: { x: 182, y: 134, w: 30, h: 12 } },
  // The fire pit in its clearing below the fence, where the Hearth Trader keeps a fire lit every winter night.
  { id: 'fire', kind: 'fire', at: { x: 54, y: 144 }, size: { w: 40, h: 28 }, solid: { x: 62, y: 154, w: 24, h: 10 }, zone: { x: 88, y: 158, w: 22, h: 16 } },
];

/**
 * Homes only the festivals use. A fair's middle stall stands at the top of the square, where the
 * Fortune Tent and the Name-Taker stand on market nights; at the vigil the Solstice Fire burns on
 * the fountain's bottom step, and the town's gifts wait on a table by the lane.
 */
export const FESTIVAL_HOMES: readonly Home[] = [
  { id: 'top', kind: 'stall', at: { x: 140, y: 22 }, size: { w: 40, h: 32 }, solid: { x: 141, y: 32, w: 38, h: 20 }, zone: { x: 142, y: 52, w: 36, h: 13 } },
  { id: 'solstice', kind: 'bonfire', at: { x: 136, y: 96 }, size: { w: 48, h: 30 }, solid: { x: 140, y: 108, w: 40, h: 22 }, zone: { x: 142, y: 130, w: 36, h: 12 } },
  { id: 'gifts', kind: 'table', at: { x: 182, y: 118 }, size: { w: 32, h: 22 }, solid: { x: 184, y: 128, w: 28, h: 8 }, zone: { x: 184, y: 136, w: 28, h: 10 } },
];

const byId = (id: HomeId): Home => [...HOMES, ...FESTIVAL_HOMES].find((h) => h.id === id)!;

/**
 * The homes standing tonight. At a fair or the vigil the Night Market isn't set up: the stall
 * homes left over carry festive dressing instead (decorations, not stalls), and the Fortune Tent's
 * and the Name-Taker's corner makes room for the fair's middle stall.
 */
export function homesFor(place: SquarePlace): readonly Home[] {
  if (place === 'market') return HOMES;
  const keep: HomeId[] = place === 'fair'
    ? ['lantern', 'fence', 'west', 'east', 'moth', 'tailor', 'top', 'well', 'fire']
    : ['lantern', 'fence', 'west', 'east', 'moth', 'tailor', 'top', 'well', 'solstice', 'gifts', 'fire'];
  return keep.map(byId);
}

/** Each stall's home in the square. */
export const STALL_HOME: Record<string, HomeId> = {
  'lantern-seller': 'lantern',
  'fortune-tent': 'fortune',
  'name-taker': 'name',
  fence: 'fence',
  'seed-swapper': 'west',
  'firefly-games': 'west',
  'cider-press': 'west',
  'blossom-oracle': 'east',
  'nectar-trader': 'east',
  'harvest-auction': 'east',
  'moth-broker': 'moth',
  'hollow-tailor': 'tailor',
  'black-market': 'well',
  'wandering-tinker': 'rug',
  'hearth-trader': 'fire',
  // The fairs: three stalls each, west, top and east (GDD §4.2).
  'flower-grower': 'west',
  beekeeper: 'top',
  'garland-weaver': 'east',
  'orchard-keeper': 'west',
  glassblower: 'top',
  hatter: 'east',
  farmer: 'west',
  'cider-maker': 'top',
  'straw-weaver': 'east',
  // The Longest Night: the Solstice Fire, and the table of gifts.
  'solstice-fire': 'solstice',
  'vigil-gifts': 'gifts',
};

/** The bridge you came in by, at the bottom: walk back onto it to pay the rent and go home. */
export const EXIT: Rect = { x: 144, y: 166, w: 32, h: 14 };
/** Where you arrive: just off the bridge, facing into the square. */
export const SPAWN: Point = { x: 160, y: 158 };

/** Your feet, which is what collides: centred on x, resting on y. */
const FEET = { w: 10, h: 5 };

const EDGES: readonly Rect[] = [
  // Trees and the house along the back, and down both sides.
  { x: 0, y: 0, w: SQUARE_W, h: 30 },
  { x: 0, y: 0, w: 59, h: 66 },
  { x: 0, y: 0, w: 46, h: SQUARE_H },
  { x: 264, y: 0, w: SQUARE_W - 264, h: SQUARE_H },
  // Along the front: the fence above the fire pit's clearing, a flower bed, then flowers and water.
  { x: 46, y: 146, w: 58, h: 4 },
  { x: 104, y: 146, w: 40, h: 14 },
  { x: 176, y: 148, w: SQUARE_W - 176, h: 32 },
  { x: 0, y: 178, w: 144, h: 10 },
  // The far end of the steps down to the bridge: walking onto them is enough.
  { x: 144, y: 180, w: 32, h: 20 },
];

export const SOLIDS: readonly Rect[] = [...EDGES, ...HOMES.map((h) => h.solid)];
/** What you can't walk through, for the homes standing tonight. */
export const solidsFor = (homes: readonly Home[]): readonly Rect[] => (homes === HOMES ? SOLIDS : [...EDGES, ...homes.map((h) => h.solid)]);

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const feetAt = (p: Point): Rect => ({ x: p.x - FEET.w / 2, y: p.y - FEET.h, w: FEET.w, h: FEET.h });
const blocked = (p: Point, solids: readonly Rect[]) => solids.some((r) => overlaps(feetAt(p), r));
const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** One step of walking, as in the cottage: each axis moves on its own, so you slide along things. */
export function walk(p: Point, dx: number, dy: number, dt: number, solids: readonly Rect[] = SOLIDS): Point {
  if (!dx && !dy) return p;
  const step = (WALK_SPEED * dt) / Math.hypot(dx, dy);
  let next = { ...p };
  const x = { ...next, x: next.x + dx * step };
  if (!blocked(x, solids)) next = x;
  const y = { ...next, y: next.y + dy * step };
  if (!blocked(y, solids)) next = y;
  return next;
}

/** Tonight's stalls by home: the index into the offer's stalls, for the homes that are open. */
export function openHomes(stalls: readonly { id: string }[]): Map<HomeId, number> {
  const out = new Map<HomeId, number>();
  stalls.forEach((s, i) => {
    const home = STALL_HOME[s.id];
    if (home && !out.has(home)) out.set(home, i);
  });
  return out;
}

/** What you're standing by: an open stall's home, the bridge home, or nothing. */
export function spotAt(p: Point, open: ReadonlyMap<HomeId, number>, homes: readonly Home[] = HOMES): HomeId | 'exit' | null {
  if (inside(p, EXIT)) return 'exit';
  const centre = (r: Rect) => Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
  return homes.filter((h) => open.has(h.id) && inside(p, h.zone)).sort((a, b) => centre(a.zone) - centre(b.zone))[0]?.id ?? null;
}

/** A spot to stand by a home, for fixtures and for coming back from a stall: the middle of its zone. */
export function standBy(id: HomeId): Point {
  const z = byId(id).zone;
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}

/** Seasons with snow on the ground: the square's dressing and its footsteps. */
export const snowy = (season: Season) => season === 'winter';
