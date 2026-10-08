import type { Season } from './calendar';
import type { Tier } from './rules';
import type { Errand, Order, Potion } from './state';

export type Action =
  | { type: 'startRun'; seed: string; witch: string; season?: Season }
  // Afternoon: read the Order Board, then open the shop to draw a hand.
  | { type: 'openShop' }
  // Sunset: brewing.
  | { type: 'slot'; uid: number }
  | { type: 'unslot'; uid: number }
  | { type: 'brew'; deliverTo?: number }
  | { type: 'discard'; uids: number[] }
  | { type: 'playTincture'; uid: number; targets?: number[] }
  | { type: 'deliver'; order: number; potion: number }
  | { type: 'decline'; order: number }
  | { type: 'endDay' }
  // Twilight: reward, then an errand.
  | { type: 'pickReward'; index: number }
  | { type: 'skipReward' }
  | { type: 'chooseErrand'; errand: Errand }
  | { type: 'buy'; index: number }
  | { type: 'forage'; index: number }
  | { type: 'removeCard'; uid: number }
  | { type: 'leaveErrand' }
  // Night Market, then rent.
  | { type: 'sellPotion'; uid: number }
  | { type: 'leaveMarket' }
  // Dev overlay only.
  | { type: 'debug'; op: 'addGold'; amount: number }
  | { type: 'debug'; op: 'jumpToDay'; week: number; day: number };

export type ScoreSource = 'recipe' | 'ingredient' | 'tincture' | 'modifier' | 'familiar' | 'cauldron';

export type GameEvent =
  | { type: 'runStarted'; seed: string; witch: string; season: Season }
  | { type: 'dayStarted'; week: number; day: number; nightShift: boolean }
  | { type: 'orderPosted'; order: Order }
  | { type: 'shopOpened' }
  | { type: 'deckShuffled'; size: number }
  | { type: 'cardDrawn'; uid: number; card: string }
  | { type: 'cardSlotted'; uid: number; slot: number }
  | { type: 'cardUnslotted'; uid: number }
  | { type: 'cardsDiscarded'; uids: number[] }
  | { type: 'tincturePlayed'; uid: number; card: string }
  /** One step of the scoring pipeline (GDD §6.3), with the running totals after it. */
  | { type: 'scoreStep'; source: ScoreSource; id: string; potency: number; harmony: number; note?: string }
  | { type: 'brewed'; potion: Potion; copies: number }
  | { type: 'sludge'; uid: number }
  | { type: 'recipeDiscovered'; recipe: string }
  | { type: 'potionShelved'; uid: number }
  | { type: 'potionSpilled'; uid: number }
  | { type: 'orderFilled'; order: number; customer: string; potion: number; tier: Tier; pay: number; tip: number; bonus: boolean }
  | { type: 'orderDeclined'; order: number; customer: string }
  | { type: 'heartsChanged'; customer: string; hearts: number; delta: number }
  | { type: 'goldChanged'; gold: number; delta: number; reason: string }
  | { type: 'dayEnded'; week: number; day: number }
  | { type: 'rewardOffered'; cards: string[] }
  | { type: 'rewardPicked'; card: string; uid: number }
  | { type: 'rewardSkipped' }
  | { type: 'errandsOffered'; options: Errand[] }
  | { type: 'errandChosen'; errand: Errand }
  | { type: 'cardGained'; card: string; uid: number; source: 'reward' | 'market' | 'forage' | 'sludge' }
  | { type: 'upgradeBought'; upgrade: 'cauldron-slot' | 'shelf-slot' }
  | { type: 'cardRemoved'; uid: number; card: string }
  | { type: 'nightMarketOpened' }
  | { type: 'potionSold'; uid: number; price: number }
  | { type: 'rentPaid'; week: number; amount: number }
  | { type: 'rentFailed'; week: number; amount: number; gold: number }
  | { type: 'runWon' }
  | { type: 'runLost'; week: number }
  /** The action broke a rule; state is unchanged. */
  | { type: 'rejected'; action: Action['type']; reason: string };
