import type { FixtureStep } from './fixture-steps';

// Dev URL params: ?fixture=<name> ?seed=<s> ?noanim=1 ?renderer=canvas

export type Fixture = {
  scene: string;
  seed?: string;
  state?: unknown;
  season?: string;
  time?: string;
  weather?: string;
  /** Today's weather for the rules (the Calendar's roll), set before `steps` run. `weather` only changes the window. */
  today?: string;
  /** Open the dev overlay (backtick) at start. */
  overlay?: boolean;
  /** Steps replayed after the run starts, to reach a UI state (see fixture-steps.ts). */
  steps?: FixtureStep[];
  /** Run scene UI state: an open order dialogue, or hand positions picked for a Discard. */
  ui?: { dialog?: number; discard?: number[]; grimoire?: 'recipes' | 'deck' | 'calendar' | 'guide'; inspect?: number; tutorial?: string;
    /** A targeting Tincture at this hand index waiting for its targets; `picked` are hand indexes (draw pile indexes for Taste Test). */
    target?: { hand: number; picked?: number[] };
    /** At a Night Market stall: deck cards picked (positions in the sorted deck it shows), and the Black Market stock being traded for. */
    stall?: { picked?: number[]; swap?: number };
    /** The card of the familiar in this slot, open. */
    familiar?: number };
};

const fixtures = import.meta.glob<Fixture>('/fixtures/*.json', { eager: true, import: 'default' });

export const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const noAnim = params.get('noanim') === '1';

export function loadFixture(): (Fixture & { name: string }) | null {
  const name = params.get('fixture');
  if (!name) return null;
  const fixture = fixtures[`/fixtures/${name}.json`];
  if (!fixture) {
    console.error(`[elmbrook] unknown fixture "${name}". Known: ${Object.keys(fixtures).join(', ')}`);
    return null;
  }
  return { ...fixture, name };
}
