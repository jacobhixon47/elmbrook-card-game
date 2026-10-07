import type Phaser from 'phaser';
import { BACKDROPS, type BackdropId } from '../art/backdrops';
import { gradeView } from '../art/window';
import { SEASONS, SKY_TIMES, type Season, type SkyTime } from '../core';
import { COUNTER_TOP, SHOP_LANTERNS } from '../art/scenes/shop';
import { TOWN_LAMPS } from '../art/scenes/town';
import { params } from '../debug/params';

/** `?backdrops=code` swaps painted backdrops for the code-drawn ones (useful when tuning procedural art). */
export const codeBackdrops = params.get('backdrops') === 'code';

export type SceneBackdrop = { texture: string; view?: string; window?: { x0: number; y0: number; x1: number; y1: number }; lights: readonly { x: number; y: number; scale: number }[]; counterTop: number };

export function backdropTexture(id: BackdropId): string {
  return `backdrop/${id}`;
}

export function shopBackdrop(): SceneBackdrop {
  if (codeBackdrops) {
    return { texture: 'bg/shop', lights: SHOP_LANTERNS.map((l) => ({ x: l.x, y: l.y - 2, scale: 1.3 })), counterTop: COUNTER_TOP };
  }
  const b = BACKDROPS.shop;
  return { texture: backdropTexture('shop'), view: `${backdropTexture('shop')}-view`, window: b.view.area, lights: b.lights, counterTop: b.counterTop };
}

export function titleBackdrop(): SceneBackdrop {
  if (codeBackdrops) return { texture: 'bg/night', lights: TOWN_LAMPS.map((l) => ({ x: l.x + 0.5, y: l.y, scale: 0.5 })), counterTop: 0 };
  const b = BACKDROPS.title;
  return { texture: backdropTexture('title'), lights: b.lights, counterTop: 0 };
}

/** `?season=` and `?time=` override what the run says, for previewing the window. */
export function viewOverrides(): { season?: Season; time?: SkyTime } {
  const season = params.get('season') as Season | null;
  const time = params.get('time') as SkyTime | null;
  return {
    ...(season && SEASONS.includes(season) ? { season } : {}),
    ...(time && SKY_TIMES.includes(time) ? { time } : {}),
  };
}

/**
 * Returns a texture of the shop window's view regraded for a season and time of day,
 * building (and caching) it from the painted view on first use.
 */
export function gradedView(scene: Phaser.Scene, viewKey: string, id: BackdropId, season: Season, time: SkyTime): string {
  const key = `${viewKey}/${season}-${time}`;
  if (scene.textures.exists(key)) return key;
  const b = BACKDROPS[id];
  if (!('view' in b)) throw new Error(`backdrop ${id} has no window view`);
  const img = scene.textures.get(viewKey).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, img.width, img.height);
  const graded = gradeView({ width: src.width, height: src.height, data: src.data }, season, time, b.view.skyTop, b.view.horizon);
  const tex = scene.textures.createCanvas(key, img.width, img.height)!;
  tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(graded), img.width, img.height), 0, 0);
  tex.refresh();
  return key;
}
