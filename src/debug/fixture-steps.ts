import type { Action, Errand, RunState } from '../core';

/**
 * Fixtures reach a UI state by replaying steps from a seed. Steps name hand positions rather than
 * card uids, so a fixture reads as "slot the first two cards" and survives rule changes.
 */
export type FixtureStep =
  | 'openShop' | 'endDay' | 'skipReward' | 'leaveErrand' | 'leaveMarket' | 'brew' | 'passGift'
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
  | { patron: [number, string] };

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
  const deck = [...state.drawPile, ...state.hand, ...state.discardPile];
  return { type: 'removeCard', uid: deck[step.removeAt]?.uid ?? -1 };
}
