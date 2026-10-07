// Renders one procedural texture to a PNG without a browser: pnpm render-texture bg/shop [scale]
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { proceduralTextures } from '../src/art/procedural';

const [key = 'bg/shop', scaleArg = '2'] = process.argv.slice(2);
const scale = Number(scaleArg);
const pm = proceduralTextures()[key];
if (!pm) {
  console.error(`unknown texture ${key}. Known: ${Object.keys(proceduralTextures()).join(', ')}`);
  process.exit(1);
}
const png = new PNG({ width: pm.width * scale, height: pm.height * scale });
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const si = (Math.floor(y / scale) * pm.width + Math.floor(x / scale)) * 4;
    const di = (y * png.width + x) * 4;
    for (let k = 0; k < 4; k++) png.data[di + k] = pm.data[si + k] ?? 0;
  }
}
mkdirSync('.snaps', { recursive: true });
const out = `.snaps/${key.replace('/', '-')}.png`;
writeFileSync(out, PNG.sync.write(png));
console.log(`✓ ${out}`);
