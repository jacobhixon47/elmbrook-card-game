export const BASE_W = 640;
export const BASE_H = 360;

/** Largest whole-number scale that fits the window. */
export function integerZoom(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.floor(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H)));
}

/**
 * The game renders at screen resolution (BASE × ZOOM) with every camera zoomed
 * by ZOOM. Pixel art stays chunky (nearest-neighbour, whole-number scale) while
 * text is drawn at full screen resolution, so it stays sharp and readable.
 */
export const ZOOM = integerZoom();
