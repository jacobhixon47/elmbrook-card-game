// Sound as code (docs/art-pipeline.md, "Sound"): every effect is a few voices rendered into samples
// here, the way sprites are grids. Pure and deterministic, so tests can check the samples and no
// audio files ship. `sfx.ts` plays what this renders.

export type Wave = 'sine' | 'triangle' | 'square' | 'saw' | 'noise';

/** One tone: a wave that slides from `freq` to `to` over `dur` seconds, starting `delay` seconds in. */
export type Voice = {
  wave: Wave;
  /** Hz at the start (ignored by noise). */
  freq: number;
  /** Hz at the end; the slide is exponential, so it sounds even. */
  to?: number;
  dur: number;
  delay?: number;
  /** Seconds to fade in; the rest of the voice decays. */
  attack?: number;
  /** 0 to 1. */
  volume?: number;
  /** A square wave's pulse width, 0 to 1 (0.5 is a plain square). */
  duty?: number;
};

export type Sound = readonly Voice[];

/** Notes by name, for tunes. */
export const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, E6: 1318.51, G6: 1567.98,
} as const;

/** How long a sound lasts, in seconds. */
export const soundLength = (sound: Sound) => Math.max(0, ...sound.map((v) => (v.delay ?? 0) + v.dur));

/** Renders a sound to mono samples in -1..1. */
export function renderSound(sound: Sound, rate: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.ceil(soundLength(sound) * rate));
  // A fixed noise seed: the same sound renders the same samples every time.
  let seed = 0x2545f491;
  const noise = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 0xffffffff) * 2 - 1;
  };
  for (const v of sound) {
    const start = Math.round((v.delay ?? 0) * rate);
    const n = Math.round(v.dur * rate);
    const attack = Math.max(1, Math.round((v.attack ?? 0.004) * rate));
    const volume = v.volume ?? 0.5;
    const end = v.to ?? v.freq;
    let phase = 0;
    for (let i = 0; i < n && start + i < out.length; i++) {
      const t = i / n;
      const freq = v.freq * Math.pow(end / v.freq, t);
      phase = (phase + freq / rate) % 1;
      // A quick fade in, then a decay that eases out, so nothing clicks at either end.
      const env = i < attack ? i / attack : Math.pow(1 - (i - attack) / Math.max(1, n - attack), 2);
      out[start + i]! += wave(v.wave, phase, v.duty ?? 0.5, noise) * env * volume;
    }
  }
  // A soft clip keeps stacked voices from crackling.
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i]!);
  return out;
}

function wave(kind: Wave, phase: number, duty: number, noise: () => number): number {
  switch (kind) {
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5);
    case 'square':
      return phase < duty ? 1 : -1;
    case 'saw':
      return phase * 2 - 1;
    case 'noise':
      return noise();
  }
}

/** A short run of notes, one after another. */
export function arpeggio(notes: readonly number[], opts: { step: number; dur: number; wave?: Wave; volume?: number; delay?: number }): Voice[] {
  return notes.map((freq, i) => ({ wave: opts.wave ?? 'triangle', freq, dur: opts.dur, delay: (opts.delay ?? 0) + i * opts.step, volume: opts.volume ?? 0.35 }));
}
