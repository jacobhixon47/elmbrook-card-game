import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { titleBackdrop } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { noAnim, type Fixture } from '../debug/params';
import { homeSeason, migrateProfile, type RunState } from '../core';
import { playMusic } from '../audio/sfx';
import { loadProfile } from '../profile';
import { clearRun, loadRun } from '../save';
import { dayLabel } from '../view/describe';
import { button } from '../view/ui';
import { pixelText } from '../view/text';
import { openSettings } from '../view/settings';

const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);

export class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(data: { fixture?: Fixture | null } = {}) {
    pixelCamera(this);
    playMusic('title', homeSeason(loadProfile()));
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

    // A run saved in this browser can be continued; a fixture shows one from its `state`, and its `profile`.
    const saved = data.fixture ? ((data.fixture.state as RunState | undefined) ?? null) : loadRun();
    const profile = data.fixture ? migrateProfile(data.fixture.profile ?? null) : loadProfile();
    // The first run is the tutorial; after that every run starts from the cottage (GDD §13).
    const fresh = () => (profile.tutorialDone ? this.scene.start('Cottage', {}) : this.scene.start('Run', {}));
    const keys = this.input.keyboard;
    // Keys do nothing here while Settings is open, and Esc never starts a run.
    let settingsOpen = false;
    const settings = () => {
      settingsOpen = true;
      openSettings(this, () => (settingsOpen = false));
    };
    const idle = (e: KeyboardEvent) => !settingsOpen && e.key !== 'Escape';
    this.add.existing(button(this, 590, 334, 'Settings', settings, { w: 72 }));
    pixelText(this, 590, 345, 'M mutes', { size: 6, color: 'a', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
    if (data.fixture?.ui?.settings) settings();
    if (saved) {
      const resume = () => this.scene.start('Run', { saved });
      const line = `${dayLabel(saved)} · ${cap(saved.season)} · ${saved.gold} gold`;
      const shown = [
        this.add.existing(button(this, TX, 222, 'Continue', resume, { w: 96, color: 'y' })),
        pixelText(this, TX, 236, line, { size: 7, color: 'm', stroke: 'k', align: 'center' }).setOrigin(0.5),
        this.add.existing(button(this, TX, 256, 'New run', () => newRun(), { w: 96 })),
        pixelText(this, TX, 274, 'Enter to continue · N for a new run', { size: 7, color: 'v', align: 'center' }).setOrigin(0.5),
      ];
      const newRun = () => {
        keys?.off('keydown', onKey);
        clearRun();
        shown.forEach((o) => o.destroy());
        fresh();
      };
      const onKey = (e: KeyboardEvent) => {
        if (!idle(e)) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'c') resume();
        if (e.key === 'n') newRun();
      };
      keys?.on('keydown', onKey);
    } else {
      const prompt = pixelText(this, TX, 226, 'press any key', { size: 8, color: 'v', align: 'center' }).setOrigin(0.5);
      if (!noAnim) this.tweens.add({ targets: prompt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      const onAnyKey = (e: KeyboardEvent) => {
        if (!idle(e)) return;
        keys?.off('keydown', onAnyKey);
        fresh();
      };
      keys?.on('keydown', onAnyKey);
      // Any click starts, except one on a button (Settings) or while Settings is open.
      const onClick = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length) return;
        this.input.off('pointerdown', onClick);
        fresh();
      };
      this.input.on('pointerdown', onClick);
    }

    markReady(this);
  }
}
