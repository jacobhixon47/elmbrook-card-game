import { existsSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';

/** Uses a preinstalled Chromium when one is available (cloud sandboxes), else Playwright's own. */
export async function launchBrowser(): Promise<Browser> {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean) as string[];
  const executablePath = candidates.find((p) => existsSync(p));
  return chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
}
