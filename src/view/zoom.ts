import { loadProfile } from '../profile';

export const BASE_W = 640;
export const BASE_H = 360;

/** Largest whole-number scale that fits the window. */
export function fitZoom(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.floor(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H)));
}

/** The scale to draw at: the one chosen in Settings (0 = the largest that fits), never bigger than the window. */
export function pickZoom(scale: number, fit: number): number {
  return scale > 0 ? Math.min(scale, fit) : fit;
}

/** The scale the game should be drawn at now. */
export function integerZoom(): number {
  return pickZoom(loadProfile().display.scale, fitZoom());
}

/**
 * The game renders at screen resolution (BASE × ZOOM) with every camera zoomed
 * by ZOOM. Pixel art stays chunky (nearest-neighbour, whole-number scale) while
 * text is drawn at full screen resolution, so it stays sharp and readable.
 */
export const ZOOM = integerZoom();
