import { describe, expect, it } from 'vitest';
import { codex } from '../src/codex';
import {
  festivalOn, FRIENDSHIP, migrateRun, NIGHT_SHIFT_DAY, previewBrew, RUN_VERSION, tierStep, VIGIL, VIGIL_DATE, WEEKS, type Calendar, type RunState, type Season,
} from '../src/core';
import { EFFECTS, type ScoreCtx } from '../src/core/effects';
import { brewing, no, ofType, ok, slotAll, start, withHand } from './helpers';

const clear: Calendar = { weather: Array.from({ length: WEEKS }, () => Array.from({ length: NIGHT_SHIFT_DAY }, () => 'clear' as const)), sky: null };

/** A run on the vigil's day (or another), shop open, with this Friendship from the profile. */
function day(season: Season = 'winter', friends: Record<string, number> = {}, week: number = VIGIL_DATE.week, d: number = VIGIL_DATE.day): RunState {
  let s = { ...start('vigil', season), calendar: clear };
  s = ok(s, { type: 'debug', op: 'jumpToDay', week, day: d }).state;
  s = { ...s, friendshipBase: { ...s.friendshipBase, ...friends } };
  return ok(s, { type: 'openShop' }).state;
}

/** Close on the vigil's day, with no orders left open. */
function vigil(friends: Record<string, number> = {}): RunState {
  const s = day('winter', friends);
  return ok({ ...s, orders: [] }, { type: 'endDay' }).state;
}

/** Choose a blessing by id and walk on to the finale's Night Shift. */
function finale(blessing: string | null): RunState {
  let s = vigil();
  if (s.offer?.kind !== 'vigil') throw new Error('expected the vigil');
  if (blessing) s = { ...s, offer: { ...s.offer, blessings: [blessing] } };
  s = ok(s, { type: 'chooseBlessing', index: 0 }).state;
  s = ok(s, { type: 'leaveErrand' }).state;
  return ok(s, { type: 'openShop' }).state;
}

describe('the Longest Night vigil', () => {
  it('is Winter\'s festival, on the eve of the finale', () => {
    expect(VIGIL_DATE).toEqual({ week: WEEKS, day: NIGHT_SHIFT_DAY - 1 });
    expect(festivalOn({ season: 'winter' }, VIGIL_DATE.week, VIGIL_DATE.day)).toBe('longest-night');
    expect(festivalOn({ season: 'winter' }, 2, 3)).toBeNull();
    expect(festivalOn({ season: 'spring' }, VIGIL_DATE.week, VIGIL_DATE.day)).toBeNull();
  });

  it('replaces the reward and the errand after closing', () => {
    const r = ok({ ...day(), orders: [] }, { type: 'endDay' });
    expect(r.state.offer?.kind).toBe('vigil');
    expect(ofType(r.events, 'vigilOpened')).toHaveLength(1);
    // Other seasons close that day as usual.
    expect(ok({ ...day('spring'), orders: [] }, { type: 'endDay' }).state.offer?.kind).toBe('reward');
  });

  it('brings a gift from each regular at Friendship 2 or more, into the Night Satchel', () => {
    const at2 = FRIENDSHIP.levels[FRIENDSHIP.vigilLevel - 1]!;
    const s = vigil({ 'old-tobin': at2, 'sister-alder': at2 + 20, 'bea-thornwick': at2 - 1 });
    if (s.offer?.kind !== 'vigil') throw new Error('expected the vigil');
    expect(s.offer.gifts.map((g) => g.regular).sort()).toEqual(['old-tobin', 'sister-alder']);
    for (const g of s.offer.gifts) {
      expect(VIGIL.gifts).toContain(g.card);
      expect(s.satchel.some((c) => c.card === g.card)).toBe(true);
    }
    const alone = vigil();
    expect(alone.offer?.kind === 'vigil' && alone.offer.gifts).toEqual([]);
  });

  it('offers three blessings; one is chosen, then you can head home', () => {
    let s = vigil();
    if (s.offer?.kind !== 'vigil') throw new Error('expected the vigil');
    expect(s.offer.blessings).toHaveLength(VIGIL.blessingsOffered);
    expect(no(s, { type: 'leaveErrand' })).toMatch(/blessing/);
    const id = s.offer.blessings[1]!;
    s = ok(s, { type: 'chooseBlessing', index: 1 }).state;
    expect(s.blessing).toBe(id);
    expect(no(s, { type: 'chooseBlessing', index: 0 })).toMatch(/already/);
    s = ok(s, { type: 'leaveErrand' }).state;
    expect([s.week, s.day]).toEqual([WEEKS, NIGHT_SHIFT_DAY]);
  });

  it('Hearthfire, Warm Hands and The Long Watch on the finale night', () => {
    const plain = finale(null);
    expect(finale('hearthfire').brewsLeft).toBe(plain.brewsLeft + VIGIL.hearthfireBrews);
    expect(finale('warm-hands').discardsLeft).toBe(plain.discardsLeft + VIGIL.warmHandsDiscards);
    expect(finale('the-long-watch').hand.length).toBe(Math.min(plain.hand.length + VIGIL.longWatchDraw, plain.hand.length + plain.drawPile.length));
  });

  it('Old Songs adds Harmony to every brew that night', () => {
    const harmony = (blessing: string | null) => {
      const [h, uids] = withHand(finale(blessing), ['elmroot', 'creekwater']);
      const s = slotAll(h, uids);
      const p = previewBrew(s, s.cauldron, s.hand);
      return p.kind === 'potion' ? p.harmony : 0;
    };
    expect(harmony('old-songs') - harmony('hearthfire')).toBe(VIGIL.oldSongsHarmony);
  });

  it('Starlight lowers the Moonless Patron\'s last order by a tier', () => {
    const patronTiers = (s: RunState) => s.orders.filter((o) => o.customer === 'moonless-patron').map((o) => o.minTier);
    const plain = patronTiers(finale('hearthfire'));
    const eased = patronTiers(finale('starlight'));
    expect(eased.slice(0, -1)).toEqual(plain.slice(0, -1));
    expect(eased.at(-1)).toBe(tierStep(plain.at(-1)!, -1));
  });

  it('Candle in the Window lowers the Moonless Patron\'s first order by a tier (Jacob, Oct 21)', () => {
    const patronTiers = (s: RunState) => s.orders.filter((o) => o.customer === 'moonless-patron').map((o) => o.minTier);
    const plain = patronTiers(finale('hearthfire'));
    const lit = finale('candle-in-the-window');
    expect(lit.blessing).toBe('candle-in-the-window');
    const eased = patronTiers(lit);
    expect(eased).toHaveLength(3);
    expect(eased[0]).toBe(tierStep(plain[0]!, -1));
    expect(eased.slice(1)).toEqual(plain.slice(1));
    expect(codex.blessings.get('candle-in-the-window')!.text).toMatch(/first order/);
  });
});

describe('the Winter gifts', () => {
  it('Roast Chestnuts and Holly Sprig help on Night Shifts only', () => {
    const run = (id: string, night: boolean) => {
      const c = { potency: 0, harmony: 0, night } as unknown as ScoreCtx;
      EFFECTS[id]!.onScore!(c);
      return [c.potency, c.harmony];
    };
    expect(run('harmony-2-on-night-shift', true)).toEqual([0, 2]);
    expect(run('harmony-2-on-night-shift', false)).toEqual([0, 0]);
    expect(run('potency-2-on-night-shift', true)).toEqual([2, 0]);
  });

  it('Gingerbread and Wool Mittens', () => {
    const [s, [ginger, mittens]] = withHand(brewing('vigil'), ['gingerbread', 'wool-mittens']);
    let r = ok(s, { type: 'playTincture', uid: ginger! }).state;
    expect(r.pending.harmony).toBe(2);
    expect(r.hand).toHaveLength(2);
    r = ok(r, { type: 'playTincture', uid: mittens! }).state;
    expect(r.discardsLeft).toBe(s.discardsLeft + 1);
  });

  it('every gift is festival-only', () => {
    for (const id of VIGIL.gifts) expect((codex.ingredients.get(id) ?? codex.tinctures.get(id))?.pool, id).toBe('event');
  });
});

describe('saves', () => {
  it('a version 16 run gains no blessing', () => {
    const old: Record<string, unknown> = { ...brewing('migrate'), version: 16 };
    delete old.blessing;
    expect(migrateRun(old)).toMatchObject({ version: RUN_VERSION, blessing: null });
  });
});

describe('the vigil at Friendship 8 (GDD §13)', () => {
  it('a regular at Friendship 8 brings their own gift; others still bring a pool gift', () => {
    const at8 = FRIENDSHIP.levels[FRIENDSHIP.vigilGiftLevel - 1]!;
    const s = vigil({ 'old-tobin': at8, 'sister-alder': at8 - 1 });
    if (s.offer?.kind !== 'vigil') throw new Error('expected the vigil');
    const by = Object.fromEntries(s.offer.gifts.map((g) => [g.regular, g.card]));
    expect(by['old-tobin']).toBe(codex.regulars.get('old-tobin')!.vigilGift);
    expect(VIGIL.gifts).toContain(by['sister-alder']);
    expect(s.satchel.some((c) => c.card === 'lantern-coal')).toBe(true);
  });

  it('Gilded Coin and Shrine Candle each add a Brew; the Coin pays 2 gold', () => {
    const [h, uids] = withHand(brewing('gifts'), ['gilded-coin', 'shrine-candle']);
    const coin = ok(h, { type: 'playTincture', uid: uids[0]! }).state;
    expect(coin.brewsLeft).toBe(h.brewsLeft + 1);
    expect(coin.gold).toBe(h.gold + 2);
    expect(ok(coin, { type: 'playTincture', uid: uids[1]! }).state.brewsLeft).toBe(h.brewsLeft + 2);
  });
});
