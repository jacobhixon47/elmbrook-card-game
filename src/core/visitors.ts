import { barredCard, MUTATION_RULES } from './mutations';
import { codex } from '../codex';
import type { Visitor } from '../codex/schema';
import { todaysWeather } from './calendar';
import { reject, type Ctx } from './ctx';
import { MODIFIER_RULES } from './modifiers';
import { queueGift } from './night';
import { nextFloat, seedRng } from './rng';
import { MIN_DECK } from './rules';
import { allCards, type Order, type RunState, type StockItem } from './state';

// Seasonal visitors (GDD §4.1, Jacob, Oct 16): daytime guests of one season with no Friendship, who
// pay in odd things. At most one a day, on about 1 day in 4 of their season, from week 2.

export const VISITOR_RULES = {
  /** The chance a day of their season brings a visitor, when one can be served. */
  chance: 0.25,
  /** Visitors start coming once you've settled in (and never in the tutorial's week). */
  firstWeek: 2,
} as const;

// No Vital (a mutation) bars Vital ingredients from every pool.
const inPool = (c: { pool: string; id: string }, s: Pick<RunState, 'unlocks'> & Partial<Pick<RunState, 'mutation'>>) => !barredCard(s, c.id) && (c.pool === 'base' || (c.pool === 'unlock' && s.unlocks.includes(c.id)));

/** The visitors who could come today: this season, this week and day, this weather. */
export function visitorsToday(s: Pick<RunState, 'season' | 'week' | 'day' | 'calendar'>): Visitor[] {
  if (s.week < VISITOR_RULES.firstWeek) return [];
  return [...codex.visitors.values()].filter((v) => v.season === s.season
    && (!v.weeks || v.weeks.includes(s.week)) && (!v.lastDay || s.day <= v.lastDay)
    && (!v.weather || todaysWeather(s) === v.weather));
}

/**
 * Today's visitor, if one comes: rolled on its own stream from the seed, so a visitor doesn't change
 * the rest of the day's orders. `canServe` says whether the deck can brew what they want.
 */
export function rollVisitor(s: Pick<RunState, 'seed' | 'season' | 'week' | 'day' | 'calendar'> & Partial<Pick<RunState, 'endless'>>, canServe: (v: Visitor) => boolean): Visitor | null {
  const [roll, rng] = nextFloat(seedRng(`${s.seed}:visitor:${s.endless ? `${s.endless}:` : ''}${s.week}:${s.day}`));
  if (roll >= VISITOR_RULES.chance) return null;
  const able = visitorsToday(s).filter(canServe);
  if (!able.length) return null;
  return able[Math.floor(nextFloat(rng)[0] * able.length)]!;
}

/** What a visitor gives when their order is filled, beyond its gold. */
export function visitorPayment(ctx: Ctx, order: Pick<Order, 'customer'>): void {
  const v = codex.visitors.get(order.customer);
  if (!v) return;
  const s = ctx.s;
  const pay = v.paysIn;
  switch (pay.kind) {
    case 'gold':
      return;
    case 'card-pick': {
      const pool = pay.tincture
        ? [...codex.tinctures.values()].filter((t) => t.rarity !== 'lunar' && inPool(t, s)).map((t) => t.id)
        : [...codex.ingredients.values()].filter((i) => !i.nightOnly && inPool(i, s)
          && (!pay.tag || i.tags.includes(pay.tag)) && (!pay.essence || i.essences.includes(pay.essence))).map((i) => i.id);
      queueGift(ctx, 'visitor', pool, pay.count, 'deck', v.id);
      return;
    }
    case 'burn':
    case 'temper':
      s.favours.push({ kind: 'favour', visitor: v.id, job: pay.kind });
      ctx.ev.push({ type: 'favourQueued', visitor: v.id, job: pay.kind });
      return;
    case 'half-price':
      s.halfPrice += 1;
      ctx.ev.push({ type: 'halfPriceGained', visitor: v.id });
      return;
  }
}

/** Do the favour on offer to a card of the deck: Rook carries it off, the Toymaker tunes it up. */
export function doFavour(ctx: Ctx, uid: number): void {
  const s = ctx.s;
  const offer = s.offer;
  if (offer?.kind !== 'favour') reject('no one is offering a favour right now');
  if (offer.job === 'burn') {
    if (allCards(s).length <= MIN_DECK) reject(`the deck can't go below ${MIN_DECK} cards`);
    for (const pile of [s.drawPile, s.hand, s.discardPile] as const) {
      const i = pile.findIndex((c) => c.uid === uid);
      if (i < 0) continue;
      const [card] = pile.splice(i, 1);
      ctx.ev.push({ type: 'cardRemoved', uid: card!.uid, card: card!.card });
      return;
    }
    reject(`card ${uid} is not in the deck`);
  }
  const card = allCards(s).find((c) => c.uid === uid);
  if (!card) reject(`card ${uid} is not in the deck`);
  if (!codex.ingredients.has(card.card)) reject('only ingredients can be tuned up');
  card.bonus = (card.bonus ?? 0) + MODIFIER_RULES.temperPotency;
  ctx.ev.push({ type: 'cardInfused', uid, bonus: card.bonus });
}

/** A Night Market price after the Firefly Keeper's half-price buy, rounded up. */
export function priceAt(s: Pick<RunState, 'halfPrice' | 'offer'> & Partial<Pick<RunState, 'mutation'>>, item: Pick<StockItem, 'price'>): number {
  const night = s.offer?.kind === 'night-market';
  // Open Market (a mutation): every Night Market price is higher.
  const price = night && s.mutation === 'open-market' ? Math.round(item.price * MUTATION_RULES.openPrice) : item.price;
  return s.halfPrice > 0 && night ? Math.ceil(price / 2) : price;
}
