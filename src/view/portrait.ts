import type Phaser from 'phaser';
import { hex } from '../art/palette';
import { pixelText } from './text';

// Character portraits (32x32, `portrait/<customer id>`): on order tickets, in dialogues and scene
// screens, and on the Codex and Townsfolk pages.

export const PORTRAIT_SIZE = 32;

/** A customer's portrait texture, or the placeholder until one is drawn. */
export function portraitKey(scene: Phaser.Scene, id: string): string {
  return scene.textures.exists(`portrait/${id}`) ? `portrait/${id}` : 'placeholder/32';
}

/**
 * A portrait in a small tan frame, top-left at (x, y), at a whole-number scale so the pixels stay
 * crisp. `hidden` draws an empty frame with a question mark, for someone you haven't met.
 */
export function framedPortrait(scene: Phaser.Scene, x: number, y: number, id: string, scale = 1, hidden = false): Phaser.GameObjects.GameObject[] {
  const size = PORTRAIT_SIZE * scale;
  const frame = scene.add.rectangle(x, y, size, size, hex(hidden ? 'q' : 'n')).setOrigin(0).setStrokeStyle(1, hex('k'));
  if (hidden) {
    const mark = pixelText(scene, x + size / 2, y + size / 2, '?', { size: 12 * scale, color: 'S' }).setOrigin(0.5);
    return [frame, mark];
  }
  return [frame, scene.add.image(x, y, portraitKey(scene, id)).setOrigin(0).setScale(scale)];
}
