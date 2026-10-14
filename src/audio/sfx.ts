import { loadProfile, saveProfile } from '../profile';
import { cuesFor, SOUNDS, type Cue, type SoundId } from './sounds';
import { renderSound } from './synth';
import type { GameEvent } from '../core';

// Plays the sounds in `sounds.ts` through Web Audio, at the volume in the profile's settings. Quiet
// where there is no audio (tests, a blocked context): nothing here may break the game.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<SoundId, AudioBuffer>();
const lastPlayed = new Map<SoundId, number>();
let settings = loadProfile().settings;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
  } catch {
    ctx = null;
  }
  return ctx;
}

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

function buffer(c: AudioContext, id: SoundId): AudioBuffer {
  let b = buffers.get(id);
  if (!b) {
    const samples = renderSound(SOUNDS[id], c.sampleRate);
    b = c.createBuffer(1, Math.max(1, samples.length), c.sampleRate);
    b.copyToChannel(samples, 0);
    buffers.set(id, b);
  }
  return b;
}

/** Browsers start audio suspended until the first click or key; call this from one. */
export function unlockAudio(): void {
  const c = context();
  if (c?.state === 'suspended') void c.resume().catch(() => undefined);
}

/** Plays a sound now, or `at` seconds from now. The same sound twice within 30ms plays once. */
export function play(id: SoundId, opts: { at?: number; pitch?: number; volume?: number } = {}): void {
  if (settings.muted || settings.volume <= 0) return;
  const c = context();
  if (!c || !master || c.state !== 'running') return;
  const when = c.currentTime + (opts.at ?? 0);
  if (when - (lastPlayed.get(id) ?? -1) < 0.03) return;
  lastPlayed.set(id, when);
  try {
    const src = c.createBufferSource();
    src.buffer = buffer(c, id);
    src.playbackRate.value = opts.pitch ?? 1;
    const gain = c.createGain();
    gain.gain.value = opts.volume ?? 1;
    src.connect(gain).connect(master);
    src.start(when);
  } catch {
    // A sound that can't play is skipped.
  }
}

export function playCues(cues: readonly Cue[]): void {
  for (const q of cues) play(q.sound, { ...(q.at !== undefined ? { at: q.at } : {}), ...(q.pitch !== undefined ? { pitch: q.pitch } : {}) });
}

/** The sounds for an action's events (see `cuesFor`). */
export const playEvents = (events: readonly GameEvent[]) => playCues(cuesFor(events));

export const soundSettings = () => settings;

/** Change the volume (0 to 1) or mute, and keep it in the profile. */
export function setSound(change: Partial<typeof settings>): void {
  settings = { ...settings, ...change, volume: Math.min(1, Math.max(0, change.volume ?? settings.volume)) };
  saveProfile({ settings });
  applyVolume();
}
