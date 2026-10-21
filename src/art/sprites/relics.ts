import type { SpriteDef } from '../sprite';

// 16x16 relic icons (`relic/<id>`). A relic without one shows its tier's medallion token.
// Light comes from the top-left; outlines use 'k', never pure black.

/** A grey stone mortar, herbs in the bowl, with a wooden pestle leaning out to the top right. */
export const mortarAndPestle: SpriteDef = {
  id: 'relic/mortar-and-pestle',
  rows: [
    '................',
    '............kk..',
    '...........knnk.',
    '..........knBk..',
    '.........knBk...',
    '........knBk....',
    '.......knBk.....',
    '...kkkknBkkkk...',
    '..keqqnBBqGlSk..',
    '..kWeeeSSSSSsk..',
    '..kSeSSSSSSssk..',
    '...kSeSSSSssk...',
    '...kSSSSSsssk...',
    '....kSSssssk....',
    '...kSSSSssssk...',
    '....kkkkkkkk....',
  ],
};
