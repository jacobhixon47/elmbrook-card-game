import { codex } from '../codex';
import { pick, pickWeighted, shuffled, type Ctx } from './ctx';
import {
  CARD_PRICE, CAULDRON_SLOT_PRICE, FORAGE_CARDS, FORAGE_PICKS, MARKET_CARDS, MAX_CAULDRON_SLOTS, MAX_SHELF_SLOTS,
  rarityWeights, SHELF_SLOT_PRICE, type ShopRarity,
} from './rules';
import type { Errand, StockItem } from './state';

type PoolCard = { id: string; rarity: ShopRarity; wychwood: boolean };

/** Cards that rewards and the Market can offer: no Lunar cards (those come from the night, M3). */
function dayPool(): PoolCard[] {
  const out: PoolCard[] = [];
  for (const i of codex.ingredients.values()) {
    if (!i.nightOnly && i.rarity !== 'lunar') out.push({ id: i.id, rarity: i.rarity, wychwood: i.origin === 'wychwood' });
  }
  for (const t of codex.tinctures.values()) {
    if (t.rarity !== 'lunar') out.push({ id: t.id, rarity: t.rarity, wychwood: false });
  }
  return out;
}

export function rarityOf(cardId: string): ShopRarity {
  const r = codex.ingredients.get(cardId)?.rarity ?? codex.tinctures.get(cardId)?.rarity ?? 'common';
  return r === 'lunar' ? 'rare' : r;
}

/** n distinct cards, each rolled by rarity first, then uniformly within that rarity. */
function rollCards(ctx: Ctx, n: number, weights: [ShopRarity, number][]): string[] {
  const pool = dayPool();
  const out: string[] = [];
  while (out.length < n && out.length < pool.length) {
    const rarity = pickWeighted(ctx, weights);
    const left = pool.filter((c) => !out.includes(c.id));
    const ofRarity = left.filter((c) => c.rarity === rarity);
    const from = ofRarity.length ? ofRarity : left;
    out.push(pick(ctx, from).id);
  }
  return out;
}

export function offerReward(ctx: Ctx): void {
  const cards = rollCards(ctx, 3, rarityWeights(ctx.s.skipStreak));
  ctx.s.offer = { kind: 'reward', cards };
  ctx.ev.push({ type: 'rewardOffered', cards });
}

const ERRANDS: readonly Errand[] = ['market', 'forage', 'hearth'];

export function offerErrands(ctx: Ctx): void {
  const options = shuffled(ctx, ERRANDS).slice(0, 2);
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
      if (s.cauldronSlots < MAX_CAULDRON_SLOTS) stock.push({ kind: 'cauldron-slot', price: CAULDRON_SLOT_PRICE, sold: false });
      if (s.shelfSize < MAX_SHELF_SLOTS) stock.push({ kind: 'shelf-slot', price: SHELF_SLOT_PRICE, sold: false });
      s.offer = { kind: 'market', stock };
      return;
    }
    case 'forage': {
      // Wychwood ingredients are three times as likely; every card is free.
      const pool = dayPool().filter((c) => codex.ingredients.has(c.id));
      const cards: string[] = [];
      while (cards.length < FORAGE_CARDS && cards.length < pool.length) {
        const left = pool.filter((c) => !cards.includes(c.id));
        cards.push(pickWeighted(ctx, left.map((c) => [c.id, c.wychwood ? 3 : 1] as const)));
      }
      s.offer = { kind: 'forage', cards, picksLeft: FORAGE_PICKS };
      return;
    }
    case 'hearth':
      s.offer = { kind: 'hearth', removed: false };
      return;
  }
}
