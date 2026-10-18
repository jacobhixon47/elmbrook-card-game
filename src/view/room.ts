import type { Season } from '../core';

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

export type StationId = 'bookshelf' | 'lectern' | 'pinboard' | 'calendar' | 'cauldron' | 'workbench' | 'door';

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
  { id: 'bookshelf', verb: 'Read the Codex', at: { x: 12, y: 6 }, solid: { x: 12, y: 48, w: 36, h: 12 }, zone: { x: 8, y: 60, w: 46, h: 18 } },
  { id: 'lectern', verb: 'Open the Almanac', at: { x: 64, y: 44 }, solid: { x: 66, y: 60, w: 14, h: 8 }, zone: { x: 60, y: 68, w: 28, h: 18 } },
  { id: 'pinboard', verb: 'Keepsake box', at: { x: 98, y: 9 }, solid: null, zone: { x: 94, y: 48, w: 34, h: 16 } },
  { id: 'calendar', verb: 'Choose a Year', at: { x: 199, y: 11 }, solid: null, zone: { x: 192, y: 48, w: 30, h: 16 } },
  { id: 'cauldron', verb: 'Witch and cauldron', at: { x: 272, y: 42 }, solid: { x: 274, y: 62, w: 32, h: 12 }, zone: { x: 268, y: 74, w: 42, h: 16 } },
  { id: 'workbench', verb: 'Spend Reputation', at: { x: 10, y: 90 }, solid: { x: 10, y: 106, w: 40, h: 16 }, zone: { x: 50, y: 102, w: 20, h: 24 } },
  { id: 'door', verb: 'Set out', at: { x: 144, y: 160 }, solid: null, zone: { x: 140, y: 150, w: 40, h: 22 } },
];

/** The hearth in the chimney breast at the middle of the back wall: where the fire sits. */
export const HEARTH: Point = { x: 160, y: 40 };

/** Furniture that only takes up floor: rugs, the cat, the armchair, the bed, a plant. */
export const PROPS: readonly { id: string; at: Point; solid: Rect | null }[] = [
  { id: 'rug', at: { x: 106, y: 66 }, solid: null },
  { id: 'round-rug', at: { x: 130, y: 114 }, solid: null },
  { id: 'nightstand', at: { x: 51, y: 120 }, solid: { x: 52, y: 130, w: 10, h: 6 } },
  { id: 'cat', at: { x: 118, y: 72 }, solid: { x: 119, y: 77, w: 14, h: 5 } },
  { id: 'armchair', at: { x: 218, y: 74 }, solid: { x: 220, y: 92, w: 24, h: 10 } },
  { id: 'side-table', at: { x: 290, y: 98 }, solid: { x: 290, y: 110, w: 20, h: 8 } },
  { id: 'bed', at: { x: 12, y: 132 }, solid: { x: 12, y: 140, w: 36, h: 30 } },
  { id: 'plant', at: { x: 290, y: 146 }, solid: { x: 292, y: 162, w: 14, h: 8 } },
];

/**
 * What the house puts out for the season you'll play next (GDD §13): wall-hung things and things on
 * the floor, some of which you walk round. Drawn by `roomSprite`.
 */
export const DRESSING: Record<Season, readonly { id: string; at: Point; solid: Rect | null; flat?: boolean }[]> = {
  spring: [
    { id: 'garland-spring', at: { x: 51, y: 1 }, solid: null },
    { id: 'garland-spring', at: { x: 219, y: 1 }, solid: null },
    { id: 'blossoms', at: { x: 110, y: 138 }, solid: { x: 115, y: 162, w: 10, h: 6 } },
  ],
  summer: [
    { id: 'firefly-jar', at: { x: 237, y: 18 }, solid: null },
    { id: 'sunflowers', at: { x: 192, y: 144 }, solid: { x: 195, y: 162, w: 10, h: 6 } },
  ],
  autumn: [
    { id: 'garland-autumn', at: { x: 51, y: 1 }, solid: null },
    { id: 'garland-autumn', at: { x: 219, y: 1 }, solid: null },
    { id: 'pumpkins', at: { x: 108, y: 154 }, solid: { x: 109, y: 160, w: 22, h: 8 } },
    { id: 'leaves', at: { x: 140, y: 156 }, solid: null, flat: true },
  ],
  winter: [
    { id: 'garland-winter', at: { x: 51, y: 1 }, solid: null },
    { id: 'garland-winter', at: { x: 219, y: 1 }, solid: null },
    { id: 'sill-snow', at: { x: 51, y: 27 }, solid: null },
    { id: 'sill-snow', at: { x: 219, y: 27 }, solid: null },
    { id: 'snowdrift', at: { x: 138, y: 164 }, solid: null, flat: true },
  ],
};

/** The light the season casts over the room: a palette colour and how strongly it tints. */
export const SEASON_LIGHT: Record<Season, { color: 'L' | 'Y' | 'o' | 'x'; alpha: number }> = {
  spring: { color: 'L', alpha: 0.06 },
  summer: { color: 'Y', alpha: 0.08 },
  autumn: { color: 'o', alpha: 0.12 },
  winter: { color: 'x', alpha: 0.14 },
};

/** Whether you're standing on a rug, where footsteps are soft: the long one by the fire or the round one. */
export function onRug(p: Point): boolean {
  const rug = PROPS.find((x) => x.id === 'rug')!.at;
  const round = PROPS.find((x) => x.id === 'round-rug')!.at;
  const inRound = ((p.x - round.x - 30) / 30) ** 2 + ((p.y - round.y - 14) / 14) ** 2 <= 1;
  return inRound || (p.x >= rug.x && p.x <= rug.x + RUG.w && p.y >= rug.y && p.y <= rug.y + RUG.h);
}
/** The rug's size, in room pixels. */
export const RUG = { w: 104, h: 40 };

/** Where you stand when you come in: just inside the front door, facing in. */
export const SPAWN: Point = { x: 160, y: 148 };
/** Where you step in from when you come home from a run, in the doorway. */
export const DOORSTEP: Point = { x: 160, y: 171 };

/** Your feet, which is what collides: centred on x, resting on y. */
const FEET = { w: 10, h: 5 };

const WALLS: readonly Rect[] = [
  { x: 0, y: 0, w: ROOM_W, h: FLOOR_TOP },
  { x: 0, y: 0, w: 8, h: ROOM_H },
  { x: ROOM_W - 8, y: 0, w: 8, h: ROOM_H },
  // The bottom wall, with the doorway in the middle.
  { x: 0, y: 172, w: 144, h: 8 },
  { x: 176, y: 172, w: 144, h: 8 },
  // The hearth's stone apron, in front of the fire.
  { x: 130, y: 48, w: 60, h: 10 },
  // The doorstep: the door is used, not walked through.
  { x: 144, y: 174, w: 32, h: 6 },
];

/** Everything you can't walk through, whatever the season. */
export const SOLIDS: readonly Rect[] = [...WALLS, ...STATIONS.flatMap((s) => (s.solid ? [s.solid] : [])), ...PROPS.flatMap((p) => (p.solid ? [p.solid] : []))];
const solidsIn = (season?: Season): readonly Rect[] => (season ? [...SOLIDS, ...DRESSING[season].flatMap((d) => (d.solid ? [d.solid] : []))] : SOLIDS);

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const feetAt = (p: Point): Rect => ({ x: p.x - FEET.w / 2, y: p.y - FEET.h, w: FEET.w, h: FEET.h });
const blocked = (p: Point, season?: Season) => solidsIn(season).some((r) => overlaps(feetAt(p), r));

/**
 * One step of walking: `dx`, `dy` are the held directions (-1, 0 or 1), `dt` seconds. Each axis
 * moves on its own, so walking diagonally into a wall slides along it. `season` adds its dressing.
 */
export function walk(p: Point, dx: number, dy: number, dt: number, season?: Season): Point {
  if (!dx && !dy) return p;
  const len = Math.hypot(dx, dy);
  const step = (WALK_SPEED * dt) / len;
  let next = { ...p };
  const x = { ...next, x: next.x + dx * step };
  if (!blocked(x, season)) next = x;
  const y = { ...next, y: next.y + dy * step };
  if (!blocked(y, season)) next = y;
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
