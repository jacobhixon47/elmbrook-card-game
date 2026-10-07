import Phaser from 'phaser';
import { hex } from '../art/palette';
import { skyTime, type RunState, type Season, type SkyTime } from '../core';
import { markReady } from '../debug/hook';
import { noAnim, params, type Fixture } from '../debug/params';
import { store } from '../store';
import { gradedView, shopBackdrop, viewOverrides } from '../view/backdrop';
import { addWeather } from '../view/weather';
import { pixelCamera } from '../view/camera';
import { createCard } from '../view/card';
import { pixelText } from '../view/text';

const HAND_Y = 304;

/** M0 proof that core → view works: a seeded run's opening hand, laid out on the shop counter. */
export class Hand extends Phaser.Scene {
  constructor() {
    super('Hand');
  }

  create(data: { fixture?: Fixture | null }) {
    pixelCamera(this);
    const fixture = data.fixture;
    if (fixture?.state) {
      store.load(fixture.state as RunState);
    } else {
      const seed = fixture?.seed ?? params.get('seed') ?? `run-${Math.floor(Math.random() * 1e9)}`;
      const season = (fixture?.season as Season | undefined) ?? viewOverrides().season;
      store.dispatch({ type: 'startRun', seed, witch: 'hedge-witch', ...(season ? { season } : {}) });
      store.dispatch({ type: 'drawToHandSize' });
    }
    const state = store.getState()!;

    const bg = shopBackdrop();
    const COUNTER_TOP = bg.counterTop;
    if (bg.view && bg.window) {
      // The view through the window changes with the season and time of day; the room is painted over it.
      const season = viewOverrides().season ?? state.season;
      const time = (fixture?.time as SkyTime | undefined) ?? viewOverrides().time ?? skyTime(state);
      this.add.image(0, 0, gradedView(this, bg.view, 'shop', season, time)).setOrigin(0);
      addWeather(this, bg.window, season, time);
    }
    this.add.image(0, 0, bg.texture).setOrigin(0);
    for (const l of bg.lights) {
      const glow = this.add.image(l.x, l.y, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(l.scale).setAlpha(0.55);
      if (!noAnim) this.tweens.add({ targets: glow, alpha: 0.42, scale: l.scale * 0.95, duration: 900 + l.x, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // HUD on the dark heartwood corners.
    pixelText(this, 10, 8, `Week ${state.week} · Day ${state.day}`, { size: 12, color: 'a', shadow: true });
    pixelText(this, 10, 24, `seed ${state.seed}`, { size: 7, color: 'h', shadow: true });
    pixelText(this, 630, 8, `${state.gold} gold`, { size: 12, color: 'y', align: 'right', shadow: true }).setOrigin(1, 0);

    // Cauldron on the counter, centred under the window.
    this.add.image(320, COUNTER_TOP - 27, 'prop/cauldron');
    const steam = this.add.image(320, COUNTER_TOP - 45, 'fx/glow').setTint(hex('v')).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.35);
    if (!noAnim) this.tweens.add({ targets: steam, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1 });

    // Draw pile: a small stack of card backs at the left end of the counter.
    for (let i = 0; i < 3; i++) this.add.image(34 + i, HAND_Y - i, 'card/back');
    pixelText(this, 36, HAND_Y + 42, `Draw ${state.drawPile.length}`, { size: 8, color: 'a', align: 'center', shadow: true }).setOrigin(0.5, 0);

    const n = state.hand.length;
    const spacing = Math.min(62, 520 / Math.max(n, 1));
    state.hand.forEach((inst, i) => {
      const x = 340 + (i - (n - 1) / 2) * spacing;
      const card = createCard(this, x, HAND_Y, inst.card);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => this.tweens.add({ targets: card, y: HAND_Y - 12, duration: 90 }));
      card.on('pointerout', () => this.tweens.add({ targets: card, y: HAND_Y, duration: 90 }));
      if (!noAnim) {
        card.y = 420;
        this.tweens.add({ targets: card, y: HAND_Y, duration: 260, delay: i * 70, ease: 'Back.easeOut' });
      }
    });

    this.time.delayedCall(noAnim ? 0 : n * 70 + 300, () => markReady(this));
  }
}
