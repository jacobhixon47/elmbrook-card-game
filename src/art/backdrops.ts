// Painted backdrops imported from larger images with `pnpm art:import` (see docs/art-pipeline.md).
// Each one lists where its light sources and surfaces are, so scenes can add glows and place props.

export type Backdrop = {
  /** Path under public/. */
  file: string;
  /** Where the source image came from and how it was imported, so it can be redone. */
  source: string;
  /** Lamp centres in 640x360 coordinates, for additive glows. */
  lights: readonly { x: number; y: number; scale: number }[];
  /** y of the counter's top edge, where props stand (shop scenes). */
  counterTop?: number;
  /** The view through a window, cut out by `art:import --window` and regraded by season and time of day. */
  view?: { file: string; skyTop: number; horizon: number; area: { x0: number; y0: number; x1: number; y1: number } };
};

export const BACKDROPS = {
  shop: {
    file: 'backdrops/shop.png',
    source: 'Elmbrook 1.0 Midjourney shop grid (a3beaf1a), panel 0: pnpm art:import <image> shop --grid 2 --panel 0 --window "320,60;380,120;300,140" --bbox 150,18,500,224',
    lights: [
      { x: 247, y: 36, scale: 0.9 },
      { x: 452, y: 36, scale: 0.9 },
    ],
    counterTop: 222,
    view: { file: 'backdrops/shop-view.png', skyTop: 24, horizon: 150, area: { x0: 150, y0: 18, x1: 500, y1: 224 } },
  },
  title: {
    file: 'backdrops/title.png',
    source: 'Elmbrook 1.0 Midjourney firefly-jar grid (3f40becf), panel 2: pnpm art:import <image> title --grid 2 --panel 2',
    lights: [{ x: 160, y: 268, scale: 1.1 }],
  },
  cottage: {
    file: 'backdrops/cottage.png',
    source: 'Elmbrook 1.0 Midjourney grid 907c1bd3 (inventory ref H), panel 0: pnpm art:import <image> cottage --grid 2 --panel 0 --focus 0.5,0.55',
    lights: [{ x: 300, y: 262, scale: 1.2 }],
  },
} as const satisfies Record<string, Backdrop>;

export type BackdropId = keyof typeof BACKDROPS;
