// The activity log (GDD §15.1): what just happened to your deck, gold and friends, as short lines
// with the thing named in its own colour. New lines show for a moment at the middle left of the
// screen, then fade into the log, which the Log button opens. Formatting is pure; the log itself is
// kept per run in this browser beside the save, so a reload or a scene restart keeps it.

import { MODIFIER_LOOK } from '../art/procedural';
import type { PaletteKey } from '../art/palette';
import { codex } from '../codex';
import { nextLevelAt } from '../core/friendship';
import { isSatchelCard, type CardSource, type GameEvent, type RunState } from '../core';
import { cardName, customerName, dayLabel, recipeName } from './describe';

export type Span = { text: string; color: PaletteKey };
export type LogLine = Span[];
export type LogEntry = { when: string; line: LogLine };

/** Colours of the things named: cards, gold, people, recipes and the rest. Plain words are BODY. */
export const LOG_COLOR = {
  body: 'w',
  dim: 'a',
  card: 'y',
  gold: 'y',
  person: 'I',
  recipe: 'L',
  relic: 'c',
  curse: 'R',
  familiar: 't',
  loss: 'R',
} as const satisfies Record<string, PaletteKey>;

const t = (text: string, color: PaletteKey = LOG_COLOR.body): Span => ({ text, color });
const card = (id: string) => t(cardName(id), LOG_COLOR.card);
const person = (id: string) => t(customerName(id), LOG_COLOR.person);
/** Gold as a change ("+15 gold"), or as an amount ("15 gold"). */
const gold = (n: number, signed = true) => t(`${signed && n > 0 ? '+' : ''}${n} gold`, n < 0 ? LOG_COLOR.loss : LOG_COLOR.gold);
const note = (text: string) => t(` (${text})`, LOG_COLOR.dim);

const SOURCE: Partial<Record<CardSource, string>> = {
  reward: 'reward',
  market: 'bought',
  forage: 'foraged',
  gift: 'gift',
  payment: 'payment',
  copy: 'copied',
  fortune: 'Fortune Tent',
  event: 'dusk event',
};

/** Why gold moved, for gold not already explained by its own line. */
const GOLD_WHY: Record<string, string> = {
  event: 'dusk event',
  fortune: 'Fortune Tent',
  familiar: 'familiar',
  relic: 'relic',
  card: 'card',
  omen: 'Omen',
  patron: 'patron',
  fence: 'the Fence',
  skip: 'skipped reward',
  commission: 'Commission',
  creek: 'the creek',
  firefly: 'Firefly Games',
  'yule-log': 'Yule Log',
  'holly-crown': 'Holly Crown',
};

/** Gold that paid for something the screen already showed: a purchase, a tarot's price, an order's pay, rent. */
function goldShown(e: Extract<GameEvent, { type: 'goldChanged' }>): boolean {
  if (e.reason === 'order' || e.reason === 'rent' || e.reason === 'debug') return true;
  // Spending is your own choice, except where it was taken from you.
  return e.delta < 0 && !['event', 'omen', 'patron'].includes(e.reason);
}

/**
 * The lines an action's events make, oldest first. `after` is the state the action led to, for
 * names an event gives only as a uid.
 */
export function activityLines(events: readonly GameEvent[], after?: Pick<RunState, 'drawPile' | 'hand' | 'discardPile' | 'satchel' | 'cauldron'>): LogLine[] {
  const nameOf = (uid: number) => {
    const all = after ? [...after.drawPile, ...after.hand, ...after.discardPile, ...after.satchel, ...after.cauldron] : [];
    return all.find((c) => c.uid === uid)?.card;
  };
  const lines: LogLine[] = [];
  // A tarot's own words already give the gold it paid.
  let tarotGold: number | undefined;
  for (const e of events) {
    switch (e.type) {
      case 'cardGained':
        if (e.source === 'sludge') lines.push([card(e.card), t(' joined your deck from a ruined brew.')]);
        else lines.push([card(e.card), t(isSatchelCard(e.card) ? ' went into your Night Satchel.' : ' joined your deck.'), ...(SOURCE[e.source] ? [note(SOURCE[e.source]!)] : [])]);
        break;
      case 'cardRemoved':
        lines.push([card(e.card), t(' left your deck.')]);
        break;
      case 'cardExpired':
        lines.push([card(e.card), t(' faded from your deck.')]);
        break;
      case 'cardTransformed':
        lines.push([card(e.from), t(' became '), card(e.to), t('.')]);
        break;
      case 'cardModified': {
        if (e.by === 'debug') break;
        const m = codex.modifiers.get(e.modifier)!;
        lines.push([card(e.card), t(' is now '), t(m.name, MODIFIER_LOOK[e.modifier].glow), t('.')]);
        break;
      }
      case 'cardInfused': {
        const id = nameOf(e.uid);
        lines.push([id ? card(id) : t('A card', LOG_COLOR.card), t(' was infused: '), t(`+${e.bonus} Potency`, 'l'), t('.')]);
        break;
      }
      case 'cardWoven':
        lines.push([card(e.from), t(' was woven into '), card(e.into), t('.')]);
        break;
      case 'recipeDiscovered':
        lines.push([t('New recipe: '), t(recipeName(e.recipe), LOG_COLOR.recipe), t('.')]);
        break;
      case 'recipeForgotten':
        lines.push([t('You forgot '), t(recipeName(e.recipe), LOG_COLOR.recipe), t('.')]);
        break;
      case 'friendshipGained':
        if (e.levelUp) lines.push([person(e.regular), t(' is now Friendship '), t(String(e.level), LOG_COLOR.person), t('!')]);
        else if (e.points > 0) {
          const next = nextLevelAt(e.total);
          lines.push([person(e.regular), t(` +${e.points} Friendship`), ...(next === null ? [] : [note(`${e.total}/${next}`)])]);
        }
        break;
      case 'familiarGained':
        lines.push([t(codex.familiars.get(e.familiar)?.name ?? e.familiar, LOG_COLOR.familiar), t(' joined you as a familiar.')]);
        break;
      case 'familiarSold':
        lines.push([t('Sold '), t(codex.familiars.get(e.familiar)?.name ?? e.familiar, LOG_COLOR.familiar), t(' for '), gold(e.price, false), t('.')]);
        break;
      case 'relicGained':
        if (e.source !== 'debug') lines.push([t('Relic: '), t(codex.relics.get(e.relic)!.name, LOG_COLOR.relic), t('.')]);
        break;
      case 'curseTaken':
        lines.push([t('Cursed: '), t(codex.curses.get(e.curse)!.name, LOG_COLOR.curse), t('.')]);
        break;
      case 'curseLifted':
        lines.push([t(codex.curses.get(e.curse)!.name, LOG_COLOR.curse), t(' is lifted.')]);
        break;
      case 'blessingChosen':
        lines.push([t('Blessing: '), t(codex.blessings.get(e.blessing)?.name ?? e.blessing, LOG_COLOR.relic), t('.')]);
        break;
      case 'tarotDrawn': {
        const c = codex.tarot.get(e.card)!;
        tarotGold = c.amount;
        lines.push([t('Drew '), t(c.name, 'v'), t(`: ${c.text}`)]);
        break;
      }
      case 'commissionTaken':
        lines.push([t('Took the Commission '), t(codex.commissions.get(e.commission)!.name, 'l'), t('.')]);
        break;
      case 'commissionDone':
        lines.push([t('Commission done: '), t(codex.commissions.get(e.commission)!.name, 'l'), t('.')]);
        break;
      case 'commissionFailed':
        lines.push([t(codex.commissions.get(e.commission)!.name, 'l'), t(' ran out of time.')]);
        break;
      case 'orderFilled':
        lines.push([person(e.customer), t(' paid '), gold(e.pay + e.tip, false), ...(e.tip ? [note(`${e.tip} tip`)] : []), t('.')]);
        break;
      case 'orderExpired':
        lines.push([person(e.customer), t(' gave up waiting.')]);
        break;
      case 'potionSold':
        break; // its gold says it (the Fence)
      case 'halfPriceGained':
        lines.push([person(e.visitor), t(' gave you half price at the next stall.')]);
        break;
      case 'upgradeBought':
        lines.push([t(e.upgrade === 'cauldron-slot' ? 'Your cauldron grew a slot.' : 'Your Shelf grew a slot.')]);
        break;
      case 'rentPaid':
        lines.push([t('Paid '), t(`${e.amount} gold`, LOG_COLOR.gold), t(` rent for week ${e.week}.`)]);
        break;
      case 'goldChanged':
        if (e.reason === 'fortune' && e.delta === tarotGold) break;
        if (!goldShown(e)) lines.push([gold(e.delta), ...(GOLD_WHY[e.reason] ? [note(GOLD_WHY[e.reason]!)] : [])]);
        break;
      case 'rewardForfeited':
        lines.push([t("The Fae Bargain took tonight's reward.")]);
        break;
    }
  }
  return lines;
}

/** A line as plain text, for tests and the log's search. */
export const plain = (line: LogLine) => line.map((s) => s.text).join('');

// ---------------------------------------------------------------- the log

/** Lines kept per run; the oldest go first. */
export const LOG_CAP = 200;

const KEY = { story: 'elmbrook.log', endless: 'elmbrook.endless-log' };

type Stored = { seed: string; entries: LogEntry[] };

let log: Stored = { seed: '', entries: [] };

const slot = (s: Pick<RunState, 'endlessMode'>) => KEY[s.endlessMode ? 'endless' : 'story'];

/** The run's log so far, read back from storage when the run is the one it was kept for. */
export function logFor(s: Pick<RunState, 'seed' | 'endlessMode'>): LogEntry[] {
  if (log.seed === s.seed) return log.entries;
  log = { seed: s.seed, entries: [] };
  try {
    const raw = globalThis.localStorage?.getItem(slot(s));
    const kept = raw ? (JSON.parse(raw) as Stored) : null;
    if (kept?.seed === s.seed && Array.isArray(kept.entries)) log.entries = kept.entries;
  } catch {
    // Storage blocked: the log starts empty.
  }
  return log.entries;
}

/** Add an action's lines to the run's log; returns the new entries. */
export function record(s: RunState, lines: readonly LogLine[], keep = true): LogEntry[] {
  const entries = logFor(s);
  const added = lines.map((line) => ({ when: dayLabel(s), line }));
  if (!added.length) return added;
  entries.push(...added);
  if (entries.length > LOG_CAP) entries.splice(0, entries.length - LOG_CAP);
  if (keep) {
    try {
      globalThis.localStorage?.setItem(slot(s), JSON.stringify(log));
    } catch {
      // Storage full or blocked: the log lasts until the page closes.
    }
  }
  return added;
}

/** Forget the log, as a new run starts. */
export function resetLog(s: Pick<RunState, 'seed' | 'endlessMode'>): void {
  log = { seed: s.seed, entries: [] };
  try {
    globalThis.localStorage?.removeItem(slot(s));
  } catch {
    // Nothing to clear.
  }
}
