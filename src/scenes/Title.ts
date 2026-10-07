import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { titleBackdrop } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { noAnim } from '../debug/params';
import { createCard } from '../view/card';
import { pixelText } from '../view/text';

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    pixelCamera(this);
    const bg = titleBackdrop();
    this.add.image(0, 0, bg.texture).setOrigin(0);
    for (const l of bg.lights) {
      const glow = this.add.image(l.x, l.y, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(l.scale).setAlpha(0.5);
      if (!noAnim) this.tweens.add({ targets: glow, alpha: 0.32, scale: l.scale * 0.92, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    pixelText(this, 320, 52, 'ELMBROOK', { size: 32, font: 'display', color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5);
    pixelText(this, 320, 84, '~ Night Market ~', { size: 16, color: 'm', stroke: 'k', align: 'center' }).setOrigin(0.5);

    // A fan of cards over the moonlit water, clear of the firefly jar.
    const FAN_X = 420;
    const FAN_Y = 238;
    const fan = ['nightshade', 'emberbloom', 'elmroot', 'creekwater', 'thistledown'];
    fan.forEach((id, i) => {
      const card = createCard(this, FAN_X + (i - 2) * 40, FAN_Y + Math.abs(i - 2) * 6, id);
      card.setAngle((i - 2) * 9);
      if (!noAnim) {
        this.tweens.add({ targets: card, y: card.y - 3, duration: 1400, yoyo: true, repeat: -1, delay: i * 180, ease: 'Sine.easeInOut' });
      }
    });

    // Fireflies drifting up out of the jar's glow.
    const source = bg.lights[0];
    if (!noAnim && source) {
      this.time.addEvent({
        delay: 340,
        loop: true,
        callback: () => {
          const fly = this.add.rectangle(source.x + Phaser.Math.Between(-40, 40), source.y + Phaser.Math.Between(-30, 20), 1, 1, hex(Phaser.Math.RND.pick(['Y', 'y', 'L'] as const)));
          fly.setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: fly,
            x: fly.x + Phaser.Math.Between(-30, 50),
            y: fly.y - Phaser.Math.Between(30, 90),
            alpha: { from: 1, to: 0 },
            duration: Phaser.Math.Between(1800, 3200),
            ease: 'Sine.easeOut',
            onComplete: () => fly.destroy(),
          });
        },
      });
    }

    const prompt = pixelText(this, FAN_X, 334, 'press any key', { size: 8, color: 'v', align: 'center' }).setOrigin(0.5);
    if (!noAnim) this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    const go = () => this.scene.start('Hand', {});
    this.input.keyboard?.once('keydown', go);
    this.input.once('pointerdown', go);

    markReady(this);
  }
}
