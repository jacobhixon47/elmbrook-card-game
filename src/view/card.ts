import Phaser from 'phaser';
import { CARD_H, CARD_W, cardFrame, essencePip, modifyFrame } from '../art/procedural';
import { rasterize } from '../art/sprite';
import { SPRITES } from '../art/sprites';
import { placeholder } from '../art/procedural';
import { codex, cardKind, type Essence, type ModifierId } from '../codex';
import { PALETTE, type PaletteKey } from '../art/palette';
import { FONT_BODY, FONT_DISPLAY } from './text';
import { ZOOM } from './zoom';

const spriteById = new Map(SPRITES.map((s) => [s.id, s]));

export function cardTextureKey(cardId: string, woven?: Essence, modifier?: ModifierId): string {
  return `card/face/${cardId}${woven ? `~${woven}` : ''}${modifier ? `+${modifier}` : ''}`;
}

/**
 * Bakes a card face into one texture: frame + 2x icon + pips (Pixmap) + crisp text (canvas).
 * One texture per card id (and weave and modifier), so a card is a single sprite that rotates and scales cleanly.
 */
export function bakeCardFace(scene: Phaser.Scene, cardId: string, woven?: Essence, modifier?: ModifierId): string {
  const key = cardTextureKey(cardId, woven, modifier);
  if (scene.textures.exists(key)) return key;

  const kind = cardKind(cardId);
  const face = cardFrame();
  const sprite = spriteById.get(`${kind}/${cardId}`);
  face.blit(sprite ? rasterize(sprite) : placeholder(16, 16), 12, 9, 2);
  // A modifier recolours the frame and stamps its badge in the corner (GDD §5.5).
  if (modifier) modifyFrame(face, modifier);

  if (kind === 'ingredient') {
    // A woven essence (the Hollow Tailor) takes the second pip.
    const ing = codex.ingredients.get(cardId)!;
    const essences = woven && !ing.essences.includes(woven) ? [ing.essences[0]!, woven] : ing.essences;
    essences.forEach((e, i) => face.blit(essencePip(e), CARD_W - 12 - i * 8, CARD_H - 11));
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
    // Tags the rules read (Frost, Flower) get a chip on the face, so a Frost card reads as Frost at a glance.
    // They sit in a row across the foot of the art window, like a type line.
    const shown = FACE_TAGS.filter((t) => ing.tags.includes(t.tag));
    const widths = shown.map((t) => chipWidth(ctx, t, Z));
    let left = Math.round((CARD_W - (widths.reduce((a, b) => a + b, 0) + 2 * (shown.length - 1))) / 2);
    shown.forEach((t, i) => {
      tagChip(ctx, t, left, 37, widths[i]!, Z);
      left += widths[i]! + 2;
    });
  } else if (kind === 'tincture') {
    const t = codex.tinctures.get(cardId)!;
    text(t.name, CARD_W / 2, 44, 7, 'k', FONT_BODY, 52);
    text(t.rarity === 'lunar' ? 'OMEN' : 'TINCTURE', CARD_W / 2, CARD_H - 12, 6, t.rarity === 'lunar' ? 'v' : 'P', FONT_DISPLAY);
  } else {
    const j = codex.junk.get(cardId)!;
    text(j.name, CARD_W / 2, 44, 7, 'k', FONT_BODY, 52);
    text('JUNK', CARD_W / 2, CARD_H - 12, 6, 'h', FONT_DISPLAY);
  }
  tex.refresh();
  return key;
}

/** Ingredient tags that rules care about, with their chip colours. Other tags (Root, Mineral...) stay in the inspect panel. */
const FACE_TAGS: { tag: string; label: string; fill: PaletteKey; edge: PaletteKey }[] = [
  { tag: 'frost', label: 'FROST', fill: 'c', edge: 'u' },
  { tag: 'flower', label: 'FLOWER', fill: 'I', edge: 'r' },
  { tag: 'fruit', label: 'FRUIT', fill: 'o', edge: 'B' },
];

function chipWidth(ctx: CanvasRenderingContext2D, t: (typeof FACE_TAGS)[number], Z: number): number {
  ctx.font = `${5 * Z}px ${FONT_DISPLAY}`;
  return Math.ceil(ctx.measureText(t.label).width / Z) + 4;
}

/** A small labelled chip, its top-left at (left, y) in card pixels. */
function tagChip(ctx: CanvasRenderingContext2D, t: (typeof FACE_TAGS)[number], left: number, y: number, w: number, Z: number): void {
  ctx.font = `${5 * Z}px ${FONT_DISPLAY}`;
  ctx.fillStyle = PALETTE[t.edge];
  ctx.fillRect((left + 1) * Z, y * Z, (w - 2) * Z, 7 * Z);
  ctx.fillRect(left * Z, (y + 1) * Z, w * Z, 5 * Z);
  ctx.fillStyle = PALETTE[t.fill];
  ctx.fillRect((left + 1) * Z, (y + 1) * Z, (w - 2) * Z, 5 * Z);
  ctx.fillStyle = PALETTE.k;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(t.label, (left + w / 2) * Z, (y + 1) * Z);
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
export function createCard(scene: Phaser.Scene, x: number, y: number, cardId: string, woven?: Essence, modifier?: ModifierId): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y, [scene.add.image(0, 0, bakeCardFace(scene, cardId, woven, modifier)).setScale(1 / ZOOM)]);
  c.setSize(CARD_W, CARD_H);
  return c;
}
