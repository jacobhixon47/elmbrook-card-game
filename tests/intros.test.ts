import { describe, expect, it } from 'vitest';
import { migrateProfile, newProfile, PROFILE_VERSION, SEASONS, SEASON_WEATHER, WEATHER_RULE } from '../src/core';
import { isIntroWeather, patronArrival, SEASON_OPENING, WEATHER_INTRO, WEATHER_INTRO_KINDS } from '../src/view/intros';

describe('season openings and weather firsts in the profile', () => {
  it('start with openings on and no weather met, and survive a migration from version 6', () => {
    expect(newProfile()).toMatchObject({ seasonOpenings: true, weatherSeen: [] });
    const p = migrateProfile({ ...newProfile(), version: 6, seasonOpenings: undefined, weatherSeen: undefined, runs: 2 });
    expect(p).toMatchObject({ version: PROFILE_VERSION, runs: 2, seasonOpenings: true, weatherSeen: [] });
  });

  it('keep a choice to hide openings, and repair bad values', () => {
    expect(migrateProfile({ ...newProfile(), seasonOpenings: false }).seasonOpenings).toBe(false);
    expect(migrateProfile({ ...newProfile(), weatherSeen: ['fog', 'nope', 3, 'snow'] }).weatherSeen).toEqual(['fog', 'snow']);
    expect(migrateProfile({ ...newProfile(), weatherSeen: 'fog' }).weatherSeen).toEqual([]);
  });
});

describe('the scene screens', () => {
  it('every season has an opening, and every weather with a rule has a first-time scene', () => {
    for (const s of SEASONS) expect(SEASON_OPENING[s].lines.length).toBeGreaterThan(0);
    const ruled = [...new Set(SEASONS.flatMap((s) => SEASON_WEATHER[s]))].filter((w) => w !== 'clear' && w !== 'rain');
    expect([...WEATHER_INTRO_KINDS].sort()).toEqual(ruled.sort());
    for (const w of WEATHER_INTRO_KINDS) expect(WEATHER_INTRO[w].lines).toContain(WEATHER_RULE[w]);
    expect(isIntroWeather('clear')).toBe(false);
  });

  it('the Patron\'s arrival never hides the Grimoire, and mentions the candle when it is lit', () => {
    const plain = patronArrival({ blessing: null }).lines.join(' ');
    expect(plain).not.toMatch(/Grimoire/);
    expect(plain).toMatch(/all 3 of their orders/);
    expect(patronArrival({ blessing: 'candle-in-the-window' }).lines.at(-1)).toMatch(/candle.*first order/);
  });
});
