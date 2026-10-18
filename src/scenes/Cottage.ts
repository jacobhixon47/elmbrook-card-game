import Phaser from 'phaser';
import { hex } from '../art/palette';
import { markReady } from '../debug/hook';
import { noAnim, type Fixture } from '../debug/params';
import { codex } from '../codex';
import { ALMANAC_FIRST_PAGE, FRIENDSHIP, keepsakesOpen, boonOf, cauldronOpen, runStartChoice, witchOpen, homeSeason, migrateProfile, seasonsOf, perkBlocked, perkTierGoal, perkTierOpen, PERK_TIERS, reputationMult, SEASONS, yearModifiers, type CodexTable, type Profile, type Season } from '../core';
import { CODEX_TABS, codexEntries, type CodexEntry } from '../view/codex';
import { unlockName } from '../view/describe';
import { buyPerkNow, chooseYearNow, loadProfile, pickBoonNow, saveProfile } from '../profile';
import { backdropTexture, codeBackdrops, gradedView } from '../view/backdrop';
import { play } from '../audio/sfx';
import { ROOM_LIGHTS, ROOM_WINDOWS, roomLight } from '../art/scenes/cottage-room';
import { pixelCamera } from '../view/camera';
import { cap } from '../view/describe';
import { openSettings } from '../view/settings';
import { pixelText } from '../view/text';
import { button, panel } from '../view/ui';
import { DOORSTEP, DRESSING, facing, HEARTH, onRug, PROPS, ROOM_SCALE, SEASON_LIGHT, SPAWN, STATIONS, standBy, stationAt, walk, type Facing, type Point, type Station, type StationId } from '../view/room';
import type { PaletteKey } from '../art/palette';

/**
 * Your cottage, the home between runs (GDD §13): where you set out for a season, spend Reputation on
 * perks, and read the Almanac and the Codex. Every run starts and ends here once the tutorial is done.
 */
export class Cottage extends Phaser.Scene {
  constructor() {
    super('Cottage');
  }

  /** The open panel (a station's, the Almanac, the Codex or a boon), drawn over the room. */
  private overlay: Phaser.GameObjects.Container | null = null;
  private settingsOpen = false;
  private profile!: Profile;
  private fixture: Fixture | null = null;
  private perkTier = 1;
  /** Where you stand, in room pixels (your feet). */
  private pos: Point = { ...SPAWN };
  private face: Facing = 'up';
  private stepClock = 0;
  /** How long you've stood still, for the idle touches. */
  private idleClock = 0;
  /** Until the hearth next crackles. */
  private crackleIn = 2000;
  private you!: Phaser.GameObjects.Image;
  private keys!: WalkKeys;
  /** Each station's sprite, its lit outline, and the prompt over it. */
  private sprites = new Map<StationId, { plain: Phaser.GameObjects.Image; lit: Phaser.GameObjects.Image }>();
  private near: Station | null = null;
  private prompt: Phaser.GameObjects.Container | null = null;
  /** The season the house is dressed for: the one you'll set out for next. */
  private season: Season = 'spring';
  /** Stepping in through the door after a run; you can't walk until you're in. */
  private arriving = false;

  /** `home` is the season of the run you've just come home from. */
  create(data: { fixture?: Fixture | null; perkTier?: number; at?: Point; reopen?: StationId | 'other' | null; home?: Season } = {}) {
    this.overlay = null;
    this.settingsOpen = false;
    this.sprites.clear();
    this.near = null;
    this.prompt = null;
    this.fixture = data.fixture ?? null;
    pixelCamera(this);
    const profile = data.fixture ? migrateProfile(data.fixture.profile ?? null) : loadProfile();
    this.profile = profile;
    this.perkTier = data.perkTier ?? data.fixture?.ui?.perkTier ?? firstTier(profile);
    const ui = data.fixture?.ui;
    // A fixture with a station open stands you by it.
    const spot = ui?.at ?? ui?.station;
    this.pos = data.at ?? (spot ? standBy(spot) : { ...SPAWN });
    this.face = 'up';
    this.season = homeSeason(profile);
    this.arriving = false;
    this.stepClock = 0;
    this.idleClock = 0;

    this.drawRoom();
    this.drawHud(profile);
    const home = data.home ?? ui?.home;
    if (home && !profile.boonOffer) this.comeHome(home);

    // A new Year's boon is chosen before anything else.
    if (profile.boonOffer) this.openBoons(profile, data.fixture ? null : (id) => {
      pickBoonNow(id);
      this.scene.restart({});
    });
    const reopen = ui?.station ?? (data.reopen && data.reopen !== 'other' ? data.reopen : null);
    if (reopen && !profile.boonOffer) this.use(reopen);
    if (ui?.almanac) this.openAlmanac(profile, ui.almanacPage ?? 0);
    if (ui?.codex) this.openCodex(profile, ui.codex as CodexTable, ui.codexPage ?? 0, ui.codexEntry);
    if (ui?.settings) this.openSettings();

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({ w: K.W, a: K.A, s: K.S, d: K.D, up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT }) as WalkKeys;
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.updateNear();
    markReady(this);
  }

  override update(_time: number, delta: number) {
    this.crackle(delta);
    if (this.arriving) return this.stride(delta);
    if (this.overlay || this.settingsOpen || this.profile.boonOffer) return;
    const k = this.keys;
    const dx = (k.d.isDown || k.right.isDown ? 1 : 0) - (k.a.isDown || k.left.isDown ? 1 : 0);
    const dy = (k.s.isDown || k.down.isDown ? 1 : 0) - (k.w.isDown || k.up.isDown ? 1 : 0);
    const from = this.pos;
    this.pos = walk(this.pos, dx, dy, Math.min(delta, 50) / 1000, this.season);
    this.face = facing(dx, dy, this.face);
    // Walking into a wall isn't walking: no steps, and the idle touches carry on.
    if (this.pos.x !== from.x || this.pos.y !== from.y) this.stride(delta);
    else this.idle(delta);
    this.updateNear(true);
  }

  /** A walking frame, with a footstep on each stride: soft on the rug. */
  private stride(delta: number) {
    const before = Math.floor(this.stepClock / 160);
    this.stepClock += delta;
    this.idleClock = 0;
    const step = Math.floor(this.stepClock / 160);
    if (step !== before) play('step', { pitch: step % 2 ? 1.12 : 0.94, volume: onRug(this.pos) ? 0.35 : 1 });
    this.placeYou(step % 2 === 1 ? 1 : 0);
  }

  /**
   * Standing still: after a moment you breathe (a slow one-pixel bob), and after a while you turn to
   * face the room.
   */
  private idle(delta: number) {
    this.stepClock = 0;
    this.idleClock += delta;
    if (noAnim) return this.placeYou(0);
    if (this.idleClock > 6000 && this.face !== 'down') this.face = 'down';
    this.placeYou(0);
    if (this.idleClock > 1500 && Math.floor(this.idleClock / 700) % 2 === 1) this.you.y -= ROOM_SCALE;
  }

  /** The fire crackles now and then, louder the nearer you stand. */
  private crackle(delta: number) {
    if (noAnim) return;
    this.crackleIn -= delta;
    if (this.crackleIn > 0) return;
    this.crackleIn = 1500 + Math.random() * 3500;
    const d = Math.hypot(this.pos.x - HEARTH.x, this.pos.y - HEARTH.y);
    play('crackle', { pitch: 0.8 + Math.random() * 0.5, volume: Math.max(0.15, 1 - d / 220) });
  }

  private onKey(e: KeyboardEvent) {
    if (this.profile.boonOffer || this.settingsOpen || this.arriving) return; // the boon comes first; Settings handles its own Esc
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') return this.overlay ? this.closeOverlay() : this.openSettings();
    if (key === 'f' || e.key === ' ') {
      if (this.overlay) return this.closeOverlay();
      if (this.near) this.use(this.near.id);
      return;
    }
    // In the front door's and the calendar's panels, the arrow keys choose the Year and 1-4 set out.
    if (this.overlayKind === 'door' || this.overlayKind === 'calendar') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const year = this.profile.year + (e.key === 'ArrowLeft' ? -1 : 1);
        if (year >= 1 && year <= this.profile.yearSeasons.length) this.chooseYear(year);
        return;
      }
      const season = SEASONS[Number(e.key) - 1];
      if (this.overlayKind === 'door' && season && seasonsOf(this.profile).includes(season)) this.setOut(season);
    }
  }

  /** The room: walls and floor, then furniture and you, sorted by where your feet are. */
  private drawRoom() {
    const Z = ROOM_SCALE;
    const season = this.season;
    this.add.image(0, 0, 'room/shell').setOrigin(0).setScale(Z).setDepth(-1000);
    // Through the windows, the shop window's painted view graded for the season at twilight, cropped
    // to each window's panes.
    for (const [n, w] of ROOM_WINDOWS.entries()) {
      if (codeBackdrops) {
        this.add.image(w.x * Z, w.y * Z, `room/view-${season}`).setOrigin(0).setScale(Z).setDepth(-1001);
        continue;
      }
      const src = { x: VIEW_CROP.x + n * 150, y: VIEW_CROP.y, w: (w.w * Z) / VIEW_SCALE, h: (w.h * Z) / VIEW_SCALE };
      const view = this.add.image(0, 0, gradedView(this, `${backdropTexture('shop')}-view`, 'shop', season, 'twilight')).setOrigin(0).setDepth(-1001);
      view.setCrop(src.x, src.y, src.w, src.h).setScale(VIEW_SCALE).setPosition(w.x * Z - src.x * VIEW_SCALE, w.y * Z - src.y * VIEW_SCALE);
    }
    for (const prop of PROPS) {
      const img = this.add.image(prop.at.x * Z, prop.at.y * Z, `room/${prop.id}`).setOrigin(0).setScale(Z);
      img.setDepth(prop.solid ? prop.solid.y + prop.solid.h : -500);
      // The cat breathes in its sleep.
      if (prop.id === 'cat' && !noAnim) this.time.addEvent({ delay: 1100, loop: true, callback: () => img.setTexture(img.texture.key === 'room/cat' ? 'room/cat-1' : 'room/cat') });
    }
    // The fire, dancing in the hearth.
    const flames = this.add.image((HEARTH.x - 14) * Z, (HEARTH.y - 11) * Z, 'room/fire-0').setOrigin(0).setScale(Z).setDepth(-900);
    if (!noAnim) {
      let f = 0;
      this.time.addEvent({ delay: 120, loop: true, callback: () => flames.setTexture(`room/fire-${(f = (f + 1 + Math.floor(Math.random() * 2)) % 3)}`) });
    }
    // Steam off the cauldron's brew.
    const pot = STATIONS.find((x) => x.id === 'cauldron')!.at;
    if (!noAnim) {
      for (let k = 0; k < 3; k++) {
        const puff = this.add.image((pot.x + 14 + k * 3) * Z, (pot.y + 4) * Z, 'room/steam').setScale(Z).setAlpha(0).setDepth(80);
        this.tweens.add({ targets: puff, y: (pot.y - 14) * Z, x: puff.x + (k - 1) * 6, alpha: { from: 0.7, to: 0 }, scale: { from: Z * 0.8, to: Z * 1.4 }, duration: 1800, delay: k * 600, repeat: -1 });
      }
    }
    // Every light gets a soft glow that flickers: the fire most, the brew green.
    for (const l of ROOM_LIGHTS) {
      const fire = l.kind === 'fire';
      const glow = this.add.image(l.x * Z, l.y * Z, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(900);
      glow.setScale((l.radius * 2.2) / 128).setAlpha(fire ? (season === 'winter' ? 0.55 : 0.42) : l.kind === 'brew' ? 0.35 : 0.45);
      if (l.kind === 'brew') glow.setTint(hex('l'));
      if (!noAnim) this.tweens.add({ targets: glow, alpha: glow.alpha * (fire ? 0.7 : 0.8), scale: glow.scale * 0.94, duration: fire ? 380 + Math.random() * 200 : 700 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // The season's dressing; flat things lie over the doormat, the rest sort with you.
    DRESSING[season].forEach((d, i) => {
      const img = this.add.image(d.at.x * Z, d.at.y * Z, `room/dress-${season}-${i}`).setOrigin(0).setScale(Z);
      img.setDepth(d.solid ? d.solid.y + d.solid.h : d.flat ? -390 : -600);
      if (d.id === 'firefly-jar') {
        const jar = this.add.image((d.at.x + 5) * Z, (d.at.y + 6) * Z, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.5).setTint(hex('L')).setDepth(-590);
        if (!noAnim) this.tweens.add({ targets: jar, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });
    // And the season's light over everything.
    const light = SEASON_LIGHT[season];
    this.add.rectangle(0, 0, 640, 360, hex(light.color), light.alpha).setOrigin(0).setDepth(1000);
    for (const st of STATIONS) {
      const depth = st.solid ? st.solid.y + st.solid.h : st.id === 'door' ? -400 : -600;
      const lit = this.add.image((st.at.x - 1) * Z, (st.at.y - 1) * Z, `room/${st.id}-lit`).setOrigin(0).setScale(Z).setDepth(depth - 0.5).setVisible(false);
      const plain = this.add.image(st.at.x * Z, st.at.y * Z, `room/${st.id}`).setOrigin(0).setScale(Z).setDepth(depth);
      this.sprites.set(st.id, { plain, lit });
    }
    this.you = this.add.image(0, 0, 'wizard/up-0').setOrigin(0.5, 1).setScale(Z);
    this.placeYou(0);
  }

  private placeYou(frame: 0 | 1) {
    this.you.setTexture(`wizard/${this.face}-${frame}`);
    this.you.setPosition(Math.round(this.pos.x * ROOM_SCALE), Math.round(this.pos.y * ROOM_SCALE) + 2).setDepth(this.pos.y);
    // You're lit like the room: warm by the fire, dim in the corners.
    const level = 0.68 + roomLight(this.pos.x, this.pos.y - 8) * 0.45;
    const c = (f: number) => Math.round(Math.min(1, level * f) * 255);
    this.you.setTint((c(1) << 16) | (c(0.95) << 8) | c(0.9));
  }

  /** Your Year and Reputation in the corner, and how to get about. */
  private drawHud(p: Profile) {
    const head = p.year > 1 ? `Year ${p.year} · Reputation ${p.reputation}` : `Reputation ${p.reputation}`;
    pixelText(this, 22, 8, head, { size: 8, color: 'y', stroke: 'k' }).setDepth(1500);
    pixelText(this, 618, 8, 'WASD to walk · F or Space to use · Esc for settings', { size: 7, color: 'w', stroke: 'k', align: 'right' }).setOrigin(1, 0).setDepth(1500);
  }

  /** Lights up the station you're standing by, with a prompt saying what F does there (and a soft chime when you walk up). */
  private updateNear(walked = false) {
    const st = this.overlay || this.arriving ? null : stationAt(this.pos);
    if (st?.id === this.near?.id) return;
    if (this.near) {
      const old = this.sprites.get(this.near.id)!;
      this.tweens.killTweensOf([old.lit, old.plain]);
      old.lit.setVisible(false).setAlpha(1);
      old.plain.setY(this.near.at.y * ROOM_SCALE);
    }
    this.prompt?.destroy();
    this.prompt = null;
    this.near = st;
    if (!st) return;
    if (walked) play('near');
    const s = this.sprites.get(st.id)!;
    s.lit.setVisible(true);
    if (!noAnim) {
      // A little hop, then the outline breathes while you stand there.
      this.tweens.add({ targets: s.plain, y: st.at.y * ROOM_SCALE - 2, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: s.lit, alpha: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const label = pixelText(this, 0, 0, st.verb, { size: 8, color: 'W' }).setOrigin(0, 0.5);
    const cap = this.add.rectangle(0, 0, 13, 13, hex('y')).setStrokeStyle(1, hex('k'));
    const f = pixelText(this, 0, 0, 'F', { size: 8, color: 'k', align: 'center' }).setOrigin(0.5);
    const w = 13 + 6 + label.width + 12;
    const bg = this.add.rectangle(0, 0, w, 19, hex('k'), 0.88).setStrokeStyle(1, hex('n'));
    cap.setX(-w / 2 + 12);
    f.setX(cap.x);
    label.setX(cap.x + 11);
    // Over the thing (or over you, if you stand in front of it); under your feet if that's off the top.
    const img = s.plain;
    const head = this.you.y - this.you.displayHeight;
    const top = Math.min(img.y, head) - 14;
    const below = top < 26;
    const mid = below ? this.you.x : img.x + img.displayWidth / 2;
    const cx = Math.max(w / 2 + 4, Math.min(640 - w / 2 - 4, mid));
    const cy = below ? this.you.y + 14 : top;
    this.prompt = this.add.container(cx, cy, [bg, cap, f, label]).setDepth(1400);
    if (!noAnim) {
      this.prompt.setAlpha(0).setY(cy + 4);
      this.tweens.add({ targets: this.prompt, alpha: 1, y: cy, duration: 140, ease: 'Quad.easeOut' });
    }
  }

  /**
   * Back from a run: you step in through the front door. If the house has changed season while you
   * were out, a line says so.
   */
  private comeHome(from: Season) {
    const changed = from !== this.season;
    const caption = changed ? pixelText(this, 320, 300, `${cap(this.season)} has come to the cottage.`, { size: 10, color: 'Y', stroke: 'k', align: 'center' }).setOrigin(0.5).setDepth(1500) : null;
    if (noAnim) return;
    this.pos = { ...DOORSTEP };
    this.face = 'up';
    this.arriving = true;
    this.placeYou(0);
    this.tweens.add({
      targets: this.pos, y: SPAWN.y, duration: 450, ease: 'Sine.easeOut',
      onComplete: () => {
        this.arriving = false;
        this.placeYou(0);
        this.updateNear();
      },
    });
    if (caption) {
      caption.setAlpha(0);
      this.tweens.chain({ targets: caption, tweens: [{ alpha: 1, duration: 400, delay: 250 }, { alpha: 0, duration: 600, delay: 2200 }] });
    }
  }

  /** Using a station opens its panel. */
  private use(id: StationId) {
    const p = this.profile;
    switch (id) {
      case 'bookshelf': return this.openCodex(p);
      case 'lectern': return this.openAlmanac(p);
      case 'door': return this.openPanel('door', () => this.drawYear(p, 232, 60));
      case 'calendar': return this.openPanel('calendar', () => this.drawCalendar(p));
      case 'workbench': return this.openPanel('workbench', () => this.drawPerks(p, 232, 60, this.perkTier));
      case 'cauldron': return this.openPanel('cauldron', () => this.drawKit(p, this.fixture?.ui?.kit, !this.fixture));
      case 'pinboard': return this.openPanel('pinboard', () => this.drawKeepsakes(p, !this.fixture));
    }
  }

  private setOut(season: Season) {
    this.scene.start('Run', { season });
  }

  /** A fixture shows its profile but can't change it. */
  private chooseYear(year: number) {
    if (this.fixture) return;
    chooseYearNow(year);
    this.scene.restart({ at: this.pos, reopen: this.overlayKind });
  }

  private openSettings() {
    this.settingsOpen = true;
    openSettings(this, () => (this.settingsOpen = false), () => this.scene.start('Title', {}));
  }

  /** Which station's panel is open, if one is. */
  private overlayKind: StationId | 'other' | null = null;

  /**
   * A station's panel over the room. The draw functions add to the scene as they always have; what
   * they add is gathered into the panel.
   */
  private openPanel(kind: StationId, draw: () => void) {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(2000);
    c.add(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.55).setOrigin(0).setInteractive());
    const before = new Set(this.children.list);
    draw();
    const added = this.children.list.filter((o) => !before.has(o) && o !== c);
    c.add(added);
    // Close sits just under the panel.
    const bottom = Math.max(0, ...added.map((o) => ('getBounds' in o ? (o as unknown as Phaser.GameObjects.Components.GetBounds).getBounds().bottom : 0)));
    c.add(button(this, 320, Math.min(340, bottom + 20), 'Close', () => this.closeOverlay(), { w: 60 }));
    this.overlay = c;
    this.overlayKind = kind;
    this.updateNear();
  }

  /**
   * The chosen Year's four seasons: set out for an open one; a locked one says which win opens it.
   * Once a later Year is open, arrows (or the arrow keys) choose which Year to play, like Ascension.
   */
  private drawYear(p: Profile, x: number, y: number) {
    const start = (season: Season) => this.setOut(season);
    const choose = (year: number) => this.chooseYear(year);
    this.add.existing(panel(this, x, y, 176, 228, 'k', 0.9, 'n'));
    pixelText(this, x + 88, y + 8, `Year ${p.year}`, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    const top = p.yearSeasons.length;
    if (top > 1) {
      const prev = button(this, x + 30, y + 14, '<', () => choose(p.year - 1), { w: 20 });
      const next = button(this, x + 146, y + 14, '>', () => choose(p.year + 1), { w: 20 });
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
      // The season the house is dressed for is the one waiting outside.
      if (open && season === this.season) pixelText(this, x + 70, ty + 5, 'up next', { size: 7, color: 'y' });
      const note = !open ? `Win ${cap(SEASONS[i - 1]!)} to open` : wins ? `Won ${wins === 1 ? 'once' : `${wins} times`}` : 'Not won yet';
      pixelText(this, x + 14, ty + 18, note, { size: 7, color: open ? 'a' : 'S' });
      if (open) this.add.existing(button(this, x + 136, ty + 16, 'Set out', () => start(season), { w: 48, color: 'y' }));
    });

    const runs = p.runs === 1 ? '1 run' : `${p.runs} runs`;
    pixelText(this, x + 88, y + 216, `${runs} · 1-4 to set out`, { size: 7, color: 'v', align: 'center' }).setOrigin(0.5);
  }

  /**
   * Perks bought with Reputation: each changes how every later run starts. The board shows one tier
   * at a time; a tier not yet open shows its perks and what opens it.
   */
  private drawPerks(p: Profile, x: number, y: number, tier: number) {
    const show = (t: number) => {
      this.perkTier = t;
      this.use('workbench');
    };
    // A fixture shows its profile but can't spend it.
    const buy = this.fixture ? null : (id: string) => {
      buyPerkNow(id);
      this.scene.restart({ perkTier: tier, at: this.pos, reopen: 'workbench' });
    };
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

  /**
   * The witch and the cauldron the next run sets out with (GDD §12). Arrows step through all of
   * them; a locked one says what opens it, and choosing an open one remembers it for later runs.
   */
  private drawKit(p: Profile, view: { witch?: string; cauldron?: string } | undefined, save: boolean) {
    const x = 196;
    const y = 127;
    this.add.existing(panel(this, x, y, 248, 106, 'k', 0.9, 'n'));
    const chosen = runStartChoice(p);
    const witches = [...codex.witches.values()];
    const pots = [...codex.cauldrons.values()];
    let w = Math.max(0, witches.findIndex((e) => e.id === (view?.witch ?? chosen.witch)));
    let c = Math.max(0, pots.findIndex((e) => e.id === (view?.cauldron ?? chosen.cauldron)));
    const rows = this.add.container(0, 0);
    const draw = () => {
      rows.removeAll(true);
      const witch = witches[w]!;
      const wOpen = witchOpen(p, witch.id);
      rows.add(this.add.rectangle(x + 8, y + 6, 232, 44, hex(wOpen ? 'b' : 'q'), wOpen ? 0.6 : 0.4).setOrigin(0));
      rows.add(pixelText(this, x + 124, y + 10, wOpen ? witch.name : `${witch.name} · locked`, { size: 8, color: wOpen ? 'W' : 'S', align: 'center' }).setOrigin(0.5, 0));
      const wNote = wOpen ? `${witch.focus}. ${witch.quirk}` : `Win ${cap(witch.unlockSeason!)} to open. ${witch.quirk}`;
      rows.add(pixelText(this, x + 124, y + 22, wNote, { size: 6, color: wOpen ? 'a' : 'S', align: 'center', wrap: 176 }).setOrigin(0.5, 0));

      const pot = pots[c]!;
      const cOpen = cauldronOpen(p, pot.id);
      rows.add(this.add.rectangle(x + 8, y + 54, 232, 46, hex(cOpen ? 'b' : 'q'), cOpen ? 0.6 : 0.4).setOrigin(0));
      rows.add(this.add.image(x + 48, y + 77, `prop/cauldron-${pot.id}`).setScale(0.5).setAlpha(cOpen ? 1 : 0.4));
      rows.add(pixelText(this, x + 72, y + 58, cOpen ? pot.name : `${pot.name} · locked`, { size: 8, color: cOpen ? 'W' : 'S' }));
      const entry = pot.unlock ? codex.almanac.get(pot.unlock)! : null;
      const cNote = cOpen ? pot.text : `Almanac: ${entry!.goal} ${pot.text}`;
      rows.add(pixelText(this, x + 72, y + 70, cNote, { size: 6, color: cOpen ? 'a' : 'S', wrap: 138 }));
    };
    const step = (row: 'w' | 'c', by: number) => {
      if (row === 'w') w = (w + by + witches.length) % witches.length;
      else c = (c + by + pots.length) % pots.length;
      const witch = witches[w]!.id;
      const pot = pots[c]!.id;
      if (save) saveProfile({ ...(witchOpen(p, witch) ? { witch } : {}), ...(cauldronOpen(p, pot) ? { cauldron: pot } : {}) });
      draw();
    };
    for (const [row, cy] of [['w', y + 28], ['c', y + 77]] as const) {
      this.add.existing(button(this, x + 20, cy, '<', () => step(row, -1), { w: 16 }));
      this.add.existing(button(this, x + 228, cy, '>', () => step(row, 1), { w: 16 }));
    }
    draw();
  }

  /**
   * The keepsake box (GDD §13): one card added to every run's starting deck, chosen from the regulars'
   * own vigil gifts once their Friendship reaches 8. Arrows step through the open ones and "empty".
   */
  private drawKeepsakes(p: Profile, save: boolean) {
    const x = 196;
    const y = 158;
    this.add.existing(panel(this, x, y, 248, 43, 'k', 0.9, 'n'));
    const open = keepsakesOpen(p.friendship);
    const choices: (string | null)[] = [null, ...open];
    let i = Math.max(0, choices.indexOf(p.keepsakes.find((k) => open.includes(k)) ?? null));
    const rows = this.add.container(0, 0);
    const draw = () => {
      rows.removeAll(true);
      const id = choices[i] ?? null;
      const card = id ? codex.ingredients.get(id) ?? codex.tinctures.get(id) : null;
      rows.add(pixelText(this, x + 124, y + 4, card ? `Keepsake box: ${card.name}` : 'Keepsake box: empty', { size: 8, color: card ? 'W' : 'S', align: 'center' }).setOrigin(0.5, 0));
      const note = card ? `${card.text} Added to every run's starting deck.`
        : open.length ? 'Choose a keepsake to add to every run\'s starting deck.'
          : `At Friendship ${FRIENDSHIP.vigilGiftLevel}, a regular's own vigil gift can go in here, to start every run in your deck.`;
      rows.add(pixelText(this, x + 124, y + 16, note, { size: 6, color: card ? 'a' : 'S', align: 'center', wrap: 188 }).setOrigin(0.5, 0));
    };
    const step = (by: number) => {
      i = (i + by + choices.length) % choices.length;
      const id = choices[i];
      if (save) saveProfile({ keepsakes: id ? [id] : [] });
      draw();
    };
    if (open.length) {
      this.add.existing(button(this, x + 20, y + 21, '<', () => step(-1), { w: 16 }));
      this.add.existing(button(this, x + 228, y + 21, '>', () => step(1), { w: 16 }));
    }
    draw();
  }

  /**
   * The wall calendar: which Year you're playing, with arrows once a later one is open (like
   * Ascension), and that Year's rules and boon.
   */
  private drawCalendar(p: Profile) {
    const x = 196;
    const y = 96;
    const boon = boonOf(p);
    const lines = [
      `Reputation ×${reputationMult(p.year)}`,
      ...yearModifiers(p.year).map((m) => m.text),
      ...(boon ? [`Boon: ${codex.boons.get(boon)!.name}. ${codex.boons.get(boon)!.text}`] : []),
      ...(p.yearSeasons.length <= 1 ? ['Win Winter to open Year 2, with a new rule and a boon.'] : []),
    ];
    const body = pixelText(this, x + 124, y + 32, lines.join('\n'), { size: 7, color: 'w', align: 'center', wrap: 228 }).setOrigin(0.5, 0);
    const h = body.height + 44;
    const bg = panel(this, x, y, 248, h, 'k', 0.9, 'n');
    this.add.existing(bg);
    this.children.bringToTop(body);
    pixelText(this, x + 124, y + 8, `Year ${p.year}`, { size: 12, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    const top = p.yearSeasons.length;
    if (top > 1) {
      const prev = button(this, x + 40, y + 15, '<', () => this.chooseYear(p.year - 1), { w: 20 });
      const next = button(this, x + 208, y + 15, '>', () => this.chooseYear(p.year + 1), { w: 20 });
      prev.setEnabled(p.year > 1);
      next.setEnabled(p.year < top);
      this.add.existing(prev);
      this.add.existing(next);
    }
  }

  /** Looping into a new Year: choose one of three boons, kept for the whole Year. */
  private openBoons(p: Profile, pick: ((id: string) => void) | null) {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(2000);
    this.overlay = c;
    this.overlayKind = 'other';
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
    this.overlayKind = null;
    this.updateNear();
  }

  /** A panel over the room with a title and a Close button. */
  private openOverlay(title: string): Phaser.GameObjects.Container {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(2000);
    this.overlay = c;
    this.overlayKind = 'other';
    c.add(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.6).setOrigin(0).setInteractive());
    c.add(panel(this, 20, 24, 600, 312, 'k', 0.96, 'n'));
    c.add(pixelText(this, 320, 32, title, { size: 12, color: 'y', align: 'center' }).setOrigin(0.5, 0));
    c.add(button(this, 320, 324, 'Close', () => this.closeOverlay(), { w: 60 }));
    return c;
  }

  /** The Almanac (GDD §13): every entry's goal and what it adds to the pools, done ones lit. */
  private openAlmanac(p: Profile, page = 0) {
    const c = this.openOverlay('The Almanac');
    const all = [...codex.almanac.values()];
    const pages = [all.slice(0, ALMANAC_FIRST_PAGE), all.slice(ALMANAC_FIRST_PAGE)];
    page = Math.max(0, Math.min(pages.length - 1, page));
    const intro = page === 0 ? 'Meet a goal in any run, won or lost, and what it adds joins the pools for good.' : 'The harder goals, for the long game.';
    c.add(pixelText(this, 320, 48, `${p.almanac.length} of ${codex.almanac.size} done. ${intro}  Page ${page + 1} of ${pages.length}`, { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0));
    const prev = button(this, 220, 38, '<', () => this.openAlmanac(p, page - 1), { w: 20 });
    const next = button(this, 420, 38, '>', () => this.openAlmanac(p, page + 1), { w: 20 });
    prev.setEnabled(page > 0);
    next.setEnabled(page < pages.length - 1);
    c.add([prev, next]);
    const entries = pages[page]!;
    const rows = Math.ceil(entries.length / 2);
    entries.forEach((e, i) => {
      const x = 30 + Math.floor(i / rows) * 292;
      const y = 64 + (i % rows) * 36;
      const done = p.almanac.includes(e.id);
      // A cauldron an entry opens is named with what it adds to the pools.
      const adds = [...e.unlocks.map(unlockName), ...[...codex.cauldrons.values()].filter((pot) => pot.unlock === e.id).map((pot) => `the ${pot.name}`)];
      c.add(this.add.rectangle(x, y, 286, 33, hex(done ? 'g' : 'b'), done ? 0.6 : 0.4).setOrigin(0));
      c.add(pixelText(this, x + 6, y + 3, done ? `${e.name} · done` : e.name, { size: 8, color: done ? 'L' : 'W' }));
      // The goals across runs say how far along they are.
      const tally = e.id === 'every-witch' ? [p.witchWins.length, codex.witches.size] : e.id === 'every-cauldron' ? [p.cauldronWins.length, codex.cauldrons.size] : null;
      const progress = tally && !done ? ` (${tally[0]} of ${tally[1]})` : '';
      c.add(pixelText(this, x + 280, y + 4, `${e.goal}${progress}`, { size: 7, color: done ? 'L' : 'a', align: 'right' }).setOrigin(1, 0));
      c.add(pixelText(this, x + 6, y + 18, `Adds ${adds.join(', ')}`, { size: 6, color: done ? 'w' : 'S', wrap: 274 }));
    });
  }

  /** The Codex (GDD §13): every card, recipe, familiar, relic and customer, a tab each, hidden until met in a run. */
  private openCodex(p: Profile, tab: CodexTable = 'ingredients', page = 0, detail?: string) {
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
      const tile = this.add.rectangle(x, y, 192, 40, hex(e.met ? 'b' : 'q'), e.met ? 0.6 : 0.4).setOrigin(0);
      c.add(tile);
      // A met entry opens its detail card, with its lore.
      if (e.met) {
        tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openCodex(p, tab, page, e.id));
        tile.on('pointerover', () => tile.setStrokeStyle(1, hex('y')));
        tile.on('pointerout', () => tile.setStrokeStyle());
      }
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
    const open = entries.find((e) => e.id === detail && e.met);
    if (open) this.drawCodexEntry(c, open, () => this.openCodex(p, tab, page));
  }

  /** A Codex entry's detail card: what it is and does, and a line of Elmbrook. */
  private drawCodexEntry(c: Phaser.GameObjects.Container, e: CodexEntry, close: () => void) {
    const W = 300;
    const x = 320 - W / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let y = 8;
    const line = (text: string, size: number, color: PaletteKey) => {
      const t = pixelText(this, x + 10, 0, text, { size, color, wrap: W - 20 });
      parts.push(t);
      return t;
    };
    const rows = [line(e.name, 12, 'y'), line(e.sub, 7, 'h'), ...(e.text ? [line(e.text, 8, 'W')] : []), ...(e.lore ? [line(e.lore, 8, 'L')] : [])];
    const gaps = [6, 8, 10];
    const h = rows.reduce((sum, t, i) => sum + t.height + (gaps[i] ?? 0), 0) + 40;
    const top = Math.round(180 - h / 2);
    rows.forEach((t, i) => {
      t.setY(top + y);
      y += t.height + (gaps[i] ?? 0);
    });
    c.add(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.5).setOrigin(0).setInteractive().on('pointerdown', close));
    c.add(panel(this, x, top, W, h, 'k', 0.98, 'y'));
    c.add(parts);
    c.add(button(this, 320, top + h - 16, 'Back', close, { w: 60 }));
  }
}

const TOP_TIER = 1 + PERK_TIERS.length;

type WalkKeys = Record<'w' | 'a' | 's' | 'd' | 'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

/** The season the house is dressed for: the newest open season of the Year you're playing. */

/** Where the cottage's windows look into the shop window's painted view (640x360): the left window here, the right one further along. And its scale. */
const VIEW_CROP = { x: 196, y: 96 };
const VIEW_SCALE = 0.5;

/** The perk board opens at the first open tier with something left to buy, else the top open tier. */
function firstTier(p: Profile): number {
  const tiers = Array.from({ length: TOP_TIER }, (_, i) => i + 1).filter((t) => perkTierOpen(p, t));
  return tiers.find((t) => [...codex.perks.values()].some((perk) => perk.tier === t && !p.perks.includes(perk.id))) ?? tiers.at(-1)!;
}
