import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { titleBackdrop } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { noAnim, type Fixture } from '../debug/params';
import type { RunState } from '../core';
import { clearRun, loadRun } from '../save';
import { dayLabel } from '../view/describe';
import { button } from '../view/ui';
import { pixelText } from '../view/text';

const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(data: { fixture?: Fixture | null } = {}) {
    pixelCamera(this);
    const bg = titleBackdrop();
    this.add.image(0, 0, bg.texture).setOrigin(0);
    for (const l of bg.lights) {
      const glow = this.add.image(l.x, l.y, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(l.scale).setAlpha(0.5);
      if (!noAnim) this.tweens.add({ targets: glow, alpha: 0.32, scale: l.scale * 0.92, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Title block centred in the right half, over the sky and water, clear of the jar.
    const TX = 480;
    pixelText(this, TX, 158, 'ELMBROOK', { size: 32, font: 'display', color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5);
    pixelText(this, TX, 190, '~ Night Market ~', { size: 16, color: 'm', stroke: 'k', align: 'center' }).setOrigin(0.5);

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

    // A run saved in this browser can be continued; a fixture shows one from its `state`.
    const saved = data.fixture ? ((data.fixture.state as RunState | undefined) ?? null) : loadRun();
    const fresh = () => this.scene.start('Run', {});
    if (saved) {
      const resume = () => this.scene.start('Run', { saved });
      const line = `${dayLabel(saved)} · ${cap(saved.season)} · ${saved.gold} gold`;
      this.add.existing(button(this, TX, 222, 'Continue', resume, { w: 96, color: 'y' }));
      pixelText(this, TX, 236, line, { size: 7, color: 'm', stroke: 'k', align: 'center' }).setOrigin(0.5);
      this.add.existing(button(this, TX, 256, 'New run', () => {
        clearRun();
        fresh();
      }, { w: 96 }));
      pixelText(this, TX, 274, 'Enter to continue · N for a new run', { size: 7, color: 'v', align: 'center' }).setOrigin(0.5);
      this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'c') resume();
        if (e.key === 'n') {
          clearRun();
          fresh();
        }
      });
    } else {
      const prompt = pixelText(this, TX, 226, 'press any key', { size: 8, color: 'v', align: 'center' }).setOrigin(0.5);
      if (!noAnim) this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      this.input.keyboard?.once('keydown', fresh);
      this.input.once('pointerdown', fresh);
    }

    markReady(this);
  }
}
