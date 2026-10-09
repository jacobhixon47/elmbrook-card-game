# Milestones

Each milestone ends with something Jacob can open in a browser. "Done" = acceptance criteria met, `pnpm typecheck && pnpm test` green, and snaps of new screens reviewed.

## Where we are

- **M0** ✅ scaffold and art pipeline (PR #1, which also brought the painted backdrops and the season/time/weather shop window).
- **M1** ✅ rules engine (PR #2). Greedy bot wins 29.7% of 2,000 Spring runs, inside the 15-35% band; 99%+ line coverage on `src/core`.
- **M2** ✅ playable day (PR #3): the Run scene plays a whole Spring run in the browser. `pnpm e2e` plays week 1 through the UI in CI.
- **M2.5** ✅ player guidance (PR #4): card inspect tooltips, the Grimoire, the stage ribbon and the first-run tutorial (GDD §15.1).
- **M3** ✅ full run, one PR per part: content from the balance tables (PR #5), Calendar (PR #6), Night Shifts, patrons, Satchel and Lunar cards (PR #8), Night Market stalls (PR #9), familiars (PR #10), relics, curses and the Name-Taker (PR #11), card modifiers and the Creek Bank (PRs #12, #13), Guild Commissions (PR #17), the first 8 dusk events (PR #15), resuming a run (PR #16), and the closing balance pass (`docs/balance-m3.md`). Cauldrons moved to M4's run starts.

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

## M3 — Full run ✅

- Calendar scene (run map), seeded at run start: daily weather, town events, the week-3 festival, rare sky events, next patron preview (GDD §4.2).
- Night customers (GDD §4.1).
- Night Shifts with patron twists (all 7), Night Satchel, Lunar cards.
- Night Market with all 6 stalls and their odd currencies.
- Familiars, cauldrons, card modifiers, tinctures, remaining errands (Creek, Guild Commissions, Events: first 8).
- Resume mid-run (game over and victory screens shipped in M2).

**Accept:** a full 20-encounter run is playable start to finish; sim win rate for greedy bot within target band; balance report checked in.

## M4 — Meta and story

- ✅ Codex screen (lore lines still to write); ✅ persistent save with migrations (the profile and run migrations, `core/meta.ts`).
- The Year: ✅ season unlocks (a win opens the next season; choose it on the title screen), Summer, Autumn and Winter content and twists, Year modifiers, and looping into the next Year with a boon (GDD §13).
- ✅ Reputation and cottage perks (the cottage: the out-of-run home where you set out for a season and buy perks); ✅ Almanac achievements that unlock pool content, relics included (eight starter relics).
- A tiered perk board for the long game: more perks opening with Years reached and Almanac milestones, about 12 to 15 in all (GDD §13).
- Six regulars with hearts, Ink dialogue, heart-milestone beats and unlocks.
- Witch and cauldron selection; unlock flow.
- ✅ Winter tuned into the win-rate band: week 1's rent is the same in every season and Winter pays ×1.2 (`docs/balance-m4.md`).
- Once meta progression is in: a gentle week-1 rent ramp (20, 22, 24, 26 by season, decided with Jacob) and descending win-rate targets (about 40%, 33%, 27%, 20%), simmed with the unlocks a player would carry into each season. Year modifiers are tuned against an all-perks profile.

**Accept:** a second run feels different from the first because of unlocks and regulars' stories.

## M4.5 — The walkable cottage

Once Reputation, the Almanac, the Codex and witch selection exist, the cottage becomes a small top-down home you walk around (GDD §13, decided with Jacob):
- A simple wizard-robed sprite that walks around one open-plan room.
- Each system has its own corner: perks, Codex and recipes, Almanac, regulars' letters, witch and cauldron.
- The front door leads to choosing the next season.
- The house is dressed for the season you're about to play: light, colours, window views and props.

**Accept:** every between-runs screen is reached by walking to it, and coming home from a win shows the next season in the house.

## M5 — Art and audio pass

- Author sprite grids for every codex card (`art:check` shows 0 placeholders); portraits for regulars and patrons.
- Backdrops for every scene (painted where possible, see art-pipeline.md): Night Market street, Calendar, Guild Hall, the cottage. The shop window already regrades by season and time of day.
- Art sheet reviewed for consistency.
- SFX and music loops wired in, with volume settings.

**Accept:** no placeholders remain; the art sheet looks like one artist.

## M6 — Ship prep

- Tutorial tips for the M3+ systems, tooltips on anything new since M2.5, settings menu (volume, fullscreen, scale), achievements (10).
- Endless, Daily seed, Challenge runs.
- Tauri desktop builds (Windows, Mac, Linux) from CI, ready for Steam; the game is sold on Steam, with no free public or browser version. Private builds for friends come from CI as a download link. The GitHub repo goes private before release.
- Optional: Claude Code terminal preview mod.

**Accept:** a friend can play a private desktop build without help.

## After launch

- Long Year mode (GDD §13): all four seasons as one run, with mid-run saves.
