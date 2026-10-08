import type { z } from 'zod';
import type { Familiar, Ingredient, Junk, NightCustomer, Patron, Recipe, Regular, Stall, Tarot, Tincture, Witch } from './schema';

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
  { id: 'honeycomb', name: 'Honeycomb', essences: ['vital', 'ember'], potency: 4, rarity: 'uncommon', origin: 'market', tags: ['sweet'], inSeason: ['summer'] },
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
  { id: 'salamander-scale', name: 'Salamander Scale', essences: ['ember'], potency: 7, rarity: 'rare', origin: 'market', effects: ['harmony-per-ember-in-brew'], text: '+1 Harmony per Ember ingredient in the brew.', tags: ['scale'] },
  { id: 'kelpie-pearl', name: 'Kelpie Pearl', essences: ['tide'], potency: 7, rarity: 'rare', origin: 'creek', effects: ['brew-makes-2'], text: 'A brew with it makes 2 potions.', tags: ['pearl'], pool: 'unlock' },
  { id: 'stormseed', name: 'Stormseed', essences: ['gale'], potency: 8, rarity: 'rare', origin: 'wychwood', effects: ['on-brew-draw-2'], text: 'When brewed, draw 2.', tags: ['seed'] },
  { id: 'heartstone', name: 'Heartstone', essences: ['stone'], potency: 9, rarity: 'rare', origin: 'mine', effects: ['gain-heart'], text: '+1 heart with the customer.', tags: ['mineral'], pool: 'unlock' },
  { id: 'shadowroot', name: 'Shadowroot', essences: ['umbra'], potency: 7, rarity: 'rare', origin: 'wychwood', effects: ['harmony-x1.5-if-secrets'], text: 'x1.5 Harmony in a Secrets potion.', tags: ['root'], inSeason: ['autumn'] },
  { id: 'harvest-gourd', name: 'Harvest Gourd', essences: ['vital', 'stone'], potency: 6, rarity: 'rare', origin: 'garden', effects: ['potency-2-per-order-today'], text: '+2 Potency for each order filled today.', tags: ['fruit'], inSeason: ['autumn'], pool: 'unlock' },
  { id: 'ice-lily', name: 'Ice Lily', essences: ['tide'], potency: 8, rarity: 'rare', origin: 'creek', effects: ['harmony-per-frost-in-brew'], text: '+1 Harmony per Frost ingredient in the brew.', tags: ['flower', 'frost'], inSeason: ['winter'] },
  { id: 'starlit-dew', name: 'Starlit Dew', essences: ['lunar', 'tide'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true, tags: ['water'] },
  { id: 'moonmoth-wing', name: 'Moonmoth Wing', essences: ['lunar', 'gale'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['wild-essence'], text: 'Counts as any essence.', tags: ['feather'] },
  { id: 'grave-moss', name: 'Grave Moss', essences: ['lunar', 'umbra'], potency: 10, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['lose-heart'], text: '-1 heart with the customer.', tags: ['herb'] },
  { id: 'moonpetal', name: 'Moonpetal', essences: ['lunar', 'vital'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true, tags: ['flower'], inSeason: ['spring'], pool: 'unlock' },
  { id: 'lantern-ember', name: 'Lantern Ember', essences: ['lunar', 'ember'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true, tags: ['mineral'], inSeason: ['summer'] },
  { id: 'lunar-salt', name: 'Lunar Salt', essences: ['lunar', 'stone'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['aged'], text: 'Aged.', tags: ['mineral'] },
  { id: 'wolfsbane', name: 'Wolfsbane', essences: ['lunar', 'umbra'], potency: 12, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['night-discard-cost'], text: 'Drawing it costs 1 Discard this shift.', tags: ['flower'], inSeason: ['autumn'] },
  { id: 'fae-dust', name: 'Fae Dust', essences: ['lunar'], potency: 6, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['wild-essence', 'on-brew-draw-1'], text: 'Counts as any essence. When brewed, draw 1.', tags: ['dust'], pool: 'unlock' },
  { id: 'rime-blossom', name: 'Rime Blossom', essences: ['lunar', 'tide'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['harmony-per-frost-in-brew'], text: '+1 Harmony per Frost ingredient in the brew.', tags: ['flower', 'frost'], inSeason: ['winter'] },
  { id: 'fallen-star', name: 'Fallen Star', essences: ['lunar', 'gale'], potency: 11, rarity: 'lunar', origin: 'night', effects: ['day-usable', 'gone-at-week-end'], text: 'Can be brewed on Days. Gone when the week ends.', tags: ['star'], pool: 'event', event: 'meteor-shower' },
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
  { id: 'charm-sachet', name: 'Charm Sachet', rarity: 'uncommon', effects: ['next-delivery-heart-tip'], text: 'Your next delivery earns +1 heart and +3 gold.' },
  { id: 'double-boil', name: 'Double Boil', rarity: 'rare', effects: ['next-brew-harmony-x1.5'], text: 'Next brew: Harmony x1.5.' },
  { id: 'bottle-spare', name: 'Bottle Spare', rarity: 'rare', effects: ['next-brew-double'], text: 'Your next brew makes 2 potions.' },
  { id: 'second-wind', name: 'Second Wind', rarity: 'rare', effects: ['gain-brew'], text: 'Gain 1 Brew today.', pool: 'unlock' },
  { id: 'grimoire-page', name: 'Grimoire Page', rarity: 'rare', effects: ['next-experiment-full', 'draw-2'], text: 'Your next Experiment brews at full quality. Draw 2.', pool: 'unlock' },
  // Omens: Night Satchel Tinctures (GDD §5.4), strong with a drawback. They only come out on Night Shifts.
  { id: 'blood-moon', name: 'Blood Moon', rarity: 'lunar', effects: ['next-brew-harmony-x2', 'lose-discard'], text: 'Next brew: Harmony x2. Lose 1 Discard.' },
  { id: 'black-cat-crossing', name: 'Black Cat Crossing', rarity: 'lunar', effects: ['draw-3', 'discard-random-1'], text: 'Draw 3, then discard a random card.' },
  { id: 'raven-call', name: 'Raven Call', rarity: 'lunar', effects: ['gain-brew', 'next-customer-lose-heart'], text: 'Gain 1 Brew. -1 heart with the next customer you serve.' },
  { id: 'witching-hour', name: 'Witching Hour', rarity: 'lunar', effects: ['next-brew-potency-x2', 'add-sludge'], text: 'Next brew: Potency x2. Add a Sludge to your deck.' },
  { id: 'howl', name: 'Howl', rarity: 'lunar', effects: ['potency-2-per-lunar-in-brew'], text: 'Next brew: every ingredient +2 Potency per Lunar card in the cauldron.' },
  { id: 'cracked-mirror', name: 'Cracked Mirror', rarity: 'lunar', effects: ['copy-card-permanent', 'lose-gold-3'], text: 'Add a copy of a card in hand to your deck. Lose 3 gold.', pool: 'unlock' },
  { id: 'wishing-star', name: 'Wishing Star', rarity: 'lunar', effects: ['next-delivery-pay-x2', 'lose-discard'], text: 'Your next delivery pays double. Lose 1 Discard.' },
  { id: 'moth-swarm', name: 'Moth Swarm', rarity: 'lunar', effects: ['hand-counts-lunar', 'next-customer-lose-heart'], text: 'Every ingredient also counts as Lunar for your next brew. -1 heart with the next customer you serve.', pool: 'unlock' },
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
  { id: 'fetch-draught', name: 'Fetch Draught', pattern: ['tide', 'gale', 'umbra'], baseHarmony: 5, family: 'illusion', pool: 'unlock' },
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
  { id: 'bea-thornwick', name: 'Bea Thornwick', blurb: 'The baker, frantic and kind.', prefers: ['warming', 'vigor'], weight: 3, bonusPool: ['no-umbra', 'three-ingredients'] },
  { id: 'old-tobin', name: 'Old Tobin', blurb: 'Retired miner with aches.', prefers: ['healing', 'protection'], weight: 3, bonusPool: ['no-umbra', 'three-ingredients'] },
  { id: 'pip-and-quill', name: 'Pip & Quill', blurb: 'Twin kids, up to mischief.', prefers: ['secrets', 'fortune'], weight: 2, payMult: 0.8, tipMult: 1.5, bonusChance: 0.4, bonusPool: ['wychwood-ingredient', 'three-ingredients'] },
  { id: 'sister-alder', name: 'Sister Alder', blurb: 'Keeper of the shrine.', prefers: ['calming', 'healing'], weight: 3, bonusPool: ['no-umbra', 'wychwood-ingredient'] },
  { id: 'marlowe-vance', name: 'Marlowe Vance', blurb: 'Travelling merchant who haggles.', prefers: ['rare'], weight: 2, payMult: 1.25, bonusPool: ['three-ingredients'] },
  { id: 'the-gardener', name: 'The Gardener', blurb: 'Nobody\'s sure who they are.', prefers: ['lunar'], nightOnly: true, weight: 2, payMult: 1.5, bonusPool: ['wychwood-ingredient'] },
];

// Night customers (GDD §4.1): only on Night Shifts, after the patron's order.
export const nightCustomers: In<typeof NightCustomer>[] = [
  { id: 'wisp-courier', name: 'The Wisp Courier', blurb: 'Carries letters for the not-quite-living.', prefers: ['secrets', 'lunar'], weight: 2, goldMult: 0.5, paysIn: { kind: 'omen' } },
  { id: 'lantern-witch', name: 'The Lantern Witch', blurb: 'Lights the Night Market. Sharp-tongued.', prefers: ['vigor', 'warming'], weight: 2, goldMult: 0.5, paysIn: { kind: 'lunar-card' } },
  { id: 'bog-hag', name: 'Granny Bogwort', blurb: 'Lives in the fen. Surprisingly sweet.', prefers: ['healing'], weight: 2, goldMult: 0.5, paysIn: { kind: 'rare-card' }, requiresUmbra: true },
  { id: 'moth-duchess', name: 'The Moth Duchess', blurb: 'Aristocrat of the lamplight.', prefers: ['illusion', 'fortune'], weight: 2, goldMult: 2.5, paysIn: { kind: 'gold' } },
  { id: 'sleepless-miller', name: 'The Sleepless Miller', blurb: "Hasn't slept in years.", prefers: ['calming'], weight: 2, goldMult: 1, paysIn: { kind: 'lift-curse', noCurseMult: 1.5 } },
];

// Night Shift patrons (GDD §10). Weeks 1 and 3 roll one of the eligible; week 2 is the Pale Courier, week 4 the finale.
export const patrons: In<typeof Patron>[] = [
  { id: 'lamplighter', name: 'The Lamplighter', blurb: 'Keeps the lamps, and your secrets.', weeks: [1, 3], twist: 'hand-hidden', text: 'Your hand is face-down until you hover a card.', orderCount: 3, reward: { kind: 'gold', amount: 6 } },
  { id: 'mother-hollow', name: 'Mother Hollow', blurb: 'Wants a little of everywhere.', weeks: [1, 3], twist: 'origin-chain', text: 'Each brew must use an ingredient from a different Origin than the last.', orderCount: 3, reward: { kind: 'familiar-pick', count: 2 } },
  { id: 'twin-owls', name: 'The Twin Owls', blurb: 'Two of everything, always.', weeks: [1, 3], twist: 'orders-double', text: 'Every order needs two identical potions, and pays double.', orderCount: 2, payMult: 2, reward: { kind: 'card-pick', rarity: 'rare', count: 3 } },
  { id: 'sir-bramble', name: 'Sir Bramble', blurb: 'A knight of the hedgerow. Can\'t abide a hot hearth.', weeks: [1, 3], twist: 'ember-zero', text: 'Ember ingredients have 0 Potency.', orderCount: 3, reward: { kind: 'gold', amount: 6 } },
  { id: 'clockless-man', name: 'The Clockless Man', blurb: 'Always late, never waits.', weeks: [3], twist: 'orders-expire-2', text: 'Orders leave after 2 brews.', orderCount: 3, reward: { kind: 'relic', tier: 1 } },
  { id: 'may-queen', name: 'The May Queen', blurb: 'Crowned in blossom, bored by repeats.', weeks: [1, 3], season: 'spring', twist: 'family-chain', text: 'Each delivery must be a different family from the one before.', orderCount: 3, reward: { kind: 'relic', tier: 1 } },
  { id: 'firefly-conductor', name: 'The Firefly Conductor', blurb: 'Leads the summer lights in time.', weeks: [1, 3], season: 'summer', twist: 'hand-refresh', text: 'After every brew, your hand is discarded and redrawn.', orderCount: 3, reward: { kind: 'familiar-pick', count: 2 } },
  { id: 'tithe-reeve', name: 'The Tithe Reeve', blurb: 'Collects the harvest due.', weeks: [1, 3], season: 'autumn', twist: 'brew-costs-gold-2', text: 'Every brew costs 2 gold. Orders pay ×1.5.', orderCount: 3, payMult: 1.5, reward: { kind: 'gold', amount: 10 } },
  { id: 'frost-warden', name: 'The Frost Warden', blurb: 'Guards the long cold.', weeks: [1, 3], season: 'winter', twist: 'non-frost-minus-2', text: 'Ingredients without the Frost tag have -2 Potency.', orderCount: 3, reward: { kind: 'relic', tier: 2 } },
  { id: 'pale-courier', name: 'The Pale Courier', blurb: 'Comes at the full moon with a sealed request.', weeks: [2], twist: 'pale-courier', text: 'Wants a Masterwork Lunar potion. The other orders pay double.', orderCount: 3, fixedOrder: { family: 'lunar', minTier: 'masterwork' }, reward: { kind: 'relic', tier: 2 } },
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
  { id: 'jackdaw', name: 'Jackdaw', rarity: 'uncommon', text: '+1 Harmony per distinct essence in the brew.' },
  { id: 'moth', name: 'Moth', rarity: 'rare', text: 'Lunar ingredients count as every essence.' },
  { id: 'will-o-wisp', name: 'Will-o\'-Wisp', rarity: 'rare', text: 'First brew each day: ×2 Harmony.' },
  { id: 'old-hound', name: 'Old Hound', rarity: 'rare', text: '×1.5 Harmony on brews of 3 ingredients.', pool: 'unlock' },
  { id: 'hob', name: 'Hob', rarity: 'rare', text: 'The first ingredient\'s Potency counts twice.', pool: 'unlock' },
];

// The Night Market's stalls (GDD §9). The Name-Taker comes with curses and relics (M3 part 5).
export const stalls: In<typeof Stall>[] = [
  { id: 'lantern-seller', name: 'The Lantern Seller', currency: 'Gold', text: 'Lunar ingredients and Omens for your Night Satchel.', opens: 'always' },
  { id: 'fence', name: 'The Fence', currency: 'Potions', text: 'Buys your Shelf at night prices. Pays more for potions with Umbra or Lunar in them.', opens: 'always' },
  { id: 'moth-broker', name: 'The Moth Broker', currency: 'Memories', text: 'Forget a recipe you learned for a Rare card.', opens: 'drawn' },
  { id: 'hollow-tailor', name: 'The Hollow Tailor', currency: 'Cards', text: 'Give up a card. Its essence is sewn into another, with +1 Potency.', opens: 'drawn' },
  { id: 'fortune-tent', name: 'Fortune Tent', currency: 'Gold, a gamble', text: 'Draw a tarot: a boon, or a twist on next week.', opens: 'drawn' },
  { id: 'wandering-tinker', name: 'The Wandering Tinker', currency: 'Gold', text: 'Here only at the full moon: a cauldron slot and a Shelf slot, cheap.', opens: 'full-moon' },
  { id: 'black-market', name: 'The Black Market', currency: 'Gold or cards', text: 'Here only at the new moon: Rare cards for gold, or for two of yours.', opens: 'new-moon' },
];

// The Fortune Tent's tarot deck (GDD §9). Wheel of Fortune (the Blessed modifier) joins with modifiers in M3 part 5;
// The Chariot and The World pay stand-in gold until familiars and relics do.
export const tarot: In<typeof Tarot>[] = [
  { id: 'the-sun', name: 'The Sun', kind: 'boon', weight: 10, effect: 'gold', amount: 15, text: '+15 gold.' },
  { id: 'the-star', name: 'The Star', kind: 'boon', weight: 10, effect: 'lunar-card', text: 'A random Lunar ingredient for your Night Satchel.' },
  { id: 'the-magician', name: 'The Magician', kind: 'boon', weight: 8, effect: 'learn-recipe', text: 'Learn a random recipe you don\'t know.' },
  { id: 'the-lovers', name: 'The Lovers', kind: 'boon', weight: 8, effect: 'hearts', amount: 2, text: '+2 hearts with a random regular.' },
  { id: 'the-chariot', name: 'The Chariot', kind: 'boon', weight: 6, effect: 'familiar', amount: 10, text: 'A random familiar, if you have a free slot. If not, +10 gold.' },
  { id: 'the-world', name: 'The World', kind: 'boon', weight: 3, effect: 'relic-stand-in', amount: 12, text: '+12 gold. (A relic, once they arrive.)' },
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
];
