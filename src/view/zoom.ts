import { loadProfile } from '../profile';

export const BASE_W = 640;
export const BASE_H = 360;

/** How many times over the base size fits in this area: fractional, so the game can fill it. */
export const fitOf = (w: number, h: number): number => Math.min(w / BASE_W, h / BASE_H);

/** Largest whole-number scale that fits the window. */
export function fitZoom(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.floor(fitOf(window.innerWidth, window.innerHeight)));
}

/**
 * The scale to draw at, in device pixels. A chosen whole scale (Settings) draws at that size; Fill (0)
 * draws at the size of the window or the whole screen, whichever is bigger, rounded up. Going
 * fullscreen keeps the page (a reload would drop it), so Fill is already sharp at full screen size,
 * and in a window the browser shrinks it smoothly to fit.
 */
export function pickZoom(scale: number, window: number, screen: number, dpr: number): number {
  if (scale > 0) return Math.max(1, Math.ceil(Math.min(scale, Math.max(1, Math.floor(window))) * dpr));
  return Math.max(1, Math.ceil(Math.max(window, screen) * dpr - 1e-6));
}

/** The scale the game should be drawn at now. */
export function integerZoom(): number {
  if (typeof window === 'undefined') return 1;
  return pickZoom(loadProfile().display.scale, fitOf(window.innerWidth, window.innerHeight), fitOf(window.screen.width, window.screen.height), window.devicePixelRatio || 1);
}

/**
 * The game renders at BASE × ZOOM device pixels with every camera zoomed by ZOOM. Pixel art stays
 * chunky (nearest-neighbour, whole-number scale) while text is drawn at full resolution, so it stays
 * sharp; the canvas is then sized to the window (display.ts).
 */
export const ZOOM = integerZoom();
