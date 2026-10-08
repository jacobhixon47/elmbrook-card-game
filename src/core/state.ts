import type { PotionFamily } from '../codex/schema';
import type { Season } from './calendar';
import type { RngState } from './rng';
import type { Tier } from './rules';

/** A card instance in a run. `card` is a codex id; `uid` is unique within the run. */
export type CardInstance = {
  uid: number;
  card: string;
  /** Days spent in the deck since last brewed, for Aged cards (+1 Potency each). */
  aged?: number;
  /** Permanent Potency added to this copy (Infuse). */
  bonus?: number;
  /** Days in the deck, for cards that leave by themselves (Cobweb). */
  days?: number;
};

export type Phase = 'morning' | 'brewing' | 'dusk' | 'night-market' | 'game-over' | 'victory';

export type Potion = {
  uid: number;
  recipe: string;
  family: PotionFamily;
  quality: number;
  tier: Tier;
  /** Card ids that went in, for order bonus conditions and the Fence. */
  ingredients: string[];
  experiment: boolean;
  /** Hearts it adds or costs on delivery beyond the usual one (Heartstone +1, Grave Moss -1). */
  heartDelta: number;
};

export type OrderRequest = { kind: 'recipe'; recipe: string } | { kind: 'family'; family: PotionFamily };

export type OrderBonus = 'no-umbra' | 'three-ingredients' | 'wychwood-ingredient';

export type Order = {
  id: number;
  customer: string;
  request: OrderRequest;
  minTier: Tier;
  pay: number;
  bonus: OrderBonus | null;
  status: 'open' | 'filled' | 'declined';
};

/** Effects queued by Tinctures for the next brew. */
export type Pending = {
  harmony: number;
  harmonyMult: number;
  potency: number;
  potencyMult: number;
  copies: number;
  /** The next Experiment brews at its full tier (Grimoire Page). */
  fullExperiment: boolean;
};

/** Extras for the next delivery (Charm Sachet). */
export type DeliveryBoost = { hearts: number; tip: number };

export type Errand = 'market' | 'forage' | 'hearth';

export type StockItem =
  | { kind: 'card'; card: string; price: number; sold: boolean }
  | { kind: 'cauldron-slot' | 'shelf-slot'; price: number; sold: boolean };

/** What the player is choosing between right now outside of brewing. */
export type Offer =
  | { kind: 'reward'; cards: string[] }
  | { kind: 'errands'; options: Errand[] }
  | { kind: 'market'; stock: StockItem[] }
  | { kind: 'forage'; cards: string[]; picksLeft: number }
  | { kind: 'hearth'; removed: boolean }
  | { kind: 'fence' };

/** Plain, JSON-serialisable run state. Fixtures and saves are exactly this shape. */
export type RunState = {
  version: 3;
  seed: string;
  rng: RngState;
  witch: string;
  season: Season;
  week: number; // 1..WEEKS
  day: number; // 1..NIGHT_SHIFT_DAY; the last is the Night Shift
  phase: Phase;
  gold: number;
  handSize: number;
  brewsLeft: number;
  discardsLeft: number;
  cauldronSlots: number;
  shelfSize: number;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  /** Cards slotted into the cauldron, in slot order. */
  cauldron: CardInstance[];
  knownRecipes: string[];
  orders: Order[];
  shelf: Potion[];
  /** Hearts per customer id, 0..MAX_HEARTS. */
  hearts: Record<string, number>;
  pending: Pending;
  /** Applied to the next order filled, then cleared. */
  delivery: DeliveryBoost;
  /** Brews made today, for first-brew effects. */
  brewsToday: number;
  /** Unlock-pool content this run may offer (meta-progression, M4). Base-pool content is always on. */
  unlocks: string[];
  offer: Offer | null;
  /** Consecutive reward skips, for skip pity. */
  skipStreak: number;
  nextUid: number;
};

/** Every card the player owns, wherever it is right now. */
export function allCards(state: RunState): CardInstance[] {
  return [...state.drawPile, ...state.hand, ...state.cauldron, ...state.discardPile];
}
