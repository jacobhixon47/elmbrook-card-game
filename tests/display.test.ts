import { describe, expect, it } from 'vitest';
import { migrateProfile, newProfile, PROFILE_VERSION } from '../src/core';
import { pickZoom } from '../src/view/zoom';

describe('display settings', () => {
  it('start filling the window, in a window', () => {
    expect(newProfile().display).toEqual({ scale: 0, fullscreen: false });
  });

  it('are repaired when missing or bad', () => {
    expect(migrateProfile({ version: PROFILE_VERSION }).display).toEqual({ scale: 0, fullscreen: false });
    expect(migrateProfile({ version: PROFILE_VERSION, display: { scale: 3, fullscreen: true } }).display).toEqual({ scale: 3, fullscreen: true });
    expect(migrateProfile({ version: PROFILE_VERSION, display: { scale: 2.5, fullscreen: 'yes' } }).display).toEqual({ scale: 0, fullscreen: false });
    expect(migrateProfile({ version: PROFILE_VERSION, display: { scale: 99 } }).display.scale).toBe(0);
    expect(migrateProfile({ version: PROFILE_VERSION, display: null }).display).toEqual({ scale: 0, fullscreen: false });
  });

  it('fill draws at the bigger of the window and the screen, so fullscreen is sharp without a reload', () => {
    // A 1920×1080 screen with a 1280×720 window: drawn at 3x, shrunk to the window.
    expect(pickZoom(0, 2, 3, 1)).toBe(3);
    // A window just short of the screen (a maximised window under the title bar).
    expect(pickZoom(0, 2.92, 3, 1)).toBe(3);
    // A high-DPI laptop: 1440×900 at 2x device pixels.
    expect(pickZoom(0, 2.25, 2.25, 2)).toBe(5);
    expect(pickZoom(0, 2, 2, 1)).toBe(2);
  });

  it('a whole scale draws at that size, never bigger than the window fits', () => {
    expect(pickZoom(2, 3, 3, 1)).toBe(2);
    expect(pickZoom(4, 3.5, 4, 1)).toBe(3);
    expect(pickZoom(1, 1, 1, 1)).toBe(1);
    expect(pickZoom(2, 3, 3, 1.5)).toBe(3);
  });
});
