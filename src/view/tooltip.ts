import type Phaser from 'phaser';
import type { PaletteKey } from '../art/palette';
import { INFUSED_LOOK, MODIFIER_LOOK, TAG_GLYPHS } from '../art/procedural';
import { cardInfo, extraLines, potencyParts, type CardExtras, type PotencyPart } from './inspect';
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

  constructor(private scene: Phaser.Scene, depth = 1000) {
    this.box = scene.add.container(0, 0).setDepth(depth).setVisible(false);
  }

  /** A card's details, placed above (or below) the point given. */
  card(id: string, x: number, top: number, bottom = top, extras: CardExtras = {}) {
    const info = cardInfo(id);
    const rows: Row[] = [
      { text: info.title, size: 10, color: 'y' },
      { text: info.kind, size: 7, color: 'h' },
    ];
    if (info.essences.length) rows.push({ pips: info.essences });
    if (info.tags.length) rows.push({ tags: info.tags });
    // "Potency: 5 + 2", each addition in its own colour, then what each one is (Jacob, Oct 21).
    if (info.potency !== null) {
      const { base, parts } = potencyParts(id, extras);
      rows.push({ spans: [{ text: `Potency: ${base}`, color: 'W' }, ...parts.map((p) => ({ text: ` + ${p.amount}`, color: toneGlow(p.tone) }))] });
      for (const line of extraLines(id, extras)) rows.push({ text: line.text, size: 8, color: toneGlow(line.tone) });
    }
    rows.push({ text: info.text, size: 8, color: 'W' });
    for (const [term, def] of info.terms) rows.push({ text: `${term}: ${def}`, size: 7, color: 'a' });
    if (info.lore) rows.push({ text: info.lore, size: 7, color: 'L' });
    this.show(rows, x, top, bottom);
  }

  /** Free text: a title and lines, for anything that isn't a card. */
  text(title: string, lines: string[], x: number, top: number, bottom = top) {
    this.show([{ text: title, size: 9, color: 'y' }, ...lines.map((text): Row => ({ text, size: 7, color: 'W' }))], x, top, bottom);
  }

  hide() {
    this.box.setVisible(false);
  }

  /** Hover help on anything drawn: the panel sits above it, or below when there's no room. */
  on<T extends Hoverable>(obj: T, title: string, lines: readonly string[] | (() => readonly string[])): T {
    if (!obj.input) obj.setInteractive();
    obj.on('pointerover', () => {
      const b = obj.getBounds();
      this.text(title, [...(typeof lines === 'function' ? lines() : lines)], b.centerX, b.top, b.bottom);
    });
    obj.on('pointerout', () => this.hide());
    return obj;
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
      if ('spans' in row) {
        let tx = PAD;
        for (const span of row.spans) {
          const t = pixelText(s, tx, y, span.text, { size: 8, color: span.color });
          parts.push(t);
          tx += t.width;
        }
        y += 10;
        continue;
      }
      if ('tags' in row) {
        // Each tag the rules read, in its mark's colour, side by side.
        let tx = PAD;
        for (const tag of row.tags) {
          const t = pixelText(s, tx, y, tag[0]!.toUpperCase() + tag.slice(1), { size: 8, color: TAG_GLYPHS[tag]!.text });
          parts.push(t);
          tx += t.width + 6;
        }
        y += 10;
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

type Hoverable = Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle };

type Row = { text: string; size: number; color: PaletteKey } | { pips: readonly string[] } | { tags: readonly string[] } | { spans: readonly { text: string; color: PaletteKey }[] };

/** The colour an addition to Potency is written in, on the tooltip's dark panel. */
const toneGlow = (tone: PotencyPart['tone']): PaletteKey => (tone === 'infused' ? INFUSED_LOOK.glow : MODIFIER_LOOK[tone].glow);
