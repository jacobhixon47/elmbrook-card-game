import { describe, expect, it } from 'vitest';
import { migrateProfile, newProfile, PROFILE_VERSION } from '../src/core';
import { pickZoom } from '../src/view/zoom';

describe('display settings', () => {
  it('start at the largest scale that fits, in a window', () => {
    expect(newProfile().display).toEqual({ scale: 0, fullscreen: false });
  });

  it('are repaired when missing or bad', () => {
    expect(migrateProfile({ version: PROFILE_VERSION }).display).toEqual({ scale: 0, fullscreen: false });
    expect(migrateProfile({ version: PROFILE_VERSION, display: { scale: 3, fullscreen: true } }).display).toEqual({ scale: 3, fullscreen: true });
    expect(migrateProfile({ version: PROFILE_VERSION, display: { scale: 2.5, fullscreen: 'yes' } }).display).toEqual({ scale: 0, fullscreen: false });
    expect(migrateProfile({ version: PROFILE_VERSION, display: { scale: 99 } }).display.scale).toBe(0);
    expect(migrateProfile({ version: PROFILE_VERSION, display: null }).display).toEqual({ scale: 0, fullscreen: false });
  });

  it('never draw bigger than the window fits', () => {
    expect(pickZoom(0, 3)).toBe(3);
    expect(pickZoom(2, 3)).toBe(2);
    expect(pickZoom(4, 3)).toBe(3);
    expect(pickZoom(1, 1)).toBe(1);
  });
});
