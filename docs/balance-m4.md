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

