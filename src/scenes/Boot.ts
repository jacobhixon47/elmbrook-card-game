import Phaser from 'phaser';
import type { Pixmap } from '../art/pixmap';
import { proceduralTextures } from '../art/procedural';
import { rasterize } from '../art/sprite';
import { SPRITES } from '../art/sprites';
import { loadFixture } from '../debug/params';

function addTexture(scene: Phaser.Scene, key: string, px: { width: number; height: number; data: Uint8ClampedArray }) {
  const tex = scene.textures.createCanvas(key, px.width, px.height);
  if (!tex) throw new Error(`could not create texture ${key}`);
  tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  tex.refresh();
}

/** Builds every texture from code (sprite grids + procedural art), then routes to the first scene. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    for (const def of SPRITES) addTexture(this, def.id, rasterize(def));
    const procedural: Record<string, Pixmap> = proceduralTextures();
    for (const [key, pm] of Object.entries(procedural)) addTexture(this, key, pm);

    const fixture = loadFixture();
    this.scene.start(fixture?.scene ?? 'Title', { fixture });
  }
}
