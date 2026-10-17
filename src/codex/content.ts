import type { z } from 'zod';
import type { Commission, Curse, DuskEvent, Familiar, Ingredient, Junk, Modifier, NightCustomer, Visitor, Patron, Recipe, Regular, Relic, Stall, Tarot, Tincture, Witch, Perk, AlmanacEntry, Boon, Fair, Blessing, Cauldron } from './schema';

// Raw content tables. Validated in ./index.ts and by tests/codex.test.ts.
// Source of truth for numbers: docs/gdd.md §14.

type In<T extends z.ZodTypeAny> = z.input<T>;

export const ingredients: In<typeof Ingredient>[] = [
  { id: 'elmroot', name: 'Elmroot', essences: ['vital'], potency: 4, rarity: 'common', origin: 'garden', tags: ['root'] },
  { id: 'creekwater', name: 'Creekwater', essences: ['tide'], potency: 3, rarity: 'common', origin: 'creek', tags: ['water'] },
  { id: 'emberbloom', name: 'Emberbloom', essences: ['ember'], potency: 4, rarity: 'common', origin: 'garden', tags: ['flower'], inSeason: ['summer'] },
  { id: 'thistledown', name: 'Thistledown', essences: ['gale'], potency: 3, rarity: 'common', origin: 'wychwood', effects: ['on-discard-draw-1'], text: 'When discarded, draw 1.', tags: ['flower'] },
  { id: 'river-clay', name: 'River Clay', essences: ['stone'], potency: 5, rarity: 'common', origin: 'creek', tags: ['mineral'] },
  { id: 'nightshade', name: 'Nightshade', essences: ['umbra'], potency: 5, rarity: 'common', origin: 'wychwood', tags: ['herb'], inSeason: ['autumn'] },
  { id: 'mint-sprig', name: 'Mint Sprig', essences: ['vital'], potency: 3, rarity: 'common', origin: 'garden', effects: ['harmony-1-with-tide'], text: '+1 Harmony if brewed with a Tide ingredient.', tags: ['herb'], inSeason: ['spring'] },
  { id: 'dandelion-fluff', name: 'Dandelion Fluff', essences: ['gale'], potency: 4, rarity: 'common', origin: 'garden', tags: ['flower'], inSeason: ['spring'] },
  { id: 'lavender', name: 'Lavender', essences: ['tide'], potency: 3, rarity: 'common', origin: 'garden', effects: ['harmony-1-if-calming'], text: '+1 Harmony in a Calming potion.', tags: ['flower', 'herb'], inSeason: ['summer'], pool: 'unlock' },
  { id: 'hearth-coal', name: 'Hearth Coal', essences: ['ember'], potency: 5, rarity: 'common', origin: 'mine', tags: ['mineral'], inSeason: ['winter'] },
  { id: 'iron-filings', name: 'Iron Filings', essences: ['stone'], potency: 4, rarity: 'common', origin: 'mine', effects: ['potency-2-if-3-ingredients'], text: '+2 Potency if brewed with 3 ingredients.', tags: ['mineral'] },
  { id: 'inkcap', name: 'Inkcap', essences: ['umbra'], potency: 4, rarity: 'common', origin: 'wychwood', tags: ['mushroom'], inSeason: ['autumn'] },
  { id: 'honeycomb', name: 'Honeycomb', essences: ['vital', 'ember'], potency: 4, rarity: 'uncommon', origin: 'market', inSeason: ['summer'] },
  { id: 'mistcap', name: 'Mistcap Mushroom', essences: ['tide', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', tags: ['mushroom'], inSeason: ['autumn'] },
  { id: 'quartz-dust', name: 'Quartz Dust', essences: ['stone', 'gale'], potency: 4, rarity: 'uncommon', origin: 'mine', effects: ['harmony-2-if-3-ingredients'], text: '+2 Harmony if brewed with 3 ingredients.', tags: ['mineral'] },
  { id: 'dragon-pepper', name: 'Dragon Pepper', essences: ['ember'], potency: 8, rarity: 'uncommon', origin: 'market', effects: ['costs-1-discard'], text: 'Brewing it costs 1 Discard.', tags: ['spice'], inSeason: ['summer'] },
  { id: 'willow-bark', name: 'Willow Bark', essences: ['vital', 'tide'], potency: 5, rarity: 'uncommon', origin: 'creek', tags: ['bark'] },
  { id: 'clover', name: 'Four-leaf Clover', essences: ['vital', 'gale'], potency: 4, rarity: 'uncommon', origin: 'garden', effects: ['harmony-1-if-fortune'], text: '+1 Harmony in a Fortune potion.', tags: ['herb'], inSeason: ['spring'], pool: 'unlock' },
  { id: 'foxglove', name: 'Foxglove', essences: ['vital', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', tags: ['flower'], inSeason: ['spring'] },
  { id: 'ginger-root', name: 'Ginger Root', essences: ['ember', 'tide'], potency: 5, rarity: 'uncommon', origin: 'market', effects: ['on-discard-draw-1'], text: 'When discarded, draw 1.', tags: ['root', 'spice'], inSeason: ['winter'], pool: 'unlock' },
  { id: 'sunflower', name: 'Sunflower', essences: ['ember', 'gale'], potency: 5, rarity: 'uncommon', origin: 'garden', tags: ['flower'], inSeason: ['summer'] },
  { id: 'pine-resin', name: 'Pine Resin', essences: ['ember', 'stone'], potency: 5, rarity: 'uncommon', origin: 'wychwood', tags: ['bark', 'frost'], inSeason: ['winter'] },
  { id: 'hollyberry', name: 'Hollyberry', essences: ['ember', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', tags: ['fruit', 'frost'], inSeason: ['winter'] },
  { id: 'frostcap', name: 'Frostcap', essences: ['tide', 'gale'], potency: 5, rarity: 'uncommon', origin: 'wychwood', tags: ['mushroom', 'frost'], inSeason: ['winter'] },
  { id: 'sea-salt', name: 'Sea Salt', essences: ['tide', 'stone'], potency: 5, rarity: 'uncommon', origin: 'market', tags: ['mineral'], pool: 'unlock' },
  { id: 'bog-iron', name: 'Bog Iron', essences: ['stone', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'creek', tags: ['mineral'], inSeason: ['autumn'] },
  { id: 'blackberry', name: 'Blackberry', essences: ['vital', 'umbra'], potency: 6, rarity: 'uncommon', origin: 'wychwood', tags: ['fruit'], inSeason: ['autumn'] },
  { id: 'lark-feather', name: 'Lark Feather', essences: ['gale'], potency: 6, rarity: 'uncommon', origin: 'wychwood', effects: ['harmony-1-if-2-ingredients'], text: '+1 Harmony if brewed with exactly 2 ingredients.', tags: ['feather'], inSeason: ['spring'] },
  { id: 'geode', name: 'Geode', essences: ['stone'], potency: 6, rarity: 'uncommon', origin: 'mine', effects: ['potency-per-week'], text: '+1 Potency for each week after the first.', tags: ['mineral'], pool: 'unlock' },
  { id: 'mandrake', name: 'Mandrake', essences: ['umbra'], potency: 8, rarity: 'uncommon', origin: 'garden', effects: ['costs-1-discard'], text: 'Brewing it costs 1 Discard.', tags: ['root'] },
  { id: 'crow-feather', name: 'Crow Feather', essences: ['gale', 'umbra'], potency: 6, rarity: 'rare', origin: 'wychwood', effects: ['harmony-per-umbra-in-hand'], text: '+1 Harmony per Umbra card in hand.', tags: ['feather'], inSeason: ['autumn'] },
  { id: 'amber-sap', name: 'Amber Sap', essences: ['stone', 'vital'], potency: 7, rarity: 'rare', origin: 'wychwood', effects: ['aged'], text: 'Aged.', tags: ['bark'] },
  { id: 'sunberry', name: 'Sunberry', essences: ['vital'], potency: 8, rarity: 'rare', origin: 'garden', effects: ['harmony-2-first-brew'], text: '+2 Harmony on the first brew of the day.', tags: ['fruit'], inSeason: ['summer'] },
  { id: 'salamander-scale', name: 'Salamander Scale', essences: ['ember'], potency: 7, rarity: 'rare', origin: 'market', effects: ['harmony-per-ember-in-brew'], text: '+1 Harmony per Ember ingredient in the brew.' },
  { id: 'kelpie-pearl', name: 'Kelpie Pearl', essences: ['tide'], potency: 7, rarity: 'rare', origin: 'creek', effects: ['brew-makes-2'], text: 'A brew with it makes 2 potions.', tags: ['water'], pool: 'unlock' },
  { id: 'stormseed', name: 'Stormseed', essences: ['gale'], potency: 8, rarity: 'rare', origin: 'wychwood', effects: ['on-brew-draw-2'], text: 'When brewed, draw 2.' },
  { id: 'heartstone', name: 'Heartstone', essences: ['stone'], potency: 9, rarity: 'rare', origin: 'mine', effects: ['gain-heart'], text: '+1 Friendship with the regular it\'s delivered to.', tags: ['mineral'], pool: 'unlock' },
  { id: 'shadowroot', name: 'Shadowroot', essences: ['umbra'], potency: 7, rarity: 'rare', origin: 'wychwood', effects: ['harmony-x1.5-if-secrets'], text: 'x1.5 Harmony in a Secrets potion.', tags: ['root'], inSeason: ['autumn'] },
  { id: 'harvest-gourd', name: 'Harvest Gourd', essences: ['vital', 'stone'], potency: 6, rarity: 'rare', origin: 'garden', effects: ['potency-2-per-order-today'], text: '+2 Potency for each order filled today.', tags: ['fruit'], inSeason: ['autumn'], pool: 'unlock' },
  // Bloomtide's fair (Spring): found only at the Flower Grower's stall.
  { id: 'maybloom', name: 'Maybloom', essences: ['vital', 'gale'], potency: 7, rarity: 'rare', origin: 'garden', effects: ['harmony-per-flower-in-brew'], text: '+1 Harmony per Flower ingredient in the brew.', tags: ['flower'], pool: 'event' },
  { id: 'primrose', name: 'Primrose', essences: ['vital'], potency: 6, rarity: 'rare', origin: 'garden', effects: ['grows'], text: 'Grows: +1 Potency for the run each time it is brewed.', tags: ['flower'], pool: 'event' },
  { id: 'snowdrop', name: 'Snowdrop', essences: ['vital', 'tide'], potency: 5, rarity: 'uncommon', origin: 'garden', effects: ['harmony-2-first-brew'], text: '+2 Harmony on the day\'s first brew.', tags: ['flower'], pool: 'event' },
  { id: 'cowslip', name: 'Cowslip', essences: ['gale'], potency: 5, rarity: 'uncommon', origin: 'garden', effects: ['on-brew-draw-1'], text: 'Draw a card when brewed.', tags: ['flower'], pool: 'event' },
  { id: 'daffodil', name: 'Daffodil', essences: ['ember', 'vital'], potency: 7, rarity: 'rare', origin: 'garden', effects: ['potency-2-per-other-flower'], text: '+2 Potency per other Flower in the brew.', tags: ['flower'], pool: 'event' },
  { id: 'sunpeach', name: 'Sunpeach', essences: ['vital', 'ember'], potency: 7, rarity: 'rare', origin: 'garden', effects: ['potency-3-if-heatwave'], text: '+3 Potency on Heatwave days.', tags: ['fruit'], pool: 'event' },
  { id: 'starfruit', name: 'Starfruit', essences: ['gale'], potency: 8, rarity: 'rare', origin: 'garden', effects: ['harmony-per-fruit-in-brew'], text: '+1 Harmony per Fruit ingredient in the brew.', tags: ['fruit'], pool: 'event' },
  { id: 'wild-cherry', name: 'Wild Cherry', essences: ['ember', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', effects: ['potency-2-if-3-ingredients'], text: '+2 Potency in a three-ingredient brew.', tags: ['fruit'], pool: 'event' },
  { id: 'plum', name: 'Plum', essences: ['tide', 'vital'], potency: 5, rarity: 'uncommon', origin: 'garden', effects: ['aged'], text: 'Aged: +1 Potency for each day in the deck until brewed.', tags: ['fruit'], pool: 'event' },
  { id: 'melon', name: 'Melon', essences: ['tide'], potency: 6, rarity: 'uncommon', origin: 'garden', effects: ['harmony-2-if-heatwave'], text: '+2 Harmony on Heatwave days.', tags: ['fruit'], pool: 'event' },
  { id: 'prize-pumpkin', name: 'Prize Pumpkin', essences: ['vital', 'stone'], potency: 6, rarity: 'rare', origin: 'garden', effects: ['aged-2'], text: 'Aged: +2 Potency for each day in the deck until brewed.', pool: 'event' },
  { id: 'hazelnut', name: 'Hazelnut', essences: ['stone', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', effects: ['harmony-2-if-protection'], text: '+2 Harmony in Protection potions.', pool: 'event' },
  { id: 'golden-wheat', name: 'Golden Wheat', essences: ['vital'], potency: 5, rarity: 'uncommon', origin: 'garden', effects: ['harmony-per-stone-in-brew'], text: '+1 Harmony per Stone ingredient in the brew.', pool: 'event' },
  { id: 'russet-apple', name: 'Russet Apple', essences: ['vital', 'ember'], potency: 5, rarity: 'uncommon', origin: 'garden', effects: ['on-brew-draw-1'], text: 'Draw a card when brewed.', tags: ['fruit'], pool: 'event' },
  { id: 'chestnut', name: 'Chestnut', essences: ['ember', 'stone'], potency: 6, rarity: 'uncommon', origin: 'wychwood', effects: ['potency-3-if-warming'], text: '+3 Potency in Warming potions.', pool: 'event' },
  { id: 'roast-chestnuts', name: 'Roast Chestnuts', essences: ['ember', 'stone'], potency: 6, rarity: 'uncommon', origin: 'garden', effects: ['harmony-2-on-night-shift'], text: '+2 Harmony on Night Shifts.', pool: 'event' },
  { id: 'holly-sprig', name: 'Holly Sprig', essences: ['vital', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', effects: ['potency-2-on-night-shift'], text: '+2 Potency on Night Shifts.', tags: ['frost'], pool: 'event' },
  // Vigil gifts a regular brings at Friendship 8 in place of a random one (GDD §13, Jacob, Oct 16).
  { id: 'lantern-coal', name: 'Lantern Coal', essences: ['ember', 'stone'], potency: 7, rarity: 'uncommon', origin: 'mine', effects: ['harmony-2-on-night-shift'], text: '+2 Harmony on Night Shifts.', pool: 'event' },
  { id: 'night-lily', name: 'Night Lily', essences: ['lunar', 'vital'], potency: 7, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['potency-2-on-night-shift'], text: '+2 Potency on Night Shifts.', tags: ['flower'], pool: 'event' },
  { id: 'bluebell', name: 'Bluebell', essences: ['tide', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood', effects: ['potency-3-if-rain'], text: '+3 Potency on Rain days.', tags: ['flower'], pool: 'event' },
  { id: 'ice-lily', name: 'Ice Lily', essences: ['tide'], potency: 8, rarity: 'rare', origin: 'creek', effects: ['harmony-per-frost-in-brew'], text: '+1 Harmony per Frost ingredient in the brew.', tags: ['flower', 'frost'], inSeason: ['winter'] },
  { id: 'starlit-dew', name: 'Starlit Dew', essences: ['lunar', 'tide'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true, tags: ['water'] },
  { id: 'moonmoth-wing', name: 'Moonmoth Wing', essences: ['lunar', 'gale'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['wild-essence'], text: 'Counts as any essence.', tags: ['feather'] },
  { id: 'grave-moss', name: 'Grave Moss', essences: ['lunar', 'umbra'], potency: 10, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['lose-heart'], text: 'The customer earns you no Friendship.', tags: ['herb'] },
  { id: 'moonpetal', name: 'Moonpetal', essences: ['lunar', 'vital'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true, tags: ['flower'], inSeason: ['spring'], pool: 'unlock' },
  { id: 'lantern-ember', name: 'Lantern Ember', essences: ['lunar', 'ember'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true, tags: ['mineral'], inSeason: ['summer'] },
  { id: 'lunar-salt', name: 'Lunar Salt', essences: ['lunar', 'stone'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['aged'], text: 'Aged.', tags: ['mineral'] },
  { id: 'wolfsbane', name: 'Wolfsbane', essences: ['lunar', 'umbra'], potency: 12, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['night-discard-cost'], text: 'Drawing it costs 1 Discard this shift.', tags: ['flower'], inSeason: ['autumn'] },
  { id: 'fae-dust', name: 'Fae Dust', essences: ['lunar'], potency: 6, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['wild-essence', 'on-brew-draw-1'], text: 'Counts as any essence. When brewed, draw 1.', pool: 'unlock' },
  { id: 'rime-blossom', name: 'Rime Blossom', essences: ['lunar', 'tide'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['harmony-per-frost-in-brew'], text: '+1 Harmony per Frost ingredient in the brew.', tags: ['flower', 'frost'], inSeason: ['winter'] },
  { id: 'fallen-star', name: 'Fallen Star', essences: ['lunar', 'gale'], potency: 11, rarity: 'lunar', origin: 'night', effects: ['day-usable', 'gone-at-week-end'], text: 'Can be brewed on Days. Gone when the week ends.', tags: ['mineral'], pool: 'event', event: 'meteor-shower' },
];

export const tinctures: In<typeof Tincture>[] = [
  { id: 'stir', name: 'Stir', rarity: 'common', effects: ['next-brew-harmony-1'], text: '+1 Harmony on your next brew.' },
  { id: 'forage', name: 'Forage', rarity: 'common', effects: ['draw-2'], text: 'Draw 2.' },
  { id: 'simmer', name: 'Simmer', rarity: 'common', effects: ['next-brew-potency-3'], text: '+3 Potency on your next brew.' },
  { id: 'taste-test', name: 'Taste Test', rarity: 'common', effects: ['peek-3-reorder'], text: 'Look at the top 3 cards; put them back in any order.' },
  { id: 'steep', name: 'Steep', rarity: 'uncommon', effects: ['next-brew-potency-x1.5'], text: 'Next brew: Potency x1.5.' },
  { id: 'sift', name: 'Sift', rarity: 'uncommon', effects: ['free-redraw'], text: 'Discard any number, draw that many. Costs no Discard.' },
  { id: 'pinch-of-salt', name: 'Pinch of Salt', rarity: 'uncommon', effects: ['next-brew-harmony-1-draw-1'], text: '+1 Harmony on your next brew. Draw 1.' },
  { id: 'tidy-up', name: 'Tidy Up', rarity: 'uncommon', effects: ['gain-discard'], text: 'Gain 1 Discard today.' },
  { id: 'decant', name: 'Decant', rarity: 'uncommon', effects: ['upgrade-shelf-potion'], text: 'Raise a Shelf potion one tier (up to Superb).', pool: 'unlock' },
  { id: 'infuse', name: 'Infuse', rarity: 'uncommon', effects: ['card-potency-plus-2'], text: 'A card in hand gains +2 Potency for the rest of the run.' },
  { id: 'charm-sachet', name: 'Charm Sachet', rarity: 'uncommon', effects: ['next-delivery-heart-tip'], text: 'Your next delivery earns +1 Friendship and +3 gold.' },
  { id: 'double-boil', name: 'Double Boil', rarity: 'rare', effects: ['next-brew-harmony-x1.5'], text: 'Next brew: Harmony x1.5.' },
  { id: 'bottle-spare', name: 'Bottle Spare', rarity: 'rare', effects: ['next-brew-double'], text: 'Your next brew makes 2 potions.' },
  { id: 'second-wind', name: 'Second Wind', rarity: 'rare', effects: ['gain-brew'], text: 'Gain 1 Brew today.', pool: 'unlock' },
  { id: 'grimoire-page', name: 'Grimoire Page', rarity: 'rare', effects: ['next-experiment-full', 'draw-2'], text: 'Your next Experiment brews at full quality. Draw 2.', pool: 'unlock' },
  { id: 'beeswax-candle', name: 'Beeswax Candle', rarity: 'uncommon', effects: ['next-brew-harmony-3'], text: 'Next brew: +3 Harmony.', pool: 'event' },
  { id: 'spring-mead', name: 'Spring Mead', rarity: 'rare', effects: ['gain-brew'], text: '+1 Brew today.', pool: 'event' },
  { id: 'garland', name: 'Garland', rarity: 'uncommon', effects: ['flower-potency-2-today'], text: 'Flower ingredients get +2 Potency today.', pool: 'event' },
  { id: 'firefly-jar', name: 'Firefly Jar', rarity: 'uncommon', effects: ['draw-3-night-4'], text: 'Draw 3, or 4 on a Night Shift.', pool: 'event' },
  { id: 'sun-bottle', name: 'Sun Bottle', rarity: 'uncommon', effects: ['next-brew-potency-4-heatwave-8'], text: 'Next brew: +4 Potency, or +8 on a Heatwave.', pool: 'event' },
  { id: 'prism', name: 'Prism', rarity: 'rare', effects: ['next-brew-harmony-per-essence'], text: 'Next brew: +1 Harmony per distinct essence.', pool: 'event' },
  { id: 'paper-fan', name: 'Paper Fan', rarity: 'common', effects: ['gain-discard'], text: '+1 Discard.', pool: 'event' },
  { id: 'spiced-cider', name: 'Spiced Cider', rarity: 'rare', effects: ['next-brew-potency-3', 'next-brew-harmony-3'], text: 'Next brew: +3 Potency and +3 Harmony.', pool: 'event' },
  { id: 'perry', name: 'Perry', rarity: 'uncommon', effects: ['next-brew-harmony-x1.5'], text: 'Next brew: Harmony ×1.5.', pool: 'event' },
  { id: 'mulling-spice', name: 'Mulling Spice', rarity: 'uncommon', effects: ['ember-potency-2-today'], text: 'Ember ingredients get +2 Potency today.', pool: 'event' },
  { id: 'threshing-flail', name: 'Threshing Flail', rarity: 'common', effects: ['draw-2'], text: 'Draw 2.', pool: 'event' },
  { id: 'gingerbread', name: 'Gingerbread', rarity: 'uncommon', effects: ['next-brew-harmony-2', 'draw-1'], text: 'Next brew: +2 Harmony. Draw 1.', pool: 'event' },
  { id: 'mulled-wine', name: 'Mulled Wine', rarity: 'uncommon', effects: ['gain-brew'], text: '+1 Brew.', pool: 'event' },
  { id: 'wool-mittens', name: 'Wool Mittens', rarity: 'uncommon', effects: ['gain-discard', 'draw-1'], text: '+1 Discard. Draw 1.', pool: 'event' },
  { id: 'snow-globe', name: 'Snow Globe', rarity: 'uncommon', effects: ['peek-3-reorder'], text: 'Look at the top 3 cards of your deck and reorder them.', pool: 'event' },
  { id: 'honey-loaf', name: 'Honey Loaf', rarity: 'uncommon', effects: ['next-brew-harmony-2', 'draw-2'], text: 'Next brew: +2 Harmony. Draw 2.', pool: 'event' },
  { id: 'paper-star', name: 'Paper Star', rarity: 'uncommon', effects: ['peek-3-reorder', 'draw-1'], text: 'Look at the top 3 cards of your deck and reorder them, then draw 1.', pool: 'event' },
  { id: 'shrine-candle', name: 'Shrine Candle', rarity: 'uncommon', effects: ['gain-brew', 'next-brew-harmony-1'], text: '+1 Brew. Next brew: +1 Harmony.', pool: 'event' },
  { id: 'gilded-coin', name: 'Gilded Coin', rarity: 'uncommon', effects: ['gain-brew', 'gain-gold-2'], text: '+1 Brew. +2 gold.', pool: 'event' },
  { id: 'royal-jelly', name: 'Royal Jelly', rarity: 'rare', effects: ['bless-in-hand'], text: 'Bless an ingredient in your hand for the run.', pool: 'event' },
  // Omens: Night Satchel Tinctures (GDD §5.4), strong with a drawback. They only come out on Night Shifts.
  { id: 'blood-moon', name: 'Blood Moon', rarity: 'lunar', effects: ['next-brew-harmony-x2', 'lose-discard'], text: 'Next brew: Harmony x2. Lose 1 Discard.' },
  { id: 'black-cat-crossing', name: 'Black Cat Crossing', rarity: 'lunar', effects: ['draw-3', 'discard-random-1'], text: 'Draw 3, then discard a random card.' },
  { id: 'raven-call', name: 'Raven Call', rarity: 'lunar', effects: ['gain-brew', 'next-customer-lose-heart'], text: 'Gain 1 Brew. Your next delivery earns no Friendship.' },
  { id: 'witching-hour', name: 'Witching Hour', rarity: 'lunar', effects: ['next-brew-potency-x2', 'add-sludge'], text: 'Next brew: Potency x2. Add a Sludge to your deck.' },
  { id: 'howl', name: 'Howl', rarity: 'lunar', effects: ['potency-2-per-lunar-in-brew'], text: 'Next brew: every ingredient +2 Potency per Lunar card in the cauldron.' },
  { id: 'cracked-mirror', name: 'Cracked Mirror', rarity: 'lunar', effects: ['copy-card-permanent', 'lose-gold-3'], text: 'Add a copy of a card in hand to your deck. Lose 3 gold.', pool: 'unlock' },
  { id: 'wishing-star', name: 'Wishing Star', rarity: 'lunar', effects: ['next-delivery-pay-x2', 'lose-discard'], text: 'Your next delivery pays double. Lose 1 Discard.' },
  { id: 'yule-candle', name: 'Yule Candle', rarity: 'lunar', effects: ['gain-brew', 'lose-gold-5'], text: 'Gain 1 Brew. Lose 5 gold. It burns through the long night.', pool: 'event' },
  { id: 'moth-swarm', name: 'Moth Swarm', rarity: 'lunar', effects: ['hand-counts-lunar', 'next-customer-lose-heart'], text: 'Every ingredient also counts as Lunar for your next brew. Your next delivery earns no Friendship.', pool: 'unlock' },
];

export const junk: In<typeof Junk>[] = [
  { id: 'sludge', name: 'Sludge', effects: ['junk'], text: 'Does nothing. Remove it at the Hearth.' },
  { id: 'cobweb', name: 'Cobweb', effects: ['junk', 'expires-3-days'], text: 'Does nothing. Blows away after 3 days.' },
  { id: 'bad-omen', name: 'Bad Omen', effects: ['harmony-minus-1-in-hand'], text: 'While in hand, your brews get -1 Harmony. Remove it at the Hearth.' },
];

export const recipes: In<typeof Recipe>[] = [
  { id: 'healing-draught', name: 'Healing Draught', pattern: ['vital', 'tide'], baseHarmony: 2, family: 'healing' },
  { id: 'hearthwarm-tonic', name: 'Hearthwarm Tonic', pattern: ['ember', 'vital'], baseHarmony: 2, family: 'warming' },
  { id: 'sleep-syrup', name: 'Sleep Syrup', pattern: ['umbra', 'tide'], baseHarmony: 2, family: 'calming' },
  { id: 'fleetfoot-elixir', name: 'Fleetfoot Elixir', pattern: ['gale', 'ember'], baseHarmony: 2, family: 'vigor' },
  { id: 'ironhide-salve', name: 'Ironhide Salve', pattern: ['stone', 'vital'], baseHarmony: 2, family: 'protection' },
  { id: 'whisper-ink', name: 'Whisper Ink', pattern: ['umbra', 'gale'], baseHarmony: 3, family: 'secrets' },
  { id: 'courage-cordial', name: 'Courage Cordial', pattern: ['ember', 'stone'], baseHarmony: 3, family: 'vigor' },
  { id: 'calm-waters', name: 'Calm Waters', pattern: ['tide', 'gale'], baseHarmony: 2, family: 'calming' },
  { id: 'four-leaf-tea', name: 'Four-leaf Tea', pattern: ['vital', 'gale'], baseHarmony: 2, family: 'fortune' },
  { id: 'restful-tonic', name: 'Restful Tonic', pattern: ['vital', 'umbra'], baseHarmony: 2, family: 'calming' },
  { id: 'ginger-toddy', name: 'Ginger Toddy', pattern: ['ember', 'tide'], baseHarmony: 2, family: 'warming' },
  { id: 'smoke-veil', name: 'Smoke Veil', pattern: ['ember', 'umbra'], baseHarmony: 3, family: 'secrets' },
  { id: 'mudbath-salve', name: 'Mudbath Salve', pattern: ['tide', 'stone'], baseHarmony: 2, family: 'protection' },
  { id: 'windbreak-charm', name: 'Windbreak Charm', pattern: ['gale', 'stone'], baseHarmony: 2, family: 'protection' },
  { id: 'warding-ash', name: 'Warding Ash', pattern: ['stone', 'umbra'], baseHarmony: 3, family: 'protection' },
  { id: 'philter-of-luck', name: 'Philter of Luck', pattern: ['gale', 'gale', 'vital'], baseHarmony: 4, family: 'fortune' },
  { id: 'greater-restorative', name: 'Greater Restorative', pattern: ['vital', 'vital', 'tide'], baseHarmony: 5, family: 'healing' },
  { id: 'shadowstep-draught', name: 'Shadowstep Draught', pattern: ['umbra', 'umbra', 'gale'], baseHarmony: 5, family: 'secrets' },
  { id: 'mirror-mask', name: 'Mirror Mask', pattern: ['vital', 'ember', 'gale'], baseHarmony: 4, family: 'illusion' },
  { id: 'gilded-luck', name: 'Gilded Luck', pattern: ['gale', 'stone', 'ember'], baseHarmony: 4, family: 'fortune' },
  { id: 'deepwater-calm', name: 'Deepwater Calm', pattern: ['tide', 'tide', 'gale'], baseHarmony: 5, family: 'calming' },
  { id: 'thunderstride-tonic', name: 'Thunderstride Tonic', pattern: ['gale', 'gale', 'ember'], baseHarmony: 5, family: 'vigor', pool: 'unlock' },
  { id: 'ironheart-draught', name: 'Ironheart Draught', pattern: ['ember', 'stone', 'vital'], baseHarmony: 5, family: 'vigor', pool: 'unlock' },
  { id: 'mulled-cider', name: 'Mulled Cider', pattern: ['ember', 'tide', 'vital'], baseHarmony: 5, family: 'warming', pool: 'unlock' },
  { id: 'lullaby-draught', name: 'Lullaby Draught', pattern: ['umbra', 'tide', 'vital'], baseHarmony: 5, family: 'calming', pool: 'unlock' },
  { id: 'tidewall-salve', name: 'Tidewall Salve', pattern: ['stone', 'tide', 'tide'], baseHarmony: 5, family: 'protection', pool: 'unlock' },
  { id: 'menders-broth', name: "Mender's Broth", pattern: ['vital', 'tide', 'tide'], baseHarmony: 5, family: 'healing', pool: 'unlock' },
  { id: 'fetch-draught', name: 'Fetch Draught', pattern: ['tide', 'gale', 'umbra'], baseHarmony: 5, family: 'illusion', pool: 'unlock' },
  // Regulars' recipes (GDD §13): each joins the pools at Friendship 5 with them.
  { id: 'rising-loaf-tonic', name: 'Rising Loaf Tonic', pattern: ['ember', 'ember', 'gale'], baseHarmony: 5, family: 'vigor', pool: 'friend' },
  { id: 'skipping-stone-fizz', name: 'Skipping Stone Fizz', pattern: ['gale', 'gale', 'stone'], baseHarmony: 5, family: 'fortune', pool: 'friend' },
  { id: 'vesper-tea', name: 'Vesper Tea', pattern: ['tide', 'gale', 'vital'], baseHarmony: 5, family: 'calming', pool: 'friend' },
  { id: 'silver-tongue', name: 'Silver Tongue', pattern: ['ember', 'gale', 'umbra'], baseHarmony: 5, family: 'illusion', pool: 'friend' },
  // Lunar recipes run higher, so the Gardener's starts at 8 (Jacob, Oct 16).
  { id: 'night-blooming-tonic', name: 'Night-Blooming Tonic', pattern: ['lunar', 'vital', 'vital'], baseHarmony: 8, family: 'lunar', pool: 'friend' },
  { id: 'miners-balm', name: "Miner's Balm", pattern: ['stone', 'vital', 'vital'], baseHarmony: 5, family: 'healing', pool: 'friend' },
  { id: 'bonfire-cordial', name: 'Bonfire Cordial', pattern: ['ember', 'ember', 'vital'], baseHarmony: 5, family: 'warming', pool: 'unlock' },
  { id: 'mountain-salve', name: 'Mountain Salve', pattern: ['stone', 'stone', 'vital'], baseHarmony: 5, family: 'protection', pool: 'unlock' },
  { id: 'elmbrook-panacea', name: 'Elmbrook Panacea', pattern: ['vital', 'tide', 'stone'], baseHarmony: 6, family: 'healing', pool: 'unlock' },
  { id: 'black-cauldron', name: 'Black Cauldron Brew', pattern: ['umbra', 'umbra', 'umbra'], baseHarmony: 6, family: 'secrets', pool: 'unlock' },
  { id: 'moonmilk', name: 'Moonmilk', pattern: ['lunar', 'vital'], baseHarmony: 5, family: 'lunar' },
  { id: 'silver-whisper', name: 'Silver Whisper', pattern: ['lunar', 'umbra'], baseHarmony: 5, family: 'secrets' },
  { id: 'lanternfire-tonic', name: 'Lanternfire Tonic', pattern: ['lunar', 'ember'], baseHarmony: 5, family: 'vigor' },
  { id: 'moonlit-veil', name: 'Moonlit Veil', pattern: ['lunar', 'gale'], baseHarmony: 5, family: 'illusion' },
  { id: 'moonglass-elixir', name: 'Moonglass Elixir', pattern: ['lunar', 'tide', 'any'], baseHarmony: 8, family: 'lunar' },
  { id: 'taste-of-memory', name: 'Taste of Memory', pattern: ['lunar', 'tide', 'umbra'], baseHarmony: 9, family: 'lunar', pool: 'unlock' },
  { id: 'starlight-elixir', name: 'Starlight Elixir', pattern: ['lunar', 'lunar', 'any'], baseHarmony: 10, family: 'lunar', pool: 'unlock' },
  { id: 'corona-draught', name: 'Corona Draught', pattern: ['lunar', 'ember', 'vital'], baseHarmony: 10, family: 'fortune', pool: 'event', event: 'eclipse', eclipseOnly: true },
  { id: 'umbral-crown', name: 'Umbral Crown', pattern: ['lunar', 'umbra', 'umbra'], baseHarmony: 11, family: 'secrets', pool: 'event', event: 'eclipse', eclipseOnly: true },
  { id: 'daybreak-elixir', name: 'Daybreak Elixir', pattern: ['lunar', 'gale', 'tide'], baseHarmony: 12, family: 'lunar', pool: 'event', event: 'eclipse', eclipseOnly: true },
];

export const regulars: In<typeof Regular>[] = [
  { id: 'bea-thornwick', name: 'Bea Thornwick', blurb: 'The baker, frantic and kind.', prefers: ['warming', 'vigor'], weight: 3, bonusPool: ['no-umbra', 'three-ingredients'], favourite: { name: 'Ember Bun Tonic', family: 'warming', tag: 'fruit' },
    recipe: 'rising-loaf-tonic', familiar: 'kitchen-mouse', vigilGift: 'honey-loaf',
    story: [
      { level: 3, title: 'Flour on Everything', lines: [
        "Bea is at your door before the lamps are out, flour to the elbows. The bakery oven wouldn't catch this morning, and the whole street is waiting on its bread.",
        'She warms her hands at your cauldron while you work, and talks the whole time. Her mother kept the oven going for thirty years without missing a morning. Bea has missed two this month.',
        "\"Don't tell anyone,\" she says, and leaves you a bun that's only a little burnt.",
      ] },
      { level: 6, title: 'The Harvest Loaf', lines: [
        'Bea wants to win the loaf contest at the fair. She has never won it. Her mother won it eleven times.',
        "She brings you a slice to try and watches your face closely. It's good. She knows it's good. She wants to know why it isn't her mother's.",
        'You suggest a pinch of something from your shelf. She laughs, then writes it down.',
      ] },
      { level: 9, title: 'The Recipe Book', lines: [
        "Bea brings her mother's recipe book, wrapped in a tea towel. Halfway through, the bread stops and the handwriting changes: notes on elmroot, creekwater and what the moon does to yeast.",
        "Her mother brewed, a little, on the side. Bea never knew. She asks whether you'd read the pages with her some evening.",
        'You say yes. She leaves the book on your counter overnight, which is the most trusting thing anyone in Elmbrook has done for you.',
      ] },
      { level: 10, title: 'Open Ovens', lines: [
        'The bakery opens late today, on purpose. Bea has hung a new board over the door, and the first bun on it is named after your shop.',
        "She says the oven hasn't missed a morning since spring. She says it like it's nothing, then hugs you hard enough to leave flour on your back.",
        "From now on there's a bun on your doorstep every morning, and Bea tips a little more than she should.",
      ] },
    ],
  },
  { id: 'old-tobin', name: 'Old Tobin', blurb: 'Retired miner with aches.', prefers: ['healing', 'protection'], weight: 3, bonusPool: ['no-umbra', 'three-ingredients'], favourite: { name: 'Pit Salve', family: 'protection', tag: 'mineral' },
    recipe: 'miners-balm', familiar: 'canary', vigilGift: 'lantern-coal',
    story: [
      { level: 3, title: 'The Cough', lines: [
        "Tobin waits for the shop to empty before he asks. The aches are one thing, he says. It's the cough that keeps him up.",
        'He was forty years in the Elm Seam. He tells you about it the way people talk about weather: the damp, the dark, the lamps going blue when the air was bad.',
        "He pays exactly, counts it twice, and thanks you as if you'd done him a much bigger favour.",
      ] },
      { level: 6, title: 'The Lamp', lines: [
        "Tobin brings an old brass lamp and sets it on your windowsill. He asks if you'd light it on Night Shifts.",
        "It's for the men who didn't come up when the seam came down. He lit it every night for thirty years. His hands aren't steady enough for the wick now.",
        "You light it that night. When you look up, he's standing across the lane, hat in his hands.",
      ] },
      { level: 9, title: 'Down the Seam', lines: [
        'At dawn Tobin walks you to the old mine mouth, boarded up and grown over with bramble. He has one of your potions in his coat.',
        "He pours it out on the stones by the entrance, slowly. \"Wynn always said I'd go soft,\" he says. Wynn was his partner on the seam.",
        "On the way back he tells you every rock in the creek bed by name, and you realise he's been waiting years for someone who'd listen.",
      ] },
      { level: 10, title: 'Up Into the Light', lines: [
        "Tobin has hung his pick over your door. He says it's no use to him now, and it'll keep the bad air out.",
        "He's started taking the village children down to the creek on Saturdays to teach them the stones. The cough is better. He tells you this three times.",
        "The lamp stays in your window. He doesn't come for it, and he tips a little more than he should.",
      ] },
    ],
  },
  { id: 'pip-and-quill', name: 'Pip & Quill', blurb: 'Twin kids, up to mischief.', prefers: ['secrets', 'fortune'], weight: 2, payMult: 0.8, tipMult: 1.5, bonusChance: 0.4, bonusPool: ['wychwood-ingredient', 'three-ingredients'], favourite: { name: 'Midnight Feast Fizz', family: 'secrets', tag: 'flower' },
    recipe: 'skipping-stone-fizz', familiar: 'squirrel', vigilGift: 'paper-star',
    story: [
      { level: 3, title: 'The Experiment', lines: [
        "You find Pip under your counter and Quill in your herb cupboard, both very still, both very sure you can't see them.",
        "They've been brewing behind the bakery: mud, three dandelions and a beetle, \"for luck\". It hasn't worked. They'd like to know what they did wrong.",
        "You tell them about the beetle. Quill writes it down. Pip asks if they can watch, and doesn't wait for an answer.",
      ] },
      { level: 6, title: 'The Stall', lines: [
        "The twins have opened a potion stall across the lane, a plank on two buckets. They're selling jars of creek water as \"Wishing Water\", a copper each, and doing better than you'd like.",
        'Bea buys one. Old Tobin buys two and pretends it worked.',
        'At closing they bring you half the takings, "for the recipe". The recipe was creek water. You keep one coin, and they look very proud.',
      ] },
      { level: 9, title: 'Lost in the Wychwood', lines: [
        "Pip comes in alone, which never happens. Quill went into the Wychwood after a white stag and hasn't come back, and it's getting dark.",
        'You find Quill by the old stones, cold and cross and absolutely fine, with a pocket full of moss for your shop.',
        "On the walk home Pip holds your hand, then Quill's, and doesn't say anything for once.",
      ] },
      { level: 10, title: 'The Apprentices', lines: [
        "There's a new sign under yours, painted in two hands: APRENTISES. It's spelled wrong. Nobody has the heart to say.",
        'The twins arrive every morning now, sweep the floor badly, and know the name of every ingredient on your shelf.',
        "They've started saving their coppers for a cauldron of their own, and they tip more than they can afford.",
      ] },
    ],
  },
  { id: 'sister-alder', name: 'Sister Alder', blurb: 'Keeper of the shrine.', prefers: ['calming', 'healing'], weight: 3, bonusPool: ['no-umbra', 'wychwood-ingredient'], favourite: { name: 'Shrine Tea', family: 'calming', tag: 'herb' },
    recipe: 'vesper-tea', familiar: 'dove', vigilGift: 'shrine-candle',
    story: [
      { level: 3, title: 'The Bell', lines: [
        'Sister Alder comes down from the shrine on a weekday, which the village notices. The shrine bell has cracked, and the sound it makes now is "unkind".',
        "She hasn't left the shrine for more than a day in nineteen years. She looks at everything in your shop as if it's a little loud.",
        'She buys her potion, then stays a while longer than she needs to, listening to the cauldron.',
      ] },
      { level: 6, title: 'The Spring', lines: [
        'The spring under the shrine is running low. It has run for three hundred years. Alder says this calmly, the way she says everything, and her hands shake.',
        "She asks whether a potion could help a spring. You don't know. She says that's the most honest answer she's had.",
        'You walk up with her that evening and sit by the water until the lamps come on.',
      ] },
      { level: 9, title: 'The Ledger', lines: [
        "Alder brings the shrine's old ledger. The first keeper, three hundred years back, wasn't a sister at all: she was a witch, and the shrine was her shop.",
        'The last pages are recipes. One is for the spring. It needs something from your shelf and something from the Wychwood, brewed at the shrine at dusk.',
        'She asks you to come up and brew it with her. She has never asked anyone for anything.',
      ] },
      { level: 10, title: 'The Spring Runs', lines: [
        "The spring is running again. Alder doesn't say it was your doing. She doesn't need to.",
        "There's a new cup on the shrine shelf, set out for you, and your shop is named in the evening prayers.",
        'She comes down on weekdays now, and she tips a little more than a sister should.',
      ] },
    ],
  },
  { id: 'marlowe-vance', name: 'Marlowe Vance', blurb: 'Travelling merchant who haggles.', prefers: ['rare'], weight: 2, payMult: 1.25, bonusPool: ['three-ingredients'], favourite: { name: 'Gilded Ledger', family: 'fortune', tag: 'mineral' },
    recipe: 'silver-tongue', familiar: 'pack-mule', vigilGift: 'gilded-coin',
    story: [
      { level: 3, title: 'The Haggle', lines: [
        'Marlowe spends a quarter of an hour haggling you down by one copper, and enjoys every minute of it.',
        "When he's gone, there's a silk scarf on your counter, worth more than everything in your shop. He's left it by mistake, he'll say, if you ask.",
        "You don't ask. He doesn't come back for it.",
      ] },
      { level: 6, title: 'The Broken Axle', lines: [
        "Marlowe's wagon breaks an axle on the creek road, and he's stuck in Elmbrook for a week. It's the longest he has stayed anywhere in twenty years.",
        "He is very bad at staying still. He rearranges your shelf \"for profit\", sells two of Bea's buns to Old Tobin at a markup, and talks to everyone.",
        "On the last night he says Elmbrook is \"not a bad little town\". From Marlowe, that's a love letter.",
      ] },
      { level: 9, title: 'The Letter', lines: [
        "Marlowe comes in with a letter he hasn't opened. It's from his sister. He left home twenty years ago owing his father an apology, and he's been travelling ever since.",
        "He opens it in your shop, because he can't do it alone. His father is ill and asking for him.",
        "He buys a potion for the road and, for the first time, doesn't haggle.",
      ] },
      { level: 10, title: 'Home Port', lines: [
        "Marlowe comes back in spring, thinner and happier. His father is mending, and they've said what needed saying.",
        "He's bought the empty shop across the square. He's staying. The first thing in his window is your potions, at a markup, and he splits the profit with you.",
        'He still haggles. But he tips more than he should, which for Marlowe is a scandal.',
      ] },
    ],
  },
  { id: 'the-gardener', name: 'The Gardener', blurb: 'Nobody\'s sure who they are.', prefers: ['lunar'], nightOnly: true, weight: 2, payMult: 1.5, bonusPool: ['wychwood-ingredient'], favourite: { name: 'Moonflower Cordial', family: 'lunar', tag: 'flower' },
    recipe: 'night-blooming-tonic', familiar: 'nightjar', vigilGift: 'night-lily',
    story: [
      { level: 3, title: 'Footprints', lines: [
        "One morning there's a ring of moonflowers planted around your doorstep, white and closed up tight against the sun.",
        "Nobody saw who did it. But the Gardener's boots, that night, have fresh soil on them, and they don't mention it.",
        'The moonflowers open when the lamps come on. They smell like rain.',
      ] },
      { level: 6, title: 'The Garden Nobody Planted', lines: [
        "At midnight the Gardener takes you into the Wychwood, to a clearing you've walked past a hundred times and never seen.",
        "It's a garden. Every flower in it blooms only at night, and it has been tended for longer than anyone in Elmbrook can remember.",
        "They show you where everything grows, and ask you not to tell anyone. You don't.",
      ] },
      { level: 9, title: 'The Name', lines: [
        "The Gardener tells you their name. Nobody has asked for it in a very long time, they say, and they'd like someone to know it.",
        "They mention the shrine's first keeper, the witch, as if they'd had tea with her last week.",
        "You don't ask how old they are. They seem grateful for that.",
      ] },
      { level: 10, title: 'Daylight', lines: [
        'The Gardener comes into your shop at noon. Nobody has ever seen them in daylight. They look quite ordinary, and a little embarrassed.',
        "They've come to buy something, like anyone would, and to see the moonflowers by your door, which have spread down the whole lane.",
        'They still come at night, mostly. And they tip a little more than they should.',
      ] },
    ],
  },
];

// Night customers (GDD §4.1): only on Night Shifts, after the patron's order.
export const nightCustomers: In<typeof NightCustomer>[] = [
  { id: 'wisp-courier', name: 'The Wisp Courier', blurb: 'Carries letters for the not-quite-living.', prefers: ['secrets', 'lunar'], weight: 2, goldMult: 0.5, paysIn: { kind: 'omen' } },
  { id: 'lantern-witch', name: 'The Lantern Witch', blurb: 'Lights the Night Market. Sharp-tongued.', prefers: ['vigor', 'warming'], weight: 2, goldMult: 0.5, paysIn: { kind: 'lunar-card' } },
  { id: 'bog-hag', name: 'Granny Bogwort', blurb: 'Lives in the fen. Surprisingly sweet.', prefers: ['healing'], weight: 2, goldMult: 0.5, paysIn: { kind: 'rare-card' }, requiresUmbra: true },
  { id: 'moth-duchess', name: 'The Moth Duchess', blurb: 'Aristocrat of the lamplight.', prefers: ['illusion', 'fortune'], weight: 2, goldMult: 2.5, paysIn: { kind: 'gold' } },
  { id: 'sleepless-miller', name: 'The Sleepless Miller', blurb: "Hasn't slept in years.", prefers: ['calming'], weight: 2, goldMult: 1, paysIn: { kind: 'lift-curse', noCurseMult: 1.5 } },
];

// Seasonal visitors (GDD §4.1, Jacob, Oct 16): daytime guests of one season, no Friendship, odd payments.
export const visitors: In<typeof Visitor>[] = [
  { id: 'wren-hollis', name: 'Wren Hollis', blurb: 'A botanist cataloguing the spring blooms.', season: 'spring', prefers: ['calming', 'healing', 'fortune'], goldMult: 0.5, paysIn: { kind: 'card-pick', tag: 'flower', count: 2 }, needsTag: 'flower', line: "Something with a bloom in it, please. I'm pressing samples, and I'll trade you one." },
  { id: 'may-herald', name: 'The May Herald', blurb: 'Cries the Bloomtide Fair through the square.', season: 'spring', prefers: ['fortune', 'illusion'], goldMult: 2, paysIn: { kind: 'gold' }, weeks: [2], lastDay: 3, line: 'Hear ye! The fair wants a little luck and a little glamour. The Crown pays well.' },
  { id: 'captain-brine', name: 'Captain Brine', blurb: 'A sailor on shore leave, loud and salt-stained.', season: 'summer', prefers: ['vigor', 'protection'], goldMult: 0.5, paysIn: { kind: 'card-pick', essence: 'tide', count: 2 }, needsTag: 'water', line: "Something with sea in it, witch. I've a hold full of river things you can have." },
  { id: 'firefly-keeper', name: 'The Firefly Keeper', blurb: 'Tends the jars of the summer fireflies.', season: 'summer', prefers: ['calming', 'lunar'], goldMult: 0.5, paysIn: { kind: 'half-price' }, weather: 'clear', line: "A quiet one, for a clear night. I'll put a good word in at the Night Market." },
  { id: 'rook', name: 'Rook', blurb: 'A scarecrow who walked in from the fields.', season: 'autumn', prefers: ['protection'], goldMult: 0.5, paysIn: { kind: 'burn' }, line: "Something to keep the crows off. In return I'll carry off whatever you don't want." },
  { id: 'tithe-collector', name: 'The Tithe Collector', blurb: 'Gathers the harvest tithe for the abbey.', season: 'autumn', prefers: ['healing', 'warming'], goldMult: 2, paysIn: { kind: 'gold' }, quantity: 2, line: 'Two for the abbey stores, if you please. The abbey pays its tithes in full.' },
  { id: 'snowbound-traveller', name: 'A Snowbound Traveller', blurb: 'Waiting out the snow on the way somewhere else.', season: 'winter', prefers: ['warming'], goldMult: 0.5, paysIn: { kind: 'card-pick', tincture: true, count: 2 }, weather: 'snow', line: "Anything warm. I've little coin, but I've odds and ends from the road." },
  { id: 'toymaker', name: 'The Toymaker', blurb: 'Makes clockwork birds for the solstice.', season: 'winter', prefers: ['illusion', 'secrets'], goldMult: 0.5, paysIn: { kind: 'temper' }, line: "A little wonder for the workshop. I'll tune up one of your ingredients while I wait." },
];

// Night Shift patrons (GDD §10). Weeks 1 and 3 roll one of the eligible; week 2 is the Pale Courier, week 4 the finale.
export const patrons: In<typeof Patron>[] = [
  { id: 'lamplighter', name: 'The Lamplighter', blurb: 'Keeps the lamps, and your secrets.', weeks: [1, 3], twist: 'wicks-burn', text: 'The wicks burn down: each brew tonight has 2 less Harmony than the one before.', orderCount: 3, reward: { kind: 'gold', amount: 6 } },
  { id: 'mother-hollow', name: 'Mother Hollow', blurb: 'Wants a little of everywhere.', weeks: [1, 3], twist: 'origin-chain', text: 'Each brew must use an ingredient from a different Origin than the last.', orderCount: 3, reward: { kind: 'familiar-pick', count: 2 } },
  { id: 'twin-owls', name: 'The Twin Owls', blurb: 'Two of everything, always.', weeks: [1, 3], twist: 'orders-double', text: 'Every order needs two identical potions, and pays double.', orderCount: 2, payMult: 2, reward: { kind: 'card-pick', rarity: 'rare', count: 3 } },
  { id: 'sir-bramble', name: 'Sir Bramble', blurb: 'A knight of the hedgerow. Can\'t abide a hot hearth.', weeks: [1, 3], twist: 'ember-zero', text: 'Ember ingredients have 0 Potency.', orderCount: 3, reward: { kind: 'gold', amount: 6 } },
  { id: 'clockless-man', name: 'The Clockless Man', blurb: 'Always late, never waits.', weeks: [3], twist: 'orders-expire-2', text: 'Orders leave after 2 brews.', orderCount: 3, reward: { kind: 'relic', tier: 1 } },
  { id: 'may-queen', name: 'The May Queen', blurb: 'Crowned in blossom, bored by repeats.', weeks: [1, 3], season: 'spring', twist: 'family-chain', text: 'Each delivery must be a different family from the one before.', orderCount: 3, reward: { kind: 'relic', tier: 1 } },
  { id: 'firefly-conductor', name: 'The Firefly Conductor', blurb: 'Leads the summer lights in time.', weeks: [1, 3], season: 'summer', twist: 'hand-refresh', text: 'After every brew, your hand is discarded and redrawn.', orderCount: 3, reward: { kind: 'familiar-pick', count: 2 } },
  { id: 'tithe-reeve', name: 'The Tithe Reeve', blurb: 'Collects the harvest due.', weeks: [1, 3], season: 'autumn', twist: 'brew-costs-gold-2', text: 'Every brew costs 2 gold. Orders pay ×1.5.', orderCount: 3, payMult: 1.5, reward: { kind: 'gold', amount: 10 } },
  { id: 'frost-warden', name: 'The Frost Warden', blurb: 'Guards the long cold.', weeks: [1, 3], season: 'winter', twist: 'non-frost-minus-2', text: 'Ingredients without the Frost tag have -2 Potency.', orderCount: 3, reward: { kind: 'relic', tier: 2 } },
  { id: 'pale-courier', name: 'The Pale Courier', blurb: 'Comes at the full moon with a sealed request.', weeks: [2], twist: 'pale-courier', text: 'Wants a Masterwork potion of the Lunar family, or your best if your deck can\'t brew one. The other orders pay double.', orderCount: 3, fixedOrder: { family: 'lunar', minTier: 'masterwork' }, reward: { kind: 'relic', tier: 2 } },
  { id: 'moonless-patron', name: 'The Moonless Patron', blurb: 'Comes on the new moon. Nobody sees a face.', weeks: [4], twist: 'grimoire-hidden', text: 'Three escalating orders, and your Grimoire is hidden. Fill them all to win the month.', orderCount: 3, ladder: ['superb', 'masterwork', 'masterwork'], reward: { kind: 'win' } },
];

// Familiars (GDD §11), from the balance tables. Numbers live with their rules in core/familiars.ts.
export const familiars: In<typeof Familiar>[] = [
  { id: 'hearth-toad', name: 'Hearth Toad', rarity: 'common', text: '+1 Harmony for each potion on your Shelf.' },
  { id: 'barn-owl', name: 'Barn Owl', rarity: 'common', text: 'See the top 3 cards of your draw pile.' },
  { id: 'hedgehog', name: 'Hedgehog', rarity: 'common', text: 'Stone ingredients +4 Potency.' },
  { id: 'ferret', name: 'Ferret', rarity: 'common', text: 'Every 3rd Discard draws an extra card.' },
  { id: 'heron', name: 'Heron', rarity: 'common', text: 'Tide ingredients +3 Potency.' },
  { id: 'garden-snail', name: 'Garden Snail', rarity: 'common', text: 'Ingredients with two essences +2 Potency.' },
  { id: 'otter', name: 'Otter', rarity: 'common', text: '+2 Harmony on brews of exactly 2 ingredients.' },
  { id: 'salamander', name: 'Salamander', rarity: 'common', text: 'Ember ingredients +3 Potency.' },
  { id: 'black-cat', name: 'Black Cat', rarity: 'uncommon', text: '+3 Harmony per Umbra ingredient.' },
  { id: 'raven', name: 'Raven', rarity: 'uncommon', text: '+3 gold whenever you decline an order (rude, but practical).' },
  { id: 'magpie', name: 'Magpie', rarity: 'uncommon', text: '+1 gold for every potion delivered.', pool: 'unlock' },
  { id: 'firefly', name: 'Firefly', rarity: 'uncommon', text: '+3 Harmony on Night Shifts.' },
  { id: 'tortoise', name: 'Tortoise', rarity: 'uncommon', text: '+2 gold for each Brew left unused at the end of the day.' },
  { id: 'fox', name: 'Fox', rarity: 'uncommon', text: 'Tips for beating an order\'s minimum tier are doubled.', pool: 'unlock' },
  { id: 'frost-hare', name: 'Frost Hare', rarity: 'uncommon', text: '+1 Harmony per Frost ingredient in the brew.' },
  { id: 'ermine', name: 'Ermine', rarity: 'uncommon', text: 'Frost ingredients +3 Potency.', pool: 'event' },
  // Regulars' familiars (GDD §13): each joins the pools at Friendship 7 with them.
  { id: 'kitchen-mouse', name: 'Kitchen Mouse', rarity: 'uncommon', text: 'Fruit ingredients +3 Potency.', pool: 'friend' },
  { id: 'squirrel', name: 'Squirrel', rarity: 'uncommon', text: 'Wychwood ingredients +3 Potency.', pool: 'friend' },
  { id: 'dove', name: 'Dove', rarity: 'uncommon', text: '+2 Harmony on brews with no Umbra ingredient.', pool: 'friend' },
  { id: 'pack-mule', name: 'Pack Mule', rarity: 'uncommon', text: 'Potions you sell to the Fence fetch +2 gold.', pool: 'friend' },
  { id: 'nightjar', name: 'Nightjar', rarity: 'uncommon', text: 'Lunar ingredients +3 Potency.', pool: 'friend' },
  { id: 'canary', name: 'Canary', rarity: 'uncommon', text: '+2 Harmony on brews with a Mineral ingredient.', pool: 'friend' },
  { id: 'bumblebee', name: 'Bumblebee', rarity: 'uncommon', text: 'Flower ingredients +3 Potency.', pool: 'event' },
  { id: 'dragonfly', name: 'Dragonfly', rarity: 'uncommon', text: 'Gale ingredients +3 Potency.', pool: 'event' },
  { id: 'cricket', name: 'Cricket', rarity: 'uncommon', text: '+2 Harmony on Clear and Heatwave days.', pool: 'event' },
  { id: 'scarecrow', name: 'Scarecrow', rarity: 'uncommon', text: '+1 Harmony per Vital ingredient.', pool: 'event' },
  { id: 'badger', name: 'Badger', rarity: 'uncommon', text: 'Umbra ingredients +3 Potency.', pool: 'event' },
  { id: 'harvest-hare', name: 'Harvest Hare', rarity: 'uncommon', text: 'Three-ingredient brews: +1 Potency per ingredient.', pool: 'event' },
  { id: 'queen-bee', name: 'Queen Bee', rarity: 'rare', text: 'Brews with 2 or more Flowers: ×1.5 Harmony.', pool: 'event' },
  { id: 'jackdaw', name: 'Jackdaw', rarity: 'uncommon', text: '+1 Harmony per distinct essence in the brew.' },
  { id: 'moth', name: 'Moth', rarity: 'rare', text: 'Lunar ingredients count as every essence.' },
  { id: 'will-o-wisp', name: 'Will-o\'-Wisp', rarity: 'rare', text: 'First brew each day: ×2 Harmony.' },
  { id: 'old-hound', name: 'Old Hound', rarity: 'rare', text: '×1.5 Harmony on brews of 3 ingredients.', pool: 'unlock' },
  { id: 'hob', name: 'Hob', rarity: 'rare', text: 'The first ingredient\'s Potency counts twice.', pool: 'unlock' },
];

// Relics and curses (GDD §9, balance tables). Numbers live with their rules in core/relics.ts.
// Relics (GDD §13): a first run draws from the eight starters; the Almanac adds the rest.
export const relics: In<typeof Relic>[] = [
  { id: 'copper-ladle', name: 'Copper Ladle', tier: 1, text: '+1 Harmony on every brew of 3 ingredients.' },
  { id: 'guild-seal', name: 'Guild Seal', tier: 1, text: 'Rent -10%.' },
  { id: 'lucky-horseshoe', name: 'Lucky Horseshoe', tier: 1, text: 'Reward picks offer 4 cards instead of 3.', pool: 'unlock' },
  { id: 'pressed-flower', name: 'Pressed Flower', tier: 1, text: 'Flower ingredients +2 Potency.', pool: 'unlock' },
  { id: 'apprentice-ledger', name: 'Apprentice\'s Ledger', tier: 1, text: '+1 gold per order filled.' },
  { id: 'silver-bell', name: 'Silver Bell', tier: 1, text: '+1 Friendship on every delivery to a regular.', pool: 'unlock' },
  { id: 'old-almanac', name: 'Old Almanac', tier: 2, text: '+1 Discard on Rain and Fog days.', pool: 'unlock' },
  { id: 'spare-satchel', name: 'Spare Satchel', tier: 2, text: '+1 hand size.' },
  { id: 'may-crown', name: 'May Crown', tier: 2, text: 'Deliveries with a Flower ingredient pay ×1.25.', pool: 'event' },
  { id: 'orchard-basket', name: 'Orchard Basket', tier: 1, text: 'Fruit ingredients +1 Potency.', pool: 'event' },
  { id: 'lantern-glass', name: 'Lantern Glass', tier: 2, text: 'Night Shifts: +1 Discard.', pool: 'event' },
  { id: 'bottle-rack', name: 'Bottle Rack', tier: 1, text: '+1 Shelf slot.', pool: 'event' },
  { id: 'straw-hat', name: 'Straw Hat', tier: 2, text: '+1 Discard on Clear and Heatwave days.', pool: 'event' },
  { id: 'sun-bonnet', name: 'Sun Bonnet', tier: 1, text: 'The first brew on a Heatwave day: +3 Harmony.', pool: 'event' },
  { id: 'feathered-cap', name: 'Feathered Cap', tier: 1, text: 'Every delivery tips +1 gold.', pool: 'event' },
  { id: 'picnic-blanket', name: 'Picnic Blanket', tier: 2, text: 'The first order filled each day pays +3 gold.', pool: 'event' },
  { id: 'apple-press', name: 'Apple Press', tier: 2, text: 'The Fence pays +3 gold for Fine or better potions.', pool: 'event' },
  { id: 'cider-barrel', name: 'Cider Barrel', tier: 1, text: 'Gain 3 gold each time you pay rent.', pool: 'event' },
  { id: 'corn-dolly', name: 'Corn Dolly', tier: 2, text: 'The first delivery each week pays double.', pool: 'event' },
  { id: 'harvest-wreath', name: 'Harvest Wreath', tier: 2, text: '+1 Harmony on every brew in week 4.', pool: 'event' },
  { id: 'wicker-basket', name: 'Wicker Basket', tier: 1, text: 'The Forage errand gives one more pick.', pool: 'event' },
  { id: 'rush-lantern', name: 'Rush Lantern', tier: 1, text: 'Fog never hides your orders.', pool: 'event' },
  { id: 'hive-smoker', name: 'Hive Smoker', tier: 2, text: 'Your first Discard each day draws 1 extra card.', pool: 'event' },
  { id: 'daisy-chain', name: 'Daisy Chain', tier: 1, text: 'Blessed cards also get +2 Potency.', pool: 'event' },
  { id: 'maypole', name: 'Maypole', tier: 2, text: 'The day\'s first brew: +1 Harmony per distinct essence.', pool: 'event' },
  { id: 'flower-basket', name: 'Flower Basket', tier: 2, text: '+1 hand size on Clear days.', pool: 'event' },
  { id: 'ivy-wreath', name: 'Ivy Wreath', tier: 1, text: 'The Fence pays +25% for Shelf potions.', pool: 'event' },
  { id: 'witchs-hatpin', name: 'Witch\'s Hatpin', tier: 2, text: 'Experiments brew at full quality.' },
  { id: 'iron-lid', name: 'Iron Lid', tier: 2, text: 'The first failed brew each day makes no Sludge.' },
  { id: 'moon-locket', name: 'Moon Locket', tier: 3, text: '+1 Brew on Night Shifts.' },
  { id: 'kettle-of-plenty', name: 'Kettle of Plenty', tier: 3, text: 'Potions brewed once every order is resolved go to the Shelf one tier higher.' },
];

export const curses: In<typeof Curse>[] = [
  { id: 'nameless', name: 'Nameless', severity: 1, text: 'Regulars don\'t recognise you: no Friendship this run.' },
  { id: 'leaky-roof', name: 'Leaky Roof', severity: 1, text: 'Shelf -1 slot.' },
  { id: 'sour-luck', name: 'Sour Luck', severity: 2, text: 'Reward picks offer 2 cards, and skipping no longer improves them.' },
  { id: 'moonsick', name: 'Moonsick', severity: 2, text: 'Night Satchel cards -2 Potency.' },
  { id: 'heavy-hands', name: 'Heavy Hands', severity: 3, text: '-1 Discard every day.' },
  { id: 'unpaid-debt', name: 'Unpaid Debt', severity: 3, text: 'Rent +15%.' },
];

// Card modifiers (GDD §5.5), one per ingredient card.
export const modifiers: In<typeof Modifier>[] = [
  { id: 'moonlit', name: 'Moonlit', text: '+2 Harmony when brewed.', price: 6 },
  { id: 'aged', name: 'Aged', text: '+2 Potency for each day in the deck, reset when brewed.', price: 3 },
  { id: 'blessed', name: 'Blessed', text: 'Retrigger: its Potency and effect count twice.', price: 12 },
  { id: 'cursed', name: 'Cursed', text: 'Potency x2. The delivery earns no Friendship.', price: null },
];

// Guild Commissions (GDD §7), from the balance tables. Goals are counted in core/commissions.ts.
export const commissions: In<typeof Commission>[] = [
  { id: 'calm-the-shrine', name: 'Calm the Shrine', goal: 'Deliver 2 Calming potions.', deadline: 1, reward: { kind: 'relic', tier: 1 } },
  { id: 'miners-mend', name: 'Miner\'s Mend', goal: 'Deliver 3 Healing or Protection potions.', deadline: 1, reward: { kind: 'gold', amount: 12 } },
  { id: 'bakers-dozen', name: 'Baker\'s Dozen', goal: 'Brew 3 Warming potions of any tier.', deadline: 1, reward: { kind: 'gold', amount: 10 } },
  { id: 'full-shelf', name: 'Full Shelf', goal: 'End a day with every Shelf slot full.', deadline: 1, reward: { kind: 'gold', amount: 8 } },
  { id: 'no-shadows', name: 'No Shadows', goal: 'Fill 5 orders without an Umbra ingredient.', deadline: 1, reward: { kind: 'card-pick', rarity: 'rare', count: 3 } },
  { id: 'three-of-a-kind', name: 'Three of a Kind', goal: 'Brew 4 potions of 3 ingredients.', deadline: 1, reward: { kind: 'relic', tier: 1 }, minWeek: 2 },
  { id: 'masters-proof', name: 'Master\'s Proof', goal: 'Brew a Masterwork potion.', deadline: 2, reward: { kind: 'relic', tier: 2 }, minWeek: 2 },
  { id: 'full-moon-favour', name: 'Full Moon Favour', goal: 'Deliver 2 Superb Calming potions by the Full Moon.', deadline: 1, dueWeek: 2, reward: { kind: 'relic', tier: 2 }, maxWeek: 2 },
  { id: 'the-whole-town', name: 'The Whole Town', goal: 'Deliver to 5 different customers.', deadline: 1, reward: { kind: 'gold', amount: 15 }, minWeek: 2 },
  { id: 'night-owl', name: 'Night Owl', goal: 'Fill every order on the coming Night Shift.', deadline: 1, reward: { kind: 'relic', tier: 3 }, minWeek: 2 },
];

// The Night Market's stalls (GDD §9).
export const stalls: In<typeof Stall>[] = [
  { id: 'lantern-seller', name: 'The Lantern Seller', currency: 'Gold', text: 'Lunar ingredients and Omens for your Night Satchel.', opens: 'always' },
  { id: 'fence', name: 'The Fence', currency: 'Potions', text: 'Buys your Shelf at night prices. Pays more for potions with Umbra or Lunar in them.', opens: 'always' },
  { id: 'moth-broker', name: 'The Moth Broker', currency: 'Memories', text: 'Forget a recipe you learned for a Rare card.', opens: 'drawn' },
  { id: 'hollow-tailor', name: 'The Hollow Tailor', currency: 'Cards', text: 'Give up a card. Its essence is sewn into another, with +1 Potency.', opens: 'drawn' },
  { id: 'fortune-tent', name: 'Fortune Tent', currency: 'Gold, a gamble', text: 'Draw a tarot: a boon, or a twist on next week.', opens: 'drawn' },
  { id: 'name-taker', name: 'The Name-Taker', currency: 'Your name', text: 'Take a Curse for a relic. A worse Curse buys a better one.', opens: 'drawn' },
  { id: 'wandering-tinker', name: 'The Wandering Tinker', currency: 'Gold', text: 'Here only at the full moon: a cauldron slot and a Shelf slot, cheap.', opens: 'full-moon' },
  { id: 'black-market', name: 'The Black Market', currency: 'Gold or cards', text: 'Here only at the new moon: Rare cards for gold, or for two of yours.', opens: 'new-moon' },
  // Seasonal stalls (balance tables, shops.json): drawn with the others, only in their season.
  { id: 'seed-swapper', name: 'The Seed Swapper', currency: 'Cards and gold', text: 'Two Common cards and 5 gold for an Uncommon of your choice.', opens: 'season', season: 'spring' },
  { id: 'blossom-oracle', name: 'The Blossom Oracle', currency: 'Gold', text: "Reads the petals and changes next week's weather.", opens: 'season', season: 'spring', nextWeek: true },
  { id: 'firefly-games', name: 'Firefly Games', currency: 'Gold, a game', text: 'A ring toss: one in three wins a familiar. Every miss wins a Common card.', opens: 'season', season: 'summer' },
  { id: 'nectar-trader', name: 'The Nectar Trader', currency: 'Potions', text: 'A Superb or better potion buys a Rare card of your choice.', opens: 'season', season: 'summer' },
  { id: 'cider-press', name: 'The Cider Press', currency: 'Potions', text: 'Press a Shelf potion: one ingredient gets +2 Potency for the run.', opens: 'season', season: 'autumn' },
  { id: 'harvest-auction', name: 'The Harvest Auction', currency: 'Gold, a bid', text: 'Bid against the farmers for a tier 2 relic. You pay only if you win.', opens: 'season', season: 'autumn' },
  { id: 'hearth-trader', name: 'The Hearth Trader', currency: 'Gold', text: 'Trades with friends of the town (Friendship 2): a Rare card or a familiar, the Yule Log, and the Holly Crown.', opens: 'season', season: 'winter', everyNight: true },
];

// The Fortune Tent's tarot deck (GDD §9).
export const tarot: In<typeof Tarot>[] = [
  { id: 'the-sun', name: 'The Sun', kind: 'boon', weight: 10, effect: 'gold', amount: 15, text: '+15 gold.' },
  { id: 'the-star', name: 'The Star', kind: 'boon', weight: 10, effect: 'lunar-card', text: 'A random Lunar ingredient for your Night Satchel.' },
  { id: 'the-magician', name: 'The Magician', kind: 'boon', weight: 8, effect: 'learn-recipe', text: 'Learn a random recipe you don\'t know.' },
  { id: 'the-lovers', name: 'The Lovers', kind: 'boon', weight: 8, effect: 'hearts', amount: 2, text: '+2 Friendship with a random regular.' },
  { id: 'the-chariot', name: 'The Chariot', kind: 'boon', weight: 6, effect: 'familiar', amount: 10, text: 'A random familiar, if you have a free slot. If not, +10 gold.' },
  { id: 'wheel-of-fortune', name: 'Wheel of Fortune', kind: 'boon', weight: 8, effect: 'bless', amount: 8, text: 'Blessed on a random ingredient in your deck. If none can take it, +8 gold.' },
  { id: 'the-world', name: 'The World', kind: 'boon', weight: 3, effect: 'relic', amount: 12, text: 'A tier 2 relic. If you hold them all, +12 gold.' },
  { id: 'the-hermit', name: 'The Hermit', kind: 'twist', weight: 9, effect: 'fewer-orders', nextWeek: true, text: 'Next week: one order fewer each day, each paying +50%.' },
  { id: 'the-tower', name: 'The Tower', kind: 'twist', weight: 9, effect: 'harder-orders', nextWeek: true, text: 'Next week: orders are one tier harder and pay double.' },
  { id: 'the-moon', name: 'The Moon', kind: 'twist', weight: 9, effect: 'fog-week', nextWeek: true, text: 'Next week: Fog every day.' },
  { id: 'the-fool', name: 'The Fool', kind: 'twist', weight: 10, effect: 'bad-omen', amount: 8, text: 'A Bad Omen joins your deck, and +8 gold.' },
  { id: 'death', name: 'Death', kind: 'twist', weight: 10, effect: 'lose-card', text: 'A random card leaves your deck (never below 8).' },
];

export const witches: In<typeof Witch>[] = [
  {
    id: 'hedge-witch',
    name: 'Hedge Witch',
    focus: 'Vital and Tide; healing',
    quirk: '+1 card in hand.',
    handSize: 8,
    startingDeck: [
      { card: 'elmroot', count: 3 },
      { card: 'creekwater', count: 3 },
      { card: 'emberbloom', count: 2 },
      { card: 'thistledown', count: 2 },
      { card: 'river-clay', count: 1 },
      { card: 'nightshade', count: 1 },
      { card: 'willow-bark', count: 1 },
      { card: 'stir', count: 1 },
    ],
    knownRecipes: ['healing-draught', 'hearthwarm-tonic', 'calm-waters', 'sleep-syrup'],
  },
  {
    id: 'bloom-witch',
    name: 'Bloom Witch',
    focus: 'Vital and Gale; Flowers',
    quirk: 'The day\'s first brew with a Flower in it: +2 Harmony. +1 Discard a day in Spring.',
    handSize: 7,
    startingDeck: [
      { card: 'elmroot', count: 3 },
      { card: 'thistledown', count: 3 },
      { card: 'dandelion-fluff', count: 2 },
      { card: 'creekwater', count: 2 },
      { card: 'emberbloom', count: 1 },
      { card: 'sunflower', count: 1 },
      { card: 'mint-sprig', count: 1 },
      { card: 'stir', count: 1 },
    ],
    knownRecipes: ['four-leaf-tea', 'healing-draught', 'calm-waters', 'fleetfoot-elixir'],
    unlockSeason: 'spring',
  },
  {
    id: 'alchemist',
    name: 'Alchemist',
    focus: 'Stone and Ember; transformation',
    quirk: 'The day\'s first Experiment brews at full quality. +1 card in hand. +1 Discard a day in Summer.',
    handSize: 8,
    startingDeck: [
      { card: 'river-clay', count: 3 },
      { card: 'iron-filings', count: 2 },
      { card: 'emberbloom', count: 3 },
      { card: 'hearth-coal', count: 1 },
      { card: 'elmroot', count: 2 },
      { card: 'creekwater', count: 1 },
      { card: 'honeycomb', count: 1 },
      { card: 'simmer', count: 1 },
    ],
    knownRecipes: ['courage-cordial', 'ironhide-salve', 'hearthwarm-tonic', 'mudbath-salve'],
    unlockSeason: 'summer',
  },
  {
    id: 'illusionist',
    name: 'Illusionist',
    focus: 'Umbra and Gale; glamours',
    quirk: 'Once a day, a potion can fill an order for another recipe of the same family. +1 Discard a day in Autumn.',
    handSize: 7,
    startingDeck: [
      { card: 'nightshade', count: 3 },
      { card: 'inkcap', count: 2 },
      { card: 'thistledown', count: 3 },
      { card: 'creekwater', count: 2 },
      { card: 'emberbloom', count: 1 },
      { card: 'elmroot', count: 1 },
      { card: 'mistcap', count: 1 },
      { card: 'taste-test', count: 1 },
    ],
    knownRecipes: ['whisper-ink', 'sleep-syrup', 'fleetfoot-elixir', 'restful-tonic'],
    unlockSeason: 'autumn',
  },
  {
    id: 'frost-witch',
    name: 'Frost Witch',
    focus: 'Tide and Umbra; Frost',
    quirk: 'On Snow days, +1 card in hand. +1 Discard a day in Winter.',
    handSize: 7,
    startingDeck: [
      { card: 'creekwater', count: 3 },
      { card: 'nightshade', count: 2 },
      { card: 'frostcap', count: 1 },
      { card: 'hollyberry', count: 1 },
      { card: 'pine-resin', count: 1 },
      { card: 'elmroot', count: 2 },
      { card: 'inkcap', count: 1 },
      { card: 'thistledown', count: 2 },
      { card: 'stir', count: 1 },
    ],
    knownRecipes: ['sleep-syrup', 'calm-waters', 'healing-draught', 'restful-tonic'],
    unlockSeason: 'winter',
  },
];

/** Cauldrons (GDD §12): Copper is open from the start, the rest open with Almanac entries. */
export const cauldrons: In<typeof Cauldron>[] = [
  { id: 'copper', name: 'Copper Cauldron', text: 'No surprises.' },
  { id: 'iron', name: 'Iron Cauldron', text: '3 cauldron slots from the start. -1 Brew a day.', unlock: 'open-for-business', slots: 3, brews: -1 },
  { id: 'glass', name: 'Glass Cauldron', text: '+1 Harmony on every brew. -1 card in hand and -1 Discard a day.', unlock: 'masterwork', harmony: 1, hand: -1, discards: -1 },
  { id: 'bone', name: 'Bone Cauldron', text: '2 Lunar ingredients in your Night Satchel from the start. Rent +5%.', unlock: 'nameless-deal', lunarCards: 2, rent: 1.05 },
  { id: 'silver', name: 'Silver Cauldron', text: '+1 Discard a day. Orders pay 5% less.', unlock: 'legend-thrice', discards: 1, pay: 0.95 },
];

// Dusk events (GDD §7), all 20 from the balance tables (the last 12 approved by Jacob, Oct 16). Each choice's rule is in core/dusk-events.ts.
export const duskEvents: In<typeof DuskEvent>[] = [
  {
    id: 'shrine-blessing', name: 'A Shrine Blessing', tags: ['town'], weight: 4,
    text: 'The little shrine by the well glows warm tonight. The keeper smiles at you.',
    choices: [{ label: 'Kneel', text: 'Leave 6 gold. Blessed on an ingredient of your choice.' }, { label: 'Nod and go', text: 'Nothing happens.' }],
  },
  {
    id: 'moonlit-walk', name: 'A Moonlit Walk', tags: ['fae'], weight: 4,
    text: 'The lane home is silver under the moon, and something hums along with you.',
    choices: [{ label: 'Wander', text: 'Moonlit on a random ingredient.' }],
  },
  {
    id: 'kettle-explodes', name: 'The Kettle Explodes', tags: ['mishap'], weight: 4,
    text: 'BANG. The old kettle is everywhere, and it smells oddly of honey.',
    choices: [{ label: 'Laugh it off', text: 'A Sludge joins your deck. Aged on a random ingredient.' }],
  },
  {
    id: 'spilled-cauldron', name: 'Spilled Cauldron', tags: ['mishap'], weight: 6,
    text: 'A cauldron tips over on the way out. The floor is sticky with it.',
    choices: [{ label: 'Mop up', text: 'A Cobweb joins your deck.' }, { label: 'Pay for help', text: 'Pay 4 gold.' }],
  },
  {
    id: 'found-coin-purse', name: 'A Found Coin Purse', tags: ['town'], weight: 4,
    text: 'A plump purse lies in the gutter, embroidered with a name you half know.',
    choices: [{ label: 'Return it', text: '+1 Friendship with a random regular.' }, { label: 'Keep it', text: '+10 gold. A Bad Omen joins your deck.' }],
  },
  {
    id: 'bargain-bin', name: 'The Bargain Bin', tags: ['market'], weight: 5,
    text: 'A stall is closing up, and its bargain bin is still out.',
    choices: [{ label: 'Rummage', text: 'Pay 3 gold for a random Uncommon card.' }, { label: 'Rummage deep', text: 'Pay 7 gold for a random Rare card.' }, { label: 'Walk on', text: 'Nothing happens.' }],
  },
  {
    id: 'mice-in-the-pantry', name: 'Mice in the Pantry', tags: ['mishap'], weight: 5,
    text: 'Something has been nibbling the herbs. Several somethings.',
    choices: [{ label: 'Set traps', text: 'Lose a random Common card.' }, { label: 'Adopt them', text: 'A Cobweb joins your deck, and +3 gold from their stash.' }],
  },
  {
    id: 'fairy-ring', name: 'A Fairy Ring', tags: ['fae'], weight: 5,
    text: 'A ring of toadstools in the meadow, humming faintly.',
    choices: [{ label: 'Step in', text: 'A random card turns into one of the next rarity up.' }, { label: 'Walk around', text: 'Nothing happens.' }],
  },
  {
    id: 'fae-bargain', name: 'A Fae Bargain', tags: ['fae'], weight: 6,
    text: 'A voice from the hedge offers a trade: something of the moon, for something of tomorrow.',
    choices: [{ label: 'Accept', text: 'Skip your next dusk reward. A random Lunar ingredient goes into your Night Satchel.' }, { label: 'Refuse politely', text: 'Nothing happens.' }],
  },
  {
    id: 'pixie-thief', name: 'The Pixie Thief', tags: ['fae', 'mishap'], weight: 5,
    text: 'A pixie darts off with 4 of your coins, giggling.',
    choices: [{ label: 'Chase', text: '-1 Discard tomorrow. You get your coins back, and +4 gold.' }, { label: 'Let it go', text: 'Lose 4 gold.' }],
  },
  {
    id: 'changeling-bottle', name: 'A Changeling Bottle', tags: ['fae'], weight: 4,
    text: 'A bottle on the step that was not there before. It shimmers when you look away.',
    choices: [{ label: 'Swap', text: 'A Shelf potion of your choice goes up one tier.' }, { label: 'Leave it', text: 'Nothing happens.' }],
  },
  {
    id: 'cracked-shelf', name: 'A Cracked Shelf', tags: ['mishap'], weight: 4,
    text: 'The Shelf creaks, and a long crack runs along the middle board.',
    choices: [{ label: 'Repair', text: 'Pay 5 gold.' }, { label: 'Leave it', text: 'Lose a random Shelf potion.' }],
  },
  {
    id: 'market-day', name: 'Market Day', tags: ['market'], weight: 6,
    text: 'The square is still busy, and the stalls are clearing out stock.',
    choices: [{ label: 'Browse', text: 'Visit the Market Square, every price 25% off.' }],
  },
  {
    id: 'spice-merchant', name: 'The Spice Merchant', tags: ['market'], weight: 4,
    text: 'A merchant with a cart of jars, packing up for the night. Everything smells of fire.',
    choices: [{ label: 'Buy', text: 'Pay 6 gold for a Spice of your choice.' }, { label: 'Haggle', text: 'Every Spice, free. A Bad Omen joins your deck.' }],
  },
  {
    id: 'sell-a-recipe', name: 'Sell a Recipe', tags: ['market'], weight: 4,
    text: 'A cook from out of town wants to buy one of your recipes, and pays well for it.',
    choices: [{ label: 'Sell', text: 'Forget a recipe you learned this run. +12 gold.' }, { label: 'Keep it', text: 'Nothing happens.' }],
  },
  {
    id: 'childrens-dare', name: "Pip & Quill's Dare", tags: ['town'], weight: 5,
    text: 'Pip and Quill dare you to brew one blindfolded. Quill has the blindfold ready.',
    choices: [{ label: 'Take the dare', text: 'Your next brew has no preview. +2 Friendship with Pip & Quill.' }, { label: 'Not today', text: 'Nothing happens.' }],
  },
  {
    id: 'tobins-stories', name: "Old Tobin's Stories", tags: ['town'], weight: 5,
    text: 'Old Tobin is on his bench, and he has a story about the mine. He always does.',
    choices: [{ label: 'Listen', text: '+1 Friendship with Old Tobin, and a Geode joins your deck.' }],
  },
  {
    id: 'bake-sale', name: "Bea's Bake Sale", tags: ['town'], weight: 5,
    text: 'Bea has a table out for the bake sale, and it needs something warm to drink.',
    choices: [{ label: 'Help out', text: 'Give your lowest Warming Shelf potion. +8 gold and +1 Friendship with Bea.' }, { label: 'Buy a bun', text: 'Pay 1 gold. +1 Brew tomorrow.' }],
  },
  {
    id: 'apprentice-asks', name: 'An Apprentice Asks', tags: ['town'], weight: 4,
    text: 'A young apprentice asks to learn from you, and offers to trade notes.',
    choices: [{ label: 'Teach', text: 'Give away a card of your choice. Learn a random recipe you don\'t know.' }, { label: 'Not now', text: 'Nothing happens.' }],
  },
  {
    id: 'old-cookbook', name: 'An Old Cookbook', tags: ['market'], weight: 4, needs: 'grimoire-page',
    text: 'A bookseller holds up a cookbook with pages loose at the back.',
    choices: [{ label: 'Buy it', text: 'Pay 8 gold for a Grimoire Page.' }, { label: 'Leaf through', text: 'Learn who the rest of the month\'s patrons are.' }],
  },
];

// Cottage perks (GDD §13): bought once each with Reputation, on a board of four tiers. Tier 1 is open
// from the start; later tiers open with Years and the Almanac (PERK_TIERS in core/meta.ts). Starting values for tuning.
export const perks: In<typeof Perk>[] = [
  { id: 'nest-egg', name: 'Nest Egg', text: 'Start every run with 5 more gold.', tier: 1, cost: 15, start: { gold: 5 } },
  { id: 'deep-shelf', name: 'A Deeper Shelf', text: 'Your Shelf starts with 5 slots instead of 4.', tier: 1, cost: 20, start: { shelf: 1 } },
  { id: 'old-spoon', name: "Gran's Spoon", text: 'Start every run with a Stir in your deck.', tier: 1, cost: 25, start: { cards: ['stir'] } },
  { id: 'spare-perch', name: 'A Spare Perch', text: 'Room for one more familiar.', tier: 1, cost: 35, start: { familiarSlots: 1 } },
  { id: 'full-purse', name: 'A Full Purse', text: 'Start every run with 5 more gold.', tier: 2, cost: 45, start: { gold: 5 } },
  { id: 'blessed-ladle', name: 'A Blessed Ladle', text: 'A random starting card is Blessed.', tier: 2, cost: 55, start: { blessed: 1 } },
  { id: 'tidy-habits', name: 'Tidy Habits', text: 'Start every run with two Tidy Ups in your deck.', tier: 2, cost: 60, start: { cards: ['tidy-up', 'tidy-up'] } },
  { id: 'grans-charm', name: "Gran's Charm", text: 'Start every run with a random tier 1 relic.', tier: 2, cost: 70, start: { relicTier: 1 } },
  { id: 'wide-shelf', name: 'A Wide Shelf', text: 'One more Shelf slot.', tier: 3, cost: 120, start: { shelf: 1 } },
  { id: 'grans-notes', name: "Gran's Notes", text: 'Start every run with a Steep and a Sift in your deck.', tier: 3, cost: 130, start: { cards: ['steep', 'sift'] } },
  { id: 'twice-blessed', name: 'Twice Blessed', text: 'Another random starting card is Blessed.', tier: 3, cost: 150, start: { blessed: 1 } },
  { id: 'savings-jar', name: 'A Savings Jar', text: 'Start every run with 10 more gold.', tier: 4, cost: 220, start: { gold: 10 } },
  { id: 'heirloom', name: 'The Heirloom', text: 'Start every run with another random tier 1 relic.', tier: 4, cost: 260, start: { relicTier: 1 } },
  { id: 'big-cauldron', name: 'A Bigger Cauldron', text: 'Your cauldron holds one more card.', tier: 4, cost: 320, start: { cauldron: 1 } },
];

// The Almanac (GDD §13): goals met in any run, each adding content to the pools for good.
// Goals are checked in core/almanac.ts. Together they unlock every `pool: 'unlock'` card, recipe, familiar and relic.
export const almanac: In<typeof AlmanacEntry>[] = [
  { id: 'open-for-business', name: 'Open for Business', goal: 'Fill 25 orders in one run.', unlocks: ['lavender', 'clover', 'magpie', 'thunderstride-tonic'] },
  { id: 'paid-up', name: 'Paid Up', goal: 'Pay the rent three weeks running.', unlocks: ['ginger-root', 'sea-salt', 'bonfire-cordial', 'ironheart-draught'] },
  { id: 'superb-work', name: 'Superb Work', goal: 'Brew a Superb potion.', unlocks: ['mountain-salve', 'decant', 'lullaby-draught'] },
  { id: 'masterwork', name: 'A Masterwork', goal: 'Brew a Masterwork potion.', unlocks: ['old-hound', 'menders-broth'] },
  { id: 'legendary', name: 'The Stuff of Legend', goal: 'Brew a Legendary potion.', unlocks: ['old-almanac'] },
  { id: 'shopkeeper', name: 'Shopkeeper', goal: 'Sell 12 potions from your Shelf in one run.', unlocks: ['geode', 'mulled-cider'] },
  { id: 'menagerie', name: 'Menagerie', goal: 'Keep 3 familiars at once.', unlocks: ['fox', 'silver-bell'] },
  { id: 'collector', name: 'Collector', goal: 'Hold 4 relics at once.', unlocks: ['pressed-flower', 'grimoire-page'] },
  { id: 'nameless-deal', name: 'A Nameless Deal', goal: 'Take a Curse at the Name-Taker.', unlocks: ['fae-dust', 'cracked-mirror', 'moth-swarm'] },
  { id: 'spring-won', name: 'Spring in Elmbrook', goal: 'Win Spring.', unlocks: ['fetch-draught', 'tidewall-salve'] },
  { id: 'summer-won', name: 'Summer in Elmbrook', goal: 'Win Summer.', unlocks: ['harvest-gourd'] },
  { id: 'autumn-won', name: 'Autumn in Elmbrook', goal: 'Win Autumn.', unlocks: ['moonpetal'] },
  { id: 'winter-won', name: 'Winter in Elmbrook', goal: 'Win Winter.', unlocks: ['second-wind', 'hob'] },
  // The second page (Jacob, Oct 15): harder goals, paid in the strongest unlock content, moved here from the first page.
  { id: 'legend-thrice', name: 'A Legend Thrice', goal: 'Brew 3 Legendary potions in one run.', unlocks: ['starlight-elixir'] },
  { id: 'full-ledger', name: 'A Full Ledger', goal: 'Fill 40 orders in one run.', unlocks: ['elmbrook-panacea'] },
  { id: 'steady-hand', name: 'A Steady Hand', goal: 'Win a season without using a Discard.', unlocks: ['kelpie-pearl'] },
  { id: 'every-witch', name: 'Every Witch\'s Way', goal: 'Win a season with every witch.', unlocks: ['taste-of-memory'] },
  { id: 'every-cauldron', name: 'Every Pot in the House', goal: 'Win a season in every cauldron.', unlocks: ['black-cauldron'] },
  { id: 'deep-winter', name: 'Deep Winter', goal: 'Win Winter in Year 3 or later.', unlocks: ['heartstone'] },
  { id: 'tidy-sum', name: 'A Tidy Sum', goal: 'Win a season with 150 gold to spare.', unlocks: ['lucky-horseshoe'] },
];

// Boons (GDD §13): three are offered when you loop into the next Year; the one you pick lasts the Year.
export const boons: In<typeof Boon>[] = [
  { id: 'lucky-find', name: 'A Lucky Find', text: 'Start every run with a random tier 1 relic.', start: { relicTier: 1 } },
  { id: 'blessed-start', name: 'Blessed Hands', text: 'A random card in your starting deck is Blessed.', start: { blessed: 1 } },
  { id: 'another-perch', name: 'Another Perch', text: 'Room for one more familiar.', start: { familiarSlots: 1 } },
  { id: 'winter-savings', name: 'Winter Savings', text: 'Start every run with 15 more gold.', start: { gold: 15 } },
  { id: 'tall-shelf', name: 'A Taller Shelf', text: 'One more Shelf slot.', start: { shelf: 1 } },
];

export const fairs: In<typeof Fair>[] = [
  {
    id: 'bloomtide',
    name: 'The Bloomtide Fair',
    intro: [
      'Bloomtide: the first warm week, when the whole valley flowers at once.',
      'After the shops close the square fills with lanterns, and growers from the hill farms set out what they only bring down once a year.',
    ],
    stalls: [
      { id: 'flower-grower', name: 'The Flower Grower', text: 'Flowers from the glasshouses up the hill.', show: 2,
        stock: [{ card: 'maybloom', price: 10 }, { card: 'primrose', price: 10 }, { card: 'bluebell', price: 7 }, { card: 'snowdrop', price: 7 }, { card: 'cowslip', price: 7 }, { card: 'daffodil', price: 10 }] },
      { id: 'beekeeper', name: 'The Beekeeper', text: 'Honey, wax, and a bee that took a liking to you.', show: 2,
        stock: [{ familiar: 'bumblebee', price: 14 }, { card: 'royal-jelly', price: 9 }, { card: 'beeswax-candle', price: 6 }, { card: 'spring-mead', price: 9 }, { familiar: 'queen-bee', price: 18 }, { relic: 'hive-smoker', price: 18 }] },
      { id: 'garland-weaver', name: 'The Garland Weaver', text: 'Crowns of may blossom for the season.', show: 2,
        stock: [{ relic: 'may-crown', price: 18 }, { relic: 'daisy-chain', price: 14 }, { relic: 'maypole', price: 18 }, { relic: 'flower-basket', price: 18 }, { relic: 'ivy-wreath', price: 14 }, { card: 'garland', price: 7 }] },
    ],
  },
  {
    id: 'firefly-fair',
    name: 'The Firefly Fair',
    intro: [
      'Midsummer: the longest days of the year, and the warmest nights.',
      'When the shops close the square fills with jars of fireflies, and traders from the south slopes and the glassworks set out their summer wares.',
    ],
    stalls: [
      { id: 'orchard-keeper', name: 'The Orchard Keeper', text: 'Stone fruit and sweet things from the south slopes.', show: 2,
        stock: [{ card: 'sunpeach', price: 10 }, { card: 'starfruit', price: 10 }, { card: 'wild-cherry', price: 7 }, { card: 'plum', price: 7 }, { card: 'melon', price: 7 }, { relic: 'orchard-basket', price: 14 }] },
      { id: 'glassblower', name: 'The Glassblower', text: 'Jars, lenses and things that catch the light.', show: 2,
        stock: [{ card: 'firefly-jar', price: 6 }, { card: 'sun-bottle', price: 7 }, { card: 'prism', price: 8 }, { familiar: 'dragonfly', price: 14 }, { relic: 'lantern-glass', price: 18 }, { relic: 'bottle-rack', price: 14 }] },
      { id: 'hatter', name: 'The Hatter', text: 'Straw and linen for the long bright days.', show: 2,
        stock: [{ relic: 'straw-hat', price: 18 }, { relic: 'sun-bonnet', price: 14 }, { relic: 'feathered-cap', price: 14 }, { relic: 'picnic-blanket', price: 18 }, { familiar: 'cricket', price: 14 }, { card: 'paper-fan', price: 5 }] },
    ],
  },
  {
    id: 'harvest-fair',
    name: 'The Harvest Fair',
    intro: [
      'The harvest is in. Carts have been rolling into town all week.',
      'After closing the square is lit with lanterns and bonfires, and the farms set out the best of the year, with cider by the barrel.',
    ],
    stalls: [
      { id: 'farmer', name: 'The Farmer', text: 'The best of the harvest, brought in by cart.', show: 2,
        stock: [{ card: 'prize-pumpkin', price: 10 }, { card: 'hazelnut', price: 7 }, { card: 'golden-wheat', price: 7 }, { card: 'russet-apple', price: 7 }, { card: 'chestnut', price: 7 }, { familiar: 'scarecrow', price: 14 }] },
      { id: 'cider-maker', name: 'The Cider Maker', text: 'Pressed this week, poured by the barrel.', show: 2,
        stock: [{ card: 'spiced-cider', price: 9 }, { card: 'perry', price: 7 }, { card: 'mulling-spice', price: 6 }, { familiar: 'badger', price: 14 }, { relic: 'apple-press', price: 18 }, { relic: 'cider-barrel', price: 14 }] },
      { id: 'straw-weaver', name: 'The Straw Weaver', text: 'Dollies, baskets and wreaths woven from the last sheaf.', show: 2,
        stock: [{ relic: 'corn-dolly', price: 18 }, { relic: 'harvest-wreath', price: 18 }, { relic: 'wicker-basket', price: 14 }, { relic: 'rush-lantern', price: 14 }, { familiar: 'harvest-hare', price: 14 }, { card: 'threshing-flail', price: 5 }] },
    ],
  },
];

// The Solstice Fire at the Longest Night vigil (GDD §4.2): three are offered, one is chosen, and it lasts the finale's Night Shift.
export const blessings: In<typeof Blessing>[] = [
  { id: 'candle-in-the-window', name: 'Candle in the Window', text: 'Your Grimoire stays open tonight, whatever the Moonless Patron says.' },
  { id: 'hearthfire', name: 'Hearthfire', text: '+1 Brew tonight.' },
  { id: 'warm-hands', name: 'Warm Hands', text: '+2 Discards tonight.' },
  { id: 'old-songs', name: 'Old Songs', text: 'Every brew tonight: +2 Harmony.' },
  { id: 'the-long-watch', name: 'The Long Watch', text: 'Draw 2 more cards when tonight starts.' },
  { id: 'starlight', name: 'Starlight', text: 'The Moonless Patron\'s last order asks for one tier lower.' },
];
