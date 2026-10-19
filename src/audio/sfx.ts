import { loadProfile, saveProfile } from '../profile';
import { cuesFor, SOUNDS, type Cue, type SoundId } from './sounds';
import { renderSound } from './synth';
import { renderTune, TUNES, type TuneId } from './music';
import type { GameEvent, Season } from '../core';

// Plays the sounds in `sounds.ts` through Web Audio, at the volume in the profile's settings. Quiet
// where there is no audio (tests, a blocked context): nothing here may break the game.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
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
    musicBus = ctx.createGain();
    musicBus.connect(ctx.destination);
    applyVolume();
  } catch {
    ctx = null;
  }
  return ctx;
}

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
  if (musicBus) musicBus.gain.value = settings.muted ? 0 : settings.music;
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
  if (c?.state === 'suspended') void c.resume().then(startWanted, () => undefined);
  else startWanted();
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

// ---------------------------------------------------------------- music

const tuneBuffers = new Map<string, AudioBuffer>();
/** The tune each scene asked for, and the one playing (with its fade). */
let wanted: { id: TuneId; season: Season } | null = null;
let playing: { key: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const FADE = 1.5;

/**
 * Plays a scene's tune on a loop, fading over from whatever was playing. Asking for the tune
 * already playing does nothing, so scenes can call it on every redraw. Before the first click or
 * key it waits, and starts once audio is unlocked.
 */
export function playMusic(id: TuneId, season: Season): void {
  wanted = { id, season };
  startWanted();
}

function startWanted() {
  const c = ctx;
  if (!wanted || !c || !musicBus || c.state !== 'running') return;
  const key = `${wanted.id}-${wanted.season}`;
  if (playing?.key === key) return;
  try {
    let b = tuneBuffers.get(key);
    if (!b) {
      const samples = renderTune(TUNES[wanted.id][wanted.season], wanted.season, c.sampleRate);
      b = c.createBuffer(1, samples.length, c.sampleRate);
      b.copyToChannel(samples, 0);
      tuneBuffers.set(key, b);
    }
    const now = c.currentTime;
    if (playing) {
      const old = playing;
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + FADE);
      old.src.stop(now + FADE + 0.05);
    }
    const src = c.createBufferSource();
    src.buffer = b;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    src.connect(gain).connect(musicBus);
    src.start(now);
    playing = { key, src, gain };
  } catch {
    // No music is better than a broken game.
  }
}

export const soundSettings = () => settings;

/** Change the volumes (0 to 1) or mute, and keep it in the profile. */
export function setSound(change: Partial<typeof settings>): void {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  settings = { ...settings, ...change, volume: clamp(change.volume ?? settings.volume), music: clamp(change.music ?? settings.music) };
  saveProfile({ settings });
  applyVolume();
}
