// `pnpm build:single`: the whole game in one HTML file, `dist-single/elmbrook.html`, to send to
// friends. Double-clicked, it opens in their browser and plays with no installer, so there is no
// unsigned-app warning. Saves live in that browser, as on the web.
// It builds with relative paths, then inlines the script, the stylesheet with its fonts, and the
// painted backdrops as data URIs, since a page opened from disk can't load files beside it.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = 'dist-single';
const BUILD = join(OUT, 'build');
const MIME: Record<string, string> = { '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };

rmSync(OUT, { recursive: true, force: true });
execFileSync('pnpm', ['exec', 'vite', 'build', '--base=./', '--outDir', BUILD], { stdio: 'inherit' });

const dataUri = (path: string) => `data:${MIME[extname(path)] ?? 'application/octet-stream'};base64,${readFileSync(path).toString('base64')}`;
const assets = readdirSync(join(BUILD, 'assets'));
const only = (ext: string) => {
  const found = assets.filter((f) => f.endsWith(ext));
  if (found.length !== 1) throw new Error(`expected one ${ext} in the build, found ${found.length}: the inliner needs updating`);
  return join(BUILD, 'assets', found[0]!);
};

// The stylesheet, its fonts inlined.
const css = readFileSync(only('.css'), 'utf8').replace(/url\(\.?\/?([^)"']+\.woff2?)\)/g, (_, file: string) => `url(${dataUri(join(BUILD, 'assets', file.replace(/^assets\//, '')))})`);

// The script, each painted backdrop it names inlined.
let js = readFileSync(only('.js'), 'utf8');
for (const file of readdirSync(join(BUILD, 'backdrops'))) {
  const ref = `backdrops/${file}`;
  if (!js.includes(ref)) throw new Error(`${ref} is in the build but the script never names it`);
  const uri = JSON.stringify(dataUri(join(BUILD, ref)));
  for (const q of ['"', "'", '`']) js = js.replaceAll(`${q}${ref}${q}`, uri);
}
// Fonts the script loads itself (the digits face) come as `new URL(file, import.meta.url)`.
for (const file of assets.filter((f) => /\.woff2?$/.test(f))) {
  const uri = JSON.stringify(dataUri(join(BUILD, 'assets', file)));
  for (const q of ['"', "'", '`']) js = js.replaceAll(`new URL(${q}${file}${q},import.meta.url).href`, uri).replaceAll(`${q}./${file}${q}`, uri);
  if (js.includes(file)) throw new Error(`the script still names ${file}`);
}
if (/["'`]\.?\/?(assets|backdrops)\//.test(js)) throw new Error('the script still names a file beside the page');

let html = readFileSync(join(BUILD, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`);
// `</script` inside the bundle would end the inline tag early.
html = html.replace(/<script type="module"[^>]*><\/script>/, () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>`);
if (/(src|href)="\.\/(assets|backdrops)\//.test(html)) throw new Error('the page still loads a file beside it');

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'elmbrook.html'), html);
rmSync(BUILD, { recursive: true, force: true });
console.log(`${OUT}/elmbrook.html: ${(html.length / 1024 / 1024).toFixed(1)} MB`);
