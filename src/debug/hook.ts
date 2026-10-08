import type Phaser from 'phaser';
import type { Action, RunState } from '../core';
import { store } from '../store';

/** What Playwright and the snap script talk to. Present in dev and preview builds. */
export type ElmbrookHook = {
  ready: string | null;
  getState: () => RunState | null;
  dispatch: (action: Action) => void;
  /** Every action since the page loaded: a replay file is `{ seed, actions: getLog() }`. */
  getLog: () => Action[];
  game: Phaser.Game;
};

declare global {
  interface Window {
    __elmbrook?: ElmbrookHook;
  }
}

export function installHook(game: Phaser.Game): void {
  window.__elmbrook = {
    ready: null,
    getState: () => store.getState(),
    dispatch: (a) => void store.dispatch(a),
    getLog: () => store.log.slice(),
    game,
  };
}

/** Scenes call this once they have fully drawn, so screenshots never catch a half-built frame. */
export function markReady(scene: Phaser.Scene): void {
  scene.time.delayedCall(50, () => {
    if (window.__elmbrook) window.__elmbrook.ready = scene.scene.key;
  });
}
