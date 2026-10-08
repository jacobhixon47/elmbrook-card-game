// Plays week 1 through the real UI in headless Chromium, with animations on: keys and clicks
// where the player would use them, the greedy bot choosing what to do. Fails on any console
// error, or if the run gets stuck.   pnpm e2e   (TRACE=1 prints each action)
import { createServer } from 'vite';
import type { Action, RunState } from '../src/core';
import { greedyAction } from '../src/sim/bot';
import { launchBrowser } from './browser';
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls!.local[0]!;
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${url}?seed=e2e`);
await page.waitForFunction(() => window.__elmbrook?.ready === 'Title');
await page.keyboard.press('x');
await page.waitForFunction(() => window.__elmbrook?.ready === 'Run');
const box = (await page.locator('canvas').boundingBox())!;
const get = () => page.evaluate(() => window.__elmbrook!.getState()) as Promise<RunState>;
const hook = (a: Action) => page.evaluate((a) => window.__elmbrook!.dispatch(a), a);
// Phaser handles input once a frame, and CI's software-rendered frames are slow and uneven, so
// every press and release gets its own frames instead of a fixed delay.
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const key = async (k: string) => {
  await page.keyboard.down(k);
  await frames();
  await page.keyboard.up(k);
  await frames();
};
const click = async (x: number, y: number) => {
  await page.mouse.move(box.x + x * 2, box.y + y * 2);
  await frames();
  await page.mouse.down();
  await frames();
  await page.mouse.up();
  await frames();
};
const run = `window.__elmbrook.game.scene.getScene('Run')`;
// Wait until the Run scene is up (it restarts when the sky changes) and not animating, then give it two frames.
const settle = async () => {
  await page.waitForFunction(`(() => { const r = ${run}; return r && r.sys.isActive() && !r.busy; })()`, null, { timeout: 30000 });
  await frames();
};
// End day takes a second click to confirm when orders are still open; retry until the phase moves on.
const endDay = async () => {
  for (let i = 0; i < 6 && (await get()).phase === 'brewing'; i++) {
    await settle();
    await click(580, 244);
    await page.waitForFunction(`(() => { const r = ${run}; return window.__elmbrook.getState().phase !== 'brewing' || (r && r.confirm === 'endDay'); })()`, null, { timeout: 2000 }).catch(() => {});
  }
};
const counts: Record<string, number> = {};
let steps = 0;
let s = await get();
while (steps++ < 400 && !(s.week === 2 && s.day === 2) && s.phase !== 'game-over') {
  const a = greedyAction(s);
  if (process.env.TRACE) console.log(JSON.stringify(a));
  counts[a.type] = (counts[a.type] ?? 0) + 1;
  await settle();
  const idx = (uid: number) => s.hand.findIndex((c) => c.uid === uid);
  switch (a.type) {
    case 'openShop': await key('Space'); break;
    case 'slot':
      if (idx(a.uid) < 9) await key(String(idx(a.uid) + 1));
      else await hook(a);
      break;
    case 'brew': {
      // The brew lands when the key is handled; input then waits for the scoring animation.
      const brews = s.brewsLeft;
      await key('Enter');
      await page.waitForFunction((n) => window.__elmbrook!.getState()!.brewsLeft < n, brews, { timeout: 10000 });
      await page.waitForFunction(() => !(window.__elmbrook!.game.scene.getScene('Run') as unknown as { busy: boolean }).busy, null, { timeout: 30000 });
      break;
    }
    case 'discard': {
      await key('d');
      for (const u of a.uids) await key(String(idx(u) + 1));
      await key('d');
      break;
    }
    case 'playTincture':
      await key(String(idx(a.uid) + 1));
      if (a.targets?.length) { for (const u of a.targets) await key(String(idx(u) + 1)); await key('Enter'); }
      break;
    case 'endDay': await endDay(); break;
    case 'pickReward': await click(240 + a.index * 80, 150); break;
    case 'skipReward': await click(320, 250); break;
    case 'takeGift': { const n = (s.offer as { cards: string[] }).cards.length; await click(320 + (a.index - (n - 1) / 2) * 80, 150); break; }
    case 'passGift': await click(320, 250); break;
    case 'chooseErrand': { const o = s.offer as { options: string[] }; await click(220 + o.options.indexOf(a.errand) * 200, 150); break; }
    default: await hook(a);
  }
  // Give the action time to land before calling the run stuck.
  const before = JSON.stringify(s);
  await page.waitForFunction((b) => JSON.stringify(window.__elmbrook!.getState()) !== b, before, { timeout: 5000 }).catch(() => {});
  const next = await get();
  if (JSON.stringify(next) === JSON.stringify(s)) {
    const mode = await page.evaluate(() => (window.__elmbrook!.game.scene.getScene('Run') as unknown as { mode: unknown }).mode);
    console.log('stuck after', JSON.stringify(a), 'ui mode', JSON.stringify(mode));
    await page.locator('canvas').screenshot({ path: '.snaps/e2e-stuck.png' });
    errors.push('stuck');
    break;
  }
  s = next;
}
console.log('reached', s.week, s.day, s.phase, s.gold, 'steps', steps, JSON.stringify(counts));
await page.locator('canvas').screenshot({ path: '.snaps/e2e-end.png' });
console.log('errors', errors.slice(0, 5));
await browser.close();
await server.close();
const ok = errors.length === 0 && ((s.week === 2 && s.day === 2) || s.phase === 'game-over');
process.exit(ok ? 0 : 1);
