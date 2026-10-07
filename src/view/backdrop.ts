import { BACKDROPS, type BackdropId } from '../art/backdrops';
import { COUNTER_TOP, SHOP_LANTERNS } from '../art/scenes/shop';
import { params } from '../debug/params';

/** `?backdrops=code` swaps painted backdrops for the code-drawn ones (useful when tuning procedural art). */
export const codeBackdrops = params.get('backdrops') === 'code';

export type SceneBackdrop = { texture: string; lights: readonly { x: number; y: number; scale: number }[]; counterTop: number };

export function backdropTexture(id: BackdropId): string {
  return `backdrop/${id}`;
}

export function shopBackdrop(): SceneBackdrop {
  if (codeBackdrops) {
    return { texture: 'bg/shop', lights: SHOP_LANTERNS.map((l) => ({ x: l.x, y: l.y - 2, scale: 1.3 })), counterTop: COUNTER_TOP };
  }
  const b = BACKDROPS.shop;
  return { texture: backdropTexture('shop'), lights: b.lights, counterTop: b.counterTop };
}
