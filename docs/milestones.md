# Milestones

Each milestone ends with something Jacob can open in a browser. "Done" = acceptance criteria met, `pnpm typecheck && pnpm test` green, and snaps of new screens reviewed.

## Where we are

- **M0** ✅ scaffold and art pipeline (PR #1, which also brought the painted backdrops and the season/time/weather shop window).
- **M1** ✅ rules engine (PR #2). Greedy bot wins 29.7% of 2,000 Spring runs, inside the 15-35% band; 99%+ line coverage on `src/core`.
- **M2** ✅ playable day (PR #3): the Run scene plays a whole Spring run in the browser. `pnpm e2e` plays week 1 through the UI in CI.
- **M2.5** ✅ player guidance (PR #4): card inspect tooltips, the Grimoire, the stage ribbon and the first-run tutorial (GDD §15.1).
- **M3** in progress, one PR per part: (1) content from the balance tables ✅ (PR #5), (2) Calendar ✅ (PR #6), (3) Night Shifts, patrons, Satchel and Lunar cards ✅ (PR #8), (4) Night Market stalls ✅ (PR #9), (5) familiars, relics and curses, card modifiers (cauldrons move to M4's run starts), (6) Creek, Guild Commissions, dusk events and resuming a run. Part 5 lands in three PRs: familiars first (all 20, the familiar row, buying and selling), then relics, curses and the Name-Taker, then card modifiers.

## M0 — Scaffold and harness ✅

- Vite + Phaser 4 + TypeScript (strict), 640×360 integer zoom.
- `src/codex` with zod schemas and the GDD §14 starter content.
- Seeded RNG; core `reduce` with `startRun`.
- Debug harness: `?fixture=`, `?seed=`, `?noanim=1`, `window.__elmbrook`, `markReady`.
- Art as code: palette, 15 sprite grids, procedural frames/cauldron/backdrop, baked card faces with crisp text.
- Scenes: Title, Hand (seeded opening hand, since replaced by Run in M2), ArtSheet.
- `pnpm snap`, `pnpm snap:all`, `pnpm art:check`, `pnpm art:sheet`. ESLint keeps core pure. GitHub Actions CI.

**Accept:** `pnpm dev` shows the title screen; `pnpm snap title` writes a PNG; CI green.

## M1 — Rules engine (headless) ✅

- Deck: draw, hand size, discard, reshuffle. Orders, Brews/Discards per day.
- Cauldron slots, recipe matching by essence pattern, Experiments, Sludge.
- Scoring pipeline with full event stream (GDD §6.3), quality tiers, pay and tips.
- Shelf, deliver/decline, hearts. Day → dusk reward (with skip pity) → errands (Market, Forage, Hearth only).
- Week structure and rent; run loss/win.
- `season` in run state (Spring only for now) and the season twist hook.
- `pnpm sim` with a greedy bot; prints the report from `tech.md`.
- Dev overlay (backtick): seed, state inspector, add gold, jump to day.

**Accept:** ≥90% coverage on `src/core`; 2,000 simulated runs finish without errors; a greedy bot wins some but not most runs (target 15-35% to start).

## M2 — Playable day (vertical slice) · in review

- Run scene: Order Board, order dialogue (Fulfill / Decline / Back), hand, cauldron panel with preview, Shelf.
- Scoring animation playing the event stream, with juice (tweens, number pops, bubbles).
- Dusk reward pick and errand choice.
- Fixtures + snaps for each state.

**Accept:** Jacob can play the days of week 1 in the browser with mouse and keyboard and it feels good.

## M2.5 — Player guidance

- Card inspect tooltips with a glossary of game terms.
- The Grimoire: known and undiscovered recipes, the deck and draw pile, a rules guide.
- Stage ribbon (days of the week, steps of the day) and a clear line on every evening screen.
- Mandatory first-run tutorial over week 1 on a fixed seed; `?tutorial=0` and the dev overlay skip it.

**Accept:** someone who has never seen the game finishes week 1 without being told anything outside the game.

## M3 — Full run

- Calendar scene (run map), seeded at run start: daily weather, town events, the week-3 festival, rare sky events, next patron preview (GDD §4.2).
- Night customers (GDD §4.1).
- Night Shifts with patron twists (all 7), Night Satchel, Lunar cards.
- Night Market with all 6 stalls and their odd currencies.
- Familiars, cauldrons, card modifiers, tinctures, remaining errands (Creek, Guild Commissions, Events: first 8).
- Resume mid-run (game over and victory screens shipped in M2).

**Accept:** a full 20-encounter run is playable start to finish; sim win rate for greedy bot within target band; balance report checked in.

## M4 — Meta and story

- Codex screen; persistent save with migrations.
- The Year: season unlocks (Summer, Autumn, Winter content and twists), Year modifiers.
- Reputation and Guild Hall perks; Almanac achievements that unlock pool content.
- Six regulars with hearts, Ink dialogue, heart-milestone beats and unlocks.
- Witch and cauldron selection; unlock flow.

**Accept:** a second run feels different from the first because of unlocks and regulars' stories.

## M5 — Art and audio pass

- Author sprite grids for every codex card (`art:check` shows 0 placeholders); portraits for regulars and patrons.
- Backdrops for every scene (painted where possible, see art-pipeline.md): Night Market street, Calendar, Guild Hall. The shop window already regrades by season and time of day.
- Art sheet reviewed for consistency.
- SFX and music loops wired in, with volume settings.

**Accept:** no placeholders remain; the art sheet looks like one artist.

## M6 — Ship prep

- Tutorial tips for the M3+ systems, tooltips on anything new since M2.5, settings menu (volume, fullscreen, scale), achievements (10).
- Endless, Daily seed, Challenge runs.
- itch.io deploy from CI; Tauri desktop build.
- Optional: Claude Code terminal preview mod.

**Accept:** a friend can play the itch build without help.

## After launch

- Long Year mode (GDD §13): all four seasons as one run, with mid-run saves.
