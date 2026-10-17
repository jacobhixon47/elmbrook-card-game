# Balance review: M4 systems

The M4 balance pass: measure every system that decides a win, together and as different players play, then tune it. Jacob's direction (Oct 17): tune for the median player, so a casual player can progress through the first Years and a few more with persistence, a skilled player can reach Year 10, difficulty ramps with the Years, and progress between runs (perks, unlocks) should really help. What changed is at the end; the measurements before it are from before the changes.

## How it was tested

- **Four players.** The greedy bot (`expert`) plus three personas in `src/sim/bot.ts` that make the mistakes people make, at a rate per decision:

  | | brew | lazy | Tinctures | whim | impulse | stalls |
  |---|---|---|---|---|---|---|
  | skilled | 10% (top 3) | 15% | 10% | 15% | 10% | 20% |
  | casual | 25% (top 6) | 40% | 30% | 35% | 20% | 50% |
  | novice | 45% (any) | 70% | 50% | 60% | 35% | 75% |

  *Brew*: makes another brew that fills an order instead of the best one. *Lazy*: doesn't Discard to hunt for an order, or pour away a cheap Shelf potion. *Tinctures*: leaves them in hand. *Whim*: picks a reward, errand, event choice, Creek card, commission, gift or blessing at random. *Impulse*: buys something affordable the deck didn't need (rent still kept). *Stalls*: walks past Night Market stalls other than the Fence.
- **Whole saves** (`pnpm sim --career n --strategy s`, `src/sim/career.ts`): from a new profile, every run is counted into the profile the way the game does it. Perks are bought as Reputation allows, each new Year is taken with a random boon, and the witch, cauldron and keepsake are picked at random from what's open. The player always plays the newest open season. 32 saves per player, up to 250 runs each (31,000 runs).
- **One system at a time**: 300 runs per cell, Year 1 with tier 1 perks unless noted, varying one thing (witch, cauldron, boon, keepsake, Friendship, perk tier, unlocks).
- **Patrons**: 400 runs per season, each patron's night by week.

Bots aren't people. The personas plan worse than a person in some ways and better in others, so read their numbers as a range: a real casual player probably lands between `casual` and `skilled`.

## What a save feels like

Runs taken to reach each milestone (median of 32 saves):

| | win Spring | win Summer | win Autumn | win Winter (Year 1 done) | reach Year 3 | reach Year 5 | reach Year 8 |
|---|---|---|---|---|---|---|---|
| expert | 3 | 6 | 10 | 15 | 25 | 68 | 172 (88% of saves) |
| skilled | 4 | 9 | 18 | 23 | 43 | 126 (91%) | 6% of saves |
| casual | 9 | 49 | 68 | 77 | 156 (93%) | 4% of saves | none |
| novice | 94 (78%) | 160 (44%) | 6% of saves | none | none | none | none |

Win rate per run: expert 29% in Year 1, skilled 16%, casual 5%, novice 1%. The longest losing streak in a save has a median of 42 runs for the expert, 63 for skilled and 73 for casual.

**The finding that matters most:** Year 1 was tuned on the greedy bot, and small mistakes compound. Each kind of casual slip alone costs 2 to 7 points of Spring win rate; all of them together take Spring from 16% to under 1% (no perks). A casual player needs about 77 runs to finish Year 1. That's far from cozy.

Where runs are lost: weeks 3 and 4. On the Moonless Patron's week, 59% of the greedy Spring runs still alive lose (88% for casual).

## Drift since the ramp pass

Greedy bot, perks and unlocks a player would carry into each Year, 400 runs a cell:

| | Year 1 | Year 3 | Year 6 | Year 10 | Year 1 target |
|---|---|---|---|---|---|
| Spring | 31% | 38% | 30% | 20% | 40% |
| Summer | 22% | 36% | 28% | 13% | 34% |
| Autumn | 18% | 24% | 20% | 14% | 29% |
| Winter | 9% | 18% | 12% | 6% | 23% |

Year 1 fell 9 to 14 points below its band since the ramp pass (the dusk events, Friendship and the Lamplighter's twist came after). Years 2 and 3 are easier than Year 1, and Year 4 is a cliff: in the expert saves Year 3 wins 36% and Year 4 wins 12% (rent goes from ×1.05 to ×1.25 and a stall closes).

## System by system

Win rates are greedy, Year 1, tier 1 perks, 300 runs, unless noted.

**Cauldrons.** Glass is far ahead and Bone is a trap.

| | Spring | Summer | Autumn | Winter | casual Spring |
|---|---|---|---|---|---|
| Copper | 29% | 22% | 11% | 10% | 3% |
| Glass (+2 Harmony, -1 hand) | 62% | 48% | 50% | 34% | 14% |
| Iron (3 slots, -1 Brew) | 27% | 32% | 14% | 11% | 2% |
| Silver (+1 Discard, pay -10%) | 23% | 8% | 7% | 4% | 2% |
| Bone (2 Lunar cards, rent +25%) | 2% | 3% | 1% | 0% | 0% |

**Witches.** No witch wins more in her own season. Frost Witch in Winter wins 12% against the Hedge Witch's 10%; Bloom Witch in Spring 24% against 29%. The Alchemist is weakest everywhere (16% Spring, 7% Winter), the Illusionist strongest in Spring (34%).

**Boons** (Year 3, tier 3 perks, all unlocks). Another Perch and A Taller Shelf do nothing: A Spare Perch (a tier 1 perk) already fills the familiar cap of 5, and the two shelf perks fill the Shelf cap of 6. Their runs match no-boon runs exactly. Winter Savings is the strongest (+12 Spring, +12 Winter), A Lucky Find next (+11 Winter), Blessed Hands small (+3).

**Perk tiers.** Tier 4 nearly doubles the win rate: Spring 43% at tier 3 to 81% at tier 4, Winter 28% to 61%. A Bigger Cauldron is the likely cause (inferred, not isolated). Tier 2 is also a big step from tier 1 (Spring 29% to 47%). This goes against "unlocks add breadth, not power".

**Unlocks.** All Almanac unlocks add about 5 points in every season (Spring 29% to 36%, Winter 10% to 16%): the unlock recipes add power.

**Friendship hurts until level 10.**

| every regular at | 0 | 4 | 7 | 10 |
|---|---|---|---|---|
| Spring | 29% | 19% | 22% | 38% |
| Winter | 10% | 5% | 6% | 13% |

Getting to know the town makes the game harder until the +1 tip at level 10. The friend recipes and familiars dilute the pools from level 5 and 7 (inferred), and level 4's drop is before them, so the favourite orders may play a part too.

**Keepsakes** (every regular at Friendship 8). Lantern Coal is strong (+13 Spring, +7 Winter). Gilded Coin and Night Lily add about 5. Honey Loaf and Paper Star add about 1. Shrine Candle costs about 3 points in Spring and is even in Winter: the +1 Brew in a day deck isn't a power problem.

**Score ceiling.** A Legendary is brewed in about half of greedy first-Spring runs (152 of 300) and in 15% of casual ones, and in 85% of Glass Cauldron runs. Average potion quality is about 80 (Masterwork starts at 100, Legendary at 300).

**Patrons.** The Lamplighter is mid-pack: 70% of its orders filled in week 1 and 63% in week 3, close to Mother Hollow and Sir Bramble. The Twin Owls are hardest in week 3 (52% filled greedy, 37% casual). No change proposed.

**Card tags.** 17 tags, and rules read 7 of them (flower, frost, fruit, mineral, herb, spice, water). Seven tags have only one card (sweet, scale, pearl, seed, dust, star, and one more), and five have two or three.

**Not covered yet:** Shrine Tea's rarity, free Shelf pouring on its own, Omens and seasonal stalls one at a time.

## Proposals (as first written)

1. **Tune the bands for a casual player, not the greedy bot.** Target Year 1 for `casual` at about 35/30/25/20% by season, which puts the expert around 60%. The main lever is rent in weeks 3 and 4 of Year 1, where runs are lost. Later Years keep their climb.
2. **Smooth the Year curve.** Rent ×1.05, ×1.10, ×1.15, then ×1.25 from Year 6, instead of the jump at Year 4.
3. **Cauldrons into a band around Copper.** Glass +1 Harmony (was +2). Bone rent +10% (was +25%). Silver pay -5% (was -10%).
4. **Make Friendship never hurt.** Find what makes levels 4 to 7 lose and fix it so each level is neutral or better (for example, friend recipes asked only by their regular instead of joining every pool).
5. **Fix the dead boons.** A boon's slot goes past the cap (Another Perch: up to 6 familiars; A Taller Shelf: up to 7 slots).
6. **Rein in tier 4 perks.** Look at A Bigger Cauldron first; move it to a cauldron unlock or cut it, so tier 4 is breadth.
7. **Raise the Legendary line** from 300 to 400 quality, so a first Spring rarely reaches it.
8. **A home season for each witch.** Each witch's focus ingredients turn up more in her season's pools, and the Alchemist gets a small buff.
9. **Lantern Coal** gets a gentler keepsake version. Shrine Candle and Gilded Coin stay.
10. **Tags.** Show the 7 tags rules read as icons; fold the one-card tags into the others.

## What changed (Jacob, Oct 17)

Jacob approved tuning for the median player and the fixes above, except trimming tier 4 perks (progress between runs should help; the Year ramp pushes back instead). Tags and Lantern Coal are left for later.

| | before | after |
|---|---|---|
| Rent, weeks 2 to 4 (Spring) | 71 / 161 / 307 | 55 / 126 / 239 |
| Rent in later Years | +5% from Year 2, +25% from Year 4 | +6.5% for each Year after the first |
| Favourite orders | pay like any order | +6 gold tip |
| Another Perch, A Taller Shelf | capped at 5 familiars, 6 Shelf slots | the boon's slot goes past the cap |
| Glass Cauldron | +2 Harmony, -1 hand | +1 Harmony, -1 hand, -1 Discard |
| Bone Cauldron | rent +25% | rent +5% |
| Silver Cauldron | pay -10% | pay -5% |
| Legendary | 300+ quality | 400+ quality |
| Home seasons | none | +1 Discard a day in the season that opens the witch |
| Alchemist | hand 7 | hand 8 |

**Whole saves after** (16 per player, up to 250 runs; median runs to reach, share of saves in brackets):

| | finish Year 1 | reach Year 3 | reach Year 5 | reach Year 8 | reach Year 10 | win Year 10 Winter |
|---|---|---|---|---|---|---|
| expert | 7 (was 16) | 14 (25) | 28 (68) | 62 (172, 88%) | 113 (was 9% of saves) | 150 (81%; was none) |
| skilled | 9 (24) | 18 (43) | 36 (126) | 92 (was 6% of saves) | 207 (63%; was none) | 13% of saves |
| casual | 13 (78) | 27 (156) | 69 (was 4% of saves) | 6% of saves (was none) | none | none |
| novice | 77 (was never) | 127 (94%) | 13% of saves | none | none | none |

Win rate by Year for the casual player: 32% in Year 1, 27% in Year 2, 22% in Year 3, 15% in Year 4, 8% in Year 5, about 4% from Year 6. The skilled player: 44%, 56%, 43%, 43%, 31%, 20%, 15%, 8%, 4%, 4%.

**Systems after** (greedy bot, Year 1, tier 1 perks; Spring / Winter):
- Cauldrons, before the rent change: Copper 29 / 10, Glass 35 / 11, Iron 27 / 11, Silver 31 / 7, Bone 23 / 11.
- Witches in their home season, before the rent change: Bloom Witch Spring 33 (Hedge Witch 24), Illusionist Autumn 19 (8), Frost Witch Winter 10 (8), Alchemist Summer 20 (20).
- Friendship (casual / greedy, Spring): level 0 24 / 66, level 4 26 / 69, level 7 22 / 64, level 10 33 / 72. Level 4 no longer loses runs.
- Legendary in first-Spring runs: greedy 31% (was 51%), casual 6% (was 15%).
