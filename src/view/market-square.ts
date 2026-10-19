import type { Season } from '../core';

// The walkable Night Market (GDD §9, Jacob, Oct 19): the town square after a Night Shift, seen from
// above like the cottage, with a well in the middle and stalls round it. Each stall has a home
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
export type HomeId = 'lantern' | 'fortune' | 'name' | 'fence' | 'west' | 'east' | 'moth' | 'tailor' | 'well' | 'rug' | 'fire';

export type Home = {
  id: HomeId;
  /** What stands there: a canopied stall, the well in the middle, a trader's rug, or the fire pit. */
  kind: 'stall' | 'well' | 'rug' | 'fire';
  /** Where its sprite sits (top-left, square pixels), and its size. */
  at: Point;
  size: { w: number; h: number };
  /** The ground it stands on, which you can't walk through. */
  solid: Rect;
  /** Stand with your feet in here to use it. */
  zone: Rect;
};

export const HOMES: readonly Home[] = [
  // The back row, under the eaves of the houses.
  { id: 'lantern', kind: 'stall', at: { x: 28, y: 16 }, size: { w: 40, h: 32 }, solid: { x: 28, y: 30, w: 40, h: 16 }, zone: { x: 30, y: 46, w: 36, h: 14 } },
  { id: 'fortune', kind: 'stall', at: { x: 92, y: 16 }, size: { w: 40, h: 32 }, solid: { x: 92, y: 30, w: 40, h: 16 }, zone: { x: 94, y: 46, w: 36, h: 14 } },
  { id: 'name', kind: 'stall', at: { x: 188, y: 16 }, size: { w: 40, h: 32 }, solid: { x: 188, y: 30, w: 40, h: 16 }, zone: { x: 190, y: 46, w: 36, h: 14 } },
  { id: 'fence', kind: 'stall', at: { x: 252, y: 16 }, size: { w: 40, h: 32 }, solid: { x: 252, y: 30, w: 40, h: 16 }, zone: { x: 254, y: 46, w: 36, h: 14 } },
  // The sides: this season's two stalls, then the Moth Broker and the Hollow Tailor.
  { id: 'west', kind: 'stall', at: { x: 6, y: 62 }, size: { w: 40, h: 32 }, solid: { x: 6, y: 76, w: 40, h: 16 }, zone: { x: 10, y: 92, w: 36, h: 14 } },
  { id: 'east', kind: 'stall', at: { x: 274, y: 62 }, size: { w: 40, h: 32 }, solid: { x: 274, y: 76, w: 40, h: 16 }, zone: { x: 274, y: 92, w: 36, h: 14 } },
  { id: 'moth', kind: 'stall', at: { x: 14, y: 110 }, size: { w: 40, h: 32 }, solid: { x: 14, y: 124, w: 40, h: 16 }, zone: { x: 16, y: 140, w: 36, h: 14 } },
  { id: 'tailor', kind: 'stall', at: { x: 266, y: 110 }, size: { w: 40, h: 32 }, solid: { x: 266, y: 124, w: 40, h: 16 }, zone: { x: 268, y: 140, w: 36, h: 14 } },
  // The well in the middle, where the Black Market sets up at the new moon.
  { id: 'well', kind: 'well', at: { x: 132, y: 60 }, size: { w: 56, h: 48 }, solid: { x: 138, y: 78, w: 44, h: 26 }, zone: { x: 140, y: 104, w: 40, h: 14 } },
  // A rug by the way in, for the Wandering Tinker at the full moon.
  { id: 'rug', kind: 'rug', at: { x: 196, y: 128 }, size: { w: 40, h: 28 }, solid: { x: 202, y: 136, w: 28, h: 10 }, zone: { x: 198, y: 146, w: 36, h: 14 } },
  // The fire pit, where the Hearth Trader keeps a fire lit every winter night.
  { id: 'fire', kind: 'fire', at: { x: 84, y: 128 }, size: { w: 40, h: 28 }, solid: { x: 92, y: 138, w: 24, h: 10 }, zone: { x: 86, y: 148, w: 36, h: 14 } },
];

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
};

/** The bridge you came in by, at the bottom: walk back onto it to pay the rent and go home. */
export const EXIT: Rect = { x: 144, y: 164, w: 32, h: 16 };
/** Where you arrive: just off the bridge, facing into the square. */
export const SPAWN: Point = { x: 160, y: 160 };

/** Your feet, which is what collides: centred on x, resting on y. */
const FEET = { w: 10, h: 5 };

const EDGES: readonly Rect[] = [
  // The houses along the back.
  { x: 0, y: 0, w: SQUARE_W, h: 30 },
  { x: 0, y: 0, w: 4, h: SQUARE_H },
  { x: SQUARE_W - 4, y: 0, w: 4, h: SQUARE_H },
  // The low wall along the water, with the bridge in the middle.
  { x: 0, y: 172, w: 144, h: 8 },
  { x: 176, y: 172, w: 144, h: 8 },
  // The far end of the bridge: walking onto it is enough.
  { x: 144, y: 180, w: 32, h: 20 },
];

export const SOLIDS: readonly Rect[] = [...EDGES, ...HOMES.map((h) => h.solid)];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const feetAt = (p: Point): Rect => ({ x: p.x - FEET.w / 2, y: p.y - FEET.h, w: FEET.w, h: FEET.h });
const blocked = (p: Point) => SOLIDS.some((r) => overlaps(feetAt(p), r));
const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** One step of walking, as in the cottage: each axis moves on its own, so you slide along things. */
export function walk(p: Point, dx: number, dy: number, dt: number): Point {
  if (!dx && !dy) return p;
  const step = (WALK_SPEED * dt) / Math.hypot(dx, dy);
  let next = { ...p };
  const x = { ...next, x: next.x + dx * step };
  if (!blocked(x)) next = x;
  const y = { ...next, y: next.y + dy * step };
  if (!blocked(y)) next = y;
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
export function spotAt(p: Point, open: ReadonlyMap<HomeId, number>): HomeId | 'exit' | null {
  if (inside(p, EXIT)) return 'exit';
  const centre = (r: Rect) => Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
  return HOMES.filter((h) => open.has(h.id) && inside(p, h.zone)).sort((a, b) => centre(a.zone) - centre(b.zone))[0]?.id ?? null;
}

/** A spot to stand by a home, for fixtures and for coming back from a stall: the middle of its zone. */
export function standBy(id: HomeId): Point {
  const z = HOMES.find((h) => h.id === id)!.zone;
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}

/** Seasons with snow on the ground: the square's dressing and its footsteps. */
export const snowy = (season: Season) => season === 'winter';
