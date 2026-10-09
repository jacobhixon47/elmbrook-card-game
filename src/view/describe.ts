import { codex } from '../codex';
import type { PotionFamily } from '../codex/schema';
import type { NightPayment, PatronReward } from '../codex/schema';
import { NIGHT_SHIFT_DAY, type Errand, type Order, type OrderBonus, type RunState, type Tier } from '../core';

// Plain words for what the rules engine holds. Pure, so the wording is tested without a browser.

export const TIER_NAME: Record<Tier, string> = { crude: 'Crude', fine: 'Fine', superb: 'Superb', masterwork: 'Masterwork', legendary: 'Legendary' };

export const BONUS_TEXT: Record<OrderBonus, string> = {
  'no-umbra': 'No Umbra ingredients',
  'three-ingredients': 'Brewed with 3 ingredients',
  'wychwood-ingredient': 'Uses a Wychwood ingredient',
};

export const ERRAND_TEXT: Record<Errand, { name: string; text: string }> = {
  market: { name: 'Market Square', text: 'Spend gold on cards, a third cauldron slot or a bigger Shelf.' },
  forage: { name: 'Wychwood Forage', text: 'Pick 2 of 5 wild ingredients, free.' },
  creek: { name: 'Creek Bank', text: 'Temper a card for +2 Potency, free, or buy it a modifier.' },
  hearth: { name: 'The Hearth', text: 'Burn one card you no longer want.' },
};

const FAMILY_LINE: Record<PotionFamily, string> = {
  healing: 'Something for these aches, please.',
  warming: "I can't get warm. Have you anything for it?",
  calming: "I haven't slept properly in days.",
  vigor: 'I need a little get-up-and-go.',
  protection: 'Something to keep me in one piece?',
  secrets: "Nothing anyone else needs to know about.",
  fortune: 'I could use a bit of luck.',
  illusion: 'I need to look like someone else for an evening.',
  lunar: 'Something that remembers the moon.',
};

export function familyName(f: PotionFamily): string {
  return f[0]!.toUpperCase() + f.slice(1);
}

export function recipeName(id: string): string {
  return codex.recipes.get(id)?.name ?? id;
}

export function cardName(id: string): string {
  return codex.ingredients.get(id)?.name ?? codex.tinctures.get(id)?.name ?? codex.junk.get(id)?.name ?? id;
}

/** What a card does, in one short line, for reward and shop screens. */
export function cardText(id: string): string {
  const ing = codex.ingredients.get(id);
  if (ing) {
    const ess = ing.essences.map((e) => e[0]!.toUpperCase() + e.slice(1)).join(', ');
    return `${ess} · Potency ${ing.potency}${ing.text ? `. ${ing.text}` : ''}`;
  }
  return codex.tinctures.get(id)?.text ?? codex.junk.get(id)?.text ?? '';
}

export function customerName(id: string): string {
  return codex.regulars.get(id)?.name ?? codex.nightCustomers.get(id)?.name ?? codex.patrons.get(id)?.name ?? id;
}

/** Who they are, in a few words. */
export function customerBlurb(id: string): string {
  return codex.regulars.get(id)?.blurb ?? codex.nightCustomers.get(id)?.blurb ?? codex.patrons.get(id)?.blurb ?? '';
}

/** What a night customer or patron gives beyond the gold, if anything. */
export function extraPay(customer: string): string | null {
  const patron = codex.patrons.get(customer);
  if (patron) return PATRON_REWARD_TEXT(patron.reward);
  const pays = codex.nightCustomers.get(customer)?.paysIn.kind;
  return pays ? NIGHT_PAY_TEXT[pays] : null;
}

const NIGHT_PAY_TEXT: Record<NightPayment['kind'], string | null> = {
  gold: null,
  omen: 'an Omen for your Satchel',
  'lunar-card': 'pick a Lunar card',
  'rare-card': 'pick a Rare card',
  'lift-curse': 'lifts your oldest Curse',
};

function PATRON_REWARD_TEXT(r: PatronReward): string {
  switch (r.kind) {
    case 'gold':
      return `+${r.amount}g`;
    case 'card-pick':
      return `pick 1 of ${r.count} ${cap(r.rarity)} cards`;
    case 'familiar-pick':
      return `pick 1 of ${r.count} familiars`;
    case 'relic':
      return `a tier ${r.tier} relic`;
    case 'win':
      return 'the month';
  }
}

export function requestText(order: Pick<Order, 'request'> & Partial<Pick<Order, 'quantity' | 'delivered'>>): string {
  const what = order.request.kind === 'recipe' ? recipeName(order.request.recipe) : `any ${familyName(order.request.family)} potion`;
  const n = order.quantity ?? 1;
  if (n <= 1) return what;
  return `${n}× ${what}${order.delivered ? ` (${order.delivered}/${n})` : ''}`;
}

/** The customer's line, in character (GDD §15: customers speak, the UI states it plainly). */
export function customerLine(order: Pick<Order, 'request'> & Partial<Pick<Order, 'customer'>>): string {
  if (order.customer && codex.patrons.has(order.customer)) return PATRON_LINE[order.customer] ?? 'You know what I came for.';
  if (order.request.kind === 'recipe') return `A ${recipeName(order.request.recipe)}, if you'd be so kind.`;
  return FAMILY_LINE[order.request.family];
}

export function orderTerms(order: Pick<Order, 'minTier' | 'pay'> & Partial<Pick<Order, 'tagBonus' | 'customer'>>): string {
  if (order.tagBonus) return `${TIER_NAME[order.minTier]}+ · ${order.pay}g · ×${order.tagBonus.mult} ${cap(order.tagBonus.tag)}`;
  const extra = order.customer && codex.nightCustomers.get(order.customer)?.paysIn.kind;
  if (extra === 'omen') return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + Omen`;
  if (extra === 'lunar-card') return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + Lunar`;
  if (extra === 'rare-card') return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + Rare`;
  return `${TIER_NAME[order.minTier]} or better · ${order.pay}g`;
}

/** Extra conditions on an order, for its ticket and dialogue: an Umbra ingredient, a clock. */
export function orderNeeds(order: Pick<Order, 'needsUmbra' | 'expiresIn' | 'status'>): string | null {
  const parts: string[] = [];
  if (order.needsUmbra) parts.push('needs Umbra');
  if (order.expiresIn !== null && order.status === 'open') parts.push(`leaves in ${order.expiresIn} brew${order.expiresIn === 1 ? '' : 's'}`);
  return parts.length ? cap(parts.join(', ')) : null;
}

const PATRON_LINE: Record<string, string> = {
  lamplighter: 'Mind the dark. Brew what you cannot see.',
  'mother-hollow': 'A little from every corner of the valley, dear.',
  'twin-owls': 'Two, please. We always share.',
  'sir-bramble': 'Nothing hot in my cup, if you please.',
  'clockless-man': "I can't stay. I never can.",
  'may-queen': 'Surprise me each time, or not at all.',
  'firefly-conductor': 'Keep time with the lights!',
  'tithe-reeve': "The harvest's due. So is the tithe.",
  'frost-warden': 'Only the cold keeps.',
  'pale-courier': 'Sealed, and by moonlight. The best you can make.',
  'moonless-patron': '...',
};

const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);

export function dayLabel(state: Pick<RunState, 'week' | 'day'>): string {
  return `Week ${state.week} · ${state.day === NIGHT_SHIFT_DAY ? 'Night Shift' : `Day ${state.day}`}`;
}
