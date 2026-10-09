import { allCards, isPatron, reduce, type Action, type GameEvent, type RunState, type Season } from '../core';
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
  /** Times each Tincture was played. */
  tinctures: Record<string, number>;
  /** Rent was paid in week 4 but the Moonless Patron's orders weren't all filled. */
  finaleFailed: boolean;
  /** Patron orders posted and filled, by week. */
  patronPosted: number[];
  patronFilled: number[];
  /** Familiars held when the run ended, in slot order. */
  familiars: string[];
  /** Relics and curses held when the run ended. */
  relics: string[];
  curses: string[];
  /** The modifier on each modified card at the end, one entry per card. */
  modifiers: string[];
  error?: string;
};

export type SimOptions = { strategy: Strategy; season?: Season; witch?: string; unlocks?: readonly string[]; maxActions?: number };

/** Play one full run headlessly. Never throws: a crash is recorded with the action log that caused it. */
export function playRun(seed: string, opts: SimOptions): RunRecord {
  const rec: RunRecord = {
    seed, won: false, lostWeek: null, finished: false, actions: [], quality: [], gold: [],
    offered: [], picked: [], ordersFilled: 0, ordersDeclined: 0, rejected: 0, tinctures: {},
    finaleFailed: false, patronPosted: [], patronFilled: [], familiars: [], relics: [], curses: [], modifiers: [],
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
        case 'tincturePlayed':
          rec.tinctures[e.card] = (rec.tinctures[e.card] ?? 0) + 1;
          break;
        case 'rewardPicked':
          rec.picked.push(e.card);
          break;
        case 'orderFilled':
          rec.ordersFilled++;
          if (isPatron(e.customer)) rec.patronFilled[s.week - 1] = (rec.patronFilled[s.week - 1] ?? 0) + 1;
          break;
        case 'orderPosted':
          if (isPatron(e.order.customer)) rec.patronPosted[s.week - 1] = (rec.patronPosted[s.week - 1] ?? 0) + 1;
          break;
        case 'finaleFailed':
          rec.finaleFailed = true;
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
    const start: Action = { type: 'startRun', seed, witch: opts.witch ?? 'hedge-witch', ...(opts.season ? { season: opts.season } : {}), ...(opts.unlocks ? { unlocks: [...opts.unlocks] } : {}) };
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
    rec.familiars = [...state.familiars];
    rec.relics = [...state.relics];
    rec.curses = [...state.curses];
    rec.modifiers = [...allCards(state), ...state.satchel].flatMap((c) => (c.modifier ? [c.modifier] : []));
  } catch (e) {
    rec.error = e instanceof Error ? (e.stack ?? e.message) : String(e);
  }
  return rec;
}
