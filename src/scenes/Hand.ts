import Phaser from 'phaser';
import type { RunState } from '../core';
import { markReady } from '../debug/hook';
import { noAnim, params, type Fixture } from '../debug/params';
import { store } from '../store';
import { createCard } from '../view/card';
import { pixelText } from '../view/text';

/** M0 proof that core → view works: start a seeded run and lay out the opening hand. */
export class Hand extends Phaser.Scene {
  constructor() {
    super('Hand');
  }

  create(data: { fixture?: Fixture | null }) {
    const fixture = data.fixture;
    if (fixture?.state) {
      store.load(fixture.state as RunState);
    } else {
      const seed = fixture?.seed ?? params.get('seed') ?? `run-${Math.floor(Math.random() * 1e9)}`;
      store.dispatch({ type: 'startRun', seed, witch: 'hedge-witch' });
      store.dispatch({ type: 'drawToHandSize' });
    }
    const state = store.getState()!;

    this.add.image(0, 0, 'bg/night').setOrigin(0).setAlpha(0.55);
    this.add.rectangle(320, 300, 640, 120, 0x1a1423, 0.85);

    pixelText(this, 8, 6, `Week ${state.week} · Day ${state.day}`, { size: 16, color: 'm', stroke: 'k' });
    pixelText(this, 632, 6, `${state.gold} gold`, { size: 16, color: 'y', stroke: 'k', align: 'right' }).setOrigin(1, 0);
    pixelText(this, 8, 26, `seed ${state.seed}`, { size: 8, color: 'v' });

    this.add.image(320, 140, 'prop/cauldron');
    pixelText(this, 320, 186, 'Draw pile: ' + state.drawPile.length, { size: 8, color: 'v', align: 'center' }).setOrigin(0.5, 0);

    const n = state.hand.length;
    const spacing = Math.min(62, 600 / Math.max(n, 1));
    state.hand.forEach((inst, i) => {
      const x = 320 + (i - (n - 1) / 2) * spacing;
      const card = createCard(this, x, 292, inst.card);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => this.tweens.add({ targets: card, y: 280, duration: 90 }));
      card.on('pointerout', () => this.tweens.add({ targets: card, y: 292, duration: 90 }));
      if (!noAnim) {
        card.y = 420;
        this.tweens.add({ targets: card, y: 292, duration: 260, delay: i * 70, ease: 'Back.easeOut' });
      }
    });

    this.time.delayedCall(noAnim ? 0 : n * 70 + 300, () => markReady(this));
  }
}
