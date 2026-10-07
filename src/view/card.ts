import Phaser from 'phaser';
import { CARD_H, CARD_W, cardFrame, essencePip } from '../art/procedural';
import { rasterize } from '../art/sprite';
import { SPRITES } from '../art/sprites';
import { placeholder } from '../art/procedural';
import { codex, cardKind } from '../codex';
import { drawCrispText } from './crispText';
import { FONT_BODY, FONT_DISPLAY } from './text';

const spriteById = new Map(SPRITES.map((s) => [s.id, s]));

export function cardTextureKey(cardId: string): string {
  return `card/face/${cardId}`;
}

/**
 * Bakes a card face into one texture: frame + 2x icon + pips (Pixmap) + crisp text (canvas).
 * One texture per card id, so a card is a single sprite that rotates and scales cleanly.
 */
export function bakeCardFace(scene: Phaser.Scene, cardId: string): string {
  const key = cardTextureKey(cardId);
  if (scene.textures.exists(key)) return key;

  const kind = cardKind(cardId);
  const face = cardFrame();
  const sprite = spriteById.get(`${kind}/${cardId}`);
  face.blit(sprite ? rasterize(sprite) : placeholder(16, 16), 12, 9, 2);

  if (kind === 'ingredient') {
    const ing = codex.ingredients.get(cardId)!;
    ing.essences.forEach((e, i) => face.blit(essencePip(e), CARD_W - 12 - i * 8, CARD_H - 11));
  }

  const tex = scene.textures.createCanvas(key, CARD_W, CARD_H)!;
  const ctx = tex.getContext();
  ctx.putImageData(new ImageData(new Uint8ClampedArray(face.data), CARD_W, CARD_H), 0, 0);

  if (kind === 'ingredient') {
    const ing = codex.ingredients.get(cardId)!;
    drawCrispText(ctx, ing.name, CARD_W / 2, 45, { font: FONT_BODY, size: 8, color: 'k', align: 'center', maxWidth: 50, lineHeight: 8 });
    drawCrispText(ctx, String(ing.potency), 5, CARD_H - 13, { font: FONT_DISPLAY, size: 8, color: 'r' });
  } else {
    const t = codex.tinctures.get(cardId)!;
    drawCrispText(ctx, t.name, CARD_W / 2, 45, { font: FONT_BODY, size: 8, color: 'k', align: 'center', maxWidth: 50 });
    drawCrispText(ctx, 'TINCTURE', CARD_W / 2, CARD_H - 13, { font: FONT_DISPLAY, size: 8, color: 'P', align: 'center' });
  }
  tex.refresh();
  return key;
}

/** A card in the world. A container so later milestones can add glows, badges and hover states. */
export function createCard(scene: Phaser.Scene, x: number, y: number, cardId: string): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y, [scene.add.image(0, 0, bakeCardFace(scene, cardId))]);
  c.setSize(CARD_W, CARD_H);
  return c;
}
