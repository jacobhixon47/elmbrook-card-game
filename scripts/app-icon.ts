// The desktop app's icon, drawn from the firefly jar sprite (art is code, so no icon PNGs are
// committed). Writes src-tauri/app-icon.png; `pnpm desktop:icons` then makes every size Tauri needs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Pixmap } from '../src/art/pixmap';
import { rasterize } from '../src/art/sprite';
import { SPRITES } from '../src/art/sprites';

const jar = SPRITES.find((s) => s.id === 'tincture/firefly-jar');
if (!jar) throw new Error('no firefly jar sprite');
// A 32px tile: the night-blue ground, a lighter rim, and the jar doubled in the middle.
const tile = new Pixmap(32, 32).fillRect(0, 0, 32, 32, 'n').fillRect(1, 1, 30, 30, 'k');
tile.blit(rasterize(jar), 0, 0, 2);

const SCALE = 32;
const png = new PNG({ width: tile.width * SCALE, height: tile.height * SCALE });
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const si = (Math.floor(y / SCALE) * tile.width + Math.floor(x / SCALE)) * 4;
    const di = (y * png.width + x) * 4;
    for (let k = 0; k < 4; k++) png.data[di + k] = tile.data[si + k] ?? 0;
  }
}
mkdirSync('src-tauri', { recursive: true });
writeFileSync('src-tauri/app-icon.png', PNG.sync.write(png));
console.log('src-tauri/app-icon.png');
