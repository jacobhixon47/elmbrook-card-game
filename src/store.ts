import { reduce, type Action, type GameEvent, type RunState } from './core';

type Listener = (state: RunState | null, events: GameEvent[]) => void;

/** The one mutable holder of game state. Scenes dispatch here; rules live in core. */
export class Store {
  private state: RunState | null = null;
  private listeners = new Set<Listener>();
  readonly log: Action[] = [];

  getState(): RunState | null {
    return this.state;
  }

  load(state: RunState): void {
    this.state = state;
    this.listeners.forEach((l) => l(this.state, []));
  }

  dispatch(action: Action): GameEvent[] {
    const result = reduce(this.state, action);
    this.state = result.state;
    this.log.push(action);
    this.listeners.forEach((l) => l(this.state, result.events));
    return result.events;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const store = new Store();
