// Turns a large painted image (e.g. a Midjourney render) into a pixel-art backdrop:
// crop to 16:9, downscale to 640x360, reduce to a small palette, write public/backdrops/<name>.png.
//
//   pnpm art:import <image> <name> [--grid 2 --panel 0] [--colors 48] [--focus x,y] [--window x,y --bbox x0,y0,x1,y1]
//
// --window cuts a window's outside view out of the painting: a flood fill from the seed point(s)
// (x,y;x,y in 640x360 coordinates) over sky- and valley-coloured pixels, kept inside --bbox, with
// enclosed specks (stars, the moon) filled in. The painting is written with that area transparent,
// and the view alone to public/backdrops/<name>-view.png, so a scene can regrade it by season and time.
//
// --grid/--panel pick one panel of a Midjourney 2x2 grid (panels numbered left to right, top to bottom).
// --focus is the crop centre as fractions of the panel (default 0.5,0.5).
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const [src, name] = positional;
if (!src || !name) {
  console.error('usage: pnpm art:import <image> <name> [--grid 2 --panel 0] [--colors 48] [--focus 0.5,0.5]');
  process.exit(1);
}
const grid = Number(flag('grid', '1'));
const panel = Number(flag('panel', '0'));
const colors = Number(flag('colors', '48'));
const [fx, fy] = flag('focus', '0.5,0.5').split(',').map(Number) as [number, number];

const W = 640;
const H = 360;

const meta = await sharp(src).metadata();
const pw = Math.floor(meta.width! / grid);
const ph = Math.floor(meta.height! / grid);
const px = (panel % grid) * pw;
const py = Math.floor(panel / grid) * ph;
// Trim letterbox bars, then take the largest 16:9 crop centred on the focus point.
// (Separate pipelines: sharp would otherwise trim the whole grid before extracting.)
const panelBuf = await sharp(src).extract({ left: px, top: py, width: pw, height: ph }).png().toBuffer();
const { data: trimmed, info } = await sharp(panelBuf)
  .trim({ background: '#000000', threshold: 24 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const tw = info.width;
const th = info.height;
const cw = Math.min(tw, Math.floor((th * W) / H));
const ch = Math.min(th, Math.floor((cw * H) / W));
const left = Math.max(0, Math.min(tw - cw, Math.round(tw * fx - cw / 2)));
const top = Math.max(0, Math.min(th - ch, Math.round(th * fy - ch / 2)));

mkdirSync('public/backdrops', { recursive: true });
const out = `public/backdrops/${name}.png`;
const { data: small } = await sharp(trimmed, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .extract({ left, top, width: cw, height: ch })
  .resize(W, H, { kernel: 'lanczos3' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const png = new PNG({ width: W, height: H });
const palette = quantize(small, colors);
for (let i = 0, j = 0; i < small.length; i += 3, j += 4) {
  const c = palette[nearest(palette, small[i]!, small[i + 1]!, small[i + 2]!)]!;
  png.data[j] = c[0];
  png.data[j + 1] = c[1];
  png.data[j + 2] = c[2];
  png.data[j + 3] = 255;
}
const windowSeeds = flag('window', '');
if (windowSeeds) {
  const [bx0, by0, bx1, by1] = flag('bbox', `0,0,${W},${H}`).split(',').map(Number) as [number, number, number, number];
  const seeds = windowSeeds.split(';').map((p) => p.split(',').map(Number) as [number, number]);
  const mask = windowMask(png, seeds, { x0: bx0, y0: by0, x1: bx1, y1: by1 });
  const view = new PNG({ width: W, height: H });
  let count = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    count++;
    for (let k = 0; k < 4; k++) view.data[i * 4 + k] = png.data[i * 4 + k]!;
    png.data[i * 4 + 3] = 0;
  }
  writeFileSync(`public/backdrops/${name}-view.png`, PNG.sync.write(view));
  console.log(`✓ public/backdrops/${name}-view.png (${count} window pixels)`);
}
const pixels = PNG.sync.write(png);
writeFileSync(out, pixels);
// A nearest-neighbour 2x preview for review.
mkdirSync('.snaps', { recursive: true });
await sharp(pixels).resize(W * 2, H * 2, { kernel: 'nearest' }).toFile(`.snaps/backdrop-${name}.png`);
console.log(`✓ ${out} (${W}x${H}, ${palette.length} colours, from a ${cw}x${ch} crop of panel ${panel}); preview .snaps/backdrop-${name}.png`);

type Rgb = [number, number, number];

function nearest(pal: readonly Rgb[], r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < pal.length; k++) {
    const c = pal[k]!;
    // Weighted distance: the eye is most sensitive to green, least to blue.
    const d = 3 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 2 * (c[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** Deterministic k-means palette: seeded by brightness quantiles, then refined. */
function quantize(rgb: Buffer, k: number): Rgb[] {
  const n = rgb.length / 3;
  const step = Math.max(1, Math.floor(n / 40000));
  const samples: Rgb[] = [];
  for (let i = 0; i < n; i += step) samples.push([rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!]);
  const byLum = [...samples].sort((a, b) => a[0] * 3 + a[1] * 4 + a[2] - (b[0] * 3 + b[1] * 4 + b[2]));
  let pal: Rgb[] = Array.from({ length: k }, (_, i) => [...byLum[Math.floor(((i + 0.5) / k) * byLum.length)]!] as Rgb);
  for (let iter = 0; iter < 16; iter++) {
    const sums = pal.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      const acc = sums[nearest(pal, s[0], s[1], s[2])]!;
      acc[0]! += s[0];
      acc[1]! += s[1];
      acc[2]! += s[2];
      acc[3]! += 1;
    }
    pal = pal.map((c, i) => {
      const acc = sums[i]!;
      return acc[3] ? ([Math.round(acc[0]! / acc[3]), Math.round(acc[1]! / acc[3]), Math.round(acc[2]! / acc[3])] as Rgb) : c;
    });
  }
  return pal;
}

/** Pixels you'd see through the glass: blue sky or blue-green valley, as opposed to warm interior. */
function looksOutside(r: number, g: number, b: number): boolean {
  return b > r + 12 && b >= g - 10;
}

function windowMask(img: PNG, seeds: readonly [number, number][], box: { x0: number; y0: number; x1: number; y1: number }): Uint8Array {
  const { width, height, data } = img;
  const inBox = (x: number, y: number) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
  const mask = new Uint8Array(width * height);
  const stack = seeds.map(([x, y]) => y * width + x);
  while (stack.length) {
    const i = stack.pop()!;
    if (mask[i]) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if (!inBox(x, y) || !looksOutside(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)) continue;
    mask[i] = 1;
    stack.push(i + 1, i - 1, i + width, i - width);
  }
  // Fill enclosed specks (stars, moon, flecks of cloud): unmasked islands that don't reach the box edge.
  const seen = new Uint8Array(width * height);
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const start = y * width + x;
      if (mask[start] || seen[start]) continue;
      const island: number[] = [];
      let touchesEdge = false;
      const queue = [start];
      seen[start] = 1;
      while (queue.length) {
        const i = queue.pop()!;
        island.push(i);
        const ix = i % width;
        const iy = Math.floor(i / width);
        if (ix === box.x0 || iy === box.y0 || ix === box.x1 - 1 || iy === box.y1 - 1) touchesEdge = true;
        for (const n of [i + 1, i - 1, i + width, i - width]) {
          const nx = n % width;
          const ny = Math.floor(n / width);
          if (!inBox(nx, ny) || mask[n] || seen[n] || Math.abs(nx - ix) > 1) continue;
          seen[n] = 1;
          queue.push(n);
        }
      }
      if (!touchesEdge && island.length < 400) for (const i of island) mask[i] = 1;
    }
  }
  return mask;
}
