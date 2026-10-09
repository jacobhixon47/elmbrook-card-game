import type Phaser from 'phaser';
import type { PaletteKey } from '../art/palette';
import { cardInfo, type CardExtras } from './inspect';
import { pixelText } from './text';
import { panel } from './ui';

const W = 172;
const PAD = 6;

/**
 * One floating panel per scene for hover help (GDD §15.1). It sits above everything and is
 * rebuilt on each show, so it never goes stale when the scene redraws underneath it.
 */
export class Tooltip {
  private box: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {
    this.box = scene.add.container(0, 0).setDepth(1000).setVisible(false);
  }

  /** A card's details, placed above (or below) the point given. */
  card(id: string, x: number, top: number, bottom = top, extras: CardExtras = {}) {
    const info = cardInfo(id, extras);
    const rows: Row[] = [
      { text: info.title, size: 10, color: 'y' },
      { text: info.kind, size: 7, color: 'h' },
    ];
    if (info.essences.length) rows.push({ pips: info.essences });
    rows.push({ text: info.text, size: 8, color: 'W' });
    for (const [term, def] of info.terms) rows.push({ text: `${term}: ${def}`, size: 7, color: 'a' });
    this.show(rows, x, top, bottom);
  }

  /** Free text: a title and lines, for anything that isn't a card. */
  text(title: string, lines: string[], x: number, top: number, bottom = top) {
    this.show([{ text: title, size: 9, color: 'y' }, ...lines.map((text): Row => ({ text, size: 7, color: 'W' }))], x, top, bottom);
  }

  hide() {
    this.box.setVisible(false);
  }

  private show(rows: Row[], x: number, top: number, bottom: number) {
    const s = this.scene;
    this.box.removeAll(true);
    let y = PAD;
    const parts: Phaser.GameObjects.GameObject[] = [];
    for (const row of rows) {
      if ('pips' in row) {
        row.pips.forEach((e, i) => parts.push(s.add.image(PAD + 3 + i * 9, y + 3, `pip/${e}`)));
        y += 9;
        continue;
      }
      const t = pixelText(s, PAD, y, row.text, { size: row.size, color: row.color, wrap: W - PAD * 2 });
      parts.push(t);
      y += t.height + 2;
    }
    const h = y + PAD - 2;
    this.box.add([panel(s, 0, 0, W, h, 'k', 0.96, 'n'), ...parts]);
    // Prefer above the anchor; flip below when there's no room; keep it on screen.
    const above = top - h - 4;
    const by = above >= 4 ? above : Math.min(bottom + 4, 356 - h);
    this.box.setPosition(Math.round(Math.max(4, Math.min(636 - W, x - W / 2))), Math.round(by));
    this.box.setVisible(true);
  }
}

type Row = { text: string; size: number; color: PaletteKey } | { pips: readonly string[] };
