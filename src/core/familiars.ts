import { codex } from '../codex';
import type { Familiar, Ingredient } from '../codex/schema';
import { changeGold, pickWeighted, reject, type Ctx } from './ctx';
import { FAMILIAR_PRICE, FAMILIAR_SELL, type ShopRarity } from './rules';
import type { RunState } from './state';

// Familiars (GDD §11): passive helpers in up to 4 slots (5 with the Guild Hall perk). Scoring ones
// resolve after Tinctures, in slot order, so a flat bonus placed before a multiplier gets multiplied.

/** What a familiar sees of a brew. */
export type FamiliarBrew = {
  /** The ingredients as brewed (woven essences in), before any "counts as" rules. */
  ingredients: readonly Ingredient[];
  /** The first ingredient's Potency with its Infuse and Aged bonuses (the Hob). */
  firstPotency: number;
  shelf: number;
  night: boolean;
  firstBrew: boolean;
};

export type FamiliarStep = { potency: number; harmony: number; harmonyMult: number; note: string };

const count = (ings: readonly Ingredient[], test: (i: Ingredient) => boolean) => ings.filter(test).length;
const essence = (e: string) => (i: Ingredient) => i.essences.includes(e as never);

/** Flat Potency per matching ingredient. */
const potencyPer = (n: number, test: (i: Ingredient) => boolean, what: string) => (b: FamiliarBrew): FamiliarStep | null => {
  const k = count(b.ingredients, test);
  return k ? { potency: n * k, harmony: 0, harmonyMult: 1, note: `+${n * k} Potency (${what})` } : null;
};
const harmony = (n: number, note: string): FamiliarStep | null => (n ? { potency: 0, harmony: n, harmonyMult: 1, note: `+${n} Harmony (${note})` } : null);
const mult = (m: number, note: string): FamiliarStep => ({ potency: 0, harmony: 0, harmonyMult: m, note: `×${m} Harmony (${note})` });

/** The familiars that change a brew's score, by id. The rest act on gold, Discards or what you can see. */
export const FAMILIAR_SCORE: Record<string, (b: FamiliarBrew) => FamiliarStep | null> = {
  'hearth-toad': (b) => harmony(b.shelf, 'Shelf potions'),
  hedgehog: potencyPer(4, essence('stone'), 'Stone'),
  heron: potencyPer(3, essence('tide'), 'Tide'),
  salamander: potencyPer(3, essence('ember'), 'Ember'),
  'garden-snail': potencyPer(2, (i) => i.essences.length === 2, 'two essences'),
  otter: (b) => harmony(b.ingredients.length === 2 ? 2 : 0, 'two ingredients'),
  'black-cat': (b) => harmony(3 * count(b.ingredients, essence('umbra')), 'Umbra'),
  firefly: (b) => harmony(b.night ? 3 : 0, 'Night Shift'),
  'frost-hare': (b) => harmony(count(b.ingredients, (i) => i.tags.includes('frost')), 'Frost'),
  jackdaw: (b) => harmony(new Set(b.ingredients.flatMap((i) => i.essences)).size, 'distinct essences'),
  'will-o-wisp': (b) => (b.firstBrew ? mult(2, 'first brew today') : null),
  'old-hound': (b) => (b.ingredients.length === 3 ? mult(1.5, 'three ingredients') : null),
  hob: (b) => ({ potency: b.firstPotency, harmony: 0, harmonyMult: 1, note: `+${b.firstPotency} Potency (first ingredient again)` }),
};

/** Numbers for the familiars that act outside the score. */
export const FAMILIAR_RULES = {
  ravenGold: 3,
  magpieGold: 1,
  tortoiseGold: 2,
  foxTipMult: 2,
  ferretEvery: 3,
  owlPeek: 3,
} as const;

export const hasFamiliar = (s: Pick<RunState, 'familiars'>, id: string) => s.familiars.includes(id);

export function familiarPrice(id: string): number {
  return FAMILIAR_PRICE[codex.familiars.get(id)!.rarity];
}

export const sellPrice = (id: string) => Math.floor(familiarPrice(id) * FAMILIAR_SELL);

/** Familiars this run can be offered: base-pool ones and unlocked ones, not ones you already have. */
export function familiarPool(s: Pick<RunState, 'unlocks' | 'familiars'>, rarity?: ShopRarity): Familiar[] {
  return [...codex.familiars.values()].filter((f) => (f.pool === 'base' || s.unlocks.includes(f.id)) && !s.familiars.includes(f.id) && (!rarity || f.rarity === rarity));
}

/** n distinct familiars, each rolled by rarity first (common 60, uncommon 30, rare 10). */
export function rollFamiliars(ctx: Ctx, n: number, rarity?: ShopRarity): string[] {
  const out: string[] = [];
  while (out.length < n) {
    const left = familiarPool(ctx.s, rarity).filter((f) => !out.includes(f.id));
    if (!left.length) break;
    const want = rarity ?? pickWeighted(ctx, [['common', 60], ['uncommon', 30], ['rare', 10]] as const);
    const of = left.filter((f) => f.rarity === want);
    out.push(pickWeighted(ctx, (of.length ? of : left).map((f) => [f.id, 1] as const)));
  }
  return out;
}

export function addFamiliar(ctx: Ctx, id: string): void {
  const s = ctx.s;
  if (!codex.familiars.has(id)) reject(`unknown familiar ${id}`);
  if (s.familiars.includes(id)) reject(`you already have the ${codex.familiars.get(id)!.name}`);
  if (s.familiars.length >= s.familiarSlots) reject('every familiar slot is taken: sell one first');
  s.familiars.push(id);
  ctx.ev.push({ type: 'familiarGained', familiar: id });
}

export function sellFamiliar(ctx: Ctx, index: number): void {
  const id = ctx.s.familiars[index];
  if (!id) reject(`no familiar in slot ${index}`);
  ctx.s.familiars.splice(index, 1);
  const price = sellPrice(id);
  ctx.ev.push({ type: 'familiarSold', familiar: id, price });
  changeGold(ctx, price, 'familiar');
}

export function moveFamiliar(ctx: Ctx, from: number, to: number): void {
  const f = ctx.s.familiars;
  if (!f[from] || to < 0 || to >= f.length) reject('no such familiar slot');
  const [id] = f.splice(from, 1);
  f.splice(to, 0, id!);
}

/** Gold a familiar pays when it fires. */
export function familiarGold(ctx: Ctx, id: string, amount: number): void {
  if (!hasFamiliar(ctx.s, id) || amount <= 0) return;
  ctx.ev.push({ type: 'familiarFired', familiar: id });
  changeGold(ctx, amount, 'familiar');
}
