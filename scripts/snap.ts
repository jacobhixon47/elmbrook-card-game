// Screenshot fixtures in a real browser so Claude (and humans) can see the game.
//   pnpm snap <fixture> [--out path]     pnpm snap:all
import { mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createServer } from 'vite';
import { launchBrowser } from './browser';

const args = process.argv.slice(2);
const all = args.includes('--all');
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
const names = all
  ? readdirSync('fixtures').filter((f) => f.endsWith('.json')).map((f) => basename(f, '.json'))
  : args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));

if (names.length === 0) {
  console.error('usage: pnpm snap <fixture> [--out file.png] | pnpm snap:all');
  process.exit(1);
}

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('vite did not report a URL');

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

mkdirSync('.snaps', { recursive: true });
let failed = false;
for (const name of names) {
  errors.length = 0;
  await page.goto(`${url}?fixture=${name}&noanim=1`);
  try {
    await page.waitForFunction(() => window.__elmbrook?.ready, null, { timeout: 15000 });
  } catch {
    console.error(`✗ ${name}: scene never reported ready`);
    failed = true;
  }
  const file = out && names.length === 1 ? out : join('.snaps', `${name}.png`);
  await page.locator('canvas').screenshot({ path: file });
  if (errors.length) {
    failed = true;
    console.error(`✗ ${name}: ${errors.join('\n  ')}`);
  }
  console.log(`${errors.length ? '!' : '✓'} ${name} → ${file}`);
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
