import type { Season } from './calendar';

export type Action =
  | { type: 'startRun'; seed: string; witch: string; season?: Season }
  | { type: 'drawToHandSize' };

export type GameEvent =
  | { type: 'runStarted'; seed: string; witch: string }
  | { type: 'deckShuffled'; size: number }
  | { type: 'cardDrawn'; uid: number; card: string };
