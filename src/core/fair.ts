import { codex, type Fair, type FairItem } from '../codex';
import { festivalOn, NIGHT_SHIFT_DAY } from './calendar';
import { reject, shuffled, type Ctx } from './ctx';
import { FRIENDSHIP, friendLevelOf } from './friendship';
import { VIGIL } from './rules';
import type { RunState, StockItem } from './state';

/** The fair in town after today's close, if today is festival day and the season has one (GDD §4.2). */
export function fairToday(s: Pick<RunState, 'season' | 'week' | 'day'>): Fair | null {
  const festival = festivalOn(s, s.week, s.day);
  return festival ? (codex.fairs.get(festival) ?? null) : null;
}

function stockItem(item: FairItem): StockItem {
  if ('card' in item) return { kind: 'card', card: item.card, price: item.price, sold: false };
  if ('familiar' in item) return { kind: 'familiar', familiar: item.familiar, price: item.price, sold: false };
  return { kind: 'relic', relic: item.relic, price: item.price, sold: false };
}

/** Familiars and relics you already have stay off the stalls. */
function owned(s: RunState, item: StockItem): boolean {
  return (item.kind === 'familiar' && s.familiars.includes(item.familiar)) || (item.kind === 'relic' && s.relics.includes(item.relic));
}

/** After closing on festival day the fair replaces the dusk reward and the errand. */
export function openFair(ctx: Ctx, fair: Fair): void {
  const s = ctx.s;
  const stalls = fair.stalls.map((st) => {
    const pool = st.stock.map(stockItem).filter((i) => !owned(s, i));
    // A stall with more stock than it shows sets out a different few each fair, kept in codex order.
    const stock = st.show !== undefined && st.show < pool.length
      ? shuffled(ctx, pool).slice(0, st.show).sort((a, b) => pool.indexOf(a) - pool.indexOf(b))
      : pool;
    return { id: st.id, stock };
  });
  s.offer = { kind: 'fair', fair: fair.id, stalls };
  ctx.ev.push({ type: 'fairOpened', fair: fair.id });
}

/** Whether tonight, after closing, is the Longest Night vigil (Winter, the eve of the finale). */
export function vigilToday(s: Pick<RunState, 'season' | 'week' | 'day'>): boolean {
  return festivalOn(s, s.week, s.day) === 'longest-night';
}

/** The regulars close enough to bring a gift to the vigil, in codex order. */
export function vigilGuests(s: Pick<RunState, 'friendship' | 'friendshipBase'>): string[] {
  return [...codex.regulars.keys()].filter((id) => friendLevelOf(s, id) >= FRIENDSHIP.vigilLevel);
}

/** The vigil replaces the dusk reward and the errand: gifts go straight into the Night Satchel for the finale. */
export function openVigil(ctx: Ctx): void {
  const s = ctx.s;
  const pool = shuffled(ctx, VIGIL.gifts);
  const gifts = vigilGuests(s).map((regular, i) => ({ regular, card: pool[i % pool.length]! }));
  for (const g of gifts) {
    const inst = { uid: s.nextUid++, card: g.card };
    s.satchel.push(inst);
    ctx.ev.push({ type: 'cardGained', card: g.card, uid: inst.uid, source: 'gift' });
  }
  const blessings = shuffled(ctx, [...codex.blessings.keys()]).slice(0, VIGIL.blessingsOffered);
  s.offer = { kind: 'vigil', gifts, blessings, chose: null };
  ctx.ev.push({ type: 'vigilOpened', gifts });
}

export function chooseBlessing(ctx: Ctx, index: number): void {
  const offer = ctx.s.offer;
  if (offer?.kind !== 'vigil') reject('there is no fire to sit by right now');
  if (offer.chose) reject('you already chose a blessing');
  const id = offer.blessings[index];
  if (!id) reject(`no blessing ${index}`);
  offer.chose = id;
  ctx.s.blessing = id;
  ctx.ev.push({ type: 'blessingChosen', blessing: id });
}

/** The vigil's blessing, when it acts: only on a Night Shift (the finale is the only one left after it). */
export function blessingTonight(s: Partial<Pick<RunState, 'blessing' | 'day'>>, id: string): boolean {
  return s.blessing === id && s.day === NIGHT_SHIFT_DAY;
}
