# Balance report: end of M3

The greedy bot after the M3 balance pass (commit with this file), 1,000 runs per season, `pnpm sim --runs 1000 --season <s>`. The target band is 15-35% (milestones.md, M1). The week-4 rent wall is left as it is on purpose.

| | Win rate |
|---|---|
| Spring | 35.0% |
| Summer | 27.9% |
| Autumn | 33.1% |
| All unlocks | 34.6% |
| Random bot (300 runs) | 0 errors |

What the pass changed, from the balance tables' `m3-close` patch:
- Baker's Dozen: 6 → 3 Warming brews (finished 1% → 19% of the time it's taken).
- Full Moon Favour: 3 → 2 Superb Calming (5% → 29%).
- Calm the Shrine: 3 Superb Calming → 2 Calming of any tier (7% → 24%).
- Full Shelf: a tier 1 relic → 8 gold, since the bot finished it every time.
- The Shrine Blessing: 3 → 6 gold (Blessed costs 12 at the Creek Bank).

The bot doesn't steer toward a commission, so its completion rates are floors for a real player.

## Spring, in full

```
== greedy · spring: 1000 runs ==
win rate      35.0% (350/1000)
errors        0
unfinished    0
rejected acts 0.0 per run
orders        29.2 filled, 11.7 declined per run

run lost in week
  week 1      8    0.8%  
  week 2     16    1.6%  
  week 3    112   11.2%  ███
  week 4    514   51.4%  ███████████████
  of which week 4 rent paid, Moonless Patron not met: 312 (31.2%)

patron orders filled
  week 1   34.1%  (341/1000)
  week 2   21.1%  (209/992)
  week 3   49.3%  (481/976)
  week 4   70.1%  (1816/2592)

average quality brewed (potions)
  week 1    28.2  (14355)
  week 2    53.4  (16137)
  week 3    80.0  (15574)
  week 4   113.7  (15438)

gold at the start of each day (runs still alive)
  week 1    10    9   11   14   18   (day 1-4, night)
  week 2    19   20   25   32   41   (day 1-4, night)
  week 3    37   46   56   74   88   (day 1-4, night)
  week 4    59   78  101  125  150   (day 1-4, night)

most picked rewards
  simmer            22.7% of offers (247)
  nightshade        21.9% of offers (224)
  mandrake          21.1% of offers (233)
  blackberry        19.9% of offers (228)
  forage            19.9% of offers (206)
least picked rewards
  fallen-star        4.8% of offers (1)
  creekwater         1.0% of offers (10)
  mint-sprig         0.6% of offers (19)
  thistledown        0.4% of offers (4)
  stir               0.1% of offers (1)

tinctures played (per 100 runs)
  stir                814
  forage              278
  simmer              199
  steep               156
  double-boil         155
  bottle-spare        150
  mod:temper          141
  mod:moonlit         136
  infuse              135
  mod:blessed         135
  taste-test          115
  pinch-of-salt        98
  tidy-up              97
  charm-sachet         82
  sift                 71
  mod:aged             38
  blood-moon           18
  witching-hour        13
  howl                 11
  wishing-star         10
  raven-call            9
  black-cat-crossing      8
  never played: decant, second-wind, grimoire-page, cracked-mirror, moth-swarm

guild commissions (taken per 100 runs, done of taken)
  miners-mend            71  36.5%
  bakers-dozen           57  18.6%
  the-whole-town         48  50.9%
  no-shadows             42  32.7%
  night-owl              34  34.5%
  masters-proof          24  91.7%
  full-moon-favour       17  28.5%
  full-shelf             17 100.0%
  three-of-a-kind         7  74.3%
  calm-the-shrine         3  24.2%

dusk event choices (per 100 runs)
  fairy-ring: Step in                  18
  mice-in-the-pantry: Adopt them       18
  moonlit-walk: Wander                 17
  kettle-explodes: Laugh it off        16
  found-coin-purse: Keep it            14
  bargain-bin: Walk on                 14
  spilled-cauldron: Pay for help       13
  spilled-cauldron: Mop up             10
  shrine-blessing: Nod and go           9
  shrine-blessing: Kneel                8
  bargain-bin: Rummage deep             3
  bargain-bin: Rummage                  2

familiars held at the end (1.6 per run; per 100 runs, win rate when held)
  heron                21   52.6%
  salamander           17   45.1%
  hearth-toad          17   65.1%
  garden-snail         16   50.3%
  otter                16   54.1%
  will-o-wisp          14   61.0%
  moth                 13   56.9%
  hedgehog             13   45.7%
  tortoise             10   54.6%
  black-cat            10   53.1%
  jackdaw              10   61.5%
  frost-hare            1   37.5%
  ferret                0   33.3%
  firefly               0  100.0%
  barn-owl              0    0.0%
  never held: raven, magpie, fox, old-hound, hob

relics held at the end (2.2 per run; per 100 runs, win rate when held)
  spare-satchel        55   43.6%
  witchs-hatpin        38   59.2%
  guild-seal           27   41.4%
  copper-ladle         17   43.7%
  pressed-flower       14   42.2%
  lucky-horseshoe      13   36.6%
  iron-lid             13   46.8%
  apprentice-ledger    13   46.8%
  old-almanac          12   47.0%
  moon-locket           7   65.2%
  kettle-of-plenty      6   72.9%
  silver-bell           4   50.0%

curses held at the end (0.9 per run; per 100 runs, win rate when held)
  nameless             36   40.8%
  moonsick             27   42.5%
  leaky-roof           17   38.0%
  sour-luck            14   39.3%
  heavy-hands           1    0.0%
  never held: unpaid-debt

modified cards held at the end (3.6 per run; per 100 runs, win rate when held)
  moonlit              75   36.7%
  blessed              73   41.2%
  aged                 42   29.5%
  cursed               17   40.0%

126.2s
```
