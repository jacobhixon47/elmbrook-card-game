import Phaser from 'phaser';
import { CARD_H, CARD_W, cardFrame, essencePip } from '../art/procedural';
import { rasterize } from '../art/sprite';
import { SPRITES } from '../art/sprites';
import { placeholder } from '../art/procedural';
import { codex, cardKind } from '../codex';
import { PALETTE, type PaletteKey } from '../art/palette';
import { FONT_BODY, FONT_DISPLAY } from './text';
import { ZOOM } from './zoom';

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

  // Bake at screen resolution: art is scaled up whole-pixel, text is drawn sharp on top.
  const Z = ZOOM;
  const tex = scene.textures.createCanvas(key, CARD_W * Z, CARD_H * Z)!;
  const ctx = tex.getContext();
  ctx.putImageData(scaleUp(face.data, CARD_W, CARD_H, Z), 0, 0);

  const text = (str: string, x: number, y: number, size: number, color: PaletteKey, font: string, maxWidth?: number) => {
    ctx.font = `${size * Z}px ${font}`;
    ctx.fillStyle = PALETTE[color];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const lines = wrapLines(ctx, str, maxWidth ? maxWidth * Z : undefined);
    lines.forEach((line, i) => ctx.fillText(line, x * Z, (y + i * (size + 1)) * Z));
  };

  if (kind === 'ingredient') {
    const ing = codex.ingredients.get(cardId)!;
    text(ing.name, CARD_W / 2, 44, 7, 'k', FONT_BODY, 52);
    ctx.textAlign = 'left';
    ctx.font = `${8 * Z}px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.r;
    ctx.fillText(String(ing.potency), 5 * Z, (CARD_H - 13) * Z);
  } else {
    const t = codex.tinctures.get(cardId)!;
    text(t.name, CARD_W / 2, 44, 7, 'k', FONT_BODY, 52);
    text('TINCTURE', CARD_W / 2, CARD_H - 12, 6, 'P', FONT_DISPLAY);
  }
  tex.refresh();
  return key;
}

function scaleUp(data: Uint8ClampedArray, w: number, h: number, z: number): ImageData {
  const out = new ImageData(w * z, h * z);
  for (let y = 0; y < h * z; y++) {
    for (let x = 0; x < w * z; x++) {
      const si = (Math.floor(y / z) * w + Math.floor(x / z)) * 4;
      const di = (y * w * z + x) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = data[si + k] ?? 0;
    }
  }
  return out;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth?: number): string[] {
  if (!maxWidth) return [text];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A card in the world. A container so later milestones can add glows, badges and hover states. */
export function createCard(scene: Phaser.Scene, x: number, y: number, cardId: string): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y, [scene.add.image(0, 0, bakeCardFace(scene, cardId)).setScale(1 / ZOOM)]);
  c.setSize(CARD_W, CARD_H);
  return c;
}
