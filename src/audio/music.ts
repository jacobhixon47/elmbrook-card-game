import type { Season } from '../core';
import { renderSound, type Voice, type Wave } from './synth';

// Music as code (M5, Jacob chose code-made loops, Oct 19), the way the sound effects are: each tune
// is a few bars of chords and a melody, written out as notes, and rendered by `synth.ts` into one
// seamless loop. The season changes the instruments, not the tune, so a place always sounds like
// itself. Pure and deterministic, so tests can check the loops.

export type TuneId = 'title' | 'shop' | 'night' | 'market' | 'cottage';

export type Tune = {
  bpm: number;
  /** One chord a bar: a root, then `m` for minor (`Bb`, `F#m`, `E`). */
  chords: readonly string[];
  /**
   * The melody, an eighth note a token: a note (`E5`, `F#4`, `Bb5`) starts, `-` holds the last one,
   * `.` rests. Bars may be split with `|` for reading.
   */
  melody: string;
};

export const TUNES: Record<TuneId, Tune> = {
  // The title screen: G major, unhurried, rising like a door opening.
  title: {
    bpm: 84,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'],
    melody: `B4 - D5 - G5 - - - | G5 - F#5 - E5 - B4 - | C5 - E5 - G5 - E5 - | F#5 - - - A5 - - -
             B5 - A5 - G5 - D5 - | E5 - G5 - B5 - - - | A5 - G5 - E5 - C5 - | D5 - - - F#5 - - -`,
  },
  // The shop by day: C major, a little bustle.
  shop: {
    bpm: 96,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
    melody: `E5 - G5 - C6 - B5 A5 | G5 - E5 - - - . . | F5 - A5 - C6 - A5 F5 | G5 - - - D5 - . .
             E5 G5 C6 - B5 - G5 - | A5 - G5 E5 - - C5 D5 | F5 - E5 - D5 - A4 - | B4 - D5 - G5 - - -`,
  },
  // The Night Shift: A minor, slower, the lamps lit.
  night: {
    bpm: 76,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'E'],
    melody: `A4 - - - C5 - E5 - | F5 - - - E5 - C5 - | E5 - - - G5 - E5 - | D5 - - - - - . .
             C5 - B4 - A4 - E5 - | F5 - E5 - D5 - C5 - | B4 - - - G#4 - B4 - | E5 - - - - - . .`,
  },
  // The Night Market: D minor and a skip in its step.
  market: {
    bpm: 104,
    chords: ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A'],
    melody: `D5 F5 A5 F5 D5 - A4 - | E5 G5 C6 G5 E5 - C5 - | D5 F5 Bb5 - A5 G5 F5 - | E5 - C#5 - A4 - . .
             A5 - F5 - D5 F5 A5 - | G5 - E5 - C5 E5 G5 - | F5 E5 D5 - Bb4 - D5 - | C#5 - E5 - A5 - - -`,
  },
  // The cottage: F major, a music box by the fire.
  cottage: {
    bpm: 66,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'],
    melody: `A5 - C6 - F5 - - - | D5 - F5 - A5 - - - | D6 - C6 - Bb5 - A5 - | G5 - - - - - . .
             A5 - G5 - F5 - C5 - | E5 - A5 - C6 - - - | Bb5 - A5 - G5 - D5 - | E5 - - - G5 - - -`,
  },
};

/** How each season plays a tune: the melody's voice, the arpeggio's, the bass's, and a bell an octave up in winter. */
type Band = { lead: Instrument; arp: Instrument; bass: Instrument; bell?: Instrument };
type Instrument = { wave: Wave; volume: number; duty?: number };

export const BANDS: Record<Season, Band> = {
  spring: { lead: { wave: 'triangle', volume: 0.24 }, arp: { wave: 'sine', volume: 0.1 }, bass: { wave: 'triangle', volume: 0.16 } },
  summer: { lead: { wave: 'square', volume: 0.09, duty: 0.25 }, arp: { wave: 'triangle', volume: 0.09 }, bass: { wave: 'triangle', volume: 0.17 } },
  autumn: { lead: { wave: 'triangle', volume: 0.24 }, arp: { wave: 'square', volume: 0.04, duty: 0.125 }, bass: { wave: 'sine', volume: 0.2 } },
  winter: { lead: { wave: 'sine', volume: 0.24 }, arp: { wave: 'sine', volume: 0.09 }, bass: { wave: 'sine', volume: 0.18 }, bell: { wave: 'sine', volume: 0.05 } },
};

const STEPS_PER_BAR = 8;
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

/** The melody as notes: when each starts (in steps) and how many steps it lasts. */
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

/** Every voice in one pass of the tune, for the season's band. */
export function tuneVoices(tune: Tune, season: Season): Voice[] {
  const step = 60 / tune.bpm / 2;
  const band = BANDS[season];
  const voices: Voice[] = [];
  const add = (inst: Instrument, freq: number, at: number, len: number, attack = 0.01) =>
    voices.push({ wave: inst.wave, freq, dur: len * step, delay: at * step, volume: inst.volume, attack, ...(inst.duty ? { duty: inst.duty } : {}) });
  for (const n of melodyNotes(tune.melody)) {
    add(band.lead, noteFreq(n.note), n.step, n.len + 0.6);
    if (band.bell) add(band.bell, noteFreq(n.note) * 2, n.step, n.len + 1.5, 0.004);
  }
  tune.chords.forEach((chord, bar) => {
    const [root, third, fifth] = chordTones(chord);
    const at = bar * STEPS_PER_BAR;
    // The bass: the root on the first beat, the fifth on the third.
    add(band.bass, freqOf(root, 2), at, 4.2, 0.02);
    add(band.bass, freqOf(fifth, 2), at + 4, 4.2, 0.02);
    // An arpeggio of the chord in eighths, rocking up and back.
    [root, third, fifth, third + 12, fifth, third, root + 12, fifth].forEach((s, i) => add(band.arp, freqOf(s, 4), at + i, 1.6, 0.01));
  });
  return voices;
}

/** Seconds in one pass of the tune. */
export const tuneLength = (tune: Tune) => (tune.chords.length * STEPS_PER_BAR * 60) / tune.bpm / 2;

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
