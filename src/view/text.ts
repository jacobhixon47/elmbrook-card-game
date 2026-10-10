import type Phaser from 'phaser';
import { PALETTE, type PaletteKey } from '../art/palette';
import { ZOOM } from './zoom';

// Pixelify Sans's 3, 5 and 8 read as 8, S and B at small sizes, so digits come from VT323,
// scaled to sit with each font (installDigits). Canvas text falls through to the next font per glyph.
export const FONT_BODY = '"Elmbrook Digits", "Pixelify Sans"';
export const FONT_DISPLAY = '"Elmbrook Display Digits", Silkscreen';

/** Register the digit faces; await the promise before Phaser measures any text. */
export function installDigits(url: string): Promise<unknown> {
  const faces = [
    new FontFace('Elmbrook Digits', `url(${url})`, { unicodeRange: 'U+0030-0039', sizeAdjust: '125%' } as FontFaceDescriptors),
    new FontFace('Elmbrook Display Digits', `url(${url})`, { unicodeRange: 'U+0030-0039', sizeAdjust: '150%' } as FontFaceDescriptors),
  ];
  for (const f of faces) document.fonts.add(f);
  return Promise.all(faces.map((f) => f.load()));
}

type TextOpts = {
  size?: number;
  color?: PaletteKey;
  font?: 'body' | 'display';
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  stroke?: PaletteKey;
  shadow?: boolean;
};

/** All game text goes through here so fonts, sizes and colours stay on-palette. */
export function pixelText(scene: Phaser.Scene, x: number, y: number, str: string, opts: TextOpts = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: opts.font === 'display' ? FONT_DISPLAY : FONT_BODY,
    fontSize: `${opts.size ?? 8}px`,
    color: PALETTE[opts.color ?? 'w'],
    align: opts.align ?? 'left',
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    stroke: opts.stroke ? PALETTE[opts.stroke] : undefined,
    strokeThickness: opts.stroke ? 3 : 0,
  });
  // Rendered at screen resolution: the camera zooms the world, the text stays sharp.
  t.setResolution(ZOOM);
  if (opts.shadow) t.setShadow(1, 1, PALETTE.K, 0, true, true);
  return t;
}
