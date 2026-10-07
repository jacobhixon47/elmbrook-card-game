# Art Pipeline: art as code

There is no image-model API in this project, so every pixel is authored as code, reviewed in screenshots, and reproducible from source. Nothing needs an art app.

## Three kinds of art

| Kind | Where | How it's made | Used for |
|---|---|---|---|
| **Sprite grids** | `src/art/sprites/*.ts` | 16×16 grids of palette keys, one string per row, written by hand (by Claude). `recolor()` makes tinted variants. | Ingredients, tinctures, potions, familiars, small portraits |
| **Procedural** | `src/art/procedural.ts` | Deterministic drawing code on a palette-locked `Pixmap` (rects, ellipses, Bayer dither, outlines, seeded scatter). | Card frames and backs, cauldrons, pips, backgrounds, UI panels, particles |
| **Baked composites** | `src/view/card.ts` | Procedural frame + sprite at 2× + crisp text, baked into one texture per card at boot. | Card faces (and later: order tickets, stall signs) |

All three share one palette (`src/art/palette.ts`). Nothing off-palette can ship: `tests/art.test.ts` checks every sprite and procedural texture.

## Palette

24 colours with single-character keys (`k` outline, `w` parchment, `G` leaf, `U` water, `P` violet, `m` moonlight, ...). Each essence has a colour (`ESSENCE_COLOR`). Adding a colour is a deliberate design change: add it to the palette and to this doc.

## Sprite rules

- 16×16 for icons, shown 1× in lists and 2× on cards. Portraits (M4) are 32×32 grids.
- 1px outline with `k` (never pure black); light from the top-left; one highlight pixel (`W`) on shiny things.
- Readable silhouette first, detail second. If it doesn't read at 1×, simplify.
- Variants via `recolor()` (potions are one bottle grid tinted 8 ways), not copy-paste.

## Text

Web pixel fonts (Pixelify Sans for body, Silkscreen for display; both OFL, from `@fontsource`). Text baked into card faces goes through `drawCrispText`, which snaps antialiased edges to fully on/off so it stays pixel-crisp. Live HUD text uses `pixelText`. A hand-authored bitmap font is a candidate for M2 if 8px legibility isn't good enough.

## Motion

No sprite-sheet animation in v1. Motion comes from code: tweens (bob, lift, squash), particles (bubbles, sparkles), palette tints, and screen shake.

## Review loop

1. `pnpm art:check` validates every grid and lists which codex cards are still placeholders (the red X tile).
2. `pnpm snap art` screenshots the in-game art sheet; `pnpm art:sheet` renders the same without a browser.
3. Claude looks at the PNG, fixes what reads badly, and repeats. Jacob reviews snaps in the PR.

## Adding art for a new card

1. Add the card to `src/codex/content.ts`.
2. Add a 16×16 grid named after its id in `src/art/sprites/` and export it.
3. `pnpm test && pnpm art:check && pnpm snap art hand`, then look at the snaps.

## Static art made in chat

Larger illustrations (title art, backgrounds, portraits) can also be drafted in a Claude conversation as grids or procedural code and pasted in. Same rules: palette keys only, reviewed by snap.

## Audio

Same spirit later (M5): small SFX set synthesised in code (Web Audio: bubbles, plops, chimes, coin clinks) plus CC0 or self-made loops, tracked with sources and licences in `docs/audio.md`.
