# Art Pipeline: art as code

There is no image-model API in this project, so every pixel is authored as code, reviewed in screenshots, and reproducible from source. Nothing needs an art app.

## Art direction

Cozy medieval fantasy: a mystical wooded town where folk live in great hollowed trees, somewhere between the Shire and Stardew Valley. Warm, playful, lamplit, never modern (no boxy houses, glass towers, neon). Think round doors and windows, living wood, roots, moss, mushrooms, drying herbs, candle-jar lanterns, rope bridges, fireflies, moonlight.

The look is modern "16-bit-plus" pixel art, like Stardew: chunky whole pixels at a 640×360 base, but a rich palette with hue-shifted ramps, ordered dithering, and soft light glows. Not literal 8-bit.

Lighting rules (from the reference art Jacob shared):
- Shadows are deep violet-navy, never grey or black.
- Midtones are warm wood and dusty mauve; highlights are warm lamplight cream and amber.
- Night outside is cool blue-violet; inside is warm. That warm/cool contrast is the cozy feeling.
- Small saturated accents (ivy greens, flower pinks, potion glass) sit on top of the muted base.
- Scenes shade surfaces from light sources via `Pixmap.shade(x, y, ramp, t)` (ordered dither between ramp steps) and add soft additive glows (`fx/glow`) over lanterns.

## Three kinds of art

| Kind | Where | How it's made | Used for |
|---|---|---|---|
| **Sprite grids** | `src/art/sprites/*.ts` | 16×16 grids of palette keys, one string per row, written by hand (by Claude). `recolor()` makes tinted variants. | Ingredients, tinctures, potions, familiars, small portraits |
| **Procedural** | `src/art/procedural.ts`, `src/art/scenes/*.ts` | Deterministic drawing code on a palette-locked `Pixmap` (rects, ellipses, Bayer dither, outlines, seeded scatter). | Card frames and backs, cauldrons, pips, backgrounds, UI panels, particles |
| **Baked composites** | `src/view/card.ts` | Procedural frame + sprite at 2× + crisp text, baked into one texture per card at boot. | Card faces (and later: order tickets, stall signs) |

All three share one palette (`src/art/palette.ts`). Nothing off-palette can ship: `tests/art.test.ts` checks every sprite and procedural texture.

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
2. `pnpm snap art` screenshots the in-game art sheet; `pnpm art:sheet` renders the same without a browser; `pnpm render-texture bg/shop 2` renders one procedural texture (fast loop for backgrounds).
3. Claude looks at the PNG, fixes what reads badly, and repeats. Jacob reviews snaps in the PR.

## Adding art for a new card

1. Add the card to `src/codex/content.ts`.
2. Add a 16×16 grid named after its id in `src/art/sprites/` and export it.
3. `pnpm test && pnpm art:check && pnpm snap art hand`, then look at the snaps.

## Static art made in chat

Larger illustrations (title art, backgrounds, portraits) can also be drafted in a Claude conversation as grids or procedural code and pasted in. Same rules: palette keys only, reviewed by snap.

## Audio

Same spirit later (M5): small SFX set synthesised in code (Web Audio: bubbles, plops, chimes, coin clinks) plus CC0 or self-made loops, tracked with sources and licences in `docs/audio.md`.
