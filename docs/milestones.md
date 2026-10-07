# Milestones

Each milestone ends with something Jacob can open in a browser. "Done" = acceptance criteria met, `pnpm typecheck && pnpm test` green, and snaps of new screens reviewed.

## M0 — Scaffold and harness ✅

- Vite + Phaser 4 + TypeScript (strict), 640×360 integer zoom.
- `src/codex` with zod schemas and the GDD §14 starter content.
- Seeded RNG; core `reduce` with `startRun` and `drawToHandSize`.
- Debug harness: `?fixture=`, `?seed=`, `?noanim=1`, `window.__elmbrook`, `markReady`.
- Art as code: palette, 15 sprite grids, procedural frames/cauldron/backdrop, baked card faces with crisp text.
- Scenes: Title, Hand (seeded opening hand), ArtSheet.
- `pnpm snap`, `pnpm snap:all`, `pnpm art:check`, `pnpm art:sheet`. ESLint keeps core pure. GitHub Actions CI.

**Accept:** `pnpm dev` shows the title screen; `pnpm snap title` writes a PNG; CI green.

## M1 — Rules engine (headless)

- Deck: draw, hand size, discard, reshuffle. Orders, Brews/Discards per day.
- Cauldron slots, recipe matching by essence pattern, Experiments, Sludge.
- Scoring pipeline with full event stream (GDD §6.3), quality tiers, pay and tips.
- Shelf, deliver/decline, hearts. Day → dusk reward (with skip pity) → errands (Market, Forage, Hearth only).
- Week structure and rent; run loss/win.
- `season` in run state (Spring only for now) and the season twist hook.
- `pnpm sim` with a greedy bot; prints the report from `tech.md`.
- Dev overlay (backtick): seed, state inspector, add gold, jump to day.

**Accept:** ≥90% coverage on `src/core`; 2,000 simulated runs finish without errors; a greedy bot wins some but not most runs (target 15-35% to start).

## M2 — Playable day (vertical slice)

- Run scene: Order Board, order dialogue (Fulfill / Decline / Back), hand, cauldron panel with preview, Shelf.
- Scoring animation playing the event stream, with juice (tweens, number pops, bubbles).
- Dusk reward pick and errand choice.
- Fixtures + snaps for each state.

**Accept:** Jacob can play Days 1-3 of week 1 in the browser with mouse and keyboard and it feels good.

## M3 — Full run

- Calendar scene (run map) with weather/events and next patron preview.
- Night Shifts with patron twists (all 7), Night Satchel, Lunar cards.
- Night Market with all 6 stalls and their odd currencies.
- Familiars, cauldrons, card modifiers, tinctures, remaining errands (Creek, Guild Commissions, Events: first 8).
- Game over and victory screens; resume mid-run.

**Accept:** a full 16-encounter run is playable start to finish; sim win rate for greedy bot within target band; balance report checked in.

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

- Tutorial (first run guided days), tooltips everywhere, settings menu (volume, fullscreen, scale), achievements (10).
- Endless, Daily seed, Challenge runs.
- itch.io deploy from CI; Tauri desktop build.
- Optional: Claude Code terminal preview mod.

**Accept:** a friend can play the itch build without help.

## After launch

- Long Year mode (GDD §13): all four seasons as one run, with mid-run saves.
