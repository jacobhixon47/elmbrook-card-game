import type { MutationId } from './mutations';
import type { Essence, ModifierId, PotionFamily, StallId } from '../codex/schema';
import type { Calendar, Season } from './calendar';
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
  /** An essence the Hollow Tailor sewed in; it replaces the card's second essence, if any. */
  woven?: Essence;
  /** A card modifier (GDD §5.5): ingredients only, one per card. */
  modifier?: ModifierId;
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
  /** Friendship it adds on delivery beyond the usual point (Heartstone +1); below 0 (Grave Moss, Cursed), the delivery earns none. */
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
  /** Potions it takes; pay comes with the last one. */
  quantity: number;
  delivered: number;
  /** Pay multiplier when the potion has an ingredient with this tag (the May Crown). */
  tagBonus: { tag: string; mult: number } | null;
  /** The potion needs an Umbra ingredient in it (Granny Bogwort). */
  needsUmbra: boolean;
  /** Brews left before the customer gives up and leaves (The Clockless Man); null when they wait all day. */
  expiresIn: number | null;
  /** A regular's favourite order (Friendship level 4): it needs an ingredient with this tag, and earns +1 Friendship. */
  favourite?: { tag: string } | null;
  /** A seasonal visitor's order: the potion needs an ingredient with this tag (Wren Hollis's Flower). */
  needsTag?: string | null;
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
  /** Every ingredient gets this much Potency per Lunar card in the brew (Howl). */
  lunarPotency: number;
  /** Every ingredient also counts as Lunar (Moth Swarm). */
  allLunar: boolean;
  /** Harmony per distinct essence in the brew (Prism). */
  essenceHarmony: number;
};

/** Extras for the next delivery (Charm Sachet). */
export type DeliveryBoost = { /** Friendship added to the next delivery; below 0 it earns none. */ hearts: number; tip: number; payMult: number };

export type Errand = 'market' | 'forage' | 'creek' | 'guild' | 'hearth' | 'event';

export type StockItem =
  | { kind: 'card'; card: string; price: number; sold: boolean }
  | { kind: 'familiar'; familiar: string; price: number; sold: boolean }
  | { kind: 'relic'; relic: string; price: number; sold: boolean }
  | { kind: 'cauldron-slot' | 'shelf-slot'; price: number; sold: boolean };

/** What the player is choosing between right now outside of brewing. */
export type Offer =
  | { kind: 'reward'; cards: string[] }
  | { kind: 'errands'; options: Errand[] }
  /** `off` is Market Day's discount, already in the prices. */
  | { kind: 'market'; stock: StockItem[]; off?: number }
  | { kind: 'forage'; cards: string[]; picksLeft: number }
  /** `removed` once a card is burned or a Curse lifted: the Hearth does one a night. */
  | { kind: 'hearth'; removed: boolean }
  /** `done` once a card is tempered or given a modifier: the Creek Bank does one a visit. */
  | { kind: 'creek'; done: boolean }
  /** Guild Commissions on offer; one taken a visit. */
  | { kind: 'guild'; options: string[]; taken: boolean }
  /** A dusk event: `chose` is the choice made (one per event) and `outcome` what came of it. */
  | { kind: 'event'; event: string; chose: number | null; outcome: string | null }
  | { kind: 'night-market'; stalls: StallState[]; at: number | null }
  /** A seasonal fair after closing on festival day: its stalls and what's left on them (GDD §4.2). */
  | { kind: 'fair'; fair: string; stalls: { id: string; stock: StockItem[] }[] }
  /** The Longest Night vigil: the regulars' gifts (already in the Night Satchel) and the Solstice Fire's blessings. */
  | { kind: 'vigil'; gifts: { regular: string; card: string }[]; blessings: string[]; chose: string | null }
  | Gift
  | Favour;

/** One Night Market stall tonight and what's left of its trade (GDD §9). */
export type StallState =
  | { id: 'lantern-seller' | 'wandering-tinker' | 'black-market'; stock: StockItem[] }
  | { id: 'fence' }
  /** `cards` is the Rare pick after forgetting a recipe; one trade a night. */
  | { id: 'moth-broker'; forgot: string | null; cards: string[]; familiars: string[]; done: boolean }
  | { id: 'hollow-tailor'; done: boolean }
  | { id: 'fortune-tent'; drawn: string[] }
  /** Each deal is a Curse to take for its relic or, instead, its Rare card with the Cursed modifier; one deal a night. */
  | { id: 'name-taker'; deals: NameTakerDeal[]; done: boolean }
  /** Seasonal stalls (GDD §9). `cards` and `familiars` are the picks on offer; `done` once traded. */
  | { id: 'seed-swapper' | 'nectar-trader'; cards: string[]; done: boolean }
  | { id: 'hearth-trader'; cards: string[]; familiars: string[]; done: boolean; burned: boolean; crown: string[]; crowned: boolean }
  | { id: 'blossom-oracle'; done: boolean }
  /** `prizes` are the familiars a winning toss offers; `last` is what the last toss won. */
  | { id: 'firefly-games'; tosses: number; prizes: string[]; last: { won: boolean; card: string | null } | null }
  | { id: 'cider-press'; pressed: number }
  /** `rival` is the farmers' best bid, hidden until you bid; `bid` is yours. */
  | { id: 'harvest-auction'; relic: string | null; rival: number; bid: number | null };

export type NameTakerDeal = { curse: string; relic: string; card: string | null };

export type { StallId };

/** A Guild Commission in progress: how far along, and the week whose Night Shift it's due by. */
export type ActiveCommission = { id: string; progress: number; dueWeek: number; customers: string[] };

/** Why a free pick is on offer at night. */
export type GiftSource = 'first-night' | 'lantern-witch' | 'bog-hag' | 'patron' | 'commission' | 'visitor';

/** A free pick after a Night Shift: the first-night Lunar card, a night customer's payment or a patron's reward. */
/** `cards` are familiar ids when it goes `into` your familiar slots. */
export type Gift = { kind: 'gift'; source: GiftSource; cards: string[]; into: 'deck' | 'satchel' | 'familiar'; /** The visitor who gives it. */ from?: string };

/** A seasonal visitor's favour after closing: Rook burns a card of your choice, the Toymaker tempers one (GDD §4.1). */
export type Favour = { kind: 'favour'; visitor: string; job: 'burn' | 'temper' };

/**
 * The run state's shape version. Bump it whenever a change would break an older save, and add the
 * step from the old version to `RUN_MIGRATIONS` (core/meta.ts) so saved runs carry over.
 */
export const RUN_VERSION = 24;

/** What a run has done so far, for Reputation at its end (GDD §13). */
/** Counts the cottage reads when a run ends: Reputation and Almanac goals (core/meta.ts, core/almanac.ts). */
export type RunStats = {
  ordersFilled: number;
  potionsSold: number;
  rentsPaid: number;
  /** The best tier brewed, as an index into TIERS; -1 before the first brew. */
  bestTier: number;
  /** The most familiars and relics held at once. */
  mostFamiliars: number;
  mostRelics: number;
  cursesTaken: number;
  /** Legendary potions brewed, and Discards spent (Discard actions and brews that cost Discards), for the harder Almanac goals. */
  legendaries: number;
  discardsUsed: number;
  /** Codex ids met this run, for the cottage's Codex: cards drawn, gained or offered, recipes known, familiars, relics and customers. */
  met: string[];
};

/** Plain, JSON-serialisable run state. Fixtures and saves are exactly this shape. */
export type RunState = {
  version: typeof RUN_VERSION;
  seed: string;
  stats: RunStats;
  rng: RngState;
  witch: string;
  season: Season;
  /** The Year this run is in (GDD §13): 1, or higher after looping, with that Year's modifiers. */
  year: number;
  /** The month's weather and sky events, rolled at run start. */
  calendar: Calendar;
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
  /** The Night Satchel (GDD §5.4): Lunar ingredients and Omens, shuffled in only on Night Shifts. Empty while they are. */
  satchel: CardInstance[];
  /** Each week's Night Shift patron, rolled at run start (GDD §10). */
  patrons: string[];
  /** Free picks still to come after tonight's reward. */
  gifts: Gift[];
  /** Seasonal visitors' favours still to come, after the free picks. */
  favours: Favour[];
  /** Card ids in today's last brew (Mother Hollow). */
  lastBrew: string[];
  /** The family of the last potion delivered today (The May Queen). */
  lastFamily: PotionFamily | null;
  hand: CardInstance[];
  discardPile: CardInstance[];
  /** Cards slotted into the cauldron, in slot order. */
  cauldron: CardInstance[];
  knownRecipes: string[];
  orders: Order[];
  shelf: Potion[];
  /** Friendship points earned with each regular this run (GDD §4.1); they bank to the profile when the run ends. */
  friendship: Record<string, number>;
  /** Each regular's Friendship from the profile when the run began. */
  friendshipBase: Record<string, number>;
  pending: Pending;
  /** Applied to the next order filled, then cleared. */
  delivery: DeliveryBoost;
  /** Brews made today, for first-brew effects. */
  brewsToday: number;
  /** Familiars in slot order (GDD §11). They score left to right. */
  familiars: string[];
  familiarSlots: number;
  /** Discards made this run, for the Ferret's every-third. */
  discardCount: number;
  /** Relics held, in the order gained (GDD §9). No slot limit. */
  relics: string[];
  /** Curses taken, oldest first: the Sleepless Miller and the Hearth lift the oldest. */
  curses: string[];
  /** Brews today that made Sludge, for the Iron Lid. */
  sludgeToday: number;
  /** Discards made today, for the Hive Smoker. */
  discardsToday: number;
  /** Potency each Flower ingredient gets today (Garland). */
  flowerPotencyToday: number;
  /** Potency each Ember ingredient gets today (Mulling Spice). */
  emberPotencyToday: number;
  /** Orders filled this week, for the Corn Dolly. */
  weekDeliveries: number;
  /** The Solstice Fire blessing chosen at the Longest Night vigil; it acts on the finale's Night Shift. */
  blessing: string | null;
  /** The cauldron chosen at the cottage (codex `cauldrons`, GDD §12). */
  cauldronKind: string;
  /** Whether the witch's once-a-day quirk has been used today (the Bloom Witch, the Alchemist, the Illusionist). */
  quirkUsed: boolean;
  /** Guild Commissions taken and not yet done or failed (GDD §7). */
  commissions: ActiveCommission[];
  /** Fortune Tent twists on a later week (The Hermit, The Tower, The Moon). */
  fortunes: { week: number; card: string }[];
  /** Unlock-pool content this run may offer (meta-progression, M4). Base-pool content is always on. */
  unlocks: string[];
  /** Fog hides today's orders until the first brew or Discard. */
  fog: boolean;
  offer: Offer | null;
  /** Consecutive reward skips, for skip pity. */
  skipStreak: number;
  /** Half-price buys left at this week's Night Market (the Firefly Keeper); gone when the rent is paid. */
  halfPrice: number;
  /** Brews and Discards added to (or taken from) the next day's, by dusk events (Bea's bun, the Pixie Thief). */
  tomorrow: { brews: number; discards: number };
  /** The next dusk reward is skipped (A Fae Bargain). */
  forfeitReward: boolean;
  /** The next brew has no preview (Pip & Quill's Dare). The rules don't change; the cauldron panel hides it. */
  blindBrew: boolean;
  /** Every patron of the month is known, whatever the Year (An Old Cookbook). */
  patronsRead: boolean;
  /** Endless (GDD §13): 0 until the run goes on past its finale, then the month of Endless it's in (1, 2, ...). */
  endless: number;
  /** The Year's mutation (GDD §13), if one is on: a challenge twist for every run that Year. */
  mutation: MutationId | null;
  nextUid: number;
  /** Why a lost run ended: the rent, or the Moonless Patron left unsatisfied. */
  lostTo?: 'rent' | 'finale';
};

/** Every card the player owns, wherever it is right now. */
export function allCards(state: RunState): CardInstance[] {
  return [...state.drawPile, ...state.hand, ...state.cauldron, ...state.discardPile];
}
