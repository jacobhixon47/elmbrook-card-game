# Elmbrook: Night Market

A roguelike potion-brewing deckbuilder set in the town of Elmbrook. A sibling Stardew-style shop sim will share its world data (`src/codex`) later.

Read before working: `docs/gdd.md` (what to build), `docs/tech.md` (how), `docs/milestones.md` (in what order), `docs/art-pipeline.md` (art as code).

## Commands

- `pnpm dev`: run with hot reload (open in a browser or VS Code's Simple Browser)
- `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build`; `pnpm test:coverage` checks ≥90% on `src/core`
- `pnpm snap <fixture...>`: screenshot fixtures to `.snaps/<fixture>.png`; `pnpm snap:all` for every fixture. Fixtures reach a state with `steps` (see `src/debug/fixture-steps.ts`) and `ui` (an open dialogue, picked cards)
- `pnpm e2e`: plays week 1 through the real UI in headless Chromium, with animations on
- `pnpm art:check`: validate sprite grids, list cards still on placeholders
- `pnpm art:sheet`: render all art to `.snaps/art-sheet.png` without a browser
- `pnpm art:import <image> <name> [--grid 2 --panel 0]`: pixelize a painted image into `public/backdrops/<name>.png`
- `pnpm art:window`: render the shop window in every season, time of day and weather to `.snaps/window-grades.png` and `.snaps/window-weather.png`
- `pnpm sim --runs <n> [--strategy greedy|random] [--season s]`: headless balance report; `pnpm sim --replay <file>` replays an action log
- Dev overlay: press backtick in the game for seed, state, +gold, jump to day and action-log export

Dev URL params: `?fixture=<name>`, `?seed=<s>`, `?noanim=1`, `?renderer=canvas`, `?backdrops=code` (code-drawn backdrops instead of painted ones), `?season=winter`, `?time=night` and `?weather=snow` (preview the shop window).

## Rules

- `src/core` is pure TypeScript: no Phaser, no DOM, no `Math.random`, no `Date.now` (lint-enforced). Randomness goes through the seeded RNG stored in state.
- Game logic lives in `reduce(state, action) → { state, events }`. Scenes dispatch through `store` and animate events; they never decide rules.
- Content is data in `src/codex`, validated by zod. Effects that need code are registered by id, never special-cased in scenes.
- Art is code (see `docs/art-pipeline.md`): palette keys only, 16×16 sprite grids, procedural generators, baked card faces. The one exception is large painted backdrops: PNGs in `public/backdrops/` made only by `pnpm art:import` and listed in `src/art/backdrops.ts` with their source. No other binary image assets.
- Every scene calls `markReady(this)` when fully drawn. Every new screen or UI state gets a fixture.
- After any visual change: run `pnpm snap` for the affected fixtures and look at the PNGs before calling it done.
- After any balance change (M1+): run `pnpm sim` before and after and include both summaries in the PR.
- Every bug fix gets a regression test or a replay fixture.
- Done = typecheck, lint, tests and `art:check` green, plus snaps reviewed for UI work.
- The repo is public: commit messages, PR descriptions and comments carry no Claude session or project links (no `Claude-Session:` trailer, no claude.ai/code session URLs).
- The GDD is the source of truth for design. If an implementation choice changes design, update the GDD in the same change and say so.
