import { PALETTE, type PaletteKey } from '../art/palette';

export type CrispTextOpts = {
  font: string; // CSS font family, e.g. '"Pixelify Sans"'
  size: number;
  color: PaletteKey;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  lineHeight?: number;
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth?: number): string[] {
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

/**
 * Draws text with hard pixel edges: renders with the browser font, then snaps
 * every pixel to fully on (palette colour) or fully off. No grey fringes, so
 * baked text survives rotation and scaling like the rest of the pixel art.
 */
export function drawCrispText(target: CanvasRenderingContext2D, text: string, x: number, y: number, o: CrispTextOpts): void {
  const lineHeight = o.lineHeight ?? o.size + 1;
  const scratch = document.createElement('canvas');
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `${o.size}px ${o.font}`;
  const lines = wrap(ctx, text, o.maxWidth);
  const width = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width), 1)) + 2;
  const height = lines.length * lineHeight + 4;
  scratch.width = width;
  scratch.height = height;
  ctx.font = `${o.size}px ${o.font}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  lines.forEach((line, i) => {
    const lw = ctx.measureText(line).width;
    const lx = o.align === 'center' ? (width - lw) / 2 : o.align === 'right' ? width - lw : 0;
    ctx.fillText(line, Math.round(lx), i * lineHeight);
  });

  const img = ctx.getImageData(0, 0, width, height);
  const hex = PALETTE[o.color];
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < img.data.length; i += 4) {
    const on = (img.data[i + 3] ?? 0) >= 110;
    img.data[i] = rgb[0]!;
    img.data[i + 1] = rgb[1]!;
    img.data[i + 2] = rgb[2]!;
    img.data[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);

  const ox = o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x;
  target.drawImage(scratch, Math.round(ox), Math.round(y));
}
