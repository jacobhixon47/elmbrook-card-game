// The desktop app's icon: the firefly jar cut from the title screen's painted backdrop (Jacob, Oct 21),
// so no icon PNGs are committed. Writes src-tauri/app-icon.png; `pnpm desktop:icons` then makes every
// size Tauri needs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { BACKDROPS } from '../src/art/backdrops';

/** The jar, in the backdrop's 640×360 pixels: a square from the lid to the base. */
const JAR = { x: 71, y: 150, size: 182 };
const OUT = 1024;

const backdrop = PNG.sync.read(readFileSync(`public/${BACKDROPS.title.file}`));
const png = new PNG({ width: OUT, height: OUT });
for (let y = 0; y < OUT; y++) {
  for (let x = 0; x < OUT; x++) {
    // Nearest-neighbour, so the painted pixels stay crisp.
    const sx = JAR.x + Math.floor((x * JAR.size) / OUT);
    const sy = JAR.y + Math.floor((y * JAR.size) / OUT);
    const si = (sy * backdrop.width + sx) * 4;
    const di = (y * OUT + x) * 4;
    for (let k = 0; k < 4; k++) png.data[di + k] = backdrop.data[si + k]!;
  }
}
mkdirSync('src-tauri', { recursive: true });
writeFileSync('src-tauri/app-icon.png', PNG.sync.write(png));
console.log('src-tauri/app-icon.png');
