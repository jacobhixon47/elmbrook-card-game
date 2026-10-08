import { recolor, type SpriteDef } from '../sprite';
import type { PaletteKey } from '../palette';

// One bottle grid, tinted per potion family. 'R' is the liquid, 'r' its shadow.
export const potionBase: SpriteDef = {
  id: 'potion/base',
  rows: [
    '................',
    '......kkkk......',
    '......knnk......',
    '......kBBk......',
    '.......kk.......',
    '......kwwk......',
    '.....kwRRRk.....',
    '....kwRRRRRk....',
    '....kRRWRRRk....',
    '....kRWRRRRk....',
    '....kRRRRRrk....',
    '.....krrrrk.....',
    '......kkkk......',
    '................',
    '................',
    '................',
  ],
};

const TINTS: Record<string, [PaletteKey, PaletteKey]> = {
  healing: ['R', 'r'],
  warming: ['o', 'r'],
  calming: ['U', 'u'],
  vigor: ['y', 'o'],
  protection: ['S', 's'],
  secrets: ['P', 'p'],
  fortune: ['l', 'G'],
  lunar: ['m', 'v'],
};

export const potions: SpriteDef[] = Object.entries(TINTS).map(([family, [main, shade]]) =>
  recolor(potionBase, `potion/${family}`, { R: main, r: shade }),
);
