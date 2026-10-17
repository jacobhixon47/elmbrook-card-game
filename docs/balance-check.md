# The balance check

A temperature check of the game's balance, to run at crucial points: the end of a milestone, after a new system or a batch of content, and before and after any balance change. It plays the game as four kinds of player, run by run and over whole saves, and compares what it finds with the targets below. It was built for the M4 balance pass (`docs/balance-review.md`), where Jacob asked to keep it (Oct 17).

```
pnpm balance            # about 25 minutes on 4 cores
pnpm balance --quick    # about 5 minutes: fewer runs and saves, for a rough read
pnpm balance --systems  # also each cauldron, each witch at home, and Friendship levels
```

The report prints and is saved to `.sim/balance-<time>.md`, with each player's full save report beside it (`-saves.txt`). For a single question, `pnpm sim` still plays runs with any settings (`--strategy`, `--season`, `--year`, `--perks`, `--friends`), and `pnpm sim --career n --strategy s` plays saves.

## The method

**Four players.** The greedy bot (reported as `expert`) plays as well as it knows how. Three personas (`PERSONAS` in `src/sim/bot.ts`) make the mistakes people make, each at a rate per decision; every other decision is the greedy bot's:

| | brew | lazy | Tinctures | whim | impulse | stalls |
|---|---|---|---|---|---|---|
| skilled | 10% (top 3) | 15% | 10% | 15% | 10% | 20% |
| casual | 25% (top 6) | 40% | 30% | 35% | 20% | 50% |
| novice | 45% (any) | 70% | 50% | 60% | 35% | 75% |

- *Brew*: makes another brew that fills an order instead of the best one, from the top few.
- *Lazy*: doesn't Discard to hunt for an order, or pour away a cheap Shelf potion.
- *Tinctures*: leaves them in hand.
- *Whim*: picks a reward, errand, event choice, Creek card, commission, gift or blessing at random.
- *Impulse*: buys something affordable the deck didn't need (rent still kept).
- *Stalls*: walks past Night Market stalls other than the Fence.

The **casual** player is the one the game is tuned for. Bots aren't people, so read the personas as a range: a real casual player probably lands between `casual` and `skilled`.

**Whole saves** (`src/sim/career.ts`) start from a new profile and count every run into it with the real profile functions, the way the game does. Perks are bought as Reputation allows, each new Year is taken with a random boon, and the witch, cauldron and keepsake are picked at random from what's open. The player always plays the newest open season. This tests every system that decides a win together, as the systems arrive in a save, and it is the main measure: it shows how progress between runs carries a player.

**Year 1 cells** play each season with the tier 1 perks, as a player has after a few runs. They are quick to read, but a save is the truth.

**Systems** (`--systems`) vary one thing at a time against the same baseline: each cauldron, each witch in her home season against the Hedge Witch, and every regular at Friendship 0, 4, 7 and 10.

## Targets

Set with Jacob (Oct 17): tune for the median player. A casual player can progress through the first Years, and a few more if they stick at it, though not on the first try. A skilled player still finds some challenge and reaches Year 10 eventually. Difficulty ramps with the Years, and progress between runs (perks, unlocks) should really help.

| | finish Year 1 | reach Year 5 | reach Year 10 | Year 1 win rate |
|---|---|---|---|---|
| expert | under 10 runs | under 40 | most saves | 60 to 70% |
| skilled | about 10 runs | about 40 | most saves, around run 200 | 45 to 55% |
| casual | 10 to 25 runs | most saves, within about 100 | rarely | 25 to 35% |
| novice | eventually (under about 100) | some saves | never | 5 to 10% |

Also check:
- Win rates fall Year by Year for every player (a dip where a perk tier lands is fine).
- No cauldron is far from Copper, and each witch wins more in her home season than the Hedge Witch.
- No Friendship level wins less than level 0.
- Errors are 0.

## Results so far

| Date | Change | casual: finish Year 1 / reach Year 5 | skilled: reach Year 10 | Report |
|---|---|---|---|---|
| Oct 17 | before the M4 balance pass | 78 runs / 4% of saves | none | `docs/balance-review.md` |
| Oct 17 | after it | 13 runs / 69 runs | 63% of saves, run 207 | `docs/balance-review.md` |
| Oct 17 | M4 leftovers, before (quick) | 15 runs / 73 runs | none within 150 runs | the M4 leftovers PR |
| Oct 17 | M4 leftovers, after (quick): pouring costs a Discard, Shrine Tea is Calming, tags tidied | 18 runs / 66 runs | none within 150 runs | the M4 leftovers PR |

Add a row each time the check runs at a crucial point.
