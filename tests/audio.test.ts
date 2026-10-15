import { describe, expect, it } from 'vitest';
import { cuesFor, SOUNDS, TIER_SOUND, tickPitch, type SoundId } from '../src/audio/sounds';
import { arpeggio, renderSound, soundLength } from '../src/audio/synth';
import { migrateProfile, newProfile, PROFILE_VERSION, type GameEvent } from '../src/core';

const RATE = 22050;

describe('the synth', () => {
  it('renders a voice to the right length, quiet at both ends', () => {
    const s = renderSound([{ wave: 'triangle', freq: 440, dur: 0.1, delay: 0.05 }], RATE);
    expect(s.length).toBe(Math.ceil(0.15 * RATE));
    expect(s[0]).toBe(0); // the delay is silent
    expect(Math.abs(s[s.length - 1]!)).toBeLessThan(0.01);
    expect(Math.max(...s.map(Math.abs))).toBeGreaterThan(0.1);
  });

  it('is deterministic, noise included', () => {
    const noise = [{ wave: 'noise', freq: 0, dur: 0.05 }] as const;
    expect(renderSound(noise, RATE)).toEqual(renderSound(noise, RATE));
  });

  it('lines notes up one after another', () => {
    const notes = arpeggio([440, 550, 660], { step: 0.1, dur: 0.2 });
    expect(notes.map((v) => v.delay)).toEqual([0, 0.1, 0.2]);
    expect(soundLength(notes)).toBeCloseTo(0.4);
  });

  it('renders every sound in range and short', () => {
    for (const [id, sound] of Object.entries(SOUNDS)) {
      const samples = renderSound(sound, RATE);
      expect(samples.length, id).toBeGreaterThan(0);
      expect(soundLength(sound), id).toBeLessThan(1.6);
      expect(samples.every((x) => Number.isFinite(x) && Math.abs(x) <= 1), id).toBe(true);
    }
  });
});

describe('which sounds an action plays', () => {
  const ev = (...types: GameEvent['type'][]) => types.map((type) => ({ type }) as GameEvent);
  const sounds = (events: GameEvent[]) => cuesFor(events).map((c) => c.sound);

  it('one clear sound per action, the most important first', () => {
    expect(sounds(ev('cardSlotted'))).toEqual<SoundId[]>(['slot']);
    expect(sounds(ev('cardUnslotted'))).toEqual<SoundId[]>(['unslot']);
    expect(sounds(ev('cardsDiscarded', 'cardDrawn', 'cardDrawn'))).toEqual<SoundId[]>(['discard', 'draw']);
    expect(sounds(ev('orderFilled', 'friendshipGained'))).toEqual<SoundId[]>(['filled']);
    expect(sounds(ev('rentPaid', 'dayStarted', 'cardDrawn'))).toEqual<SoundId[]>(['rent']);
    expect(sounds(ev('rentFailed', 'runLost'))).toEqual<SoundId[]>(['lose']);
    expect(sounds(ev('runWon'))).toEqual<SoundId[]>(['win']);
    expect(sounds(ev('rejected'))).toEqual<SoundId[]>(['nope']);
    expect(sounds(ev('rewardPicked', 'cardGained'))).toEqual<SoundId[]>(['gain']);
    expect(sounds([{ type: 'goldChanged', gold: 12, delta: 2, reason: 'skip' }])).toEqual<SoundId[]>(['coin']);
    expect(sounds([{ type: 'goldChanged', gold: 8, delta: -2, reason: 'patron' }])).toEqual([]);
    expect(sounds(ev('orderPosted'))).toEqual([]);
  });

  it('every tier has a jingle, and the score climbs in semitones', () => {
    for (const id of Object.values(TIER_SOUND)) expect(SOUNDS[id]).toBeDefined();
    expect(tickPitch(0)).toBe(1);
    expect(tickPitch(12)).toBeCloseTo(2);
    expect(tickPitch(40)).toBeCloseTo(2);
  });
});

describe('sound settings in the profile', () => {
  it('start at 70% and unmuted, and survive a migration from version 5', () => {
    expect(newProfile().settings).toEqual({ volume: 0.7, muted: false });
    const p = migrateProfile({ version: 5, tutorialDone: true, yearSeasons: [['spring']], runs: 3 });
    expect(p).toMatchObject({ version: PROFILE_VERSION, tutorialDone: true, runs: 3, settings: { volume: 0.7, muted: false } });
  });

  it('repair bad values', () => {
    expect(migrateProfile({ version: PROFILE_VERSION, settings: { volume: 4, muted: true } }).settings).toEqual({ volume: 1, muted: true });
    expect(migrateProfile({ version: PROFILE_VERSION, settings: { volume: 'loud', muted: 'yes' } }).settings).toEqual({ volume: 0.7, muted: false });
    expect(migrateProfile({ version: PROFILE_VERSION, settings: null }).settings).toEqual({ volume: 0.7, muted: false });
  });
});
