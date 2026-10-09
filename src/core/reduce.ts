import { codex } from '../codex';
import type { Action, GameEvent } from './actions';
import { previewBrew } from './brew';
import { activeEvents, FESTIVAL_DAY, festivalOn, NIGHT_SHIFT_DAY, rollCalendar, todaysWeather, type Season } from './calendar';
import { changeGold, draw, drawToHandSize, gainCard, Reject, reject, shuffled, takeFromHand, type Ctx } from './ctx';
import { hasEffect, effectsOf, sumEffect } from './effects';
import { offerErrands, offerReward, openErrand } from './dusk';
import { brewBlocked, finaleMet, nightPayment, patronReward, queueFirstNightGift, rollPatrons, stowSatchel, twistNow } from './night';
import { addModifier, drawOnBrewOf, enchant, heartDeltaOf, isAged, payGilded, temper } from './modifiers';
import { addFamiliar, FAMILIAR_RULES, familiarGold, hasFamiliar, moveFamiliar, sellFamiliar } from './familiars';
import { atStall, brokerPick, drawTarot, forgetRecipe, marketOf, openNightMarket, stallStock, swapForCard, takeDeal, weave } from './market';
import { dayAllowance, gainRelic, hasCurse, hasRelic, liftCurse, RELIC_RULES, rentOf, takeCurse } from './relics';
import { fits, postOrders, payout, satisfies } from './orders';
import { seedRng } from './rng';
import {
  BREWS_PER_DAY, CAULDRON_SLOTS, FAMILIAR_SLOTS, DISCARDS_PER_DAY, FENCE_PRICE, FENCE_SHADOW_BONUS, MAX_DISCARD, MAX_HEARTS, MIN_DECK,
  LONGEST_NIGHT, SEASON_RULES, SHELF_SLOTS, SKIP_GOLD, START_GOLD, TITHE_GOLD, tierStep, WEEKS,
} from './rules';
import { allCards, type CardInstance, type Order, type Pending, type Phase, type Potion, type RunState } from './state';

export type ReduceResult = { state: RunState; events: GameEvent[] };

const freshPending = (): Pending => ({ harmony: 0, harmonyMult: 1, potency: 0, potencyMult: 1, copies: 1, fullExperiment: false, lunarPotency: 0, allLunar: false });
const noBoost = () => ({ hearts: 0, tip: 0, payMult: 1 });

export function newRun(seed: string, witchId: string, season: Season = 'spring', unlocks: readonly string[] = []): ReduceResult {
  const witch = codex.witches.get(witchId);
  if (!witch) throw new Error(`unknown witch: ${witchId}`);

  let uid = 1;
  const deck: CardInstance[] = [];
  for (const entry of witch.startingDeck) {
    for (let i = 0; i < entry.count; i++) deck.push({ uid: uid++, card: entry.card });
  }

  const s: RunState = {
    version: 9,
    seed,
    rng: seedRng(seed),
    witch: witch.id,
    season,
    calendar: rollCalendar(seed, season, WEEKS),
    week: 1,
    day: 1,
    phase: 'morning',
    gold: START_GOLD,
    handSize: witch.handSize,
    brewsLeft: 0,
    discardsLeft: 0,
    cauldronSlots: CAULDRON_SLOTS,
    shelfSize: SHELF_SLOTS,
    drawPile: deck,
    satchel: [],
    patrons: rollPatrons(seed, season),
    gifts: [],
    lastBrew: [],
    lastFamily: null,
    hand: [],
    discardPile: [],
    cauldron: [],
    knownRecipes: [...witch.knownRecipes],
    orders: [],
    shelf: [],
    hearts: {},
    pending: freshPending(),
    delivery: noBoost(),
    brewsToday: 0,
    unlocks: [...unlocks],
    familiars: [],
    familiarSlots: FAMILIAR_SLOTS,
    discardCount: 0,
    relics: [],
    curses: [],
    sludgeToday: 0,
    fortunes: [],
    fog: false,
    offer: null,
    skipStreak: 0,
    nextUid: uid,
  };
  const ctx: Ctx = { s, ev: [{ type: 'runStarted', seed, witch: witch.id, season }] };
  startDay(ctx);
  return { state: ctx.s, events: ctx.ev };
}

export function isNightShift(state: Pick<RunState, 'day'>): boolean {
  return state.day === NIGHT_SHIFT_DAY;
}

/** Afternoon: the whole deck is shuffled back together and the Order Board fills. */
function startDay(ctx: Ctx): void {
  const s = ctx.s;
  const night = isNightShift(s);
  // The Night Satchel joins the deck only on a Night Shift, or on the day of an Eclipse (GDD §5.4).
  stowSatchel(s);
  const satchel = night || activeEvents(s).includes('eclipse');
  s.drawPile = shuffled(ctx, satchel ? [...allCards(s), ...s.satchel] : allCards(s));
  if (satchel) s.satchel = [];
  const weather = todaysWeather(s);
  // Snow: Frost cards are drawn first (GDD §4.2).
  if (weather === 'snow') s.drawPile = [...s.drawPile.filter(isFrost), ...s.drawPile.filter((c) => !isFrost(c))];
  // Fog hides the Order Board until the first brew or Discard; it never hides a Night Shift.
  s.fog = weather === 'fog' && !night;
  s.hand = [];
  s.discardPile = [];
  s.cauldron = [];
  s.orders = [];
  s.offer = null;
  s.gifts = [];
  s.lastBrew = [];
  s.lastFamily = null;
  s.pending = freshPending();
  s.brewsToday = 0;
  s.sludgeToday = 0;
  s.phase = 'morning';
  const rules = SEASON_RULES[s.season];
  const allowance = dayAllowance(s, { brews: BREWS_PER_DAY + (night ? 0 : rules.dayBrews), discards: DISCARDS_PER_DAY + (night ? rules.nightDiscards : 0) }, night, weather);
  s.brewsLeft = allowance.brews;
  s.discardsLeft = allowance.discards;
  // Longest Night: the festival week's Night Shift is longer.
  if (night && festivalOn(s, s.week, FESTIVAL_DAY) === 'longest-night') {
    s.brewsLeft += LONGEST_NIGHT.brews;
    s.discardsLeft += LONGEST_NIGHT.discards;
  }
  ctx.ev.push({ type: 'dayStarted', week: s.week, day: s.day, nightShift: night });
  ctx.ev.push({ type: 'deckShuffled', size: s.drawPile.length });
  postOrders(ctx, night);
}

const isFrost = (c: CardInstance) => codex.ingredients.get(c.card)?.tags.includes('frost') ?? false;

function liftFog(ctx: Ctx): void {
  if (!ctx.s.fog) return;
  ctx.s.fog = false;
  ctx.ev.push({ type: 'fogLifted' });
}

function requirePhase(ctx: Ctx, ...phases: Phase[]): void {
  if (!phases.includes(ctx.s.phase)) reject(`not allowed during ${ctx.s.phase}`);
}

function changeHearts(ctx: Ctx, customer: string, delta: number): void {
  // Nameless: no regular remembers you, for better or worse.
  if (hasCurse(ctx.s, 'nameless')) return;
  const before = ctx.s.hearts[customer] ?? 0;
  const after = Math.max(0, Math.min(MAX_HEARTS, before + delta));
  ctx.s.hearts[customer] = after;
  if (after !== before) ctx.ev.push({ type: 'heartsChanged', customer, hearts: after, delta: after - before });
}

function openOrder(ctx: Ctx, id: number): Order {
  const order = ctx.s.orders.find((o) => o.id === id);
  if (!order) reject(`no order ${id}`);
  if (order.status !== 'open') reject(`order ${id} is already ${order.status}`);
  return order;
}

function fill(ctx: Ctx, order: Order, potion: Potion): void {
  // A multi-potion order (Harvest Fair) pays when its last potion arrives.
  order.delivered += 1;
  if (order.delivered < order.quantity) {
    ctx.ev.push({ type: 'orderProgress', order: order.id, potion: potion.uid, delivered: order.delivered, quantity: order.quantity });
    return;
  }
  const paid = payout(potion, order, ctx.s.familiars);
  const { bonus } = paid;
  // A Ribbon or similar boosts the next delivery once (GDD §6.4).
  const boost = ctx.s.delivery;
  const pay = Math.round(paid.pay * boost.payMult);
  const tip = paid.tip + boost.tip;
  ctx.s.delivery = noBoost();
  order.status = 'filled';
  ctx.ev.push({ type: 'orderFilled', order: order.id, customer: order.customer, potion: potion.uid, tier: potion.tier, pay, tip, bonus });
  changeGold(ctx, pay + tip, 'order');
  familiarGold(ctx, 'magpie', FAMILIAR_RULES.magpieGold);
  if (hasRelic(ctx.s, 'apprentice-ledger')) changeGold(ctx, RELIC_RULES.ledgerGold, 'relic');
  const bell = hasRelic(ctx.s, 'silver-bell') && codex.regulars.has(order.customer) ? RELIC_RULES.bellHearts : 0;
  changeHearts(ctx, order.customer, (bonus ? 2 : 1) + potion.heartDelta + boost.hearts + bell);
  ctx.s.lastFamily = potion.family;
  const patron = codex.patrons.get(order.customer);
  if (patron) patronReward(ctx, patron);
  else nightPayment(ctx, order);
}

function shelve(ctx: Ctx, potion: Potion): void {
  if (ctx.s.shelf.length < ctx.s.shelfSize) {
    ctx.s.shelf.push(potion);
    ctx.ev.push({ type: 'potionShelved', uid: potion.uid });
  } else {
    ctx.ev.push({ type: 'potionSpilled', uid: potion.uid });
  }
}

function brew(ctx: Ctx, deliverTo: number | undefined): void {
  const s = ctx.s;
  requirePhase(ctx, 'brewing');
  if (s.brewsLeft <= 0) reject('no Brews left today');
  if (deliverTo !== undefined && s.fog) reject('the fog hides the orders until your first brew or Discard');
  const target = deliverTo === undefined ? null : openOrder(ctx, deliverTo);
  const preview = previewBrew(s, s.cauldron, s.hand);
  if (preview.kind === 'empty') reject('the cauldron needs at least two ingredients');
  if (preview.discardCost > s.discardsLeft) reject('not enough Discards left');
  const blocked = brewBlocked(s, s.cauldron);
  if (blocked) reject(blocked);
  const twist = twistNow(s);
  if (twist === 'brew-costs-gold-2') changeGold(ctx, -TITHE_GOLD, 'patron');

  const used = s.cauldron;
  s.cauldron = [];
  s.brewsLeft -= 1;
  s.brewsToday += 1;
  liftFog(ctx);
  s.discardsLeft -= preview.discardCost;
  for (const c of used) delete c.aged;
  s.discardPile.push(...used);
  s.lastBrew = used.map((c) => c.card);
  payGilded(ctx, used);
  // A Grimoire Page waits for the next Experiment; every other tincture lasts one brew.
  const experiment = preview.kind === 'potion' && !preview.known;
  s.pending = { ...freshPending(), fullExperiment: s.pending.fullExperiment && !experiment };

  if (preview.kind === 'sludge') {
    s.sludgeToday += 1;
    // The Iron Lid catches the first failed brew of the day.
    if (s.sludgeToday === 1 && hasRelic(s, 'iron-lid')) {
      ctx.ev.push({ type: 'relicFired', relic: 'iron-lid' });
    } else {
      const junk = gainCard(ctx, 'sludge', 'sludge');
      ctx.ev.push({ type: 'sludge', uid: junk.uid });
    }
  } else {
    ctx.ev.push(...preview.steps);
    if (!preview.known) {
      s.knownRecipes.push(preview.recipe);
      ctx.ev.push({ type: 'recipeDiscovered', recipe: preview.recipe });
    }
    // The Kettle of Plenty: once every order is resolved, potions go to the Shelf a tier higher.
    const spare = hasRelic(s, 'kettle-of-plenty') && s.orders.every((o) => o.status !== 'open');
    const base = {
      recipe: preview.recipe,
      family: preview.family,
      quality: preview.quality,
      tier: spare ? tierStep(preview.tier, 1) : preview.tier,
      ingredients: used.map((c) => c.card),
      experiment: !preview.known,
      heartDelta: heartDeltaOf(used),
    };
    for (let i = 0; i < preview.copies; i++) {
      const potion: Potion = { uid: s.nextUid++, ...base };
      if (i === 0) ctx.ev.push({ type: 'brewed', potion, copies: preview.copies });
      if (i === 0 && target && fits(s, potion, target)) fill(ctx, target, potion);
      else shelve(ctx, potion);
    }
  }
  // The Clockless Man: every open order loses patience with each brew.
  for (const o of s.orders) {
    if (o.status !== 'open' || o.expiresIn === null) continue;
    o.expiresIn -= 1;
    if (o.expiresIn > 0) continue;
    o.status = 'declined';
    ctx.ev.push({ type: 'orderExpired', order: o.id, customer: o.customer });
  }
  // The Firefly Conductor: the whole hand goes after every brew.
  if (twist === 'hand-refresh' && s.hand.length) {
    const uids = s.hand.map((c) => c.uid);
    s.discardPile.push(...s.hand);
    s.hand = [];
    ctx.ev.push({ type: 'cardsDiscarded', uids });
  }
  drawToHandSize(ctx);
  const extra = drawOnBrewOf(used);
  if (extra > 0) draw(ctx, extra);
}

function endDay(ctx: Ctx): void {
  const s = ctx.s;
  requirePhase(ctx, 'brewing');
  familiarGold(ctx, 'tortoise', FAMILIAR_RULES.tortoiseGold * s.brewsLeft);
  s.hand.push(...s.cauldron);
  s.cauldron = [];
  // Unfinished orders count as declined (GDD §4).
  for (const o of s.orders) {
    if (o.status !== 'open') continue;
    o.status = 'declined';
    ctx.ev.push({ type: 'orderDeclined', order: o.id, customer: o.customer });
    changeHearts(ctx, o.customer, -1);
  }
  for (const c of allCards(s)) if (isAged(c)) c.aged = (c.aged ?? 0) + 1;
  expireCards(ctx);
  if (isNightShift(s)) queueFirstNightGift(ctx);
  ctx.ev.push({ type: 'dayEnded', week: s.week, day: s.day });
  s.phase = 'dusk';
  offerReward(ctx);
}

/** Cards like Rot leave the deck by themselves after a few days. */
function expireCards(ctx: Ctx): void {
  const s = ctx.s;
  for (const pile of [s.drawPile, s.hand, s.discardPile]) {
    for (let i = pile.length - 1; i >= 0; i--) {
      const c = pile[i]!;
      const life = effectsOf(c.card).find((e) => e.expiresAfter)?.expiresAfter;
      if (!life) continue;
      c.days = (c.days ?? 0) + 1;
      if (c.days < life) continue;
      pile.splice(i, 1);
      ctx.ev.push({ type: 'cardExpired', uid: c.uid, card: c.card });
    }
  }
}

/** Cards like Fallen Star leave when the week's rent is paid. */
function removeWeekCards(ctx: Ctx): void {
  const s = ctx.s;
  for (const pile of [s.drawPile, s.hand, s.discardPile]) {
    for (let i = pile.length - 1; i >= 0; i--) {
      const c = pile[i]!;
      if (!hasEffect(c.card, 'goneAtWeekEnd')) continue;
      pile.splice(i, 1);
      ctx.ev.push({ type: 'cardExpired', uid: c.uid, card: c.card });
    }
  }
}

function afterReward(ctx: Ctx): void {
  if (isNightShift(ctx.s)) {
    // Free picks first (the first-night Lunar card, night customers' payments), then the Market.
    const gift = ctx.s.gifts.shift();
    if (gift) {
      ctx.s.offer = gift;
      return;
    }
    openNightMarket(ctx);
  } else {
    offerErrands(ctx);
  }
}

/** After the Night Market: pay rent or lose the stall; the fourth rent wins the run. */
function collectRent(ctx: Ctx): void {
  const s = ctx.s;
  const due = rentOf(s);
  s.offer = null;
  if (s.gold < due) {
    ctx.ev.push({ type: 'rentFailed', week: s.week, amount: due, gold: s.gold });
    ctx.ev.push({ type: 'runLost', week: s.week });
    s.phase = 'game-over';
    s.lostTo = 'rent';
    return;
  }
  changeGold(ctx, -due, 'rent');
  ctx.ev.push({ type: 'rentPaid', week: s.week, amount: due });
  if (!finaleMet(s)) {
    // GDD §1: the month is won by surviving every rent and satisfying the Moonless Patron.
    ctx.ev.push({ type: 'finaleFailed', patron: s.patrons[s.week - 1]! });
    ctx.ev.push({ type: 'runLost', week: s.week });
    s.phase = 'game-over';
    s.lostTo = 'finale';
    return;
  }
  if (s.week >= WEEKS) {
    s.phase = 'victory';
    ctx.ev.push({ type: 'runWon' });
    return;
  }
  removeWeekCards(ctx);
  s.week += 1;
  s.day = 1;
  startDay(ctx);
}

function offerOf<K extends NonNullable<RunState['offer']>['kind']>(ctx: Ctx, kind: K): Extract<NonNullable<RunState['offer']>, { kind: K }> {
  const offer = ctx.s.offer;
  if (offer?.kind !== kind) reject(`nothing to do with a ${kind} right now`);
  return offer as Extract<NonNullable<RunState['offer']>, { kind: K }>;
}

function apply(ctx: Ctx, action: Exclude<Action, { type: 'startRun' }>): void {
  const s = ctx.s;
  switch (action.type) {
    case 'openShop':
      requirePhase(ctx, 'morning');
      s.phase = 'brewing';
      ctx.ev.push({ type: 'shopOpened' });
      drawToHandSize(ctx);
      return;

    case 'slot': {
      requirePhase(ctx, 'brewing');
      const inHand = s.hand.find((c) => c.uid === action.uid);
      if (!inHand) reject(`card ${action.uid} is not in hand`);
      if (!codex.ingredients.has(inHand.card)) reject('only ingredients go in the cauldron');
      if (s.cauldron.length >= s.cauldronSlots) reject('the cauldron is full');
      const card = takeFromHand(ctx, action.uid);
      s.cauldron.push(card);
      ctx.ev.push({ type: 'cardSlotted', uid: card.uid, slot: s.cauldron.length - 1 });
      return;
    }

    case 'unslot': {
      requirePhase(ctx, 'brewing');
      const i = s.cauldron.findIndex((c) => c.uid === action.uid);
      if (i < 0) reject(`card ${action.uid} is not in the cauldron`);
      s.hand.push(...s.cauldron.splice(i, 1));
      ctx.ev.push({ type: 'cardUnslotted', uid: action.uid });
      return;
    }

    case 'brew':
      brew(ctx, action.deliverTo);
      return;

    case 'discard': {
      requirePhase(ctx, 'brewing');
      if (s.discardsLeft <= 0) reject('no Discards left today');
      const uids = [...new Set(action.uids)];
      if (uids.length === 0 || uids.length > MAX_DISCARD) reject(`discard 1 to ${MAX_DISCARD} cards`);
      const thrown = uids.map((uid) => takeFromHand(ctx, uid));
      s.discardPile.push(...thrown);
      s.discardsLeft -= 1;
      ctx.ev.push({ type: 'cardsDiscarded', uids });
      liftFog(ctx);
      s.discardCount += 1;
      // The Ferret: every third Discard of the run draws one more.
      const ferret = hasFamiliar(s, 'ferret') && s.discardCount % FAMILIAR_RULES.ferretEvery === 0 ? 1 : 0;
      if (ferret) ctx.ev.push({ type: 'familiarFired', familiar: 'ferret' });
      const extra = thrown.reduce((n, c) => n + sumEffect(c.card, 'drawOnDiscard'), 0) + ferret;
      draw(ctx, Math.max(0, s.handSize - s.hand.length) + extra);
      return;
    }

    case 'playTincture': {
      requirePhase(ctx, 'brewing');
      const inHand = s.hand.find((c) => c.uid === action.uid);
      if (!inHand || !codex.tinctures.has(inHand.card)) reject('only Tinctures can be played');
      if (action.targets?.includes(action.uid)) reject('a Tincture cannot target itself');
      const card = takeFromHand(ctx, action.uid);
      ctx.ev.push({ type: 'tincturePlayed', uid: card.uid, card: card.card });
      for (const e of effectsOf(card.card)) e.onPlay?.(ctx, action.targets ?? []);
      s.discardPile.push(card);
      return;
    }

    case 'deliver': {
      requirePhase(ctx, 'brewing');
      if (s.fog) reject('the fog hides the orders until your first brew or Discard');
      const order = openOrder(ctx, action.order);
      const i = s.shelf.findIndex((p) => p.uid === action.potion);
      if (i < 0) reject(`potion ${action.potion} is not on the Shelf`);
      const potion = s.shelf[i]!;
      if (!satisfies(potion, order)) reject('that potion does not fill this order');
      if (!fits(s, potion, order)) reject('The May Queen wants a different family from your last delivery');
      s.shelf.splice(i, 1);
      fill(ctx, order, potion);
      return;
    }

    case 'decline': {
      requirePhase(ctx, 'morning', 'brewing');
      const order = openOrder(ctx, action.order);
      order.status = 'declined';
      ctx.ev.push({ type: 'orderDeclined', order: order.id, customer: order.customer });
      changeHearts(ctx, order.customer, -1);
      familiarGold(ctx, 'raven', FAMILIAR_RULES.ravenGold);
      return;
    }

    case 'endDay':
      endDay(ctx);
      return;

    case 'pickReward': {
      const offer = offerOf(ctx, 'reward');
      const card = offer.cards[action.index];
      if (!card) reject(`no reward ${action.index}`);
      const inst = gainCard(ctx, card, 'reward');
      ctx.ev.push({ type: 'rewardPicked', card, uid: inst.uid });
      s.skipStreak = 0;
      afterReward(ctx);
      return;
    }

    case 'skipReward':
      offerOf(ctx, 'reward');
      s.skipStreak += 1;
      ctx.ev.push({ type: 'rewardSkipped' });
      changeGold(ctx, SKIP_GOLD, 'skip');
      afterReward(ctx);
      return;

    case 'chooseErrand': {
      const offer = offerOf(ctx, 'errands');
      if (!offer.options.includes(action.errand)) reject(`${action.errand} is not on offer`);
      openErrand(ctx, action.errand);
      return;
    }

    case 'buy': {
      // The day's Market Square, or the Night Market stall you're standing at.
      const item = (stallStock(s) ?? offerOf(ctx, 'market').stock)[action.index];
      if (!item) reject(`no stock ${action.index}`);
      if (item.sold) reject('already sold');
      if (s.gold < item.price) reject('not enough gold');
      if (item.kind === 'familiar') addFamiliar(ctx, item.familiar);
      if (item.kind === 'relic') gainRelic(ctx, item.relic, 'market');
      item.sold = true;
      changeGold(ctx, -item.price, 'market');
      if (item.kind === 'card') {
        gainCard(ctx, item.card, 'market');
      } else if (item.kind !== 'familiar' && item.kind !== 'relic') {
        if (item.kind === 'cauldron-slot') s.cauldronSlots += 1;
        else s.shelfSize += 1;
        ctx.ev.push({ type: 'upgradeBought', upgrade: item.kind });
      }
      return;
    }

    case 'forage': {
      const offer = offerOf(ctx, 'forage');
      if (offer.picksLeft <= 0) reject('no picks left');
      const card = offer.cards[action.index];
      if (!card) reject(`no forage card ${action.index}`);
      offer.cards.splice(action.index, 1);
      offer.picksLeft -= 1;
      gainCard(ctx, card, 'forage');
      return;
    }

    case 'removeCard': {
      const offer = offerOf(ctx, 'hearth');
      if (offer.removed) reject('the Hearth takes one card a night');
      if (allCards(s).length <= MIN_DECK) reject(`the deck can't go below ${MIN_DECK} cards`);
      for (const pile of [s.drawPile, s.hand, s.discardPile] as const) {
        const i = pile.findIndex((c) => c.uid === action.uid);
        if (i < 0) continue;
        const [card] = pile.splice(i, 1);
        offer.removed = true;
        ctx.ev.push({ type: 'cardRemoved', uid: card!.uid, card: card!.card });
        return;
      }
      reject(`card ${action.uid} is not in the deck`);
      return;
    }

    case 'temper':
      temper(ctx, action.uid);
      return;

    case 'enchant':
      enchant(ctx, action.uid, action.modifier);
      return;

    case 'leaveErrand': {
      requirePhase(ctx, 'dusk');
      const kind = s.offer?.kind;
      if (kind !== 'market' && kind !== 'forage' && kind !== 'creek' && kind !== 'hearth') reject('choose an errand first');
      s.day += 1;
      startDay(ctx);
      return;
    }

    case 'takeGift': {
      const gift = offerOf(ctx, 'gift');
      const card = gift.cards[action.index];
      if (!card) reject(`no gift ${action.index}`);
      if (gift.into === 'familiar') {
        addFamiliar(ctx, card);
        ctx.ev.push({ type: 'giftTaken', source: gift.source, card, uid: 0 });
      } else {
        const inst = gainCard(ctx, card, 'gift');
        ctx.ev.push({ type: 'giftTaken', source: gift.source, card, uid: inst.uid });
      }
      afterReward(ctx);
      return;
    }

    case 'passGift': {
      const gift = offerOf(ctx, 'gift');
      ctx.ev.push({ type: 'giftPassed', source: gift.source });
      afterReward(ctx);
      return;
    }

    case 'sellFamiliar':
      if (s.phase === 'game-over' || s.phase === 'victory') reject('the run is over');
      sellFamiliar(ctx, action.index);
      return;

    case 'moveFamiliar':
      moveFamiliar(ctx, action.from, action.to);
      return;

    case 'visitStall': {
      const m = marketOf(ctx);
      const stall = m.stalls[action.index];
      if (!stall) reject(`no stall ${action.index}`);
      m.at = action.index;
      ctx.ev.push({ type: 'stallVisited', stall: stall.id });
      return;
    }

    case 'leaveStall':
      marketOf(ctx).at = null;
      return;

    case 'forgetRecipe':
      forgetRecipe(ctx, action.recipe);
      return;

    case 'brokerPick':
      brokerPick(ctx, action.index);
      return;

    case 'weave':
      weave(ctx, action.from, action.into);
      return;

    case 'drawTarot':
      drawTarot(ctx);
      return;

    case 'swapForCard':
      swapForCard(ctx, action.index, action.uids);
      return;

    case 'takeDeal':
      takeDeal(ctx, action.index, action.take ?? 'relic');
      return;

    case 'liftCurse': {
      const offer = offerOf(ctx, 'hearth');
      if (offer.removed) reject('the Hearth takes one card a night');
      if (!liftCurse(ctx, 'hearth', action.curse)) reject(`you don't carry ${action.curse}`);
      offer.removed = true;
      return;
    }

    case 'sellPotion': {
      atStall(ctx, 'fence');
      const i = s.shelf.findIndex((p) => p.uid === action.uid);
      if (i < 0) reject(`potion ${action.uid} is not on the Shelf`);
      const [potion] = s.shelf.splice(i, 1);
      const price = fencePrice(potion!);
      ctx.ev.push({ type: 'potionSold', uid: potion!.uid, price });
      changeGold(ctx, price, 'fence');
      return;
    }

    case 'leaveMarket':
      marketOf(ctx);
      collectRent(ctx);
      return;

    case 'debug':
      if (action.op === 'addGold') {
        changeGold(ctx, action.amount, 'debug');
      } else if (action.op === 'setWeather') {
        s.calendar.weather[s.week - 1]![s.day - 1] = action.weather;
        s.fog = action.weather === 'fog' && !isNightShift(s) && s.brewsToday === 0;
      } else if (action.op === 'setPatron') {
        const patron = codex.patrons.get(action.patron);
        if (!patron) reject(`no patron ${action.patron}`);
        if (action.week < 1 || action.week > WEEKS) reject('no such week');
        s.patrons[action.week - 1] = patron.id;
      } else if (action.op === 'learnRecipes') {
        for (const r of action.recipes) if (!codex.recipes.has(r)) reject(`no recipe ${r}`);
        for (const r of action.recipes) if (!s.knownRecipes.includes(r)) s.knownRecipes.push(r);
      } else if (action.op === 'giveCard') {
        if (!codex.ingredients.has(action.card) && !codex.tinctures.has(action.card) && !codex.junk.has(action.card)) reject(`no card ${action.card}`);
        const inst = { uid: s.nextUid++, card: action.card };
        s.hand.push(inst);
        ctx.ev.push({ type: 'cardDrawn', uid: inst.uid, card: inst.card });
      } else if (action.op === 'giveFamiliar') {
        addFamiliar(ctx, action.familiar);
      } else if (action.op === 'giveRelic') {
        gainRelic(ctx, action.relic, 'debug');
      } else if (action.op === 'giveCurse') {
        takeCurse(ctx, action.curse);
      } else if (action.op === 'setModifier') {
        const card = [...allCards(s), ...s.satchel].find((c) => c.uid === action.uid);
        if (!card) reject(`no card ${action.uid}`);
        addModifier(ctx, card, action.modifier, 'debug');
      } else if (action.op === 'patronReward') {
        const patron = codex.patrons.get(action.patron);
        if (!patron) reject(`no patron ${action.patron}`);
        patronReward(ctx, patron);
      } else {
        if (action.week < 1 || action.week > WEEKS || action.day < 1 || action.day > NIGHT_SHIFT_DAY) reject('no such day');
        s.week = action.week;
        s.day = action.day;
        startDay(ctx);
      }
      return;
  }
}

/** The Fence pays by tier, and half again for potions with Umbra or Lunar in them (GDD §9). */
export function fencePrice(potion: Pick<Potion, 'tier' | 'ingredients'>): number {
  const shadowy = potion.ingredients.some((id) => {
    const e = codex.ingredients.get(id)?.essences ?? [];
    return e.includes('umbra') || e.includes('lunar');
  });
  return Math.round(FENCE_PRICE[potion.tier] * (shadowy ? FENCE_SHADOW_BONUS : 1));
}

/** The single entry point for game rules. Pure: same input, same output. A broken rule returns the old state and a `rejected` event. */
export function reduce(state: RunState | null, action: Action): ReduceResult {
  if (action.type === 'startRun') return newRun(action.seed, action.witch, action.season, action.unlocks);
  if (!state) throw new Error('no run in progress');
  const ctx: Ctx = { s: structuredClone(state), ev: [] };
  try {
    apply(ctx, action);
  } catch (e) {
    if (e instanceof Reject) return { state, events: [{ type: 'rejected', action: action.type, reason: e.message }] };
    throw e;
  }
  return { state: ctx.s, events: ctx.ev };
}

/** Rebuild a run from its action log (the first action must be `startRun`). Bug reports are replay files. */
export function replay(actions: readonly Action[]): ReduceResult & { rejected: number } {
  let state: RunState | null = null;
  const events: GameEvent[] = [];
  let rejected = 0;
  for (const action of actions) {
    const r = reduce(state, action);
    state = r.state;
    events.push(...r.events);
    rejected += r.events.filter((e) => e.type === 'rejected').length;
  }
  if (!state) throw new Error('empty action log');
  return { state, events, rejected };
}
