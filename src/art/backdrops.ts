// Painted backdrops imported from larger images with `pnpm art:import` (see docs/art-pipeline.md).
// Each one lists where its light sources and surfaces are, so scenes can add glows and place props.

export type Backdrop = {
  /** Path under public/. */
  file: string;
  /** Where the source image came from and how it was imported, so it can be redone. */
  source: string;
  /** Lamp centres in 640x360 coordinates, for additive glows. */
  lights: readonly { x: number; y: number; scale: number }[];
  /** y of the counter's top edge, where props stand. */
  counterTop: number;
};

export const BACKDROPS = {
  shop: {
    file: 'backdrops/shop.png',
    source: 'Elmbrook 1.0 Midjourney shop grid (a3beaf1a), panel 0: pnpm art:import <image> shop --grid 2 --panel 0',
    lights: [
      { x: 247, y: 36, scale: 0.9 },
      { x: 452, y: 36, scale: 0.9 },
    ],
    counterTop: 222,
  },
} as const satisfies Record<string, Backdrop>;

export type BackdropId = keyof typeof BACKDROPS;
