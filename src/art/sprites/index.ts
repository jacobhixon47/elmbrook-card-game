import type { SpriteDef } from '../sprite';
import * as ingredients from './ingredients';
import * as creatures from './ingredients-creatures';
import * as flowers from './ingredients-flowers';
import * as harvest from './ingredients-harvest';
import * as minerals from './ingredients-minerals';
import { potions } from './potions';

/** Every hand-authored sprite in the game, keyed by texture id. */
export const SPRITES: readonly SpriteDef[] = [
  ...Object.values(ingredients),
  ...Object.values(flowers),
  ...Object.values(harvest),
  ...Object.values(minerals),
  ...Object.values(creatures),
  ...potions,
];

export const SPRITE_IDS = new Set(SPRITES.map((s) => s.id));
