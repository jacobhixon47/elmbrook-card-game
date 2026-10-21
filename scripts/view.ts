// Open the dev server straight on one place, for a quick look while working on it.
//   pnpm market [season] [--snowed]     pnpm cottage [season]
// Seasons: spring (default), summer, autumn, winter. Hot reload works as with `pnpm dev`.
import { existsSync } from 'node:fs';
import { createServer } from 'vite';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
const args = process.argv.slice(2).map((a) => a.replace(/^--(season=)?/, ''));
const place = args[0];
const season = args.find((a) => (SEASONS as readonly string[]).includes(a)) ?? 'spring';
const snowed = args.includes('snowed');

const fixture =
  place === 'market' ? (snowed ? 'run-market-snowed-in-street' : `run-market-${season}`)
  : place === 'cottage' ? (season === 'spring' ? 'cottage' : `cottage-${season}`)
  : null;
const unknown = args.slice(1).filter((a) => a !== 'snowed' && !(SEASONS as readonly string[]).includes(a));
if (!fixture || unknown.length || (snowed && place !== 'market') || !existsSync(`fixtures/${fixture}.json`)) {
  console.error('usage: pnpm market [spring|summer|autumn|winter] [--snowed]  |  pnpm cottage [spring|summer|autumn|winter]');
  process.exit(1);
}

const path = `/?fixture=${fixture}`;
const server = await createServer({ server: { open: path } });
await server.listen();
console.log(`\n  ${place}, ${snowed ? 'snowed in' : season}: ${server.resolvedUrls?.local[0]?.replace(/\/$/, '')}${path}\n`);
server.bindCLIShortcuts({ print: true });
