// The walkable cottage (GDD §13, M4.5): one open-plan room seen from above, where each corner holds
// a cross-run system. Pure, so tests can walk it. Room space is a 320x180 grid drawn at 2x.

export const ROOM_W = 320;
export const ROOM_H = 180;
/** Screen pixels per room pixel. */
export const ROOM_SCALE = 2;
/** Where the floor starts below the back wall. */
export const FLOOR_TOP = 48;
/** Room pixels walked per second. */
export const WALK_SPEED = 72;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Facing = 'down' | 'up' | 'left' | 'right';

export type StationId = 'bookshelf' | 'lectern' | 'pinboard' | 'calendar' | 'wardrobe' | 'workbench' | 'door';

export type Station = {
  id: StationId;
  /** The prompt shown when you stand by it: "F  <verb>". */
  verb: string;
  /** Where its sprite sits (top-left, room pixels). */
  at: Point;
  /** The floor it stands on, which you can't walk through. Wall-hung things have none. */
  solid: Rect | null;
  /** Stand with your feet in here to use it. */
  zone: Rect;
};

/** Each system's spot in the room (GDD §13). */
export const STATIONS: readonly Station[] = [
  { id: 'bookshelf', verb: 'Read the Codex', at: { x: 14, y: 8 }, solid: { x: 14, y: 48, w: 36, h: 12 }, zone: { x: 10, y: 60, w: 46, h: 18 } },
  { id: 'lectern', verb: 'Open the Almanac', at: { x: 62, y: 48 }, solid: { x: 64, y: 62, w: 12, h: 8 }, zone: { x: 58, y: 70, w: 26, h: 18 } },
  { id: 'pinboard', verb: 'Keepsake box', at: { x: 96, y: 10 }, solid: null, zone: { x: 92, y: 48, w: 36, h: 16 } },
  { id: 'calendar', verb: 'Choose a Year', at: { x: 200, y: 12 }, solid: null, zone: { x: 194, y: 48, w: 30, h: 16 } },
  { id: 'wardrobe', verb: 'Witch and cauldron', at: { x: 270, y: 8 }, solid: { x: 270, y: 50, w: 34, h: 12 }, zone: { x: 264, y: 62, w: 44, h: 18 } },
  { id: 'workbench', verb: 'Spend Reputation', at: { x: 10, y: 94 }, solid: { x: 10, y: 108, w: 40, h: 16 }, zone: { x: 50, y: 104, w: 20, h: 24 } },
  { id: 'door', verb: 'Set out', at: { x: 144, y: 160 }, solid: null, zone: { x: 140, y: 150, w: 40, h: 22 } },
];

/** Things in the room that only take up floor: the hearth, the bed, a plant. */
export const PROPS: readonly { id: string; at: Point; solid: Rect | null }[] = [
  { id: 'hearth', at: { x: 278, y: 92 }, solid: { x: 280, y: 116, w: 32, h: 16 } },
  { id: 'bed', at: { x: 12, y: 136 }, solid: { x: 12, y: 142, w: 34, h: 28 } },
  { id: 'plant', at: { x: 290, y: 148 }, solid: { x: 292, y: 162, w: 14, h: 8 } },
  { id: 'rug', at: { x: 116, y: 92 }, solid: null },
];

/** Where you stand when you come in: just inside the front door, facing in. */
export const SPAWN: Point = { x: 160, y: 148 };

/** Your feet, which is what collides: centred on x, resting on y. */
const FEET = { w: 10, h: 5 };

const WALLS: readonly Rect[] = [
  { x: 0, y: 0, w: ROOM_W, h: FLOOR_TOP },
  { x: 0, y: 0, w: 8, h: ROOM_H },
  { x: ROOM_W - 8, y: 0, w: 8, h: ROOM_H },
  // The bottom wall, with the doorway in the middle.
  { x: 0, y: 172, w: 144, h: 8 },
  { x: 176, y: 172, w: 144, h: 8 },
  // The doorstep: the door is used, not walked through.
  { x: 144, y: 174, w: 32, h: 6 },
];

/** Everything you can't walk through. */
export const SOLIDS: readonly Rect[] = [...WALLS, ...STATIONS.flatMap((s) => (s.solid ? [s.solid] : [])), ...PROPS.flatMap((p) => (p.solid ? [p.solid] : []))];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const feetAt = (p: Point): Rect => ({ x: p.x - FEET.w / 2, y: p.y - FEET.h, w: FEET.w, h: FEET.h });
const blocked = (p: Point) => SOLIDS.some((r) => overlaps(feetAt(p), r));

/**
 * One step of walking: `dx`, `dy` are the held directions (-1, 0 or 1), `dt` seconds. Each axis
 * moves on its own, so walking diagonally into a wall slides along it.
 */
export function walk(p: Point, dx: number, dy: number, dt: number): Point {
  if (!dx && !dy) return p;
  const len = Math.hypot(dx, dy);
  const step = (WALK_SPEED * dt) / len;
  let next = { ...p };
  const x = { ...next, x: next.x + dx * step };
  if (!blocked(x)) next = x;
  const y = { ...next, y: next.y + dy * step };
  if (!blocked(y)) next = y;
  return next;
}

/** Which way you face after walking this way; standing still keeps the last. */
export function facing(dx: number, dy: number, last: Facing): Facing {
  if (dy > 0) return 'down';
  if (dy < 0) return 'up';
  if (dx < 0) return 'left';
  if (dx > 0) return 'right';
  return last;
}

/** The station you're standing by, if any: the nearest whose zone holds your feet. */
export function stationAt(p: Point): Station | null {
  const inside = (r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const centre = (r: Rect) => Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
  return STATIONS.filter((s) => inside(s.zone)).sort((a, b) => centre(a.zone) - centre(b.zone))[0] ?? null;
}

/** A spot to stand by a station, for fixtures: the middle of its zone. */
export function standBy(id: StationId): Point {
  const z = STATIONS.find((s) => s.id === id)!.zone;
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}
