import type { Season, Weather } from './calendar';
import type { Tier } from './rules';
import type { Essence, StallId } from '../codex/schema';
import type { Errand, GiftSource, Order, Potion } from './state';

export type Action =
  | { type: 'startRun'; seed: string; witch: string; season?: Season; unlocks?: string[] }
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
  /** At the Hearth, instead of burning a card. */
  | { type: 'liftCurse'; curse: string }
  | { type: 'leaveErrand' }
  // After a Night Shift: free picks (the first-night Lunar card, night customers' payments, a patron's reward).
  | { type: 'takeGift'; index: number }
  | { type: 'passGift' }
  // Night Market (a street of stalls), then rent. `buy` also buys from the stall you're at.
  | { type: 'visitStall'; index: number }
  | { type: 'leaveStall' }
  | { type: 'sellPotion'; uid: number }
  | { type: 'forgetRecipe'; recipe: string }
  | { type: 'brokerPick'; index: number }
  | { type: 'weave'; from: number; into: number }
  | { type: 'drawTarot' }
  | { type: 'swapForCard'; index: number; uids: number[] }
  /** The Name-Taker: take this deal's Curse for its relic. */
  | { type: 'takeDeal'; index: number }
  | { type: 'leaveMarket' }
  // Familiars, at any time in a run: sell one for half its price, or move it to another slot.
  | { type: 'sellFamiliar'; index: number }
  | { type: 'moveFamiliar'; from: number; to: number }
  // Dev overlay only.
  | { type: 'debug'; op: 'addGold'; amount: number }
  | { type: 'debug'; op: 'jumpToDay'; week: number; day: number }
  | { type: 'debug'; op: 'giveCard'; card: string }
  | { type: 'debug'; op: 'giveFamiliar'; familiar: string }
  | { type: 'debug'; op: 'giveRelic'; relic: string }
  | { type: 'debug'; op: 'giveCurse'; curse: string }
  /** Grant a patron's reward as if their order were filled. */
  | { type: 'debug'; op: 'patronReward'; patron: string }
  | { type: 'debug'; op: 'learnRecipes'; recipes: string[] }
  | { type: 'debug'; op: 'setWeather'; weather: Weather }
  | { type: 'debug'; op: 'setPatron'; week: number; patron: string };

export type ScoreSource = 'recipe' | 'ingredient' | 'weather' | 'patron' | 'curse' | 'relic' | 'tincture' | 'modifier' | 'familiar' | 'cauldron';

/** Where a gained card came from. */
export type CardSource = 'reward' | 'market' | 'forage' | 'sludge' | 'gift' | 'payment' | 'copy' | 'fortune';

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
  | { type: 'cardInfused'; uid: number; bonus: number }
  | { type: 'drawPileReordered'; uids: number[] }
  | { type: 'potionUpgraded'; uid: number; tier: Tier }
  /** A card left the deck by itself (Cobweb after its days, Fallen Star at week's end). */
  | { type: 'cardExpired'; uid: number; card: string }
  | { type: 'fogLifted' }
  | { type: 'orderProgress'; order: number; potion: number; delivered: number; quantity: number }
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
  | { type: 'cardGained'; card: string; uid: number; source: CardSource }
  /** A free pick waits for after tonight's reward. */
  | { type: 'giftQueued'; source: GiftSource; cards: string[] }
  | { type: 'giftTaken'; source: GiftSource; card: string; uid: number }
  | { type: 'giftPassed'; source: GiftSource }
  /** The customer gave up waiting (The Clockless Man). */
  | { type: 'orderExpired'; order: number; customer: string }
  /** The finale's orders weren't all filled, so the month is lost. */
  | { type: 'finaleFailed'; patron: string }
  | { type: 'upgradeBought'; upgrade: 'cauldron-slot' | 'shelf-slot' }
  | { type: 'cardRemoved'; uid: number; card: string }
  | { type: 'nightMarketOpened'; stalls: StallId[] }
  | { type: 'stallVisited'; stall: StallId }
  | { type: 'familiarGained'; familiar: string }
  | { type: 'familiarSold'; familiar: string; price: number }
  /** A familiar that pays gold or draws a card did so (the Raven, the Ferret). */
  | { type: 'familiarFired'; familiar: string }
  | { type: 'relicGained'; relic: string; source: string }
  /** A relic that acts on its own did so (the Iron Lid caught a Sludge). */
  | { type: 'relicFired'; relic: string }
  | { type: 'curseTaken'; curse: string }
  | { type: 'curseLifted'; curse: string; by: string }
  | { type: 'recipeForgotten'; recipe: string; cards: string[] }
  | { type: 'cardWoven'; from: string; fromUid: number; into: string; intoUid: number; essence: Essence }
  | { type: 'tarotDrawn'; card: string; price: number }
  | { type: 'potionSold'; uid: number; price: number }
  | { type: 'rentPaid'; week: number; amount: number }
  | { type: 'rentFailed'; week: number; amount: number; gold: number }
  | { type: 'runWon' }
  | { type: 'runLost'; week: number }
  /** The action broke a rule; state is unchanged. */
  | { type: 'rejected'; action: Action['type']; reason: string };
