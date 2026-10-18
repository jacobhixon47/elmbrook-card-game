// Renders every sprite, portrait and procedural texture to .snaps/art-sheet.png without a browser.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Pixmap } from '../src/art/pixmap';
import { proceduralTextures } from '../src/art/procedural';
import { rasterize } from '../src/art/sprite';
import { PORTRAITS, SPRITES } from '../src/art/sprites';

const SCALE = 3;
// Sprites fill as many rows as they need, then the portraits; the procedural rows sit below them.
const spriteRowsH = Math.ceil(SPRITES.length / 18) * 34;
const spriteH = spriteRowsH + Math.ceil(PORTRAITS.length / 17) * 36;
const H = spriteH + 152;
const sheet = new Pixmap(640, H).fillRect(0, 0, 640, H, 's');
SPRITES.forEach((def, i) => sheet.blit(rasterize(def), 8 + (i % 18) * 34, 8 + Math.floor(i / 18) * 34, 2));
PORTRAITS.forEach((def, i) => sheet.blit(rasterize(def), 8 + (i % 17) * 36, 8 + spriteRowsH + Math.floor(i / 17) * 36));
let x = 8;
let roomX = 8;
for (const [key, pm] of Object.entries(proceduralTextures())) {
  if (key.startsWith('bg/') || key.startsWith('room/shell') || key.endsWith('-lit')) continue;
  // The cottage's furniture and you get a row of their own.
  if (key.startsWith('room/') || key.startsWith('wizard/')) {
    sheet.blit(pm, roomX, spriteH + 88);
    roomX += pm.width + 4;
    continue;
  }
  sheet.blit(pm, x, spriteH + 12);
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
console.log(`✓ .snaps/art-sheet.png (${SPRITES.length} sprites, ${PORTRAITS.length} portraits)`);
