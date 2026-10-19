import { describe, expect, it } from 'vitest';
import { migrateProfile, newProfile, newRun, PROFILE_VERSION } from '../src/core';
import { COTTAGE_NOTES, noteDue, RUN_NOTES } from '../src/view/notes';

const run = () => newRun('notes-test', 'hedge-witch').state;

describe('first-time notes', () => {
  it('are off the books at the start of a plain run', () => {
    expect(noteDue(RUN_NOTES, run(), [])).toBeNull();
  });

  it('show once something new turns up, and only once a save', () => {
    const s = { ...run(), familiars: ['hearth-toad'], relics: ['copper-ladle'] };
    expect(noteDue(RUN_NOTES, s, [])?.id).toBe('familiar');
    expect(noteDue(RUN_NOTES, s, ['familiar'])?.id).toBe('relic');
    expect(noteDue(RUN_NOTES, s, ['familiar', 'relic'])).toBeNull();
  });

  it('notice modifiers in hand, Friendship earned and visitors at the board', () => {
    const s = run();
    expect(noteDue(RUN_NOTES, { ...s, hand: [{ ...s.hand[0]!, modifier: 'blessed' as const }] }, [])?.id).toBe('modifier');
    expect(noteDue(RUN_NOTES, { ...s, friendship: { 'old-tobin': 1 } }, [])?.id).toBe('friendship');
    const order = { ...s.orders[0]!, customer: 'wren-hollis', status: 'open' as const };
    expect(noteDue(RUN_NOTES, { ...s, orders: [order] }, [])?.id).toBe('visitor');
  });

  it('greet the cottage as the save grows', () => {
    const p = newProfile();
    expect(noteDue(COTTAGE_NOTES, p, [])).toBeNull();
    expect(noteDue(COTTAGE_NOTES, { ...p, reputationEarned: 12 }, [])?.id).toBe('reputation');
    expect(noteDue(COTTAGE_NOTES, { ...p, wins: { ...p.wins, spring: 1 } }, [])?.id).toBe('kit');
    expect(noteDue(COTTAGE_NOTES, { ...p, yearSeasons: [['spring'], ['spring']] }, [])?.id).toBe('year');
  });

  it('have unique ids', () => {
    const ids = [...RUN_NOTES, ...COTTAGE_NOTES].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('are on by default and remembered in the profile', () => {
    expect(newProfile()).toMatchObject({ notes: true, notesSeen: [] });
    expect(migrateProfile({ version: PROFILE_VERSION, notes: false, notesSeen: ['relic', 'relic', 3] })).toMatchObject({ notes: false, notesSeen: ['relic'] });
    expect(migrateProfile({ version: PROFILE_VERSION, notesSeen: 'relic' }).notesSeen).toEqual([]);
  });
});
