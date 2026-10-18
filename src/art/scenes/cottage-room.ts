import { seedRng } from '../../core/rng';
import type { Season } from '../../core';
import type { PaletteKey } from '../palette';
import { Pixmap } from '../pixmap';
import { pick, rand, type Rng } from './town';

// The walkable cottage (GDD §13, M4.5), seen from above like Stardew: a timber-and-plaster back wall
// with a window, plank floor, and furniture for each cross-run system. Room space is 320x180, drawn
// at 2x. Each station and prop is its own sprite so the scene can sort it with you and light it up.

export const ROOM_SPRITE_W = 320;
export const ROOM_SPRITE_H = 180;

const WOOD: readonly PaletteKey[] = ['k', 'b', 'B', 'n', 'a'];
const BOOKS: readonly PaletteKey[] = ['r', 'R', 'U', 'G', 'P', 'y', 'o', 'T', 'i'];

/** The code-drawn window view by season: sky, far hills, near hills. */
const VIEW: Record<Season, [PaletteKey, PaletteKey, PaletteKey]> = {
  spring: ['c', 'l', 'G'],
  summer: ['X', 'L', 'l'],
  autumn: ['Y', 'o', 'n'],
  winter: ['m', 'w', 'e'],
};

/** Walls, floor and window: everything you walk on or can't reach. */
export function roomShell(): Pixmap {
  const p = new Pixmap(ROOM_SPRITE_W, ROOM_SPRITE_H);
  const rng: Rng = { s: seedRng('cottage-room') };
  const r = () => rand(rng);

  // Floor: long planks, staggered seams, a little grain.
  for (let row = 0; row * 6 < ROOM_SPRITE_H; row++) {
    const y0 = 48 + row * 6;
    const offset = (row * 37) % 60;
    for (let y = y0; y < y0 + 6; y++) {
      for (let x = 0; x < ROOM_SPRITE_W; x++) {
        const plank = row * 7 + Math.floor((x + offset) / 60);
        const seam = y === y0 + 5 || (x + offset) % 60 === 0;
        // Each plank its own shade; a knot here and there.
        const knot = (x * 13 + plank * 29) % 97 === 0 && y === y0 + 2;
        if (seam || knot) p.set(x, y, 'B');
        else p.shade(x, y, WOOD, y === y0 ? 0.8 : [0.75, 0.7, 0.75, 0.66][plank % 4]!);
      }
    }
  }
  // Back wall: plaster between timber posts, a wood wainscot along the bottom.
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < ROOM_SPRITE_W; x++) {
      if (y >= 36) p.set(x, y, y === 36 ? 'n' : y === 47 ? 'k' : x % 12 === 0 ? 'b' : 'B');
      else p.shade(x, y, ['h', 'H', 'a', 'w'], 0.62 + (r() - 0.5) * 0.05 - y * 0.004);
    }
  }
  for (const bx of [8, 88, 130, 190, 232, 262, 311]) for (let y = 0; y < 36; y++) p.shade(bx, y, WOOD, 0.35).shade(bx + 1, y, WOOD, 0.5);
  p.hline(0, ROOM_SPRITE_W - 1, 0, 'k').hline(0, ROOM_SPRITE_W - 1, 1, 'b');
  // The window's panes are left clear: the view behind them is its own image (the shop window's
  // painted view, graded for the season, or `roomView` with ?backdrops=code).
  for (let y = 8; y < 34; y++) for (let x = 136; x < 184; x++) p.clear(x, y);
  p.strokeRect(135, 7, 50, 28, 'b').strokeRect(134, 6, 52, 30, 'k');
  p.fillRect(159, 7, 2, 28, 'b').fillRect(135, 20, 50, 1, 'b');
  p.fillRect(132, 35, 56, 3, 'n').hline(132, 187, 37, 'b');
  // Side walls and the front wall, in dark timber.
  p.fillRect(0, 0, 8, ROOM_SPRITE_H, 'b').fillRect(ROOM_SPRITE_W - 8, 0, 8, ROOM_SPRITE_H, 'b');
  for (let y = 0; y < ROOM_SPRITE_H; y++) p.set(7, y, 'B').set(ROOM_SPRITE_W - 8, y, 'B').set(0, y, 'k').set(ROOM_SPRITE_W - 1, y, 'k');
  p.fillRect(0, 172, ROOM_SPRITE_W, 8, 'b').hline(0, ROOM_SPRITE_W - 1, 172, 'B').hline(0, ROOM_SPRITE_W - 1, 179, 'k');
  // The doorway itself, open to the night step (the door sprite sits over it).
  p.fillRect(144, 172, 32, 8, 'q');
  return p;
}

/** The window's view drawn in code, for ?backdrops=code: sky and two lines of hills. 48x26. */
export function roomView(season: Season): Pixmap {
  const p = new Pixmap(48, 26);
  const [sky, far, near] = VIEW[season];
  p.fillRect(0, 0, 48, 26, sky);
  for (let x = 0; x < 48; x++) {
    const h1 = 12 + Math.round(Math.sin((x + 136) / 7) * 2);
    const h2 = 18 + Math.round(Math.sin((x + 136) / 4 + 1) * 1.5);
    for (let y = h1; y < 26; y++) p.set(x, y, y >= h2 ? near : far);
  }
  if (season === 'winter') for (let x = 0; x < 48; x += 3) p.set(x, 12 + Math.round(Math.sin((x + 136) / 7) * 2), 'W');
  return p;
}

/** A station's or prop's sprite. */
export function roomSprite(id: string): Pixmap {
  switch (id) {
    case 'bookshelf': return bookshelf();
    case 'lectern': return lectern();
    case 'pinboard': return pinboard();
    case 'calendar': return calendar();
    case 'wardrobe': return wardrobe();
    case 'workbench': return workbench();
    case 'door': return door();
    case 'hearth': return hearth();
    case 'bed': return bed();
    case 'plant': return plant();
    case 'rug': return rug();
    case 'garland-spring': return garland(['I', 'i', 'W'], 'l');
    case 'garland-autumn': return garland(['o', 'R', 'y'], 'n');
    case 'garland-winter': return garland(['R', 'R', 'W'], 'G');
    case 'blossoms': return blossoms();
    case 'firefly-jar': return fireflyJar();
    case 'sunflowers': return sunflowers();
    case 'pumpkins': return pumpkins();
    case 'leaves': return leaves();
    case 'sill-snow': return sillSnow();
    case 'snowdrift': return snowdrift();
    default: throw new Error(`no room sprite ${id}`);
  }
}

/** The same sprite with a bright 1px outline, for when you can use it. One pixel bigger all round. */
export function litSprite(src: Pixmap): Pixmap {
  const p = new Pixmap(src.width + 2, src.height + 2);
  p.blit(src, 1, 1);
  return p.outline('Y');
}

function bookshelf(): Pixmap {
  const p = new Pixmap(36, 52);
  const rng: Rng = { s: seedRng('bookshelf') };
  p.fillRect(0, 0, 36, 52, 'B').strokeRect(0, 0, 36, 52, 'k').fillRect(1, 1, 34, 3, 'n');
  for (let s = 0; s < 4; s++) {
    const y0 = 5 + s * 11;
    p.fillRect(3, y0, 30, 9, 'b');
    let x = 4;
    while (x < 32) {
      const w = pick(rng, [2, 2, 3, 3, 4]);
      const c = pick(rng, BOOKS);
      const h = 6 + ((x * 5 + s) % 3);
      if (x + w > 32) break;
      p.fillRect(x, y0 + 9 - h, w, h, c);
      p.set(x, y0 + 9 - h, 'W');
      x += w + ((x + s) % 5 === 0 ? 1 : 0);
    }
    p.hline(2, 33, y0 + 9, 'n');
  }
  return p;
}

function lectern(): Pixmap {
  const p = new Pixmap(16, 22);
  p.fillRect(6, 9, 4, 11, 'B').fillRect(3, 19, 10, 3, 'b');
  p.fillRect(0, 2, 16, 8, 'n').strokeRect(0, 2, 16, 8, 'b');
  p.fillRect(2, 0, 6, 7, 'w').fillRect(8, 0, 6, 7, 'W').hline(3, 6, 2, 'h').hline(3, 6, 4, 'h').hline(9, 12, 2, 'h');
  p.fillRect(7, 0, 2, 9, 'R');
  return p;
}

function pinboard(): Pixmap {
  const p = new Pixmap(28, 24);
  p.fillRect(0, 0, 28, 24, 'b').fillRect(2, 2, 24, 20, 'H');
  for (const [x, y, w, h, c] of [[4, 4, 8, 7, 'w'], [14, 3, 9, 6, 'Y'], [5, 13, 7, 7, 'I'], [15, 11, 9, 9, 'w']] as const) {
    p.fillRect(x, y, w, h, c).set(x + Math.floor(w / 2), y, 'R');
    p.hline(x + 1, x + w - 2, y + 3, 'h');
  }
  return p;
}

function calendar(): Pixmap {
  const p = new Pixmap(18, 22);
  p.set(9, 0, 'k').set(8, 1, 'h').set(10, 1, 'h');
  p.fillRect(1, 2, 16, 20, 'w').strokeRect(1, 2, 16, 20, 'h').fillRect(1, 2, 16, 5, 'R');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) p.set(4 + c * 3, 9 + r * 3, r === 1 && c === 2 ? 'R' : 'h');
  return p;
}

function wardrobe(): Pixmap {
  const p = new Pixmap(34, 54);
  p.fillRect(0, 8, 34, 46, 'B').strokeRect(0, 8, 34, 46, 'k').fillRect(0, 6, 34, 4, 'b');
  p.strokeRect(3, 12, 13, 38, 'b').strokeRect(18, 12, 13, 38, 'b');
  p.set(15, 30, 'y').set(18, 30, 'y');
  // A spare pointed hat on top.
  for (let i = 0; i < 6; i++) p.hline(14 - i, 20 + i, i, i === 5 ? 'y' : 'P');
  p.set(17, 0, 'v');
  return p;
}

function workbench(): Pixmap {
  const p = new Pixmap(40, 30);
  p.fillRect(0, 6, 40, 12, 'n').strokeRect(0, 6, 40, 12, 'b').hline(1, 38, 7, 'a');
  p.fillRect(2, 18, 4, 12, 'B').fillRect(34, 18, 4, 12, 'B').fillRect(2, 23, 36, 2, 'b');
  // On it: a jar of something blue, a scroll, a little stack of coins.
  p.fillRect(5, 0, 6, 9, 'c').strokeRect(5, 0, 6, 9, 'u').fillRect(5, 0, 6, 2, 'B');
  p.fillRect(15, 8, 12, 4, 'w').set(15, 8, 'h').set(26, 11, 'h');
  for (let i = 0; i < 3; i++) p.hline(31, 35, 10 - i * 2, 'y').hline(31, 35, 11 - i * 2, 'o');
  return p;
}

function door(): Pixmap {
  const p = new Pixmap(32, 20);
  // A doormat inside, then the door standing open onto the step.
  p.fillRect(2, 0, 28, 10, 'r').strokeRect(2, 0, 28, 10, 'j');
  for (let x = 5; x < 28; x += 4) p.set(x, 4, 'y').set(x + 1, 5, 'y');
  p.fillRect(0, 12, 32, 8, 'k').fillRect(1, 13, 30, 7, 'q');
  p.fillRect(1, 12, 3, 8, 'B').fillRect(28, 12, 3, 8, 'B');
  return p;
}

function hearth(): Pixmap {
  const p = new Pixmap(34, 40);
  p.fillRect(0, 4, 34, 36, 'S').strokeRect(0, 4, 34, 36, 'k');
  for (let y = 6; y < 39; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < 32; x += 8) p.hline(x, x + 5, y, 'e');
  p.fillRect(0, 0, 34, 6, 'B').hline(0, 33, 0, 'n');
  p.fillRect(7, 16, 20, 20, 'k');
  p.fillEllipse(17, 32, 8, 5, 'R').fillEllipse(17, 31, 5, 4, 'o').fillEllipse(17, 30, 2.5, 3, 'y');
  p.fillRect(9, 34, 16, 2, 'b');
  return p;
}

function bed(): Pixmap {
  const p = new Pixmap(34, 34);
  p.fillRect(0, 0, 34, 34, 'B').strokeRect(0, 0, 34, 34, 'k');
  p.fillRect(3, 3, 28, 9, 'w').strokeRect(3, 3, 28, 9, 'a');
  p.fillRect(2, 13, 30, 19, 'P');
  for (let y = 13; y < 32; y += 5) for (let x = 2; x < 32; x += 6) p.fillRect(x + ((y / 5) % 2 ? 3 : 0), y + 1, 3, 3, 'v');
  p.hline(2, 31, 13, 'p');
  return p;
}

function plant(): Pixmap {
  const p = new Pixmap(16, 22);
  p.fillRect(3, 14, 10, 8, 'H').strokeRect(3, 14, 10, 8, 'h').hline(2, 13, 14, 'h');
  for (const [cx, cy, rx, ry] of [[8, 8, 6, 5], [4, 6, 3, 4], [12, 5, 3, 4], [8, 2, 3, 3]] as const) p.fillEllipse(cx, cy, rx, ry, 'G');
  for (const [x, y] of [[6, 5], [10, 3], [5, 9], [11, 8], [8, 1]] as const) p.set(x, y, 'l');
  return p;
}

function rug(): Pixmap {
  const p = new Pixmap(88, 52);
  p.fillEllipse(44, 26, 44, 26, 'j').fillEllipse(44, 26, 42, 24, 'r').fillEllipse(44, 26, 36, 19, 'R').fillEllipse(44, 26, 33, 16, 'r');
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    p.set(Math.round(44 + Math.cos(t) * 39), Math.round(26 + Math.sin(t) * 21.5), 'y');
  }
  p.fillEllipse(44, 26, 8, 5, 'y').fillEllipse(44, 26, 5, 3, 'R');
  return p;
}

// The season's dressing (M4.5 part 2): what the house puts out for the season you'll play next.
// Where each goes is `DRESSING` in view/room.ts.
export const DRESSING_SPRITES = ['garland-spring', 'garland-autumn', 'garland-winter', 'blossoms', 'firefly-jar', 'sunflowers', 'pumpkins', 'leaves', 'sill-snow', 'snowdrift'] as const;

/** A swag of leaves and blooms over the window: `bloom` colours on a `leaf` vine. 60x12. */
function garland(bloom: readonly PaletteKey[], leaf: PaletteKey): Pixmap {
  const p = new Pixmap(60, 12);
  const sag = (x: number) => 2 + Math.round(Math.sin((x / 59) * Math.PI) * 5);
  for (let x = 0; x < 60; x++) {
    const y = sag(x);
    p.set(x, y, leaf).set(x, y + 1, leaf);
    // Leaf tufts above and below the vine.
    if (x % 3 === 0) p.set(x, y - 1, leaf).set(x + 1, y + 2, leaf);
  }
  for (let i = 0, x = 3; x < 57; x += 5, i++) {
    const y = sag(x);
    p.fillRect(x, y - 1, 2, 2, bloom[i % bloom.length]!).set(x + 1, y + 1, bloom[(i + 1) % bloom.length]!);
  }
  p.fillRect(0, 0, 2, 4, 'b').fillRect(58, 0, 2, 4, 'b');
  return p.outline('k');
}

/** Spring: blossom branches in a tall jug by the door. 18x30. */
function blossoms(): Pixmap {
  const p = new Pixmap(18, 30);
  p.fillRect(5, 18, 8, 12, 'm').strokeRect(5, 18, 8, 12, 'e').fillRect(6, 16, 6, 3, 'm').hline(6, 11, 16, 'e');
  p.hline(6, 11, 22, 'U').hline(6, 11, 23, 'U');
  // Branches, then the blossom along them.
  for (const [x0, x1, top] of [[8, 3, 4], [9, 14, 2], [9, 9, 0], [8, 1, 10], [10, 16, 9]] as const) {
    for (let y = 17; y >= top; y--) p.set(Math.round(x0 + ((x1 - x0) * (17 - y)) / (17 - top)), y, 'B');
  }
  for (const [x, y] of [[3, 4], [4, 7], [14, 2], [12, 5], [9, 0], [9, 4], [1, 10], [3, 12], [16, 9], [14, 12], [6, 9], [11, 9]] as const) {
    p.fillRect(x - 1, y, 2, 2, 'I').set(x, y, 'W');
  }
  return p.outline('k');
}

/** Summer: a jar of fireflies on the windowsill. 10x12. */
function fireflyJar(): Pixmap {
  const p = new Pixmap(10, 12);
  p.fillRect(1, 3, 8, 9, 'Z').strokeRect(1, 3, 8, 9, 'c').fillRect(2, 0, 6, 3, 'B').hline(2, 7, 2, 'n');
  for (const [x, y] of [[3, 5], [6, 6], [3, 8], [5, 9], [7, 9]] as const) p.set(x, y, 'L');
  p.set(5, 5, 'Y').set(4, 7, 'Y');
  return p.outline('k');
}

/** Summer: sunflowers in a pot. 16x24. */
function sunflowers(): Pixmap {
  const p = new Pixmap(16, 24);
  p.fillRect(3, 17, 10, 7, 'H').strokeRect(3, 17, 10, 7, 'h').hline(2, 13, 17, 'h');
  for (const [cx, cy, stem] of [[5, 4, 5], [11, 7, 11], [8, 2, 8]] as const) {
    for (let y = cy + 2; y < 17; y++) p.set(stem, y, 'G');
    p.fillEllipse(cx, cy, 3, 3, 'y').fillEllipse(cx, cy, 1.5, 1.5, 'B');
  }
  p.set(7, 11, 'l').set(9, 13, 'l').set(6, 14, 'l');
  return p;
}

/** Autumn: pumpkins by the hearth. 24x14. */
function pumpkins(): Pixmap {
  const p = new Pixmap(24, 14);
  const one = (cx: number, cy: number, rx: number, ry: number) => {
    p.fillEllipse(cx, cy, rx, ry, 'o');
    for (const dx of [-rx / 2, 0, rx / 2]) for (let y = Math.round(cy - ry + 1); y < cy + ry - 1; y++) p.set(Math.round(cx + dx), y, 'R');
    p.fillRect(cx - 1, cy - ry - 2, 2, 3, 'G');
  };
  one(7, 8, 6.5, 5.5);
  one(18, 10, 5, 4);
  return p.outline('k');
}

/** Autumn: a few leaves blown in over the step. 40x14, flat on the floor. */
function leaves(): Pixmap {
  const p = new Pixmap(40, 14);
  for (const [x, y, c] of [[4, 10, 'o'], [10, 6, 'R'], [17, 11, 'y'], [24, 4, 'o'], [30, 9, 'R'], [35, 12, 'o'], [14, 2, 'y']] as const) {
    p.fillRect(x, y, 3, 2, c).set(x + 1, y - 1, c).set(x + 3, y + 1, 'n');
  }
  return p;
}

/** Winter: snow along the windowsill. 56x4. */
function sillSnow(): Pixmap {
  const p = new Pixmap(56, 4);
  for (let x = 1; x < 55; x++) {
    const h = 2 + Math.round(Math.sin(x / 3) * 0.8 + Math.sin(x / 7));
    for (let y = 4 - h; y < 4; y++) p.set(x, y, y === 4 - h ? 'W' : 'm');
  }
  return p;
}

/** Winter: snow blown in over the step, in low drifts. 44x9, flat on the floor. */
function snowdrift(): Pixmap {
  const p = new Pixmap(44, 9);
  for (let x = 0; x < 44; x++) {
    const edge = Math.min(x, 43 - x);
    const h = Math.min(edge / 2, 3 + Math.round(Math.sin(x / 3) * 1.2 + Math.sin(x / 5 + 2)));
    for (let y = Math.round(9 - h); y < 9; y++) p.set(x, y, y === Math.round(9 - h) ? 'W' : 'm');
  }
  for (const [x, y] of [[4, 3], [12, 1], [30, 2], [39, 4], [21, 0]] as const) p.set(x, y, 'W');
  return p;
}

export type WizardFacing = 'down' | 'up' | 'left' | 'right';

/**
 * You (GDD §13): a small round being in wizard's robes and a pointed hat, no stats of its own.
 * 16x20, facing four ways, with two walking frames (frame 0 is also standing).
 */
export function wizard(face: WizardFacing, frame: 0 | 1): Pixmap {
  const p = new Pixmap(16, 20);
  const bob = frame;
  // Robe: a soft bell shape, darker at the hem.
  for (let y = 9; y < 18; y++) {
    const half = 3 + Math.min(4, Math.floor((y - 9) / 1.6));
    for (let x = 8 - half; x < 8 + half; x++) p.set(x, y + bob, y >= 16 ? 'p' : x < 8 - half + 2 ? 'p' : 'P');
  }
  // Feet peeking out, stepping on frame 1.
  if (frame) p.set(5, 19, 'k').set(10, 18, 'k');
  else p.set(5, 18, 'k').set(10, 18, 'k');
  // Face: a shadow under the brim, with two glints of eyes.
  p.fillRect(5, 7 + bob, 6, 3, 'q');
  if (face === 'down') p.set(6, 8 + bob, 'W').set(9, 8 + bob, 'W');
  if (face === 'left') p.set(5, 8 + bob, 'W').set(7, 8 + bob, 'W');
  if (face === 'right') p.set(8, 8 + bob, 'W').set(10, 8 + bob, 'W');
  // Hat: a wide brim and a cone that flops toward where you're looking.
  p.hline(2, 13, 7 + bob, 'p').hline(3, 12, 6 + bob, 'P');
  const lean = face === 'left' ? -1 : face === 'right' ? 1 : 0;
  for (let i = 0; i < 6; i++) {
    const half = Math.max(0, 4 - Math.floor(i * 0.75));
    const cx = 8 + Math.round((lean * i) / 2);
    p.hline(cx - half, cx + half - 1, 5 - i + bob, i === 1 ? 'y' : 'P');
  }
  if (face === 'up') p.hline(4, 11, 10 + bob, 'p');
  return p.outline('k');
}
