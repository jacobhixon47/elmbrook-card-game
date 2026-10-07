# Art Pipeline: art as code

There is no image-model API in this project, so almost every pixel is authored as code, reviewed in screenshots, and reproducible from source. The exception is large painted backdrops, which are pixelized from Midjourney renders (see "Painted backdrops" below). Nothing needs an art app.

## Art direction

Cozy but mysterious medieval fantasy, leaning into whimsical magic and wizardry: Elmbrook is a small forest town under snow-capped mountains, seen on moonlit nights. Fieldstone cottages with thick thatched roofs, smoke curling from chimneys, ivy and moss creeping over walls, warm lit windows, cobbled paths, drystone walls, lantern posts, fireflies and glowing mushrooms. Inside: timber beams, stone walls, shelves crowded with bottles, drying herbs, brass lanterns. Never modern (no boxy houses, glass towers, neon). The Midjourney art from Elmbrook 1.0 is the reference for mood and richness: layered, textured, softly lit, alive.

The look is modern "16-bit-plus" pixel art, like Stardew: chunky whole pixels at a 640×360 base, but a rich palette with hue-shifted ramps, ordered dithering, and soft light glows. Not literal 8-bit.

Lighting rules (from the reference art Jacob shared):
- Shadows are deep violet-navy, never grey or black.
- Midtones are warm wood and dusty mauve; highlights are warm lamplight cream and amber.
- Night outside is cool blue-violet; inside is warm. That warm/cool contrast is the cozy feeling.
- Small saturated accents (ivy greens, flower pinks, potion glass) sit on top of the muted base.
- Scenes shade surfaces from light sources via `Pixmap.shade(x, y, ramp, t)` (ordered dither between ramp steps) and add soft additive glows (`fx/glow`) over lanterns.

## Four kinds of art

| Kind | Where | How it's made | Used for |
|---|---|---|---|
| **Sprite grids** | `src/art/sprites/*.ts` | 16×16 grids of palette keys, one string per row, written by hand (by Claude). `recolor()` makes tinted variants. | Ingredients, tinctures, potions, familiars, small portraits |
| **Procedural** | `src/art/procedural.ts`, `src/art/scenes/*.ts` | Deterministic drawing code on a palette-locked `Pixmap` (rects, ellipses, Bayer dither, outlines, seeded scatter, value noise from `src/art/noise.ts` for stone, wood, thatch and grass grain). Shared town pieces (cottages, mountains, pines, sky) live in `src/art/scenes/town.ts`. | Card frames and backs, cauldrons, pips, backgrounds, UI panels, particles |
| **Painted backdrops** | `public/backdrops/*.png`, listed in `src/art/backdrops.ts` | A Midjourney render (or other painting) cropped and pixelized by `pnpm art:import`: 640×360, about 48 colours, no dither. | Full-screen backgrounds: the shop, later the Night Market and town |
| **Baked composites** | `src/view/card.ts` | Procedural frame + sprite at 2× + crisp text, baked into one texture per card at boot. | Card faces (and later: order tickets, stall signs) |

Sprites, procedural art and baked cards share one palette (`src/art/palette.ts`), and nothing off-palette can ship: `tests/art.test.ts` checks every sprite and procedural texture. Painted backdrops keep their own reduced colours; the code-drawn art on top of them should still read as the same world.

## Painted backdrops

Code can't match the painterly depth of a full scene, so big backgrounds are painted (Jacob's Midjourney renders, from 1.0 or new) and pixelized:

```
pnpm art:import <image> <name> [--grid 2 --panel 0] [--colors 48] [--focus 0.5,0.5]
```

The script picks one panel of a Midjourney 2×2 grid, trims letterbox bars, crops to 16:9 around the focus point, downsizes to 640×360 with Lanczos and reduces to a small palette with no dither. It writes `public/backdrops/<name>.png` and a 2× preview to `.snaps/backdrop-<name>.png`.

Then add the backdrop to `src/art/backdrops.ts` with its source (so it can be redone), its lamp positions (for additive glows) and any surfaces props stand on, such as `counterTop`. Scenes read layout from there, never hard-coded. Keep originals out of the repo; only the pixelized PNG ships. A test checks every listed backdrop exists at 640×360.

### Windows that change with the season

A backdrop with a window can have its outside view cut out at import: `--window x,y[;x,y] --bbox x0,y0,x1,y1` flood-fills from the seed points over sky- and valley-coloured pixels, fills enclosed specks (stars, moon), and writes the room with a transparent hole plus `<name>-view.png`. The manifest's `view` entry gives the sky's rows and the window area.

At runtime `gradeView` (`src/art/window.ts`, pure) regrades the painted view: the land is remapped onto a season ramp (spring green and blossom, summer deep green, autumn rust and gold, winter snow), the sky onto a time-of-day gradient (golden afternoon, sunset, twilight with the first stars), and night keeps the painted stars and moon. Summer at night is the original painting. Weather (rain, fog, heatwave, snow) then leans everything toward an air colour, farther land first, with fog in rolling bands; rain, fog and snow hide the stars. Seasonal and weather particles (`src/view/weather.ts`: blossom, fireflies, leaves, flurries, rain streaks, fog banks, heat motes, heavy snow) drift between the view and the room, so the window frame hides them. Tune colours with `pnpm art:window`, which renders every season × time and weather × time to two sheets.

Code-drawn backdrops (`bg/shop`, `bg/night`) stay as fallbacks and for screens without a painting yet; `?backdrops=code` shows them. The title town is code-drawn until there is a painted village to import.

Prompting new backdrops: wide 16:9, "cozy pixel art, moonlit, stone and thatch, medieval fantasy, whimsical magic", with the middle and bottom third kept calm, because cards and the cauldron sit there.

## Palette

~40 colours with single-character keys, sampled from the reference art and organised into ramps (`RAMPS` in `src/art/palette.ts`: brick, wood, night, sky, ivy, floor, iron). `k` is the outline (dark violet), `w` parchment, `y`/`Y` lamplight, `G` leaf, `U` water, `P` violet, `m` moonlight. Each essence has a colour (`ESSENCE_COLOR`). Adding a colour is a deliberate design change: add it to the palette and to this doc.

The one exception to palette-locking is light: `fx/glow` is a smooth radial gradient drawn additively, because light in the reference is soft.

## Sprite rules

- 16×16 for icons, shown 1× in lists and 2× on cards. Portraits (M4) are 32×32 grids.
- 1px outline with `k` (never pure black); light from the top-left; one highlight pixel (`W`) on shiny things.
- Readable silhouette first, detail second. If it doesn't read at 1×, simplify.
- Variants via `recolor()` (potions are one bottle grid tinted 8 ways), not copy-paste.

## Text

Like Stardew, text is sharper than the art. The game renders at screen resolution (640×360 × a whole-number zoom) and every camera zooms the world, so pixel art stays chunky while text (`pixelText`, and the text baked into card faces) is drawn at full screen resolution. Fonts: Pixelify Sans for body, Silkscreen for display (both OFL, from `@fontsource`).

## Motion

No sprite-sheet animation in v1. Motion comes from code: tweens (bob, lift, squash), particles (bubbles, sparkles), palette tints, and screen shake.

## Review loop

1. `pnpm art:check` validates every grid and lists which codex cards are still placeholders (the red X tile).
2. `pnpm snap art` screenshots the in-game art sheet; `pnpm render-texture bg/night 2` renders the title town; `pnpm art:sheet` renders the same without a browser; `pnpm render-texture bg/shop 2` renders one procedural texture (fast loop for backgrounds).
3. Claude looks at the PNG, fixes what reads badly, and repeats. Jacob reviews snaps in the PR.

## Adding art for a new card

1. Add the card to `src/codex/content.ts`.
2. Add a 16×16 grid named after its id in `src/art/sprites/` and export it.
3. `pnpm test && pnpm art:check && pnpm snap art hand`, then look at the snaps.

## Static art made in chat

Larger illustrations (title art, backgrounds, portraits) can also be drafted in a Claude conversation as grids or procedural code and pasted in. Same rules: palette keys only, reviewed by snap.

## Audio

Same spirit later (M5): small SFX set synthesised in code (Web Audio: bubbles, plops, chimes, coin clinks) plus CC0 or self-made loops, tracked with sources and licences in `docs/audio.md`.
