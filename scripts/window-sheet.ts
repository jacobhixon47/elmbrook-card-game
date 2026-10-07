// Renders the shop window for review: every season by time of day (.snaps/window-grades.png),
// and every weather by time of day (.snaps/window-weather.png). Particles are not included.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { BACKDROPS } from '../src/art/backdrops';
import { gradeView } from '../src/art/window';
import { SEASONS, SKY_TIMES, WEATHERS, type Season, type SkyTime, type Weather } from '../src/core/calendar';

const { view: meta } = BACKDROPS.shop;
const shop = PNG.sync.read(readFileSync('public/backdrops/shop.png'));
const view = PNG.sync.read(readFileSync(`public/${meta.file}`));
const cw = 360;
const ch = 220;
const ox = 145;
const oy = 10;

function sheet(rows: readonly { season: Season; weather: Weather }[], out: string) {
  const png = new PNG({ width: cw * SKY_TIMES.length, height: ch * rows.length });
  rows.forEach((row, ri) =>
    SKY_TIMES.forEach((time: SkyTime, ti) => {
      const g = gradeView({ width: view.width, height: view.height, data: new Uint8ClampedArray(view.data) }, row.season, time, meta.skyTop, meta.horizon, row.weather);
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = ((y + oy) * 640 + x + ox) * 4;
          const src = shop.data[i + 3]! > 0 ? shop.data : g;
          const j = ((ri * ch + y) * png.width + ti * cw + x) * 4;
          for (let k = 0; k < 3; k++) png.data[j + k] = src[i + k]!;
          png.data[j + 3] = 255;
        }
      }
    }),
  );
  writeFileSync(out, PNG.sync.write(png));
  console.log(`✓ ${out}`);
}

mkdirSync('.snaps', { recursive: true });
sheet(SEASONS.map((season) => ({ season, weather: 'clear' as const })), '.snaps/window-grades.png');
const seasonFor: Record<Weather, Season> = { clear: 'spring', rain: 'spring', fog: 'autumn', heatwave: 'summer', snow: 'winter' };
sheet(WEATHERS.filter((w) => w !== 'clear').map((weather) => ({ season: seasonFor[weather], weather })), '.snaps/window-weather.png');
