import Phaser from 'phaser';
import { hex } from '../art/palette';
import { Pixmap } from '../art/pixmap';
import { homeSprite, litHomeSprite, squareFire, squareGround, squareLights, type SquareOptions } from '../art/scenes/market-square';
import { play } from '../audio/sfx';
import type { Season } from '../core';
import { noAnim } from '../debug/params';
import { lazyTexture, type PlaceBackdrop } from './backdrop';
import { EXIT, HOMES, openHomes, SPAWN, SQUARE_SCALE, spotAt, STALL_HOME, walk, type Home, type HomeId, type Point } from './market-square';
import { facing, type Facing } from './room';
import { pixelText } from './text';
import { button, panel } from './ui';
import type { Tooltip } from './tooltip';

// The Night Market you walk round (GDD §9): the square drawn at 2x, tonight's stalls lit and the
// rest shuttered, and you, walking with WASD as in the cottage. Walk up to a stall and press F (or
// click it) to visit; walk back onto the bridge to pay the rent and go home. Built afresh on every
// render of the Run scene; where you stand and which way you face live in `WalkState`, so a visit
// to a stall brings you back to the same spot.

/** Where you stand, which way you face, and whether the list of tonight's stalls is open. */
export type WalkState = { pos: Point; face: Facing; week: number; list: boolean };
export const newWalk = (week: number): WalkState => ({ pos: { ...SPAWN }, face: 'up', week, list: false });

export type WalkKeys = Record<'w' | 'a' | 's' | 'd' | 'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

type Stall = { id: string };
export type MarketWalkOptions = SquareOptions & {
  stalls: readonly Stall[];
  /** A stall's name, its line for the tooltip, and anything it notes tonight. */
  describe: (stall: Stall) => { name: string; lines: string[] };
  /** What the bridge says: pay the rent, or leave without it. */
  exitLabel: string;
  exitShort: boolean;
};

const Z = SQUARE_SCALE;
const optsKey = (o: SquareOptions) => `${o.season}${o.snowedIn ? '-snowed-in' : ''}`;
const homeKey = (id: HomeId, stall: string | null, open: boolean, o: SquareOptions) => `sq/${id}-${stall ?? 'none'}-${open ? 'open' : 'shut'}-${optsKey(o)}`;
/** Snowed In only counts in Winter. */
const squareOpts = (season: Season, snowedIn: boolean): SquareOptions => ({ season, snowedIn: snowedIn && season === 'winter' });

/** Which stall stands at each home tonight, open or not: the open one, else the home's usual stall. */
function occupant(home: Home, stalls: readonly Stall[], open: ReadonlyMap<HomeId, number>): string | null {
  const i = open.get(home.id);
  if (i !== undefined) return stalls[i]!.id;
  const usual = Object.entries(STALL_HOME).filter(([, h]) => h === home.id).map(([id]) => id);
  return usual.length === 1 ? usual[0]! : null;
}

/**
 * The whole square as one picture, stalls and all, for behind a stall's screen and the Snowed In
 * scene: the same textures the walk uses, composed once per season and set of open stalls.
 */
export function squareBackdrop(scene: Phaser.Scene, season: Season, snowedIn: boolean, stalls: readonly Stall[]): PlaceBackdrop {
  const o = squareOpts(season, snowedIn);
  const open = openHomes(stalls);
  const key = `sq/whole-${optsKey(o)}-${[...open.keys()].sort().join('.')}`;
  const texture = lazyTexture(scene, key, () => {
    const p = new Pixmap(320, 180).blit(squareGround(o), 0, 0);
    // Back to front, so nearer stalls overlap farther ones.
    for (const h of [...HOMES].sort((a, b) => a.solid.y + a.solid.h - (b.solid.y + b.solid.h))) p.blit(homeSprite(h.id, { ...o, open: open.has(h.id), stall: occupant(h, stalls, open) }), h.at.x, h.at.y);
    return new Pixmap(320 * Z, 180 * Z).blit(p, 0, 0, Z);
  });
  return { texture, lights: squareLights(new Set(open.keys()), o).map((l) => ({ x: l.x * Z, y: l.y * Z, scale: (l.radius * 2.2) / 128 })) };
}

export class MarketWalk {
  private readonly world: Phaser.GameObjects.Container;
  private readonly you: Phaser.GameObjects.Image;
  /** A little light about you, so you don't vanish into the dark cobbles. */
  private readonly aura: Phaser.GameObjects.Image;
  private readonly sprites = new Map<HomeId, { plain: Phaser.GameObjects.Image; lit: Phaser.GameObjects.Image }>();
  private readonly open: Map<HomeId, number>;
  private near: HomeId | 'exit' | null = null;
  private prompt: Phaser.GameObjects.Container | null = null;
  private stepClock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly opts: MarketWalkOptions,
    private readonly state: WalkState,
    private readonly on: { visit: (index: number) => void; leave: () => void; toggleList: () => void; tip: Tooltip },
  ) {
    const o = squareOpts(opts.season, opts.snowedIn);
    this.open = openHomes(opts.stalls);
    const ground = scene.add.image(0, 0, lazyTexture(scene, `sq/ground-${optsKey(o)}`, () => squareGround(o))).setOrigin(0).setScale(Z);
    this.world = scene.add.container(0, 0);
    for (const h of HOMES) {
      const isOpen = this.open.has(h.id);
      const stall = occupant(h, opts.stalls, this.open);
      const key = homeKey(h.id, stall, isOpen, o);
      const plainKey = lazyTexture(scene, key, () => homeSprite(h.id, { ...o, open: isOpen, stall }));
      const depth = h.solid.y + h.solid.h;
      const plain = scene.add.image(h.at.x * Z, h.at.y * Z, plainKey).setOrigin(0).setScale(Z).setDepth(depth);
      const lit = scene.add.image((h.at.x - 1) * Z, (h.at.y - 1) * Z, lazyTexture(scene, `${key}-lit`, () => litHomeSprite(homeSprite(h.id, { ...o, open: isOpen, stall })))).setOrigin(0).setScale(Z).setDepth(depth - 0.5).setVisible(false);
      this.world.add([lit, plain]);
      this.sprites.set(h.id, { plain, lit });
      this.hover(h, plain, isOpen, stall);
      if (h.kind === 'fire' && isOpen) this.flames(h, depth + 0.1);
    }
    this.you = scene.add.image(0, 0, 'wizard/up-0').setOrigin(0.5, 1).setScale(Z);
    this.world.add(this.you);
    this.aura = scene.add.image(0, 0, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0.28).setTint(hex('a'));
    const glows = squareLights(new Set(this.open.keys()), o).map((l) => {
      const glow = scene.add.image(l.x * Z, l.y * Z, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale((l.radius * 2.2) / 128).setAlpha(0.4).setTint(hex(l.color));
      if (!noAnim) scene.tweens.add({ targets: glow, alpha: 0.3, scale: glow.scale * 0.94, duration: 600 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return glow;
    });
    // The bridge home: click it, or walk onto it.
    const bridge = scene.add.zone(EXIT.x * Z, EXIT.y * Z, EXIT.w * Z, EXIT.h * Z).setOrigin(0).setInteractive({ useHandCursor: true });
    bridge.on('pointerdown', () => on.leave());
    bridge.on('pointerover', () => on.tip.text('The bridge home', [opts.exitLabel], (EXIT.x + EXIT.w / 2) * Z, EXIT.y * Z - 4));
    bridge.on('pointerout', () => on.tip.hide());
    const hint = pixelText(scene, 8, 350, 'WASD to walk · F or Space at a stall · or click one', { size: 7, color: 'a', stroke: 'k' }).setOrigin(0, 1);
    const list = button(scene, 60, 330, "Tonight's stalls (Tab)", on.toggleList, { w: 104 });
    [ground, this.world, this.aura, ...glows, bridge, hint, list].forEach((g, i) => layer.addAt(g, i));
    this.place(0);
    this.updateNear(false);
    if (state.list) this.drawList();
  }

  /**
   * Tonight's stalls in one list, for when you'd rather not walk (Jacob, Oct 19): what each trades,
   * and a click to visit it. What's in stock you still see at the stall.
   */
  private drawList() {
    const sc = this.scene;
    const n = this.opts.stalls.length;
    const rowH = 30;
    const h = 30 + n * rowH + 26;
    const y0 = Math.max(44, 196 - h / 2);
    const items: Phaser.GameObjects.GameObject[] = [
      sc.add.rectangle(0, 0, 640, 360, hex('K'), 0.55).setOrigin(0).setInteractive(),
      panel(sc, 110, y0, 420, h, 'k', 0.96, 'n'),
      pixelText(sc, 320, y0 + 8, "Tonight's stalls", { size: 12, color: 'y', align: 'center' }).setOrigin(0.5, 0),
    ];
    this.opts.stalls.forEach((st, i) => {
      const d = this.opts.describe(st);
      const y = y0 + 30 + i * rowH;
      const row = panel(sc, 118, y, 404, rowH - 4, 'q', 0.9, 'h').setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setStrokeStyle(2, hex('y')));
      row.on('pointerout', () => row.setStrokeStyle(1, hex('h')));
      row.on('pointerdown', () => this.on.visit(i));
      const [currency, text, note] = d.lines;
      items.push(
        row,
        pixelText(sc, 126, y + 3, d.name, { size: 8, color: 'y' }),
        pixelText(sc, 514, y + 4, `${currency ?? ''}${note ? ` · ${note}` : ''}`, { size: 6, color: 'a', align: 'right' }).setOrigin(1, 0),
        pixelText(sc, 126, y + 14, text ?? '', { size: 6, color: 'w', wrap: 390 }),
      );
    });
    items.push(button(sc, 320, y0 + h - 14, 'Close (Tab)', this.on.toggleList, { w: 72 }));
    this.layer.add(items);
  }

  /** Hover a stall for what it sells; click an open one to visit. */
  private hover(h: Home, img: Phaser.GameObjects.Image, isOpen: boolean, stall: string | null) {
    const index = this.open.get(h.id);
    if (!isOpen && h.kind !== 'stall') return;
    img.setInteractive({ useHandCursor: isOpen, pixelPerfect: false });
    const x = (h.at.x + h.size.w / 2) * Z;
    img.on('pointerover', () => {
      if (index !== undefined) {
        const d = this.opts.describe(this.opts.stalls[index]!);
        this.on.tip.text(d.name, d.lines, x, h.at.y * Z - 4, (h.at.y + h.size.h) * Z + 4);
      } else {
        const name = stall ? this.opts.describe({ id: stall }).name : 'A stall';
        this.on.tip.text(name, ['Shuttered tonight.'], x, h.at.y * Z - 4, (h.at.y + h.size.h) * Z + 4);
      }
    });
    img.on('pointerout', () => this.on.tip.hide());
    if (index !== undefined) img.on('pointerdown', () => this.on.visit(index));
  }

  private flames(h: Home, depth: number) {
    const s = this.scene;
    for (const f of [0, 1, 2] as const) lazyTexture(s, `sq/fire-${f}`, () => squareFire(f));
    const fire = s.add.image((h.at.x + 12) * Z, (h.at.y + 5) * Z, 'sq/fire-0').setOrigin(0).setScale(Z).setDepth(depth);
    this.world.add(fire);
    if (noAnim) return;
    let f = 0;
    s.time.addEvent({ delay: 130, loop: true, callback: () => fire.active && fire.setTexture(`sq/fire-${(f = (f + 1 + Math.floor(Math.random() * 2)) % 3)}`) });
  }

  /** A frame of walking. Returns false once the scene has thrown this square away. */
  update(delta: number, keys: WalkKeys): boolean {
    if (!this.you.active) return false;
    if (this.state.list) return true;
    const dx = (keys.d.isDown || keys.right.isDown ? 1 : 0) - (keys.a.isDown || keys.left.isDown ? 1 : 0);
    const dy = (keys.s.isDown || keys.down.isDown ? 1 : 0) - (keys.w.isDown || keys.up.isDown ? 1 : 0);
    const from = this.state.pos;
    this.state.pos = walk(from, dx, dy, Math.min(delta, 50) / 1000);
    this.state.face = facing(dx, dy, this.state.face);
    if (this.state.pos.x !== from.x || this.state.pos.y !== from.y) {
      const before = Math.floor(this.stepClock / 160);
      this.stepClock += delta;
      const step = Math.floor(this.stepClock / 160);
      if (step !== before) play('step', { pitch: step % 2 ? 1.12 : 0.94, volume: this.opts.snowedIn || this.opts.season === 'winter' ? 0.6 : 0.9 });
      this.place(step % 2 === 1 ? 1 : 0);
    } else {
      this.stepClock = 0;
      this.place(0);
    }
    this.updateNear(true);
    return true;
  }

  /** F or Space: visit the stall you're standing by, or take the bridge home. */
  use(): boolean {
    if (this.state.list) return false;
    if (this.near === 'exit') this.on.leave();
    else if (this.near) this.on.visit(this.open.get(this.near)!);
    else return false;
    return true;
  }

  private place(frame: 0 | 1) {
    this.you.setTexture(`wizard/${this.state.face}-${frame}`);
    this.you.setPosition(Math.round(this.state.pos.x * Z), Math.round(this.state.pos.y * Z) + 2).setDepth(this.state.pos.y);
    this.aura.setPosition(this.you.x, this.you.y - 10 * Z);
    this.world.sort('depth');
  }

  /** Lights up the stall you're standing by, with a prompt saying what F does there. */
  private updateNear(walked: boolean) {
    const spot = spotAt(this.state.pos, this.open);
    if (spot === this.near) return;
    if (this.near && this.near !== 'exit') {
      const old = this.sprites.get(this.near)!;
      this.scene.tweens.killTweensOf(old.lit);
      old.lit.setVisible(false).setAlpha(1);
    }
    this.prompt?.destroy();
    this.prompt = null;
    this.near = spot;
    if (!spot) return;
    if (walked) play('near');
    let label: string;
    let mid: number;
    let top: number;
    if (spot === 'exit') {
      label = this.opts.exitLabel;
      mid = (EXIT.x + EXIT.w / 2) * Z;
      top = this.you.y - this.you.displayHeight - 14;
    } else {
      const home = HOMES.find((h) => h.id === spot)!;
      const s = this.sprites.get(spot)!;
      s.lit.setVisible(true);
      if (!noAnim) this.scene.tweens.add({ targets: s.lit, alpha: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      label = `Visit ${this.opts.describe(this.opts.stalls[this.open.get(spot)!]!).name.replace(/^The /, 'the ')}`;
      mid = (home.at.x + home.size.w / 2) * Z;
      top = Math.min(home.at.y * Z, this.you.y - this.you.displayHeight) - 14;
    }
    const sc = this.scene;
    const text = pixelText(sc, 0, 0, label, { size: 8, color: spot === 'exit' && this.opts.exitShort ? 'I' : 'W' }).setOrigin(0, 0.5);
    const cap = sc.add.rectangle(0, 0, 13, 13, hex('y')).setStrokeStyle(1, hex('k'));
    const f = pixelText(sc, 0, 0, 'F', { size: 8, color: 'k', align: 'center' }).setOrigin(0.5);
    const w = 13 + 6 + text.width + 12;
    const bg = sc.add.rectangle(0, 0, w, 19, hex('k'), 0.88).setStrokeStyle(1, hex('n'));
    cap.setX(-w / 2 + 12);
    f.setX(cap.x);
    text.setX(cap.x + 11);
    // Under your feet if over the thing would run into the HUD.
    const below = top < 48;
    const cx = Math.max(w / 2 + 4, Math.min(640 - w / 2 - 4, below ? this.you.x : mid));
    const cy = below ? this.you.y + 14 : top;
    this.prompt = sc.add.container(cx, cy, [bg, cap, f, text]);
    this.layer.add(this.prompt);
  }
}
