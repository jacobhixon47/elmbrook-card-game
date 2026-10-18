import type { GameEvent, Tier } from '../core';
import { arpeggio, NOTE, type Sound } from './synth';

// Every sound effect in the game, as voices (GDD §2: cozy surface, so soft waves and short tails),
// and which ones an action's events play. Pure: `sfx.ts` plays them.

export const SOUNDS = {
  /** A UI button. */
  click: [{ wave: 'triangle', freq: 900, to: 700, dur: 0.035, volume: 0.25 }],
  /** A card into the cauldron: a little pop. */
  slot: [
    { wave: 'sine', freq: 420, to: 760, dur: 0.07, volume: 0.45 },
    { wave: 'noise', freq: 0, dur: 0.02, volume: 0.08 },
  ],
  /** A card back to the hand. */
  unslot: [{ wave: 'sine', freq: 700, to: 380, dur: 0.07, volume: 0.4 }],
  /** Cards drawn: a soft flick. */
  draw: [
    { wave: 'noise', freq: 0, dur: 0.035, volume: 0.07 },
    { wave: 'triangle', freq: 1400, to: 1100, dur: 0.025, volume: 0.12 },
  ],
  /** Cards thrown away: a short whoosh. */
  discard: [{ wave: 'noise', freq: 0, dur: 0.16, attack: 0.06, volume: 0.12 }],
  /** A Tincture played: a shimmer. */
  tincture: arpeggio([NOTE.E5, NOTE.A5, NOTE.E6], { step: 0.04, dur: 0.12, wave: 'sine', volume: 0.25 }),
  /** One scoring step; played at a rising pitch as the numbers climb. */
  tick: [
    { wave: 'triangle', freq: NOTE.C5, dur: 0.08, volume: 0.35 },
    { wave: 'sine', freq: NOTE.C6, dur: 0.05, volume: 0.12 },
  ],
  /** Ingredients into the cauldron: a few bubbles. */
  bubble: [
    { wave: 'sine', freq: 260, to: 520, dur: 0.06, volume: 0.3 },
    { wave: 'sine', freq: 340, to: 640, dur: 0.05, delay: 0.07, volume: 0.22 },
    { wave: 'sine', freq: 300, to: 600, dur: 0.05, delay: 0.13, volume: 0.18 },
  ],
  /** No recipe: a sad burp. */
  sludge: [
    { wave: 'saw', freq: 170, to: 70, dur: 0.32, volume: 0.22 },
    { wave: 'noise', freq: 0, dur: 0.2, delay: 0.05, volume: 0.06 },
  ],
  crude: arpeggio([NOTE.E4, NOTE.C4], { step: 0.09, dur: 0.14, volume: 0.3 }),
  fine: arpeggio([NOTE.C5, NOTE.E5], { step: 0.08, dur: 0.16 }),
  superb: arpeggio([NOTE.C5, NOTE.E5, NOTE.G5], { step: 0.07, dur: 0.18 }),
  masterwork: arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], { step: 0.07, dur: 0.22 }),
  legendary: [
    ...arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6], { step: 0.07, dur: 0.26 }),
    ...arpeggio([NOTE.G6, NOTE.E6, NOTE.G6], { step: 0.05, dur: 0.1, wave: 'sine', volume: 0.15, delay: 0.38 }),
  ],
  /** A new recipe in the Grimoire. */
  discover: arpeggio([NOTE.G5, NOTE.C6, NOTE.E6], { step: 0.06, dur: 0.2, wave: 'sine', volume: 0.25, delay: 0.1 }),
  /** Gold in: the classic two-note coin. */
  coin: [
    { wave: 'square', freq: NOTE.B5, dur: 0.06, volume: 0.12, duty: 0.25 },
    { wave: 'square', freq: NOTE.E6, dur: 0.2, delay: 0.06, volume: 0.12, duty: 0.25 },
  ],
  /** An order filled: a coin with a happy note under it. */
  filled: [
    { wave: 'triangle', freq: NOTE.G4, dur: 0.18, volume: 0.25 },
    { wave: 'square', freq: NOTE.B5, dur: 0.06, delay: 0.05, volume: 0.12, duty: 0.25 },
    { wave: 'square', freq: NOTE.E6, dur: 0.22, delay: 0.11, volume: 0.12, duty: 0.25 },
  ],
  /** Rent paid: coins counted out, low. */
  rent: arpeggio([NOTE.G5, NOTE.E5, NOTE.C5], { step: 0.07, dur: 0.12, wave: 'square', volume: 0.1 }),
  /** A card, familiar or relic gained. */
  gain: arpeggio([NOTE.C5, NOTE.G5, NOTE.C6], { step: 0.05, dur: 0.14, wave: 'sine', volume: 0.3 }),
  /** Something you can't do. */
  nope: [
    { wave: 'triangle', freq: 220, dur: 0.07, volume: 0.3 },
    { wave: 'triangle', freq: 196, dur: 0.09, delay: 0.09, volume: 0.3 },
  ],
  /** A level of Friendship with a regular: a warm chime. */
  levelUp: arpeggio([NOTE.E5, NOTE.A5, NOTE.C6, NOTE.E6], { step: 0.09, dur: 0.3, wave: 'sine', volume: 0.28, delay: 0.25 }),
  /** A Curse taken. */
  curse: [{ wave: 'saw', freq: 220, to: 150, dur: 0.35, volume: 0.14 }, { wave: 'sine', freq: 233, to: 155, dur: 0.35, volume: 0.2 }],
  /** A footstep in the cottage: a soft tap on the boards (quieter on the rug). */
  step: [
    { wave: 'noise', freq: 0, dur: 0.04, volume: 0.05 },
    { wave: 'triangle', freq: 150, to: 95, dur: 0.05, volume: 0.14 },
  ],
  /** The hearth crackling, now and then. */
  crackle: [
    { wave: 'noise', freq: 0, dur: 0.02, volume: 0.06 },
    { wave: 'noise', freq: 0, dur: 0.015, delay: 0.07, volume: 0.04 },
  ],
  /** Coming up to something you can use. */
  near: [{ wave: 'sine', freq: NOTE.A5, to: NOTE.E6, dur: 0.07, volume: 0.1 }],
  /** The month won. */
  win: [
    ...arpeggio([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], { step: 0.12, dur: 0.3, volume: 0.35 }),
    { wave: 'triangle', freq: NOTE.C4, dur: 0.9, delay: 0.48, volume: 0.25 },
    { wave: 'triangle', freq: NOTE.E5, dur: 0.9, delay: 0.48, volume: 0.2 },
    { wave: 'triangle', freq: NOTE.G5, dur: 0.9, delay: 0.48, volume: 0.2 },
  ],
  /** The run lost. */
  lose: arpeggio([NOTE.G4, NOTE.E4, NOTE.D4, NOTE.C4], { step: 0.2, dur: 0.4, volume: 0.3 }),
} satisfies Record<string, Sound>;

export type SoundId = keyof typeof SOUNDS;

export const TIER_SOUND: Record<Tier, SoundId> = { crude: 'crude', fine: 'fine', superb: 'superb', masterwork: 'masterwork', legendary: 'legendary' };

/** A sound to play: which, how far in (seconds), and its pitch (1 is as written). */
export type Cue = { sound: SoundId; at?: number; pitch?: number };

/** One scoring step's tick, a semitone higher each step so the climb sounds like one. */
export const tickPitch = (step: number) => Math.pow(2, Math.min(step, 12) / 12);

/**
 * The sounds for an action's events, outside the brew (the brewing animation plays its own, in time
 * with the numbers). The first matching rule wins, so one action makes one clear sound.
 */
export function cuesFor(events: readonly GameEvent[]): Cue[] {
  const has = (type: GameEvent['type']) => events.some((e) => e.type === type);
  if (has('rejected')) return [{ sound: 'nope' }];
  if (has('runWon')) return [{ sound: 'win' }];
  if (has('runLost') || has('rentFailed')) return [{ sound: 'lose' }];
  if (has('rentPaid')) return [{ sound: 'rent' }];
  if (has('orderFilled')) return [{ sound: 'filled' }];
  if (has('curseTaken')) return [{ sound: 'curse' }];
  if (has('relicGained') || has('familiarGained') || has('cardGained') || has('rewardPicked')) return [{ sound: 'gain' }];
  if (has('potionSold') || events.some((e) => e.type === 'goldChanged' && e.delta > 0)) return [{ sound: 'coin' }];
  if (has('tincturePlayed')) return [{ sound: 'tincture' }];
  if (has('cardsDiscarded')) return [{ sound: 'discard' }, { sound: 'draw', at: 0.12 }];
  if (has('cardSlotted')) return [{ sound: 'slot' }];
  if (has('cardUnslotted')) return [{ sound: 'unslot' }];
  if (has('cardDrawn')) return [{ sound: 'draw' }];
  return [];
}
