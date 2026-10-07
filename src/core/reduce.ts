import { codex } from '../codex';
import type { Action, GameEvent } from './actions';
import type { Season } from './calendar';
import { seedRng, shuffle } from './rng';
import type { CardInstance, RunState } from './state';

export type ReduceResult = { state: RunState; events: GameEvent[] };

export function newRun(seed: string, witchId: string, season: Season = 'spring'): ReduceResult {
  const witch = codex.witches.get(witchId);
  if (!witch) throw new Error(`unknown witch: ${witchId}`);

  let uid = 1;
  const deck: CardInstance[] = [];
  for (const entry of witch.startingDeck) {
    for (let i = 0; i < entry.count; i++) deck.push({ uid: uid++, card: entry.card });
  }
  const [drawPile, rng] = shuffle(deck, seedRng(seed));

  const state: RunState = {
    version: 1,
    seed,
    rng,
    witch: witch.id,
    season,
    week: 1,
    day: 1,
    phase: 'morning',
    gold: 10,
    handSize: witch.handSize,
    drawPile,
    hand: [],
    discardPile: [],
    knownRecipes: [...witch.knownRecipes],
    nextUid: uid,
  };
  return {
    state,
    events: [
      { type: 'runStarted', seed, witch: witch.id },
      { type: 'deckShuffled', size: drawPile.length },
    ],
  };
}

function drawToHandSize(state: RunState): ReduceResult {
  const events: GameEvent[] = [];
  let { drawPile, discardPile, rng } = state;
  const hand = state.hand.slice();
  while (hand.length < state.handSize) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      [drawPile, rng] = shuffle(discardPile, rng);
      discardPile = [];
      events.push({ type: 'deckShuffled', size: drawPile.length });
    }
    const [top, ...rest] = drawPile;
    if (!top) break;
    drawPile = rest;
    hand.push(top);
    events.push({ type: 'cardDrawn', uid: top.uid, card: top.card });
  }
  return { state: { ...state, drawPile, discardPile, hand, rng }, events };
}

/** The single entry point for game rules. Pure: same input, same output. */
export function reduce(state: RunState | null, action: Action): ReduceResult {
  switch (action.type) {
    case 'startRun':
      return newRun(action.seed, action.witch, action.season);
    case 'drawToHandSize':
      if (!state) throw new Error('no run in progress');
      return drawToHandSize(state);
  }
}
