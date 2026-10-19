import type Phaser from 'phaser';
import { BACKDROPS, type BackdropId } from '../art/backdrops';
import { gradeView } from '../art/window';
import { SEASONS, SKY_TIMES, WEATHERS, type Moon, type Season, type SkyTime, type Weather } from '../core';
import { COUNTER_TOP, SHOP_LANTERNS } from '../art/scenes/shop';
import { TOWN_LAMPS } from '../art/scenes/town';
import { GUILD_LIGHTS, guildHallBackdrop } from '../art/scenes/guild';
import { nightMarketBackdrop, nightMarketLights } from '../art/scenes/market';
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

/** `?season=`, `?time=` and `?weather=` override what the run says, for previewing the window. */
export function viewOverrides(): { season?: Season; time?: SkyTime; weather?: Weather } {
  const season = params.get('season') as Season | null;
  const time = params.get('time') as SkyTime | null;
  const weather = params.get('weather') as Weather | null;
  return {
    ...(weather && WEATHERS.includes(weather) ? { weather } : {}),
    ...(season && SEASONS.includes(season) ? { season } : {}),
    ...(time && SKY_TIMES.includes(time) ? { time } : {}),
  };
}

/**
 * Returns a texture of the shop window's view regraded for a season, time of day and weather,
 * building (and caching) it from the painted view on first use.
 */
export function gradedView(scene: Phaser.Scene, viewKey: string, id: BackdropId, season: Season, time: SkyTime, weather: Weather = 'clear'): string {
  const key = `${viewKey}/${season}-${time}-${weather}`;
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
  const graded = gradeView({ width: src.width, height: src.height, data: src.data }, season, time, b.view.skyTop, b.view.horizon, weather);
  const tex = scene.textures.createCanvas(key, img.width, img.height)!;
  tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(graded), img.width, img.height), 0, 0);
  tex.refresh();
  return key;
}

/** A code-drawn place behind an evening screen (the Night Market street, the Guild Hall), with its lamps. */
export type PlaceBackdrop = { texture: string; lights: readonly { x: number; y: number; scale: number }[] };

/** Builds a code-drawn backdrop the first time it is shown, so boot doesn't pay for every season and moon. */
export function lazyTexture(scene: Phaser.Scene, key: string, make: () => { width: number; height: number; data: Uint8ClampedArray }): string {
  if (scene.textures.exists(key)) return key;
  const px = make();
  const tex = scene.textures.createCanvas(key, px.width, px.height)!;
  tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  tex.refresh();
  return key;
}

export function guildBackdrop(scene: Phaser.Scene, season: Season): PlaceBackdrop {
  return { texture: lazyTexture(scene, `bg/guild-${season}`, () => guildHallBackdrop({ season })), lights: GUILD_LIGHTS };
}

/** The Night Market street for this season and moon; snowed in, only the Hearth Trader's stall is lit. */
export function marketBackdrop(scene: Phaser.Scene, season: Season, moon: Moon, snowedIn: boolean): PlaceBackdrop {
  const buried = snowedIn && season === 'winter';
  // Winter has a painting (Jacob's market square); the other seasons and a Snowed In night are code-drawn for now.
  if (season === 'winter' && !buried && !codeBackdrops) return { texture: backdropTexture('night-market-winter'), lights: BACKDROPS['night-market-winter'].lights };
  const key = `bg/market-${season}-${moon}${buried ? '-snowed-in' : ''}`;
  return { texture: lazyTexture(scene, key, () => nightMarketBackdrop({ season, moon, snowedIn: buried })), lights: nightMarketLights(buried) };
}
