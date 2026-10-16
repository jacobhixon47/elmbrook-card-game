import { codex } from '../codex';
import type { PotionFamily } from '../codex/schema';
import type { NightPayment, PatronReward, VisitorPayment } from '../codex/schema';
import { familiesOf, inFamily, MODIFIER_RULES, NIGHT_SHIFT_DAY, type Errand, type Order, type OrderBonus, type RunState, type Tier } from '../core';

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
  guild: { name: 'Guild Hall', text: 'Take a commission: a goal by a Night Shift, for gold or a relic.' },
  hearth: { name: 'The Hearth', text: 'Burn one card you no longer want.' },
  event: { name: 'Something Afoot', text: 'A chance encounter on the way home. Who knows?' },
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

/** A recipe's families as shown: "Illusion + Lunar" for one that uses the Lunar essence. */
export function familiesName(recipeId: string): string {
  const r = codex.recipes.get(recipeId);
  return r ? familiesOf(r).map((f) => familyName(f as PotionFamily)).join(' + ') : '';
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
  return codex.regulars.get(id)?.name ?? codex.nightCustomers.get(id)?.name ?? codex.visitors.get(id)?.name ?? codex.patrons.get(id)?.name ?? id;
}

/** Who they are, in a few words. */
export function customerBlurb(id: string): string {
  return codex.regulars.get(id)?.blurb ?? codex.nightCustomers.get(id)?.blurb ?? codex.visitors.get(id)?.blurb ?? codex.patrons.get(id)?.blurb ?? '';
}

/**
 * A patron's twist on their night. When the Pale Courier can't get a Lunar potion from your deck and
 * asks for your best instead, it says what they want tonight, since the general text names Lunar.
 */
export function patronTwistText(s: Pick<RunState, 'orders'>, patron: { id: string; text: string; fixedOrder?: { family: PotionFamily } | undefined }): string {
  const o = s.orders.find((x) => x.customer === patron.id);
  if (!patron.fixedOrder || !o || (o.request.kind === 'family' && o.request.family === patron.fixedOrder.family)) return patron.text;
  const rest = patron.text.slice(patron.text.indexOf('. ') + 2);
  return `Your deck can't brew a ${familyName(patron.fixedOrder.family)} potion tonight, so they want your best: ${requestText(o)}, ${TIER_NAME[o.minTier]} or better. ${rest}`;
}

/** What a night customer or patron gives beyond the gold, if anything. */
export function extraPay(customer: string): string | null {
  const patron = codex.patrons.get(customer);
  if (patron) return PATRON_REWARD_TEXT(patron.reward);
  const visitor = codex.visitors.get(customer);
  if (visitor) return visitorPayText(visitor.paysIn);
  const pays = codex.nightCustomers.get(customer)?.paysIn.kind;
  return pays ? NIGHT_PAY_TEXT[pays] : null;
}

/** What a seasonal visitor gives beyond the gold (GDD §4.1). */
function visitorPayText(p: VisitorPayment): string | null {
  switch (p.kind) {
    case 'gold':
      return null;
    case 'card-pick':
      return `pick 1 of ${p.count} ${p.tincture ? 'Tinctures' : `${cap(p.tag ?? p.essence ?? '')} ingredients`}`;
    case 'burn':
      return 'takes a card of your choice out of your deck';
    case 'temper':
      return `+${MODIFIER_RULES.temperPotency} Potency on an ingredient of your choice`;
    case 'half-price':
      return "your next Night Market buy this week is half price";
  }
}

/** The short form for an order ticket's terms. */
const VISITOR_TERMS: Record<VisitorPayment['kind'], string | null> = { gold: null, 'card-pick': 'pick', burn: 'burn 1', temper: '+2 Potency', 'half-price': 'half price' };

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

export function requestText(order: Pick<Order, 'request'> & Partial<Pick<Order, 'quantity' | 'delivered' | 'favourite'>>, long = false): string {
  // A favourite order: the family and the tag it needs, marked with a heart on the board (GDD §13).
  if (order.favourite && order.request.kind === 'family') {
    const family = familyName(order.request.family);
    return long ? `any ${family} potion with a ${cap(order.favourite.tag)} ingredient` : `♥ ${family} + ${cap(order.favourite.tag)}`;
  }
  const what = order.request.kind === 'recipe' ? recipeName(order.request.recipe) : `any ${familyName(order.request.family)} potion`;
  const n = order.quantity ?? 1;
  if (n <= 1) return what;
  return `${n}× ${what}${order.delivered ? ` (${order.delivered}/${n})` : ''}`;
}

/** A favourite order's note for its dialogue: what it needs and what it earns. */
export function favouriteNote(order: Pick<Order, 'request' | 'customer'> & Partial<Pick<Order, 'favourite'>>): string | null {
  const fav = order.favourite ? codex.regulars.get(order.customer)?.favourite : undefined;
  if (!fav || !order.favourite) return null;
  return `♥ Their favourite, the ${fav.name}: +1 Friendship.`;
}

/** For an order that asks for a family: the recipes of it in your Grimoire, so "Lunar" isn't read as the Lunar essence. */
export function familyRecipesNote(s: Pick<RunState, 'knownRecipes'>, order: Pick<Order, 'request'>): string | null {
  if (order.request.kind !== 'family') return null;
  const family = order.request.family;
  const known = s.knownRecipes.filter((id) => { const r = codex.recipes.get(id); return r !== undefined && inFamily(r, family); }).map(recipeName);
  if (!known.length) return `You know no ${familyName(family)} recipe yet.`;
  return `${familyName(family)} recipes you know: ${known.join(', ')}.`;
}

/** The recipe an order names, if it isn't in your Grimoire yet. */
export function unknownRecipe(s: Pick<RunState, 'knownRecipes'>, order: Pick<Order, 'request'>): string | null {
  return order.request.kind === 'recipe' && !s.knownRecipes.includes(order.request.recipe) ? order.request.recipe : null;
}

/** How to brew a recipe an order names that you don't know yet: its essences, and the Experiment's cost. */
export function newRecipeHint(s: Pick<RunState, 'knownRecipes' | 'relics'>, order: Pick<Order, 'request'>): string | null {
  const id = unknownRecipe(s, order);
  if (!id) return null;
  const essences = codex.recipes.get(id)!.pattern.map(cap).join(' + ');
  const cost = s.relics.includes('witchs-hatpin') ? 'at full quality' : 'one tier lower';
  return `New recipe: ${essences}. Brewing it teaches it, ${cost}.`;
}

/** The customer's line, in character (GDD §15: customers speak, the UI states it plainly). */
export function customerLine(order: Pick<Order, 'request'> & Partial<Pick<Order, 'customer' | 'favourite'>>): string {
  if (order.customer && codex.patrons.has(order.customer)) return PATRON_LINE[order.customer] ?? 'You know what I came for.';
  const visitor = order.customer ? codex.visitors.get(order.customer) : undefined;
  if (visitor) return visitor.line;
  const fav = order.favourite && order.customer ? codex.regulars.get(order.customer)?.favourite : undefined;
  if (fav) return `The usual, if you've got it: my ${fav.name}.`;
  if (order.request.kind === 'recipe') return `A ${recipeName(order.request.recipe)}, if you'd be so kind.`;
  return FAMILY_LINE[order.request.family];
}

export function orderTerms(order: Pick<Order, 'minTier' | 'pay'> & Partial<Pick<Order, 'tagBonus' | 'customer'>>): string {
  if (order.tagBonus) return `${TIER_NAME[order.minTier]}+ · ${order.pay}g · ×${order.tagBonus.mult} ${cap(order.tagBonus.tag)}`;
  const extra = order.customer && codex.nightCustomers.get(order.customer)?.paysIn.kind;
  if (extra === 'omen') return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + Omen`;
  if (extra === 'lunar-card') return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + Lunar`;
  if (extra === 'rare-card') return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + Rare`;
  const visit = order.customer ? codex.visitors.get(order.customer) : undefined;
  const short = visit && VISITOR_TERMS[visit.paysIn.kind];
  if (short) return `${TIER_NAME[order.minTier]}+ · ${order.pay}g + ${short}`;
  return `${TIER_NAME[order.minTier]} or better · ${order.pay}g`;
}

/** Extra conditions on an order, for its ticket and dialogue: an Umbra ingredient, a clock. */
export function orderNeeds(order: Pick<Order, 'needsUmbra' | 'expiresIn' | 'status'> & Partial<Pick<Order, 'needsTag'>>): string | null {
  const parts: string[] = [];
  if (order.needsUmbra) parts.push('needs Umbra');
  if (order.needsTag) parts.push(`needs a ${cap(order.needsTag)} ingredient`);
  if (order.expiresIn !== null && order.status === 'open') parts.push(`leaves in ${order.expiresIn} brew${order.expiresIn === 1 ? '' : 's'}`);
  return parts.length ? cap(parts.join(', ')) : null;
}

const PATRON_LINE: Record<string, string> = {
  lamplighter: 'The wicks are low tonight. Make your best one first.',
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

export const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);

/** The name of anything the Almanac can unlock: a card, recipe, familiar or relic. */
export function unlockName(id: string): string {
  for (const t of [codex.ingredients, codex.tinctures, codex.recipes, codex.familiars, codex.relics]) {
    const x = t.get(id);
    if (x) return x.name;
  }
  return id;
}

/** Names as prose: "A", "A and B", "A, B and C". */
export function listOf(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function dayLabel(state: Pick<RunState, 'week' | 'day'>): string {
  return `Week ${state.week} · ${state.day === NIGHT_SHIFT_DAY ? 'Night Shift' : `Day ${state.day}`}`;
}

/** What a Guild Commission pays. */
export function commissionReward(id: string): string {
  const r = codex.commissions.get(id)!.reward;
  if (r.kind === 'gold') return `${r.amount} gold`;
  if (r.kind === 'relic') return `a tier ${r.tier} relic`;
  return `pick 1 of ${r.count} ${cap(r.rarity)} cards`;
}

/** When a commission is due, from the week you're in. */
export function commissionDue(dueWeek: number, week: number): string {
  return dueWeek === week ? "by this week's Night Shift" : dueWeek === week + 1 ? "by next week's Night Shift" : `by week ${dueWeek}'s Night Shift`;
}
