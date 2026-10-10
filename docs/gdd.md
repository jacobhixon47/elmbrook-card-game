# Elmbrook: Night Market — Game Design Document

Working title. A cozy-but-tense roguelite deckbuilder about running a potion stall in Elmbrook, one moon at a time, through the seasons of a year.

Status: v0.1 design, written to be built from. Numbers are starting points for tuning, not promises.

---

## 1. Pitch

You've inherited a run-down potion stall in Elmbrook. Your deck is your ingredient satchel. Each day, townsfolk bring orders; you draw ingredients, combine them in your cauldron, and try to brew something good enough to sell. Rent is due every week. On moon nights the shop stays open late and the Night Market comes to town, with stranger customers, lunar ingredients, and vendors who don't take coin.

One run = one lunar month (4 weeks) in one season. Survive every rent day and satisfy the Moonless Patron on the final new moon to win. (In the build, satisfying them means filling all three of their orders, `FINALE_ORDERS` in `rules.ts`; see §10.) Winning a season unlocks the next; clearing all four is your first Year in Elmbrook (§13).

Touchstones: Balatro (scoring juice, run structure, jokers), Slay the Spire (deck shaping, map choices), Luck be a Landlord (rent pressure), Stardew Valley (tone, townsfolk).

## 2. Design pillars

1. **Every brew is a little puzzle with a satisfying payoff.** The score counter should feel like Balatro's: numbers climbing, sounds stacking, cauldron bubbling over.
2. **Cozy surface, real stakes.** Warm art and gentle characters, but rent is real and a bad week ends the run.
3. **The town remembers you.** Regulars carry relationships and stories across runs; that's the meta-progression, not just unlock lists.
4. **Night is different.** Moon nights change the rules, the customers and the economy.
5. **Shared world.** Every ingredient, recipe and townsperson belongs to the Elmbrook codex shared with the sibling shop-sim game.

## 3. Run structure

```
Week 1 (Waxing Crescent)  Day · Day · Day · Day · Night Shift (First Quarter)   → Rent
Week 2 (Waxing Gibbous)   Day · Day · Day · Day · Night Shift (FULL MOON)       → Rent
Week 3 (Waning Gibbous)   Day · Day · Day · Day · Night Shift (Last Quarter)    → Rent   (festival week)
Week 4 (Waning Crescent)  Day · Day · Day · Day · Night Shift (NEW MOON finale) → Win
```

- **20 encounters per run** (16 days + 4 nights), about 60-75 minutes, still one sitting. Days per week is a single tuning constant (`DAYS_PER_WEEK` in `src/core/calendar.ts`); 3 vs 4 gets compared in the sim before it is locked.
- **The Calendar is seeded at run start:** each day's weather, the week's town event, the festival in week 3, and any rare sky event, so you can plan around them.
- **The Calendar is the run map.** It shows the current week, each day's weather/event icon, and the upcoming Night Shift's patron and rule twist (revealed in advance, like Balatro's boss blind). In the build it is the Grimoire's Calendar tab: four weeks of five days with each week's moon, every day's weather, the festival and any sky event; hovering a day gives its rules. Today's weather and events also sit under the Brews in the HUD.
- The Calendar rolls from its own random stream (`seed:calendar`), so the same seed deals the same cards whatever the weather.
- **Rent** is paid automatically after each Night Shift. Starting values: 20 / 45 / 90 / 160 gold. Can't pay = run over ("the Guild reclaims your stall").
- **Full Moon** (week 2) is the mid-run boss. **New Moon** (week 4) is the finale.

### Seasons

Every run happens in one season. The season is chosen at run start from those you've unlocked (§13) and colours the whole month:

| Season | Ingredient pool | Twist | Feel |
|---|---|---|---|
| Spring | Fresh herbs and flowers more common (Vital, Calming) | Gentle: lower rent, the tutorial season | Blossom, rain, new beginnings |
| Summer | Fruit, honey, Ember ingredients | Long days: +1 Brew on Days, Night Shifts are short (-1 Discard). Orders pay ×1.15 to match the rent | Fireflies, festivals |
| Autumn | Roots, mushrooms, Umbra ingredients | Harvest patrons: bigger orders, bigger tips | Falling leaves, lanterns, the Harvest Fair |
| Winter | Scarce Fresh ingredients; Frost and Lunar cards more common | Frost Night Market: stalls take only odd currencies. Orders pay ×1.2 against rent ×1.52 | Snow, hearth fires, the longest nights |

Seasons scale in difficulty in that order (rent and order targets rise about 15% per season, from week 2: week 1's rent is 20 gold in every season). Numbers are tuning starting points. Each season adds its own ingredients, patrons, events and two Night Market variants to the pools, so later seasons also feel new, not only harder.

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

Each order shows on the Order Board as: portrait, name, hearts (relationship), and once you've opened it, the request and pay.

Carried over from 1.0: click an order to open its dialogue; choose **Fulfill**, **Decline**, or **Back**. Reopening returns to the choice without replaying dialogue. You choose which order to work on and in what order.

**An order has:**
- **Request:** a specific potion ("Healing Draught") or a family ("anything Warming", "a Calming potion").
- **Quality minimum:** a quality tier (§6.4). The minimum rises by week (Fine in week 1; mostly Superb by week 3; half Masterwork in week 4; the Night Shift's first order is one tier harder), but an order never asks for more than your deck could brew with a perfect draw and the Tinctures you own. A weak deck gets easier orders that pay less, so rent is what squeezes it.
- **Pay:** base gold; tips scale with how far you exceed the minimum.
- **Optional bonus condition:** "no Umbra ingredients", "brewed with exactly 3 ingredients", "use a Wychwood ingredient". Meeting it adds a tip and a heart. Each regular has their own bonus chance and conditions.
- **Who comes in:** regulars have a weight (how often they visit), a pay multiplier and a tip multiplier, so Pip & Quill pay little but tip well and Marlowe pays more.

**Delivering:** a matching potion from your Shelf or a fresh brew fulfils the order and earns a heart (two if the bonus condition is met). **Declining** costs a heart with that customer. Unfinished orders at end of day count as declined. Hearts run from 0 to 10.

**Free brewing:** once every order is resolved, leftover Brews can make potions for the Shelf (from 1.0: "after requests are done you can brew with remaining cards").

### 4.1 Night customers

A separate cast who only come after dark. Stranger and more formal than the day crowd, never horror. Their orders are odd ("a potion that tastes like a memory") and pay in odd things: Omens, a Curse lifted, Lunar cards, a stall discount at the Night Market. Each has hearts like a regular, with their own story beats.

| ID | Name | Who | Tends to order | Gold | Pays in |
|---|---|---|---|---|---|
| wisp-courier | The Wisp Courier | Delivers letters between the living and the not-quite | Secrets, Lunar | ×0.5 | A random Omen into the Night Satchel |
| lantern-witch | The Lantern Witch | Lights the Night Market's lamps, sharp-tongued | Vigor, Warming | ×0.5 | Pick 1 of 2 Lunar ingredients after the shift |
| bog-hag | Granny Bogwort | Lives in the fen, surprisingly sweet | Healing, and it must have an Umbra ingredient | ×0.5 | Pick 1 of 3 Rare ingredients after the shift |
| moth-duchess | The Moth Duchess | Aristocrat of the lamplight | Illusion, Fortune | ×2.5 | Gold, lavishly |
| sleepless-miller | The Sleepless Miller | Hasn't slept in years | Calming | ×1 | Lifts your oldest Curse, or ×1.5 gold if you carried none when the order was posted |

The Night Shift patron (§10) is the featured guest; night customers fill the other orders that night, along with the regulars who only come at night (The Gardener). Gold is the order's normal night pay times the multiplier. Picks wait until after the shift's twilight reward, before the Night Market. Granny Bogwort only insists on Umbra when your deck can brew it into her potion.

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

**Town events** (about one per week, a story choice at twilight, replacing that day's errand choice):

- A travelling alchemist offers a trade.
- A cat moves into the shop and becomes a free familiar.
- The well runs dry: Creekwater costs double for 2 days.
- A wedding: a big order for 5 Calming potions by the end of the week.
- The Guild inspector visits: a Superb potion that day earns a rent discount.
- Plus the ~20 small Events from §7 (fae visits, shop mishaps).

**Seasonal festivals** (fixed, week 3 of every run, visible from the start):

| Season | Festival | What changes |
|---|---|---|
| Spring | Bloomtide | Potions with a Flower ingredient pay double; a petal-crown contest order |
| Summer | Firefly Fair | A Night Market on a day, with games |
| Autumn | Harvest Fair | One more order; every order wants two potions and pays ×2.5; a pie contest |
| Winter | Longest Night | The week's Night Shift gets +2 Brews, +1 Discard and +2 orders; a gift exchange of cards |

As of M3 part 2 the festivals' rule changes are in. The contests (relic rewards), the gift exchange and the Firefly Fair's games arrive with the dusk events in M3 part 6.

**Sky events** (rare, at most one per run, announced on the Calendar). Eclipse and Meteor Shower are each in about 6% of runs; Blue Moon and the Fae Ring arrive with patrons and fae bargains:

| Event | Effect |
|---|---|
| Eclipse | Day and night ingredients mix for a day (§5.4); Eclipse recipes can be brewed only then |
| Blue Moon | An extra Night Shift with a mystery patron |
| Meteor Shower | Fallen Star can turn up in rewards, the Market and the Forage for a week |
| Fae Ring | A forage errand becomes a fae bargain |

Sky events and festivals feed the Almanac ("brew during an Eclipse", "win the Harvest Fair pie contest").

## 5. Cards

### 5.1 Ingredients

The bulk of the deck. Each has:
- **Potency** (number, typically 2-12): the "chips".
- **Essences** (1-2 tags): what recipes it can satisfy.
- **Rarity:** Common, Uncommon, Rare, Lunar.
- **Origin:** Garden, Wychwood, Creek, Mine, Market, Night (flavour + bonus conditions + shared codex with game 2).
- **Optional text effect:** "+2 Harmony if brewed with a Tide ingredient", "When discarded, draw 1".
- **Tags** (flower, root, frost, mineral…) that effects and later systems key on, e.g. Ice Lily's "+1 Harmony per Frost ingredient".
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
| Raven Call | Gain 1 Brew. -1 heart with the next customer you serve. |
| Witching Hour | Next brew: Potency ×2. Add a Sludge to your deck. |
| Howl | Next brew: every ingredient +2 Potency per Lunar card in the cauldron. |
| Cracked Mirror | Add a copy of a card in hand to your deck. Lose 3 gold. |
| Wishing Star | Your next delivery pays double. Lose 1 Discard. |
| Moth Swarm | Every ingredient also counts as Lunar for your next brew. -1 heart with the next customer you serve. |

### 5.5 Card modifiers

Balatro-style editions applied by events/vendors: **Moonlit** (+Harmony), **Aged** (+Potency each day it's in the deck, resets on brew), **Blessed** (retrigger), **Cursed** (big effect + drawback, from Night Market deals).

*In the build (M3 part 5):* four of the balance tables' five modifiers are in the codex (`modifiers`), with their numbers in `core/modifiers.ts`. A card holds one, and only ingredients take them (a Tincture has no Potency to double). Each shows as a coloured frame and a corner badge on the card, and its hover text says what it does.

| Modifier | In the build | Creek Bank price |
|---|---|---|
| Moonlit | +2 Harmony when brewed. | 6g |
| Aged | +2 Potency each day in the deck, reset when brewed. Not offered for a card that is already Aged (Amber Sap, Lunar Salt, whose own Aged gains 1 a day). | 3g |
| Blessed | Retrigger: the card's own Potency (printed, Infused or tempered, and Aged days) counts again and its scoring effect runs again. Its hearts and draws on brewing count twice too. | 12g |
| Cursed | The card's own Potency counts again. -1 heart with the customer it's delivered to. | not sold |

Balance pass (Oct 9, from the balance tables): Aged went from +1 a day for 5g to +2 for 3g because a bot forced to buy it did worse than with the free temper; Moonlit and Blessed stay. Gilded (+gold when brewed, from the balance tables) is cut: forced to buy it every visit, the bot did no better than with the free temper even at +3 gold for 5, so it was a choice that never paid. Forced to buy one modifier every visit, the bot wins more per gold with Blessed than Moonlit, so Blessed isn't overpriced.

Moonlit, Blessed and Cursed score at step 3 (§6.3), after the tinctures and before familiars, in slot order. Modifiers come from the Creek Bank (§7), the Name-Taker's Cursed card (§9) and the Fortune Tent's Wheel of Fortune (§9). Dusk events also give them: the Shrine Blessing (Blessed, your choice of card, 6 gold), the Moonlit Walk (Moonlit) and the Kettle (Aged, with a Sludge).

## 6. Brewing

### 6.1 The cauldron panel

From 1.0, cleaned up for mouse and keyboard:
- The cauldron sits centre-screen with **2 slots** (a 3rd unlocks via the cauldron upgrade or certain cards; some recipes need 3).
- Click (or drag) a hand card to drop it in; click a slotted card to return it. Keyboard: number keys select, Enter brews, D starts and confirms a Discard, Esc cancels.
- A brew goes to the best-paying open order it fills (or the one you chose with Fulfill), otherwise onto the Shelf. The preview says which before you brew.
- As soon as the slots match something, a **preview** shows: the recipe name (if known), its essence pattern, and the projected score.

### 6.2 Recipes

A recipe is an essence pattern with a base Harmony and a potion family.

- **Known recipes** are in your **Grimoire**. Each witch starts knowing 4.
- **Unknown but valid** combinations brew as an **Experiment**: the preview shows "???", and brewing it discovers the recipe (added to the Grimoire for this run, and to the permanent Codex) at -1 quality tier for that first brew. This folds 1.0's separate "recipe experimentation" screen into play.
- **Invalid** combinations warn first, then produce **Sludge** if you insist: no potion, and a Sludge junk card is added to the deck (it can be removed at errands).
- **When several recipes match**, the most specific pattern wins (fewest "any" slots), then the higher base Harmony, then a recipe you already know, then codex order.
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
| Legendary | 300+ | ×3 |

Sanity check: a starter Healing Draught (Elmroot 4 + Creekwater 3) × 2 = 14, Fine. Greater Restorative (4 + 4 + 3) × 5 = 55, Superb. Week 4 orders should ask for Masterwork, which needs familiars and modifiers. Thresholds scale up across weeks via order difficulty, not by changing the tiers.

Pay, tips, Fence prices and shop prices live in `src/core/rules.ts` and are tuned with `pnpm sim`. As of M1, a Fine order in week 1 pays about 3 gold, and pay grows about 15% a week on top of the tier multiplier.

### 6.5 The Shelf

Brewed potions not delivered go to the Shelf (4 slots, upgradable). Shelf potions can fill later orders (from 1.0's "fulfil from inventory"), carry between days, and sell at the Night Market. Potions on the Shelf at rent time are not worth anything unless sold. A Shelf potion can be poured away for free at any time (the Pour out button, or right-click it), so a full Shelf never wastes a brew; hovering one shows its quality, ingredients, the order it would fill and what the Fence pays (decided with Jacob).

## 7. Dusk errands

After the reward pick, choose one of two offered errands. This is the run's branching.

| Errand | Effect |
|---|---|
| Market Square | Coin shop: ingredients, tinctures, a familiar or two, Shelf upgrade. |
| Wychwood Forage | Choose 2 of 5 Wychwood ingredients for free. Small chance of a fae encounter. |
| Creek Bank | Upgrade a card's Potency, or add a modifier. In the build: temper an ingredient for +2 Potency for the run, free, or buy it a modifier at its price (§5.5). One card a visit. |
| Guild Hall | Take a Guild Commission (multi-day quest: "deliver 3 Superb Calming potions by the Full Moon" → relic reward). From 1.0's guild quests. In the build: two of the ten commissions are offered (codex `commissions`, goals in `core/commissions.ts`); take one or none, and hold at most two. Each is due by a Night Shift: this week's when taken by day 2's dusk, otherwise next week's, so there are always two days and a Night Shift to work on it (a longer deadline adds weeks; Full Moon Favour is always due on week 2). Finishing pays gold, a relic or a free card pick; a lapsed commission costs nothing. The Hall isn't offered while you hold two. Progress shows under the rent line. |
| Hearth (rest) | Remove a card from the deck (one per visit; the deck never drops below 8), or lift a Curse instead. |
| Event | One of ~20 small events (fae visits, shop mishaps, a festival) with choices. From 1.0's random encounters. In the build: the first 8 of the balance tables' 20 (codex `duskEvents`, rules in `core/dusk-events.ts`), rolled by weight. You make one choice, then head home; a choice you can't afford is greyed out with the reason, and you can only leave without choosing when every choice is out of reach. The Bargain Bin gained a free "Walk on" so it never forces a purchase. The errand reads "Something Afoot" until you open it. |

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

- **Which stalls open.** The Lantern Seller and the Fence open every night. On a quarter moon (weeks 1 and 3) one more is drawn from the Moth Broker, the Hollow Tailor, the Name-Taker and the Fortune Tent. The full moon (week 2) has all of them plus **the Wandering Tinker**: a cauldron slot for 12 gold and a Shelf slot for 4. The new moon (week 4) has all of them plus **the Black Market**: 3 Rare cards at 14 gold each, or any 2 cards from your deck, and a tier 2 relic at 25 gold.
- **The Lantern Seller** stocks 3 Lunar ingredients at 7 gold and 2 Omens at 6. They go in the Night Satchel.
- **The Moth Broker** takes one recipe a night, never one of the witch's four starting recipes, for 1 of 3 Rare ingredients. Brewing the recipe again teaches it again. After he takes the memory he also offers 2 familiars, so the pick is 1 of 3 Rare cards or 2 familiars.
- **The Hollow Tailor** sews one card a night. Give up a day ingredient; its first essence is sewn into another day ingredient, in place of that card's second essence, with +1 Potency. Lunar and Satchel cards stay out of it, so Lunar never reaches the day (the reason Dusk Shard was cut). The deck can't drop below 8.
- **The Fortune Tent** costs 5 gold, then 3 more for each further draw that night. Its deck is in the codex (`tarot`). Boons happen at once. The Hermit and The Tower change next week's day orders: one fewer a day at +50% pay, or one tier harder at double pay. The Moon fogs next week's four days on the Calendar. Next-week twists aren't drawn in week 4. The Chariot gives a random familiar, or 10 gold with every slot taken. The World gives a tier 2 relic, or 12 gold if you hold every relic. Wheel of Fortune blesses a random ingredient in your deck that can take it, or gives 8 gold if none can.
- **The Name-Taker** offers 2 deals a night and makes one: take a Curse you don't carry for the rest of the run, and a relic for it. The relic's tier is the Curse's severity, so Nameless or Leaky Roof buys a tier 1 relic and Unpaid Debt or Heavy Hands a tier 3. (The balance tables gave tier 2 for any Curse and tier 3 for severity 3. In the sim the mild Curses cost almost nothing, so Spring wins rose from 29% to 47%; matching tiers puts them at 35%.) Each deal also offers a Rare ingredient with the Cursed modifier: take the Curse for the relic or for the card, not both.
- No relic is offered twice in one night: the Black Market, the Name-Taker's deals and The World skip each other's.
- **Relics bought on the new moon** come after the last Night Shift, so only the Guild Seal (cheaper final rent) helps. Worth revisiting with the Long Year mode.
- The Wandering Tinker sells one Rare familiar at a quarter off. **Waiting for M4's seasons:** the eight seasonal stall variants in the balance tables.

### Relics and curses

Relics are run-long passives with no slot limit, never sold for gold. They come from patron rewards, the Name-Taker, the Black Market, The World and Guild Commissions (later also festival contests). Curses are run debuffs, taken only at the Name-Taker; the Sleepless Miller and the Hearth lift them. Both are in the codex (`relics`, `curses`) with their numbers in `core/relics.ts`, and show as tokens between the Grimoire button and your gold; hover one for what it does.

| Relic | Tier | Effect |
|---|---|---|
| Copper Ladle | 1 | +1 Harmony on every brew of 3 ingredients. |
| Guild Seal | 1 | Rent -10%. |
| Lucky Horseshoe | 1 | Reward picks offer 4 cards instead of 3. |
| Pressed Flower | 1 | Flower ingredients +2 Potency. |
| Apprentice's Ledger | 1 | +1 gold per order filled. |
| Silver Bell | 1 | +1 heart on every delivery to a regular. |
| Old Almanac | 2 | +1 Discard on Rain and Fog days. |
| Spare Satchel | 2 | +1 hand size. |
| Witch's Hatpin | 2 | Experiments brew at full quality. |
| Iron Lid | 2 | The first failed brew each day makes no Sludge. |
| Moon Locket | 3 | +1 Brew on Night Shifts. |
| Kettle of Plenty | 3 | Potions brewed once every order is resolved go to the Shelf one tier higher. |

| Curse | Severity | Effect |
|---|---|---|
| Nameless | 1 | Regulars don't recognise you: no hearts this run, gained or lost. |
| Leaky Roof | 1 | Shelf -1 slot (given back when lifted). |
| Sour Luck | 2 | Reward picks offer 2 cards, and skipping no longer improves them. |
| Moonsick | 2 | Night Satchel cards -2 Potency. |
| Heavy Hands | 3 | -1 Discard every day. |
| Unpaid Debt | 3 | Rent +15%. |

*In the build (M3 part 5):* the Kettle of Plenty counts an empty Order Board as every order resolved. The Hearth lifts the Curse you pick; the Miller lifts the oldest. Lifting a Curse undoes it from then on.

*Balance note (M3 part 5):* relics and curses move the greedy bot from 25.7% to 35.1% Spring wins (1,000 runs; Summer 23.0% to 28.1%, Autumn 29.2% to 37.3%). Almost all of it is the Name-Taker: with the bot never taking a deal, Spring sits at 29%. The bot never takes a severity 3 Curse, so the Kettle of Plenty is untested by the sim.

## 10. Night Shift patrons (bosses)

Each Night Shift has one featured patron with a rule twist, shown on the Calendar a week ahead.

In the build the whole month's patrons are rolled at run start (on their own seed stream, so a seed's weather doesn't change) and shown on the Calendar's Night cells, in the HUD line and in the morning side panel. Week 2 is always the Pale Courier and week 4 the Moonless Patron; weeks 1 and 3 draw from the rest that fit the season, never the same one twice. The patron's order is the first on the board, one tier harder (capped by what the deck can reach, like every order), and filling it pays their reward on top. Night customers fill the other orders. A Night Shift posts the patron's `orderCount` orders in all (Longest Night adds 2; Rain keeps one night customer home on a 3-order night).

| Patron | Weeks | Twist | Reward for their order |
|---|---|---|---|
| The Lamplighter | 1, 3 | Your hand is face-down until you hover a card. | 6 gold |
| Mother Hollow | 1, 3 | Each brew must use an ingredient from a different Origin than the last. | Pick 1 of 2 familiars |
| The Twin Owls | 1, 3 | Every order needs two identical potions, and pays ×2. Two orders. | Pick 1 of 3 Rare cards |
| Sir Bramble | 1, 3 | Ember ingredients have 0 Potency. | 6 gold |
| The Clockless Man | 3 | Orders leave after 2 brews (1.0's "timed orders", as a twist). No heart is lost when they go. | Tier 1 relic |
| The May Queen (spring) | 1, 3 | Each delivery must be a different family from the one before. | Tier 1 relic |
| The Firefly Conductor (summer) | 1, 3 | After every brew, your hand is discarded and redrawn. | Pick 1 of 2 familiars |
| The Tithe Reeve (autumn) | 1, 3 | Every brew costs 2 gold; orders pay ×1.5. | 10 gold |
| The Frost Warden (winter) | 1, 3 | Ingredients without the Frost tag have -2 Potency. | Tier 2 relic |
| The Pale Courier (Full Moon) | 2 | Needs a Masterwork Lunar potion; ordinary orders pay double. With no way to brew Lunar yet, it asks for your best family at your best tier. | Tier 2 relic |
| The Moonless Patron (finale) | 4 | Three escalating orders (Superb, Masterwork, Masterwork, capped by reach); your Grimoire is hidden. | The month |

Familiar picks offer real familiars, and a relic reward gives a random relic of that tier you don't hold (the nearest tier if you hold them all, or 8 / 12 / 16 gold once you hold all 12).

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

| Witch | Focus | Quirk |
|---|---|---|
| Hedge Witch (start) | Vital, Tide; healing | +1 card in hand. |
| Alchemist | Stone, Ember; transformation | Experiments brew at full quality. |
| Illusionist | Umbra, Gale; glamours | Can disguise one potion as another once per day. |

| Cauldron | Effect |
|---|---|
| Copper (start) | No effect. |
| Iron | 3 slots from the start, -1 Brew per day. |
| Glass | Previews show exact final quality including familiars. |
| Bone | Starts with 2 Lunar cards; rent +25%. |

## 13. Meta-progression

Elmbrook is a roguelite: every run, won or lost, moves something forward.

- **The Year:** Spring is open from the start. Winning a season unlocks the next (Summer, then Autumn, then Winter). Clearing Winter completes **Year 1** and shows a short "year in Elmbrook" ending. Each later Year is a difficulty level, like Ascension in Slay the Spire or Heat in Hades: it keeps every earlier Year's rule and adds one of its own, up to Year 10.
- **Choosing a Year** (decided with Jacob, Oct 9; replaces the earlier retire-or-loop choice): every Year you have reached is a level you pick at the cottage, and each Year keeps its own open seasons, starting again at Spring. Winning Winter in your top Year opens the next Year. That is locked at first: Year 1 always just ends with the ending, and the next Year opens from the second Year won, or earlier once 25% of the Almanac is done. The first time you choose a new Year you pick a **boon** from three, and it stays with that Year (a starting relic, +1 familiar slot, a Blessed card in the starting deck and the like). Each Year multiplies the Reputation it earns (×1.5 for Year 2, ×2 for Year 3), so climbing is worth more than replaying Year 1. A Year is not a replay of the month: a single run always ends at its new moon.
  *In the build (M4 part 1):* the profile (`core/meta.ts`) records the open seasons, runs, wins by season and Years done. A win opens the next season with a line on the victory screen. After the tutorial, every run starts and ends at **the cottage** (the `Cottage` scene, a painted backdrop): its Year panel lists the four seasons, and you set out for an open one (or press 1-4); a locked one says which win opens it. The end screens offer the same season again or Home, and say how much Reputation the run earned.

  *The ending and the Years (M4 part 6):* every Winter win plays the short ending ("A Year in Elmbrook") and counts a Year; there is no choice on that screen. When the win opens a new Year the ending says so and points to the cottage (`RunOutcome.newYear`). The profile keeps each Year's open seasons (`yearSeasons`), the Year chosen (`year`) and each Year's boon (`boons`). The cottage's Year panel has arrows (or the left and right keys) to change Year, and lists the Year's Reputation multiplier, its rules and its boon. Choosing a Year above 1 with no boon yet opens a must-pick of three from A Lucky Find (a random tier 1 relic), Blessed Hands (a random starting card Blessed), Another Perch (+1 familiar slot), Winter Savings (+15 gold) and A Taller Shelf (+1 Shelf slot); boons are codex data (`boons`). Each Year adds one rule and keeps the ones before it (`core/year.ts`, `YEAR_MODIFIERS`; decided with Jacob in place of rent and pay multipliers): Year 2, patrons stay hidden until the day before their Night Shift; Year 3, a Cobweb in the starting deck; Year 4, one fewer Night Market stall; Year 5, one fewer Discard a day; Year 6, week 2 orders ask for Superb or better (week 1 orders are already Fine, so this replaced the first idea of "week 1 Fine"); Year 7, a random Curse at the start; Year 8, the Shelf holds one less potion; Year 9, reward picks offer one card fewer; Year 10, the Moonless Patron asks one tier higher (the finale already needs all three orders, so this replaced "all three orders"). Exact strengths are tuned in the season-ramp pass against an all-perks profile.

  *Reputation and perks (M4 part 3):* a run earns 4 Reputation per week's rent paid, 1 per order filled, 1 per potion sold and 10 for a win (`REPUTATION` in `core/meta.ts`). The cottage's perk board sells four perks, once each: Nest Egg (+5 starting gold, 15), A Deeper Shelf (5 Shelf slots, 20), Gran's Spoon (a Stir in the starting deck, 25) and A Spare Perch (+1 familiar slot, 35). Perks are codex data (`perks`) and apply at run start, never to the tutorial. The Night Market reroll from the list above needs a reroll mechanic first and is left for later. A Winter win counts a Year.

  *Perks for the long game (decided Oct 9; built in M4 part 7):* four perks are bought within two or three runs, and later Years multiply Reputation, so the board grows in tiers. The cottage's perk board shows one tier at a time with arrows; a tier not yet open shows its perks dimmed and what opens it, and the end screen says when a run opened one. Tier 1 is open from the start (the four perks above). Tier 2 opens when you win a Year or finish 4 Almanac entries: A Full Purse (+5 gold, 45), A Blessed Ladle (a random starting card Blessed, 55), Tidy Habits (two Tidy Ups in the deck, 60) and Gran's Charm (a random tier 1 relic, 70). Tier 3 opens at Year 3 or 8 Almanac entries: A Wide Shelf (+1 Shelf slot, 120), Gran's Notes (a Steep and a Sift in the deck, 130) and Twice Blessed (another Blessed starting card, 150). Tier 4 opens at Year 6 or the whole Almanac: A Savings Jar (+10 gold, 220), The Heirloom (another random tier 1 relic, 260) and A Bigger Cauldron (+1 cauldron slot, 320). That is 14 perks; the tiers are `PERK_TIERS` in `core/meta.ts`, and perks and boons share one set of start effects (`RunStart` in the codex schema). Variety in the endgame comes from the Almanac, Year boons and the regulars rather than from perks; a cosmetic Reputation sink (cottage decorations) fits the walkable cottage. Endgame players own every perk, so Years are tuned against an all-perks profile.
- **The walkable cottage** (decided with Jacob, Oct 9; built after the cross-run systems, see milestones M4.5). The cottage grows from a menu over a painting into a small top-down home you walk around, like the House of Hades in Hades and Hades II, but a single open-plan room. The look is top-down Stardew Valley: pixel art that is whimsical, quaint and cozy, in the game's own palette and lighting. You play a simple amorphous little being in wizard's robes and a pointed hat, with no stats or progression of its own. Each corner or nook of the room is where one cross-run system lives, so the house is the menu:
  - the hearth or workbench for Reputation perks;
  - the bookshelf for the Codex and known recipes;
  - the Almanac on a lectern;
  - the regulars' letters and gifts on a pinboard;
  - a wardrobe or cauldron stand for choosing the witch and cauldron.

  Walking out of the front door shows the season you'll set out for next, with any other open seasons to choose from. The house follows the Year: its light, colours, window views and props change with the season you're about to play. Come home after winning Summer and the cottage is in Autumn: amber light, leaves on the step. Come home after Autumn and it's snowed in for Winter. Losing keeps the season you lost in.
- **Reputation:** earned every run from potions sold, orders filled and weeks survived, even on a loss. Spent between runs at **your cottage**, the out-of-run home (the Guild Hall is only the in-run errand, §7), on small permanent perks: +1 Shelf slot, starting gold, one free reroll per Night Market, a starting familiar slot. A short list of meaningful upgrades, not a grind.
- **Almanac (achievements):** a page per season of goals ("brew a Legendary", "win Winter without a Discard", "fill every regular's favourite order"). Each one unlocks a card, familiar, witch or cauldron into the pools, so achievements are how the game grows. Relics too: a first run draws from about 6 starter relics, and the rest join the pool through the Almanac.
  *In the build (M4 part 4):* thirteen entries (codex `almanac`, goals in `core/almanac.ts`), checked when any run ends, won or lost: fill 25 orders in a run, pay the rent three weeks running, brew a Superb, a Masterwork and a Legendary potion, sell 12 Shelf potions in a run, keep 3 familiars at once, hold 4 relics at once, take a Curse at the Name-Taker, and win each season. Between them they unlock all 31 pieces of `pool: 'unlock'` content: 10 ingredients, 5 Tinctures, 7 recipes, 4 familiars and 4 relics, two to four each. A first run draws from eight starter relics (three each of tiers 1 and 2, two of tier 3); Lucky Horseshoe, Silver Bell, Pressed Flower and Old Almanac are unlocked. The strongest relics (Spare Satchel, Witch's Hatpin) stay starters: locking them cost the bot 9 points in Spring, and unlocks are for variety, perks for power. The end screen names new entries; the cottage's Almanac (button or A) lists every goal and what it adds. A page per season, and goals tied to sky events, festivals and regulars, come with that content.
- **Codex:** every ingredient, recipe, customer and patron you've met, with lore. Shared with the sibling game.
  *In the build (M4 part 5):* the cottage's Codex (button or C) has six tabs: Ingredients, Tinctures, Recipes, Familiars, Relics and Townsfolk (regulars, Night Shift customers and patrons). Everything starts as "???" and is written in once a run meets it: a card drawn, gained or offered, a recipe known, a familiar or relic held, a customer who posts an order. A run's finds are added to the profile when it ends, won or lost. Entries show what a thing does or who someone is; lore lines are still to write, and belong with the shared world data (`src/codex`) when the sibling game needs them.
- **Regulars:** six townsfolk with hearts that persist across runs. Heart milestones unlock Ink story beats, new recipes, familiars, and their own special orders. Story finale per regular.
- **Unlocks:** witches, cauldrons, familiars and cards enter the pool via achievements and regulars' stories.
- **Modes (later):** **Long Year** (unlocked by completing Year 1): one continuous run through all four seasons, 16 weeks, with mid-run saves; the deck, familiars and gold carry over between seasons. Also Endless (keep going past the finale), Daily seeded run, Challenge runs ("no Vital ingredients").

## 14. Starter content

The content lives in `src/codex/content.ts`, imported from the balance tables (`elmbrook/balance/data` in the project files). As of M3 part 1: 51 ingredients, 15 Tinctures, 3 junk cards and 36 recipes across nine families: Healing, Warming, Calming, Vigor, Protection, Secrets, Fortune, **Illusion** and Lunar.

**Illusion** replaces the earlier Beauty family: disguises, illusions and borrowed faces (Mirror Mask, Fetch Draught, Moonlit Veil). The Moth Duchess orders it, and it suits the Illusionist. The family is one id (`illusion`) in the schema, so renaming it later is a codex change.

Every pair of the six day essences brews something, so two-card Sludge only happens with a same-essence pair. Base Harmony runs 2-3 for two-card recipes, 4-6 for three-card ones, 5-10 for Lunar and 10-12 for Eclipse.

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

### Starting deck (Hedge Witch)

3× Elmroot, 3× Creekwater, 2× Emberbloom, 2× Thistledown, 1× River Clay, 1× Nightshade, 1× Willow Bark, 1× Stir. Known recipes: Healing Draught, Hearthwarm Tonic, Calm Waters, Sleep Syrup.

## 15. Tone and writing

- Gentle, warm, a little wry. Stardew's warmth with a touch of Discworld.
- Dialogue lines are short (1-2 sentences). Customers state requests in character, the UI states them plainly.
- Night characters are stranger and more formal, never horror.

### 15.1 Teaching the player

Decided after the M2 playtest: the rules must explain themselves before M3 adds more of them. Cards stay clean, as in Slay the Spire; the detail lives one hover away.

- **Card inspect.** Hovering any card (hand, cauldron, rewards, Market, Hearth) shows a tooltip: name, kind and rarity, essences by name, Potency, the effect text, and a one-line definition of each game term it mentions (Harmony, Aged, Discard...).
- **Grimoire** (the G key, or the book button at the top of the screen), open at any time in a run. Three tabs:
  - *Recipes:* every recipe you know with its essence pattern, base Harmony and family; undiscovered ones show as "???" with their ingredient count. This is Balatro's Run Info, not a rules change.
  - *Deck:* every card in the run, with what is in the draw pile now. Clicking the draw pile opens it here.
  - *How to play:* the run and the day, brewing, the scoring formula, quality tiers and the glossary.
- **Where am I.** A ribbon at the top shows the week's days (four days, then the Night Shift) and the steps of the current one: Orders, Brew, Twilight, then Errand, or on a Night Shift, the Night Market. Every evening screen says in one line what it is for.
- **Tutorial.** A player's first run is a guided week 1 on a fixed seed, and it can't be skipped. Tips appear as each part of the game first comes up; most wait for the player to do the thing (open an order, slot two cards, brew), the rest have a Got it button. Finishing week 1 marks the tutorial done in the player's profile (browser storage until M4 brings saves). Developers skip it with `?tutorial=0` or the dev overlay; fixtures and `pnpm e2e` never show it unless they ask for a tip. The Calendar, patrons and the Night Satchel have their own tips (weather, patron, gift); Night Market stalls add theirs in M3 part 4.

## 16. Out of scope for v1

Controller support, localisation, the separate shop-sim game, multiplayer, voice. Keep these possible but don't build them.
