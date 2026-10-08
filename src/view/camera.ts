import type Phaser from 'phaser';
import { ZOOM } from './zoom';

/** Every scene calls this first: world units are base pixels (640×360). */
export function pixelCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  return scene.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
}
