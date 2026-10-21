import Phaser from 'phaser';
import { hex } from '../art/palette';
import { setSound, soundSettings } from '../audio/sfx';
import { loadProfile, saveProfile } from '../profile';
import { isFullscreen, scaleChoices, setFullscreen, setScale } from './display';
import { fitZoom } from './zoom';
import { button, panel } from './ui';
import { pixelText } from './text';

const BARS = 10;

/**
 * The Settings panel, over whatever scene opened it: the sound effects' and the music's volumes
 * (stepped sliders: click or drag along the bars), sound on or off, whether each run opens with its season's scene screen,
 * first-time notes, fullscreen, and the game's scale.
 * Returns the container; `onClose` runs after it is destroyed.
 */
/**
 * `onTitle`, when given, adds a button back to the title screen (from the cottage, where Esc opens Settings).
 * `onAbandon`, when given, adds Abandon run (in a run), which asks first: nothing from an abandoned run is kept. `asking` opens that question at once (a fixture).
 */
export function openSettings(scene: Phaser.Scene, onClose: () => void = () => undefined, onTitle?: () => void, onAbandon?: () => void, asking = false): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(1000);
  // Swallows clicks meant for the screen underneath.
  c.add(scene.add.rectangle(0, 0, 640, 360, hex('k'), 0.5).setOrigin(0).setInteractive());
  c.add(panel(scene, 200, 40, 240, 266, 'k', 0.95, 'c'));
  c.add(pixelText(scene, 320, 48, 'Settings', { size: 14, color: 'c', align: 'center' }).setOrigin(0.5, 0));
  const label = (y: number, str: string) => c.add(pixelText(scene, 216, y, str, { size: 8, color: 'W' }).setOrigin(0, 0.5));

  // Two stepped sliders: the sound effects and the music. Click or drag along the bars.
  const sliders: (() => void)[] = [];
  const slider = (y: number, name: string, key: 'volume' | 'music') => {
    label(y, name);
    const bars: Phaser.GameObjects.Rectangle[] = [];
    const pct = pixelText(scene, 424, y, '', { size: 8, color: 'y' }).setOrigin(1, 0.5);
    c.add(pct);
    const pick = (i: number) => {
      setSound({ [key]: (i + 1) / BARS, muted: false });
      show();
    };
    for (let i = 0; i < BARS; i++) {
      const h = 4 + i;
      const bar = scene.add.rectangle(276 + i * 11, y + 5 - h, 8, h, hex('b')).setOrigin(0);
      // A wider hit area than the bar, so dragging along the row never falls between bars.
      bar.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-1, h - 14, 11, 16), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
      bar.on('pointerdown', () => pick(i));
      bar.on('pointerover', (p: Phaser.Input.Pointer) => p.isDown && pick(i));
      bars.push(bar);
      c.add(bar);
    }
    sliders.push(() => {
      const sound = soundSettings();
      const lit = Math.round(sound[key] * BARS);
      bars.forEach((b, i) => b.setFillStyle(hex(i < lit ? (sound.muted ? 'a' : 'y') : 'n')));
      pct.setText(sound.muted ? 'off' : `${Math.round(sound[key] * 100)}%`);
    });
  };
  const show = () => {
    sliders.forEach((f) => f());
    (soundButton.list[1] as Phaser.GameObjects.Text).setText(soundSettings().muted ? 'Off' : 'On');
  };
  slider(84, 'Sounds', 'volume');
  slider(104, 'Music', 'music');

  label(128, 'Sound');
  const soundButton = button(scene, 392, 128, '', () => {
    setSound({ muted: !soundSettings().muted });
    show();
  }, { w: 64 });
  c.add(soundButton);
  c.add(pixelText(scene, 216, 138, 'M mutes anywhere', { size: 6, color: 'a' }));

  label(156, 'Season openings');
  const openings = button(scene, 392, 156, '', () => {
    const on = !loadProfile().seasonOpenings;
    saveProfile({ seasonOpenings: on });
    (openings.list[1] as Phaser.GameObjects.Text).setText(on ? 'Shown' : 'Hidden');
  }, { w: 64 });
  (openings.list[1] as Phaser.GameObjects.Text).setText(loadProfile().seasonOpenings ? 'Shown' : 'Hidden');
  c.add(openings);
  c.add(pixelText(scene, 216, 166, 'The scene at the start of each run', { size: 6, color: 'a' }));

  label(184, 'First-time notes');
  const notes = button(scene, 392, 184, '', () => {
    const on = !loadProfile().notes;
    saveProfile({ notes: on });
    (notes.list[1] as Phaser.GameObjects.Text).setText(on ? 'Shown' : 'Hidden');
  }, { w: 64 });
  (notes.list[1] as Phaser.GameObjects.Text).setText(loadProfile().notes ? 'Shown' : 'Hidden');
  c.add(notes);
  c.add(pixelText(scene, 216, 194, 'A short note when you meet something new', { size: 6, color: 'a' }));

  label(212, 'Fullscreen');
  const full = button(scene, 392, 212, isFullscreen() ? 'On' : 'Off', () => {
    const on = !isFullscreen();
    void setFullscreen(on);
    (full.list[1] as Phaser.GameObjects.Text).setText(on ? 'On' : 'Off');
  }, { w: 64 });
  c.add(full);
  c.add(pixelText(scene, 216, 222, 'Alt+Enter anywhere', { size: 6, color: 'a' }));

  // Whole-number scales only, so pixels stay square; Auto is the largest that fits the window.
  label(240, 'Scale');
  const scaleName = (s: number) => (s === 0 ? `Auto (${fitZoom()}x)` : `${s}x`);
  const scales = scaleChoices();
  let chosen = scales.includes(loadProfile().display.scale) ? loadProfile().display.scale : 0;
  const scaleButton = button(scene, 392, 240, scaleName(chosen), () => {
    chosen = scales[(scales.indexOf(chosen) + 1) % scales.length]!;
    (scaleButton.list[1] as Phaser.GameObjects.Text).setText(scaleName(chosen));
    // Reloads when the drawn scale changes (Auto at the size that already fits doesn't).
    setScale(chosen);
  }, { w: 64 });
  c.add(scaleButton);
  c.add(pixelText(scene, 216, 250, 'Redraws the game; your run is kept', { size: 6, color: 'a' }));

  const close = () => {
    scene.input.keyboard?.off('keydown-ESC', close);
    c.destroy();
    // Next frame too: Phaser sends 'keydown-ESC' before 'keydown', and the scene's own Esc must still see Settings open.
    scene.time.delayedCall(0, onClose);
  };
  if (onTitle) {
    c.add(button(scene, 280, 284, 'Title screen', onTitle, { w: 72 }));
    c.add(button(scene, 364, 284, 'Done', close, { w: 64, color: 'Y' }));
  } else if (onAbandon) {
    c.add(button(scene, 280, 284, 'Abandon run', () => confirmAbandon(scene, c, onAbandon), { w: 72, color: 'I' }));
    c.add(button(scene, 364, 284, 'Done', close, { w: 64, color: 'Y' }));
    if (asking) confirmAbandon(scene, c, onAbandon);
  } else {
    c.add(button(scene, 320, 284, 'Done', close, { w: 64, color: 'Y' }));
  }
  // Next frame, so the Esc that opened it doesn't close it too.
  scene.time.delayedCall(0, () => c.active && scene.input.keyboard?.once('keydown-ESC', close));
  show();
  return c;
}

export const ABANDON_TEXT = 'Abandon this run and go home? Nothing from it is kept: no Friendship, Reputation, Almanac goals, unlocks or Codex finds.';

/** Asks before abandoning the run, over the Settings panel. */
function confirmAbandon(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, onAbandon: () => void) {
  const c = scene.add.container(0, 0);
  parent.add(c);
  c.add(scene.add.rectangle(200, 40, 240, 266, hex('k'), 0.6).setOrigin(0).setInteractive());
  c.add(panel(scene, 216, 128, 208, 76, 'k', 0.98, 'I'));
  c.add(pixelText(scene, 320, 138, ABANDON_TEXT, { size: 8, color: 'W', align: 'center', wrap: 188 }).setOrigin(0.5, 0));
  c.add(button(scene, 276, 186, 'Abandon', onAbandon, { w: 64, color: 'I' }));
  c.add(button(scene, 364, 186, 'Keep playing', () => c.destroy(), { w: 80, color: 'Y' }));
}
