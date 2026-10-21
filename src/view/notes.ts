import { codex } from '../codex';
import { cauldronOpen, witchOpen, type Profile, type RunState } from '../core';
import { STALL_LIST, type Rect } from './tutorial';

// First-time notes (Jacob, Oct 19): the systems the week-1 tutorial never reaches each get a short
// note the first time you meet them, once per save, and Settings can turn them off. Pure, so tests
// can check when each one shows.

export type Note = {
  id: string;
  title: string;
  text: string;
  /** What to outline, and where the note sits (centre x, top y). */
  target?: Rect;
  at: { x: number; y: number };
};

export type RunNote = Note & { when(s: RunState): boolean };
export type CottageNote = Note & { when(p: Profile): boolean };

const TOKENS: Rect = { x: 516, y: 8, w: 58, h: 16 };

export const RUN_NOTES: readonly RunNote[] = [
  {
    id: 'familiar',
    title: 'Familiars',
    text: 'Your first familiar. Familiars sit in these slots and add to every brew, scoring left to right after your cards. Hover one to read it; click it to sell it or move it.',
    when: (s) => s.familiars.length > 0,
    target: { x: 576, y: 254, w: 52, h: 64 }, at: { x: 450, y: 150 },
  },
  {
    id: 'relic',
    title: 'Relics',
    text: 'A relic. It works on its own for the rest of the run, and there is no limit to how many you hold. Relics wait up here: hover one to read it.',
    when: (s) => s.relics.length > 0,
    target: TOKENS, at: { x: 470, y: 40 },
  },
  {
    id: 'curse',
    title: 'Curses',
    text: 'A Curse, the price of a Name-Taker deal. It works against you for the rest of the run unless something lifts it, and a few things in Elmbrook do. Hover it up here to read it.',
    when: (s) => s.curses.length > 0,
    target: TOKENS, at: { x: 470, y: 40 },
  },
  {
    id: 'modifier',
    title: 'Card modifiers',
    text: 'A card with a modifier: see its coloured frame and corner badge. Moonlit adds Harmony, Aged gains Potency each day it waits, Blessed counts twice, and Cursed counts twice but earns no Friendship. Hover it for the details.',
    when: (s) => s.hand.some((c) => c.modifier),
    at: { x: 320, y: 140 },
  },
  {
    id: 'friendship',
    title: 'Friendship',
    text: 'Regulars remember you. Every delivery to a regular earns Friendship, and it keeps building from run to run. New levels bring their stories, a favourite order and gifts in Winter. The Grimoire\'s Townsfolk page shows how close you are.',
    when: (s) => Object.values(s.friendship).some((n) => n > 0),
    at: { x: 320, y: 110 },
  },
  {
    id: 'visitor',
    title: 'Seasonal visitors',
    text: 'A seasonal visitor. They only come in their own season, pay differently from the regulars, and some leave something extra after closing. They have no Friendship meter.',
    when: (s) => s.orders.some((o) => o.status === 'open' && codex.visitors.has(o.customer)),
    at: { x: 320, y: 110 },
  },
  {
    id: 'market-list',
    title: 'The Night Market',
    text: 'Walk to a stall to visit it, or open Tonight\'s stalls (Tab) to see every stall at once and go straight to one. Pay rent at the bridge when you\'re done.',
    when: (s) => s.offer?.kind === 'night-market' && s.offer.at === null,
    target: STALL_LIST, at: { x: 320, y: 230 },
  },
  {
    id: 'commission',
    title: 'Guild Commissions',
    text: 'A Guild Commission. Meet its goal by the Night Shift it names and the Guild pays a relic. Its progress shows here; hover it for the goal and the reward.',
    when: (s) => s.commissions.length > 0,
    target: { x: 400, y: 32, w: 234, h: 11 }, at: { x: 470, y: 48 },
  },
];

const others = (open: (id: string) => boolean, ids: Iterable<string>) => [...ids].filter((id) => id !== 'hedge-witch' && id !== 'copper' && open(id)).length > 0;

export const COTTAGE_NOTES: readonly CottageNote[] = [
  {
    id: 'home',
    title: 'Your cottage',
    text: 'Home, between runs. Walk with WASD and press F by anything that glows. When you\'re ready, walk out of the front door (or press F by it) to set out for Spring.',
    when: (p) => p.runs === 0,
    at: { x: 320, y: 120 },
  },
  {
    id: 'reputation',
    title: 'Reputation',
    text: 'Every run earns Reputation, won or lost. Spend it at the workbench on perks, which help every run after. Walk up to a glowing spot and press F to use it.',
    when: (p) => p.reputationEarned > 0,
    at: { x: 320, y: 120 },
  },
  {
    id: 'kit',
    title: 'Witches and cauldrons',
    text: 'Something new to brew with. At the cauldron, choose who brews and in what: each witch has a quirk and each cauldron an effect. Neither is stronger, just different.',
    when: (p) => others((id) => witchOpen(p, id), codex.witches.keys()) || others((id) => cauldronOpen(p, id), codex.cauldrons.keys()),
    at: { x: 320, y: 120 },
  },
  {
    id: 'almanac',
    title: 'The Almanac',
    text: 'An Almanac goal done. The Almanac on the lectern lists goals that span all your runs, and finishing them opens new cards, recipes and cauldrons.',
    when: (p) => p.almanac.length > 0,
    at: { x: 320, y: 120 },
  },
  {
    id: 'year',
    title: 'Years',
    text: 'A new Year is open. Choose it at the calendar: each Year keeps the last one\'s rules, adds one of its own and earns more Reputation, and the first time you choose it you pick a boon.',
    when: (p) => p.yearSeasons.length > 1,
    at: { x: 320, y: 120 },
  },
];

/** The first note due that this save hasn't shown yet, or null. */
export function noteDue<T, N extends Note & { when(x: T): boolean }>(notes: readonly N[], x: T, seen: readonly string[]): N | null {
  return notes.find((n) => !seen.includes(n.id) && n.when(x)) ?? null;
}
