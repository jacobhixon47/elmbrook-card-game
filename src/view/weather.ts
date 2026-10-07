import Phaser from 'phaser';
import { hex, type PaletteKey } from '../art/palette';
import type { Season, SkyTime } from '../core';
import { noAnim } from '../debug/params';

type Area = { x0: number; y0: number; x1: number; y1: number };

type Kind = { colors: readonly PaletteKey[]; w: number; h: number; count: number; vx: [number, number]; vy: [number, number]; sway: number; blink: boolean };

/** What drifts past the window for a season and time of day. */
function kindFor(season: Season, time: SkyTime): Kind | null {
  const night = time === 'night' || time === 'evening';
  switch (season) {
    case 'winter':
      return { colors: ['W', 'W', 'm', 'e'], w: 1, h: 1, count: 120, vx: [-4, 6], vy: [10, 22], sway: 4, blink: false };
    case 'autumn':
      return { colors: ['o', 'R', 'y', 'B'], w: 2, h: 1, count: 18, vx: [8, 22], vy: [10, 20], sway: 6, blink: false };
    case 'spring':
      return night
        ? { colors: ['L', 'y'], w: 1, h: 1, count: 12, vx: [-4, 4], vy: [-4, 4], sway: 6, blink: true }
        : { colors: ['I', 'I', 'w'], w: 2, h: 1, count: 22, vx: [10, 24], vy: [4, 12], sway: 5, blink: false };
    case 'summer':
      return night
        ? { colors: ['L', 'y', 'Y'], w: 1, h: 1, count: 26, vx: [-4, 4], vy: [-5, 3], sway: 8, blink: true }
        : { colors: ['Y', 'w'], w: 1, h: 1, count: 14, vx: [-3, 5], vy: [-3, 2], sway: 6, blink: false };
  }
}

/**
 * Seasonal particles inside a window. Add this between the view and the painted room, so
 * the room's frame hides anything outside the glass. With ?noanim=1 they hold still.
 */
export function addWeather(scene: Phaser.Scene, area: Area, season: Season, time: SkyTime): void {
  const kind = kindFor(season, time);
  if (!kind) return;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const w = area.x1 - area.x0;
  const h = area.y1 - area.y0;
  for (let i = 0; i < kind.count; i++) {
    const color = kind.colors[Math.floor(rnd() * kind.colors.length)]!;
    // A few flakes or petals are nearer, so a size up.
    const near = rnd() > 0.8 ? 1 : 0;
    const p = scene.add.rectangle(area.x0 + rnd() * w, area.y0 + rnd() * h, kind.w + near, kind.h + near, hex(color)).setOrigin(0);
    if (kind.blink) p.setBlendMode(Phaser.BlendModes.ADD);
    if (noAnim) continue;
    const vx = between(...kind.vx);
    const vy = between(...kind.vy);
    const phase = rnd() * Math.PI * 2;
    let t = rnd() * 10;
    scene.events.on('update', (_: number, dt: number) => {
      t += dt / 1000;
      p.x += (vx + Math.sin(t * 1.3 + phase) * kind.sway) * (dt / 1000);
      p.y += vy * (dt / 1000);
      if (p.y > area.y1) p.y = area.y0;
      if (p.y < area.y0) p.y = area.y1;
      if (p.x > area.x1) p.x = area.x0;
      if (p.x < area.x0) p.x = area.x1;
      if (kind.blink) p.setAlpha(0.35 + 0.65 * Math.max(0, Math.sin(t * 2 + phase)));
    });
  }
}
