import { codex } from '../codex';
import type { Commission } from '../codex/schema';
import { changeGold, reject, shuffled, type Ctx } from './ctx';
import { queueGift, rarityPool } from './night';
import { grantRelic } from './relics';
import { NIGHT_SHIFT_DAY } from './calendar';
import { COMMISSIONS, tierIndex, WEEKS } from './rules';
import type { ActiveCommission, Order, Potion, RunState } from './state';

// Guild Commissions (GDD §7): goals taken at the Guild Hall, due by a Night Shift. Each goal counts
// one kind of thing (a delivery, a brew, or how a day ended) toward its target.

type Delivered = { potion: Potion; order: Order };
type Brewed = { potion: Omit<Potion, 'uid'>; copies: number };

type Goal = { target: number } & (
  | { on: 'deliver'; counts: (d: Delivered) => boolean }
  | { on: 'brew'; counts: (b: Brewed) => number }
  | { on: 'day-end'; met: (s: RunState) => boolean }
);

const atLeast = (tier: Potion['tier'], min: Potion['tier']) => tierIndex(tier) >= tierIndex(min);
const hasUmbra = (p: Pick<Potion, 'ingredients'>) => p.ingredients.some((id) => codex.ingredients.get(id)?.essences.includes('umbra'));

export const COMMISSION_GOALS: Record<string, Goal> = {
  'calm-the-shrine': { target: 3, on: 'deliver', counts: ({ potion }) => potion.family === 'calming' && atLeast(potion.tier, 'superb') },
  'miners-mend': { target: 3, on: 'deliver', counts: ({ potion }) => potion.family === 'healing' || potion.family === 'protection' },
  'bakers-dozen': { target: 6, on: 'brew', counts: ({ potion, copies }) => (potion.family === 'warming' ? copies : 0) },
  'full-shelf': { target: 1, on: 'day-end', met: (s) => s.shelf.length >= s.shelfSize },
  'no-shadows': { target: 5, on: 'deliver', counts: ({ potion }) => !hasUmbra(potion) },
  'three-of-a-kind': { target: 4, on: 'brew', counts: ({ potion }) => (potion.ingredients.length === 3 ? 1 : 0) },
  'masters-proof': { target: 1, on: 'brew', counts: ({ potion }) => (atLeast(potion.tier, 'masterwork') ? 1 : 0) },
  'full-moon-favour': { target: 3, on: 'deliver', counts: ({ potion }) => potion.family === 'calming' && atLeast(potion.tier, 'superb') },
  // Counted by the customers list, not a test.
  'the-whole-town': { target: 5, on: 'deliver', counts: () => false },
  'night-owl': { target: 1, on: 'day-end', met: (s) => s.day === NIGHT_SHIFT_DAY && s.orders.length > 0 && s.orders.every((o) => o.status === 'filled') },
};

export function goalOf(id: string): Goal {
  const g = COMMISSION_GOALS[id];
  if (!g) throw new Error(`commission ${id} has no goal`);
  return g;
}

/** Commissions the Guild could offer this week: in their weeks, not already held, still possible to finish. */
export function commissionPool(s: Pick<RunState, 'week' | 'commissions'>): Commission[] {
  return [...codex.commissions.values()].filter(
    (c) => s.week >= c.minWeek && s.week <= c.maxWeek && !s.commissions.some((a) => a.id === c.id) && (c.dueWeek ?? s.week) >= s.week,
  );
}

/** The Guild Hall is only worth offering with a commission to give and room to take it. */
export function guildOpen(s: Pick<RunState, 'week' | 'commissions'>): boolean {
  return s.commissions.length < COMMISSIONS.max && commissionPool(s).length > 0;
}

export function offerCommissions(ctx: Ctx): string[] {
  return shuffled(ctx, commissionPool(ctx.s)).slice(0, COMMISSIONS.offered).map((c) => c.id);
}

/**
 * The week whose Night Shift a commission is due by. Its deadline counts this week only when taken by
 * day 2's dusk, so a commission always has at least two days and a Night Shift to work on.
 */
export function dueWeekOf(s: Pick<RunState, 'week' | 'day'>, c: Commission): number {
  if (c.dueWeek) return c.dueWeek;
  const from = s.day > COMMISSIONS.lastDayThisWeek ? s.week + 1 : s.week;
  return Math.min(WEEKS, from + c.deadline - 1);
}

export function takeCommission(ctx: Ctx, index: number): void {
  const s = ctx.s;
  const offer = s.offer;
  if (offer?.kind !== 'guild') reject('you are not at the Guild Hall');
  if (offer.taken) reject('the Guild gives one commission a visit');
  if (s.commissions.length >= COMMISSIONS.max) reject(`you can hold ${COMMISSIONS.max} commissions at once`);
  const id = offer.options[index];
  if (!id) reject(`no commission ${index}`);
  const c = codex.commissions.get(id)!;
  const dueWeek = dueWeekOf(s, c);
  s.commissions.push({ id, progress: 0, dueWeek, customers: [] });
  offer.taken = true;
  ctx.ev.push({ type: 'commissionTaken', commission: id, dueWeek });
}

function advance(ctx: Ctx, a: ActiveCommission, by: number): void {
  if (by <= 0) return;
  const target = goalOf(a.id).target;
  a.progress = Math.min(target, a.progress + by);
  ctx.ev.push({ type: 'commissionProgress', commission: a.id, progress: a.progress, target });
  if (a.progress >= target) complete(ctx, a);
}

function complete(ctx: Ctx, a: ActiveCommission): void {
  const s = ctx.s;
  s.commissions.splice(s.commissions.indexOf(a), 1);
  ctx.ev.push({ type: 'commissionDone', commission: a.id });
  const r = codex.commissions.get(a.id)!.reward;
  if (r.kind === 'gold') changeGold(ctx, r.amount, 'commission');
  else if (r.kind === 'relic') grantRelic(ctx, r.tier, 'commission');
  else queueGift(ctx, 'commission', rarityPool(s, r.rarity), r.count, 'deck');
}

/** A potion was delivered (each one of a multi-potion order counts). */
export function commissionsOnDeliver(ctx: Ctx, potion: Potion, order: Order): void {
  for (const a of [...ctx.s.commissions]) {
    const g = goalOf(a.id);
    if (g.on !== 'deliver') continue;
    if (a.id === 'the-whole-town') {
      if (a.customers.includes(order.customer)) continue;
      a.customers.push(order.customer);
      advance(ctx, a, 1);
    } else if (g.counts({ potion, order })) {
      advance(ctx, a, 1);
    }
  }
}

/** A brew made potions (`copies` of them). */
export function commissionsOnBrew(ctx: Ctx, potion: Omit<Potion, 'uid'>, copies: number): void {
  for (const a of [...ctx.s.commissions]) {
    const g = goalOf(a.id);
    if (g.on === 'brew') advance(ctx, a, g.counts({ potion, copies }));
  }
}

/** The day ended: goals about how it ended, then commissions due tonight that weren't done lapse. */
export function commissionsOnDayEnd(ctx: Ctx, nightShift: boolean): void {
  const s = ctx.s;
  for (const a of [...s.commissions]) {
    const g = goalOf(a.id);
    if (g.on === 'day-end' && g.met(s)) advance(ctx, a, g.target);
  }
  if (!nightShift) return;
  for (const a of [...s.commissions]) {
    if (a.dueWeek > s.week) continue;
    s.commissions.splice(s.commissions.indexOf(a), 1);
    ctx.ev.push({ type: 'commissionFailed', commission: a.id });
  }
}
