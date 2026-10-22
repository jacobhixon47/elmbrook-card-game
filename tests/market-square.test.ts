import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import { EXIT, HOMES, homesFor, openHomes, solidsFor, SPAWN, SQUARE_H, SQUARE_W, STALL_HOME, spotAt, standBy, walk, type Point, type SquarePlace } from '../src/view/market-square';

/** Every spot your feet can reach from the bridge, on a 2px grid. */
function reachable(): Set<string> {
  const key = (p: Point) => `${p.x},${p.y}`;
  const seen = new Set([key(SPAWN)]);
  const queue = [SPAWN];
  while (queue.length) {
    const p = queue.pop()!;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      const moved = walk(p, Math.sign(dx), Math.sign(dy), 2 / 72);
      if (Math.abs(moved.x - n.x) > 1e-6 || Math.abs(moved.y - n.y) > 1e-6) continue;
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return seen;
}

const all = openHomes(HOMES.map((h) => ({ id: Object.entries(STALL_HOME).find(([, home]) => home === h.id)![0] })));

describe('the walkable Night Market', () => {
  it('gives every stall in the codex a home', () => {
    for (const id of codex.stalls.keys()) expect(STALL_HOME[id], id).toBeDefined();
  });

  it('starts you by no stall, just off the bridge', () => {
    expect(spotAt(SPAWN, all)).toBeNull();
    let p = SPAWN;
    for (let t = 0; t < 1; t += 1 / 60) p = walk(p, 0, 1, 1 / 60);
    expect(spotAt(p, all)).toBe('exit');
    expect(p.y).toBeLessThanOrEqual(SQUARE_H);
  });

  it('keeps you in the square: everything you can reach is inside it', () => {
    const spots = reachable();
    for (const k of spots) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      expect(x > 0 && x < SQUARE_W && y > 30 && y <= SQUARE_H, k).toBe(true);
    }
  });

  it('lets you walk up to every home and back to the bridge', () => {
    const spots = [...reachable()].map((k) => k.split(',').map(Number) as [number, number]).map(([x, y]) => ({ x, y }));
    for (const h of HOMES) expect(spots.some((p) => spotAt(p, all) === h.id), h.id).toBe(true);
    expect(spots.some((p) => spotAt(p, all) === 'exit')).toBe(true);
  });

  it('stands you by a home where its prompt shows', () => {
    for (const h of HOMES) expect(spotAt(standBy(h.id), all)).toBe(h.id);
  });

  it('only answers for the stalls open tonight', () => {
    const open = openHomes([{ id: 'lantern-seller' }, { id: 'fence' }, { id: 'hearth-trader' }]);
    expect([...open.entries()]).toEqual([['lantern', 0], ['fence', 1], ['fire', 2]]);
    expect(spotAt(standBy('lantern'), open)).toBe('lantern');
    expect(spotAt(standBy('moth'), open)).toBeNull();
    expect(spotAt({ x: EXIT.x + EXIT.w / 2, y: EXIT.y + 4 }, open)).toBe('exit');
  });

  it('puts each season\'s two stalls on either side', () => {
    expect([STALL_HOME['seed-swapper'], STALL_HOME['blossom-oracle']]).toEqual(['west', 'east']);
    expect([STALL_HOME['firefly-games'], STALL_HOME['nectar-trader']]).toEqual(['west', 'east']);
    expect([STALL_HOME['cider-press'], STALL_HOME['harvest-auction']]).toEqual(['west', 'east']);
  });
});

/** Every spot your feet can reach from the bridge in tonight's square. */
function reachableIn(place: SquarePlace): Point[] {
  const solids = solidsFor(homesFor(place));
  const key = (p: Point) => `${p.x},${p.y}`;
  const seen = new Map([[key(SPAWN), SPAWN]]);
  const queue = [SPAWN];
  while (queue.length) {
    const p = queue.pop()!;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      const moved = walk(p, Math.sign(dx), Math.sign(dy), 2 / 72, solids);
      if (Math.abs(moved.x - n.x) > 1e-6 || Math.abs(moved.y - n.y) > 1e-6 || seen.has(key(n))) continue;
      seen.set(key(n), n);
      queue.push(n);
    }
  }
  return [...seen.values()];
}

describe('the festival squares (Jacob, Oct 21)', () => {
  it('give every fair stall a home: west, top and east', () => {
    for (const fair of codex.fairs.values()) expect(fair.stalls.map((st) => STALL_HOME[st.id])).toEqual(['west', 'top', 'east']);
  });

  it('set out no Night Market stalls: the rest of the ring is dressing', () => {
    const fair = homesFor('fair').map((h) => h.id);
    expect(fair).not.toContain('fortune');
    expect(fair).not.toContain('name');
    expect(fair).not.toContain('rug');
    expect(homesFor('vigil').map((h) => h.id)).toEqual(expect.arrayContaining(['solstice', 'gifts', 'top']));
  });

  it('let you walk up to each fair stall, the Solstice Fire, the gifts and the bridge', () => {
    for (const fair of codex.fairs.values()) {
      const open = openHomes(fair.stalls);
      const spots = reachableIn('fair');
      for (const home of ['west', 'top', 'east'] as const) {
        expect(spots.some((p) => spotAt(p, open, homesFor('fair')) === home), home).toBe(true);
        expect(spotAt(standBy(home), open, homesFor('fair'))).toBe(home);
      }
      expect(spots.some((p) => spotAt(p, open, homesFor('fair')) === 'exit')).toBe(true);
    }
    const open = openHomes([{ id: 'solstice-fire' }, { id: 'vigil-gifts' }]);
    expect([...open.entries()]).toEqual([['solstice', 0], ['gifts', 1]]);
    const spots = reachableIn('vigil');
    for (const home of ['solstice', 'gifts'] as const) {
      expect(spots.some((p) => spotAt(p, open, homesFor('vigil')) === home), home).toBe(true);
      expect(spotAt(standBy(home), open, homesFor('vigil'))).toBe(home);
    }
    for (const p of spots) expect(p.x > 0 && p.x < SQUARE_W && p.y > 30 && p.y <= SQUARE_H).toBe(true);
  });
});
