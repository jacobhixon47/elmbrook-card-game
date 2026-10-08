import { PALETTE, type PaletteKey } from './palette';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * A tiny palette-locked raster for procedural art. Works in the browser
 * (uploaded as a canvas texture) and in node scripts (written as PNG), so
 * contact sheets and the game always show the same pixels.
 */
export class Pixmap {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, key: PaletteKey): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this;
    const c = PALETTE[key];
    const i = (y * this.width + x) * 4;
    this.data[i] = parseInt(c.slice(1, 3), 16);
    this.data[i + 1] = parseInt(c.slice(3, 5), 16);
    this.data[i + 2] = parseInt(c.slice(5, 7), 16);
    this.data[i + 3] = 255;
    return this;
  }

  clear(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[(y * this.width + x) * 4 + 3] = 0;
  }

  isSet(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return (this.data[(y * this.width + x) * 4 + 3] ?? 0) > 0;
  }

  fillRect(x: number, y: number, w: number, h: number, key: PaletteKey): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, key);
    return this;
  }

  strokeRect(x: number, y: number, w: number, h: number, key: PaletteKey): this {
    for (let i = x; i < x + w; i++) {
      this.set(i, y, key);
      this.set(i, y + h - 1, key);
    }
    for (let j = y; j < y + h; j++) {
      this.set(x, j, key);
      this.set(x + w - 1, j, key);
    }
    return this;
  }

  hline(x0: number, x1: number, y: number, key: PaletteKey): this {
    for (let x = x0; x <= x1; x++) this.set(x, y, key);
    return this;
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, key: PaletteKey): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, key);
      }
    }
    return this;
  }

  /** Two-colour ordered (Bayer 4x4) dither between rows y0..y1, top colour `a`. */
  ditherV(y0: number, y1: number, a: PaletteKey, b: PaletteKey, x0 = 0, x1 = this.width - 1): this {
    for (let y = y0; y <= y1; y++) {
      const t = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
      for (let x = x0; x <= x1; x++) {
        const threshold = ((BAYER[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
        this.set(x, y, t > threshold ? b : a);
      }
    }
    return this;
  }

  /**
   * Shades a pixel from a ramp (dark → light) at brightness t in [0, 1], using
   * ordered dithering between neighbouring steps. The core of procedural lighting.
   */
  shade(x: number, y: number, ramp: readonly PaletteKey[], t: number): this {
    const clamped = Math.max(0, Math.min(1, t));
    const pos = clamped * (ramp.length - 1);
    const lo = Math.floor(pos);
    const frac = pos - lo;
    const threshold = ((BAYER[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] ?? 0) + 0.5) / 16;
    const key = ramp[Math.min(ramp.length - 1, frac > threshold ? lo + 1 : lo)];
    return key ? this.set(x, y, key) : this;
  }

  /** Adds a 1px outline of `key` around every filled pixel (outside only). */
  outline(key: PaletteKey): this {
    const filled = (x: number, y: number) => this.isSet(x, y);
    const toSet: [number, number][] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) toSet.push([x, y]);
      }
    }
    for (const [x, y] of toSet) this.set(x, y, key);
    return this;
  }

  /** Copies another raster (e.g. a rasterized sprite) in at x,y, optionally scaled by an integer. */
  blit(src: { width: number; height: number; data: Uint8ClampedArray }, dx: number, dy: number, scale = 1): this {
    for (let y = 0; y < src.height * scale; y++) {
      for (let x = 0; x < src.width * scale; x++) {
        const si = (Math.floor(y / scale) * src.width + Math.floor(x / scale)) * 4;
        if ((src.data[si + 3] ?? 0) === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        const ti = (ty * this.width + tx) * 4;
        for (let k = 0; k < 4; k++) this.data[ti + k] = src.data[si + k] ?? 0;
      }
    }
    return this;
  }
}
