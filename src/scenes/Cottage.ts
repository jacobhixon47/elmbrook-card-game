import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { noAnim, type Fixture } from '../debug/params';
import { codex } from '../codex';
import { boonOf, CODEX_TABLES, migrateProfile, seasonsOf, perkBlocked, perkTierGoal, perkTierOpen, PERK_TIERS, reputationMult, SEASONS, yearModifiers, type CodexTable, type Profile, type Season } from '../core';
import { CODEX_TABS, codexEntries } from '../view/codex';
import { unlockName } from '../view/describe';
import { buyPerkNow, chooseYearNow, loadProfile, pickBoonNow } from '../profile';
import { cottageBackdrop } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { cap } from '../view/describe';
import { pixelText } from '../view/text';
import { button, panel } from '../view/ui';

/**
 * Your cottage, the home between runs (GDD §13): where you set out for a season, spend Reputation on
 * perks, and read the Almanac and the Codex. Every run starts and ends here once the tutorial is done.
 */
export class Cottage extends Phaser.Scene {
  constructor() {
    super('Cottage');
  }

  /** The open Almanac or Codex, drawn over the room. */
  private overlay: Phaser.GameObjects.Container | null = null;

  create(data: { fixture?: Fixture | null; perkTier?: number } = {}) {
    this.overlay = null;
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
    // A fixture shows its profile but can't change it.
    const choose = data.fixture ? null : (year: number) => {
      chooseYearNow(year);
      this.scene.restart({});
    };
    this.drawYear(profile, start, choose);
    // A fixture shows its profile but can't spend it.
    const tier = data.perkTier ?? data.fixture?.ui?.perkTier ?? firstTier(profile);
    this.drawPerks(profile, tier, (t) => this.scene.restart({ ...data, perkTier: t }), data.fixture ? null : (id) => {
      buyPerkNow(id);
      this.scene.restart({ perkTier: tier });
    });

    const met = profile.codex.length;
    const all = Object.values(CODEX_TABLES).reduce((n, t) => n + t.size, 0);
    this.add.existing(button(this, 270, 300, `Codex ${met}/${all}`, () => this.openCodex(profile), { w: 96, color: 'y' }));
    this.add.existing(button(this, 370, 300, `Almanac ${profile.almanac.length}/${codex.almanac.size}`, () => this.openAlmanac(profile), { w: 96, color: 'y' }));
    this.drawYearRules(profile);
    const ui = data.fixture?.ui;
    // A new Year's boon is chosen before anything else.
    if (profile.boonOffer) this.openBoons(profile, data.fixture ? null : (id) => {
      pickBoonNow(id);
      this.scene.restart({});
    });
    if (ui?.almanac) this.openAlmanac(profile);
    if (ui?.codex) this.openCodex(profile, ui.codex as CodexTable, ui.codexPage ?? 0);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (profile.boonOffer) return; // the boon comes first
      if (!this.overlay && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const year = profile.year + (e.key === 'ArrowLeft' ? -1 : 1);
        if (year >= 1 && year <= profile.yearSeasons.length) choose?.(year);
        return;
      }
      if (e.key === 'Escape') {
        if (this.overlay) this.closeOverlay();
        else this.scene.start('Title', {});
        return;
      }
      if (e.key === 'a' || e.key === 'A') return this.overlay ? this.closeOverlay() : this.openAlmanac(profile);
      if (e.key === 'c' || e.key === 'C') return this.overlay ? this.closeOverlay() : this.openCodex(profile);
      const season = SEASONS[Number(e.key) - 1];
      if (season && !this.overlay && seasonsOf(profile).includes(season)) start(season);
    });
    markReady(this);
  }

  /**
   * The chosen Year's four seasons: set out for an open one; a locked one says which win opens it.
   * Once a later Year is open, arrows (or the arrow keys) choose which Year to play, like Ascension.
   */
  private drawYear(p: Profile, start: (s: Season) => void, choose: ((year: number) => void) | null) {
    const x = 14;
    const y = 52;
    this.add.existing(panel(this, x, y, 176, 228, 'k', 0.9, 'n'));
    pixelText(this, x + 88, y + 8, `Year ${p.year}`, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    const top = p.yearSeasons.length;
    if (top > 1) {
      const prev = button(this, x + 30, y + 14, '<', () => choose?.(p.year - 1), { w: 20 });
      const next = button(this, x + 146, y + 14, '>', () => choose?.(p.year + 1), { w: 20 });
      prev.setEnabled(p.year > 1);
      next.setEnabled(p.year < top);
      this.add.existing(prev);
      this.add.existing(next);
    }
    const seasons = seasonsOf(p);
    pixelText(this, x + 88, y + 24, 'Set out for a season. A win opens the next.', { size: 7, color: 'a', align: 'center', wrap: 160 }).setOrigin(0.5, 0);

    SEASONS.forEach((season, i) => {
      const ty = y + 50 + i * 38;
      const open = seasons.includes(season);
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

  /**
   * Perks bought with Reputation: each changes how every later run starts. The board shows one tier
   * at a time; a tier not yet open shows its perks and what opens it.
   */
  private drawPerks(p: Profile, tier: number, show: (tier: number) => void, buy: ((id: string) => void) | null) {
    const x = 450;
    const y = 52;
    this.add.existing(panel(this, x, y, 176, 228, 'k', 0.9, 'n'));
    pixelText(this, x + 88, y + 8, `Reputation ${p.reputation}`, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    const prev = button(this, x + 30, y + 30, '<', () => show(tier - 1), { w: 20 });
    const next = button(this, x + 146, y + 30, '>', () => show(tier + 1), { w: 20 });
    prev.setEnabled(tier > 1);
    next.setEnabled(tier < TOP_TIER);
    this.add.existing(prev);
    this.add.existing(next);
    const open = perkTierOpen(p, tier);
    pixelText(this, x + 88, y + 24, `Tier ${tier} of ${TOP_TIER}`, { size: 8, color: open ? 'W' : 'S', align: 'center' }).setOrigin(0.5, 0);
    pixelText(this, x + 88, y + 42, open ? 'Earned every run. Perks last for good.' : perkTierGoal(tier), { size: 6, color: open ? 'a' : 'y', align: 'center', wrap: 164 }).setOrigin(0.5, 0);

    [...codex.perks.values()].filter((perk) => perk.tier === tier).forEach((perk, i) => {
      const ty = y + 54 + i * 41;
      const owned = p.perks.includes(perk.id);
      const why = perkBlocked(p, perk.id);
      this.add.rectangle(x + 8, ty, 160, 38, hex(owned ? 'g' : open ? 'b' : 'q'), open ? 0.6 : 0.4).setOrigin(0);
      pixelText(this, x + 14, ty + 4, perk.name, { size: 8, color: owned ? 'L' : open ? 'W' : 'S' });
      pixelText(this, x + 14, ty + 16, perk.text, { size: 6, color: open ? 'a' : 'S', wrap: 96 });
      if (owned) {
        pixelText(this, x + 136, ty + 8, 'Yours', { size: 7, color: 'L', align: 'center' }).setOrigin(0.5, 0);
        return;
      }
      const b = this.add.existing(button(this, x + 136, ty + 12, `${perk.cost}`, () => buy?.(perk.id), { w: 40, color: 'y' }));
      if (why) b.setEnabled(false);
    });
  }

  /** After a loop: the Year's modifiers and boon, under the title. */
  private drawYearRules(p: Profile) {
    const boon = boonOf(p);
    if (p.year <= 1 && !boon) return;
    const lines = [
      `Year ${p.year}: Reputation ×${reputationMult(p.year)}`,
      ...yearModifiers(p.year).map((m) => m.text),
      ...(boon ? [`Boon: ${codex.boons.get(boon)!.name}. ${codex.boons.get(boon)!.text}`] : []),
    ];
    const t = pixelText(this, 320, 44, lines.join('\n'), { size: 7, color: 'w', align: 'center', wrap: 236 }).setOrigin(0.5, 0);
    this.add.rectangle(320, 40, 248, t.height + 8, hex('k'), 0.8).setOrigin(0.5, 0).setStrokeStyle(1, hex('n'));
    t.setDepth(1);
  }

  /** Looping into a new Year: choose one of three boons, kept for the whole Year. */
  private openBoons(p: Profile, pick: ((id: string) => void) | null) {
    this.closeOverlay();
    const c = this.add.container(0, 0);
    this.overlay = c;
    c.add(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.6).setOrigin(0).setInteractive());
    c.add(panel(this, 110, 90, 420, 170, 'k', 0.96, 'n'));
    c.add(pixelText(this, 320, 100, `Year ${p.year} begins`, { size: 12, color: 'y', align: 'center' }).setOrigin(0.5, 0));
    c.add(pixelText(this, 320, 118, 'Choose a boon. It lasts every run this Year.', { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0));
    (p.boonOffer ?? []).forEach((id, i) => {
      const b = codex.boons.get(id)!;
      const x = 124 + i * 132;
      c.add(this.add.rectangle(x, 136, 124, 80, hex('b'), 0.6).setOrigin(0));
      c.add(pixelText(this, x + 62, 142, b.name, { size: 8, color: 'W', align: 'center', wrap: 116 }).setOrigin(0.5, 0));
      c.add(pixelText(this, x + 62, 160, b.text, { size: 7, color: 'a', align: 'center', wrap: 112 }).setOrigin(0.5, 0));
      c.add(button(this, x + 62, 236, 'Choose', () => pick?.(id), { w: 64, color: 'y' }));
    });
  }

  private closeOverlay() {
    this.overlay?.destroy();
    this.overlay = null;
  }

  /** A panel over the room with a title and a Close button. */
  private openOverlay(title: string): Phaser.GameObjects.Container {
    this.closeOverlay();
    const c = this.add.container(0, 0);
    this.overlay = c;
    c.add(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.6).setOrigin(0).setInteractive());
    c.add(panel(this, 20, 24, 600, 312, 'k', 0.96, 'n'));
    c.add(pixelText(this, 320, 32, title, { size: 12, color: 'y', align: 'center' }).setOrigin(0.5, 0));
    c.add(button(this, 320, 324, 'Close', () => this.closeOverlay(), { w: 60 }));
    return c;
  }

  /** The Almanac (GDD §13): every entry's goal and what it adds to the pools, done ones lit. */
  private openAlmanac(p: Profile) {
    const c = this.openOverlay('The Almanac');
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
  }

  /** The Codex (GDD §13): every card, recipe, familiar, relic and customer, a tab each, hidden until met in a run. */
  private openCodex(p: Profile, tab: CodexTable = 'ingredients', page = 0) {
    const PER_PAGE = 15;
    const entries = codexEntries(tab, p.codex);
    const pages = Math.ceil(entries.length / PER_PAGE);
    page = Math.max(0, Math.min(pages - 1, page));
    const c = this.openOverlay('The Codex');
    const met = entries.filter((e) => e.met).length;
    c.add(pixelText(this, 320, 48, `${met} of ${entries.length} met. Everything you meet in a run is written here.${pages > 1 ? `  Page ${page + 1} of ${pages}` : ''}`, { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0));
    CODEX_TABS.forEach((t, i) => {
      c.add(button(this, 320 + (i - 2.5) * 96, 66, t.name, () => this.openCodex(p, t.id), { w: 88, color: t.id === tab ? 'y' : 'W' }));
    });
    entries.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((e, i) => {
      const x = 30 + (i % 3) * 196;
      const y = 82 + Math.floor(i / 3) * 44;
      c.add(this.add.rectangle(x, y, 192, 40, hex(e.met ? 'b' : 'q'), e.met ? 0.6 : 0.4).setOrigin(0));
      c.add(pixelText(this, x + 6, y + 3, e.name, { size: 8, color: e.met ? 'W' : 'S' }));
      c.add(pixelText(this, x + 6, y + 14, e.sub, { size: 6, color: e.met ? 'y' : 'S' }));
      if (e.text) c.add(pixelText(this, x + 6, y + 23, e.text, { size: 6, color: 'w', wrap: 180 }));
    });
    if (pages > 1) {
      const prev = button(this, 230, 324, 'Prev', () => this.openCodex(p, tab, page - 1), { w: 60 });
      const next = button(this, 410, 324, 'Next', () => this.openCodex(p, tab, page + 1), { w: 60 });
      prev.setEnabled(page > 0);
      next.setEnabled(page < pages - 1);
      c.add([prev, next]);
    }
  }
}

const TOP_TIER = 1 + PERK_TIERS.length;

/** The perk board opens at the first open tier with something left to buy, else the top open tier. */
function firstTier(p: Profile): number {
  const tiers = Array.from({ length: TOP_TIER }, (_, i) => i + 1).filter((t) => perkTierOpen(p, t));
  return tiers.find((t) => [...codex.perks.values()].some((perk) => perk.tier === t && !p.perks.includes(perk.id))) ?? tiers.at(-1)!;
}
