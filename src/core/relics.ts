import { codex } from '../codex';
import type { Ingredient } from '../codex/schema';
import { changeGold, pick, reject, type Ctx } from './ctx';
import { isSatchelCard } from './night';
import { RELIC_FALLBACK_GOLD, rarityWeights, rentDue, type ShopRarity } from './rules';
import type { RunState } from './state';

// Relics and curses (GDD §9). Relics are run-long passives with no slot limit, earned from patrons,
// the Name-Taker, the Black Market and The World. Curses are run debuffs taken at the Name-Taker;
// the Sleepless Miller and the Hearth lift the oldest one.

/** Numbers for each relic, by what it changes. */
export const RELIC_RULES = {
  ladleHarmony: 1,
  sealRent: 0.9,
  horseshoeCards: 1,
  flowerPotency: 2,
  ledgerGold: 1,
  bellHearts: 1,
  almanacDiscards: 1,
  satchelHand: 1,
  locketBrews: 1,
} as const;

export const CURSE_RULES = {
  leakyShelf: 1,
  sourLuckCards: 1,
  moonsickPotency: -2,
  heavyDiscards: 1,
  debtRent: 1.15,
} as const;

type Held = Pick<RunState, 'relics' | 'curses'>;

export const hasRelic = (s: Partial<Held>, id: string) => s.relics?.includes(id) ?? false;
export const hasCurse = (s: Partial<Held>, id: string) => s.curses?.includes(id) ?? false;

/** Relics in this run's pool (the starters, plus any the Almanac unlocked) you don't hold, of this tier if given. */
export function relicPool(s: Held & Pick<RunState, 'unlocks'>, tier?: number): string[] {
  return [...codex.relics.values()]
    .filter((r) => (r.pool === 'base' || s.unlocks.includes(r.id)) && !s.relics.includes(r.id) && (tier === undefined || r.tier === tier))
    .map((r) => r.id);
}

/** Curses you haven't taken. */
export function cursePool(s: Held): string[] {
  return [...codex.curses.keys()].filter((id) => !s.curses.includes(id));
}

/** A relic of this tier you don't hold, else the nearest tier that has one (lower first), else null. */
export function rollRelic(ctx: Ctx, tier: number, exclude: readonly string[] = []): string | null {
  for (const t of [tier, tier - 1, tier + 1, tier - 2, tier + 2]) {
    if (t < 1 || t > 3) continue;
    const pool = relicPool(ctx.s, t).filter((id) => !exclude.includes(id));
    if (pool.length) return pick(ctx, pool);
  }
  return null;
}

export function gainRelic(ctx: Ctx, id: string, source: string): void {
  const s = ctx.s;
  if (!codex.relics.has(id)) reject(`unknown relic ${id}`);
  if (s.relics.includes(id)) reject(`you already have the ${codex.relics.get(id)!.name}`);
  s.relics.push(id);
  if (id === 'spare-satchel') s.handSize += RELIC_RULES.satchelHand;
  ctx.ev.push({ type: 'relicGained', relic: id, source });
}

/** A relic reward: a random one of this tier, or gold if you already hold every relic. */
export function grantRelic(ctx: Ctx, tier: number, source: string): void {
  const id = rollRelic(ctx, tier);
  if (id) gainRelic(ctx, id, source);
  else changeGold(ctx, RELIC_FALLBACK_GOLD[tier] ?? 0, source);
}

export function takeCurse(ctx: Ctx, id: string): void {
  const s = ctx.s;
  if (!codex.curses.has(id)) reject(`unknown curse ${id}`);
  if (s.curses.includes(id)) reject(`you already carry ${codex.curses.get(id)!.name}`);
  s.curses.push(id);
  if (id === 'leaky-roof') s.shelfSize = Math.max(1, s.shelfSize - CURSE_RULES.leakyShelf);
  ctx.ev.push({ type: 'curseTaken', curse: id });
}

/** Lift a Curse (the oldest unless named). Returns false when there is none to lift. */
export function liftCurse(ctx: Ctx, by: string, id?: string): boolean {
  const s = ctx.s;
  const curse = id ?? s.curses[0];
  if (!curse || !s.curses.includes(curse)) return false;
  s.curses.splice(s.curses.indexOf(curse), 1);
  if (curse === 'leaky-roof') s.shelfSize += CURSE_RULES.leakyShelf;
  ctx.ev.push({ type: 'curseLifted', curse, by });
  return true;
}

/** This week's rent with the Guild Seal and Unpaid Debt. */
export function rentOf(s: Pick<RunState, 'season' | 'week'> & Partial<Held>, week = s.week): number {
  const mult = (hasRelic(s, 'guild-seal') ? RELIC_RULES.sealRent : 1) * (hasCurse(s, 'unpaid-debt') ? CURSE_RULES.debtRent : 1);
  return Math.round(rentDue(s.season, week) * mult);
}

/** Cards a reward pick offers: 3, 4 with the Lucky Horseshoe, 2 with Sour Luck. */
export function rewardCount(s: Held): number {
  return 3 + (hasRelic(s, 'lucky-horseshoe') ? RELIC_RULES.horseshoeCards : 0) - (hasCurse(s, 'sour-luck') ? CURSE_RULES.sourLuckCards : 0);
}

/** Reward rarity weights: Sour Luck turns off skip pity. */
export function rewardWeights(s: Held & Pick<RunState, 'skipStreak'>): [ShopRarity, number][] {
  return rarityWeights(hasCurse(s, 'sour-luck') ? 0 : s.skipStreak);
}

/** Brews and Discards a day starts with, after relics and curses. */
export function dayAllowance(s: Held, base: { brews: number; discards: number }, night: boolean, weather: string): { brews: number; discards: number } {
  let { brews, discards } = base;
  if (night && hasRelic(s, 'moon-locket')) brews += RELIC_RULES.locketBrews;
  if ((weather === 'rain' || weather === 'fog') && hasRelic(s, 'old-almanac')) discards += RELIC_RULES.almanacDiscards;
  if (hasCurse(s, 'heavy-hands')) discards = Math.max(0, discards - CURSE_RULES.heavyDiscards);
  return { brews, discards };
}

export type RelicStep = { potency: number; harmony: number; note: string };

/** Relic and curse changes to a brew's score, after the ingredients (GDD §6.3). */
export function relicSteps(s: Partial<Held>, raw: readonly Ingredient[]): { id: string; source: 'relic' | 'curse'; step: RelicStep }[] {
  const out: { id: string; source: 'relic' | 'curse'; step: RelicStep }[] = [];
  if (hasRelic(s, 'pressed-flower')) {
    const k = raw.filter((i) => i.tags.includes('flower')).length;
    const n = k * RELIC_RULES.flowerPotency;
    if (n) out.push({ id: 'pressed-flower', source: 'relic', step: { potency: n, harmony: 0, note: `+${n} Potency (Flower)` } });
  }
  if (hasRelic(s, 'copper-ladle') && raw.length === 3) {
    out.push({ id: 'copper-ladle', source: 'relic', step: { potency: 0, harmony: RELIC_RULES.ladleHarmony, note: `+${RELIC_RULES.ladleHarmony} Harmony (three ingredients)` } });
  }
  if (hasCurse(s, 'moonsick')) {
    const k = raw.filter((i) => isSatchelCard(i.id)).length;
    const n = k * CURSE_RULES.moonsickPotency;
    if (n) out.push({ id: 'moonsick', source: 'curse', step: { potency: n, harmony: 0, note: `${n} Potency (Satchel cards)` } });
  }
  return out;
}
