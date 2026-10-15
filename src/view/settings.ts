import Phaser from 'phaser';
import { hex } from '../art/palette';
import { setSound, soundSettings } from '../audio/sfx';
import { loadProfile, saveProfile } from '../profile';
import { button, panel } from './ui';
import { pixelText } from './text';

const BARS = 10;

/**
 * The Settings panel, over whatever scene opened it: the volume (a stepped slider: click or drag
 * along the bars), sound on or off, and whether each run opens with its season's scene screen.
 * Returns the container; `onClose` runs after it is destroyed.
 */
export function openSettings(scene: Phaser.Scene, onClose: () => void = () => undefined): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(1000);
  // Swallows clicks meant for the screen underneath.
  c.add(scene.add.rectangle(0, 0, 640, 360, hex('k'), 0.5).setOrigin(0).setInteractive());
  c.add(panel(scene, 200, 96, 240, 168, 'k', 0.95, 'c'));
  c.add(pixelText(scene, 320, 106, 'Settings', { size: 14, color: 'c', align: 'center' }).setOrigin(0.5, 0));
  const label = (y: number, str: string) => c.add(pixelText(scene, 216, y, str, { size: 8, color: 'W' }).setOrigin(0, 0.5));

  label(142, 'Volume');
  const bars: Phaser.GameObjects.Rectangle[] = [];
  const pct = pixelText(scene, 424, 142, '', { size: 8, color: 'y' }).setOrigin(1, 0.5);
  c.add(pct);
  const show = () => {
    const { volume, muted } = soundSettings();
    const lit = Math.round(volume * BARS);
    bars.forEach((b, i) => b.setFillStyle(hex(i < lit ? (muted ? 'a' : 'y') : 'n')));
    pct.setText(muted ? 'off' : `${Math.round(volume * 100)}%`);
    (soundButton.list[1] as Phaser.GameObjects.Text).setText(muted ? 'Off' : 'On');
  };
  const pick = (i: number) => {
    setSound({ volume: (i + 1) / BARS, muted: false });
    show();
  };
  for (let i = 0; i < BARS; i++) {
    const h = 4 + i;
    const bar = scene.add.rectangle(276 + i * 11, 147 - h, 8, h, hex('b')).setOrigin(0);
    // A wider hit area than the bar, so dragging along the row never falls between bars.
    bar.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-1, h - 14, 11, 16), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    bar.on('pointerdown', () => pick(i));
    bar.on('pointerover', (p: Phaser.Input.Pointer) => p.isDown && pick(i));
    bars.push(bar);
    c.add(bar);
  }

  label(170, 'Sound');
  const soundButton = button(scene, 392, 170, '', () => {
    setSound({ muted: !soundSettings().muted });
    show();
  }, { w: 64 });
  c.add(soundButton);
  c.add(pixelText(scene, 216, 180, 'M mutes anywhere', { size: 6, color: 'a' }));

  label(200, 'Season openings');
  const openings = button(scene, 392, 200, '', () => {
    const on = !loadProfile().seasonOpenings;
    saveProfile({ seasonOpenings: on });
    (openings.list[1] as Phaser.GameObjects.Text).setText(on ? 'Shown' : 'Hidden');
  }, { w: 64 });
  (openings.list[1] as Phaser.GameObjects.Text).setText(loadProfile().seasonOpenings ? 'Shown' : 'Hidden');
  c.add(openings);
  c.add(pixelText(scene, 216, 210, 'The scene at the start of each run', { size: 6, color: 'a' }));

  const close = () => {
    scene.input.keyboard?.off('keydown-ESC', close);
    c.destroy();
    // Next frame too: Phaser sends 'keydown-ESC' before 'keydown', and the scene's own Esc must still see Settings open.
    scene.time.delayedCall(0, onClose);
  };
  c.add(button(scene, 320, 244, 'Done', close, { w: 64, color: 'Y' }));
  // Next frame, so the Esc that opened it doesn't close it too.
  scene.time.delayedCall(0, () => c.active && scene.input.keyboard?.once('keydown-ESC', close));
  show();
  return c;
}
