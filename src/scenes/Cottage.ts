import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { noAnim, type Fixture } from '../debug/params';
import { codex } from '../codex';
import { migrateProfile, perkBlocked, SEASONS, type Profile, type Season } from '../core';
import { unlockName } from '../view/describe';
import { buyPerkNow, loadProfile } from '../profile';
import { cottageBackdrop } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { cap } from '../view/describe';
import { pixelText } from '../view/text';
import { button, panel } from '../view/ui';

/**
 * Your cottage, the home between runs (GDD §13): where you set out for a season, spend Reputation on
 * perks and read the Almanac. Every run starts and ends here once the tutorial is done.
 */
export class Cottage extends Phaser.Scene {
  constructor() {
    super('Cottage');
  }

  private almanac: Phaser.GameObjects.Container | null = null;

  create(data: { fixture?: Fixture | null } = {}) {
    this.almanac = null;
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
    // A fixture shows its profile but can't spend it.
    this.drawPerks(profile, data.fixture ? null : (id) => {
      buyPerkNow(id);
      this.scene.restart({});
    });

    const done = profile.almanac.length;
    this.add.existing(button(this, 320, 300, `Almanac ${done}/${codex.almanac.size}`, () => this.toggleAlmanac(profile), { w: 96, color: 'y' }));
    if (data.fixture?.ui?.almanac) this.toggleAlmanac(profile);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.almanac) this.toggleAlmanac(profile);
        else this.scene.start('Title', {});
        return;
      }
      if (e.key === 'a' || e.key === 'A') return this.toggleAlmanac(profile);
      const season = SEASONS[Number(e.key) - 1];
      if (season && !this.almanac && profile.seasons.includes(season)) start(season);
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

  /** Perks bought with Reputation: each changes how every later run starts. */
  private drawPerks(p: Profile, buy: ((id: string) => void) | null) {
    const x = 450;
    const y = 52;
    this.add.existing(panel(this, x, y, 176, 228, 'k', 0.9, 'n'));
    pixelText(this, x + 88, y + 8, `Reputation ${p.reputation}`, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    pixelText(this, x + 88, y + 24, 'Earned every run, won or lost. Perks last for good.', { size: 7, color: 'a', align: 'center', wrap: 160 }).setOrigin(0.5, 0);

    [...codex.perks.values()].forEach((perk, i) => {
      const ty = y + 50 + i * 42;
      const owned = p.perks.includes(perk.id);
      const why = perkBlocked(p, perk.id);
      this.add.rectangle(x + 8, ty, 160, 38, hex(owned ? 'g' : 'b'), 0.6).setOrigin(0);
      pixelText(this, x + 14, ty + 4, perk.name, { size: 8, color: owned ? 'L' : 'W' });
      pixelText(this, x + 14, ty + 16, perk.text, { size: 6, color: 'a', wrap: 96 });
      if (owned) {
        pixelText(this, x + 136, ty + 8, 'Yours', { size: 7, color: 'L', align: 'center' }).setOrigin(0.5, 0);
        return;
      }
      const b = this.add.existing(button(this, x + 136, ty + 12, `${perk.cost}`, () => buy?.(perk.id), { w: 40, color: 'y' }));
      if (why) b.setEnabled(false);
    });
  }

  /** The Almanac (GDD §13): every entry's goal and what it adds to the pools, done ones lit. */
  private toggleAlmanac(p: Profile) {
    if (this.almanac) {
      this.almanac.destroy();
      this.almanac = null;
      return;
    }
    const c = this.add.container(0, 0);
    this.almanac = c;
    c.add(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.6).setOrigin(0).setInteractive());
    c.add(panel(this, 20, 24, 600, 312, 'k', 0.96, 'n'));
    c.add(pixelText(this, 320, 32, 'The Almanac', { size: 12, color: 'y', align: 'center' }).setOrigin(0.5, 0));
    c.add(pixelText(this, 320, 48, `${p.almanac.length} of ${codex.almanac.size} done. Meet a goal in any run, won or lost, and what it adds joins the pools for good.`, { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0));
    const rows = Math.ceil(codex.almanac.size / 2);
    [...codex.almanac.values()].forEach((e, i) => {
      const x = 30 + Math.floor(i / rows) * 292;
      const y = 64 + (i % rows) * 36;
      const done = p.almanac.includes(e.id);
      c.add(this.add.rectangle(x, y, 286, 33, hex(done ? 'g' : 'b'), done ? 0.6 : 0.4).setOrigin(0));
      c.add(pixelText(this, x + 6, y + 3, done ? `${e.name} · done` : e.name, { size: 8, color: done ? 'L' : 'W' }));
      c.add(pixelText(this, x + 280, y + 4, e.goal, { size: 7, color: done ? 'L' : 'a', align: 'right' }).setOrigin(1, 0));
      c.add(pixelText(this, x + 6, y + 18, `Adds ${e.unlocks.map(unlockName).join(', ')}`, { size: 6, color: done ? 'w' : 'S', wrap: 274 }));
    });
    c.add(button(this, 320, 324, 'Close', () => this.toggleAlmanac(p), { w: 60 }));
  }
}
