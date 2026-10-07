import type { RngState } from './rng';

/** A card instance in a run. `card` is a codex id; `uid` is unique within the run. */
export type CardInstance = { uid: number; card: string };

export type Phase = 'morning' | 'brewing' | 'dusk' | 'night-market' | 'game-over' | 'victory';

/** Plain, JSON-serialisable run state. Fixtures and saves are exactly this shape. */
export type RunState = {
  version: 1;
  seed: string;
  rng: RngState;
  witch: string;
  week: number; // 1-4
  day: number; // 1-4, where 4 is the Night Shift
  phase: Phase;
  gold: number;
  handSize: number;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  knownRecipes: string[];
  nextUid: number;
};
