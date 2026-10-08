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
const click = (x: number, y: number) => page.mouse.click(box.x + x * 2, box.y + y * 2);
const get = () => page.evaluate(() => window.__elmbrook!.getState()) as Promise<RunState>;
const hook = (a: Action) => page.evaluate((a) => window.__elmbrook!.dispatch(a), a);
const wait = (ms: number) => page.waitForTimeout(ms);
// Phaser reads the keyboard once a frame and headless frames are slow, so type like a person.
const key = async (k: string) => {
  await page.keyboard.press(k);
  await wait(80);
};
const counts: Record<string, number> = {};
let steps = 0;
let s = await get();
while (steps++ < 400 && !(s.week === 2 && s.day === 2) && s.phase !== 'game-over') {
  const a = greedyAction(s);
  if (process.env.TRACE) console.log(JSON.stringify(a));
  counts[a.type] = (counts[a.type] ?? 0) + 1;
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
    case 'endDay': await click(580, 244); await wait(100); if ((await get()).phase === 'brewing') await click(580, 244); await wait(400); break;
    case 'pickReward': await click(240 + a.index * 80, 150); break;
    case 'skipReward': await click(320, 250); break;
    case 'chooseErrand': { const o = s.offer as { options: string[] }; await click(220 + o.options.indexOf(a.errand) * 200, 150); break; }
    default: await hook(a);
  }
  await wait(250);
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
