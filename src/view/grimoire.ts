import type Phaser from 'phaser';
import { hex } from '../art/palette';
import { NIGHT_SHIFT_DAY, type RunState, type Weather } from '../core';
import type { PaletteKey } from '../art/palette';
import { createCard } from './card';
import { calendarWeeks, dayRules, WEATHER_NAME } from './calendar';
import { deckRows, guideSections, recipeRows, undiscoveredLine } from './guide';
import { pixelText } from './text';
import type { Tooltip } from './tooltip';
import { button, panel } from './ui';

export type GrimoireTab = 'recipes' | 'deck' | 'calendar' | 'guide';
export const GRIMOIRE_TABS: GrimoireTab[] = ['recipes', 'deck', 'calendar', 'guide'];

const WEATHER_COLOR: Record<Weather, PaletteKey> = { clear: 'W', rain: 'c', fog: 'a', heatwave: 'o', snow: 'w' };
const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);

const X = 40;
const Y = 30;
const W = 560;
const H = 304;
/** Known recipes per Grimoire page: two columns. */
export const RECIPES_PER_PAGE = 14;

/**
 * The Grimoire (GDD §15.1): known recipes, the deck and a rules guide, drawn over whatever screen
 * the run is on. Everything is added to `layer`, which the scene clears on its next redraw.
 */
export function drawGrimoire(
  scene: Phaser.Scene, layer: Phaser.GameObjects.Container, s: RunState, tab: GrimoireTab, tip: Tooltip,
  on: { tab(t: GrimoireTab): void; close(): void; page(n: number): void }, page = 0,
) {
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => (layer.add(o), o);
  const text = (x: number, y: number, str: string, opts: Parameters<typeof pixelText>[4] = {}) => add(pixelText(scene, x, y, str, opts));

  add(scene.add.rectangle(0, 0, 640, 360, hex('K'), 0.6).setOrigin(0).setInteractive()).on('pointerdown', () => on.close());
  add(panel(scene, X, Y, W, H, 'k', 0.97, 'n').setInteractive());
  text(X + 12, Y + 8, 'Grimoire', { size: 14, color: 'y' });
  const labels: Record<GrimoireTab, string> = { recipes: 'Recipes', deck: 'Deck', calendar: 'Calendar', guide: 'How to play' };
  GRIMOIRE_TABS.forEach((t, i) => {
    const b = add(button(scene, 214 + i * 76, Y + 16, labels[t], () => on.tab(t), { w: 70, color: t === tab ? 'Y' : 'W' }));
    if (t === tab) (b.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(1, hex('y'));
  });
  add(button(scene, X + W - 40, Y + 16, 'Close', () => on.close(), { w: 56 }));
  text(X + W - 12, Y + H - 12, 'G or Esc to close', { size: 6, color: 'h' }).setOrigin(1, 0);

  const top = Y + 36;
  if (tab === 'recipes') {
    const rows = recipeRows(s);
    const known = rows.filter((r) => r.known);
    text(X + 12, top, `You know ${known.length} of the ${rows.length} recipes you can discover this run. Match the essence pattern, in any order.`, { size: 7, color: 'a' });
    const pages = Math.max(1, Math.ceil(known.length / RECIPES_PER_PAGE));
    const at = Math.min(page, pages - 1);
    known.slice(at * RECIPES_PER_PAGE, (at + 1) * RECIPES_PER_PAGE).forEach((r, i) => {
      const x = X + 12 + (i >= RECIPES_PER_PAGE / 2 ? 272 : 0);
      const y = top + 14 + (i % (RECIPES_PER_PAGE / 2)) * 28;
      text(x, y, r.name, { size: 9, color: 'y' });
      r.pattern!.forEach((e, j) => (e === 'any'
        ? text(x + 2 + j * 10, y + 13, '?', { size: 7, color: 'W' })
        : add(scene.add.image(x + 4 + j * 10, y + 17, `pip/${e}`))));
      const words = r.pattern!.map((e) => e[0]!.toUpperCase() + e.slice(1)).join(' + ');
      text(x + 4 + r.slots * 10, y + 13, `${words} → ${r.family} · Harmony ${r.harmony}`, { size: 7, color: 'W' });
    });
    if (pages > 1) {
      add(button(scene, X + W - 170, Y + H - 34, '‹ Prev', () => on.page(at - 1), { w: 50, enabled: at > 0 }));
      text(X + W - 115, Y + H - 38, `${at + 1} / ${pages}`, { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0);
      add(button(scene, X + W - 60, Y + H - 34, 'Next ›', () => on.page(at + 1), { w: 50, enabled: at < pages - 1 }));
    }
    text(X + 12, Y + H - 24, undiscoveredLine(rows, s.cauldronSlots), { size: 7, color: 'a', wrap: W - 200 });
    return;
  }

  if (tab === 'deck') {
    const total = s.drawPile.length + s.hand.length + s.discardPile.length + s.cauldron.length;
    text(X + 12, top, `${total} cards. Draw pile ${s.drawPile.length} · hand ${s.hand.length} · discarded ${s.discardPile.length}. Every morning the whole deck is shuffled together.`, { size: 7, color: 'a', wrap: W - 24 });
    const rows = deckRows(s);
    const perRow = 8;
    rows.forEach((r, i) => {
      const x = X + 48 + (i % perRow) * 66;
      const y = top + 50 + Math.floor(i / perRow) * 84;
      const c = add(createCard(scene, x, y, r.card).setScale(0.75));
      c.setInteractive();
      c.on('pointerover', () => tip.card(r.card, x, y - 30, y + 30));
      c.on('pointerout', () => tip.hide());
      text(x, y + 32, `×${r.total} · ${r.inDraw} to draw`, { size: 7, color: r.inDraw ? 'W' : 'a', align: 'center' }).setOrigin(0.5, 0);
    });
    // The Night Satchel (GDD §5.4): Lunar cards and Omens that join the deck only on Night Shifts.
    const satchel = deckRows({ drawPile: [], hand: [], discardPile: s.satchel, cauldron: [] });
    const sy = Y + H - 44;
    text(X + 12, sy - 6, 'Night Satchel', { size: 8, color: 'v' });
    text(X + 12, sy + 6, satchel.length ? 'Joins your deck on Night Shifts.' : s.day === NIGHT_SHIFT_DAY ? 'In your deck tonight.' : 'Empty. Lunar cards and Omens go here.', { size: 6, color: 'a', wrap: 90 });
    satchel.forEach((r, i) => {
      const x = X + 130 + i * 42;
      const c = add(createCard(scene, x, sy + 4, r.card).setScale(0.6));
      c.setInteractive();
      c.on('pointerover', () => tip.card(r.card, x, sy - 20, sy + 28));
      c.on('pointerout', () => tip.hide());
      if (r.total > 1) text(x + 14, sy + 20, `×${r.total}`, { size: 7, color: 'W', stroke: 'k' });
    });
    text(X + W - 12, Y + H - 24, 'Hover a card to read it.', { size: 7, color: 'a' }).setOrigin(1, 0);
    return;
  }

  if (tab === 'calendar') {
    text(X + 12, top, `${cap(s.season)}. The whole month is set when the run starts, so you can plan around it. Hover a day for its rules.`, { size: 7, color: 'a', wrap: W - 24 });
    const cw = 94;
    const ch = 52;
    calendarWeeks(s).forEach((wk, wi) => {
      const y = top + 16 + wi * (ch + 4);
      text(X + 12, y + 8, `Week ${wk.week}`, { size: 9, color: wk.week === s.week ? 'y' : 'W' });
      text(X + 12, y + 22, wk.moon, { size: 7, color: 'a' });
      wk.cells.forEach((c, di) => {
        const x = X + 80 + di * (cw + 2);
        const cell = add(scene.add.rectangle(x, y, cw, ch, hex(c.day === NIGHT_SHIFT_DAY ? 'K' : 'k'), c.mark === 'done' ? 0.4 : 0.95).setOrigin(0));
        cell.setStrokeStyle(c.mark === 'now' ? 2 : 1, hex(c.mark === 'now' ? 'y' : 'n'), c.mark === 'now' ? 1 : 0.6);
        text(x + 5, y + 4, c.label, { size: 7, color: c.mark === 'done' ? 'h' : 'a' });
        text(x + 5, y + 16, WEATHER_NAME[c.weather], { size: 8, color: c.mark === 'done' ? 'h' : WEATHER_COLOR[c.weather] });
        c.marks.forEach((m, mi) => text(x + 5, y + 29 + mi * 10, m, { size: 7, color: 'y' }));
        cell.setInteractive();
        cell.on('pointerover', () => tip.text(`${c.label === 'Night' ? 'Night Shift' : c.label}, week ${c.week}`, dayRules(s, c), x + cw / 2, y, y + ch));
        cell.on('pointerout', () => tip.hide());
      });
    });
    return;
  }

  const sections = guideSections();
  const cols = [sections.slice(0, 3), sections.slice(3)];
  cols.forEach((col, ci) => {
    let y = top;
    for (const sec of col) {
      text(X + 12 + ci * 276, y, sec.title, { size: 9, color: 'y' });
      const body = text(X + 12 + ci * 276, y + 12, sec.body, { size: 7, color: 'W', wrap: 260 });
      y += 16 + body.height + 6;
    }
  });
}
