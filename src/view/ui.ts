import type Phaser from 'phaser';
import { hex, type PaletteKey } from '../art/palette';
import { pixelText } from './text';

// Small UI building blocks: parchment panels and buttons, palette-locked.

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: PaletteKey = 'k', alpha = 0.88, border: PaletteKey = 'h') {
  const r = scene.add.rectangle(x, y, w, h, hex(fill), alpha).setOrigin(0);
  r.setStrokeStyle(1, hex(border));
  return r;
}

export type Button = Phaser.GameObjects.Container & { setEnabled(on: boolean): Button };

/** A label on a wooden plank. Disabled buttons fade and ignore clicks. */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: { w?: number; color?: PaletteKey; enabled?: boolean } = {}): Button {
  const w = opts.w ?? Math.max(48, label.length * 6 + 16);
  const h = 16;
  const bg = scene.add.rectangle(0, 0, w, h, hex('b')).setStrokeStyle(1, hex('n'));
  const text = pixelText(scene, 0, 0, label, { size: 8, color: opts.color ?? 'W', align: 'center' }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, text]) as Button;
  c.setSize(w, h);
  let enabled = opts.enabled ?? true;
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => enabled && bg.setFillStyle(hex('B')));
  c.on('pointerout', () => bg.setFillStyle(hex('b')));
  c.on('pointerdown', () => enabled && onClick());
  c.setEnabled = (on: boolean) => {
    enabled = on;
    c.setAlpha(on ? 1 : 0.4);
    return c;
  };
  c.setEnabled(enabled);
  return c;
}
