import Phaser from 'phaser';
import { hex } from '../art/palette';
import { windowParticles, type Area } from '../art/particles';
import type { Season, SkyTime, Weather } from '../core';
import { noAnim } from '../debug/params';

/**
 * Seasonal and weather particles inside a window. Add this between the view and the painted
 * room, so the room's frame hides anything outside the glass. With ?noanim=1 they hold still.
 */
export function addWeather(scene: Phaser.Scene, area: Area, season: Season, time: SkyTime, weather: Weather = 'clear'): void {
  for (const q of windowParticles(season, time, weather, area)) {
    const p = (q.texture ? scene.add.image(q.x, q.y, q.texture) : scene.add.rectangle(q.x, q.y, q.w, q.h, hex(q.color))).setOrigin(0).setAlpha(q.alpha);
    if (q.blink) p.setBlendMode(Phaser.BlendModes.ADD);
    if (noAnim) continue;
    let t = q.phase;
    scene.events.on('update', (_: number, dt: number) => {
      const s = dt / 1000;
      t += s;
      p.x += (q.vx + Math.sin(t * 1.3 + q.phase) * q.sway) * s;
      p.y += q.vy * s;
      if (p.y > area.y1) p.y = area.y0 - q.h;
      if (p.y < area.y0 - q.h) p.y = area.y1;
      if (p.x > area.x1) p.x = area.x0 - q.w;
      if (p.x < area.x0 - q.w) p.x = area.x1;
      if (q.blink) p.setAlpha(q.alpha * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2 + q.phase))));
    });
  }
}
