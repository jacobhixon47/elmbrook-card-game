// Fullscreen and the game's scale (Settings, GDD §15.1). Textures and text are drawn for one scale,
// so a new scale reloads the page; the run in progress is saved after every action, so nothing is lost.

import { loadProfile, saveProfile } from '../profile';
import { BASE_H, BASE_W, ZOOM, fitOf, fitZoom, integerZoom } from './zoom';

export const isFullscreen = () => typeof document !== 'undefined' && document.fullscreenElement != null;

/** Go fullscreen or back to a window, and remember the choice. Browsers only allow it from a click or key. */
export async function setFullscreen(on: boolean): Promise<void> {
  saveProfile({ display: { ...loadProfile().display, fullscreen: on } });
  try {
    if (on && !isFullscreen()) await document.documentElement.requestFullscreen();
    if (!on && isFullscreen()) await document.exitFullscreen();
  } catch {
    // Refused (no user gesture, or not allowed here): the window stays as it is.
  }
}

/** Choose a scale (0 = fill the window) and redraw at it. */
export function setScale(scale: number): void {
  saveProfile({ display: { ...loadProfile().display, scale } });
  if (integerZoom() !== ZOOM) location.reload();
  else window.dispatchEvent(new Event('resize'));
}

/** The scales Settings offers: 0 (fill the window) and every whole scale that fits it. */
export function scaleChoices(): number[] {
  return [0, ...Array.from({ length: fitZoom() }, (_, i) => i + 1)];
}

/**
 * Keep the game fitted to the window. Fill (the default) sizes the canvas to the biggest 16:9 that
 * fits, shrinking the drawn image smoothly; a chosen whole scale shows it at exactly that size. A
 * new drawn scale reloads, except while fullscreen, which leaving the page would drop.
 */
export function installDisplay(canvas: HTMLCanvasElement): void {
  const fit = () => {
    const scale = loadProfile().display.scale;
    const dpr = window.devicePixelRatio || 1;
    if (!isFullscreen() && integerZoom() !== ZOOM) return location.reload();
    // CSS pixels across: whole device pixels, so the edges stay crisp.
    const k = scale > 0 ? Math.min(scale, fitZoom()) : fitOf(window.innerWidth, window.innerHeight);
    const w = Math.floor((BASE_W * k * dpr)) / dpr;
    const h = Math.floor((BASE_H * k * dpr)) / dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    // Shown at the size it's drawn: nearest-neighbour. Shrunk to fit: smooth, so no pixel rows drop.
    canvas.style.imageRendering = Math.abs(w * dpr - BASE_W * ZOOM) < 1 ? 'pixelated' : 'auto';
  };
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', () => {
    // Esc (or the browser's own control) can leave fullscreen too: remember that.
    if (!isFullscreen() && loadProfile().display.fullscreen) saveProfile({ display: { ...loadProfile().display, fullscreen: false } });
    fit();
  });
  // Fullscreen chosen last time: browsers need a click or key first, so it waits for one.
  const resume = () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    if (loadProfile().display.fullscreen && !isFullscreen()) void setFullscreen(true);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  fit();
}
