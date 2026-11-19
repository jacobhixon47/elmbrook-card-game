// The activity log on screen (GDD §15.1): new lines pop up at the middle left and fade once things
// go quiet, and the Log panel lists the whole run's history. Lines are measured on a canvas first, so
// the panel only makes text objects for the rows it shows.

import Phaser from 'phaser';
import { hex } from '../art/palette';
import { type LogEntry, type LogLine } from './activity';
import { FONT_BODY, noLigatures, pixelText } from './text';
import { button, panel } from './ui';
import { ZOOM } from './zoom';

/** One row of a wrapped line: pieces of one colour each, at x, `w` wide without trailing space. */
type Row = { text: string; color: LogLine[number]['color']; x: number; w: number }[];

let measurer: CanvasRenderingContext2D | null = null;

/** A line broken into rows no wider than `width`, each a run of coloured pieces. */
export function wrapLine(line: LogLine, width: number, size: number): Row[] {
  measurer ??= document.createElement('canvas').getContext('2d')!;
  measurer.font = `${size * ZOOM}px ${FONT_BODY}`;
  const measure = (s: string) => measurer!.measureText(noLigatures(s)).width / ZOOM;
  const rows: Row[] = [[]];
  let x = 0;
  for (const span of line) {
    for (let word of span.text.match(/\S+\s*|\s+/g) ?? []) {
      const w = measure(word.trimEnd());
      if (x > 0 && x + w > width) {
        rows.push([]);
        x = 0;
        word = word.trimStart();
        if (!word) continue;
      }
      const row = rows[rows.length - 1]!;
      const last = row[row.length - 1];
      // Words of one colour on one row go in one piece.
      if (last && last.color === span.color) {
        last.text += word;
        last.w = x + w - last.x;
      } else row.push({ text: word, color: span.color, x, w });
      x += measure(word);
    }
  }
  return rows;
}

const draw = (scene: Phaser.Scene, rows: Row[], x: number, y: number, size: number, lineH: number) =>
  rows.flatMap((row, i) => row.map((p) => pixelText(scene, Math.round(x + p.x), y + i * lineH, p.text, { size, color: p.color, shadow: true })));

// ---------------------------------------------------------------- the pop-ups

/** How long the pop-ups stay after the last new line, and how long they take to fade. */
export const FEED_HOLD = 5000;
const FEED_FADE = 700;
const FEED_MAX = 5;
const FEED_SIZE = 7;
const FEED_LINE_H = 9;

/** Lines still showing, kept across a scene restart (the sky changing as a day ends). */
let showing: { entries: LogEntry[]; until: number } = { entries: [], until: 0 };

export class ActivityFeed {
  readonly box: Phaser.GameObjects.Container;
  private fade: Phaser.Time.TimerEvent | null = null;

  /** `bottom` is where the newest line ends; `top()` how high the stack may reach just now. */
  constructor(private scene: Phaser.Scene, private x: number, private bottom: number, private width: number, private top: () => number, private still: boolean) {
    this.box = scene.add.container(0, 0);
    if (showing.entries.length && (still || performance.now() < showing.until)) this.redraw(Math.max(0, showing.until - performance.now()));
  }

  push(entries: readonly LogEntry[]) {
    if (!entries.length) return;
    showing = { entries: [...showing.entries, ...entries].slice(-FEED_MAX), until: performance.now() + FEED_HOLD };
    this.redraw(FEED_HOLD);
  }

  clear() {
    showing = { entries: [], until: 0 };
    this.redraw(0);
  }

  /** Lay the stack out again, newest at the bottom, dropping the oldest that don't fit. */
  layout() {
    this.box.removeAll(true);
    const pad = 3;
    let y = this.bottom;
    const top = this.top();
    for (const [i, e] of [...showing.entries].reverse().entries()) {
      const rows = wrapLine(e.line, this.width - pad * 2, FEED_SIZE);
      const h = rows.length * FEED_LINE_H + pad;
      if (i > 0 && y - h < top) break;
      y -= h;
      const widest = Math.max(...rows.map((r) => r.reduce((w, p) => Math.max(w, p.x + p.w), 0)));
      const back = this.scene.add.rectangle(this.x, y, Math.min(this.width, widest + pad * 2 + 2), h, hex('K'), 0.62).setOrigin(0);
      this.box.add([back, ...draw(this.scene, rows, this.x + pad, y + 1, FEED_SIZE, FEED_LINE_H)]);
      y -= 2;
    }
  }

  private redraw(hold: number) {
    this.fade?.remove();
    this.scene.tweens.killTweensOf(this.box);
    this.box.setAlpha(1);
    this.layout();
    if (this.still || !showing.entries.length) return;
    this.fade = this.scene.time.delayedCall(hold, () => {
      this.scene.tweens.add({
        targets: this.box, alpha: 0, duration: FEED_FADE, onComplete: () => {
          showing = { entries: [], until: 0 };
          this.box.removeAll(true);
        },
      });
    });
  }
}

// ---------------------------------------------------------------- the whole log

const LOG = { x: 150, y: 40, w: 340, h: 280 };
const LOG_SIZE = 8;
const LOG_LINE_H = 10;

type LogRow = { kind: 'when'; text: string } | { kind: 'line'; rows: Row[] };

/** The log as rows, a day's heading before its lines. */
function logRows(entries: readonly LogEntry[], width: number): LogRow[] {
  const out: LogRow[] = [];
  let when = '';
  for (const e of entries) {
    if (e.when !== when) out.push({ kind: 'when', text: (when = e.when) });
    out.push({ kind: 'line', rows: wrapLine(e.line, width, LOG_SIZE) });
  }
  return out;
}

const rowH = (r: LogRow) => (r.kind === 'when' ? 14 : r.rows.length * LOG_LINE_H + 2);

/**
 * The Log panel: the run's lines, newest at the bottom, scrolled up by `scroll` rows. Returns the
 * objects to add and how far it can scroll.
 */
export function drawLog(scene: Phaser.Scene, entries: readonly LogEntry[], scroll: number, on: { close: () => void; scroll: (by: number) => void }) {
  const inner = LOG.w - 24;
  const rows = logRows(entries, inner);
  const top = LOG.y + 26;
  const bottom = LOG.y + LOG.h - 30;
  const max = Math.max(0, rows.length - 1);
  const from = rows.length - Math.min(scroll, max);
  // Fill upward from the newest shown row until the space runs out.
  const shown: LogRow[] = [];
  let h = 0;
  for (let i = from - 1; i >= 0; i--) {
    const rh = rowH(rows[i]!);
    if (h + rh > bottom - top) break;
    shown.unshift(rows[i]!);
    h += rh;
  }
  const objs: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, 640, 360, hex('k'), 0.55).setOrigin(0).setInteractive(),
    panel(scene, LOG.x, LOG.y, LOG.w, LOG.h, 'k', 0.96, 'n'),
    pixelText(scene, LOG.x + LOG.w / 2, LOG.y + 8, 'Log', { size: 12, color: 'y', font: 'display' }).setOrigin(0.5, 0),
  ];
  let y = top + (bottom - top - h);
  if (!entries.length) objs.push(pixelText(scene, LOG.x + LOG.w / 2, LOG.y + LOG.h / 2 - 10, 'Nothing yet. Cards, gold and friends will be noted here.', { size: 8, color: 'a', align: 'center', wrap: inner }).setOrigin(0.5));
  for (const r of shown) {
    if (r.kind === 'when') {
      objs.push(pixelText(scene, LOG.x + 12, y + 3, r.text, { size: 7, color: 'h' }));
      objs.push(scene.add.rectangle(LOG.x + 12, y + 12, inner, 1, hex('J')).setOrigin(0));
    } else {
      objs.push(...draw(scene, r.rows, LOG.x + 12, y, LOG_SIZE, LOG_LINE_H));
    }
    y += rowH(r);
  }
  const hidden = from - shown.length;
  if (hidden > 0) objs.push(pixelText(scene, LOG.x + LOG.w - 12, LOG.y + 12, 'Scroll up for more', { size: 7, color: 'a' }).setOrigin(1, 0));
  // The wheel scrolls; the panel takes it so the shop underneath doesn't.
  const wheel = scene.add.zone(LOG.x, LOG.y, LOG.w, LOG.h).setOrigin(0).setInteractive();
  wheel.on('wheel', (_p: unknown, _dx: number, dy: number) => on.scroll(dy < 0 ? 3 : -3));
  objs.push(wheel);
  const btnY = LOG.y + LOG.h - 15;
  objs.push(button(scene, LOG.x + LOG.w / 2 - 66, btnY, 'Older', () => on.scroll(6), { w: 52, enabled: hidden > 0 }));
  objs.push(button(scene, LOG.x + LOG.w / 2, btnY, 'Close (L)', () => on.close(), { w: 64 }));
  objs.push(button(scene, LOG.x + LOG.w / 2 + 66, btnY, 'Newer', () => on.scroll(-6), { w: 52, enabled: scroll > 0 }));
  return { objs, max };
}
