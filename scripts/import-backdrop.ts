// Turns a large painted image (e.g. a Midjourney render) into a pixel-art backdrop:
// crop to 16:9, downscale to 640x360, reduce to a small palette, write public/backdrops/<name>.png.
//
//   pnpm art:import <image> <name> [--grid 2 --panel 0] [--colors 48] [--focus x,y]
//
// --grid/--panel pick one panel of a Midjourney 2x2 grid (panels numbered left to right, top to bottom).
// --focus is the crop centre as fractions of the panel (default 0.5,0.5).
import { mkdirSync } from 'node:fs';
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
const pixels = await sharp(trimmed, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .extract({ left, top, width: cw, height: ch })
  .resize(W, H, { kernel: 'lanczos3' })
  .png({ palette: true, colours: colors, dither: 0, effort: 10 })
  .toBuffer();
await sharp(pixels).toFile(out);
// A nearest-neighbour 2x preview for review.
mkdirSync('.snaps', { recursive: true });
await sharp(pixels).resize(W * 2, H * 2, { kernel: 'nearest' }).toFile(`.snaps/backdrop-${name}.png`);
console.log(`✓ ${out} (${W}x${H}, ${colors} colours, from a ${cw}x${ch} crop of panel ${panel}); preview .snaps/backdrop-${name}.png`);
