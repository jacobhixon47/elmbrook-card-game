import { codex, type Fair, type FairItem } from '../codex';
import { festivalOn } from './calendar';
import { shuffled, type Ctx } from './ctx';
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
