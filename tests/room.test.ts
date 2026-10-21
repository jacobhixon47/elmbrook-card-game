import { describe, expect, it } from 'vitest';
import { SEASONS, type Season } from '../src/core';
import { DRESSING_SPRITES } from '../src/art/scenes/cottage-room';
import { DOORSTEP, DRESSING, facing, onRug, ROOM_H, ROOM_W, SOLIDS, SPAWN, STATIONS, standBy, stationAt, walk, walkingOut, type Point } from '../src/view/room';

/** Walks in one direction for a while, a frame at a time. */
const hold = (p: Point, dx: number, dy: number, seconds: number) => {
  let at = p;
  for (let t = 0; t < seconds; t += 1 / 60) at = walk(at, dx, dy, 1 / 60);
  return at;
};

/** Every spot your feet can reach from the door, on a 2px grid. */
function reachable(season?: Season): Set<string> {
  const key = (p: Point) => `${p.x},${p.y}`;
  const seen = new Set([key(SPAWN)]);
  const queue = [SPAWN];
  while (queue.length) {
    const p = queue.pop()!;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      // A step of exactly 2px: walk() moves WALK_SPEED * dt, so pick dt to match.
      const moved = walk(p, Math.sign(dx), Math.sign(dy), 2 / 72, season);
      if (Math.abs(moved.x - n.x) > 1e-6 || Math.abs(moved.y - n.y) > 1e-6) continue;
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

describe('the walkable cottage', () => {
  it('starts you on open floor, by no station', () => {
    expect(walk(SPAWN, 0, -1, 0.1)).not.toEqual(SPAWN);
    expect(stationAt(SPAWN)).toBeNull();
  });

  it('lets you walk out of the front door, in every season', () => {
    for (const season of SEASONS) {
      let at = SPAWN;
      for (let t = 0; t < 2; t += 1 / 60) at = walk(at, 0, 1, 1 / 60, season);
      expect(walkingOut(at, 1)).toBe(true);
      expect(walkingOut(at, 0)).toBe(false);
    }
    // Walking down by the side wall isn't the door.
    expect(walkingOut(hold({ x: 40, y: 150 }, 0, 1, 2), 1)).toBe(false);
  });

  it('keeps you inside the walls', () => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const p = hold(SPAWN, dx, dy, 10);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(ROOM_W);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(ROOM_H);
    }
    // The door is used, not walked out of.
    expect(hold(SPAWN, 0, 1, 10).y).toBeLessThan(ROOM_H - 4);
  });

  it('slides along a wall when you walk into it diagonally', () => {
    const atWall = hold({ x: 100, y: 80 }, 0, -1, 5);
    const slid = hold(atWall, 1, -1, 0.5);
    expect(slid.y).toBeCloseTo(atWall.y);
    expect(slid.x).toBeGreaterThan(atWall.x + 10);
  });

  it('walks diagonally no faster than straight', () => {
    const p = { x: 160, y: 110 };
    const straight = walk(p, 1, 0, 0.1);
    const diag = walk(p, 1, 1, 0.1);
    expect(Math.hypot(diag.x - p.x, diag.y - p.y)).toBeCloseTo(straight.x - p.x);
  });

  it('knows the rug, where footsteps are soft', () => {
    expect(onRug({ x: 230, y: 92 })).toBe(true);
    expect(onRug({ x: 160, y: 128 })).toBe(true);
    expect(onRug(SPAWN)).toBe(false);
    expect(onRug(standBy('workbench'))).toBe(false);
  });

  it('faces the way you walk, and keeps facing when you stop', () => {
    expect(facing(0, 1, 'up')).toBe('down');
    expect(facing(-1, 0, 'up')).toBe('left');
    expect(facing(1, -1, 'down')).toBe('up');
    expect(facing(0, 0, 'right')).toBe('right');
  });

  it.each([undefined, ...SEASONS])('can reach every station in %s, and standing by one uses that one', (season) => {
    const open = reachable(season);
    for (const st of STATIONS) {
      const spot = standBy(st.id);
      expect(stationAt(spot)?.id, st.id).toBe(st.id);
      expect(SOLIDS.some((r) => spot.x > r.x && spot.x < r.x + r.w && spot.y > r.y && spot.y < r.y + r.h), st.id).toBe(false);
      // Some reachable spot is inside the zone.
      const z = st.zone;
      const inZone = [...open].some((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h && stationAt({ x, y })?.id === st.id;
      });
      expect(inZone, st.id).toBe(true);
    }
  });

  it('dresses each season with sprites that exist, clear of the stations and the way in', () => {
    for (const season of SEASONS) {
      for (const d of DRESSING[season]) {
        expect(DRESSING_SPRITES as readonly string[]).toContain(d.id);
        if (!d.solid) continue;
        for (const st of STATIONS) expect(overlap(d.solid, st.zone), `${d.id} by the ${st.id}`).toBe(false);
      }
      // Coming home, you step in from the doorstep to where you'd spawn.
      expect(walk(DOORSTEP, 0, -1, (DOORSTEP.y - SPAWN.y) / 72, season).y).toBeCloseTo(SPAWN.y);
    }
  });
});

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
