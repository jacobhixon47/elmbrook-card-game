# Elmbrook: Night Market — Game Design Document

Working title. A cozy-but-tense roguelite deckbuilder about running a potion stall in Elmbrook, one moon at a time, through the seasons of a year.

Status: v0.1 design, written to be built from. Numbers are starting points for tuning, not promises.

---

## 1. Pitch

You've inherited a run-down potion stall in Elmbrook. Your deck is your ingredient satchel. Each day, townsfolk bring orders; you draw ingredients, combine them in your cauldron, and try to brew something good enough to sell. Rent is due every week. On moon nights the shop stays open late and the Night Market comes to town, with stranger customers, lunar ingredients, and vendors who don't take coin.

One run = one lunar month (4 weeks) in one season. Survive every rent day and satisfy the Moonless Patron on the final new moon to win. (In the build, satisfying them means filling all three of their orders, `FINALE_ORDERS` in `rules.ts`; see §10.) Winning a season unlocks the next; clearing all four is your first Year in Elmbrook (§13).

Touchstones: Balatro (scoring juice, run structure, jokers), Slay the Spire (deck shaping, map choices), Luck be a Landlord (rent pressure), Stardew Valley (tone, townsfolk).

## 2. Design pillars

1. **Every brew is a little puzzle with a satisfying payoff.** The score counter should feel like Balatro's: numbers climbing, sounds stacking, cauldron bubbling over. In the build, the score ticks up a semitone per step, each tier has its own jingle, and slotting, discarding, coins and rent all have a sound made in code (`docs/art-pipeline.md`, Audio). Volume is in Settings (§15.1) and M mutes anywhere. Music (M5, code-made loops, Jacob chose Oct 19): a short loop per place (the title screen, the shop by day, the Night Shift, the Night Market and the cottage), and every place has its own tune in each season, so there are twenty (Jacob, Oct 19: no reused tunes). Spring is serene and uplifting, summer a warm summer night, smooth like spring and a little faster, with no drums, autumn calm with a lazy swing, and winter staccato, in major keys, with a bell over the tune (Jacob tried minor and preferred major). The Night Shift and the Night Market are in minor keys in every season, and the Night Market is always a waltz (Jacob, Oct 19). Music fades over as you move between places.
2. **Cozy surface, real stakes.** Warm art and gentle characters, but rent is real and a bad week ends the run.
3. **The town remembers you.** Regulars carry relationships and stories across runs; that's the meta-progression, not just unlock lists.
4. **Night is different.** Moon nights change the rules, the customers and the economy.
5. **Shared world.** Every ingredient, recipe and townsperson belongs to the Elmbrook codex shared with the sibling shop-sim game.

## 3. Run structure

```
Week 1 (Waxing Crescent)  Day · Day · Day · Day · Night Shift (First Quarter)   → Rent
Week 2 (Waxing Gibbous)   Day · Day · Day · Day · Night Shift (FULL MOON)       → Rent   (festival week)
Week 3 (Waning Gibbous)   Day · Day · Day · Day · Night Shift (Last Quarter)    → Rent
Week 4 (Waning Crescent)  Day · Day · Day · Day · Night Shift (NEW MOON finale) → Win
```

- **20 encounters per run** (16 days + 4 nights), about 60-75 minutes, still one sitting. Days per week is a single tuning constant (`DAYS_PER_WEEK` in `src/core/calendar.ts`); 3 vs 4 gets compared in the sim before it is locked.
- **The Calendar is seeded at run start:** each day's weather, the week's town event, the festival in week 2, and any rare sky event, so you can plan around them.
- **The Calendar is the run map.** It shows the current week, each day's weather/event icon, and the upcoming Night Shift's patron and rule twist (revealed in advance, like Balatro's boss blind). In the build it is the Grimoire's Calendar tab: four weeks of five days with each week's moon, every day's weather, the festival and any sky event; hovering a day gives its rules. Today's weather and events also sit under the Brews in the HUD.
- The Calendar rolls from its own random stream (`seed:calendar`), so the same seed deals the same cards whatever the weather.
- **Rent** is paid automatically after each Night Shift: 20 / 55 / 126 / 239 gold in Spring (the balance pass, tuned for a casual player). Week 1's rent ramps gently by season (20, 22, 24, 26); later weeks take the season's multiplier, and later Years add to it (§13). Can't pay = run over ("the Guild reclaims your stall").
- **Full Moon** (week 2) is the mid-run boss. **New Moon** (week 4) is the finale.

### Seasons

Every run happens in one season. The season is chosen at run start from those you've unlocked (§13) and colours the whole month:

| Season | Ingredient pool | Twist | Feel |
|---|---|---|---|
| Spring | Fresh herbs and flowers more common (Vital, Calming) | Gentle: lower rent, the tutorial season | Blossom, rain, new beginnings |
| Summer | Fruit, honey, Ember ingredients | Long days: +1 Brew on Days, Night Shifts are short (-1 Discard). Rent ×1.15, orders pay ×1.2 | Fireflies, festivals |
| Autumn | Roots, mushrooms, Umbra ingredients | Harvest patrons: bigger orders, bigger tips. Rent ×1.32, orders pay ×1.23 | Falling leaves, lanterns, the Harvest Fair |
| Winter | Scarce Fresh ingredients; Frost and Lunar cards more common | The Hearth Trader every night, and snowy nights can bury the rest of the Night Market (Snowed In). Rent ×1.48, orders pay ×1.35 | Snow, hearth fires, the longest nights |

Seasons scale in difficulty in that order: rent rises faster than pay, so Year 1 is tuned for a casual player (the balance pass, Oct 17, decided with Jacob): with the first perks, a casual player wins about 25 to 30% of Spring runs and finishes Year 1 in about 12 runs, a skilled one reaches Year 10, and perks and unlocks help as a save goes on (`docs/balance-review.md`). Numbers are tuning starting points. Each season adds its own ingredients, patrons, events and two Night Market variants to the pools, so later seasons also feel new, not only harder.

### Time of day

A day is the slow slide from afternoon into night, so the shop is always lamplit and cozy. There is no bright noon.

| Phase | Sky in the window |
|---|---|
| Order Board | Golden late afternoon |
| Brewing | Sunset |
| Dusk errands | Twilight: first stars, lit cottage windows |
| Night Shift, Night Market | Full night, moon in its current phase |

The window also shows the season (blossom, deep green, rust and gold, snow) and the day's weather (§4.2), with particles drifting past the glass. This is presentation only; `skyTime(state)` in `src/core/calendar.ts` derives it from the phase.

### Phases of a Day

1. **Afternoon — Order Board.** 1-3 customer orders appear (count ramps by week: 1-2 in week 1, 2 in weeks 2-3, 3 in week 4).
2. **Sunset — Brewing.** Draw a hand, brew, deliver. Limited **Brews** (4) and **Discards** (3) for the whole day, shared across all orders. Each day starts with the whole deck shuffled together; after every brew or Discard you draw back up to hand size. One Discard throws away 1-5 cards.
3. **Twilight — Reward + Errand.** Pick 1 of 3 ingredient cards (or Skip, see §8). Then choose one **Errand** from 2 offered (§7).

### Phases of a Night Shift

Same as a day, but: the patron's rule twist is active, your **Night Satchel** (§5.4) shuffles into your draw pile, **night customers** (§4.1) place the orders, and afterwards the **Night Market** opens (§9) before rent is collected.

## 4. Orders and customers

Each order shows on the Order Board as: portrait, name, your Friendship level with a regular (♥ 2), and once you've opened it, the request and pay. The order's dialogue shows their portrait at twice size and the progress to the next level (♥ 2 · 21/30). Every customer (regulars, seasonal visitors, night customers and patrons) has a portrait; it also heads their story scenes, the Moonless Patron's arrival, and their Codex and Townsfolk entries, where someone you haven't met is an empty frame.

Carried over from 1.0: click an order to open its dialogue; choose **Fulfill**, **Decline**, or **Back**. Reopening returns to the choice without replaying dialogue. You choose which order to work on and in what order.

*Fair orders (decided with Jacob, Oct 10):* every order asks for something your deck can bring to its tier. A recipe you don't know yet brews as an Experiment, a tier lower, so it only counts as reachable at that lower tier (full tier with the Witch's Hatpin). When the first request a customer rolls can't reach the tier asked, they ask again among the recipes that can; only when none can does the tier drop. An order naming a recipe you don't know shows "(new)" on its ticket, and its dialogue gives the recipe's essences and the Experiment's cost. Before this, about half the patrons' orders asked for a rare recipe the deck could only reach as an Experiment, below the tier asked, so they could not be filled; making them fair roughly doubled the bot's win rate, which the season-ramp pass brings back down (`docs/balance-m4.md`).

*Order variety (Jacob's playtest, Oct 14):* no recipe is asked for twice on the same Order Board. A customer who names a recipe already there asks for another they like that the deck can bring to the tier, then any the deck can, and otherwise for that recipe's family. Families can repeat, and so can yesterday's requests, so orders stay random. Late weeks used to ask for the one recipe the deck could bring to Masterwork, often Elmbrook Panacea; the six new three-card recipes (§14) give those weeks more to ask for.

**An order has:**
- **Request:** a specific potion ("Healing Draught") or a family ("anything Warming", "a Calming potion").
- **Quality minimum:** a quality tier (§6.4). The minimum rises by week (Fine in week 1; mostly Superb by week 3; half Masterwork in week 4; the Night Shift's first order is one tier harder), but an order never asks for more than your deck could brew with a perfect draw and the Tinctures you own. A weak deck gets easier orders that pay less, so rent is what squeezes it.
- **Pay:** base gold; tips scale with how far you exceed the minimum.
- **Optional bonus condition:** "no Umbra ingredients", "brewed with exactly 3 ingredients", "use a Wychwood ingredient". Meeting it adds a tip and a point of Friendship. Each regular has their own bonus chance and conditions.
- **Who comes in:** regulars have a weight (how often they visit), a pay multiplier and a tip multiplier, so Pip & Quill pay little but tip well and Marlowe pays more.

**Delivering:** a matching potion from your Shelf or a fresh brew fulfils the order and, for a regular, earns a point of Friendship (two if the bonus condition is met). **Declining** costs nothing. Unfinished orders at end of day count as declined. Friendship is the regulars' alone; see §13 for how it builds and what it opens.

**Free brewing:** once every order is resolved, leftover Brews can make potions for the Shelf (from 1.0: "after requests are done you can brew with remaining cards").

### 4.1 Night customers

A separate cast who only come after dark. Stranger and more formal than the day crowd, never horror. Their orders are odd ("a potion that tastes like a memory") and pay in odd things: Omens, a Curse lifted, Lunar cards, a stall discount at the Night Market. They have no Friendship meter; their stories are for later.

| ID | Name | Who | Tends to order | Gold | Pays in |
|---|---|---|---|---|---|
| wisp-courier | The Wisp Courier | Delivers letters between the living and the not-quite | Secrets, Lunar | ×0.5 | A random Omen into the Night Satchel |
| lantern-witch | The Lantern Witch | Lights the Night Market's lamps, sharp-tongued | Vigor, Warming | ×0.5 | Pick 1 of 2 Lunar ingredients after the shift |
| bog-hag | Granny Bogwort | Lives in the fen, surprisingly sweet | Healing, and it must have an Umbra ingredient | ×0.5 | Pick 1 of 3 Rare ingredients after the shift |
| moth-duchess | The Moth Duchess | Aristocrat of the lamplight | Illusion, Fortune | ×1.5 | Gold, lavishly (was ×2.5: a Superb Four-leaf Tea paid most of week 2's rent; Jacob, Oct 21) |
| sleepless-miller | The Sleepless Miller | Hasn't slept in years | Calming | ×1 | Lifts your oldest Curse, or ×1.5 gold if you carried none when the order was posted |
| ferryman | The Ferryman | Poles a flat boat across the brook all night | Protection | ×1.25 | Takes one card of your choice out of your deck (as Rook does) |
| owl-archivist | The Owl Archivist | Keeps the town's night records | Secrets, Calming | ×1.25 | Pick 1 of 2 Tinctures |
| fox-peddler | The Fox Peddler | Knows every stall at the Night Market | Fortune, Vigor | ×1.25 | Your next buy at tonight's Night Market is half price (as the Firefly Keeper's) |
| bell-ringer | The Bell-Ringer | Rings the bell of the drowned chapel | Healing, Protection | ×1.25 | +2 Potency on one ingredient of your choice for the run (as the Toymaker's) |
| starwatcher | The Starwatcher | Maps the stars from the old hill | Lunar, Illusion | ×1 | +1 Brew on the first day of next week |

The last five were added with Jacob (Oct 21) so ten night customers share the other orders, each as likely as the rest; each pays in something the game already gives, and Protection has night customers for the first time. As drafted at ×0.5 gold they cost the skilled bot about 2 points of Year 1 win rate each (they take order slots that paid full gold), so Jacob set them to ×1.25; the Starwatcher stays ×1.

The Night Shift patron (§10) is the featured guest; night customers fill the other orders that night, along with the regulars who only come at night (The Gardener). Gold is the order's normal night pay times the multiplier. Picks wait until after the shift's twilight reward, before the Night Market. Granny Bogwort only insists on Umbra when your deck can brew it into her potion.

### 4.1.1 Seasonal visitors

Approved by Jacob (Oct 16). Daytime guests of one season, two per season, with no Friendship meter. From week 2, about 1 day in 4 of their season brings one, in place of the last regular on the board, at most one a day. They come only when the deck can brew a family they like (with their tag, if they want one). The roll has its own stream from the seed, so a visitor doesn't change the rest of the day's orders. Their gold is the order's normal day pay times the multiplier; what they give beyond it comes after closing, after the twilight reward, like a night customer's pick. Each has a Codex entry under Townsfolk once met.

| ID | Name | Season | Wants | Gold | Pays in |
|---|---|---|---|---|---|
| wren-hollis | Wren Hollis, a botanist | Spring | Calming, Healing or Fortune, with a Flower ingredient | ×0.5 | Pick 1 of 2 Flower ingredients |
| may-herald | The May Herald | Spring, week 2 up to the fair (days 1 to 3) | Fortune or Illusion | ×2 | Gold |
| captain-brine | Captain Brine, on shore leave | Summer | Vigor or Protection, with a Water ingredient | ×0.5 | Pick 1 of 2 Tide ingredients |
| firefly-keeper | The Firefly Keeper | Summer, clear days | Calming or Lunar | ×0.5 | Your next buy at this week's Night Market is half price (rounded up) |
| rook | Rook, a scarecrow | Autumn | Protection | ×0.5 | Takes one card of your choice out of your deck (down to 8 cards), or none |
| tithe-collector | The Tithe Collector | Autumn | Two Healing or Warming potions in one order | ×2 | Gold |
| snowbound-traveller | A Snowbound Traveller | Winter, snow days | Warming | ×0.5 | Pick 1 of 2 Tinctures (not Omens) |
| toymaker | The Toymaker | Winter | Illusion or Secrets | ×0.5 | +2 Potency on an ingredient of your choice for the run |

Changes from the approved draft, made while building: visitors start in week 2, so the tutorial's week never has one; the May Herald comes on week 2 before the fair rather than weeks 1 and 2; the Snowbound Traveller comes on snow days, since Snowed In is a Night Shift; and Wren asks for a family she likes with a Flower in it, since orders always name a recipe or family.

### 4.2 Events

Four layers, all seeded into the Calendar at run start so they can be planned around.

**Daily weather** (one per day, shown on the Calendar and in the shop window):

| Weather | Seasons | Effect | Window |
|---|---|---|---|
| Clear | All | No effect, a breather | Season as normal |
| Rain | Spring, summer, autumn | Creek and Tide ingredients +2 Potency (once per card); one fewer order on a busy day (3+ orders) | Cloud banks, rain streaks |
| Fog | All | Orders hidden until your first brew or Discard; you can't deliver until then. Never on a Night Shift | Thick banks rolling across the valley |
| Heatwave | Summer | Ember ingredients +2 Potency | Gold haze, shimmer, drifting motes |
| Snow | Winter | Frost cards are drawn first | Snow clouds, heavy snowfall |

The allowed weather per season is `SEASON_WEATHER` in `src/core/calendar.ts`; the Calendar only rolls from that list, with the balance tables' weights (`WEATHER_WEIGHTS`). Night Shifts roll weather too.

*Balance note (M3 part 2):* the tables had Rain cost an order on every rainy day. In the sim that halved the greedy win rate (27.6% to 16.1%), because spring rains a third of the time and week 1-3 days only have 1-2 orders. Rain now only keeps a customer home on a busy day (3+ orders), which puts the win rate at 29.1%.

*Balance note (Oct 8 audit):* weather only boosts. Rain also helps Tide, and a Heatwave no longer weakens Tide. The sim showed Summer far too hard (5% wins) because its rent rises 15% and its pay didn't, so Summer orders now pay ×1.15 too. Dusk Shard (a Lunar card usable by day) was cut: it made Moonmilk a sure Superb in week 1.

*Balance note (M4 Winter tuning):* Winter won 8% of bot runs. Its rent was ×1.52 but its orders paid ×1, and week 1's rent of 30 sank about 7% of seeds whatever the bot did. Week 1's rent is now the same 20 gold in every season, so a run can't be lost to a cold deal before the deck has grown, and Winter orders pay ×1.2. The flat week 1 lifted Autumn to 40%, so Autumn orders pay ×1.15 instead of ×1.25. See `docs/balance-m4.md`.

*Balance note (M4 ramp pass):* once orders were fair (every order reachable), the bot won 70 to 77% of Year 1 runs in every season, and rent almost never ended a run: nearly every loss was the Moonless Patron. Rent is now 20 / 68 / 155 / 295 (was 20 / 45 / 90 / 160), week 1 ramps 20 / 22 / 24 / 26 by season (decided with Jacob), and later seasons' pay trails their rent (×1.2, ×1.23, ×1.35 against ×1.15, ×1.32, ×1.52). Runs are now lost across weeks 2 to 4, and Year 1 wins about 40 / 34 / 29 / 23%. See `docs/balance-m4.md`.

*Balance note (recipe choice):* letting you pick the recipe when the cards fit more than one lifted the bot's win rates 4 to 9 points, so rent rose about 4% (20 / 71 / 161 / 307) and Winter's multiplier eased to ×1.48 to bring Year 1 back to about 40 / 33 / 27 / 20%.

**Town events** (about one per week, a story choice at twilight, replacing that day's errand choice):

- A travelling alchemist offers a trade.
- A cat moves into the shop and becomes a free familiar.
- The well runs dry: Creekwater costs double for 2 days.
- A wedding: a big order for 5 Calming potions by the end of the week.
- The Guild inspector visits: a Superb potion that day earns a rent discount.
- Plus the ~20 small Events from §7 (fae visits, shop mishaps).

**Seasonal festivals** are market fairs (fixed on week 2, day 3 of every run, visible from the start; moved from week 3 with Jacob on Oct 15 so what you buy lasts about half the run. Winter's vigil may sit later, closer to the solstice, and is decided with its design). The day plays as normal; after closing, the fair replaces the twilight reward pick and the errand. It is held at twilight, lantern-lit in the square: a short scene screen the first time, then a row of festival-only stalls selling cards, familiars and relics for gold (all `pool: 'event'`, so they never turn up anywhere else). You buy what you like and head home. No contests, games or tickets (decided with Jacob, Oct 15: a festival means one thing, a market). *Walkable (Jacob, Oct 21):* the fair is held in the Night Market's fountain square, walked as on market nights, at twilight rather than night: a thinner violet dusk, lanterns lit. Only the fair is set up ("festival only", Jacob chose it over shuttered night stalls or added townsfolk): its three stalls stand west, east and at the top of the square where the Fortune Tent and the Name-Taker stand on market nights, under cloths striped with cream, and the other stall spots carry the season's dressing instead: maypoles and tables of cakes in spring, posts strung with firefly jars and tables of fruit and lemonade in summer, hay bales with a scarecrow and tables of pies and cider in autumn. Bunting is strung from the fountain's crescent out over the square (summer's has little lanterns on it). Walking up to a stall and pressing F (or clicking it) opens its stock over the square, with Back to the square (or Esc); Tab lists the three stalls, and the bridge says "Head home". There is no rent at a fair. The old festival rules (Bloomtide's double Flower pay, the Harvest Fair's two-potion orders, Longest Night's bigger Night Shift) are dropped.

| Season | Fair | Stalls |
|---|---|---|
| Spring | The Bloomtide Fair | The Flower Grower (Flower ingredients), the Beekeeper (bee familiars, honey Tinctures, the Hive Smoker), the Garland Weaver (garland relics) |
| Summer | The Firefly Fair | The Orchard Keeper (Fruit), the Glassblower (light and glass Tinctures, the Dragonfly, Shelf and night relics), the Hatter (sunny-day relics, the Cricket) |
| Autumn | The Harvest Fair | The Farmer (harvest ingredients, the Scarecrow), the Cider Maker (cider Tinctures, the Badger, Fence and rent relics), the Straw Weaver (straw relics, the Harvest Hare) |
| Winter | The Longest Night | A vigil rather than a fair, on the eve of the finale (week 4, day 4): regulars bring gifts and you choose a blessing for the Moonless Patron's night |

Bloomtide's stock, six per stall with two set out each fair:
- *The Flower Grower:* Maybloom (Rare, Vital+Gale, Potency 7, +1 Harmony per Flower in the brew, 10g), Primrose (Rare, Vital, Potency 6, +1 Potency for the run each time it is brewed, 10g), Bluebell (Uncommon, Tide+Umbra, Potency 5, +3 Potency on rain days, 7g), Snowdrop (Uncommon, Vital+Tide, Potency 5, +2 Harmony on the day's first brew, 7g), Cowslip (Uncommon, Gale, Potency 5, draw a card when brewed, 7g), Daffodil (Rare, Ember+Vital, Potency 7, +2 Potency per other Flower in the brew, 10g).
- *The Beekeeper:* the Bumblebee (Uncommon familiar: Flower ingredients +3 Potency, 14g), the Queen Bee (Rare familiar: brews with 2+ Flowers get ×1.5 Harmony, 18g), Royal Jelly (Rare Tincture: Bless a card in hand, 9g), Beeswax Candle (Tincture: next brew +3 Harmony, 6g), Spring Mead (Tincture: +1 Brew today, 9g), the Hive Smoker (tier 2 relic: your first Discard each day draws 1 extra card, 18g).
- *The Garland Weaver:* the May Crown (tier 2: deliveries with a Flower ingredient pay ×1.25, 18g), the Daisy Chain (tier 1: Blessed cards also get +2 Potency, 14g), the Maypole (tier 2: the day's first brew gets +1 Harmony per distinct essence, 18g), the Flower Basket (tier 2: +1 hand size on Clear days, 18g), the Ivy Wreath (tier 1: the Fence pays +25%, 14g), Garland (Tincture: Flower ingredients get +2 Potency today, 7g).

Firefly Fair stock (approved Oct 15):
- *The Orchard Keeper:* Sunpeach (Rare, Vital+Ember, P7, +3 Potency on Heatwave days, 10g), Starfruit (Rare, Gale, P8, +1 Harmony per Fruit in the brew, 10g), Wild Cherry (Uncommon, Ember+Umbra, P5, +2 Potency in a three-ingredient brew, 7g), Plum (Uncommon, Tide+Vital, P5, Aged, 7g), Melon (Uncommon, Tide, P6, +2 Harmony on Heatwave days, 7g), the Orchard Basket (tier 1: Fruit ingredients +1 Potency, 14g).
- *The Glassblower:* Firefly Jar (Tincture: draw 3, or 4 on a Night Shift, 6g), Sun Bottle (Tincture: next brew +4 Potency, +8 on a Heatwave, 7g), Prism (Rare Tincture: next brew +1 Harmony per distinct essence, 8g), the Dragonfly (familiar: Gale +3 Potency, 14g), Lantern Glass (tier 2: Night Shifts +1 Discard, 18g), the Bottle Rack (tier 1: +1 Shelf slot, 14g).
- *The Hatter:* the Straw Hat (tier 2: +1 Discard on Clear and Heatwave days, 18g), the Sun Bonnet (tier 1: the first brew on a Heatwave day +3 Harmony, 14g), the Feathered Cap (tier 1: every delivery tips +1 gold, 14g), the Picnic Blanket (tier 2: the day's first filled order pays +3 gold, 18g), the Cricket (familiar: +2 Harmony on Clear and Heatwave days, 14g), Paper Fan (Common Tincture: +1 Discard, 5g).

Harvest Fair stock (approved Oct 15):
- *The Farmer:* Prize Pumpkin (Rare, Vital+Stone, P6, Aged +2 a day, 10g), Hazelnut (Uncommon, Stone+Umbra, P5, +2 Harmony in Protection potions, 7g), Golden Wheat (Uncommon, Vital, P5, +1 Harmony per Stone in the brew, 7g), Russet Apple (Uncommon, Vital+Ember, P5, Fruit, draw a card when brewed, 7g), Chestnut (Uncommon, Ember+Stone, P6, +3 Potency in Warming potions, 7g), the Scarecrow (familiar: +1 Harmony per Vital ingredient, 14g).
- *The Cider Maker:* Spiced Cider (Rare Tincture: next brew +3 Potency and +3 Harmony, 9g), Perry (Tincture: next brew Harmony ×1.5, 7g), Mulling Spice (Tincture: Ember ingredients +2 Potency today, 6g), the Badger (familiar: Umbra +3 Potency, 14g), the Apple Press (tier 2: the Fence pays +3 gold for Fine or better, 18g), the Cider Barrel (tier 1: +3 gold each time you pay rent, 14g).
- *The Straw Weaver:* the Corn Dolly (tier 2: the week's first delivery pays double, 18g), the Harvest Wreath (tier 2: +1 Harmony on every brew in week 4, 18g), the Wicker Basket (tier 1: the Forage gives one more pick, 14g), the Rush Lantern (tier 1: Fog never hides your orders, 14g), the Harvest Hare (familiar: three-ingredient brews +3 Potency, 14g), Threshing Flail (Common Tincture: draw 2, 5g).

Fruit (Sunberry, Blackberry, Hollyberry, Harvest Gourd and the Fruit fair cards) is read only by Starfruit and the Orchard Basket for now; a season-wide hook like Snow's for Frost is left to the systems review (decided with Jacob, Oct 15).

Familiars and relics you already hold stay off the stalls. Each stall lists its stock in codex `fairs` with `show: 2`, and the fair rolls which two come out on the run's seed. Winter has no fair on week 2, day 3.

The Longest Night vigil (decided with Jacob, Oct 15): after closing on week 4, day 4, the vigil replaces the day's reward and errand. Each regular at Friendship level 2 or more brings a gift, which goes into the Night Satchel for the finale: Roast Chestnuts (Ember+Stone, P6, +2 Harmony on a Night Shift), Holly Sprig (Vital+Umbra, P5, Frost, +2 Potency on a Night Shift), Gingerbread (Tincture: next brew +2 Harmony, draw 1), Mulled Wine (Tincture: +1 Brew), Wool Mittens (Tincture: +1 Discard, draw 1) or Snow Globe (Tincture: peek 3 and reorder). Gifts are festival-only. The vigil is walkable too (Jacob, Oct 21): the square under snow, with no stalls set out but candlelit firs and tables of mulled wine and gingerbread where they would stand, strings of little lanterns from the fountain, the Solstice Fire burning on the fountain's bottom step and the town's gifts wrapped on a table by the lane, a parcel for each. Walk up to the fire ("Sit by the Solstice Fire") or the gifts to see the gifts and choose the blessing; the bridge home asks for the blessing first. Then you choose one of three blessings for the finale's Night Shift:
- *Candle in the Window:* the Patron's first order asks one tier lower, the pair to Starlight (decided with Jacob, Oct 21; it used to keep the Grimoire open against the Patron's hidden-Grimoire twist, which is gone).
- *Hearthfire:* +1 Brew.
- *Warm Hands:* +2 Discards.
- *Old Songs:* +2 Harmony on every brew.
- *The Long Watch:* draw 2 more when the shop opens.
- *Starlight:* the Patron's last order asks one tier lower.

Decided with Jacob (Oct 15): six items per stall with two set out per fair, about 15 different pairs per stall, so multi-Year runs see a different spread.

**Sky events** (rare, at most one per run, announced on the Calendar). Eclipse and Meteor Shower are each in about 6% of runs; Blue Moon and the Fae Ring arrive with patrons and fae bargains:

| Event | Effect |
|---|---|
| Eclipse | Day and night ingredients mix for a day (§5.4); Eclipse recipes can be brewed only then |
| Blue Moon | An extra Night Shift with a mystery patron |
| Meteor Shower | Fallen Star can turn up in rewards, the Market and the Forage for a week |
| Fae Ring | A forage errand becomes a fae bargain |

Sky events and festivals feed the Almanac ("brew during an Eclipse", "visit the Bloomtide Fair").

## 5. Cards

### 5.1 Ingredients

The bulk of the deck. Each has:
- **Potency** (number, typically 2-12): the "chips".
- **Essences** (1-2 tags): what recipes it can satisfy.
- **Rarity:** Common, Uncommon, Rare, Lunar.
- **Origin:** Garden, Wychwood, Creek, Mine, Market, Night (flavour + bonus conditions + shared codex with game 2).
- **Optional text effect:** "+2 Harmony if brewed with a Tide ingredient", "When discarded, draw 1".
- **Tags** (flower, root, frost, mineral…) that effects and later systems key on, e.g. Ice Lily's "+1 Harmony per Frost ingredient". The seven tags a rule reads (Flower, Frost, Fruit, Herb, Mineral, Spice and Water) show as small 8×8 pictures in the card's top-left corner, like a suit: a pink blossom for Flower, a snowflake for Frost, a pair of cherries for Fruit, a leaf for Herb, a faceted gem for Mineral, a chili for Spice and a drop for Water, each outlined so it reads at a glance (redrawn in colour, Jacob, Oct 21: the line drawings were too hard to tell apart). A card with two stacks them, and a card with a modifier starts them under its badge. A card's Potency reads as its printed number and then each addition in its own colour (§5.5). Hovering a card shows those tags written out in their marks' colours, under its essences; other tags stay on the tooltip's grey line (Jacob, Oct 17). No tag is on just one card: the balance pass (Jacob, Oct 17) dropped the one-card tags, with Kelpie Pearl moving to Water and Fallen Star to Mineral. So a Frost card reads as Frost at a glance whatever its essences (Jacob, Oct 14; marks in place of the first coloured chips, Oct 15). Every tag is listed when you inspect a card.
- **In season:** the seasons it grows in. In-season ingredients are three times as likely in rewards, the Market and the Forage.
- **Pool:** base (offered from the first run), unlock (offered once unlocked, §13) or event (only from its calendar event).

### 5.2 Essences

Seven essences. Recipes are keyed on essences, not specific ingredients, so many cards can fill a recipe and deckbuilding stays flexible.

| Essence | Theme | Colour cue |
|---|---|---|
| Vital | life, healing, growth | green |
| Ember | fire, warmth, courage | orange |
| Tide | water, calm, memory | blue |
| Gale | air, speed, luck | pale teal |
| Stone | earth, strength, protection | brown |
| Umbra | shadow, secrets, sleep | purple |
| Lunar | moonlight (night only) | silver |

### 5.3 Tinctures (action cards)

From 1.0's action/utility cards. Played from hand, don't use a cauldron slot, don't use a Brew.
Examples: **Stir** (+1 Harmony on next brew), **Forage** (draw 2), **Steep** (next brew's Potency x1.5), **Sift** (discard any number, draw that many; costs no Discard), **Bottle Spare** (next brew yields 2 potions).

Some ask for a target: **Infuse** (a hand ingredient gains +2 Potency for the run), **Taste Test** (see the top 3 cards of the draw pile and put them back in the order you click), **Decant** (raise a Shelf potion one tier, up to Superb). The scene asks for the target after the card is clicked; Cancel puts the Tincture back. "Next brew" bonuses last one brew, except Grimoire Page, which waits for the next Experiment.

### 5.4 Night Satchel (lunar cards)

1.0's Night Deck, reworked for a roguelike:
- A separate small deck (starts empty) built only at the Night Market and from night rewards.
- **First-night gift:** after the week-1 Night Shift you pick 1 of 2 Lunar ingredients for free, so week 2's Lunar orders are reachable.
- Shuffled into your draw pile **only on Night Shifts**. The next morning its cards go back into the Satchel, so the Hearth can't burn them and they never crowd a day.
- Holds **Lunar ingredients** (Lunar essence, high potency, odd effects) and **Omens** (powerful Tinctures with drawbacks). Any Lunar ingredient or Omen you gain goes there; Fallen Star is a day card and goes in the deck.
- **Eclipse** (rare calendar event): the Night Satchel joins that Day, and day/lunar ingredients form special Eclipse recipes.
- The Grimoire's Deck tab lists the Satchel under the deck.

**Omens** (from the balance tables; Cracked Mirror and Moth Swarm are unlocks):

| Omen | Effect |
|---|---|
| Blood Moon | Next brew: Harmony ×2. Lose 1 Discard. |
| Black Cat Crossing | Draw 3, then discard a random card. |
| Raven Call | Gain 1 Brew. Your next delivery earns no Friendship. |
| Witching Hour | Next brew: Potency ×2. Add a Sludge to your deck. |
| Howl | Next brew: every ingredient +2 Potency per Lunar card in the cauldron. |
| Cracked Mirror | Add a copy of a card in hand to your deck. Lose 3 gold. |
| Wishing Star | Your next delivery pays double. Lose 1 Discard. |
| Moth Swarm | Every ingredient also counts as Lunar for your next brew. Your next delivery earns no Friendship. |

### 5.5 Card modifiers

Balatro-style editions applied by events/vendors: **Moonlit** (+Harmony), **Aged** (+Potency each day it's in the deck, resets on brew), **Blessed** (retrigger), **Cursed** (big effect + drawback, from Night Market deals).

*In the build (M3 part 5):* four of the balance tables' five modifiers are in the codex (`modifiers`), with their numbers in `core/modifiers.ts`. A card holds one, and only ingredients take them (a Tincture has no Potency to double). Each shows as a coloured frame and a corner badge on the card, and its hover text says what it does.

| Modifier | In the build | Creek Bank price |
|---|---|---|
| Moonlit | +2 Harmony when brewed. | 6g |
| Aged | +2 Potency each day in the deck, reset when brewed. Not offered for a card that is already Aged (Amber Sap, Lunar Salt, whose own Aged gains 1 a day). | 3g |
| Blessed | Retrigger: the card's own Potency (printed, Infused or tempered, and Aged days) counts again and its scoring effect runs again. Its Friendship and draws on brewing count twice too. | 12g |
| Cursed | The card's own Potency counts again. The delivery earns no Friendship. | not sold |
| Tempered | +2 Potency. | free, one card a visit |

Balance pass (Oct 9, from the balance tables): Aged went from +1 a day for 5g to +2 for 3g because a bot forced to buy it did worse than with the free temper; Moonlit and Blessed stay. Gilded (+gold when brewed, from the balance tables) is cut: forced to buy it every visit, the bot did no better than with the free temper even at +3 gold for 5, so it was a choice that never paid. Forced to buy one modifier every visit, the bot wins more per gold with Blessed than Moonlit, so Blessed isn't overpriced.

*Tempered and Infused (Jacob, Oct 21):* tempering (the Creek Bank's free option, and the Toymaker's and Bell-Ringer's favour) was extra Potency that stacked with a modifier; it is now the fifth modifier, so a Tempered card takes no other and a modified card can't be tempered. Every other source of extra Potency (the Infuse Tincture, the Hollow Tailor, the Cider Press, Primrose growing) is **Infused**: it still stacks, with any modifier and with itself. Wherever you choose a card for a modifier (the Creek Bank, the Shrine Blessing, a favour), cards that already hold one show greyed out; nothing is ever replaced. Each modifier and Infused has a colour (Aged orange, Blessed blue, Moonlit violet, Cursed red, Tempered steel grey, Infused green). A card's Potency reads as its printed number and then each addition in that colour, on the card ("5+2+7") and in its tooltip ("Potency: 5 + 2 + 7", then a line for each, such as "Infused: +2 Potency on this copy." and "Blessed: Retrigger…"). Blessed and Cursed show the card's whole Potency again, Aged the days so far, Tempered +2; Moonlit adds Harmony, so it adds nothing to the number. Saves from before keep their old tempering as Infused.

Moonlit, Blessed and Cursed score at step 3 (§6.3), after the tinctures and before familiars, in slot order. Modifiers come from the Creek Bank (§7), the Name-Taker's Cursed card (§9) and the Fortune Tent's Wheel of Fortune (§9). Dusk events also give them: the Shrine Blessing (Blessed, your choice of card, 6 gold), the Moonlit Walk (Moonlit) and the Kettle (Aged, with a Sludge).

## 6. Brewing

### 6.1 The cauldron panel

From 1.0, cleaned up for mouse and keyboard:
- The cauldron sits centre-screen with **2 slots** (a 3rd unlocks via the cauldron upgrade or certain cards; some recipes need 3).
- Click (or drag) a hand card to drop it in; click a slotted card to return it. Keyboard: number keys select, Enter brews, D starts and confirms a Discard, Esc cancels.
- A brew goes to the best-paying open order it fills (or the one you chose with Fulfill), otherwise onto the Shelf. The preview says which before you brew. An order that asks for a family lists the recipes of it you know (playtest, Oct 16).
- As soon as the slots match something, a **preview** shows: the recipe name and families (if known), its essence pattern, and the projected score.

### 6.2 Recipes

A recipe is an essence pattern with a base Harmony and a potion family. A recipe whose pattern uses the Lunar essence is also in the Lunar family, on top of its own (Jacob, after a playtest, Oct 16): Moonlit Veil is Illusion + Lunar, and fills both Illusion and Lunar orders. Lanternfire Tonic, Corona Draught, Moonlit Veil, Silver Whisper and Umbral Crown are the five with two families. Only orders read the second family; the May Queen's chain, the Fence and family-based cards and commissions still read the recipe's own. *Later idea (Jacob):* orders or quests that need both families, like "a Lunar Illusion potion".

- **Known recipes** are in your **Grimoire**. Each witch starts knowing 4.
- **Unknown but valid** combinations brew as an **Experiment**: the preview shows "???", and brewing it discovers the recipe (added to the Grimoire for this run, and to the permanent Codex) at -1 quality tier for that first brew. This folds 1.0's separate "recipe experimentation" screen into play.
- **Invalid** combinations warn first, then produce **Sludge** if you insist: no potion, and a Sludge junk card is added to the deck (it can be removed at errands).
- **When several recipes match**, you choose (decided with Jacob, Oct 10): the preview starts on the most specific pattern (fewest "any" slots), then the higher base Harmony, then a recipe you already know, then codex order, and a button beside its name (or the R key) steps through the others. A dual-essence card like Mistcap (Tide or Umbra) with Elmroot can brew Healing Draught or Restful Tonic, so it can also teach the one you don't know yet.
- **Pools:** base recipes can be discovered in any run. Unlock-pool recipes need a meta unlock (§13) first, and event recipes (Eclipse) only brew during their event.

### 6.3 Scoring

**Quality = Potency × Harmony**

- **Potency** = sum of ingredient Potency + flat bonuses.
- **Harmony** = recipe base Harmony + bonuses (matching essences, card effects, familiars, cauldron, modifiers), then multipliers.
- Resolution order (deterministic, animated left to right like Balatro): ingredients in slot order → relics and curses that touch ingredients (Pressed Flower, Copper Ladle, Moonsick) → tinctures → card modifiers → familiars in slot order → cauldron. Weather and the patron's twist sit with the ingredients.
- Every step emits an event the UI animates (number pops, cauldron glow, familiar bounce).

### 6.4 Quality tiers

| Tier | Quality | Pay multiplier |
|---|---|---|
| Crude | < 10 | ×0.5 |
| Fine | 10+ | ×1 |
| Superb | 30+ | ×1.5 |
| Masterwork | 100+ | ×2 |
| Legendary | 400+ | ×3 |

Sanity check: a starter Healing Draught (Elmroot 4 + Creekwater 3) × 2 = 14, Fine. Greater Restorative (4 + 4 + 3) × 5 = 55, Superb. Week 4 orders should ask for Masterwork, which needs familiars and modifiers. Thresholds scale up across weeks via order difficulty, not by changing the tiers.

Pay, tips, Fence prices and shop prices live in `src/core/rules.ts` and are tuned with `pnpm sim`. As of M1, a Fine order in week 1 pays about 3 gold, and pay grows about 15% a week on top of the tier multiplier.

### 6.5 The Shelf

Brewed potions not delivered go to the Shelf (4 slots, upgradable). Shelf potions can fill later orders (from 1.0's "fulfil from inventory"), carry between days, and sell at the Night Market. Potions on the Shelf at rent time are not worth anything unless sold. A Shelf potion can be poured away during a day for one of the day's Discards (the Pour out button, then the potion; no right-click shortcut, so it's always deliberate, Jacob, Oct 21), so a full Shelf costs a choice rather than a brew (pouring was free until the balance pass, Jacob, Oct 17: a Shelf of the best potions was trivial to keep); hovering one shows its quality, ingredients, the order it would fill and what the Fence pays (decided with Jacob).

## 7. Dusk errands

After the reward pick, choose one of two offered errands. This is the run's branching.

| Errand | Effect |
|---|---|
| Market Square | Coin shop: ingredients, tinctures, a familiar or two, Shelf upgrade. |
| Wychwood Forage | Choose 2 of 5 Wychwood ingredients for free. Small chance of a fae encounter. |
| Creek Bank | Upgrade a card's Potency, or add a modifier. In the build: temper an ingredient (the Tempered modifier, +2 Potency, §5.5), free, or buy it a modifier at its price (§5.5). One card a visit. |
| Guild Hall | Take a Guild Commission (multi-day quest: "deliver 3 Superb Calming potions by the Full Moon" → relic reward). From 1.0's guild quests. In the build: two of the ten commissions are offered (codex `commissions`, goals in `core/commissions.ts`); take one or none, and hold at most two. Each is due by a Night Shift: this week's when taken by day 2's dusk, otherwise next week's, so there are always two days and a Night Shift to work on it (a longer deadline adds weeks; Full Moon Favour is always due on week 2). Finishing pays gold, a relic or a free card pick; a lapsed commission costs nothing. The Hall isn't offered while you hold two. Progress shows under the rent line. |
| Hearth (rest) | Remove a card from the deck (one per visit; the deck never drops below 8), or lift a Curse instead. |
| Event | One of ~20 small events (fae visits, shop mishaps, a festival) with choices. From 1.0's random encounters. In the build: all 20 from the balance tables (codex `duskEvents`, rules in `core/dusk-events.ts`), rolled by weight; the last 12 were approved by Jacob on Oct 16. Three differ from the tables: Friendship never drops, so the Spice Merchant's Haggle costs a Bad Omen instead and turning down Pip & Quill's Dare costs nothing; and An Old Cookbook only comes once the Grimoire Page is unlocked, since it sells one. Leafing through the Cookbook shows the month's patrons, which only matters from Year 2. Some choices ask for a pick: a deck card (the Shrine Blessing, An Apprentice Asks, which won't take junk), a Shelf potion (A Changeling Bottle lifts it one tier), a recipe learned this run (Sell a Recipe) or a new card (the Spice Merchant). Bea's Bake Sale takes your lowest Warming potion. Next-day effects (the Pixie Thief's -1 Discard, Bea's bun's +1 Brew, the Fae Bargain's skipped reward, the Dare's blind brew) carry over in the run state. Market Day opens the Market Square with every price 25% off, rounded to the nearest gold. You make one choice, then head home; a choice you can't afford is greyed out with the reason, and you can only leave without choosing when every choice is out of reach. The Bargain Bin gained a free "Walk on" so it never forces a purchase. The errand reads "Something Afoot" until you open it. |

## 8. Rewards

- After each Day/Night: pick 1 of 3 cards, or **Skip**.
- **Skip pity** (from 1.0): each consecutive skip raises the rarity odds of the next offer and pays 2 gold.

## 9. The Night Market

Opens after each Night Shift, before rent. A street of stalls; you can visit them all, and stock depends on moon phase.

| Stall | Trades in | Example |
|---|---|---|
| The Lantern Seller | Gold | Lunar ingredients (7 gold), Omens (6 gold). Priced so the week-1 Market is affordable. |
| The Moth Broker | Memories | Forget a known recipe this run → gain a rare card or familiar. |
| The Hollow Tailor | Cards | Give up a card permanently → its essence is woven into another card (merge). |
| The Name-Taker | Your name | Take a Curse (persistent run debuff) for a powerful Cursed card or relic. |
| Fortune Tent | Gold, gamble | Draw a tarot: big boon or a twist on next week's orders. |
| The Fence | Potions | Buys your Shelf at night prices; pays more for Umbra and Lunar potions. |

Phase flavour: First/Last Quarter nights have 3 stalls. Full Moon has all stalls plus a rare visiting vendor. New Moon (finale) has the black-market stock before the final rent.

**In the build (M3 part 4).** The street shows tonight's stalls; walk up to any of them, trade, walk back, and pay rent from the street.

**The walkable square (M5, Jacob, Oct 19).** The Night Market is the town square after the Night Shift, seen from above like the walkable cottage and drawn in code from Jacob's four seasonal night concepts (Oct 19; Oct 21 he asked for the concepts themselves, layout and all, widened at the sides to fit the screen): a timber house in the top corner, a moon fountain on a stepped dais in the middle, eight cloth-hung stalls in a ring round it with a rug before or beside each, a waterfall and stream down the right, and along the front a fence and flower beds, the gate with its crescent banners and bunting, the steps down to the bridge you came in by, and dark water with a little dock. You walk it with WASD or the arrows as in the cottage. Every stall has its own spot, so the Fence is always in the same corner: the Lantern Seller, the Fortune Tent, the Name-Taker and the Fence round the top of the ring; the season's two stalls on either side (the Seed Swapper, the Firefly Games and the Cider Press to the west, the Blossom Oracle, the Nectar Trader and the Harvest Auction to the east); the Moth Broker and the Hollow Tailor below them. The Black Market sets up on the fountain's steps at the new moon, the Wandering Tinker pitches his cart on the rug by the gate at the full moon, and the Hearth Trader keeps the fire pit lit every Winter night in its clearing below the fence. Tonight's stalls are lit; the rest stand shuttered. Walking up to an open stall lights it with a prompt ("F  Visit the Fence"), and F, Space or a click opens its screen over the square; hovering a stall says what it trades. For anyone who'd rather not walk, Tab or the "Tonight's stalls" button lists the open stalls with what each trades, and a click visits one; stock is still seen at the stall (Jacob, Oct 19). Walking back onto the bridge offers the rent ("F  Pay 20g rent and go home", or "Can't pay: leave"), and clicking the bridge does the same. The square is dressed for the season in code: blossom in spring, deep green and fireflies in summer, leaves and pumpkins in autumn, snow and bare trees in winter; Snowed In, drifts bury the shuttered stalls and only the Hearth Trader's fire is lit. Familiars stay off the square (they show at the stalls). The trees and shrubs follow the season: blossom in spring, deep green with fireflies in summer, red and gold with pumpkins in autumn, bare branches with snow along them in winter, a pine among every few (Jacob, Oct 21), when snow covers the square but for the paths trodden to the stalls, round the fountain and down to the gate. *Moonlight (Jacob, Oct 21):* night lies over the square, deepest away from any light, so the lanterns, windows and fire carry it; how dark depends on the moon, lightest at the full moon, darker at the quarter and darkest at the new moon, and a little darker in winter, when the snow throws the moonlight back.

- **Which stalls open.** The Lantern Seller and the Fence open every night. On a quarter moon (weeks 1 and 3) one more is drawn from the Moth Broker, the Hollow Tailor, the Name-Taker and the Fortune Tent. The full moon (week 2) has all of them plus **the Wandering Tinker**: a cauldron slot for 12 gold and a Shelf slot for 4. The new moon (week 4) has all of them plus **the Black Market**: 3 Rare cards at 14 gold each, or any 2 cards from your deck, and a tier 2 relic at 25 gold.
- **The Lantern Seller** stocks 3 Lunar ingredients at 7 gold and 2 Omens at 6. They go in the Night Satchel.
- **The Moth Broker** takes one recipe a night, never one of the witch's four starting recipes, for 1 of 3 Rare ingredients. Brewing the recipe again teaches it again. After he takes the memory he also offers 2 familiars, so the pick is 1 of 3 Rare cards or 2 familiars.
- **The Hollow Tailor** sews one card a night. Give up a day ingredient; its first essence is sewn into another day ingredient, in place of that card's second essence, with +1 Potency. Lunar and Satchel cards stay out of it, so Lunar never reaches the day (the reason Dusk Shard was cut). The deck can't drop below 8.
- **The Fortune Tent** costs 5 gold, then 3 more for each further draw that night. Its deck is in the codex (`tarot`). Boons happen at once. The Hermit and The Tower change next week's day orders: one fewer a day at +50% pay, or one tier harder at double pay. The Moon fogs next week's four days on the Calendar. Next-week twists aren't drawn in week 4. The Chariot gives a random familiar, or 10 gold with every slot taken. The World gives a tier 2 relic, or 12 gold if you hold every relic. Wheel of Fortune blesses a random ingredient in your deck that can take it, or gives 8 gold if none can.
- **The Name-Taker** offers 2 deals a night and makes one: take a Curse you don't carry for the rest of the run, and a relic for it. The relic's tier is the Curse's severity, so Nameless or Leaky Roof buys a tier 1 relic and Unpaid Debt or Heavy Hands a tier 3. (The balance tables gave tier 2 for any Curse and tier 3 for severity 3. In the sim the mild Curses cost almost nothing, so Spring wins rose from 29% to 47%; matching tiers puts them at 35%.) Each deal also offers a Rare ingredient with the Cursed modifier: take the Curse for the relic or for the card, not both.
- No relic is offered twice in one night: the Black Market, the Name-Taker's deals and The World skip each other's.
- **Relics bought on the new moon** come after the last Night Shift, so only the Guild Seal (cheaper final rent) helps. Worth revisiting with the Long Year mode.
- The Wandering Tinker sells one Rare familiar at a quarter off.

**Seasonal stalls (M4).** Each season brings its own stalls from the balance tables. They are drawn with the Moth Broker, the Hollow Tailor, the Name-Taker and the Fortune Tent, so a quarter-moon night opens one of them about a third of the time, and they all open at the full and new moon. (The tables said each would *replace* a random stall on quarter nights; drawing them with the others keeps the Lantern Seller and the Fence on every night.)

| Stall | Season | Trade |
|---|---|---|
| The Seed Swapper | Spring | Give 2 Common cards from your deck and 5 gold for 1 of 3 Uncommon cards. One swap a night; the deck can't drop below 8. (The tables had no gold; see the balance note.) |
| The Blossom Oracle | Spring | 4 gold: next week's four days roll their weather again. Once a night; stays away in week 4. (The tables' second option, revealing next week's town event, is dropped: the Calendar already shows it.) |
| Firefly Games | Summer | A ring toss for 3 gold, as often as you like. One in 3 wins a pick of 2 familiars, or a random Uncommon card if your slots are full; a miss wins a random Common card. |
| The Nectar Trader | Summer | Your lowest Superb-or-better Shelf potion for 1 of 3 Rare cards. One trade a night. |
| The Cider Press | Autumn | Your lowest Shelf potion is pressed, and one ingredient in your deck gets +2 Potency for the run. Up to 3 a night. |
| The Harvest Auction | Autumn | One sealed bid (12, 15, 18, 21 or 24 gold) for a tier 2 relic against the farmers' hidden bid of 12 to 24. Win at or above it and pay your bid; lose and pay nothing. |
| The Hearth Trader | Winter | Open every Winter night, with three trades, each once a night. **Trade:** 6 gold, on the name of a regular at Friendship 2 or more, for 1 of 2 Rare cards or a familiar; once your best friend among the regulars reaches Friendship 6 he shows a third Rare card (Friendship, Oct 15: this was 5 hearts with one regular, spent; the tables had 3 hearts and two familiars). **The Yule Log:** 4 gold to burn 1 or 2 cards from your deck for good; the deck can't drop below 8. **The Holly Crown:** 8 gold for 1 of 2 Frost familiars (the Frost Hare and the Ermine) you don't have, if a slot is free. |

Stalls that take a potion take your lowest one (by tier, then quality), and say which on their sign.

**The Winter Night Market (decided with Jacob, Oct 14).** Winter is the finale of the Year, so its market is the most different, while every stall still takes gold. (This replaces the Frost Market, where no stall took gold: closing the shops at the holidays felt wrong, and Winter stays the hardest season through rent and pay instead.)
- **Snowed In:** when a quarter-moon Night Shift (weeks 1 and 3) is snowy, there is a 1 in 2 chance the lane drifts over and only the Hearth Trader opens. The Calendar marks it on the night's cell. The first time each night, a short scene says why.
- **The Fence** wants warmth: Warming potions sell for ×1.5 and the rest for ×0.9 (`WINTER_FENCE`). Umbra and Lunar still fetch half again on top.
- **The Wandering Tinker** also brings a Frost familiar you don't have, at the usual Tinker price.
- **The Ermine** (Uncommon, Frost ingredients +3 Potency) is an event-pool familiar, found only through Winter's trades.
- **The Lantern Seller** runs low on Lunar stock (2, not 3) and keeps a **Yule Candle** by the Omens at the usual 6 gold: gain 1 Brew, lose 5 gold (agreed with Jacob: the first idea, a Brew and a Discard for 3 gold, was too cheap). It's an event-pool Omen, so it's only found here.

### Relics and curses

Relics are run-long passives with no slot limit, never sold for gold. They come from patron rewards, the Name-Taker, the Black Market, The World and Guild Commissions, and festival fairs sell a few of their own. Curses are run debuffs, taken only at the Name-Taker; the Sleepless Miller and the Hearth lift them. Both are in the codex (`relics`, `curses`) with their numbers in `core/relics.ts`, and show as tokens between the Grimoire button and your gold; hover one for what it does.

| Relic | Tier | Effect |
|---|---|---|
| Copper Ladle | 1 | +1 Harmony on every brew of 3 ingredients. |
| Guild Seal | 1 | Rent -10%. |
| Lucky Horseshoe | 1 | Reward picks offer 4 cards instead of 3. |
| Pressed Flower | 1 | Flower ingredients +2 Potency. |
| Apprentice's Ledger | 1 | +1 gold per order filled. |
| Silver Bell | 1 | +1 Friendship on every delivery to a regular. |
| Old Almanac | 2 | +1 Discard on Rain and Fog days. |
| Spare Satchel | 2 | +1 hand size. |
| Witch's Hatpin | 2 | Experiments brew at full quality. |
| Mortar and Pestle | 2 | Brews with 3 or more ingredients get +2 Harmony. (Replaced Iron Lid, with Jacob, Oct 21.) |
| Moon Locket | 3 | +1 Brew on Night Shifts. |
| Kettle of Plenty | 3 | Potions brewed once every order is resolved go to the Shelf one tier higher. |

| Curse | Severity | Effect |
|---|---|---|
| Nameless | 1 | Regulars don't recognise you: no Friendship this run. |
| Leaky Roof | 1 | Shelf -1 slot (given back when lifted). |
| Sour Luck | 2 | Reward picks offer 2 cards, and skipping no longer improves them. |
| Moonsick | 2 | Night Satchel cards -2 Potency. |
| Heavy Hands | 3 | -1 Discard every day. |
| Unpaid Debt | 3 | Rent +15%. |

*Mortar and Pestle (replaced Iron Lid, with Jacob, Oct 21):* a starter relic like the Lid was. It counts the ingredient cards brewed, so four count too, and it stacks with the Copper Ladle on a brew of exactly three (+3 Harmony in all). Saves that held or had met the Iron Lid hold or have met the Mortar instead. It is the first relic with its own 16×16 icon, shown where relics are offered (market and fair stalls, the auction, the Name-Taker); the row of held relics keeps the small tier medallions.

*In the build (M3 part 5):* the Kettle of Plenty counts an empty Order Board as every order resolved. The Hearth lifts the Curse you pick; the Miller lifts the oldest. Lifting a Curse undoes it from then on.

*Balance note (M3 part 5):* relics and curses move the greedy bot from 25.7% to 35.1% Spring wins (1,000 runs; Summer 23.0% to 28.1%, Autumn 29.2% to 37.3%). Almost all of it is the Name-Taker: with the bot never taking a deal, Spring sits at 29%. The bot never takes a severity 3 Curse, so the Kettle of Plenty is untested by the sim.

## 10. Night Shift patrons (bosses)

Each Night Shift has one featured patron with a rule twist, shown on the Calendar a week ahead.

In the build the whole month's patrons are rolled at run start (on their own seed stream, so a seed's weather doesn't change) and shown on the Calendar's Night cells, in the HUD line and in the morning side panel. Week 2 is always the Pale Courier and week 4 the Moonless Patron; weeks 1 and 3 draw from the rest that fit the season, never the same one twice. The patron's order is the first on the board, one tier harder (capped by what the deck can reach, like every order), and filling it pays their reward on top. Night customers fill the other orders. A Night Shift posts the patron's `orderCount` orders in all (Rain keeps one night customer home on a 3-order night).

| Patron | Weeks | Twist | Reward for their order |
|---|---|---|---|
| The Lamplighter | 1, 3 | The wicks burn down: each brew that night has 2 less Harmony than the one before (0, -2, -4, ...), so the best brew should come first. Replaced a face-down hand, which was only an inconvenience (playtest, Jacob, Oct 16). | 6 gold |
| Mother Hollow | 1, 3 | Each brew must use an ingredient from a different Origin than the last. | Pick 1 of 2 familiars |
| The Twin Owls | 1, 3 | Every order needs two identical potions, and pays ×2. Two orders. | Pick 1 of 3 Rare cards |
| Sir Bramble | 1, 3 | Ember ingredients have 0 Potency. | 6 gold |
| The Clockless Man | 3 | Orders leave after 2 brews (1.0's "timed orders", as a twist). | Tier 1 relic |
| The May Queen (spring) | 1, 3 | Each delivery must be a different family from the one before. | Tier 1 relic |
| The Firefly Conductor (summer) | 1, 3 | After every brew, your hand is discarded and redrawn. | Pick 1 of 2 familiars |
| The Tithe Reeve (autumn) | 1, 3 | Every brew costs 2 gold; orders pay ×1.5. | 10 gold |
| The Frost Warden (winter) | 1, 3 | Ingredients without the Frost tag have -2 Potency. | Tier 2 relic |
| The Pale Courier (Full Moon) | 2 | Needs a Masterwork Lunar potion; ordinary orders pay double. With no way to brew Lunar yet, it asks for your best family at your best tier, and its twist text on that night says so. | Tier 2 relic |
| The Moonless Patron (finale) | 4 | No twist: three escalating orders (Superb, Masterwork, Masterwork, capped by reach), all of which must be filled. The Grimoire stays open (decided with Jacob, Oct 21). | The month |

Familiar picks offer real familiars, and a relic reward gives a random relic of that tier you don't hold (the nearest tier if you hold them all, or 8 / 12 / 16 gold once you hold all 12).

*The finale on screen (decided with Jacob, Oct 21):* the Moonless Patron no longer hides the Grimoire; the three orders are the whole challenge, and the screen keeps them in view. Each of their tickets says which it is and what it's for ("1 of 3 · all three win the month"), the HUD counts the filled ones all night ("Moonless Patron: 1 of 3"), and End day with any of their orders still open asks first ("The Moonless Patron still wants 2 orders. Ending now loses the month. End anyway?"). It never blocks: confirming ends the day as before, and the month is lost.

*Balance note (M3 part 3):* requiring all three of the Moonless Patron's orders dropped the greedy bot from about 27% wins to 5% in Spring (two of three: 17%, one of three: 25%), because Masterwork is out of reach without familiars and the Night Market. The build still needs all three, as designed (`FINALE_ORDERS` in `rules.ts`), so expect a low win rate until those systems land.

## 11. Familiars (jokers)

Up to 4 familiar slots (5 with an upgrade). Passive, order matters.

| Familiar | Effect |
|---|---|
| Black Cat | +3 Harmony per Umbra ingredient. |
| Hearth Toad | +1 Harmony for each potion on your Shelf. |
| Barn Owl | See the top 3 cards of your draw pile. |
| Moth | Lunar ingredients count as every essence. |
| Raven | +3 gold whenever you decline an order (rude, but practical). |
| Hedgehog | Stone ingredients +4 Potency. |
| Will-o'-Wisp | First brew each day: ×2 Harmony. |
| Ferret | Every 3rd discard draws an extra card. |

The full familiar list and rarities are in the balance tables. The Salamander is Common (it matches the Common Heron's +3).

*In the build (M3 part 5):* all 20 familiars from the balance tables are in the codex (`familiars`), with their numbers in `core/familiars.ts`. The Magpie, Fox, Old Hound and Hob are unlock-pool. They cost 8 / 12 / 18 gold by rarity and sell for half (rounded down) from their card, which opens by clicking a slot in the familiar row (bottom right); the card also moves a familiar left or right. A full row refuses a new familiar until you sell one. Familiars come from the Market Square (one a day), patron picks (Mother Hollow, the Firefly Conductor), the Moth Broker, the Wandering Tinker and The Chariot.

Scoring familiars resolve after Tinctures, one step each, in slot order. Choices the tables left open:
- **Hob:** "retrigger the first ingredient" adds its Potency again (with its Infuse and Aged bonuses). Its text now says "The first ingredient's Potency counts twice."
- **Moth:** Lunar ingredients count as every essence for recipe matching and essence bonuses, so a Lunar card can fill any slot.
- **Will-o'-Wisp:** the first brew of the day is the first one brewed, whatever it makes.
- **Fox:** doubles only the tip for beating an order's minimum tier, not bonus tips.
- **Ferret:** counts Discards across the whole run, not per day.
- **Tortoise:** pays at End Day for each Brew left.
- **Barn Owl:** shows the top 3 draw-pile cards above the deck while you brew.

*Balance note (M3 part 5):* familiars bring the greedy bot back into the 15-35% target band (Spring 4.8% to 25.7%, Summer 2.2% to 23.0%, Autumn 3.9% to 29.2% over 1,000 runs). The bot ends a run holding 2.7 familiars on average and never buys the Barn Owl, Ferret, Raven or Frost Hare on purpose, so those are untested by the sim.

## 12. Witches and cauldrons (run starts)

Pick a **Witch** (starting deck, 4 known recipes, a quirk) and a **Cauldron** (run modifier, like Balatro decks). From 1.0's specialisation tree.

*In the build (decided with Jacob, Oct 15):* five witches, each mildly themed on a season, and five cauldrons. Only the Hedge Witch and Copper are open at first. Each season's first win opens its witch; the cauldrons open with Almanac entries. The cottage has a Witch and Cauldron panel with arrows for each: a locked one shows dimmed with what opens it, and the last open pick is remembered for later runs. The end screen says when a run opened one, and hovering the Year line in a run shows the witch's quirk and the cauldron's effect. Unlocks add breadth, not power: every quirk trades or narrows something. The tutorial and fixtures play the Hedge Witch in Copper. The once-a-day quirks (Bloom, Alchemist, Illusionist) share one daily flag, `quirkUsed`, reset each morning.

| Witch | Opens | Focus | Starting deck (14 cards) | Quirk |
|---|---|---|---|---|
| Hedge Witch | start | Vital, Tide; healing | §14 | Hand size 8 (the others 7). |
| Bloom Witch | win Spring | Vital, Gale; Flowers | Elmroot ×3, Thistledown ×3, Dandelion Fluff ×2, Creekwater ×2, Emberbloom, Sunflower, Mint Sprig, Stir | The day's first brew with a Flower in it: +2 Harmony. |
| Alchemist | win Summer | Stone, Ember; transformation | River Clay ×3, Emberbloom ×3, Iron Filings ×2, Elmroot ×2, Hearth Coal, Creekwater, Honeycomb, Simmer | The first Experiment each day brews at full quality; hand size 8. |
| Illusionist | win Autumn | Umbra, Gale; glamours | Nightshade ×3, Thistledown ×3, Inkcap ×2, Creekwater ×2, Emberbloom, Elmroot, Mistcap, Taste Test | Once a day, a potion can fill an order for another recipe of the same family. |
| Frost Witch | win Winter | Tide, Umbra; Frost | Creekwater ×3, Nightshade ×2, Elmroot ×2, Thistledown ×2, Frostcap, Hollyberry, Pine Resin, Inkcap, Stir | +1 card in hand on Snow days. |

*Home seasons (the balance pass, Oct 17):* each witch but the Hedge Witch has +1 Discard a day in the season whose win opens her (Bloom Witch Spring, Alchemist Summer, Illusionist Autumn, Frost Witch Winter), so each one is the strongest pick in her own season. Before it, no witch won more in her own season. The Alchemist also got a hand of 8: she was the weakest witch everywhere.

Known recipes: Bloom Witch Four-leaf Tea, Healing Draught, Calm Waters, Fleetfoot Elixir; Alchemist Courage Cordial, Ironhide Salve, Hearthwarm Tonic, Mudbath Salve; Illusionist Whisper Ink, Sleep Syrup, Fleetfoot Elixir, Restful Tonic; Frost Witch Sleep Syrup, Calm Waters, Healing Draught, Restful Tonic.

| Cauldron | Opens (Almanac) | Effect |
|---|---|---|
| Copper | start | No surprises. |
| Iron | Open for Business | 3 slots from the start, -1 Brew a day. |
| Glass | A Masterwork | +1 Harmony on every brew (a cauldron step, last), -1 card in hand, -1 Discard a day. |
| Bone | A Nameless Deal | 2 Lunar ingredients in the Night Satchel from the start; rent +5%. |
| Silver | A Legend Thrice | +1 Discard a day; orders pay 5% less (set when the order is posted). |

Glass first showed exact previews, but the previews already do; and an "always see the next 3 cards" cauldron was dropped because it makes Taste Test pointless (Jacob, Oct 15). Silver opens with A Legend Thrice, three Legendary potions in one run: Shopkeeper, then a single Legendary, were too easy (a Legendary came in a first Spring). Each cauldron has its own metal on the shop counter (`CAULDRON_METAL` in `art/procedural.ts`). How the witches do in their own seasons is a question for the M4 balance pass.

## 13. Meta-progression

Elmbrook is a roguelite: every run, won or lost, moves something forward.

- **The Year:** Spring is open from the start. Winning a season unlocks the next (Summer, then Autumn, then Winter). Clearing Winter completes **Year 1** and shows a short "year in Elmbrook" ending. Each later Year is a difficulty level, like Ascension in Slay the Spire or Heat in Hades: it keeps every earlier Year's rule and adds one of its own, up to Year 10.
- **Choosing a Year** (decided with Jacob, Oct 9; replaces the earlier retire-or-loop choice): every Year you have reached is a level you pick at the cottage, and each Year keeps its own open seasons, starting again at Spring. Winning Winter in your top Year opens the next Year. That is locked at first: Year 1 always just ends with the ending, and the next Year opens from the second Year won, or earlier once 25% of the Almanac is done. The first time you choose a new Year you pick a **boon** from three, and it stays with that Year (a starting relic, +1 familiar slot, a Blessed card in the starting deck and the like). A boon's slot goes past the cap the perks reach (up to 6 familiars or 7 Shelf slots), so it always does something (the balance pass). Each Year multiplies the Reputation it earns (×1.5 for Year 2, ×2 for Year 3), so climbing is worth more than replaying Year 1. A Year is not a replay of the month: a single run always ends at its new moon.
  *In the build (M4 part 1):* the profile (`core/meta.ts`) records the open seasons, runs, wins by season and Years done. A win opens the next season with a line on the victory screen. After the tutorial, every run starts and ends at **the cottage** (the `Cottage` scene, a painted backdrop): its Year panel lists the four seasons, and you set out for an open one (or press 1-4); a locked one says which win opens it. The end screens offer the same season again or Home, and say how much Reputation the run earned.

  *The ending and the Years (M4 part 6):* every Winter win plays the short ending ("A Year in Elmbrook") and counts a Year; there is no choice on that screen. When the win opens a new Year the ending says so and points to the cottage (`RunOutcome.newYear`). The profile keeps each Year's open seasons (`yearSeasons`), the Year chosen (`year`) and each Year's boon (`boons`). The cottage's Year panel has arrows (or the left and right keys) to change Year, and lists the Year's Reputation multiplier, its rules and its boon. Choosing a Year above 1 with no boon yet opens a must-pick of three from A Lucky Find (a random tier 1 relic), Blessed Hands (a random starting card Blessed), Another Perch (+1 familiar slot), Winter Savings (+15 gold) and A Taller Shelf (+1 Shelf slot); boons are codex data (`boons`). Each Year adds one rule and keeps the ones before it (`core/year.ts`, `YEAR_MODIFIERS`; decided with Jacob in place of rent and pay multipliers): Year 2, patrons stay hidden until the day before their Night Shift; Year 3, a Cobweb in the starting deck; Year 4, one fewer Night Market stall; Year 5, one fewer Discard a day; Year 6, week 2 orders ask for Superb or better (week 1 orders are already Fine, so this replaced the first idea of "week 1 Fine"); Year 7, a random Curse at the start; Year 8, the Shelf holds one less potion; Year 9, reward picks offer one card fewer; Year 10, the Moonless Patron asks one tier higher (the finale already needs all three orders, so this replaced "all three orders"). Rent also rises 6.5% for each Year after the first (the balance pass, Oct 17; was +5% from Year 2 and +25% from Year 4), so the climb is steady and perks still help. The bot's Spring win rate falls from 40% in Year 1 to about 15% in Year 10.

  *Reputation and perks (M4 part 3):* a run earns 4 Reputation per week's rent paid, 1 per order filled, 1 per potion sold and 10 for a win (`REPUTATION` in `core/meta.ts`). The cottage's perk board sells four perks, once each: Nest Egg (+5 starting gold, 15), A Deeper Shelf (5 Shelf slots, 20), Gran's Spoon (a Stir in the starting deck, 25) and A Spare Perch (+1 familiar slot, 35). Perks are codex data (`perks`) and apply at run start, never to the tutorial. The Night Market reroll from the list above needs a reroll mechanic first and is left for later. A Winter win counts a Year.

  *Perks for the long game (decided Oct 9; built in M4 part 7):* four perks are bought within two or three runs, and later Years multiply Reputation, so the board grows in tiers. The cottage's perk board shows one tier at a time with arrows; a tier not yet open shows its perks dimmed and what opens it, and the end screen says when a run opened one. Tier 1 is open from the start (the four perks above). Tier 2 opens when you win a Year or finish 4 Almanac entries: A Full Purse (+5 gold, 45), A Blessed Ladle (a random starting card Blessed, 55), Tidy Habits (two Tidy Ups in the deck, 60) and Gran's Charm (a random tier 1 relic, 70). Tier 3 opens at Year 3 or 8 Almanac entries: A Wide Shelf (+1 Shelf slot, 120), Gran's Notes (a Steep and a Sift in the deck, 130) and Twice Blessed (another Blessed starting card, 150). Tier 4 opens at Year 6 or the Almanac's whole first page (13 entries): A Savings Jar (+10 gold, 220), The Heirloom (another random tier 1 relic, 260) and A Bigger Cauldron (+1 cauldron slot, 320). That is 14 perks; the tiers are `PERK_TIERS` in `core/meta.ts`, and perks and boons share one set of start effects (`RunStart` in the codex schema). Variety in the endgame comes from the Almanac, Year boons and the regulars rather than from perks; a cosmetic Reputation sink (cottage decorations) fits the walkable cottage. Endgame players own every perk, so Years are tuned against an all-perks profile.
- **The walkable cottage** (decided with Jacob, Oct 9; built after the cross-run systems, see milestones M4.5). The cottage grows from a menu over a painting into a small top-down home you walk around, like the House of Hades in Hades and Hades II, but a single open-plan room. The look is top-down Stardew Valley: pixel art that is whimsical, quaint and cozy, in the game's own palette and lighting. You play a simple amorphous little being in wizard's robes and a pointed hat, with no stats or progression of its own. Each corner or nook of the room is where one cross-run system lives, so the house is the menu:
  - the hearth or workbench for Reputation perks;
  - the bookshelf for the Codex and known recipes;
  - the Almanac on a lectern;
  - the regulars' letters and gifts on a pinboard;
  - a wardrobe or cauldron stand for choosing the witch and cauldron (built as the cauldron).

  Walking out of the front door shows the season you'll set out for next, with any other open seasons to choose from. The house follows the Year: its light, colours, window views and props change with the season you're about to play. Come home after winning Summer and the cottage is in Autumn: amber light, leaves on the step. Come home after Autumn and it's snowed in for Winter. Losing keeps the season you lost in.
  *In the build (M4.5 part 1; controls decided with Jacob, Oct 18):* the cottage is one 320×180 room drawn at 2x (`view/room.ts` for the layout and collision, `art/scenes/cottage-room.ts` for the art, all code-drawn). WASD or the arrow keys walk; there is no click-to-walk. Walking up to a station lights it with a breathing outline and a little hop, and a prompt over it shows the key and what it does ("F  Spend Reputation"); F or Space uses it, and F, Space or Esc closes what it opened. Esc with nothing open opens settings, which has a Title screen button here. The stations: the bookshelf (the Codex), the lectern (the Almanac), the pinboard (the keepsake box), the calendar (the Year: its rules, boon and multiplier, with arrows to change Year), the cauldron (witch and cauldron; a wardrobe until the restyle), the workbench (perks) and the front door (set out: the Year's four seasons, 1-4 or the arrows as before). Walking down into the front door opens the same panel as using it (Jacob, Oct 19); it opens again only once you let go of down. The bed, the rugs, an armchair, a plant and the cat are furniture. The window already shows the newest open season; dressing the rest of the room for it, and coming home, are part 2.
  *Dressing and coming home (M4.5 part 2):* the profile remembers the season the house is dressed for (`home`, version 13): a win moves it to the next season (Spring again after Winter), a loss keeps the season you lost in, and a Year where that season isn't open shows its newest one. The window shows the shop window's painted view, graded for that season in afternoon light (the code-drawn hills with ?backdrops=code). Each season puts something out (`DRESSING` in `view/room.ts`): Spring, a blossom garland over the window and a jug of blossom branches; Summer, a jar of fireflies glowing on the sill and a pot of sunflowers; Autumn, a garland of autumn leaves, pumpkins by the hearth and leaves blown in over the step; Winter, a holly garland, snow on the sill and drifted in at the door, and a brighter fire. A soft tint of the season's light lies over the room, coolest in Winter. Coming home from a run, you step in through the front door, and if the house has changed season while you were out a line says so ("Autumn has come to the cottage."). The front door's panel marks the house's season "up next".
  *Polish (M4.5 part 3):* footsteps tap on the flagstones as you walk, softer on a rug, and stop when you walk into a wall; a soft chime sounds when you walk up to something you can use; the fire crackles now and then, louder the nearer you stand. Standing still, you breathe (a slow one-pixel bob), and after a few seconds you turn to face the room. Coming home, no prompt shows until you're in.
  *The witch's cottage look (Jacob, Oct 18, from his concept art: "more cozy witch's cottage, less plain house"):* the room is a witch's cottage at dusk. Fieldstone walls between dark timbers, a flagstone floor, and a big stone chimney breast in the middle of the back wall with the fire dancing in its hearth, a candle at each end of the mantel and a little painting above. Two windows look out at twilight, each with a candle and a pot on the sill. Herbs hang drying from the beam; a spare hat and a broom hang on pegs. The witch and cauldron station is a bubbling iron cauldron with steam rising; the workbench is an alchemy table with bottles, a mortar and a candle. A long red rug lies before the fire with the cat asleep on it (breathing), a red armchair is turned to the fire, a round braided rug lies by the door between two lanterns, and a candle stands by the bed and on a side table. Light is baked into every pixel from the room's lights (`ROOM_LIGHTS` in `art/scenes/cottage-room.ts`), so the corners fall into shadow and furniture is lit for where it stands; each light also gets a flickering glow, the brew's green, and you are lit by where you stand.
  *One big window and stronger seasons (Jacob, Oct 21):* the two small windows became one big leaded window in the middle of the back wall, so the season outside is easy to see, with the chimney breast and hearth moved off to the right (the rug, cat and armchair before it). The keepsake box and the Calendar hang left of the window, and the Almanac's lectern stands under it. The seasons show more: autumn brings leaves blown in at the door and on into the room, pumpkins by the door and the hearth and a warmer light; winter brings snow drifted in at the door and dusted further in, stockings on the mantel and a Yule tree hung with lights (and no snow inside the window). The view through the window is still the shop window's painted view, graded for the season at twilight, and always in the season's own weather: blossom blowing past in spring, the heat wave's haze (with fireflies) in summer, snow in winter, and plain autumn weather, which has none of its own (`WINDOW_WEATHER`).
- **Reputation:** earned every run from potions sold, orders filled and weeks survived, even on a loss. Spent between runs at **your cottage**, the out-of-run home (the Guild Hall is only the in-run errand, §7), on small permanent perks: +1 Shelf slot, starting gold, one free reroll per Night Market, a starting familiar slot. A short list of meaningful upgrades, not a grind.
- **Almanac (achievements):** a page per season of goals ("brew a Legendary", "win Winter without a Discard", "fill every regular's favourite order"). Each one unlocks a card, familiar, witch or cauldron into the pools, so achievements are how the game grows. Relics too: a first run draws from about 6 starter relics, and the rest join the pool through the Almanac.
  *In the build (M4 part 4):* thirteen entries (codex `almanac`, goals in `core/almanac.ts`), checked when any run ends, won or lost: fill 25 orders in a run, pay the rent three weeks running, brew a Superb, a Masterwork and a Legendary potion, sell 12 Shelf potions in a run, keep 3 familiars at once, hold 4 relics at once, take a Curse at the Name-Taker, and win each season. Between them they unlock all 31 pieces of `pool: 'unlock'` content: 10 ingredients, 5 Tinctures, 7 recipes, 4 familiars and 4 relics. A first run draws from eight starter relics (three each of tiers 1 and 2, two of tier 3); Lucky Horseshoe, Silver Bell, Pressed Flower and Old Almanac are unlocked. The strongest relics (Spare Satchel, Witch's Hatpin) stay starters: locking them cost the bot 9 points in Spring, and unlocks are for variety, perks for power. The end screen names new entries; the cottage's Almanac (on the lectern) lists every goal and what it adds. A page per season, and goals tied to sky events, festivals and regulars, come with that content.
  *The second page (decided with Jacob, Oct 15):* the first thirteen came too easily (a Legendary in a first Spring), so seven harder goals follow on a second page of the Almanac: A Legend Thrice (3 Legendary potions in one run), A Full Ledger (40 orders in one run), A Steady Hand (win a season without spending a Discard, by action or by a brew's cost), Every Witch's Way and Every Pot in the House (win a season with every witch, and in every cauldron, across runs; the profile keeps `witchWins` and `cauldronWins`, and the page shows how far along you are), Deep Winter (win Winter in Year 3 or later) and A Tidy Sum (win with 150 gold to spare). They pay in the strongest unlock content, moved off the first page: Starlight Elixir, Elmbrook Panacea, Kelpie Pearl, Taste of Memory, Black Cauldron Brew, Heartstone and the Lucky Horseshoe, and A Legend Thrice opens the Silver Cauldron. The thresholds that read Almanac counts keep their first-page values (looping at 4 entries, perk tier 4 at all 13), so the new page changes no gate. The goals' numbers (`HARD_ALMANAC` in `core/almanac.ts`) are for the M4 balance pass.
- **Codex:** every ingredient, recipe, customer and patron you've met, with lore. Shared with the sibling game.
  *In the build (M4 part 5):* the cottage's Codex (on the bookshelf) has six tabs: Ingredients, Tinctures, Recipes, Familiars, Relics and Townsfolk (regulars, Night Shift customers and patrons). Everything starts as "???" and is written in once a run meets it: a card drawn, gained or offered, a recipe known, a familiar or relic held, a customer who posts an order. A run's finds are added to the profile when it ends, won or lost. Entries show what a thing does or who someone is; clicking a met entry opens its detail card, with a line of lore. The lore is one or two sentences of Elmbrook for every ingredient, Tincture, junk card, recipe, familiar, relic and customer, in `src/codex/lore.ts` with the shared world data so the sibling game can use it (voice approved by Jacob, Oct 16). Card tooltips show the same line.
- **Regulars:** six townsfolk with Friendship that persists across runs (see Friendship under the Regulars table). *Friendship (Jacob, Oct 15):* each regular's Friendship builds over the whole save and never resets; it drives story beats, dialogue, unlocks and the Winter vigil's gifts, and is breadth more than power. Decided with Jacob (Oct 15), built with the regulars milestone: Friendship replaces the per-run hearts, one meter that only ever rises. Delivering to a regular and order bonuses grow it; a declined order just doesn't. About 10 levels per regular, filling slowly enough to last 10 Years. The Hearth Trader opens better trades (paid in gold) as Friendship grows instead of spending hearts; rewards are mostly breadth (story beats, recipes, the regular's own special orders, vigil gifts), with at most a small capped tip bonus at high Friendship. The Silver Bell, Grave Moss, the Nameless Year rule and the order ♥s get Friendship versions, each agreed with Jacob first. A Townsfolk page in the Grimoire lists each regular and your Friendship. Friendship levels open story beats (plain scene screens; Ink was dropped, Jacob, Oct 15), new recipes, familiars and their favourite orders, and a story finale per regular.
- **Unlocks:** witches, cauldrons, familiars and cards enter the pool via achievements and regulars' stories.
- **The keepsake box** (decided with Jacob, Oct 16). A box in the cottage with one slot: before a run you choose one keepsake to add to the starting deck. It is added, not swapped for a starter card, so it never thins the deck. Keepsakes are Friendship cards: a regular's own vigil gift becomes keepable at Friendship 8, up to six over a save. Later, festival cards join them: at the end of a run you may press one festival card you bought into the box. Almanac cards stay out, since they already add variety to the pools. A second slot comes much later, from an Almanac goal or a perk (Jacob: "we should eventually allow 2 for sure"). Not in the tutorial or a Nameless run. The +1 Brew gifts (Shrine Candle, Gilded Coin) are simmed in a day deck first and may get a gentler keepsake version.
  *In the build:* the cottage's keepsake box sits above the witch and cauldron; arrows step through "empty" and each open keepsake (`keepsakesOpen`, `KEEPSAKE_SLOTS = 1`). The profile keeps it (`keepsakes`, version 12), `startRun` takes `keepsakes`, and a keepsake whose regular is below level 8 is left out. A Lunar keepsake (Night Lily) starts in the Night Satchel. A run that starts Nameless (Year 7's Curse) brings none; Nameless taken mid-run leaves it in the deck. The +1 Brew gifts go in as they are, for the balance pass to check. Festival cards and the second slot come later.
- **Modes (later):** **Long Year** (unlocked by completing Year 1): one continuous run through all four seasons, 16 weeks, with mid-run saves; the deck, familiars and gold carry over between seasons. Also, decided with Jacob for M6 (Oct 19):
  - **Endless** is its own mode, open from the title screen from the start (Jacob, Oct 21), like Risk of Rain 2's Simulacrum. It has its own save, kept apart from the story run. Choosing it opens the cottage in Endless mode; you set out from the door in any season, and the weeks go on endlessly with the usual cadence of Night Shifts, Night Markets and moons, a new month after every finale, with rent still climbing until you can't pay. When it ends you come home to the cottage, still in Endless mode. It brings everything you've ever unlocked, and earns no Reputation, Almanac entries or unlocks, so it can't be used to farm progression; the score is the weeks lasted.
    *In the build:* the title's **Endless** button shows once the tutorial is done (`endlessOpen`); it continues a saved Endless run (its own storage slot, `elmbrook.endless`) or opens the cottage in Endless mode, whose door panel lists all four seasons and the best run. An Endless run (`startRun` with `endless`, `RunState.endlessMode`) brings the profile's perks, Almanac unlocks, witch, cauldron, keepsakes and Friendship, but plays Year 1's rules with no boon. Its first month is an ordinary month; meeting the finale rolls a fresh month (new calendar, patrons and Moonless finale) instead of winning, keeping the deck, gold, familiars and relics (`RunState.endless` counts the months rolled). From the first week past the first finale, rent is the finale's ×1.12 each week (`ENDLESS_RENT`), and orders keep scaling with the weeks played (`runWeek`); the HUD counts weeks straight on (week 5, 6, ...). When it ends, the end screen shows the weeks lasted (each rent paid) against the profile's `endlessBest`, and Go again or Home (to the Endless cottage). Friendship and Codex finds from Endless aren't banked. Simmed with `pnpm sim --endless` (Oct 21, ×1.12 kept): skilled runs with nothing unlocked last a median 3 weeks (about 1 in 3 get past the first finale, and those last 16 to 21); with every perk and unlock, a median 19 weeks (1 in 10 lose the first month, best 24).
  - **Mutations** (the challenge runs): optional twists, such as "no Vital ingredients", switched on when you start a Year at the cottage. Any number can be on at once (Jacob, Oct 21), like Hades' Heat. They last all four seasons of that Year and lock once Spring starts. Beating that Year's Winter ticks off every one that was on for good, shown in the picker. Each one on multiplies the Year's Reputation by 1.25 (two give ×1.56, all six ×3.81). Year rules are the difficulty ladder; mutations are optional, change how you play, and make the Year a little harder.
    *In the build (Jacob chose all six, Oct 21; each tuned about 10 points harder than a normal run, as Jacob asked):* **No Vital** (no Vital ingredients: half the starter's become Sludge and the rest are gone, and none are offered), **Lone Witch** (no familiars; every run starts with a tier 2 relic), **Steady Hands** (no Discards, but you draw two more cards), **Three's Company** (every brew needs three or more ingredients, with one fewer Brew a day; a third cauldron slot from the start), **Open Market** (the full moon every week, so every stall is out and the Tinker comes, at 50% higher prices and 10% higher rent) and **Lean Times** (no starting gold; rent 5% lower). They live in `src/core/mutations.ts` (`MUTATIONS`, `MUTATION_RULES`). Once you've played a first Year (`mutationsOpen`), the cottage's Year panel has a Mutations row that opens a picker of all six, each toggled On or Off (`toggleMutation`; stacking from profile version 16 and run version 25, where a run's `mutations` is a list). They lock when that Year's first run starts (`lockMutation`), and a Winter win ticks off each one on (`mutationsDone`). Stacked, every rule applies; Lean Times' and Open Market's rent changes multiply (together about 4% higher). The run's HUD shows the one on beside the Year, or how many, with each in its tooltip. Endless plays without any. Stacks weren't simmed (Jacob, Oct 21); `pnpm sim --mutation a,b` plays one. Tuned with `pnpm sim --mutation` in Year 2 with two perks, skilled (600 runs each; 54.8% with none): No Vital 44.8%, Three's Company 45.8%, Lone Witch 47.0%, Steady Hands 42.7%, Open Market 43.2%, Lean Times 42.8%. First drafts were too easy (No Vital swapping to commons 55.5%, Three's Company with every Brew 59.5%, Open Market at ×1.5 or even ×2 prices 57 to 58%).
  - No Daily seeded run (Jacob, Oct 19).

## 14. Starter content

The content lives in `src/codex/content.ts`, imported from the balance tables (`elmbrook/balance/data` in the project files). As of M3 part 1: 51 ingredients, 15 Tinctures, 3 junk cards and 36 recipes across nine families: Healing, Warming, Calming, Vigor, Protection, Secrets, Fortune, **Illusion** and Lunar. M4 (Jacob's playtest) adds six three-card recipes at Harmony 5 to the unlock pool, each opened by an early Almanac goal, so the thin families have more than one way to a high tier: Thunderstride Tonic (Gale + Gale + Ember) and Ironheart Draught (Ember + Stone + Vital) for Vigor, Mulled Cider (Ember + Tide + Vital) for Warming, Lullaby Draught (Umbra + Tide + Vital) for Calming, Tidewall Salve (Stone + Tide + Tide) for Protection and Mender's Broth (Vital + Tide + Tide) for Healing. That makes 42. (In the base pool they lifted Year 1 by about 10 points; as unlocks they leave Year 1 alone but make later Years 5 to 10 points easier, which the balance pass after M4 will look at.)

**Illusion** replaces the earlier Beauty family: disguises, illusions and borrowed faces (Mirror Mask, Fetch Draught, Moonlit Veil). The Moth Duchess orders it, and it suits the Illusionist. The family is one id (`illusion`) in the schema, so renaming it later is a codex change.

Every pair of the six day essences brews something, so two-card Sludge only happens with a same-essence pair. *Every trio of three different essences has a recipe too (added with Jacob, Oct 21):* the eleven trios that had none join the base pool at Harmony 4, like Mirror Mask and Gilded Luck: Nightlight Broth (Vital + Ember + Umbra, Calming), Mountain Air Tonic (Vital + Gale + Stone, Vigor), Foxfire Drops (Vital + Gale + Umbra, Illusion), Barrow Balm (Vital + Stone + Umbra, Protection), Squall Tonic (Ember + Tide + Gale, Vigor), Hot Spring Soak (Ember + Tide + Stone, Healing), Bog Lantern (Ember + Tide + Umbra, Illusion), Coal-dark Ward (Ember + Stone + Umbra, Protection), Weatherglass Draught (Tide + Gale + Stone, Fortune), Cavern Pool (Tide + Stone + Umbra, Secrets) and Cairn Whisper (Gale + Stone + Umbra, Secrets). That makes 59 recipes, 37 of them in the base pool. The other nine trios already had one; seven of those are unlock or friend recipes, so until they're opened a run can still make Sludge from those seven trios (`tests/trio-recipes.test.ts`). They sit last in the codex, so a tie in Harmony still defaults to the older recipe. Base Harmony runs 2-3 for two-card recipes, 4-6 for three-card ones, 5-10 for Lunar and 10-12 for Eclipse.

Junk: **Sludge** (does nothing), **Cobweb** (blows away after 3 days), **Bad Omen** (-1 Harmony on every brew while it sits in hand, never below 1).

### Regulars

| ID | Name | Who | Tends to order | Quirk |
|---|---|---|---|---|
| bea-thornwick | Bea Thornwick | The baker, frantic and kind | Warming, Vigor | Comes often |
| old-tobin | Old Tobin | Retired miner with aches | Healing, Protection | Comes often |
| pip-and-quill | Pip & Quill | Twin kids, up to mischief | Secrets, Fortune | Pay ×0.8, tips ×1.5, more bonus conditions |
| sister-alder | Sister Alder | Keeper of the shrine | Calming, Healing | Comes often |
| marlowe-vance | Marlowe Vance | Travelling merchant, haggles | anything Rare | Pays ×1.25 |
| the-gardener | The Gardener | Nobody's sure who they are | Lunar (only at night) | Pays ×1.5 |

### Friendship

Decided with Jacob (Oct 15), in place of the per-run hearts. Built in four parts; parts 1 (the meter, the replacements and the Townsfolk page), 2 (favourite orders and level-up toasts) and 3 (recipes, familiars and stories for all six regulars) and 4 (the level 8 vigil gift and the level 10 tip) are in.

- **Points.** A delivery to a regular earns 1 point, 2 if the bonus condition is met, +1 from a Heartstone in the brew, +1 from the Silver Bell, +1 from a Charm Sachet. Declining or letting an order go costs nothing. Grave Moss, a Cursed card, the Raven Call and the Moth Swarm sour a delivery: it earns no Friendship at all. The Lovers (+2) and returning the Found Coin Purse (+1) give it to a random regular. Nameless: none this run. The Gardener counts like the others, only at night. Night customers and patrons have none.
- **Across runs.** The points a run earns count at once on top of the profile's, and bank to the profile when the run ends, won or lost (`friendship` in the profile, version 10; `storySeen`, the stories shown, version 11). They never go down and have no cap.
- **Levels** (cumulative points): 5, 15, 30, 50, 75, 105, 140, 180, 230, 290, so level 10 takes about 10 Years of steady deliveries.

| Level | Opens |
|---|---|
| 1 | Their Townsfolk entry. |
| 2 | A gift at the Longest Night vigil; the Hearth Trader trades on their name. |
| 3, 6, 9 | A story beat (below). |
| 4 | Their favourite order (below) now and then, worth +1 more Friendship and 6 gold more in tips. |
| 5 | Their recipe joins the pools (below). |
| 6 | The Hearth Trader shows a third Rare card (your best friend's level counts). |
| 7 | Their familiar joins the pools (below). |
| 8 | They bring their own gift to the vigil instead of a random one (below). |
| 10 | Their story's finale, and +1 gold tip on every order of theirs (after the Pip & Quill tip multiplier; shown in the brew preview). |

- **Favourite orders** (Jacob, Oct 15). From level 4, each order of theirs has a 1 in 4 chance to be their favourite, at most one on the board a day, and only when the deck can brew the family and holds an ingredient with the tag. It asks for a potion of a family with an ingredient of a tag (the marks on the cards), pays like any order of that family and tier with 6 gold more in tips, and earns +1 more Friendship (the tip came in the balance pass, Oct 17: without it a favourite was a harder order for nothing, and Friendship 4 lost more runs than Friendship 0). The ticket shows "♥ Protection + Mineral"; the dialogue names it. The Gardener's comes only on Night Shifts.

| Regular | Favourite | Asks for |
|---|---|---|
| Bea Thornwick | Ember Bun Tonic | Warming, with a Fruit |
| Old Tobin | Pit Salve | Protection, with a Mineral |
| Pip & Quill | Midnight Feast Fizz | Secrets, with a Flower |
| Sister Alder | Shrine Tea | Calming, with a Herb |
| Marlowe Vance | Gilded Ledger | Fortune, with a Mineral |
| The Gardener | Moonflower Cordial | Lunar, with a Flower |

- **Recipes, familiars and stories** (Jacob approved Bea's and Tobin's on Oct 15 and the other four on Oct 16). A regular's recipe and familiar are in the `friend` pool: they join a run's pools from its start once the level is reached, and at once if it's reached mid-run. Each story beat is a scene screen shown one morning when that regular has an open order, at most one a morning, lowest level first, never in the tutorial or on the finale night, and once per save. The Townsfolk page lists the stories you've seen; click to read them again.

| Regular | Recipe (level 5) | Familiar (level 7) | Stories (3, 6, 9; finale at 10) |
|---|---|---|---|
| Bea Thornwick | Rising Loaf Tonic: Ember + Ember + Gale, Vigor, Harmony 5 | Kitchen Mouse (Uncommon): Fruit ingredients +3 Potency | Flour on Everything; The Harvest Loaf; The Recipe Book; Open Ovens |
| Old Tobin | Miner's Balm: Stone + Vital + Vital, Healing, Harmony 5 | Canary (Uncommon): +2 Harmony on brews with a Mineral ingredient | The Cough; The Lamp; Down the Seam; Up Into the Light |
| Pip & Quill | Skipping Stone Fizz: Gale + Gale + Stone, Fortune, Harmony 5 | Squirrel (Uncommon): Wychwood ingredients +3 Potency | The Experiment; The Stall; Lost in the Wychwood; The Apprentices |
| Marlowe Vance | Silver Tongue: Ember + Gale + Umbra, Illusion, Harmony 5 | Pack Mule (Uncommon): potions sold to the Fence fetch +2 gold (it pays gold, like the Magpie, instead of scoring) | The Haggle; The Broken Axle; The Letter; Home Port |
| The Gardener | Night-Blooming Tonic: Lunar + Vital + Vital, Lunar, Harmony 8 (Lunar recipes run higher) | Nightjar (Uncommon): Lunar ingredients +3 Potency | Footprints; The Garden Nobody Planted; The Name; Daylight |
| Sister Alder | Vesper Tea: Tide + Gale + Vital, Calming, Harmony 5 | Dove (Uncommon): +2 Harmony on brews with no Umbra ingredient (it applies to more brews than the Canary; the balance pass checks it) | The Bell; The Spring; The Ledger; The Spring Runs |

The story text lives with each regular in `src/codex/content.ts`.

- **Vigil gifts** (Jacob, Oct 16). From level 8 a regular brings their own gift to the Longest Night instead of one from the shared pool, about as strong as the best pool gifts: breadth, not power. Festival-only (`pool: 'event'`).

| Regular | Vigil gift (level 8) |
|---|---|
| Bea Thornwick | Honey Loaf (Tincture): next brew +2 Harmony, draw 2 |
| Old Tobin | Lantern Coal (Ember + Stone, Potency 7): +2 Harmony on Night Shifts |
| Pip & Quill | Paper Star (Tincture): look at the top 3 cards and reorder them, then draw 1 |
| Sister Alder | Shrine Candle (Tincture): +1 Brew, next brew +1 Harmony |
| Marlowe Vance | Gilded Coin (Tincture): +1 Brew, +2 gold |
| The Gardener | Night Lily (Lunar + Vital, Potency 7, Lunar, Flower): +2 Potency on Night Shifts |

- **Level-up toasts.** Reaching a level toasts it with a chime, after the brew has played: the regular, the level, and what it opens. The Townsfolk page says what each regular's next level opens (where it opens something yet), and shows a regular you have never served as ???.
- **More customers later** (Jacob, Oct 15): the six regulars stay six, since more would slow everyone's Friendship. Variety comes from the seasonal visitors (§4.1.1), two per season with odd requests and no Friendship meter; a seventh regular could be an unlock once the six have their stories.

### Starting deck (Hedge Witch)

3× Elmroot, 3× Creekwater, 2× Emberbloom, 2× Thistledown, 1× River Clay, 1× Nightshade, 1× Willow Bark, 1× Stir. Known recipes: Healing Draught, Hearthwarm Tonic, Calm Waters, Sleep Syrup.

## 15. Tone and writing

- Gentle, warm, a little wry. Stardew's warmth with a touch of Discworld.
- Dialogue lines are short (1-2 sentences). Customers state requests in character, the UI states them plainly.
- Night characters are stranger and more formal, never horror.

### 15.1 Teaching the player

Decided after the M2 playtest: the rules must explain themselves before M3 adds more of them. Cards stay clean, as in Slay the Spire; the detail lives one hover away.

- **Card inspect.** Hovering any card (hand, cauldron, rewards, Market, Hearth) shows a tooltip: name, kind and rarity, essences by name, Potency, the effect text, a one-line definition of each rarer game term it mentions (Aged, Satchel, Omen, Friendship...), and the card's codex lore line. The everyday terms (Essence, Potency, Harmony, Quality, Tincture, Brew, Discard) are only in the Guide's glossary, not on every card (Jacob, Oct 16).
- **Hover help** (M6). Everything with a number or a rule beyond cards has a tooltip too, in the same panel. In a run: the gold, Brews and Discards, the day, the rent, the quality preview (the formula and the tier thresholds), the Experiment line, the Shelf, the draw and discard piles, the Brew and Discard buttons, the familiar count, relic and familiar offers, Cauldron and Shelf slots, the Name-Taker's Curse and relic, the Creek Bank's choices, the Hearth's Lift buttons, the Blossom Oracle's days, the Fortune Tent's cards and the Night Market's rent line. At the cottage: Reputation, each season's row, perks (with why one is blocked), the witch and cauldron rows, the keepsake (its card), Almanac entries and Codex tiles.
- **Grimoire** (the G key, or the book button at the top of the screen), open at any time in a run. Its tabs (the Calendar's is in §3):
  - *Recipes:* every recipe you know with its essence pattern, base Harmony and family; undiscovered ones show as "???" with their ingredient count. This is Balatro's Run Info, not a rules change.
  - *Deck:* every card in the run, with what is in the draw pile now, or just the draw pile or the discard pile. Clicking the draw pile opens it here; clicking the Discarded count under it opens the discard pile.
  - *Townsfolk:* each regular, your Friendship level with them and a bar to the next, with what this run has added. A regular's entry (who they are) shows from level 1; before that they're "not a friend yet", and one you've never served is ???. Each row says what the next level opens, where it opens something yet, and lists their stories you have seen, to read again.
  - *How to play:* the run and the day, brewing, the scoring formula, quality tiers and the glossary.
- **Where am I.** The top-left corner shows the Year and season above the week and day (Jacob's playtest, Oct 14). A ribbon at the top shows the week's days (four days, then the Night Shift) and the steps of the current one: Orders, Brew, Twilight, then Errand, or on a Night Shift, the Night Market. Every evening screen says in one line what it is for.
- **Tutorial.** A new save starts at the title screen with a Tutorial button (Enter) and a greyed-out New game button (Jacob, Oct 19). The tutorial is a guided week 1 on a fixed seed; its first tip says that Skip tutorial, a button at the bottom right while it runs, ends it. Finishing week 1 or skipping goes back to the title screen, the tutorial run isn't kept, and New game now opens the cottage, where every run starts, with a first-time note on getting about and out of the door. Tips appear as each part of the game first comes up; most wait for the player to do the thing (open an order, slot two cards, brew), the rest have a Got it button. Finishing or skipping marks the tutorial done in the player's profile. Developers skip it with `?tutorial=0` or the dev overlay; fixtures and `pnpm e2e` never show it unless they ask for a tip. The Calendar, patrons and the Night Satchel have their own tips (weather, patron, gift); the Night Market's tip outlines Tonight's stalls (Tab).
- **First-time notes** (M6, Jacob chose them over a longer tutorial, Oct 19). The systems week 1 never reaches each get a short note in the tutorial's box, with a Got it button, the first time you meet them, once per save. In a run: your first familiar, relic, Curse, card with a modifier, Friendship earned, seasonal visitor, Night Market street (it outlines Tonight's stalls, Tab, and is spent by the tutorial's own market tip) and Guild Commission. At the cottage: your first look at home (how to walk, use things and set out), Reputation (and the workbench), a new witch or cauldron, an Almanac goal done, and a new Year. One shows at a time, never over the tutorial, a scene screen, the Grimoire or an open order, and Settings has a First-time notes toggle (on by default). The notes are `view/notes.ts`; the profile keeps `notes` and `notesSeen`.
- **Scene screens** (decided with Jacob, Oct 15). A short text panel over the shop says why something seasonal is happening, with a Walk on button (or Enter):
  - *Season openings:* every run opens with its season's scene: the weather to expect, the fair, the season's Night Market stalls, and the Moonless Patron at the end. It has a "Don't show again" button, and Settings turns it back on.
  - *Weather firsts:* the first Fog, Heatwave and Snow day in a save each get a scene with the rule. After that only the HUD's weather line says it ("Foggy: orders hidden", "Raining", "Snowing"), with the full rules on hover.
  - *Once a run:* the fair, the Longest Night vigil, the Moonless Patron arriving for the finale, and Snowed In (once a week).
  - Fixtures, `?seed=` runs and the tutorial skip season openings and weather firsts; a fixture shows one with `ui.intro`.
- **Settings** (the title screen, the cottage, Esc or the button at the bottom right in a run): a sound effects slider and a music slider (music 50% by default), sound on or off, season openings shown or hidden, first-time notes shown or hidden, fullscreen (also Alt+Enter anywhere) and the scale: Fill window (the default; Jacob, Oct 21) or a whole number. Fill draws the game at the full size of the screen (or the window, if bigger) and fits it to the window, letterboxed only to keep 16:9, so fullscreen is sharp without a redraw and a smaller window is shrunk smoothly. A whole-number scale keeps every pixel exactly square at that size. A new scale redraws the game by reloading it when it needs to, and the run in progress is kept. M still mutes anywhere. In a run (not the tutorial), Settings also has **Abandon run** (Jacob, Oct 21), which asks first and then goes home to the cottage. Nothing from an abandoned run is kept: a run only counts in the profile when it ends, so there is no Friendship, Reputation, Almanac goal, unlock or Codex find from it, and its save is cleared. The Year's mutations stay locked once its first run has started.

## 16. Out of scope for v1

Controller support, localisation, the separate shop-sim game, multiplayer, voice. Keep these possible but don't build them.
