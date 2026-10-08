import { BREWS_PER_DAY, DISCARDS_PER_DAY, NIGHT_SHIFT_DAY, type BrewPreview, type RunState } from '../core';

// The first-run tutorial (GDD §15.1): tips over a guided week 1 on a fixed seed. Each tip has a
// window (when it applies) and either a condition that completes it or a Got it button. Pure, so
// tests can walk a whole week through it.

/** Its first order can be filled from the opening hand (Elmroot + Creekwater), and Stir is in hand. */
export const TUTORIAL_SEED = 'tutorial-26';

export type Rect = { x: number; y: number; w: number; h: number };

/** What the scene knows beyond the run state. */
export type TutorialView = { dialog: boolean; book: boolean; preview: BrewPreview['kind'] };

export type Tip = {
  id: string;
  text: string;
  /** When the tip applies. */
  when(s: RunState, v: TutorialView): boolean;
  /** Completes the tip without a Got it press; tips without one show a Got it button. */
  until?(s: RunState, v: TutorialView): boolean;
  /** What to outline, and where the tip box sits (centre x, top y). */
  target?: Rect;
  at: { x: number; y: number };
};

const ORDERS: Rect = { x: 6, y: 44, w: 138, h: 44 };
const HAND: Rect = { x: 100, y: 260, w: 480, h: 90 };
const SIDE: Rect = { x: 496, y: 40, w: 138, h: 102 };
const MID_BUTTON: Rect = { x: 270, y: 234, w: 100, h: 20 };
const END_BUTTON: Rect = { x: 548, y: 234, w: 64, h: 20 };
const BOOK_BUTTON: Rect = { x: 439, y: 6, w: 78, h: 20 };
const RIBBON: Rect = { x: 200, y: 2, w: 240, h: 31 };
const WEATHER: Rect = { x: 6, y: 32, w: 150, h: 12 };

const day1 = (s: RunState) => s.week === 1 && s.day === 1;
const brewing1 = (s: RunState) => day1(s) && s.phase === 'brewing';
const fresh = (s: RunState) => brewing1(s) && s.brewsLeft === BREWS_PER_DAY;

export const TIPS: Tip[] = [
  {
    id: 'welcome',
    text: 'Welcome to your potion stall! Each afternoon customers pin orders to the board. Click the order to read it.',
    when: (s, v) => day1(s) && s.phase === 'morning' && !v.dialog,
    until: (_, v) => v.dialog,
    target: ORDERS, at: { x: 270, y: 110 },
  },
  {
    id: 'order',
    text: 'An order names a potion and the lowest quality the customer will take. Fill it today for gold and a heart. Go Back, then open the shop.',
    when: (s, v) => day1(s) && s.phase === 'morning' && v.dialog,
    until: (_, v) => !v.dialog,
    at: { x: 320, y: 228 },
  },
  {
    id: 'open',
    text: 'The ribbon at the top shows where you are: four days, then the Night Shift. Open the shop to start brewing.',
    when: (s, v) => day1(s) && s.phase === 'morning' && !v.dialog,
    until: (s) => s.phase !== 'morning',
    target: MID_BUTTON, at: { x: 320, y: 150 },
  },
  {
    id: 'hand',
    text: 'This is your hand. The coloured dots are essences; the red number is Potency. Hover any card to read it.',
    when: (s, v) => fresh(s) && s.cauldron.length === 0 && !v.book,
    target: HAND, at: { x: 320, y: 150 },
  },
  {
    id: 'grimoire',
    text: 'Recipes are essence patterns. Open the Grimoire (G) to see the four you know, and what each potion needs.',
    when: (s) => fresh(s) && s.cauldron.length === 0,
    until: (_, v) => v.book,
    target: BOOK_BUTTON, at: { x: 420, y: 40 },
  },
  {
    id: 'slot',
    text: 'Healing Draught is Vital + Tide. Click Elmroot (Vital), then Creekwater (Tide), to put them in the cauldron.',
    when: (s, v) => fresh(s) && !v.book && v.preview !== 'potion',
    until: (_, v) => v.preview === 'potion',
    target: HAND, at: { x: 320, y: 150 },
  },
  {
    id: 'preview',
    text: 'The preview: Quality is Potency × Harmony, and it sets the tier. The last line says who gets the potion. Press Brew (or Enter).',
    when: (s, v) => fresh(s) && v.preview === 'potion',
    until: (s) => s.brewsLeft < BREWS_PER_DAY,
    target: SIDE, at: { x: 380, y: 160 },
  },
  {
    id: 'day',
    text: `Delivered! You have ${BREWS_PER_DAY} Brews and ${DISCARDS_PER_DAY} Discards for the whole day. A Discard swaps cards you can't use for new ones. Potions no order wants wait on the Shelf to sell later.`,
    when: (s) => brewing1(s) && s.brewsLeft < BREWS_PER_DAY,
    target: SIDE, at: { x: 380, y: 150 },
  },
  {
    id: 'end',
    text: 'Stir is a tincture: play it for +1 Harmony on your next brew. When you are out of Brews or ideas, End day. Open orders are declined, and the customer likes you a little less.',
    when: (s) => brewing1(s) && s.brewsLeft < BREWS_PER_DAY,
    target: END_BUTTON, at: { x: 420, y: 160 },
  },
  {
    id: 'twilight',
    text: 'Twilight. Take one card into your deck (hover to read them), or skip it for gold.',
    when: (s) => day1(s) && s.offer?.kind === 'reward',
    until: (s) => s.offer?.kind !== 'reward',
    target: RIBBON, at: { x: 320, y: 290 },
  },
  {
    id: 'errand',
    text: 'One errand a night. The Market sells cards and upgrades, the Forage gives free ingredients, and the Hearth burns a card you no longer want.',
    when: (s) => day1(s) && s.offer?.kind === 'errands',
    until: (s) => s.offer?.kind !== 'errands',
    at: { x: 320, y: 230 },
  },
  {
    id: 'day2',
    text: 'A new day and new orders. Every morning your whole deck is shuffled again, so no card is lost for long.',
    when: (s) => s.week === 1 && s.day === 2 && s.phase === 'morning',
    at: { x: 320, y: 150 },
  },
  {
    id: 'weather',
    text: 'Each day has weather, shown under the Brews. Rain, Fog and the rest bend the day\'s rules: hover it to read them. The Grimoire\'s Calendar shows the whole month ahead.',
    when: (s) => s.week === 1 && s.day === 2 && s.phase === 'morning',
    target: WEATHER, at: { x: 320, y: 150 },
  },
  {
    id: 'night',
    text: 'The Night Shift ends the week. Night customers pay more, some in odd things. Afterwards the Night Market opens and rent is due.',
    when: (s) => s.week === 1 && s.day === NIGHT_SHIFT_DAY && s.phase === 'morning',
    target: RIBBON, at: { x: 320, y: 150 },
  },
  {
    id: 'patron',
    text: 'Each Night Shift has a patron with a twist on the rules, shown here and on the Calendar. Their order is at the top, one tier harder, and pays a reward.',
    when: (s) => s.week === 1 && s.day === NIGHT_SHIFT_DAY && s.phase === 'morning',
    target: SIDE, at: { x: 380, y: 160 },
  },
  {
    id: 'gift',
    text: 'A gift from the night: a Lunar ingredient, free. Lunar cards live in your Night Satchel and join your deck only on Night Shifts, so they never crowd your days.',
    when: (s) => s.week === 1 && s.offer?.kind === 'gift' && s.offer.source === 'first-night',
    until: (s) => s.offer?.kind !== 'gift',
    at: { x: 320, y: 270 },
  },
  {
    id: 'fence',
    text: 'The Night Market. Visit the stalls: sell potions to the Fence to make rent, or buy Lunar cards for next Night Shift. Pay rent and a new week begins; if you can\'t, the Guild takes your stall.',
    when: (s) => s.week === 1 && s.phase === 'night-market',
    at: { x: 320, y: 260 },
  },
  {
    id: 'done',
    text: 'That\'s a week. Rent rises every week, so grow a stronger deck. The Grimoire has the rules whenever you need them. Good luck!',
    when: (s) => s.week === 2 && s.day === 1 && s.phase === 'morning',
    at: { x: 320, y: 150 },
  },
];

/**
 * Which tips are finished. A tip ends when its condition holds, when the player presses Got it,
 * or when the run moves past it to a later tip.
 */
export class TutorialProgress {
  readonly done = new Set<string>();

  constructor(done: Iterable<string> = []) {
    for (const id of done) this.done.add(id);
  }

  /** The tip to show now, after closing any that the state has completed or moved past. */
  current(s: RunState, v: TutorialView): Tip | null {
    for (let i = 0; i < TIPS.length; i++) {
      const tip = TIPS[i]!;
      if (this.done.has(tip.id)) continue;
      if (tip.when(s, v)) {
        if (tip.until?.(s, v)) {
          this.done.add(tip.id);
          continue;
        }
        return tip;
      }
      // Skipped past: a later tip already applies.
      if (TIPS.slice(i + 1).some((t) => !this.done.has(t.id) && t.when(s, v))) this.done.add(tip.id);
    }
    return null;
  }

  dismiss(id: string) {
    this.done.add(id);
  }

  /** The tutorial is over once week 1 is behind the player, or the run ended. */
  finished(s: RunState): boolean {
    return this.done.has('done') || s.week > 1 && s.phase !== 'morning' || s.phase === 'game-over' || s.phase === 'victory';
  }
}
