import type { SpriteDef } from '../sprite';

// 16x16 Tincture icons (fair). Shown 1x in lists and 2x on cards.
// Light comes from the top-left; outlines use 'k', never pure black.

export const beeswaxCandle: SpriteDef = {
  id: 'tincture/beeswax-candle',
  rows: [
    '.......kk.......',
    '......kYYk......',
    '.....kYWYyk.....',
    '.....kyYyok.....',
    '......koyk......',
    '....kkkkbkkk....',
    '....kYyyyyok....',
    '....kWoyoyok....',
    '....kyyoyyok....',
    '....kYoyoyok....',
    '....kyyoyyok....',
    '....kYoyoyok....',
    '....kyyoyyok....',
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnBBk..',
    '...kkkkkkkkkk...',
  ],
};

export const springMead: SpriteDef = {
  id: 'tincture/spring-mead',
  rows: [
    '................',
    '.....kkkkk......',
    '....kYyyyok.kk..',
    '....kkhHhkkkIIk.',
    '.....khHhk.kIWIk',
    '....kkhHhkk.kIk.',
    '...khHHHhhhkkkk.',
    '..khHaHHHhhhkhk.',
    '..khaHHHHhhhk.hk',
    '..kHHyyyyyhjk.hk',
    '..kHHyYyyohjkkhk',
    '..khHyyyoohjkhk.',
    '..khHHHHhhhjkk..',
    '...khhhhhhjjk...',
    '....kkkkkkkk....',
    '................',
  ],
};

export const garland: SpriteDef = {
  id: 'tincture/garland',
  rows: [
    '.....kkkkkk.....',
    '....kGlIlGlk....',
    '..kkGlIWIlGWkk..',
    '..kGlGlIlGWyWk..',
    '.kGlGlGkkGlWlGk.',
    '.kIGlGk..kGlGlk.',
    'kIWIGk....kGIlGk',
    'kGIlGk....kIWIgk',
    'kGlGgk....kGIGgk',
    '.kGGWgk..klGggk.',
    '.kGWyWgkkGIgGgk.',
    '..kgWgGggIWIgk..',
    '..kkgRRkkRRgkk..',
    '....kRrRRrRk....',
    '....kRk..kRk....',
    '.....k....k.....',
  ],
};

export const fireflyJar: SpriteDef = {
  id: 'tincture/firefly-jar',
  rows: [
    '............L...',
    '.....kkkkkk.....',
    '.....knBnBk.....',
    '.....kBbBbk.....',
    '....kkkkkkkk....',
    '....kcmmmmuk....',
    '...kWzzzzzzuk...',
    '...kczzlzzzuk...',
    '...kczlYlzzuk...',
    '...kczzlzlzuk...',
    '...kczzzlYluk...',
    '...kclzzzlzuk...',
    '...klYlzzzzuk...',
    '...kczlzzzzuk...',
    '....kkkkkkkk....',
    '................',
  ],
};

export const sunBottle: SpriteDef = {
  id: 'tincture/sun-bottle',
  rows: [
    '................',
    '......kkkk......',
    '......knBk......',
    '......kkkk......',
    '......kcuk......',
    '....kkWcuukk....',
    '...kcuuYYuuuk...',
    '..kcYuuyyuuYuk..',
    '..kcuuyYYouuuk..',
    '.kcYYyYWYYoYYuk.',
    '.kcuuyYYYyouuuk.',
    '..kcYuooouuYuk..',
    '..kcuuuYYuuuuk..',
    '...kcuuuuuuuk...',
    '....kkkkkkkk....',
    '................',
  ],
};

export const prism: SpriteDef = {
  id: 'tincture/prism',
  rows: [
    '................',
    '.......kk.......',
    '......kWck......',
    '......kmck......',
    '.....kWmcck.....',
    '.....kmmcuk.....',
    '....kWmmccuk....',
    'WWWWkmmmccukRR..',
    '...kmmmWWcuukoRR',
    '...kmmmmmWcukyoR',
    '..kmmmmmccuuukly',
    '..kmmmmccuuuukUl',
    '.kkkkkkkkkkkkkPU',
    '..............PP',
    '...............P',
    '................',
  ],
};

export const paperFan: SpriteDef = {
  id: 'tincture/paper-fan',
  rows: [
    '................',
    '................',
    '................',
    '......kkkk......',
    '...kkkaawwkkk...',
    '..kawwaawwaawk..',
    '.kaaIwaawwawIwk.',
    'kwwIiIwawaaIiIak',
    'kawwIbbBbbwwIawk',
    'kkawwawawawaawkk',
    '..kkkwaawwakkk..',
    '.....kkBBkk.....',
    '......kBBk......',
    '......kRRk......',
    '.......kk.......',
    '................',
  ],
};

export const spicedCider: SpriteDef = {
  id: 'tincture/spiced-cider',
  rows: [
    '...m....m.......',
    '....m..m...kk...',
    '...m....m.knBk..',
    '....m..m.knBk...',
    '........knBk....',
    '..kkkkkknBkk....',
    '..kynooBnook....',
    '..kRRRRRRRrkkk..',
    '..kRWRRRRRrk.Rk.',
    '..kRRRRRRRrk.Rk.',
    '..kwwwwwwwak.Rk.',
    '..kRRRRRRRrkkrk.',
    '..kRRRRRRrrkkk..',
    '...krrrrrrk.....',
    '....kkkkkk......',
    '................',
  ],
};

export const perry: SpriteDef = {
  id: 'tincture/perry',
  rows: [
    '....kkkk........',
    '....knBk........',
    '....kBbk........',
    '...kkkkkk.......',
    '....kLlk........',
    '....kLlk........',
    '...kLlllk.......',
    '..kWLlllGk......',
    '..kLLlllGk...k..',
    '..kwwwwwak..kbk.',
    '..kwwlwwak..kLk.',
    '..kwlLGwak.kLlGk',
    '..kwwlwwakkLllGk',
    '..kLLlllGkkllGGk',
    '..kLlllGGk.kGGk.',
    '...kkkkkk...kk..',
  ],
};

export const mullingSpice: SpriteDef = {
  id: 'tincture/mulling-spice',
  rows: [
    '................',
    '.........kkkkk..',
    '........kaHaHk..',
    '.......kHnHnk...',
    '......kRRRRk....',
    '.....kHnHnk.....',
    '....kHnHnkkk....',
    '...kHnHkkkHkkk..',
    '..kaHaHkHkHkHk..',
    '..kkkkkkkHyHkkk.',
    '.kk...kHHyWyHhk.',
    'kbBk..kkkHyhkkk.',
    '.kbkkk.kHkhkhk..',
    '.kbkbBkkkkhkkk..',
    '..k.kbk..kkk....',
    '.....k..........',
  ],
};
