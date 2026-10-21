import type { SpriteDef } from '../sprite';
import * as ingredients from './ingredients';
import * as creatures from './ingredients-creatures';
import * as flowers from './ingredients-flowers';
import * as harvest from './ingredients-harvest';
import * as minerals from './ingredients-minerals';
import * as hearthFamiliars from './familiars-hearth';
import * as fieldFamiliars from './familiars-field';
import * as nightFamiliars from './familiars-night';
import { potions } from './potions';
import * as relics from './relics';
import * as craft from './tinctures-craft';
import * as fair from './tinctures-fair';
import * as festival from './tinctures-festival';
import * as omens from './tinctures-omens';
import * as regulars from './portraits';
import * as visitors from './portraits-visitors';
import * as patrons from './portraits-patrons';
import * as seasonalPatrons from './portraits-patrons-seasonal';
import * as nightCustomers from './portraits-night';

/** Every hand-authored sprite in the game, keyed by texture id. */
export const SPRITES: readonly SpriteDef[] = [
  ...Object.values(ingredients),
  ...Object.values(flowers),
  ...Object.values(harvest),
  ...Object.values(minerals),
  ...Object.values(creatures),
  ...Object.values(craft),
  ...Object.values(fair),
  ...Object.values(festival),
  ...Object.values(omens),
  ...Object.values(hearthFamiliars),
  ...Object.values(fieldFamiliars),
  ...Object.values(nightFamiliars),
  ...potions,
  ...Object.values(relics),
];

export const SPRITE_IDS = new Set(SPRITES.map((s) => s.id));

/** 32x32 character portraits (`portrait/<customer id>`), for order tickets, dialogues and the Codex. */
export const PORTRAITS: readonly SpriteDef[] = [
  ...Object.values(regulars),
  ...Object.values(visitors),
  ...Object.values(patrons),
  ...Object.values(seasonalPatrons),
  ...Object.values(nightCustomers),
];

export const PORTRAIT_IDS = new Set(PORTRAITS.map((s) => s.id));
