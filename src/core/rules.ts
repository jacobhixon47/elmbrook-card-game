import type { Season } from './calendar';

// Tuning numbers for the rules engine, in one place so the sim can compare values (GDD §3, §6, §8).

export const WEEKS = 4;
export const START_GOLD = 10;
export const BREWS_PER_DAY = 4;
export const DISCARDS_PER_DAY = 3;
/** Most cards one Discard can throw away. */
export const MAX_DISCARD = 5;
export const CAULDRON_SLOTS = 2;
export const MAX_CAULDRON_SLOTS = 3;
export const SHELF_SLOTS = 4;
export const MAX_SHELF_SLOTS = 6;
/** The Hearth won't burn a deck below this. */
export const MIN_DECK = 8;
/** Rent after each week's Night Shift, before the season multiplier (GDD §3). */
export const RENT = [20, 45, 90, 160] as const;
export const SKIP_GOLD = 2;
export const MAX_HEARTS = 10;

export type Tier = 'crude' | 'fine' | 'superb' | 'masterwork' | 'legendary';
export const TIERS: readonly Tier[] = ['crude', 'fine', 'superb', 'masterwork', 'legendary'];
/** Lowest quality for each tier (GDD §6.4). */
export const TIER_MIN: Record<Tier, number> = { crude: 0, fine: 10, superb: 30, masterwork: 100, legendary: 300 };
export const TIER_PAY: Record<Tier, number> = { crude: 0.5, fine: 1, superb: 1.5, masterwork: 2, legendary: 3 };

export function tierOf(quality: number): Tier {
  for (let i = TIERS.length - 1; i > 0; i--) {
    const t = TIERS[i]!;
    if (quality >= TIER_MIN[t]) return t;
  }
  return 'crude';
}

export function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export function tierStep(tier: Tier, delta: number): Tier {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex(tier) + delta))]!;
}

// Orders (GDD §4)

/** Base pay for an order by its minimum tier, before week, night and season scaling. */
export const ORDER_PAY: Record<Tier, number> = { crude: 1, fine: 3, superb: 6, masterwork: 10, legendary: 16 };
export const BONUS_TIP = 2;
export const NIGHT_PAY = 1.5;
export const WEEK_PAY_STEP = 0.15;

/** How many orders a day posts: 1-2 in week 1, 2 in weeks 2-3, 3 in week 4; a Night Shift adds one. */
export function orderCount(week: number, nightShift: boolean, roll: number): number {
  const base = week <= 1 ? (roll < 0.5 ? 1 : 2) : week >= WEEKS ? 3 : 2;
  return base + (nightShift ? 1 : 0);
}

/** Weighted minimum tiers by week. Orders never ask for more than your deck can reach (see orders.ts). */
export const ORDER_TIERS: Record<number, [Tier, number][]> = {
  1: [['fine', 1]],
  2: [['fine', 0.6], ['superb', 0.4]],
  3: [['fine', 0.2], ['superb', 0.6], ['masterwork', 0.2]],
  4: [['superb', 0.5], ['masterwork', 0.5]],
};

/** The Fence pays this for Shelf potions at the Night Market (GDD §9), more for Umbra and Lunar. */
export const FENCE_PRICE: Record<Tier, number> = { crude: 1, fine: 2, superb: 3, masterwork: 6, legendary: 10 };
export const FENCE_SHADOW_BONUS = 1.5;

// The rest of the Night Market (GDD §9; numbers from the balance tables, shops.json).

/** Stalls on a quarter-moon night: the Lantern Seller, the Fence and this many drawn ones. */
export const QUARTER_DRAWN_STALLS = 1;
export const LANTERN_STOCK = { lunar: 3, lunarPrice: 7, omens: 2, omenPrice: 6 };
export const BROKER_CARDS = 3;
export const TAILOR_POTENCY = 1;
/** The Fortune Tent's first draw costs this, and each draw in the same night costs `step` more. */
export const FORTUNE_PRICE = { base: 5, step: 3 };
export const TINKER_PRICE = { cauldronSlot: 12, shelfSlot: 4 };
export const BLACK_MARKET = { cards: 3, price: 14, swap: 2 };
/** The Hermit: one order fewer a day, each paying this much more. The Tower: one tier up, this much more pay. */
export const HERMIT_PAY = 1.5;
export const TOWER_PAY = 2;

// Rewards and the Market (GDD §7, §8)

export type ShopRarity = 'common' | 'uncommon' | 'rare';
/** Reward rarity weights; each consecutive skip shifts them toward rare (skip pity). */
export function rarityWeights(skipStreak: number): [ShopRarity, number][] {
  return [
    ['common', Math.max(10, 60 - 15 * skipStreak)],
    ['uncommon', 30 + 10 * skipStreak],
    ['rare', 10 + 5 * skipStreak],
  ];
}
export const CARD_PRICE: Record<ShopRarity, number> = { common: 4, uncommon: 7, rare: 11 };
export const CAULDRON_SLOT_PRICE = 15;
export const SHELF_SLOT_PRICE = 6;
export const MARKET_CARDS = 4;
export const FORAGE_CARDS = 5;
export const FORAGE_PICKS = 2;

// Seasons (GDD §3): each later season is about 15% harder, plus its own twist.

export type SeasonRules = {
  rentMult: number;
  payMult: number;
  /** Extra Brews on ordinary days (summer's long days). */
  dayBrews: number;
  /** Extra Discards on Night Shifts (summer's short nights are -1). */
  nightDiscards: number;
};

export const SEASON_RULES: Record<Season, SeasonRules> = {
  spring: { rentMult: 1, payMult: 1, dayBrews: 0, nightDiscards: 0 },
  summer: { rentMult: 1.15, payMult: 1.15, dayBrews: 1, nightDiscards: -1 },
  autumn: { rentMult: 1.32, payMult: 1.25, dayBrews: 0, nightDiscards: 0 },
  winter: { rentMult: 1.52, payMult: 1, dayBrews: 0, nightDiscards: 0 },
};

export function rentDue(season: Season, week: number): number {
  const base = RENT[Math.min(RENT.length, Math.max(1, week)) - 1]!;
  return Math.round(base * SEASON_RULES[season].rentMult);
}

// ---------------------------------------------------------------- Calendar effects (GDD §4.2)

/** Rain and Heatwave add Potency by essence or origin. Weather only boosts (balance audit, Oct 8). */
export const RAIN_POTENCY = 2;
/** Rain posts one fewer order, but only when there would be at least this many. */
export const RAIN_MIN_ORDERS = 3;
export const HEATWAVE_EMBER_POTENCY = 2;
/** Bloomtide: potions with a Flower ingredient pay this much more. */
export const BLOOMTIDE_PAY = 2;
/** Harvest Fair: one more order; each wants this many potions and pays this much more. */
export const HARVEST_FAIR = { extraOrders: 1, quantity: 2, payMult: 2.5 };
/** Longest Night: the festival week's Night Shift gets more of everything. */
export const LONGEST_NIGHT = { brews: 2, discards: 1, extraOrders: 2 };

// ---------------------------------------------------------------- Night Shifts (GDD §4.1, §5.4, §10)

/** After the week-1 Night Shift, pick 1 of this many Lunar ingredients for free (balance audit, Oct 8). */
export const FIRST_NIGHT_GIFT = 2;
/** Cards offered by the Lantern Witch's and Granny Bogwort's payments. */
export const LUNAR_GIFT = 2;
export const RARE_GIFT = 3;
/** The Pale Courier: the other orders that night pay this much more. */
export const PALE_COURIER_PAY = 2;
/** Brews before an order leaves on The Clockless Man's night. */
export const CLOCKLESS_BREWS = 2;
export const TITHE_GOLD = 2;
export const FROST_WARDEN_POTENCY = -2;
/**
 * Familiars and relics arrive in M3 part 5. Until then a patron who would give one pays this much
 * gold instead (about a common familiar's price, and a tier-2 relic a little more).
 */
export const STAND_IN_GOLD = { relic: [0, 8, 12, 16] } as const;

// Familiars (GDD §11; balance tables, items.json).

export const FAMILIAR_SLOTS = 4;
export const MAX_FAMILIAR_SLOTS = 5;
export const FAMILIAR_PRICE: Record<ShopRarity, number> = { common: 8, uncommon: 12, rare: 18 };
/** Selling a familiar pays back this share of its price. */
export const FAMILIAR_SELL = 0.5;
/** Familiars in a Market Square's stock. */
export const MARKET_FAMILIARS = 1;
/** The Wandering Tinker's rare familiar costs this share of its price. */
export const TINKER_FAMILIAR = 0.75;
/** The Moth Broker's familiar choice, beside the Rare cards. */
export const BROKER_FAMILIARS = 2;
/**
 * The Moonless Patron's orders you must fill to win the month: all three, as the GDD says (Jacob's call,
 * Oct 8). Until familiars and the Night Market land the sim wins about 5% this way (1 of 3: 25%).
 */
export const FINALE_ORDERS: number = 3;
