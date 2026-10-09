import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { noAnim, type Fixture } from '../debug/params';
import { migrateProfile, SEASONS, type Profile, type Season } from '../core';
import { loadProfile } from '../profile';
import { cottageBackdrop } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { cap } from '../view/describe';
import { pixelText } from '../view/text';
import { button, panel } from '../view/ui';

/**
 * Your cottage, the home between runs (GDD §13): where you set out for a season, and where
 * Reputation will buy perks. Every run starts and ends here once the tutorial is done.
 */
export class Cottage extends Phaser.Scene {
  constructor() {
    super('Cottage');
  }

  create(data: { fixture?: Fixture | null } = {}) {
    pixelCamera(this);
    const bg = cottageBackdrop();
    this.add.image(0, 0, bg.texture).setOrigin(0);
    for (const l of bg.lights) {
      const glow = this.add.image(l.x, l.y, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(l.scale).setAlpha(0.18);
      if (!noAnim) this.tweens.add({ targets: glow, alpha: 0.1, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const profile = data.fixture ? migrateProfile(data.fixture.profile ?? null) : loadProfile();
    const start = (season: Season) => this.scene.start('Run', { season });

    pixelText(this, 320, 16, 'Your cottage', { size: 16, color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
    this.drawYear(profile, start);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const season = SEASONS[Number(e.key) - 1];
      if (season && profile.seasons.includes(season)) start(season);
      if (e.key === 'Escape') this.scene.start('Title', {});
    });
    markReady(this);
  }

  /** The Year's four seasons: set out for an open one; a locked one says which win opens it. */
  private drawYear(p: Profile, start: (s: Season) => void) {
    const x = 14;
    const y = 52;
    this.add.existing(panel(this, x, y, 176, 228, 'k', 0.9, 'n'));
    pixelText(this, x + 88, y + 8, p.years ? `Year ${p.years + 1}` : 'The Year', { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    pixelText(this, x + 88, y + 24, 'Set out for a season. A win opens the next.', { size: 7, color: 'a', align: 'center', wrap: 160 }).setOrigin(0.5, 0);

    SEASONS.forEach((season, i) => {
      const ty = y + 50 + i * 38;
      const open = p.seasons.includes(season);
      const wins = p.wins[season];
      this.add.rectangle(x + 8, ty, 160, 32, hex(open ? 'b' : 'q'), open ? 0.6 : 0.4).setOrigin(0);
      pixelText(this, x + 14, ty + 4, `${i + 1}  ${cap(season)}`, { size: 8, color: open ? 'W' : 'S' });
      const note = !open ? `Win ${cap(SEASONS[i - 1]!)} to open` : wins ? `Won ${wins === 1 ? 'once' : `${wins} times`}` : 'Not won yet';
      pixelText(this, x + 14, ty + 18, note, { size: 7, color: open ? 'a' : 'S' });
      if (open) this.add.existing(button(this, x + 136, ty + 16, 'Set out', () => start(season), { w: 48, color: 'y' }));
    });

    const runs = p.runs === 1 ? '1 run' : `${p.runs} runs`;
    pixelText(this, x + 88, y + 216, `${runs} · Esc for the title`, { size: 7, color: 'v', align: 'center' }).setOrigin(0.5);
  }
}
