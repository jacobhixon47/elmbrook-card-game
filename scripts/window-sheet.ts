// Renders the shop window in every season (rows) and time of day (columns) to .snaps/window-grades.png.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { gradeView } from '../src/art/window';
import { SEASONS, SKY_TIMES } from '../src/core/calendar';
const shop = PNG.sync.read(readFileSync('public/backdrops/shop.png'));
const view = PNG.sync.read(readFileSync('public/backdrops/shop-view.png'));
const cw = 360, ch = 220, ox = 145, oy = 10;
const sheet = new PNG({ width: cw * 4, height: ch * 4 });
SEASONS.forEach((s, si) => SKY_TIMES.forEach((t, ti) => {
  const g = gradeView({ width: view.width, height: view.height, data: new Uint8ClampedArray(view.data) }, s, t, 24, 150);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = ((y + oy) * 640 + x + ox) * 4;
    const useShop = shop.data[i + 3]! > 0;
    const j = ((si * ch + y) * cw * 4 + ti * cw + x) * 4;
    for (let k = 0; k < 3; k++) sheet.data[j + k] = useShop ? shop.data[i + k]! : g[i + k]!;
    sheet.data[j + 3] = 255;
  }
}));
mkdirSync('.snaps', { recursive: true });
writeFileSync('.snaps/window-grades.png', PNG.sync.write(sheet));
console.log('✓ .snaps/window-grades.png');
