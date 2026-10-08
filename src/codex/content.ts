import type { z } from 'zod';
import type { Ingredient, Junk, Recipe, Regular, Tincture, Witch } from './schema';

// Raw content tables. Validated in ./index.ts and by tests/codex.test.ts.
// Source of truth for numbers: docs/gdd.md §14.

type In<T extends z.ZodTypeAny> = z.input<T>;

export const ingredients: In<typeof Ingredient>[] = [
  { id: 'elmroot', name: 'Elmroot', essences: ['vital'], potency: 4, rarity: 'common', origin: 'garden' },
  { id: 'creekwater', name: 'Creekwater', essences: ['tide'], potency: 3, rarity: 'common', origin: 'creek' },
  { id: 'emberbloom', name: 'Emberbloom', essences: ['ember'], potency: 4, rarity: 'common', origin: 'garden' },
  { id: 'thistledown', name: 'Thistledown', essences: ['gale'], potency: 3, rarity: 'common', origin: 'wychwood', effects: ['on-discard-draw-1'], text: 'When discarded, draw 1.' },
  { id: 'river-clay', name: 'River Clay', essences: ['stone'], potency: 5, rarity: 'common', origin: 'creek' },
  { id: 'nightshade', name: 'Nightshade', essences: ['umbra'], potency: 5, rarity: 'common', origin: 'wychwood' },
  { id: 'honeycomb', name: 'Honeycomb', essences: ['vital', 'ember'], potency: 4, rarity: 'uncommon', origin: 'market' },
  { id: 'mistcap', name: 'Mistcap Mushroom', essences: ['tide', 'umbra'], potency: 5, rarity: 'uncommon', origin: 'wychwood' },
  { id: 'quartz-dust', name: 'Quartz Dust', essences: ['stone', 'gale'], potency: 4, rarity: 'uncommon', origin: 'mine', effects: ['harmony-2-if-3-ingredients'], text: '+2 Harmony if brewed with 3 ingredients.' },
  { id: 'dragon-pepper', name: 'Dragon Pepper', essences: ['ember'], potency: 8, rarity: 'uncommon', origin: 'market', effects: ['costs-1-discard'], text: 'Brewing it costs 1 Discard.' },
  { id: 'willow-bark', name: 'Willow Bark', essences: ['vital', 'tide'], potency: 5, rarity: 'uncommon', origin: 'creek' },
  { id: 'crow-feather', name: 'Crow Feather', essences: ['gale', 'umbra'], potency: 6, rarity: 'rare', origin: 'wychwood', effects: ['harmony-per-umbra-in-hand'], text: '+1 Harmony per Umbra card in hand.' },
  { id: 'amber-sap', name: 'Amber Sap', essences: ['stone', 'vital'], potency: 7, rarity: 'rare', origin: 'wychwood', effects: ['aged'], text: 'Aged.' },
  { id: 'starlit-dew', name: 'Starlit Dew', essences: ['lunar', 'tide'], potency: 9, rarity: 'lunar', origin: 'night', nightOnly: true },
  { id: 'moonmoth-wing', name: 'Moonmoth Wing', essences: ['lunar', 'gale'], potency: 8, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['wild-essence'], text: 'Counts as any essence.' },
  { id: 'grave-moss', name: 'Grave Moss', essences: ['lunar', 'umbra'], potency: 10, rarity: 'lunar', origin: 'night', nightOnly: true, effects: ['lose-heart'], text: '-1 heart with the customer.' },
];

export const tinctures: In<typeof Tincture>[] = [
  { id: 'stir', name: 'Stir', rarity: 'common', effects: ['next-brew-harmony-1'], text: '+1 Harmony on your next brew.' },
  { id: 'forage', name: 'Forage', rarity: 'common', effects: ['draw-2'], text: 'Draw 2.' },
  { id: 'steep', name: 'Steep', rarity: 'uncommon', effects: ['next-brew-potency-x1.5'], text: 'Next brew: Potency x1.5.' },
  { id: 'sift', name: 'Sift', rarity: 'uncommon', effects: ['free-redraw'], text: 'Discard any number, draw that many. Costs no Discard.' },
  { id: 'bottle-spare', name: 'Bottle Spare', rarity: 'rare', effects: ['next-brew-double'], text: 'Your next brew makes 2 potions.' },
];

export const junk: In<typeof Junk>[] = [
  { id: 'sludge', name: 'Sludge', text: 'Does nothing. Remove it at the Hearth.' },
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
  { id: 'philter-of-luck', name: 'Philter of Luck', pattern: ['gale', 'gale', 'vital'], baseHarmony: 4, family: 'fortune' },
  { id: 'greater-restorative', name: 'Greater Restorative', pattern: ['vital', 'vital', 'tide'], baseHarmony: 5, family: 'healing' },
  { id: 'shadowstep-draught', name: 'Shadowstep Draught', pattern: ['umbra', 'umbra', 'gale'], baseHarmony: 5, family: 'secrets' },
  { id: 'moonglass-elixir', name: 'Moonglass Elixir', pattern: ['lunar', 'tide', 'any'], baseHarmony: 8, family: 'lunar' },
];

export const regulars: In<typeof Regular>[] = [
  { id: 'bea-thornwick', name: 'Bea Thornwick', blurb: 'The baker, frantic and kind.', prefers: ['warming', 'vigor'] },
  { id: 'old-tobin', name: 'Old Tobin', blurb: 'Retired miner with aches.', prefers: ['healing', 'protection'] },
  { id: 'pip-and-quill', name: 'Pip & Quill', blurb: 'Twin kids, up to mischief.', prefers: ['secrets', 'fortune'] },
  { id: 'sister-alder', name: 'Sister Alder', blurb: 'Keeper of the shrine.', prefers: ['calming', 'healing'] },
  { id: 'marlowe-vance', name: 'Marlowe Vance', blurb: 'Travelling merchant who haggles.', prefers: ['rare'] },
  { id: 'the-gardener', name: 'The Gardener', blurb: "Nobody's sure who they are.", prefers: ['lunar'], nightOnly: true },
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
