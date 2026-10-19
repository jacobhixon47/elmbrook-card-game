import type { Season } from '../core';
import { renderSound, type Voice, type Wave } from './synth';

// Music as code (M5, Jacob chose code-made loops, Oct 19), the way the sound effects are: each tune
// is a few bars of chords and a melody, written out as notes, and rendered by `synth.ts` into one
// seamless loop. Every place has its own tune for each season (Jacob, Oct 19): spring serene and
// uplifting, summer a warm summer night (a little faster, no drums), autumn calm, winter major and
// staccato. The Night Shift and the Night Market are in minor keys all year. The season sets the
// instruments and the touch; each tune sets its key, tempo, meter and accompaniment. Pure and deterministic, so tests can check the loops.

export type TuneId = 'title' | 'shop' | 'night' | 'market' | 'cottage';

/**
 * How the accompaniment moves under the melody:
 * - `pad`: the chord held through the bar, over a held root.
 * - `harp`: the chord rippling upward in eighths.
 * - `sway`: the chord picked slowly in quarters over a held root, like a guitar on a porch.
 * - `waltz`: the root on one, the chord on two and three (3/4).
 * - `walk`: a walking bass in quarters under a soft chord.
 * - `pluck`: a short ostinato in eighths.
 * - `box`: a music box: a few high chord notes over a low root.
 */
export type Feel = 'pad' | 'harp' | 'sway' | 'waltz' | 'walk' | 'pluck' | 'box';

export type Tune = {
  bpm: number;
  /** Beats a bar: 4, or 3 for a waltz. */
  meter: 3 | 4;
  /** One chord a bar: a root, then `m` for minor (`Bb`, `F#m`, `E`). */
  chords: readonly string[];
  /**
   * The melody, an eighth note a token: a note (`E5`, `F#4`, `Bb5`) starts, `-` holds the last one,
   * `.` rests. Bars may be split with `|` for reading.
   */
  melody: string;
  feel: Feel;
};

export const TUNES: Record<TuneId, Record<Season, Tune>> = {
  title: {
    // D major, long rising notes over a harp.
    spring: {
      bpm: 76, meter: 4, feel: 'harp', chords: ['D', 'G', 'Bm', 'A', 'D', 'G', 'A', 'D'],
      melody: `F#5 - - - A5 - - - | B5 - - - D6 - B5 - | A5 - - - F#5 - D5 - | E5 - - - - - - -
               F#5 - A5 - D6 - - - | E6 - D6 - B5 - G5 - | A5 - - - C#6 - E6 - | D6 - - - - - - -`,
    },
    // A major, a warm evening, the windows open.
    summer: {
      bpm: 88, meter: 4, feel: 'sway', chords: ['A', 'F#m', 'D', 'E', 'A', 'C#m', 'D', 'E'],
      melody: `C#5 - - - E5 - A5 - | A5 - - - G#5 - F#5 - | F#5 - - - D5 - F#5 - | E5 - - - - - B4 -
               C#5 - E5 - A5 - - - | G#5 - - - E5 - C#5 - | D5 - F#5 - A5 - B5 - | B5 - - - G#5 - E5 -`,
    },
    // F major, an easy walk home.
    autumn: {
      bpm: 68, meter: 4, feel: 'walk', chords: ['F', 'Am', 'Bb', 'F', 'Dm', 'Bb', 'C', 'F'],
      melody: `A4 - - - C5 - F5 - | E5 - - - C5 - - - | D5 - F5 - Bb5 - A5 - | A5 - - - - - . .
               F5 - - - D5 - A4 - | Bb4 - D5 - F5 - - - | E5 - G5 - C5 - E5 - | F5 - - - - - . .`,
    },
    // E major, picked out note by note.
    winter: {
      bpm: 96, meter: 4, feel: 'pluck', chords: ['E', 'C#m', 'A', 'B', 'E', 'A', 'F#m', 'B'],
      melody: `E5 . G#5 . B5 . E6 . | C#6 . G#5 . E5 . C#5 . | A5 . C#6 . E6 . A5 . | D#6 . B5 . F#5 . . .
               G#5 G#5 . F#5 E5 . B4 . | C#5 . E5 . A5 . C#6 . | A5 . C#6 . F#6 . C#6 . | B5 . . . F#5 . D#5 .`,
    },
  },
  shop: {
    // G major, stepping lightly.
    spring: {
      bpm: 88, meter: 4, feel: 'harp', chords: ['G', 'C', 'D', 'G', 'Em', 'C', 'D', 'G'],
      melody: `D5 - G5 - A5 - B5 - | C6 - - - B5 - A5 - | A5 - F#5 - D5 - - - | G5 - B5 - D6 - - -
               E6 - D6 - B5 - G5 - | E5 - G5 - C6 - - - | B5 - A5 - F#5 - A5 - | G5 - - - - - . .`,
    },
    // E major, a long golden afternoon at the counter.
    summer: {
      bpm: 96, meter: 4, feel: 'sway', chords: ['E', 'C#m', 'A', 'B', 'E', 'G#m', 'A', 'B'],
      melody: `B4 - E5 - G#5 - - - | G#5 - E5 - C#5 - E5 - | A5 - - - C#6 - B5 - | A5 - - - F#5 - - -
               G#5 - - - B5 - E6 - | D#6 - - - B5 - G#5 - | A5 - C#6 - B5 - A5 - | F#5 - - - D#5 - - -`,
    },
    // Bb major, unhurried, a little swing.
    autumn: {
      bpm: 76, meter: 4, feel: 'walk', chords: ['Bb', 'Gm', 'Eb', 'F', 'Bb', 'Gm', 'Cm', 'F'],
      melody: `D5 - F5 - Bb5 - A5 - | G5 - - - D5 - - - | Eb5 - G5 - Bb5 - G5 - | F5 - - - C5 - - -
               Bb4 - D5 - F5 - Bb5 - | A5 - G5 - D5 - - - | Eb5 - D5 - C5 - Eb5 - | F5 - - - - - . .`,
    },
    // A major, short and crisp, like footsteps in snow.
    winter: {
      bpm: 104, meter: 4, feel: 'pluck', chords: ['A', 'D', 'E', 'A', 'D', 'Bm', 'E', 'E'],
      melody: `A5 . E5 . A5 C#6 B5 A5 | F#5 . A5 . D6 . A5 . | G#5 . B5 . E6 D6 B5 . | C#6 . A5 . E5 . . .
               F#5 . A5 . D6 . A5 F#5 | D5 . F#5 . B5 . F#5 . | E5 . G#5 . B5 . G#5 . | E5 . . . B4 . . .`,
    },
  },
  night: {
    // F minor, wide and still.
    spring: {
      bpm: 70, meter: 4, feel: 'pad', chords: ['Fm', 'C', 'Db', 'Bbm', 'Fm', 'C', 'Bbm', 'C'],
      melody: `C5 - - - - - F5 - | G5 - - - E5 - - - | F5 - - - Ab5 - - - | Db5 - - - - - - -
               C6 - - - Ab5 - - - | G5 - - - E5 - G5 - | F5 - - - Db5 - - - | E5 - - - - - . .`,
    },
    // C minor, fireflies over warm grass.
    summer: {
      bpm: 84, meter: 4, feel: 'harp', chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Eb', 'Fm', 'G'],
      melody: `G5 - - - C6 - - - | C6 - - - Ab5 - Eb5 - | F5 - - - Ab5 - C6 - | B5 - - - - - . .
               Eb6 - - - D6 - C6 - | G5 - - - Bb5 - Eb6 - | C6 - Ab5 - F5 - Ab5 - | G5 - - - B4 - D5 -`,
    },
    // D minor, slow, under the lamps.
    autumn: {
      bpm: 62, meter: 4, feel: 'pad', chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
      melody: `A4 - - - - - D5 - | F5 - - - D5 - - - | C5 - - - F5 - A5 - | G5 - - - - - . .
               F5 - - - E5 - D5 - | D5 - - - Bb4 - - - | G4 - Bb4 - D5 - G5 - | E5 - - - C#5 - - -`,
    },
    // A minor, a music box by the stove.
    winter: {
      bpm: 84, meter: 4, feel: 'box', chords: ['Am', 'F', 'Dm', 'E', 'Am', 'Dm', 'E', 'E'],
      melody: `E5 . . . C5 . . . | A5 . . . F5 . . . | F5 . D5 . A4 . . . | B4 . . . G#4 . . .
               A4 . C5 . E5 . A5 . | F5 . . . D5 . A4 . | G#4 . B4 . E5 . D5 . | B4 . . . . . . .`,
    },
  },
  market: {
    // A minor, a gentle waltz.
    spring: {
      bpm: 96, meter: 3, feel: 'waltz', chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'],
      melody: `E5 - - - A5 - | A5 - - - C6 - | D6 - A5 - F5 - | G#5 - - - - -
               E5 - A5 - C6 - | C6 - A5 - F5 - | F5 - A5 - D6 - | B5 - - - G#5 -`,
    },
    // E minor, a slow dance under the lanterns.
    summer: {
      bpm: 108, meter: 3, feel: 'waltz', chords: ['Em', 'Am', 'B', 'Em', 'C', 'Am', 'B', 'Em'],
      melody: `B4 - E5 - G5 - | A5 - - - E5 - | F#5 - D#5 - B4 - | E5 - - - G5 -
               E5 - G5 - B5 - | C6 - E6 - C6 - | B5 - - - D#5 - | E5 - - - - -`,
    },
    // G minor, a slow waltz.
    autumn: {
      bpm: 84, meter: 3, feel: 'waltz', chords: ['Gm', 'D', 'Eb', 'Cm', 'Gm', 'D', 'Cm', 'D'],
      melody: `D5 - G5 - Bb5 - | A5 - - - F#5 - | G5 - Bb5 - Eb6 - | Eb6 - - - G5 -
               Bb5 - A5 - G5 - | F#5 - A5 - D6 - | Eb6 - C6 - G5 - | A5 - - - . .`,
    },
    // D harmonic minor, a waltz on tiptoe.
    winter: {
      bpm: 108, meter: 3, feel: 'waltz', chords: ['Dm', 'A', 'Dm', 'Gm', 'Dm', 'A', 'Bb', 'A'],
      melody: `D5 . F5 . A5 . | C#5 . E5 . A5 . | F5 . E5 . D5 . | G5 . Bb5 . D6 .
               A5 . F5 . D5 . | E5 . C#5 . A4 . | Bb4 . D5 . F5 . | E5 . . . C#5 .`,
    },
  },
  cottage: {
    // A major, a lullaby.
    spring: {
      bpm: 64, meter: 4, feel: 'box', chords: ['A', 'D', 'E', 'A', 'F#m', 'D', 'E', 'A'],
      melody: `C#6 - - - E5 - - - | F#5 - - - A5 - - - | G#5 - - - B5 - - - | A5 - - - - - - -
               C#6 - - - A5 - F#5 - | D6 - - - A5 - - - | B5 - - - G#5 - E5 - | A5 - - - - - . .`,
    },
    // D major, a summer night on the porch.
    summer: {
      bpm: 80, meter: 4, feel: 'walk', chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'A'],
      melody: `F#5 - - - A5 - D6 - | D6 - - - B5 - F#5 - | G5 - B5 - D6 - B5 - | A5 - - - - - E5 -
               F#5 - A5 - - - F#5 - | C#6 - - - A5 - F#5 - | G5 - - - B5 - A5 - | E5 - - - C#5 - - -`,
    },
    // C major, by the fire.
    autumn: {
      bpm: 60, meter: 4, feel: 'box', chords: ['C', 'Em', 'F', 'C', 'Am', 'F', 'G', 'C'],
      melody: `G5 - - - E5 - - - | B5 - - - G5 - - - | A5 - - - C6 - - - | G5 - - - - - . .
               E5 - - - A5 - - - | F5 - - - C5 - - - | D5 - - - B4 - D5 - | C5 - - - - - . .`,
    },
    // G major, frost on the window.
    winter: {
      bpm: 72, meter: 4, feel: 'box', chords: ['G', 'Em', 'C', 'D', 'G', 'C', 'D', 'D'],
      melody: `D6 . . . B5 . . . | G5 . . . E5 . . . | E5 . C5 . G4 . . . | A4 . . . F#5 . . .
               G5 . B5 . D6 . . . | C6 . B5 . G5 . E5 . | D5 . F#5 . A5 . C6 . | B5 . . . A5 . . .`,
    },
  },
};

type Instrument = { wave: Wave; volume: number; duty?: number; attack?: number };

/** How each season plays: its instruments, how long notes ring (legato), and its swing. */
type Band = { lead: Instrument; bell?: Instrument; accomp: Instrument; bass: Instrument; pad: Instrument; legato: number; swing: number };

export const BANDS: Record<Season, Band> = {
  // Soft and flowing: a breathy lead, notes that run into each other.
  spring: {
    lead: { wave: 'sine', volume: 0.24, attack: 0.06 }, accomp: { wave: 'triangle', volume: 0.07 }, bass: { wave: 'sine', volume: 0.18 },
    pad: { wave: 'sine', volume: 0.05, attack: 0.4 }, legato: 1.4, swing: 0,
  },
  // Warm and smooth like spring, a little faster, with a gentle lilt (Jacob: a summer night, nothing tinny).
  summer: {
    lead: { wave: 'triangle', volume: 0.2, attack: 0.05 }, accomp: { wave: 'sine', volume: 0.08, attack: 0.02 }, bass: { wave: 'sine', volume: 0.2 },
    pad: { wave: 'sine', volume: 0.05, attack: 0.4 }, legato: 1.3, swing: 0.15,
  },
  // Warm and rounded, with a lazy swing.
  autumn: {
    lead: { wave: 'triangle', volume: 0.22, attack: 0.03 }, accomp: { wave: 'triangle', volume: 0.06 }, bass: { wave: 'sine', volume: 0.2 },
    pad: { wave: 'sine', volume: 0.05, attack: 0.3 }, legato: 1.15, swing: 0.3,
  },
  // Glassy and staccato, with a bell over the tune.
  winter: {
    lead: { wave: 'sine', volume: 0.3, attack: 0.005 }, bell: { wave: 'sine', volume: 0.08, attack: 0.002 }, accomp: { wave: 'sine', volume: 0.11, attack: 0.002 },
    bass: { wave: 'triangle', volume: 0.22 }, pad: { wave: 'sine', volume: 0.035, attack: 0.3 }, legato: 0.45, swing: 0,
  },
};

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note's pitch in Hz: `A4` is 440, `C#5`, `Bb3`. */
export function noteFreq(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  const semis = SEMITONE[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12 - 9;
  return 440 * Math.pow(2, semis / 12);
}

/** A chord's root and its third and fifth, as semitones above C. */
function chordTones(chord: string): [number, number, number] {
  const m = /^([A-G])([#b]?)(m?)$/.exec(chord);
  if (!m) throw new Error(`not a chord: ${chord}`);
  const root = (SEMITONE[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return [root, root + (m[3] ? 3 : 4), root + 7];
}

const freqOf = (semisAboveC: number, octave: number) => 440 * Math.pow(2, (semisAboveC + (octave - 4) * 12 - 9) / 12);

/** The melody as notes: when each starts (in eighths) and how many eighths it lasts. */
export function melodyNotes(melody: string): { step: number; len: number; note: string }[] {
  const tokens = melody.split(/\s+/).filter((t) => t && t !== '|');
  const out: { step: number; len: number; note: string }[] = [];
  tokens.forEach((t, i) => {
    if (t === '-') {
      const last = out.at(-1);
      if (last && last.step + last.len === i) last.len++;
    } else if (t !== '.') {
      out.push({ step: i, len: 1, note: t });
    }
  });
  return out;
}

/** Eighths in a bar. */
export const stepsPerBar = (tune: Tune) => tune.meter * 2;

/** Every voice in one pass of the tune, played by the season's band. */
export function tuneVoices(tune: Tune, season: Season): Voice[] {
  const step = 60 / tune.bpm / 2;
  const band = BANDS[season];
  const voices: Voice[] = [];
  // Swing pushes every off-beat eighth late.
  const at = (s: number) => (Math.floor(s) % 2 === 1 ? s + band.swing * 0.5 : s) * step;
  const add = (inst: Instrument, freq: number, start: number, len: number, attack?: number) =>
    voices.push({
      wave: inst.wave, freq, dur: Math.max(0.05, len * step), delay: at(start), volume: inst.volume,
      attack: attack ?? inst.attack ?? 0.01, ...(inst.duty ? { duty: inst.duty } : {}),
    });

  for (const n of melodyNotes(tune.melody)) {
    add(band.lead, noteFreq(n.note), n.step, n.len * band.legato + 0.2);
    if (band.bell) add(band.bell, noteFreq(n.note) * 2, n.step, 2.5);
  }
  const bar = stepsPerBar(tune);
  const short = band.legato < 1 ? 0.6 : 1.4;
  tune.chords.forEach((chord, b) => {
    const [r, t, f] = chordTones(chord);
    const s0 = b * bar;
    switch (tune.feel) {
      case 'pad':
        for (const s of [r, t, f]) add(band.pad, freqOf(s, 4), s0, bar + 0.5);
        add(band.bass, freqOf(r, 2), s0, bar + 0.5, 0.05);
        break;
      case 'harp':
        [r, t, f, r + 12, t + 12, f + 12, r + 24, f + 12].slice(0, bar).forEach((s, i) => add(band.accomp, freqOf(s, 4), s0 + i, 3));
        add(band.bass, freqOf(r, 2), s0, bar / 2 + 0.5, 0.03);
        add(band.bass, freqOf(f, 2), s0 + bar / 2, bar / 2 + 0.5, 0.03);
        break;
      case 'sway':
        [r, f, t + 12, f].slice(0, tune.meter).forEach((s, i) => add(band.accomp, freqOf(s, 4), s0 + i * 2, 3.5));
        add(band.bass, freqOf(r, 2), s0, bar + 0.5, 0.05);
        break;
      case 'waltz':
        add(band.bass, freqOf(r, 2), s0, 2 * short);
        for (const beat of [2, 4]) for (const s of [t, f, r + 12]) add(band.accomp, freqOf(s, 4), s0 + beat, 1.5 * short);
        break;
      case 'walk':
        [r, t, f, t].slice(0, tune.meter).forEach((s, i) => add(band.bass, freqOf(s, 2), s0 + i * 2, 1.9));
        for (const s of [t, f]) add(band.pad, freqOf(s, 4), s0, bar);
        break;
      case 'pluck':
        [r, f, r + 12, f, t + 12, f, r + 12, f].slice(0, bar).forEach((s, i) => add(band.accomp, freqOf(s, 4), s0 + i, 0.6, 0.002));
        add(band.bass, freqOf(r, 2), s0, 1.5);
        add(band.bass, freqOf(r, 2), s0 + bar / 2, 1.5);
        break;
      case 'box':
        [[r + 12, 0], [f, 2], [t + 12, 4], [f, 6]].filter(([, i]) => i! < bar).forEach(([s, i]) => add(band.accomp, freqOf(s!, 5), s0 + i!, 3, 0.002));
        add(band.bass, freqOf(r, 2), s0, bar, 0.08);
        break;
    }
  });
  return voices;
}

/** Seconds in one pass of the tune. */
export const tuneLength = (tune: Tune) => (tune.chords.length * stepsPerBar(tune) * 60) / tune.bpm / 2;

/**
 * One pass of the tune as mono samples that loop without a seam: the notes still ringing at the end
 * fold back over the start.
 */
export function renderTune(tune: Tune, season: Season, rate: number): Float32Array<ArrayBuffer> {
  const n = Math.round(tuneLength(tune) * rate);
  const full = renderSound(tuneVoices(tune, season), rate);
  const out = new Float32Array(n);
  for (let i = 0; i < full.length; i++) out[i % n]! += full[i]!;
  return out;
}
