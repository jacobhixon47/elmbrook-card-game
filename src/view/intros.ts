import { codex } from '../codex';
import { FINALE_ORDERS, WEATHER_RULE, type RunState, type Season, type Weather } from '../core';

// The words of the scene screens that open a run, meet a weather for the first time, and bring
// on the Moonless Patron (GDD §4.2). Run.ts decides when each shows.

/** `portrait` is whose portrait sits at the top of the screen, when it is about someone. */
export type Intro = { name: string; lines: string[]; portrait?: string };

/** Each run opens with its season's scene, unless it was turned off in Settings. */
export const SEASON_OPENING: Record<Season, Intro> = {
  spring: {
    name: 'Spring in Elmbrook',
    lines: [
      'The thaw is in, the creek runs high, and the gardens are waking up. Expect rain most weeks, and now and then a morning of fog.',
      'Halfway through the month the square holds the Bloomtide Fair. By night the Seed Swapper and the Blossom Oracle set up at the Night Market.',
      'Pay the Guild\'s rent each week, and be ready for the Moonless Patron on the last new moon.',
    ],
  },
  summer: {
    name: 'Summer in Elmbrook',
    lines: [
      'Long days and warm nights. Heatwaves come often this season, and Ember ingredients thrive in them.',
      'Halfway through the month the Firefly Fair lights up the square. By night Firefly Games and the Nectar Trader join the Night Market.',
      'Pay the Guild\'s rent each week, and be ready for the Moonless Patron on the last new moon.',
    ],
  },
  autumn: {
    name: 'Autumn in Elmbrook',
    lines: [
      'The orchards are heavy and the mornings misty: fog rolls in more often than in any other season, and rain is never far off.',
      'Halfway through the month the Harvest Fair fills the square. By night the Cider Press and the Harvest Auction come to the Night Market.',
      'Pay the Guild\'s rent each week, and be ready for the Moonless Patron on the last new moon.',
    ],
  },
  winter: {
    name: 'Winter in Elmbrook',
    lines: [
      'Snow on the eaves and short, dark days. Snow puts Frost cards first in your hand, and a heavy fall can bury the Night Market. The Hearth Trader keeps his fire lit every night.',
      'There is no fair this season. On the eve of the finale the town keeps the Longest Night vigil instead.',
      'This is the hardest month of the Year, and the Moonless Patron is waiting at the end of it.',
    ],
  },
};

/** The weathers with a first-time scene: each shows once per save, then only the HUD line tells you. */
export const WEATHER_INTRO_KINDS = ['fog', 'heatwave', 'snow'] as const satisfies readonly Weather[];
export type IntroWeather = (typeof WEATHER_INTRO_KINDS)[number];
export const isIntroWeather = (w: Weather): w is IntroWeather => (WEATHER_INTRO_KINDS as readonly Weather[]).includes(w);

const AFTER = 'From now on the weather line at the top left says what each day brings. Hover it for the rules.';

export const WEATHER_INTRO: Record<IntroWeather, Intro> = {
  fog: {
    name: 'Fog',
    lines: ['A thick fog rolled in off the creek before dawn. You can hear footsteps in the lane, but you can\'t see who\'s coming.', WEATHER_RULE.fog, AFTER],
  },
  heatwave: {
    name: 'Heatwave',
    lines: ['The sun was up hot and early, and every window in the shop is thrown open. Anything with fire in it is eager today.', WEATHER_RULE.heatwave, AFTER],
  },
  snow: {
    name: 'Snow',
    lines: ['Snow fell overnight. The garden is buried, but the cold-loving things are the first you find.', WEATHER_RULE.snow, AFTER],
  },
};

/** The finale's Night Shift, as it opens: who has come, what they want, and the vigil's candle if you lit one. */
export function patronArrival(s: Pick<RunState, 'blessing'>): Intro {
  const patron = codex.patrons.get('moonless-patron')!;
  const candle = s.blessing === 'candle-in-the-window'
    ? ['The candle you set in the window last night is still burning, and their first order asks a little less for it.']
    : [];
  return {
    name: patron.name,
    portrait: patron.id,
    lines: [
      'The new moon. The lane is dark, the regulars went home early, and someone is waiting at the counter. Nobody sees a face.',
      `Fill all ${FINALE_ORDERS} of their orders tonight to win the month.`,
      ...candle,
    ],
  };
}
