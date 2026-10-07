import Phaser from 'phaser';
import { proceduralTextures } from '../art/procedural';
import { SPRITES } from '../art/sprites';
import { markReady } from '../debug/hook';
import { pixelCamera } from '../view/camera';
import { pixelText } from '../view/text';

/** In-game contact sheet of every sprite at 2x, for reviewing art in one look. */
export class ArtSheet extends Phaser.Scene {
  constructor() {
    super('ArtSheet');
  }

  create() {
    pixelCamera(this);
    this.cameras.main.setBackgroundColor('#3a3850');
    pixelText(this, 8, 4, 'Sprites (2x)', { size: 8, color: 'w' });
    SPRITES.forEach((def, i) => {
      const x = 24 + (i % 14) * 44;
      const y = 34 + Math.floor(i / 14) * 48;
      this.add.image(x, y, def.id).setScale(2);
      pixelText(this, x, y + 18, def.id.split('/')[1] ?? def.id, { size: 8, color: 'w', align: 'center' }).setOrigin(0.5, 0);
    });
    pixelText(this, 8, 180, 'Procedural', { size: 8, color: 'w' });
    let x = 8;
    for (const key of Object.keys(proceduralTextures())) {
      if (key.startsWith('bg/')) continue;
      const img = this.add.image(x, 194, key).setOrigin(0, 0);
      x += img.width + 8;
    }
    markReady(this);
  }
}
