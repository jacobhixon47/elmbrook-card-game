import { codex } from '../codex';
import type { Patron, Twist } from '../codex/schema';
import { NIGHT_SHIFT_DAY, type Season } from './calendar';
import { changeGold, gainCard, pick, randInt, type Ctx } from './ctx';
import { rollFamiliars } from './familiars';
import { grantRelic, liftCurse } from './relics';
import { nextFloat, seedRng } from './rng';
import {
  FINALE_ORDERS, FIRST_NIGHT_GIFT, LUNAR_GIFT, RARE_GIFT, TITHE_GOLD, WEEKS,
} from './rules';
import type { CardInstance, Gift, GiftSource, Order, RunState } from './state';

// Night Shifts (GDD §3, §4.1, §5.4, §10): the patron and their twist, the Night Satchel, and the
// gifts that come after the shift.

/**
 * Each week's patron, rolled at run start on its own stream so the Calendar's weather stays the
 * same for a seed. Week 2 is the Pale Courier and week 4 the Moonless Patron (their only weeks);
 * weeks 1 and 3 draw from the others that fit the season, never the same one twice.
 */
export function rollPatrons(seed: string, season: Season): string[] {
  let rng = seedRng(`${seed}:patrons`);
  const out: string[] = [];
  for (let week = 1; week <= WEEKS; week++) {
    const options = [...codex.patrons.values()].filter((p) => p.weeks.includes(week) && (!p.season || p.season === season) && !out.includes(p.id));
    const [f, next] = nextFloat(rng);
    rng = next;
    out.push(options[Math.floor(f * options.length)]!.id);
  }
  return out;
}

/** This week's patron, whether or not tonight is the Night Shift. */
export function patronOf(s: Pick<RunState, 'patrons' | 'week'>, week = s.week): Patron | null {
  const id = s.patrons[week - 1];
  return id ? codex.patrons.get(id) ?? null : null;
}

/** The rule twist in force right now: only on a Night Shift. */
export function twistNow(s: Partial<Pick<RunState, 'patrons' | 'week' | 'day'>>): Twist | null {
  if (!s.patrons || s.week === undefined || s.day !== NIGHT_SHIFT_DAY) return null;
  return patronOf({ patrons: s.patrons, week: s.week })?.twist ?? null;
}

/** Lunar ingredients (night-only) and Omens live in the Night Satchel, not the deck. */
export function isSatchelCard(id: string): boolean {
  return codex.ingredients.get(id)?.nightOnly === true || codex.tinctures.get(id)?.rarity === 'lunar';
}

const inPool = (c: { pool: string; id: string }, s: Pick<RunState, 'unlocks'>) => c.pool === 'base' || (c.pool === 'unlock' && s.unlocks.includes(c.id));

/** Lunar ingredients this run can be offered. */
export function lunarPool(s: Pick<RunState, 'unlocks'>): string[] {
  return [...codex.ingredients.values()].filter((i) => i.nightOnly && inPool(i, s)).map((i) => i.id);
}

/** Omens this run can be offered. */
export function omenPool(s: Pick<RunState, 'unlocks'>): string[] {
  return [...codex.tinctures.values()].filter((t) => t.rarity === 'lunar' && inPool(t, s)).map((t) => t.id);
}

/** Day ingredients of one rarity, for Granny Bogwort (Rare) and the Twin Owls. */
export function rarityPool(s: Pick<RunState, 'unlocks'>, rarity: 'common' | 'uncommon' | 'rare'): string[] {
  return [...codex.ingredients.values()].filter((i) => i.rarity === rarity && !i.nightOnly && inPool(i, s)).map((i) => i.id);
}

/** n distinct cards from a pool. */
export function draft(ctx: Ctx, pool: readonly string[], n: number): string[] {
  const left = [...pool];
  const out: string[] = [];
  while (out.length < n && left.length) out.push(...left.splice(randInt(ctx, left.length), 1));
  return out;
}

export function queueGift(ctx: Ctx, source: GiftSource, pool: readonly string[], n: number, into: Gift['into']): void {
  const cards = draft(ctx, pool, n);
  if (cards.length === 0) return;
  const gift: Gift = { kind: 'gift', source, cards, into };
  ctx.s.gifts.push(gift);
  ctx.ev.push({ type: 'giftQueued', source, cards });
}

/** The first Night Shift gives a free Lunar ingredient, so the Satchel isn't empty for the Pale Courier. */
export function queueFirstNightGift(ctx: Ctx): void {
  if (ctx.s.week === 1) queueGift(ctx, 'first-night', lunarPool(ctx.s), FIRST_NIGHT_GIFT, 'satchel');
}

/** Before a new day: Satchel cards come back out of the deck. */
export function stowSatchel(s: RunState): void {
  const out: CardInstance[] = [];
  for (const pile of [s.drawPile, s.hand, s.discardPile, s.cauldron]) {
    for (let i = pile.length - 1; i >= 0; i--) if (isSatchelCard(pile[i]!.card)) out.unshift(...pile.splice(i, 1));
  }
  s.satchel.push(...out);
}

/** A rule a patron's twist puts on brewing; null when the brew is allowed. */
export function brewBlocked(s: Pick<RunState, 'patrons' | 'week' | 'day' | 'gold' | 'lastBrew'>, cards: readonly CardInstance[]): string | null {
  const twist = twistNow(s);
  if (twist === 'brew-costs-gold-2' && s.gold < TITHE_GOLD) return `The Tithe Reeve wants ${TITHE_GOLD} gold for every brew`;
  if (twist === 'origin-chain' && s.lastBrew.length > 0) {
    const last = new Set(s.lastBrew.map((id) => codex.ingredients.get(id)?.origin));
    if (cards.every((c) => last.has(codex.ingredients.get(c.card)?.origin))) return 'Mother Hollow wants an ingredient from a different Origin than your last brew';
  }
  return null;
}

/** What a patron gives when their order is filled, beyond its pay. */
export function patronReward(ctx: Ctx, patron: Patron): void {
  const r = patron.reward;
  switch (r.kind) {
    case 'gold':
      changeGold(ctx, r.amount, 'patron');
      return;
    case 'card-pick':
      queueGift(ctx, 'patron', rarityPool(ctx.s, r.rarity), r.count, 'deck');
      return;
    case 'familiar-pick': {
      const cards = rollFamiliars(ctx, r.count);
      if (!cards.length) return;
      ctx.s.gifts.push({ kind: 'gift', source: 'patron', cards, into: 'familiar' });
      ctx.ev.push({ type: 'giftQueued', source: 'patron', cards });
      return;
    }
    case 'relic':
      grantRelic(ctx, r.tier, 'patron');
      return;
    case 'win':
      return;
  }
}

/** What a night customer gives when their order is filled, beyond its gold. */
export function nightPayment(ctx: Ctx, order: Order): void {
  const guest = codex.nightCustomers.get(order.customer);
  if (!guest) return;
  switch (guest.paysIn.kind) {
    case 'omen': {
      const pool = omenPool(ctx.s);
      if (pool.length) gainCard(ctx, pick(ctx, pool), 'payment');
      return;
    }
    case 'lunar-card':
      queueGift(ctx, 'lantern-witch', lunarPool(ctx.s), LUNAR_GIFT, 'satchel');
      return;
    case 'rare-card':
      queueGift(ctx, 'bog-hag', rarityPool(ctx.s, 'rare'), RARE_GIFT, 'deck');
      return;
    case 'gold':
      return;
    case 'lift-curse':
      // The Miller's order paid the no-curse rate if you had none when it was posted.
      liftCurse(ctx, order.customer);
      return;
  }
}

/** The Moonless Patron is satisfied when enough of their orders were filled (FINALE_ORDERS). */
export function finaleMet(s: Pick<RunState, 'orders' | 'patrons' | 'week'>): boolean {
  const patron = patronOf(s);
  if (patron?.reward.kind !== 'win') return true;
  return s.orders.filter((o) => o.customer === patron.id && o.status === 'filled').length >= FINALE_ORDERS;
}

/** Is this customer id a patron? */
export const isPatron = (id: string) => codex.patrons.has(id);
