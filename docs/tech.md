# Technical Design

Goal: a codebase Claude Code can build, run, test, see and tune end to end, with no game-editor GUI. Jacob should only ever need a browser.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | One language for game, tools and tests. |
| Engine | Phaser (latest stable at scaffold time) | Mature 2D web engine, huge docs/training data, tweens/particles/sound built in. |
| Build/dev | Vite | Sub-second hot reload. |
| Packages | pnpm | Fast, strict lockfile. |
| Unit tests | Vitest | Fast, Vite-native. |
| E2E + screenshots | Playwright (Chromium) | Claude drives the real game and looks at it. |
| Fonts | Pixelify Sans, Silkscreen (OFL, `@fontsource`) | Pixel fonts with no external requests. |
| Data validation | Zod | Content files are checked at build and test time. |
| Dialogue | Ink via inkjs | Plain-text narrative scripts, compiled in the build (inkjs ships a compiler). |
| Desktop (later) | Tauri | Small native wrapper for Steam builds. |
| CI | GitHub Actions | typecheck, test, build, deploy preview. |

## Repo layout

This repo is the card game only. The codex is kept self-contained in `src/codex` so it can be extracted into a shared package when the shop-sim game starts.

```
elmbrook-card-game/
  CLAUDE.md
  docs/                gdd.md, tech.md, art-pipeline.md, milestones.md
  src/
    core/              PURE rules engine. No Phaser, no DOM, no Math.random (lint-enforced).
    codex/             world data: zod schemas + content tables (shared with the sibling game later)
    art/               palette, sprite grids, procedural generators, Pixmap raster
    view/              Phaser game objects: cards, crisp text, (later) panels and HUD
    scenes/            Boot, Title, Hand (M0 demo), ArtSheet; Run, Calendar, NightMarket later
    debug/             URL params, fixtures loader, window hook
    store.ts           holds RunState, dispatches actions through core
    main.ts            Phaser config, integer zoom
  fixtures/*.json      states/scenes for snaps and tests
  scripts/             snap.ts, art-sheet.ts, art-check.ts, sim.ts (M1)
  tests/               vitest
```

## Core architecture (the most important rule)

The rules engine is a pure, deterministic state machine:

```ts
reduce(state: RunState, action: Action): { state: RunState; events: GameEvent[] }
```

- **State** is plain serialisable data (no class instances, no Phaser objects). Save files and fixtures are just `RunState` JSON.
- **Actions** are player intents: `selectOrder`, `slotCard`, `brew`, `discard`, `deliver`, `decline`, `pickReward`, `chooseErrand`, `buy`, ...
- **Events** describe what happened, in order, for the view to animate: `cardDrawn`, `potencyAdded`, `harmonyMultiplied`, `familiarTriggered`, `potionBrewed`, `orderFulfilled`, `rentPaid`, ...
- **Randomness** comes only from a seeded RNG stored in state (e.g. a small PCG/xorshift; store the seed/state, never call `Math.random`). Same seed + same actions = same run, always.
- **Scoring** is a pipeline of small pure functions in the resolution order defined in GDD §6.3, each emitting events.
- **Content is data.** Card/familiar/patron effects are data-described where possible; when code is needed, effects are registered by ID in an effects table, never special-cased in scenes.

The Phaser layer never mutates game rules. It dispatches actions, receives `{state, events}`, and plays the events as animations, then settles to render `state`.

Why this matters for agentic dev: Claude can test every rule headlessly in milliseconds, run thousands of simulated runs for balance, and reproduce any bug from a seed + action log.

## Debug and verification harness

Built in M0 and kept working forever.

- **URL params** in dev: `?fixture=<name>` loads `fixtures/<name>.json` straight into the right scene; `?seed=<n>` starts a fresh run with that seed; `?speed=10` speeds animations; `?noanim=1` skips them.
- **Window hook** in dev: `window.__elmbrook = { getState, dispatch, events$ }` so Playwright can drive the game deterministically without pixel-clicking.
- **`pnpm snap <fixture...> [--out path]`** opens each fixture in headless Chromium at 1280×720 (2× zoom), waits for the scene to report ready, writes a PNG to `.snaps/`, and fails on any console error. Claude reads the PNG to check its own visual work. Uses `/opt/pw-browsers/chromium` or `CHROMIUM_PATH` when present.
- **`pnpm snap:all`** snaps every fixture; used for visual review and as optional screenshot regression in CI.
- **`pnpm sim --runs 2000 --strategy greedy`** plays full runs headlessly with simple bot strategies and prints: win rate, rent-failure week histogram, average quality per week, most/least picked cards, gold curve. Balance changes should come with a before/after sim report.
- **Dev overlay** (backtick key): current seed, state inspector, buttons to add gold, draw specific cards, jump to any day.
- **Action log export**: any run can be saved as `{seed, actions[]}` and replayed. Bug reports = a replay file.

## Rendering

- Base resolution **640×360** in world units. The canvas is 640×360 × the largest whole-number zoom that fits the window, and every scene's camera zooms by that factor (`pixelCamera`). Pixel art stays crisp (`pixelArt`, `roundPixels`) while text renders at screen resolution. A window resize that changes the zoom reloads the page.
- One pixel font with an open licence for UI text, rendered at integer sizes.
- "Juice" comes from code, not art: tweens for card hover/lift/wobble, squash-and-stretch on brew, number pops, particles for bubbles and sparkles, screen shake on big scores. This keeps the art list small and code-authorable (static sprites only for v1; see art-pipeline.md).
- Card faces are baked at boot into one texture per card id at screen resolution: procedural frame + 16×16 icon at 2× + essence pips + sharp text. Only the icon is unique art per card. Cards are 56×76.
- WebGL `maxTextures` is set to 1. Phaser 4.2's multi-texture batching corrupted rotated sprites under software WebGL (SwiftShader, which CI and snaps use). Revisit once textures are packed into an atlas (`?maxtex=-1` to compare).

## Persistence

- Meta-progression (codex, regulars' hearts, unlocks, settings) in a versioned save object with migrations, stored in `localStorage` on web and a file under Tauri.
- Mid-run save = current `RunState` (resume after closing the tab).

## Preview workflow

1. **Default:** `pnpm dev`, then open the URL in VS Code's Simple Browser (Command Palette → "Simple Browser: Show") next to the Claude Code panel. It hot-reloads on every save.
2. **Claude's eyes:** `pnpm snap` + reading the PNG; Playwright scripts for flows.
3. **Optional terminal pane (M6+):** a Claude Code mod in `tools/preview-mod/` that runs the dev build in headless Chromium, streams frames into a side pane via the mod API's `Image` element and `$.ui.blit`, and forwards keys/clicks. Works in image-capable terminals (Ghostty, kitty, iTerm2, WezTerm), not in the VS Code or desktop surfaces today. Nice-to-have, not on the critical path.

## Shipping

- **Web:** `pnpm build` → static site. Deploy to itch.io (butler) or GitHub Pages from CI.
- **Desktop/Steam (later):** Tauri wrapper around the same build; Steamworks integration (achievements) via a Tauri plugin when we get there.

## Conventions

- `pnpm typecheck && pnpm test` must pass before a task is done.
- No `any`. Content is validated by zod at test time; invalid content fails CI.
- Every new screen or major UI state gets a fixture and a snap.
- Every scene calls `markReady(this)` once fully drawn, so snaps never catch half-built frames.
- Every bug fix gets a regression test (core) or a replay/fixture test (view).
- Keep the core free of Phaser imports (enforce with an ESLint `no-restricted-imports` rule).
