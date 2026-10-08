import { reduce, type Action, type GameEvent, type RunState, type Season } from '../core';
import { seedRng } from '../core/rng';
import { greedyAction, isOver, randomAction, type Strategy } from './bot';

export type RunRecord = {
  seed: string;
  won: boolean;
  /** Week the rent failed in, or null on a win or an unfinished run. */
  lostWeek: number | null;
  finished: boolean;
  actions: Action[];
  /** Quality of every potion brewed, by week. */
  quality: number[][];
  /** Gold at the start of each day: [week][day]. */
  gold: number[][];
  offered: string[];
  picked: string[];
  ordersFilled: number;
  ordersDeclined: number;
  rejected: number;
  error?: string;
};

export type SimOptions = { strategy: Strategy; season?: Season; witch?: string; maxActions?: number };

/** Play one full run headlessly. Never throws: a crash is recorded with the action log that caused it. */
export function playRun(seed: string, opts: SimOptions): RunRecord {
  const rec: RunRecord = {
    seed, won: false, lostWeek: null, finished: false, actions: [], quality: [], gold: [],
    offered: [], picked: [], ordersFilled: 0, ordersDeclined: 0, rejected: 0,
  };
  const max = opts.maxActions ?? (opts.strategy === 'random' ? 20000 : 5000);
  let rng = seedRng(`bot:${seed}`);

  const observe = (s: RunState, events: GameEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case 'dayStarted':
          ((rec.gold[e.week - 1] ??= [])[e.day - 1] = s.gold);
          break;
        case 'brewed':
          (rec.quality[s.week - 1] ??= []).push(e.potion.quality);
          break;
        case 'rewardOffered':
          rec.offered.push(...e.cards);
          break;
        case 'rewardPicked':
          rec.picked.push(e.card);
          break;
        case 'orderFilled':
          rec.ordersFilled++;
          break;
        case 'orderDeclined':
          rec.ordersDeclined++;
          break;
        case 'rejected':
          rec.rejected++;
          break;
        case 'runWon':
          rec.won = true;
          break;
        case 'runLost':
          rec.lostWeek = e.week;
          break;
      }
    }
  };

  try {
    const start: Action = { type: 'startRun', seed, witch: opts.witch ?? 'hedge-witch', ...(opts.season ? { season: opts.season } : {}) };
    rec.actions.push(start);
    const first = reduce(null, start);
    let state = first.state;
    observe(state, first.events);
    while (!isOver(state) && rec.actions.length < max) {
      let action: Action;
      if (opts.strategy === 'greedy') action = greedyAction(state);
      else [action, rng] = randomAction(state, rng);
      rec.actions.push(action);
      const r = reduce(state, action);
      // Gold is observed on the state the day started in, so observe after applying.
      state = r.state;
      observe(state, r.events);
    }
    rec.finished = isOver(state);
  } catch (e) {
    rec.error = e instanceof Error ? (e.stack ?? e.message) : String(e);
  }
  return rec;
}
