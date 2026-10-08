// Renders every sprite and procedural texture to .snaps/art-sheet.png without a browser.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Pixmap } from '../src/art/pixmap';
import { proceduralTextures } from '../src/art/procedural';
import { rasterize } from '../src/art/sprite';
import { SPRITES } from '../src/art/sprites';

const SCALE = 3;
const sheet = new Pixmap(640, 260).fillRect(0, 0, 640, 260, 's');
SPRITES.forEach((def, i) => sheet.blit(rasterize(def), 8 + (i % 18) * 34, 8 + Math.floor(i / 18) * 34, 2));
let x = 8;
for (const [key, pm] of Object.entries(proceduralTextures())) {
  if (key.startsWith('bg/')) continue;
  sheet.blit(pm, x, 120);
  x += pm.width + 6;
}

const png = new PNG({ width: sheet.width * SCALE, height: sheet.height * SCALE });
for (let y = 0; y < png.height; y++) {
  for (let px = 0; px < png.width; px++) {
    const si = (Math.floor(y / SCALE) * sheet.width + Math.floor(px / SCALE)) * 4;
    const di = (y * png.width + px) * 4;
    for (let k = 0; k < 4; k++) png.data[di + k] = sheet.data[si + k] ?? 0;
  }
}
mkdirSync('.snaps', { recursive: true });
writeFileSync('.snaps/art-sheet.png', PNG.sync.write(png));
console.log(`✓ .snaps/art-sheet.png (${SPRITES.length} sprites)`);
