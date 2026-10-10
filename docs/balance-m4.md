# Balance: M4

## Winter tuning

The end-of-M3 bot won 8.3% of Winter runs, and some seeds looked unwinnable: replaying 300 seeds with five bot variants (the default plus each `SIM_MOD`), only 18% were won by any of them, and 17% were lost by week 2 by all of them.

Two causes:
- **Pay didn't follow rent.** Winter rent is ×1.52, but Winter orders paid ×1. Summer and Autumn already pay close to their rent.
- **Week 1's rent of 30.** With the starting deck, a slow week 1 had no way back. Holding everything else equal, a flat week-1 rent of 20 took "lost by week 2 by every variant" from 7.3% to 0.7%, the same as Spring.

What changed (`src/core/rules.ts`):
- Week 1's rent is 20 gold in every season. The season multiplier applies from week 2.
- Winter orders pay ×1.2 (was ×1).
- Autumn orders pay ×1.15 (was ×1.25): the flat week 1 lifted Autumn to 40%, above the band.

Winter pay, with the flat week 1, on 300 seeds × 5 variants:

| Winter pay | default bot wins | won by any variant | lost by week 2 by every variant |
|---|---|---|---|
| ×1 (before, week-1 rent 30) | 8% | 18% | 17% |
| ×1.15 | 23% | 46% | 2.0% |
| ×1.2 (chosen) | 27% | 59% | 1.3% |
| ×1.3 | 36% | 63% | 0.7% |

Greedy bot, 1,000 runs a season:

| | before | after |
|---|---|---|
| Spring | 36.1% | 36.1% |
| Summer | 26.0% | 30.0% |
| Autumn | 36.7% | 32.3% |
| Winter | 8.3% | 26.6% |
| All unlocks | 34.3% | 34.3% |
| Random bot (300) | 0 errors | 0 errors |

Seasons now get harder in order except that Summer (30.0%) sits a little below Autumn (32.3%). Winter's own content (the Frost Night Market, more Frost cards) is still to come in M4 and will need another pass.

## Cottage perks

Perks don't change a run without them: Spring and Winter sim the same as before (36.1%, 26.6%). With all four bought (`pnpm sim --perks all`), 1,000 runs a season:

| | no perks | all perks |
|---|---|---|
| Spring | 36.1% | 41.4% |
| Summer | 30.0% | 34.8% |
| Autumn | 32.3% | 38.6% |
| Winter | 26.6% | 36.2% |

Random bot with all perks: 0 errors in 300 runs. A won Spring run earns about 55 Reputation and a run lost in week 4 about 35, so all four perks (95) take two or three runs. That is quick on purpose for now; the descending season targets (milestones, M4) will be tuned with perks in.

## Almanac relic pool

A first run now draws from eight starter relics; Lucky Horseshoe, Silver Bell, Pressed Flower and Old Almanac join through the Almanac. Locking Spare Satchel and Witch's Hatpin instead was tried first and cost Spring 9 points (36.1% to 27.5%), so the strongest relics stay starters: unlocks add variety, perks add power. Greedy, 1,000 runs a season, no perks or unlocks:

| | main | starters only |
|---|---|---|
| Spring | 36.1% | 38.3% |
| Summer | 30.0% | 33.1% |
| Autumn | 32.3% | 36.4% |
| Winter | 26.6% | 31.2% |

A smaller pool hands out the strong relics more often (2.3 to 2.8 relics held per run), so every season gains 2 to 5 points. With every Almanac entry done (`--unlocks all`, which now also unlocks the four familiars and four relics) Spring is 35.9%. The random bot had 0 errors in 300 runs. The season-ramp pass retunes all of this with the unlocks and perks a player carries.

How often the greedy bot meets each goal in one run (300 runs a season, before the order and Shelf goals were raised to 25 and 12): Superb 100%, Masterwork about 88%, Legendary about 41%, rent three weeks about 80%, a Name-Taker Curse about 69%, 3 familiars about 27%, 4 relics about 11%, a win 19 to 30%. The bot is a strong brewer, so a person's first run should meet fewer; pacing gets a human playtest.

## winter, after

```
== greedy · winter: 1000 runs ==
win rate      26.6% (266/1000)
errors        0
unfinished    0
rejected acts 0.0 per run
orders        30.0 filled, 12.6 declined per run

run lost in week
  week 1      0    0.0%  
  week 2     50    5.0%  ██
  week 3    212   21.2%  ██████
  week 4    472   47.2%  ██████████████
  of which week 4 rent paid, Moonless Patron not met: 189 (18.9%)

patron orders filled
  week 1   32.5%  (325/1000)
  week 2   21.8%  (218/1000)
  week 3   44.9%  (427/950)
  week 4   69.1%  (1530/2214)

average quality brewed (potions)
  week 1    27.3  (15310)
  week 2    54.7  (17470)
  week 3    79.2  (18234)
  week 4   112.6  (14384)

gold at the start of each day (runs still alive)
  week 1    10    9   12   15   19   (day 1-4, night)
  week 2    25   26   33   43   54   (day 1-4, night)
  week 3    47   57   70   85  102   (day 1-4, night)
  week 4    75  102  130  161  193   (day 1-4, night)

```

## autumn, after

```
== greedy · autumn: 1000 runs ==
win rate      32.3% (323/1000)
errors        0
unfinished    0
rejected acts 0.0 per run
orders        28.8 filled, 12.4 declined per run

run lost in week
  week 1     15    1.5%  
  week 2     26    2.6%  █
  week 3    153   15.3%  █████
  week 4    483   48.3%  ██████████████
  of which week 4 rent paid, Moonless Patron not met: 260 (26.0%)

patron orders filled
  week 1   41.3%  (413/1000)
  week 2   24.8%  (244/985)
  week 3   52.7%  (505/959)
  week 4   72.7%  (1759/2418)

average quality brewed (potions)
  week 1    29.2  (15284)
  week 2    58.2  (17248)
  week 3    86.6  (17799)
  week 4   125.5  (15323)

gold at the start of each day (runs still alive)
  week 1    10    9   11   14   18   (day 1-4, night)
  week 2    25   26   32   41   51   (day 1-4, night)
  week 3    47   57   70  104  119   (day 1-4, night)
  week 4    81  104  131  160  190   (day 1-4, night)

```

## summer, after

```
== greedy · summer: 1000 runs ==
win rate      30.0% (300/1000)
errors        0
unfinished    0
rejected acts 0.0 per run
orders        30.3 filled, 11.7 declined per run

run lost in week
  week 1      5    0.5%  
  week 2     17    1.7%  █
  week 3    127   12.7%  ████
  week 4    551   55.1%  █████████████████
  of which week 4 rent paid, Moonless Patron not met: 342 (34.2%)

patron orders filled
  week 1   37.2%  (372/1000)
  week 2   19.0%  (189/995)
  week 3   49.1%  (480/978)
  week 4   66.0%  (1684/2553)

average quality brewed (potions)
  week 1    28.1  (16645)
  week 2    54.9  (18893)
  week 3    83.6  (18727)
  week 4   116.7  (18357)

gold at the start of each day (runs still alive)
  week 1    10    9   11   14   18   (day 1-4, night)
  week 2    22   23   30   38   48   (day 1-4, night)
  week 3    47   57   69   84   99   (day 1-4, night)
  week 4    66   92  121  150  181   (day 1-4, night)

```


## Years 2 to 10

A rule per Year in place of the rent and pay multipliers. Greedy, 600 runs, with every perk bought and every Almanac entry done (the profile of a player who has reached later Years), no boon. Each Year keeps the rules before it.

| Year | Adds | Spring | Winter |
|---|---|---|---|
| 1 | | 34.5% | 31.5% |
| 2 | Patrons hidden until the day before | 34.5% | |
| 3 | A Cobweb in the starting deck | 38.0% | |
| 4 | One fewer Night Market stall | 35.0% | |
| 5 | One fewer Discard a day | 27.5% | 21.5% |
| 6 | Week 2 orders ask Superb or better | 22.2% | |
| 7 | A random Curse at the start | 21.0% | |
| 8 | The Shelf holds one less | 16.5% | |
| 9 | Reward picks offer one card fewer | 14.8% | |
| 10 | The Moonless Patron asks one tier higher | 12.2% | 7.8% |

At 600 runs a win rate moves about 2 points by chance, so Years 2 to 4 read as flat for the bot. Year 2 can't move it (the bot doesn't plan around the Calendar), and one Cobweb and one fewer stall are mild; they bite harder for a person. The big steps are Year 5 (Discards) and Year 8 (Shelf). Spring plain (no perks or unlocks) is 38.3%, unchanged. The random bot in Year 10 with A Lucky Find: 0 errors in 300 runs. The season-ramp pass tunes the strengths (Years 2 to 4 could use more, and Reputation at Year 10 is ×5.5).

## The tiered perk board

Ten more perks in tiers 2 to 4 (GDD §13). Greedy, Spring, all Almanac unlocks. "All perks" now means all 14, so the Year numbers above (tier 1 only) move up.

The first draft doubled the all-perks win rate in Year 1, from 34.5% to 69.3%. Taking one perk out of the full set at a time (400 runs each) showed where it came from: the tier 2 relic of The Heirloom was worth about 17 points, and the other start relic, the extra gold and the two Blessed cards about 5 to 8 each. Tier 1 alone was 32.3%, tiers 1 and 2 52.8%. The Heirloom became a second tier 1 relic, A Full Purse +5 gold (was +10), A Savings Jar +10 (was +20), and Twice Blessed blesses one card (was two). After that, tiers 1 and 2 are 46.0%.

Final, 600 runs:

| | Year 1 | Year 5 | Year 10 |
|---|---|---|---|
| Spring, tier 1 perks (before) | 34.5% | 27.5% | 12.2% |
| Spring, all 14 perks (after) | 54.0% | 47.2% | 33.2% |
| Winter, tier 1 perks (before) | 31.5% | 21.5% | 7.8% |
| Winter, all 14 perks (after) | 50.3% | 46.8% | 29.2% |

Spring plain (no perks or unlocks) is 38.3%, unchanged. The random bot with all perks in Year 10 with a boon: 0 errors in 300 runs. Endgame players own every perk, so the season-ramp pass tunes Years against this all-perks profile; Years 2 to 5 now barely bite.

## Fair orders

Orders now count the Experiment's lower tier when they check what the deck can reach, and re-ask among recipes that can reach the tier instead of asking for an unreachable one. Greedy, 1,000 runs, no perks or unlocks:

| | Before | After |
|---|---|---|
| Spring | 38.3% | 74.6% |
| Summer | 33.1% | 61.6% |
| Autumn | 36.4% | 75.3% |
| Winter | 31.2% | 65.1% |

Patron orders filled in Spring went from 35, 24, 53 and 71% by week to 81, 67, 80 and 89%. Before, patrons, who like rare and Lunar recipes, often named one the deck could only brew as an Experiment, a tier under what they asked, so the order could not be filled and the bot gave up the patron's reward (and, in week 4, the run). The old win rates were built on those impossible orders. The season-ramp pass retunes from here; a first try that only lowered the tier of such orders came out the same (74.0, 67.7, 70.2 and 63.2%).
