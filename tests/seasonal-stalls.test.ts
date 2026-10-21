import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  allCards, CIDER_PRESS, hearthOffers, commonCards, FIREFLY_GAMES, FRIENDSHIP, HARVEST_AUCTION, MIN_DECK, NIGHT_SHIFT_DAY, reduce,
  type Potion, type RunState, type Season, type StallId, type StallState, type Tier,
} from '../src/core';
import { no, ofType, ok, start } from './helpers';

/** A run on the Night Market's street after week `week`'s Night Shift, in a season. */
function market(season: Season, week = 2, opts: { seed?: string; gold?: number; shelf?: Potion[] } = {}): RunState {
  let s = start(opts.seed ?? 'seasonal', season);
  s = ok(s, { type: 'debug', op: 'jumpToDay', week, day: NIGHT_SHIFT_DAY }).state;
  s = ok(ok(ok(s, { type: 'openShop' }).state, { type: 'endDay' }).state, { type: 'skipReward' }).state;
  while (s.offer?.kind === 'gift') s = ok(s, { type: 'passGift' }).state;
  return { ...s, ...(opts.gold === undefined ? {} : { gold: opts.gold }), ...(opts.shelf ? { shelf: opts.shelf } : {}) };
}

const stalls = (s: RunState): StallState[] => (s.offer?.kind === 'night-market' ? s.offer.stalls : []);
const ids = (s: RunState) => stalls(s).map((x) => x.id);
const at = <K extends StallId>(s: RunState, id: K) => stalls(s).find((x) => x.id === id) as StallState & { id: K };
const visit = (s: RunState, id: StallId) => ok(s, { type: 'visitStall', index: ids(s).indexOf(id) }).state;
const potion = (uid: number, tier: Tier, quality = 10): Potion => ({ uid, recipe: 'healing-draught', family: 'healing', quality, tier, ingredients: [], experiment: false, heartDelta: 0 });

describe('seasonal stalls', () => {
  it('every season but Winter has two, and Winter has the Hearth Trader', () => {
    const by = (season: Season) => [...codex.stalls.values()].filter((x) => x.season === season).map((x) => x.id);
    expect(by('spring')).toEqual(['seed-swapper', 'blossom-oracle']);
    expect(by('summer')).toEqual(['firefly-games', 'nectar-trader']);
    expect(by('autumn')).toEqual(['cider-press', 'harvest-auction']);
    expect(by('winter')).toEqual(['hearth-trader']);
  });

  it('join the full moon in their own season only, and are drawn on quarter nights', () => {
    expect(ids(market('summer'))).toEqual(expect.arrayContaining(['firefly-games', 'nectar-trader']));
    expect(ids(market('summer'))).not.toContain('seed-swapper');
    expect(ids(market('autumn'))).toEqual(expect.arrayContaining(['cider-press', 'harvest-auction']));
    expect(ids(market('winter'))).toContain('hearth-trader');
    const drawn = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((seed) => ids(market('autumn', 1, { seed }))[2]!));
    expect([...drawn].some((id) => codex.stalls.get(id)!.season === 'autumn')).toBe(true);
  });
});

describe('the Seed Swapper', () => {
  it('takes two Common cards and 5 gold for an Uncommon of your choice, once a night', () => {
    let s = visit(market('spring', 2, { gold: 12 }), 'seed-swapper');
    const offer = at(s, 'seed-swapper');
    expect(offer.cards).toHaveLength(3);
    expect(offer.cards.every((c) => (codex.ingredients.get(c) ?? codex.tinctures.get(c))!.rarity === 'uncommon')).toBe(true);
    const give = commonCards(s).slice(0, 2).map((c) => c.uid);
    const size = allCards(s).length;
    expect(no(s, { type: 'seedSwap', index: 0, uids: [give[0]!] })).toMatch(/pick 2/);
    const r = ok(s, { type: 'seedSwap', index: 1, uids: give });
    s = r.state;
    expect(s.gold).toBe(7);
    expect(allCards(s)).toHaveLength(size - 1);
    expect(allCards(s).some((c) => c.card === offer.cards[1])).toBe(true);
    expect(ofType(r.events, 'cardRemoved')).toHaveLength(2);
    expect(no(s, { type: 'seedSwap', index: 0, uids: commonCards(s).slice(0, 2).map((c) => c.uid) })).toMatch(/no card/);
    const poor = visit(market('spring', 2, { gold: 4 }), 'seed-swapper');
    expect(no(poor, { type: 'seedSwap', index: 0, uids: give })).toMatch(/gold/);
  });

  it("won't take an Uncommon card, or shrink the deck below the minimum", () => {
    const s = visit(market('spring', 2, { gold: 12 }), 'seed-swapper');
    const notCommon = allCards(s).find((c) => !commonCards(s).includes(c));
    if (notCommon) expect(no(s, { type: 'seedSwap', index: 0, uids: [notCommon.uid, commonCards(s)[0]!.uid] })).toMatch(/pick 2/);
    const small = structuredClone(s);
    small.drawPile = small.drawPile.slice(0, Math.max(0, MIN_DECK - small.hand.length - small.discardPile.length));
    while (allCards(small).length > MIN_DECK) small.hand.pop();
    const uids = commonCards(small).slice(0, 2).map((c) => c.uid);
    expect(no(small, { type: 'seedSwap', index: 0, uids })).toMatch(/below/);
  });
});

describe('the Blossom Oracle', () => {
  it("rolls next week's weather again for 4 gold, once a night", () => {
    let s = visit(market('spring', 2, { gold: 10 }), 'blossom-oracle');
    const r = ok(s, { type: 'readPetals' });
    s = r.state;
    expect(s.gold).toBe(6);
    const [read] = ofType(r.events, 'weatherRead');
    expect(read!.week).toBe(3);
    expect(s.calendar.weather[2]!.slice(0, 4)).toEqual(read!.weather);
    expect(read!.weather.every((w) => ['clear', 'rain', 'fog'].includes(w))).toBe(true);
    expect(no(s, { type: 'readPetals' })).toMatch(/once/);
    expect(no(visit(market('spring', 2, { gold: 3 }), 'blossom-oracle'), { type: 'readPetals' })).toMatch(/gold/);
  });
});

describe('Firefly Games', () => {
  it('a toss costs 3 gold and wins a familiar pick or a card', () => {
    let s = visit(market('summer', 2, { gold: 60 }), 'firefly-games');
    let won = 0;
    for (let i = 0; i < 12; i++) {
      const before = allCards(s).length;
      const r = ok(s, { type: 'tossRing' });
      s = r.state;
      const stall = at(s, 'firefly-games');
      if (stall.prizes.length) {
        won++;
        expect(stall.prizes).toHaveLength(FIREFLY_GAMES.prizes);
        expect(no(s, { type: 'tossRing' })).toMatch(/prize/);
        s = ok(s, { type: 'takePrize', index: 0 }).state;
        expect(s.familiars).toContain(stall.prizes[0]);
      } else {
        expect(allCards(s)).toHaveLength(before + 1);
      }
      if (s.gold < FIREFLY_GAMES.price) break;
    }
    expect(at(s, 'firefly-games').tosses).toBeGreaterThan(1);
    expect(won).toBeGreaterThan(0);
  });

  it('a win with every familiar slot taken is an Uncommon card instead', () => {
    let s = visit(market('summer', 2, { gold: 300 }), 'firefly-games');
    s = { ...s, familiars: [...codex.familiars.keys()].slice(0, s.familiarSlots) };
    for (let i = 0; i < 20; i++) {
      const r = ok(s, { type: 'tossRing' });
      s = r.state;
      const [toss] = ofType(r.events, 'ringTossed');
      expect(at(s, 'firefly-games').prizes).toEqual([]);
      if (toss!.won) return expect(codex.ingredients.get(toss!.card!)?.rarity ?? codex.tinctures.get(toss!.card!)?.rarity).toBe('uncommon');
    }
    throw new Error('no toss won in 20');
  });
});

describe('the Nectar Trader', () => {
  it('takes your lowest Superb-or-better potion for a Rare card', () => {
    const shelf = [potion(901, 'fine'), potion(902, 'masterwork', 120), potion(903, 'superb', 40)];
    let s = visit(market('summer', 2, { shelf }), 'nectar-trader');
    const card = at(s, 'nectar-trader').cards[2]!;
    // A Rare day card: an ingredient or a Tincture.
    expect((codex.ingredients.get(card) ?? codex.tinctures.get(card))!.rarity).toBe('rare');
    s = ok(s, { type: 'tradeNectar', index: 2 }).state;
    expect(s.shelf.map((p) => p.uid)).toEqual([901, 902]);
    expect(allCards(s).some((c) => c.card === card)).toBe(true);
    expect(no(s, { type: 'tradeNectar', index: 0 })).toMatch(/no card/);
    expect(no(visit(market('summer', 2, { shelf: [potion(901, 'fine')] }), 'nectar-trader'), { type: 'tradeNectar', index: 0 })).toMatch(/Superb/);
  });
});

describe('the Cider Press', () => {
  it('presses your lowest potions into +2 Potency, up to three a night', () => {
    const shelf = [potion(901, 'superb', 40), potion(902, 'fine', 12), potion(903, 'fine', 15), potion(904, 'crude', 2)];
    let s = visit(market('autumn', 2, { shelf }), 'cider-press');
    const card = allCards(s).find((c) => codex.ingredients.has(c.card))!;
    for (let i = 0; i < CIDER_PRESS.max; i++) s = ok(s, { type: 'pressCider', uid: card.uid }).state;
    expect(allCards(s).find((c) => c.uid === card.uid)!.bonus).toBe(CIDER_PRESS.potency * CIDER_PRESS.max);
    expect(s.shelf.map((p) => p.uid)).toEqual([901]);
    expect(no(s, { type: 'pressCider', uid: card.uid })).toMatch(/3 potions/);
    const tincture = allCards(s).find((c) => codex.tinctures.has(c.card));
    if (tincture) expect(no(visit(market('autumn', 2, { shelf }), 'cider-press'), { type: 'pressCider', uid: tincture.uid })).toMatch(/ingredients/);
    expect(no(visit(market('autumn', 2, { shelf: [] }), 'cider-press'), { type: 'pressCider', uid: card.uid })).toMatch(/empty/);
  });
});

describe('the Harvest Auction', () => {
  it('rolls a hidden rival bid of 12 to 24 for a tier 2 relic', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const stall = at(market('autumn', 2, { seed }), 'harvest-auction');
      expect(stall.rival).toBeGreaterThanOrEqual(HARVEST_AUCTION.rival[0]);
      expect(stall.rival).toBeLessThanOrEqual(HARVEST_AUCTION.rival[1]);
      expect(codex.relics.get(stall.relic!)!.tier).toBe(2);
    }
  });

  it('a bid at or over the rival wins and pays; a lower bid costs nothing; one bid a night', () => {
    const s = visit(market('autumn', 2, { gold: 30 }), 'harvest-auction');
    const { rival, relic } = at(s, 'harvest-auction');
    const top = ok(s, { type: 'placeBid', amount: 24 }).state;
    expect(top.gold).toBe(6);
    expect(top.relics).toContain(relic);
    expect(no(top, { type: 'placeBid', amount: 24 })).toMatch(/one bid/);
    const low = HARVEST_AUCTION.bids.find((b) => b < rival);
    if (low !== undefined) {
      const lost = ok(s, { type: 'placeBid', amount: low }).state;
      expect(lost.gold).toBe(30);
      expect(lost.relics).not.toContain(relic);
    }
    expect(no(s, { type: 'placeBid', amount: 13 })).toMatch(/bids are/);
    expect(no({ ...s, gold: 11 }, { type: 'placeBid', amount: 12 })).toMatch(/gold/);
  });
});

describe('the Hearth Trader', () => {
  const lv = (level: number) => FRIENDSHIP.levels[level - 1]!;

  it('trades gold, on the name of a regular at Friendship 2, for a Rare card or a familiar', () => {
    const base = visit(market('winter', 2, { gold: 20 }), 'hearth-trader');
    const stall = at(base, 'hearth-trader');
    expect(stall.cards).toHaveLength(FRIENDSHIP.traderBigCards);
    expect(stall.familiars).toHaveLength(FRIENDSHIP.traderFamiliars);
    const s = { ...base, friendshipBase: { 'old-tobin': lv(FRIENDSHIP.traderLevel) } };
    expect(no({ ...s, friendshipBase: { 'old-tobin': lv(FRIENDSHIP.traderLevel) - 1 } }, { type: 'hearthTrade', index: 0 })).toMatch(/Friendship level 2/);
    expect(no({ ...s, gold: FRIENDSHIP.traderGold - 1 }, { type: 'hearthTrade', index: 0 })).toMatch(/gold/);
    const card = ok(s, { type: 'hearthTrade', index: 1 }).state;
    expect(card.gold).toBe(s.gold - FRIENDSHIP.traderGold);
    expect(card.friendshipBase).toEqual(s.friendshipBase);
    expect(allCards(card).some((c) => c.card === stall.cards[1])).toBe(true);
    expect(no(card, { type: 'hearthTrade', index: 0 })).toMatch(/once/);
    // Two cards shown below level 6: index 2 is the familiar, not the third card.
    const fam = ok(s, { type: 'hearthTrade', index: FRIENDSHIP.traderCards }).state;
    expect(fam.familiars).toContain(stall.familiars[0]);
  });

  it('shows all three cards once a regular is at Friendship 6', () => {
    const base = visit(market('winter', 2, { gold: 20 }), 'hearth-trader');
    const stall = at(base, 'hearth-trader');
    const s = { ...base, friendshipBase: { 'old-tobin': lv(FRIENDSHIP.traderBigLevel) } };
    expect(hearthOffers(s, stall).cards).toEqual(stall.cards);
    expect(hearthOffers({ ...s, friendshipBase: { 'old-tobin': lv(FRIENDSHIP.traderBigLevel) - 1 } }, stall).cards).toEqual(stall.cards.slice(0, 2));
    const third = ok(s, { type: 'hearthTrade', index: 2 }).state;
    expect(allCards(third).some((c) => c.card === stall.cards[2])).toBe(true);
    // The Gardener counts like any regular.
    expect(hearthOffers({ ...s, friendshipBase: { 'the-gardener': lv(FRIENDSHIP.traderLevel) } }, stall).regular).toBe('the-gardener');
  });
});

it('the new trades reject away from their stall', () => {
  const s = market('summer', 2);
  for (const a of [{ type: 'tossRing' }, { type: 'readPetals' }, { type: 'placeBid', amount: 12 }, { type: 'pressCider', uid: 1 }] as const) {
    expect(reduce(s, a).events[0]!.type).toBe('rejected');
  }
});
