import { codex } from '../codex';
import type { Pool } from '../codex/schema';
import { activeEvents } from './calendar';
import { guildOpen, offerCommissions } from './commissions';
import { openEvent, rollEvent } from './dusk-events';
import { pickWeighted, shuffled, type Ctx } from './ctx';
import { familiarPrice, rollFamiliars } from './familiars';
import { rewardCount, rewardWeights } from './relics';
import {
  CARD_PRICE, CAULDRON_SLOT_PRICE, FORAGE_CARDS, FORAGE_PICKS, MARKET_CARDS, MARKET_FAMILIARS, MAX_CAULDRON_SLOTS, MAX_SHELF_SLOTS,
  rarityWeights, SHELF_SLOT_PRICE, type ShopRarity,
} from './rules';
import type { Errand, RunState, StockItem } from './state';

type PoolCard = { id: string; rarity: ShopRarity; wychwood: boolean; inSeason: boolean };

/** How much likelier an in-season ingredient is in rewards, the Market and the Forage (GDD §6.1). */
export const IN_SEASON_WEIGHT = 3;

const inPool = (c: { id: string; pool: Pool }, s: Pick<RunState, 'unlocks'>) =>
  c.pool === 'base' || (c.pool === 'unlock' && s.unlocks.includes(c.id));

/**
 * Cards that rewards and the Market can offer: base-pool cards and unlocked ones. No Lunar cards
 * (those come from the night); event cards only while their event lasts.
 */
export function dayPool(s: Pick<RunState, 'unlocks' | 'season'> & Partial<Pick<RunState, 'calendar' | 'week' | 'day'>>): PoolCard[] {
  const out: PoolCard[] = [];
  const events = activeEvents(s);
  for (const i of codex.ingredients.values()) {
    // Event cards (Fallen Star) join the pool while their Calendar event lasts, Lunar or not.
    const eventCard = i.pool === 'event' && i.event !== undefined && events.includes(i.event);
    if (!eventCard && (i.nightOnly || i.rarity === 'lunar' || !inPool(i, s))) continue;
    out.push({ id: i.id, rarity: rarityOf(i.id), wychwood: i.origin === 'wychwood', inSeason: i.inSeason.includes(s.season) });
  }
  for (const t of codex.tinctures.values()) {
    if (t.rarity !== 'lunar' && inPool(t, s)) out.push({ id: t.id, rarity: t.rarity, wychwood: false, inSeason: false });
  }
  return out;
}

const seasonWeight = (c: PoolCard) => (c.inSeason ? IN_SEASON_WEIGHT : 1);

export function rarityOf(cardId: string): ShopRarity {
  const r = codex.ingredients.get(cardId)?.rarity ?? codex.tinctures.get(cardId)?.rarity ?? 'common';
  return r === 'lunar' ? 'rare' : r;
}

/** n distinct cards, each rolled by rarity first, then within that rarity (in-season cards weigh more). */
function rollCards(ctx: Ctx, n: number, weights: [ShopRarity, number][]): string[] {
  const pool = dayPool(ctx.s);
  const out: string[] = [];
  while (out.length < n && out.length < pool.length) {
    const rarity = pickWeighted(ctx, weights);
    const left = pool.filter((c) => !out.includes(c.id));
    const ofRarity = left.filter((c) => c.rarity === rarity);
    const from = ofRarity.length ? ofRarity : left;
    out.push(pickWeighted(ctx, from.map((c) => [c.id, seasonWeight(c)] as const)));
  }
  return out;
}

export function offerReward(ctx: Ctx): void {
  const cards = rollCards(ctx, rewardCount(ctx.s), rewardWeights(ctx.s));
  ctx.s.offer = { kind: 'reward', cards };
  ctx.ev.push({ type: 'rewardOffered', cards });
}

const ERRANDS: readonly Errand[] = ['market', 'forage', 'creek', 'guild', 'hearth', 'event'];

export function offerErrands(ctx: Ctx): void {
  // The Guild Hall only comes up with a commission to give and room to take it.
  const options = shuffled(ctx, ERRANDS.filter((e) => e !== 'guild' || guildOpen(ctx.s))).slice(0, 2);
  ctx.s.offer = { kind: 'errands', options };
  ctx.ev.push({ type: 'errandsOffered', options });
}

export function openErrand(ctx: Ctx, errand: Errand): void {
  const s = ctx.s;
  ctx.ev.push({ type: 'errandChosen', errand });
  switch (errand) {
    case 'market': {
      const stock: StockItem[] = rollCards(ctx, MARKET_CARDS, rarityWeights(0)).map((card) => ({
        kind: 'card', card, price: CARD_PRICE[rarityOf(card)], sold: false,
      }));
      for (const familiar of rollFamiliars(ctx, MARKET_FAMILIARS)) stock.push({ kind: 'familiar', familiar, price: familiarPrice(familiar), sold: false });
      if (s.cauldronSlots < MAX_CAULDRON_SLOTS) stock.push({ kind: 'cauldron-slot', price: CAULDRON_SLOT_PRICE, sold: false });
      if (s.shelfSize < MAX_SHELF_SLOTS) stock.push({ kind: 'shelf-slot', price: SHELF_SLOT_PRICE, sold: false });
      s.offer = { kind: 'market', stock };
      return;
    }
    case 'forage': {
      // Wychwood and in-season ingredients are each three times as likely; every card is free.
      const pool = dayPool(s).filter((c) => codex.ingredients.has(c.id));
      const cards: string[] = [];
      while (cards.length < FORAGE_CARDS && cards.length < pool.length) {
        const left = pool.filter((c) => !cards.includes(c.id));
        cards.push(pickWeighted(ctx, left.map((c) => [c.id, (c.wychwood ? 3 : 1) * seasonWeight(c)] as const)));
      }
      s.offer = { kind: 'forage', cards, picksLeft: FORAGE_PICKS };
      return;
    }
    case 'creek':
      s.offer = { kind: 'creek', done: false };
      return;
    case 'guild':
      s.offer = { kind: 'guild', options: offerCommissions(ctx), taken: false };
      return;
    case 'hearth':
      s.offer = { kind: 'hearth', removed: false };
      return;
    case 'event':
      openEvent(ctx, rollEvent(ctx));
      return;
  }
}
