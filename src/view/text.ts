import type Phaser from 'phaser';
import { PALETTE, type PaletteKey } from '../art/palette';
import { ZOOM } from './zoom';

export const FONT_BODY = '"Pixelify Sans"';
export const FONT_DISPLAY = 'Silkscreen';

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
