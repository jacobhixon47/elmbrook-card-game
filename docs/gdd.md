# Elmbrook: Night Market — Game Design Document

Working title. A cozy-but-tense roguelite deckbuilder about running a potion stall in Elmbrook, one moon at a time, through the seasons of a year.

Status: v0.1 design, written to be built from. Numbers are starting points for tuning, not promises.

---

## 1. Pitch

You've inherited a run-down potion stall in Elmbrook. Your deck is your ingredient satchel. Each day, townsfolk bring orders; you draw ingredients, combine them in your cauldron, and try to brew something good enough to sell. Rent is due every week. On moon nights the shop stays open late and the Night Market comes to town, with stranger customers, lunar ingredients, and vendors who don't take coin.

One run = one lunar month (4 weeks) in one season. Survive every rent day and satisfy the Moonless Patron on the final new moon to win. Winning a season unlocks the next; clearing all four is your first Year in Elmbrook (§13).

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
| Winter | Scarce Fresh ingredients; Frost and Lunar cards more common | Frost Night Market: stalls take only odd currencies | Snow, hearth fires, the longest nights |

Seasons scale in difficulty in that order (rent and order targets rise about 15% per season). Numbers are tuning starting points. Each season adds its own ingredients, patrons, events and two Night Market variants to the pools, so later seasons also feel new, not only harder.

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

| ID | Name | Who | Tends to order | Pays in |
|---|---|---|---|---|
| wisp-courier | The Wisp Courier | Delivers letters between the living and the not-quite | Secrets, Lunar | Omens |
| lantern-witch | The Lantern Witch | Lights the Night Market's lamps, sharp-tongued | Ember, Vigor | Lunar cards |
| bog-hag | Granny Bogwort | Lives in the fen, surprisingly sweet | Healing with Umbra | Rare ingredients |
| moth-duchess | The Moth Duchess | Aristocrat of the lamplight | Illusion, Fortune | Gold, lavishly |
| sleepless-miller | The Sleepless Miller | Hasn't slept in years | Calming, Sleep | Curses lifted |

The Night Shift patron (§10) is the featured guest; night customers fill the other orders that night.

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

As of M3 part 2 the festivals' rule changes are in. The contests (relic rewards), the gift exchange and the Firefly Fair's games arrive with relics and the Night Market stalls.

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
- Shuffled into your draw pile **only on Night Shifts**.
- Holds **Lunar ingredients** (Lunar essence, high potency, odd effects) and **Omens** (powerful Tinctures with drawbacks).
- **Eclipse** (rare calendar event): the Night Satchel joins a Day, and day/lunar ingredients form special Eclipse recipes.

### 5.5 Card modifiers

Balatro-style editions applied by events/vendors: **Moonlit** (+Harmony), **Aged** (+Potency each day it's in the deck, resets on brew), **Blessed** (retrigger), **Cursed** (big effect + drawback, from Night Market deals).

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
- Resolution order (deterministic, animated left to right like Balatro): ingredients in slot order → tinctures → card modifiers → familiars in slot order → cauldron.
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

Brewed potions not delivered go to the Shelf (4 slots, upgradable). Shelf potions can fill later orders (from 1.0's "fulfil from inventory"), carry between days, and sell at the Night Market. Potions on the Shelf at rent time are not worth anything unless sold.

## 7. Dusk errands

After the reward pick, choose one of two offered errands. This is the run's branching.

| Errand | Effect |
|---|---|
| Market Square | Coin shop: ingredients, tinctures, a familiar or two, Shelf upgrade. |
| Wychwood Forage | Choose 2 of 5 Wychwood ingredients for free. Small chance of a fae encounter. |
| Creek Bank | Upgrade a card's Potency, or add a modifier. |
| Guild Hall | Take a Guild Commission (multi-day quest: "deliver 3 Superb Calming potions by the Full Moon" → relic reward). From 1.0's guild quests. |
| Hearth (rest) | Remove a card from the deck (one per visit; the deck never drops below 8). |
| Event | One of ~20 small events (fae visits, shop mishaps, a festival) with choices. From 1.0's random encounters. |

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

## 10. Night Shift patrons (bosses)

Each Night Shift has one featured patron with a rule twist, shown on the Calendar a week ahead.

| Patron | Twist |
|---|---|
| The Lamplighter | Your hand is face-down until you hover a card. |
| Mother Hollow | Each brew must use an ingredient from a different Origin than the last. |
| The Twin Owls | Every order needs two identical potions. |
| Sir Bramble | Ember ingredients have 0 Potency. |
| The Clockless Man | Orders expire after 2 brews (1.0's "timed orders", as a twist). |
| The Pale Courier (Full Moon) | Needs a Masterwork Lunar potion; ordinary orders pay double. |
| The Moonless Patron (finale) | Three escalating orders; your Grimoire is hidden. |

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

- **The Year:** Spring is open from the start. Winning a season unlocks the next (Summer, then Autumn, then Winter). Clearing Winter completes **Year 1** and shows a short "year in Elmbrook" ending. Each later Year adds a stacking modifier to every season, like Ascension in Slay the Spire (Year 2: patrons reveal their twist only a day ahead; Year 3: rent +20%; and so on, about 10 Years).
- **Reputation:** earned every run from potions sold, orders filled and weeks survived, even on a loss. Spent at the **Guild Hall** between runs on small permanent perks: +1 Shelf slot, starting gold, one free reroll per Night Market, a starting familiar slot. A short list of meaningful upgrades, not a grind.
- **Almanac (achievements):** a page per season of goals ("brew a Legendary", "win Winter without a Discard", "fill every regular's favourite order"). Each one unlocks a card, familiar, witch or cauldron into the pools, so achievements are how the game grows.
- **Codex:** every ingredient, recipe, customer and patron you've met, with lore. Shared with the sibling game.
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
- **Tutorial.** A player's first run is a guided week 1 on a fixed seed, and it can't be skipped. Tips appear as each part of the game first comes up; most wait for the player to do the thing (open an order, slot two cards, brew), the rest have a Got it button. Finishing week 1 marks the tutorial done in the player's profile (browser storage until M4 brings saves). Developers skip it with `?tutorial=0` or the dev overlay; fixtures and `pnpm e2e` never show it unless they ask for a tip. Night Market stalls, patrons and the Calendar add their own tips when M3 brings them.

## 16. Out of scope for v1

Controller support, localisation, the separate shop-sim game, multiplayer, voice. Keep these possible but don't build them.
