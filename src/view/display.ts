// Fullscreen and the game's scale (Settings, GDD §15.1). Textures and text are drawn for one scale,
// so a new scale reloads the page; the run in progress is saved after every action, so nothing is lost.

import { loadProfile, saveProfile } from '../profile';
import { BASE_H, BASE_W, ZOOM, fitZoom, integerZoom } from './zoom';

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

/** Choose a scale (0 = the largest that fits) and redraw at it. */
export function setScale(scale: number): void {
  saveProfile({ display: { ...loadProfile().display, scale } });
  if (integerZoom() !== ZOOM) location.reload();
}

/** The scales Settings offers: 0 (fit) and every whole scale that fits this screen. */
export function scaleChoices(): number[] {
  return [0, ...Array.from({ length: fitZoom() }, (_, i) => i + 1)];
}

/**
 * Keep the game fitted to the window. Leaving the page would drop browser fullscreen, so while
 * fullscreen the canvas is stretched by CSS instead of reloaded; anywhere else a new scale reloads.
 */
export function installDisplay(canvas: HTMLCanvasElement): void {
  const fit = () => {
    if (isFullscreen()) {
      const z = integerZoom();
      canvas.style.width = `${BASE_W * z}px`;
      canvas.style.height = `${BASE_H * z}px`;
      return;
    }
    canvas.style.width = canvas.style.height = '';
    if (integerZoom() !== ZOOM) location.reload();
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
}
