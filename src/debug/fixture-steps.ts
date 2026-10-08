import type { Action, Errand, RunState } from '../core';

/**
 * Fixtures reach a UI state by replaying steps from a seed. Steps name hand positions rather than
 * card uids, so a fixture reads as "slot the first two cards" and survives rule changes.
 */
export type FixtureStep =
  | 'openShop' | 'endDay' | 'skipReward' | 'leaveErrand' | 'leaveMarket' | 'brew'
  | { slot: number }
  | { pick: number }
  | { errand: Errand }
  | { jump: [number, number] }
  | { gold: number }
  | { removeAt: number }
  | { give: string }
  | { learn: string[] };

export function stepAction(state: RunState, step: FixtureStep): Action {
  if (typeof step === 'string') return { type: step === 'skipReward' ? 'skipReward' : step };
  if ('slot' in step) return { type: 'slot', uid: state.hand[step.slot]?.uid ?? -1 };
  if ('pick' in step) return { type: 'pickReward', index: step.pick };
  if ('errand' in step) return { type: 'chooseErrand', errand: step.errand };
  if ('jump' in step) return { type: 'debug', op: 'jumpToDay', week: step.jump[0], day: step.jump[1] };
  if ('gold' in step) return { type: 'debug', op: 'addGold', amount: step.gold };
  if ('learn' in step) return { type: 'debug', op: 'learnRecipes', recipes: step.learn };
  if ('give' in step) return { type: 'debug', op: 'giveCard', card: step.give };
  const deck = [...state.drawPile, ...state.hand, ...state.discardPile];
  return { type: 'removeCard', uid: deck[step.removeAt]?.uid ?? -1 };
}
