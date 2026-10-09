import type { ModifierId } from '../codex/schema';
import type { Action, Errand, RunState } from '../core';

/**
 * Fixtures reach a UI state by replaying steps from a seed. Steps name hand positions rather than
 * card uids, so a fixture reads as "slot the first two cards" and survives rule changes.
 */
export type FixtureStep =
  | 'openShop' | 'endDay' | 'skipReward' | 'leaveErrand' | 'leaveMarket' | 'brew' | 'passGift' | 'leaveStall' | 'drawTarot'
  | { slot: number }
  | { pick: number }
  | { errand: Errand }
  | { jump: [number, number] }
  | { gold: number }
  | { removeAt: number }
  | { give: string }
  | { learn: string[] }
  | { gift: number }
  /** Brew what's in the cauldron for the order at this index. */
  | { brewFor: number }
  /** Set a week's Night Shift patron (before jumping to it). */
  | { patron: [number, string] }
  /** Walk up to the Night Market stall at this index. */
  | { visit: number }
  /** Forget a recipe at the Moth Broker. */
  | { forget: string }
  /** Put a familiar in the next free slot. */
  | { familiar: string }
  | { relic: string }
  | { curse: string }
  /** Grant a patron's reward as if their order were filled. */
  | { reward: string }
  /** Give the hand card at this index a modifier. */
  | { modify: [number, ModifierId] };

export function stepAction(state: RunState, step: FixtureStep): Action {
  if (typeof step === 'string') return { type: step === 'skipReward' ? 'skipReward' : step };
  if ('slot' in step) return { type: 'slot', uid: state.hand[step.slot]?.uid ?? -1 };
  if ('pick' in step) return { type: 'pickReward', index: step.pick };
  if ('errand' in step) return { type: 'chooseErrand', errand: step.errand };
  if ('jump' in step) return { type: 'debug', op: 'jumpToDay', week: step.jump[0], day: step.jump[1] };
  if ('gold' in step) return { type: 'debug', op: 'addGold', amount: step.gold };
  if ('learn' in step) return { type: 'debug', op: 'learnRecipes', recipes: step.learn };
  if ('give' in step) return { type: 'debug', op: 'giveCard', card: step.give };
  if ('gift' in step) return { type: 'takeGift', index: step.gift };
  if ('brewFor' in step) return { type: 'brew', deliverTo: state.orders[step.brewFor]?.id ?? -1 };
  if ('patron' in step) return { type: 'debug', op: 'setPatron', week: step.patron[0], patron: step.patron[1] };
  if ('visit' in step) return { type: 'visitStall', index: step.visit };
  if ('reward' in step) return { type: 'debug', op: 'patronReward', patron: step.reward };
  if ('relic' in step) return { type: 'debug', op: 'giveRelic', relic: step.relic };
  if ('curse' in step) return { type: 'debug', op: 'giveCurse', curse: step.curse };
  if ('familiar' in step) return { type: 'debug', op: 'giveFamiliar', familiar: step.familiar };
  if ('modify' in step) return { type: 'debug', op: 'setModifier', uid: state.hand[step.modify[0]]?.uid ?? -1, modifier: step.modify[1] };
  if ('forget' in step) return { type: 'forgetRecipe', recipe: step.forget };
  const deck = [...state.drawPile, ...state.hand, ...state.discardPile];
  return { type: 'removeCard', uid: deck[step.removeAt]?.uid ?? -1 };
}
