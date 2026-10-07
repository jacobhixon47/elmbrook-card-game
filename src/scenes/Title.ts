import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { noAnim } from '../debug/params';
import { createCard } from '../view/card';
import { pixelText } from '../view/text';

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.add.image(0, 0, 'bg/night').setOrigin(0);

    pixelText(this, 320, 52, 'ELMBROOK', { size: 32, font: 'display', color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5);
    pixelText(this, 320, 84, '~ Night Market ~', { size: 16, color: 'm', stroke: 'k', align: 'center' }).setOrigin(0.5);

    // A fan of cards behind the cauldron.
    const fan = ['nightshade', 'emberbloom', 'elmroot', 'creekwater', 'thistledown'];
    fan.forEach((id, i) => {
      const card = createCard(this, 320 + (i - 2) * 46, 214 + Math.abs(i - 2) * 6, id);
      card.setAngle((i - 2) * 9);
      if (!noAnim) {
        this.tweens.add({ targets: card, y: card.y - 3, duration: 1400, yoyo: true, repeat: -1, delay: i * 180, ease: 'Sine.easeInOut' });
      }
    });

    const cauldron = this.add.image(320, 300, 'prop/cauldron');
    this.add.ellipse(320, 290, 80, 18, hex('l'), 0.12);

    if (!noAnim) {
      this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          const b = this.add.image(320 + Phaser.Math.Between(-22, 22), cauldron.y - 14, 'fx/bubble');
          this.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(18, 40), alpha: 0, duration: 900, onComplete: () => b.destroy() });
        },
      });
    }

    const prompt = pixelText(this, 320, 344, 'press any key', { size: 8, color: 'v', align: 'center' }).setOrigin(0.5);
    if (!noAnim) this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    const go = () => this.scene.start('Hand', {});
    this.input.keyboard?.once('keydown', go);
    this.input.once('pointerdown', go);

    markReady(this);
  }
}
