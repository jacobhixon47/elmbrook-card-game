import Phaser from 'phaser';
import { BACKDROPS, type BackdropId } from '../art/backdrops';
import type { Pixmap } from '../art/pixmap';
import { proceduralTextures } from '../art/procedural';
import { rasterize } from '../art/sprite';
import { SPRITES } from '../art/sprites';
import { loadFixture } from '../debug/params';
import { backdropTexture } from '../view/backdrop';

function addTexture(scene: Phaser.Scene, key: string, px: { width: number; height: number; data: Uint8ClampedArray }) {
  const tex = scene.textures.createCanvas(key, px.width, px.height);
  if (!tex) throw new Error(`could not create texture ${key}`);
  tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  tex.refresh();
}

/** Soft warm light for lanterns and candles, drawn additively. Light, not pixels, so it is smooth. */
function addGlow(scene: Phaser.Scene) {
  const size = 128;
  const tex = scene.textures.createCanvas('fx/glow', size, size)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 233, 163, 0.9)');
  g.addColorStop(0.25, 'rgba(247, 207, 90, 0.45)');
  g.addColorStop(0.6, 'rgba(232, 135, 58, 0.12)');
  g.addColorStop(1, 'rgba(232, 135, 58, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

/** Builds every texture from code (sprite grids + procedural art), then routes to the first scene. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const [id, b] of Object.entries(BACKDROPS)) this.load.image(backdropTexture(id as BackdropId), b.file);
  }

  create() {
    for (const def of SPRITES) addTexture(this, def.id, rasterize(def));
    const procedural: Record<string, Pixmap> = proceduralTextures();
    for (const [key, pm] of Object.entries(procedural)) addTexture(this, key, pm);

    addGlow(this);

    const fixture = loadFixture();
    this.scene.start(fixture?.scene ?? 'Title', { fixture });
  }
}
