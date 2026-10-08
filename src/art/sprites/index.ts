import type { SpriteDef } from '../sprite';
import * as ingredients from './ingredients';
import { potions } from './potions';

/** Every hand-authored sprite in the game, keyed by texture id. */
export const SPRITES: readonly SpriteDef[] = [...Object.values(ingredients), ...potions];

export const SPRITE_IDS = new Set(SPRITES.map((s) => s.id));
