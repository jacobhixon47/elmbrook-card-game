import Phaser from 'phaser';
import { hex, PALETTE, type PaletteKey } from '../art/palette';
import { codex, type Essence, type ModifierId } from '../codex';
import {
  allCards, priceAt, runKeepsakes, blessingTonight, BLACK_MARKET, eventChoiceAsk, eventChoiceBlocked, eventDone, brewBlocked, cantModify, COMMISSIONS, dueWeekOf, goalOf, FAMILIAR_RULES, MODIFIER_RULES, hasFamiliar, sellPrice, essencesOf, FINALE_ORDERS, forgettable, fortunePrice, isPatron, moonOf, snowedIn, NIGHT_SHIFT_DAY, patronOf, previewBrew, rentOf, SKIP_GOLD,
  skyTime, payout, TAILOR_POTENCY, tailorCards, todaysWeather, twistNow, WEEKS, BLOSSOM_ORACLE_PRICE, cheapestPotion, CIDER_PRESS, commonCards, FIREFLY_GAMES,
  HARVEST_AUCTION, FRIENDSHIP, friendLevelOf, friendshipOf, hearthOffers, isRegular, HOLLY_CROWN, YULE_LOG, NECTAR_TRADER, pressable, SEED_SWAPPER,
  type Action, type CardInstance, type GameEvent, type Gift, type Offer, type Order, type Potion, type RunState, type Season, type SkyTime, type StallState,
  type NameTakerDeal, type StockItem, type Weather, migrateProfile, storyDue, storyKey, recordRun, type RunOutcome, almanacUnlocks, boonOf, runStartChoice, cauldronOf, LOOP_ALMANAC, MAX_YEAR, reputationMult, yearModifiers,
} from '../core';
import { targetsOf } from '../core/effects';
import { fencePrice } from '../core/reduce';
import { stepAction } from '../debug/fixture-steps';
import { markReady } from '../debug/hook';
import { noAnim, params, type Fixture } from '../debug/params';
import { store } from '../store';
import { gradedView, shopBackdrop, viewOverrides } from '../view/backdrop';
import { pixelCamera } from '../view/camera';
import { createCard } from '../view/card';
import { friendshipLine, levelUpNote, storyScene, townsfolkRows } from '../view/townsfolk';
import {
  BONUS_TEXT, cardText, commissionDue, commissionReward, customerBlurb, customerLine, customerName, dayLabel, ERRAND_TEXT, extraPay, favouriteNote, orderNeeds, orderTerms, recipeName,
  requestText, TIER_NAME, newRecipeHint, unknownRecipe, familiesName, familyRecipesNote, patronTwistText,
  cap, listOf,
} from '../view/describe';
import { DECK_VIEWS, drawGrimoire, type GrimoireTab } from '../view/grimoire';
import { stages } from '../view/guide';
import { bestOrderFor, potionLines, previewPotion } from '../view/plan';
import { todayLine, todayRules, WEATHER_NAME } from '../view/calendar';
import { pixelText } from '../view/text';
import { Tooltip } from '../view/tooltip';
import type { CardExtras } from '../view/inspect';
import { TIPS, TUTORIAL_SEED, TutorialProgress, type Tip } from '../view/tutorial';
import { loadProfile, recordFinishedRun, saveProfile } from '../profile';
import { clearRun, saveRun } from '../save';
import { button, panel } from '../view/ui';
import { play, playEvents } from '../audio/sfx';
import { TIER_SOUND, tickPitch } from '../audio/sounds';
import { addWeather } from '../view/weather';
import { isIntroWeather, patronArrival, SEASON_OPENING, WEATHER_INTRO, type Intro } from '../view/intros';
import { openSettings } from '../view/settings';

/** The Hearth Trader's three trades (Winter). */
type HearthTab = 'trade' | 'yule' | 'crown';

type Mode =
  | { kind: 'idle' }
  | { kind: 'dialog'; order: number }
  | { kind: 'select'; purpose: Purpose; tincture?: number; picked: number[] }
  /** Deck cards picked at a Night Market stall: the Hollow Tailor's two, or the Black Market's trade for stock `swap`. */
  | { kind: 'stall'; picked: number[]; swap?: number; tab?: HearthTab }
  /** A familiar's card, to sell it or move it. */
  | { kind: 'familiar'; index: number }
  /** At the Creek Bank: tempering, or which modifier to buy. */
  | { kind: 'creek'; pick: CreekPick }
  /** Pouring out: the next Shelf potion clicked is poured away. */
  | { kind: 'pour' }
  /** At a dusk event, choosing the card for this choice (the Shrine Blessing). */
  | { kind: 'event-card'; choice: number };

type CreekPick = 'temper' | ModifierId;

/** What a selection is for: a Discard, or the targets of a Tincture (see `targetsOf`). */
type Purpose = 'discard' | 'hand' | 'hand-one' | 'top-3' | 'shelf-one';

const PICK_PROMPT: Record<Exclude<Purpose, 'discard'>, string> = {
  hand: 'Pick the cards to Sift away.',
  'hand-one': 'Pick an ingredient to Infuse.',
  'top-3': 'Click the cards in the order you want to draw them.',
  'shelf-one': 'Pick a Shelf potion to Decant.',
};

const HAND_Y = 304;
const SLOT_Y = 128;
const ORDERS = { x: 8, y: 46, w: 134 };
/** The season's colour in the HUD. */
const SEASON_COLOR: Record<Season, PaletteKey> = { spring: 'L', summer: 'y', autumn: 'o', winter: 'c' };
const TICKET_H = 40;
const SIDE = { x: 498, y: 42, w: 134 };
const SHELF_Y = 146;
/** Where Shelf potion `i` sits: six to a row, or seven, closer together, when a boon takes the Shelf past six. */
function shelfSpot(s: RunState, i: number, x: number): [number, number] {
  const row = s.shelfSize > 6 ? 7 : 6;
  return [x + 10 + (i % row) * (row === 7 ? 18 : 21), SHELF_Y + 30 + Math.floor(i / row) * 22];
}
const TIER_COLOR: Record<string, PaletteKey> = { crude: 'h', fine: 'w', superb: 'c', masterwork: 'y', legendary: 'I' };

/**
 * A run in the shop: the Order Board, brewing, and the twilight and night screens drawn over the
 * shop. All rules come from the store; this scene only shows state and plays the events back.
 */
/** The short "year in Elmbrook" ending (GDD §13), after every Winter win. */
const YEAR_ENDING = [
  'The last snow slides off the stall roof and runs into the brook.',
  'A whole year of Elmbrook has passed through your cauldron: Bea\'s burns, Tobin\'s knees, the twins\' worst ideas, and whatever it is the Gardener wanted.',
  'The Guild has stopped counting your rent and started counting on you. Somewhere past the Night Market, the moon is already turning toward spring.',
].join('\n\n');

export class Run extends Phaser.Scene {
  private ui!: Phaser.GameObjects.Container;
  private mode: Mode = { kind: 'idle' };
  private pinned: number | null = null;
  /** The recipe picked for the cauldron's current cards, when they fit more than one. */
  private recipePick: { cauldron: string; recipe: string } | null = null;
  private confirm: 'endDay' | 'sludge' | null = null;
  private busy = false;
  private dispatching = false;
  private sky: SkyTime = 'afternoon';
  private weather: Weather = 'clear';
  private cauldronY = 195;
  /** The open Grimoire tab, drawn over any screen; null when closed. */
  private book: GrimoireTab | null = null;
  private bookPage = 0;
  /** Seasonal scene screens already shown this run, so each shows once (Snowed In, by week). */
  private scenesSeen = new Set<string>();
  /** Story scenes queued to read again from the Townsfolk page. */
  private reread: { name: string; lines: string[] }[] = [];
  /** The season's opening scene, still to show on a new run's first morning. */
  private openingPending = false;
  /** The scene screen over the shop right now (Enter walks on); null when none. */
  private intro: { done: () => void } | null = null;
  private settingsOpen = false;
  private tip!: Tooltip;
  /** The first-run tutorial, while it lasts (GDD §15.1). Kept across restarts for a new sky. */
  private tutorial: TutorialProgress | null = null;
  /** A fixture's run: never saved. */
  private fixtureRun = false;
  /** What the run that just ended changed in the profile, for the end screen. */
  private outcome: RunOutcome | null = null;
  private fixture: Fixture | null = null;

  constructor() {
    super('Run');
  }

  create(data: { fixture?: Fixture | null; resume?: boolean; saved?: RunState; season?: Season }) {
    pixelCamera(this);
    this.mode = { kind: 'idle' };
    this.pinned = null;
    this.confirm = null;
    this.busy = false;
    this.book = null;

    const fixture = data.fixture;
    this.fixture = fixture ?? null;
    this.outcome = null;
    this.fixtureRun = this.fixtureRun || !!fixture;
    if (data.saved) {
      // Continue from the title screen: the run saved in this browser, without the tutorial.
      store.load(data.saved);
      this.tutorial = null;
    } else if (data.resume && store.getState()) {
      // Coming back after the sky changed: keep the run (and the tutorial, unless it was skipped).
      if (loadProfile().tutorialDone) this.tutorial = null;
    } else if (fixture?.state) {
      store.load(fixture.state as RunState);
    } else {
      this.tutorial = fixture ? null : wantsTutorial() ? new TutorialProgress() : null;
      const seed = fixture?.seed ?? params.get('seed') ?? (this.tutorial ? TUTORIAL_SEED : `run-${Math.floor(Math.random() * 1e9)}`);
      const season = data.season ?? (fixture?.season as Season | undefined) ?? viewOverrides().season;
      store.dispatch({ type: 'startRun', seed, ...this.kit(fixture), ...(season ? { season } : {}), ...(fixture?.year ? { year: fixture.year } : {}), ...(fixture?.perks ? { perks: fixture.perks } : {}), ...(fixture?.boon ? { boon: fixture.boon } : {}), ...this.fromProfile(!!fixture) });
      // `today` sets the weather of the day the fixture starts on and of the day its steps end on.
      const today = () => fixture?.today && store.dispatch({ type: 'debug', op: 'setWeather', weather: fixture.today as Weather });
      today();
      for (const step of fixture?.steps ?? []) store.dispatch(stepAction(store.getState()!, step));
      today();
    }
    // A new run opens with its season's scene (not in the tutorial, with a chosen ?seed=, or once turned off).
    if (!data.saved && !data.resume) this.openingPending = fixture ? fixture.ui?.intro === 'season' : wantsIntros() && !this.tutorial && loadProfile().seasonOpenings;
    this.save();
    const state = store.getState()!;
    if (fixture?.ui?.dialog !== undefined) {
      const order = state.orders.at(fixture.ui.dialog);
      if (order) this.mode = { kind: 'dialog', order: order.id };
    }
    if (fixture?.ui?.discard) this.mode = { kind: 'select', purpose: 'discard', picked: fixture.ui.discard.map((i) => state.hand[i]!.uid) };
    if (fixture?.ui?.target) {
      const t = fixture.ui.target;
      const inst = state.hand[t.hand]!;
      const picked = (t.picked ?? []).map((i) => (targetsOf(inst.card) === 'top-3' ? state.drawPile[i]! : state.hand[i]!).uid);
      this.mode = { kind: 'select', purpose: targetsOf(inst.card)!, tincture: inst.uid, picked };
    }
    if (fixture?.ui?.stall) {
      const deck = sortedDeck(stallDeck(state));
      this.mode = {
        kind: 'stall', picked: (fixture.ui.stall.picked ?? []).map((i) => deck[i]!.uid),
        ...(fixture.ui.stall.swap !== undefined ? { swap: fixture.ui.stall.swap } : {}), ...(fixture.ui.stall.tab ? { tab: fixture.ui.stall.tab } : {}),
      };
    }
    if (fixture?.ui?.familiar !== undefined) this.mode = { kind: 'familiar', index: fixture.ui.familiar };
    if (fixture?.ui?.creek) this.mode = { kind: 'creek', pick: fixture.ui.creek };
    if (fixture?.ui?.pour) this.mode = { kind: 'pour' };
    if (fixture?.ui?.eventCard !== undefined) this.mode = { kind: 'event-card', choice: fixture.ui.eventCard };
    if (fixture?.ui?.scenesSeen) for (const k of fixture.ui.scenesSeen) this.scenesSeen.add(k);
    if (fixture?.ui?.grimoire) this.book = fixture.ui.grimoire;
    if (fixture?.ui?.page !== undefined) this.bookPage = fixture.ui.page;
    if (fixture?.ui?.recipe) this.recipePick = { cauldron: cauldronKey(state), recipe: fixture.ui.recipe };
    if (fixture?.ui?.tutorial) {
      // Show one tip: everything before it counts as done.
      const at = TIPS.findIndex((t) => t.id === fixture.ui!.tutorial);
      this.tutorial = new TutorialProgress(TIPS.slice(0, Math.max(at, 0)).map((t) => t.id));
    }

    this.drawShop(state, fixture);
    this.ui = this.add.container(0, 0);
    this.tip = new Tooltip(this);
    this.render();
    const peek = fixture?.ui?.inspect;
    if (peek !== undefined && state.hand[peek]) {
      const x = this.handX(peek, state.hand.length);
      this.tip.card(state.hand[peek]!.card, x, HAND_Y - 40, HAND_Y + 40, state.hand[peek]);
    }
    const shelfTip = fixture?.ui?.shelfTip;
    const potion = shelfTip !== undefined ? state.shelf[shelfTip] : undefined;
    if (potion) {
      const [px, py] = shelfSpot(state, shelfTip!, SIDE.x + 6);
      this.tip.text(recipeName(potion.recipe), potionLines(state, potion, this.pinned), px, py - 10, py + 10);
    }
    // Changes from outside this scene (the dev overlay, Playwright) redraw it too.
    const off = store.subscribe((_, events) => {
      // Every change is saved, whoever made it.
      this.save();
      if (this.dispatching || this.busy || events.length === 0) return;
      this.afterChange();
    });
    this.events.once('shutdown', off);
    this.input.mouse?.disableContextMenu();
    this.bindKeys();
    this.settingsOpen = false;
    if (fixture?.ui?.settings) this.openSettings();
    this.time.delayedCall(noAnim ? 0 : 400, () => markReady(this));
  }

  // ---------------------------------------------------------------- the room

  private drawShop(state: RunState, fixture?: Fixture | null) {
    const bg = shopBackdrop();
    this.sky = (fixture?.time as SkyTime | undefined) ?? viewOverrides().time ?? skyTime(state);
    this.weather = todaysWeather(state);
    if (bg.view && bg.window) {
      const season = viewOverrides().season ?? state.season;
      // Daily weather comes from the seeded Calendar unless a fixture or URL previews another.
      const weather = (fixture?.weather as Weather | undefined) ?? viewOverrides().weather ?? todaysWeather(state);
      this.add.image(0, 0, gradedView(this, bg.view, 'shop', season, this.sky, weather)).setOrigin(0);
      addWeather(this, bg.window, season, this.sky, weather);
    }
    this.add.image(0, 0, bg.texture).setOrigin(0);
    for (const l of bg.lights) {
      const glow = this.add.image(l.x, l.y, 'fx/glow').setBlendMode(Phaser.BlendModes.ADD).setScale(l.scale).setAlpha(0.55);
      if (!noAnim) this.tweens.add({ targets: glow, alpha: 0.42, scale: l.scale * 0.95, duration: 900 + l.x, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.cauldronY = bg.counterTop - 27;
    this.add.image(320, this.cauldronY, `prop/cauldron-${state.cauldronKind}`);
    const steam = this.add.image(320, this.cauldronY - 18, 'fx/glow').setTint(hex('v')).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.35);
    if (!noAnim) this.tweens.add({ targets: steam, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1 });
  }

  // ---------------------------------------------------------------- dispatch

  private dispatch(action: Action): GameEvent[] {
    if (this.busy) return [];
    const before = store.getState()!;
    this.dispatching = true;
    const events = store.dispatch(action);
    this.dispatching = false;
    const rejected = events.find((e) => e.type === 'rejected');
    if (rejected) {
      this.render();
      this.toast(rejected.reason, 'I');
      play('nope');
      return events;
    }
    const after = store.getState()!;
    const note = relicNote(events);
    if (note) this.toast(note);
    // A level of Friendship reached: toasted once the brew has played, so it isn't lost under it.
    const levelUp = levelUpNote(events);
    const resky = () => {
      this.afterChange();
      if (levelUp) {
        this.toast(levelUp, 'R', 128);
        play('levelUp');
      }
    };
    const brewing = events.some((e) => e.type === 'brewed' || e.type === 'sludge');
    // A brew's sounds play with its animation, in time with the numbers; everything else plays now.
    if (!brewing) playEvents(events);
    else if (noAnim) this.brewFinale(events, 0);
    if (brewing && !noAnim) {
      this.busy = true;
      this.playBrew(before, after, events).then(() => {
        this.busy = false;
        resky();
      });
    } else {
      resky();
    }
    return events;
  }

  /** The sky changes with the phase and the weather with the day; either means rebuilding the window, so restart the scene. */
  private afterChange() {
    const s = store.getState()!;
    const newSky = skyTime(s) !== this.sky && !params.get('time');
    const newWeather = todaysWeather(s) !== this.weather && !params.get('weather');
    if (newSky || newWeather) this.scene.restart({ resume: true });
    else this.render();
  }

  private toast(message: string, color: PaletteKey = 'Y', y = 92) {
    const t = pixelText(this, 320, y, message, { size: 8, color, stroke: 'k', align: 'center', wrap: 300 }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 12, alpha: 0, delay: noAnim ? 0 : 1400, duration: 500, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- render

  private render() {
    this.ui.removeAll(true);
    this.tip.hide();
    const s = store.getState()!;
    this.drawHud(s);
    if (s.phase === 'morning' || s.phase === 'brewing') {
      this.drawOrders(s);
      this.drawSide(s);
      this.drawCauldronSlots(s);
      this.drawHand(s);
      this.drawControls(s);
      if (this.mode.kind === 'dialog') this.drawDialog(s, this.mode.order);
    } else {
      this.drawEvening(s);
    }
    if (s.phase !== 'game-over' && s.phase !== 'victory') this.drawFamiliars(s);
    if (this.mode.kind === 'familiar') this.drawFamiliarCard(s, this.mode.index);
    if (this.book) {
      drawGrimoire(this, this.ui, s, this.book, this.tip, {
        tab: (t) => this.openBook(t),
        close: () => this.openBook(null),
        page: (n) => {
          this.bookPage = n;
          this.render();
        },
        story: (regular) => {
          const levels = townsfolkRows(s, this.storySeen()).find((x) => x.id === regular)?.stories.map((b) => b.level) ?? [];
          this.reread = levels.map((level) => storyScene(regular, level));
          this.render();
        },
        storySeen: this.storySeen(),
      }, this.bookPage);
    }
    this.drawIntro(s);
    // A regular's stories, read again from the Townsfolk page, one after another.
    const story = this.reread[0];
    if (story) {
      this.add2(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.6).setOrigin(0).setInteractive());
      this.seasonScene(story.name, story.lines, () => this.reread.shift());
    }
    this.drawTutorial(s);
  }

  /**
   * A scene screen over the morning: the season's opening on a new run, a weather's first time in
   * this save, or the Moonless Patron arriving for the finale. One at a time, in that order.
   */
  private drawIntro(s: RunState) {
    this.intro = null;
    if (s.phase !== 'morning' && s.phase !== 'brewing') return;
    const show = (intro: Intro, onDone: () => void, dontShow?: () => void) => {
      this.intro = { done: onDone };
      // Swallows clicks meant for the shop underneath.
      this.add2(this.add.rectangle(0, 0, 640, 360, hex('k'), 0.35).setOrigin(0).setInteractive());
      this.seasonScene(intro.name, intro.lines, onDone, dontShow && { label: 'Don\'t show again', onClick: dontShow });
    };
    if (this.openingPending) {
      const done = () => (this.openingPending = false);
      return show(SEASON_OPENING[s.season], done, () => {
        if (!this.fixtureRun) saveProfile({ seasonOpenings: false });
        done();
      });
    }
    const w = todaysWeather(s);
    const seen = `weather-${w}`;
    if (isIntroWeather(w) && !(w === 'fog' && s.day === NIGHT_SHIFT_DAY) && !this.scenesSeen.has(seen)) {
      const wanted = this.fixture ? this.fixture.ui?.intro === w : wantsIntros() && !this.tutorial && !loadProfile().weatherSeen.includes(w);
      if (wanted) {
        return show(WEATHER_INTRO[w], () => {
          this.scenesSeen.add(seen);
          if (!this.fixtureRun) saveProfile({ weatherSeen: [...loadProfile().weatherSeen, w] });
        });
      }
    }
    if (s.week === WEEKS && s.day === NIGHT_SHIFT_DAY && patronOf(s)?.id === 'moonless-patron' && !this.scenesSeen.has('moonless-patron')) {
      return show(patronArrival(this.grimoireHidden(s), s), () => this.scenesSeen.add('moonless-patron'));
    }
    // A regular's story (GDD §13): one a morning, when they have an order; never in the tutorial or on the finale night.
    const today = `story-${s.week}-${s.day}`;
    const finale = s.week === WEEKS && s.day === NIGHT_SHIFT_DAY;
    if (s.phase === 'morning' && !finale && !this.scenesSeen.has(today)) {
      const wanted = this.fixture ? this.fixture.ui?.intro === 'story' : wantsIntros() && !this.tutorial;
      const seen = this.storySeen();
      const due = wanted ? storyDue(s, seen) : null;
      if (due) {
        return show(storyScene(due.regular, due.level), () => {
          this.scenesSeen.add(today);
          if (!this.fixtureRun) saveProfile({ storySeen: [...loadProfile().storySeen, storyKey(due.regular, due.level)] });
        });
      }
    }
  }

  /** The story scenes this save has shown (a fixture's profile on a fixture run). */
  private storySeen(): string[] {
    return this.fixtureRun ? migrateProfile(this.fixture?.profile ?? null).storySeen : loadProfile().storySeen;
  }

  /** Settings over the run (Esc, or the button at the bottom right). */
  private openSettings() {
    this.settingsOpen = true;
    openSettings(this, () => (this.settingsOpen = false));
  }

  private openBook(tab: GrimoireTab | null, page?: number) {
    if (tab !== this.book) this.bookPage = 0;
    if (page !== undefined) this.bookPage = page;
    this.book = tab;
    this.render();
  }

  /** Familiar slots at the right end of the counter (GDD §11): hover for what one does, click to sell or move it. */
  private drawFamiliars(s: RunState) {
    const x0 = 590;
    this.text(x0 + 12, 258, `Familiars ${s.familiars.length}/${s.familiarSlots}`, { size: 7, color: 'a', align: 'center', shadow: true }).setOrigin(0.5, 0);
    for (let i = 0; i < s.familiarSlots; i++) {
      const x = x0 + (i % 2) * 24;
      const y = 280 + Math.floor(i / 2) * 24;
      const id = s.familiars[i];
      const slot = this.add2(this.add.rectangle(x, y, 20, 20, hex('k'), id ? 0.95 : 0.4).setStrokeStyle(1, hex(id ? RARITY_BORDER[codex.familiars.get(id)!.rarity] : 'n')));
      if (!id) continue;
      this.add2(this.add.image(x, y, familiarTexture(this, id)));
      const f = codex.familiars.get(id)!;
      slot.setInteractive({ useHandCursor: true });
      slot.on('pointerover', () => this.tip.text(f.name, [f.text, `Slot ${i + 1}: familiars score left to right. Click to sell or move.`], x, y - 12, y + 12));
      slot.on('pointerout', () => this.tip.hide());
      slot.on('pointerdown', () => {
        this.mode = { kind: 'familiar', index: i };
        this.render();
      });
    }
    // The Barn Owl: the top of the draw pile, face up, above the deck.
    if (hasFamiliar(s, 'barn-owl') && s.phase === 'brewing') {
      const top = s.drawPile.slice(0, FAMILIAR_RULES.owlPeek);
      this.text(36, 230, 'Next up', { size: 6, color: 'a', align: 'center', shadow: true }).setOrigin(0.5, 0);
      top.forEach((inst, i) => {
        const c = this.add2(createCard(this, 16 + i * 20, 254, inst.card, inst.woven, inst.modifier).setScale(0.35));
        c.setInteractive();
        this.inspect(c, inst.card, 0.35, inst);
      });
    }
  }

  private drawFamiliarCard(s: RunState, index: number) {
    const id = s.familiars[index];
    if (!id) return;
    const f = codex.familiars.get(id)!;
    const close = () => {
      this.mode = { kind: 'idle' };
      this.render();
    };
    const shade = this.add2(this.add.rectangle(0, 0, 640, 360, hex('K'), 0.55).setOrigin(0).setInteractive());
    shade.on('pointerdown', close);
    const x0 = 200;
    const y0 = 90;
    const w = 240;
    this.add2(panel(this, x0, y0, w, 120, 'k', 0.97, RARITY_BORDER[f.rarity]));
    this.add2(this.add.image(x0 + 24, y0 + 24, familiarTexture(this, id)).setScale(2));
    this.text(x0 + 46, y0 + 12, f.name, { size: 12, color: 'y' });
    this.text(x0 + 46, y0 + 28, `${f.rarity[0]!.toUpperCase()}${f.rarity.slice(1)} familiar · slot ${index + 1} of ${s.familiarSlots}`, { size: 7, color: 'a' });
    this.text(x0 + 12, y0 + 50, f.text, { size: 8, color: 'W', wrap: w - 24 });
    const by = y0 + 100;
    this.add2(button(this, x0 + 50, by, `Sell (${sellPrice(id)}g)`, () => {
      this.mode = { kind: 'idle' };
      void this.dispatch({ type: 'sellFamiliar', index });
    }, { w: 72, color: 'I' }));
    const move = (to: number) => {
      this.mode = { kind: 'familiar', index: to };
      void this.dispatch({ type: 'moveFamiliar', from: index, to });
    };
    this.add2(button(this, x0 + 112, by, '<', () => move(index - 1), { w: 20, enabled: index > 0 }));
    this.add2(button(this, x0 + 136, by, '>', () => move(index + 1), { w: 20, enabled: index < s.familiars.length - 1 }));
    this.add2(button(this, x0 + 196, by, 'Back', close, { w: 56 }));
  }

  /** A relic on offer: a tile with its token, name, tier and rule. */
  private offerRelic(x: number, y: number, id: string, onPick: () => void, dim = false) {
    const r = codex.relics.get(id)!;
    const tile = this.add2(panel(this, x - 32, y - 38, 64, 80, 'k', 0.95, 'y'));
    this.add2(this.add.image(x, y - 18, `token/relic-${r.tier}`).setScale(2));
    this.text(x, y + 2, r.name, { size: 7, color: 'y', align: 'center', wrap: 60 }).setOrigin(0.5, 0);
    this.text(x, y + 22, `Tier ${r.tier} relic`, { size: 6, color: 'a', align: 'center' }).setOrigin(0.5, 0);
    this.text(x, y + 46, r.text, { size: 6, color: 'w', align: 'center', wrap: 70 }).setOrigin(0.5, 0);
    if (dim) return void tile.setAlpha(0.4);
    tile.setInteractive({ useHandCursor: true }).on('pointerdown', onPick);
    tile.on('pointerover', () => tile.setStrokeStyle(2, hex('W')));
    tile.on('pointerout', () => tile.setStrokeStyle(1, hex('y')));
  }

  /** One of the Name-Taker's deals: the Curse you take, above the relic it buys or, instead, a Cursed Rare card. */
  private drawDeal(x: number, deal: NameTakerDeal, onTake: (take: 'relic' | 'card') => void) {
    const c = codex.curses.get(deal.curse)!;
    const r = codex.relics.get(deal.relic)!;
    const tile = this.add2(panel(this, x - 80, 86, 160, 164, 'k', 0.95, 'v'));
    this.add2(this.add.image(x - 64, 102, `token/curse-${c.severity}`));
    this.text(x - 54, 96, c.name, { size: 8, color: 'v' });
    this.text(x - 72, 110, `Curse, severity ${c.severity}. ${c.text}`, { size: 6, color: 'w', wrap: 144 });
    this.text(x, 132, deal.card ? 'for one of' : 'for', { size: 6, color: 'a', align: 'center' }).setOrigin(0.5, 0);
    this.add2(this.add.image(x - 64, 150, `token/relic-${r.tier}`));
    this.text(x - 54, 144, r.name, { size: 8, color: 'y' });
    this.text(x - 72, 158, `Tier ${r.tier} relic. ${r.text}`, { size: 6, color: 'w', wrap: 144 });
    if (deal.card) {
      const card = this.add2(createCard(this, x - 62, 206, deal.card, undefined, 'cursed').setScale(0.45));
      card.setInteractive();
      this.inspect(card, deal.card, 0.45, { modifier: 'cursed' });
      this.text(x - 46, 190, codex.ingredients.get(deal.card)?.name ?? deal.card, { size: 8, color: 'R' });
      this.text(x - 46, 202, `Rare card, Cursed: ${codex.modifiers.get('cursed')!.text}`, { size: 6, color: 'w', wrap: 116 });
      this.add2(button(this, x - 38, 238, 'Take the relic', () => onTake('relic'), { w: 72, color: 'v' }));
      this.add2(button(this, x + 38, 238, 'Take the card', () => onTake('card'), { w: 72, color: 'v' }));
    } else {
      this.add2(button(this, x, 238, 'Take the deal', () => onTake('relic'), { w: 80, color: 'v' }));
    }
    tile.setInteractive();
  }

  /** A short seasonal scene screen over the window: why something seasonal is happening, then on. */
  private seasonScene(name: string, lines: readonly string[], onDone: () => void, extra?: { label: string; onClick: () => void }) {
    const box = this.add2(panel(this, 150, 70, 340, 150, 'k', 0.9, 'c'));
    this.text(320, 84, name, { size: 14, color: 'c', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
    const body = this.text(320, 112, lines.join('\n\n'), { size: 8, color: 'W', stroke: 'k', align: 'center', wrap: 300 }).setOrigin(0.5, 0);
    // Longer scenes grow the panel down; the buttons sit under the words.
    const y = Math.max(198, 112 + body.height + 22);
    box.setSize(340, y - 70 + 22);
    const walkOn = () => {
      onDone();
      this.render();
    };
    if (!extra) return void this.add2(button(this, 320, y, 'Walk on', walkOn, { w: 72, color: 'Y' }));
    this.add2(button(this, 270, y, 'Walk on', walkOn, { w: 72, color: 'Y' }));
    this.add2(button(this, 370, y, extra.label, () => {
      extra.onClick();
      this.render();
    }, { w: 104 }));
  }

  /** A familiar on offer: a tile with its sprite, name and rule. */
  private offerFamiliar(x: number, y: number, id: string, onPick: () => void, dim = false) {
    const f = codex.familiars.get(id)!;
    const tile = this.add2(panel(this, x - 32, y - 38, 64, 80, 'k', 0.95, RARITY_BORDER[f.rarity]));
    this.add2(this.add.image(x, y - 18, familiarTexture(this, id)).setScale(2));
    this.text(x, y + 2, f.name, { size: 7, color: 'y', align: 'center', wrap: 60 }).setOrigin(0.5, 0);
    this.text(x, y + 46, f.text, { size: 6, color: 'w', align: 'center', wrap: 70 }).setOrigin(0.5, 0);
    this.text(x, y + 22, `${f.rarity[0]!.toUpperCase()}${f.rarity.slice(1)}`, { size: 6, color: 'a', align: 'center' }).setOrigin(0.5, 0);
    if (dim) return void tile.setAlpha(0.4);
    tile.setInteractive({ useHandCursor: true }).on('pointerdown', onPick);
    tile.on('pointerover', () => tile.setStrokeStyle(2, hex('y')));
    tile.on('pointerout', () => tile.setStrokeStyle(1, hex(RARITY_BORDER[f.rarity])));
  }

  /** Hover help for a card drawn at (x, y) at the given scale (GDD §15.1). */
  private inspect(card: Phaser.GameObjects.Container, id: string, scale = 1, extras: CardExtras = {}) {
    card.on('pointerover', () => this.tip.card(id, card.x, card.y - 40 * scale, card.y + 40 * scale, extras));
    card.on('pointerout', () => this.tip.hide());
  }

  private drawTutorial(s: RunState) {
    const t = this.tutorial;
    if (!t) return;
    if (t.finished(s)) {
      saveProfile({ tutorialDone: true });
      this.tutorial = null;
      return;
    }
    const preview = s.phase === 'brewing' ? this.previewOf(s).kind : 'empty';
    const tip = t.current(s, { dialog: this.mode.kind === 'dialog', book: this.book !== null, preview });
    if (!tip || (this.book && tip.id !== 'grimoire')) return;
    this.drawTip(tip, () => {
      t.dismiss(tip.id);
      this.render();
    });
  }

  private drawTip(tip: Tip, gotIt: () => void) {
    if (tip.target) {
      const r = tip.target;
      this.add2(this.add.rectangle(r.x, r.y, r.w, r.h).setOrigin(0).setStrokeStyle(2, hex('y')));
    }
    const w = 230;
    const x = Math.max(4, Math.min(636 - w, tip.at.x - w / 2));
    const body = pixelText(this, x + 8, tip.at.y + 18, tip.text, { size: 8, color: 'W', wrap: w - 16 });
    const h = 18 + body.height + (tip.until ? 8 : 28);
    this.add2(panel(this, x, tip.at.y, w, h, 'k', 0.97, 'y'));
    this.text(x + 8, tip.at.y + 5, 'Tutorial', { size: 7, color: 'v' });
    this.add2(body);
    if (!tip.until) this.add2(button(this, x + w / 2, tip.at.y + h - 14, 'Got it', gotIt, { w: 56, color: 'Y' }));
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.ui.add(o);
    return o;
  }

  private text(x: number, y: number, str: string, opts: Parameters<typeof pixelText>[4] = {}) {
    return this.add2(pixelText(this, x, y, str, opts));
  }

  private drawHud(s: RunState) {
    const year = this.text(10, 2, `Year ${s.year} · ${s.season[0]!.toUpperCase()}${s.season.slice(1)}`, { size: 7, color: SEASON_COLOR[s.season], shadow: true });
    // Hover for who is brewing and in what (GDD §12).
    const witch = codex.witches.get(s.witch)!;
    const pot = cauldronOf(s);
    year.setInteractive().on('pointerover', () => this.tip.text(`${witch.name}, ${pot.name}`, [`${witch.name}: ${witch.quirk}`, `${pot.name}: ${pot.text}`], year.x + year.width / 2, year.y + 10));
    year.on('pointerout', () => this.tip.hide());
    this.text(10, 10, dayLabel(s), { size: 12, color: 'a', shadow: true });
    this.text(630, 8, `${s.gold} gold`, { size: 12, color: 'y', shadow: true }).setOrigin(1, 0);
    if (s.phase === 'brewing') this.text(10, 24, `Brews ${s.brewsLeft} · Discards ${s.discardsLeft}`, { size: 8, color: 'w', shadow: true });
    else if (s.phase === 'morning') this.text(10, 24, s.day === NIGHT_SHIFT_DAY ? 'The night customers are here' : "Today's orders", { size: 8, color: 'w', shadow: true });
    if (s.phase === 'morning' || s.phase === 'brewing') {
      // Today's weather, festival and sky event (GDD §4.2); hover for the rules.
      const today = this.text(10, 34, todayLine(s), { size: 7, color: 'c', shadow: true });
      today.setInteractive().on('pointerover', () => this.tip.text('Today', todayRules(s), today.x + today.width / 2, today.y + 10));
      today.on('pointerout', () => this.tip.hide());
    }
    this.text(630, 24, `Rent ${rentOf(s)}g after the Night Shift`, { size: 7, color: 'a', shadow: true }).setOrigin(1, 0);
    this.drawCommissions(s);
    if (s.phase !== 'game-over' && s.phase !== 'victory') this.drawRibbon(s);
    const hidden = this.grimoireHidden(s);
    this.add2(button(this, 478, 16, hidden ? 'Grimoire hidden' : 'Grimoire (G)', () => this.toggleBook(s), { w: 74, enabled: !hidden }));
    this.add2(button(this, 606, 348, 'Settings', () => this.openSettings(), { w: 56 }));
    this.drawRelics(s);
  }

  /** Relics, then Curses, as tokens between the Grimoire and the gold. Hover one for what it does. */
  /** Guild Commissions in progress, under the rent; hover for each one's goal. */
  private drawCommissions(s: RunState) {
    if (!s.commissions.length || s.phase === 'game-over' || s.phase === 'victory') return;
    const line = this.text(630, 33, `Guild: ${s.commissions.map((a) => `${codex.commissions.get(a.id)!.name} ${a.progress}/${goalOf(a.id).target}`).join(' · ')}`, { size: 7, color: 'l', shadow: true }).setOrigin(1, 0);
    const lines = s.commissions.map((a) => {
      const c = codex.commissions.get(a.id)!;
      return `${c.name} (${a.progress}/${goalOf(a.id).target}): ${c.goal} Due ${commissionDue(a.dueWeek, s.week)}. Reward: ${commissionReward(a.id)}.`;
    });
    line.setInteractive().on('pointerover', () => this.tip.text('Guild Commissions', lines, line.x - line.width / 2, line.y + 10));
    line.on('pointerout', () => this.tip.hide());
  }

  private drawRelics(s: RunState) {
    const held = [
      ...s.relics.map((id) => { const r = codex.relics.get(id)!; return { name: r.name, text: r.text, kind: `Tier ${r.tier} relic`, texture: `token/relic-${r.tier}` }; }),
      ...s.curses.map((id) => { const c = codex.curses.get(id)!; return { name: c.name, text: c.text, kind: `Curse, severity ${c.severity}`, texture: `token/curse-${c.severity}` }; }),
    ];
    const room = 4;
    const shown = held.length > room ? held.slice(0, room - 1) : held;
    const y = 16;
    shown.forEach((h, i) => {
      const x = 524 + i * 13;
      const img = this.add2(this.add.image(x, y, h.texture)).setInteractive();
      img.on('pointerover', () => this.tip.text(h.name, [h.kind, h.text], x, y - 8, y + 8));
      img.on('pointerout', () => this.tip.hide());
    });
    if (held.length > room) {
      const rest = held.slice(room - 1);
      const x = 524 + (room - 1) * 13;
      const more = this.text(x, y, `+${rest.length}`, { size: 7, color: 'y', shadow: true }).setOrigin(0.5);
      more.setInteractive().on('pointerover', () => this.tip.text('Also held', rest.map((h) => `${h.name}: ${h.text}`), x, y - 8, y + 8));
      more.on('pointerout', () => this.tip.hide());
    }
  }

  /** The Moonless Patron hides the Grimoire for the finale's Night Shift (GDD §10). */
  private grimoireHidden(s: RunState) {
    return twistNow(s) === 'grimoire-hidden' && !blessingTonight(s, 'candle-in-the-window') && (s.phase === 'morning' || s.phase === 'brewing');
  }

  private toggleBook(s: RunState) {
    if (this.book) return this.openBook(null);
    if (this.grimoireHidden(s)) return this.toast('The Moonless Patron has hidden your Grimoire tonight.');
    this.openBook('recipes');
  }

  /** Where am I: this week's days, then today's steps, the current one lit (GDD §15.1). */
  private drawRibbon(s: RunState) {
    const { days, steps } = stages(s);
    const color = { done: 'a', now: 'y', next: 'h' } as const;
    const row = (items: { label: string; mark: keyof typeof color }[], y: number, sep: string) => {
      const parts = items.flatMap((it, i) => [
        ...(i ? [this.text(0, y, sep, { size: 7, color: 'h', shadow: true })] : []),
        this.text(0, y, it.label, { size: it.mark === 'now' ? 8 : 7, color: color[it.mark], shadow: true }),
      ]);
      const width = parts.reduce((w, t) => w + t.width + 4, -4);
      let x = 320 - width / 2;
      for (const t of parts) {
        t.setX(Math.round(x)).setY(y + (t.height < 10 ? 1 : 0));
        x += t.width + 4;
      }
    };
    this.add2(this.add.rectangle(320, 17, 236, 28, hex('K'), 0.55).setStrokeStyle(1, hex('n'), 0.6));
    row(days.map((d) => ({ ...d, label: d.label === 'Night' ? 'Night Shift' : `Day ${d.label}` })), 5, '·');
    row(steps, 17, '›');
  }

  private ticketY(i: number) {
    return ORDERS.y + i * (TICKET_H + 4);
  }

  private drawOrders(s: RunState) {
    s.orders.forEach((o, i) => {
      const y = this.ticketY(i);
      const open = o.status === 'open';
      // The patron's order stands out: it is the night's featured guest (GDD §10).
      const patron = isPatron(o.customer);
      const bg = this.add2(panel(this, ORDERS.x, y, ORDERS.w, TICKET_H, patron ? 'W' : 'w', 0.95, o.id === this.pinned ? 'y' : patron ? 'v' : 'n'));
      if (o.id === this.pinned || patron) bg.setStrokeStyle(2, hex(o.id === this.pinned ? 'y' : 'v'));
      const friend = isRegular(o.customer) ? friendLevelOf(s, o.customer) : null;
      this.text(ORDERS.x + 5, y + 3, customerName(o.customer), { size: 8, color: patron ? 'P' : 'k' });
      if (o.expiresIn !== null && open) this.text(ORDERS.x + ORDERS.w - 5, y + 3, `${o.expiresIn} brew${o.expiresIn === 1 ? '' : 's'} left`, { size: 7, color: 'r' }).setOrigin(1, 0);
      else if (friend !== null) this.text(ORDERS.x + ORDERS.w - 5, y + 3, `♥ ${friend}`, { size: 7, color: 'R' }).setOrigin(1, 0);
      if (s.fog && open) {
        this.text(ORDERS.x + 5, y + 14, 'Hidden in the fog', { size: 8, color: 'h' });
        this.text(ORDERS.x + 5, y + 26, 'Brew or Discard to see it', { size: 7, color: 'h' });
      } else {
        this.text(ORDERS.x + 5, y + 14, `${requestText(o)}${unknownRecipe(s, o) ? ' (new)' : ''}${o.needsUmbra ? ' + Umbra' : ''}${o.needsTag ? ` + ${cap(o.needsTag)}` : ''}`, { size: 8, color: 'B' });
        this.text(ORDERS.x + 5, y + 26, orderTerms(o), { size: 7, color: 'r' });
      }
      if (o.bonus && !s.fog) this.text(ORDERS.x + ORDERS.w - 5, y + 26, '★', { size: 8, color: 'o' }).setOrigin(1, 0);
      if (!open) {
        bg.setAlpha(0.6);
        this.text(ORDERS.x + ORDERS.w / 2, y + TICKET_H / 2, o.status === 'filled' ? 'FILLED' : o.expiresIn === 0 ? 'LEFT' : 'DECLINED', { size: 10, font: 'display', color: o.status === 'filled' ? 'G' : 'r', stroke: 'w' })
          .setOrigin(0.5).setAngle(-8);
      }
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.busy) return;
        if (s.fog && open) return this.toast('The fog hides this order. Brew or Discard once to see it.');
        this.mode = { kind: 'dialog', order: o.id };
        this.render();
      });
    });
    if (s.orders.length === 0) this.text(ORDERS.x + 4, ORDERS.y, 'No orders today.', { size: 8, color: 'a', shadow: true });
  }

  private drawSide(s: RunState) {
    // Preview of the brew in the cauldron (GDD §6.1).
    this.add2(panel(this, SIDE.x, SIDE.y, SIDE.w, 98));
    const x = SIDE.x + 6;
    const preview = this.previewOf(s);
    const patron = s.day === NIGHT_SHIFT_DAY ? patronOf(s) : null;
    const blocked = s.phase === 'brewing' && preview.kind !== 'empty' ? brewBlocked(s, s.cauldron) : null;
    if (s.phase === 'morning' && patron) {
      // Tonight's patron and their twist (GDD §10).
      this.text(x, SIDE.y + 5, patron.name, { size: 8, color: 'v', wrap: SIDE.w - 12 });
      const twist = this.text(x, SIDE.y + 19, patronTwistText(s, patron), { size: 7, color: 'W', wrap: SIDE.w - 12 });
      this.text(x, SIDE.y + 23 + twist.height, `Fill their order: ${extraPay(patron.id)}.`, { size: 7, color: 'l', wrap: SIDE.w - 12 });
    } else if (s.phase === 'morning') {
      this.text(x, SIDE.y + 5, 'The Order Board', { size: 8, color: 'y' });
      this.text(x, SIDE.y + 19, 'Click an order to read it. Open the shop when you are ready to brew.', { size: 7, color: 'a', wrap: SIDE.w - 12 });
    } else if (blocked) {
      this.text(x, SIDE.y + 5, 'Not tonight', { size: 10, color: 'R' });
      this.text(x, SIDE.y + 21, `${blocked}.`, { size: 7, color: 'a', wrap: SIDE.w - 12 });
    } else if (preview.kind === 'empty') {
      this.text(x, SIDE.y + 5, 'Cauldron', { size: 8, color: 'y' });
      this.text(x, SIDE.y + 19, `Click ingredients to add them. Two make a potion${s.cauldronSlots > 2 ? ', three a stronger one' : ''}.`, { size: 7, color: 'a', wrap: SIDE.w - 12 });
    } else if (s.blindBrew) {
      // Pip & Quill's Dare (a dusk event): no peeking at this one.
      this.text(x, SIDE.y + 5, 'Blindfolded', { size: 10, color: 'v' });
      this.text(x, SIDE.y + 21, "Pip & Quill's dare: no preview for this brew. Brew it and see what you made.", { size: 7, color: 'a', wrap: SIDE.w - 12 });
    } else if (preview.kind === 'sludge') {
      this.text(x, SIDE.y + 5, 'Sludge!', { size: 10, color: 'R' });
      this.text(x, SIDE.y + 21, "These essences don't make any recipe. Brewing it adds a Sludge card to your deck.", { size: 7, color: 'a', wrap: SIDE.w - 12 });
    } else {
      const choice = preview.options.length > 1;
      this.text(x, SIDE.y + 5, preview.known ? recipeName(preview.recipe) : '??? (new recipe)', { size: 8, color: 'y', wrap: SIDE.w - (choice ? 48 : 12) });
      const pattern = codex.recipes.get(preview.recipe)!.pattern;
      // With a choice, the pips show which essences this pick uses, known or not.
      if (preview.known || choice) pattern.forEach((e, i) => e !== 'any' && this.add2(this.add.image(x + 3 + i * 9, SIDE.y + 22, `pip/${e}`)));
      // The family, so a Lunar-essence potion isn't mistaken for the Lunar family (playtest, Oct 16).
      if (preview.known) this.text(x + (pattern.length * 9) + 2, SIDE.y + 18, familiesName(preview.recipe), { size: 7, color: 'a' });
      if (choice) {
        // These cards fit more than one recipe: click (or R) for the next.
        const at = preview.options.indexOf(preview.recipe);
        const next = this.add2(button(this, SIDE.x + SIDE.w - 22, SIDE.y + 11, `${at + 1}/${preview.options.length} >`, () => this.nextRecipe(s), { w: 34 }));
        next.setScale(0.85);
        this.text(SIDE.x + SIDE.w - 6, SIDE.y + 20, 'recipe', { size: 6, color: 'a' }).setOrigin(1, 0);
      }
      this.text(x, SIDE.y + 30, `Potency ${preview.potency} × Harmony ${preview.harmony}`, { size: 7, color: 'w' });
      this.text(x, SIDE.y + 42, `= ${preview.quality} · ${TIER_NAME[preview.tier]}`, { size: 10, color: TIER_COLOR[preview.tier]! });
      if (!preview.known) this.text(x, SIDE.y + 56, 'Experiment: one tier lower this time.', { size: 7, color: 'v', wrap: SIDE.w - 12 });
      // Tonight's patron changed the score (the Lamplighter's wicks, Sir Bramble, the Frost Warden): say by how much.
      const twist = preview.steps.find((x) => x.source === 'patron')?.note;
      if (twist) this.text(x, SIDE.y + (preview.known ? 56 : 66), `${customerName(patronOf(s)!.id)}: ${twist}`, { size: 7, color: 'v', wrap: SIDE.w - 12 });
      const potion = previewPotion(preview, s.cauldron)!;
      const target = bestOrderFor(s, potion, this.pinned);
      let dest: string;
      if (target) {
        const { pay, tip } = payout(potion, target, s.familiars, s);
        dest = `→ ${customerName(target.customer)}: +${pay + tip}g`;
      } else {
        dest = s.shelf.length < s.shelfSize ? '→ onto the Shelf' : '→ Shelf full: it spills!';
      }
      this.text(x, SIDE.y + 80, `${dest}${preview.copies > 1 ? ` (×${preview.copies})` : ''}`, { size: 7, color: target ? 'l' : 'a', wrap: SIDE.w - 12 });
    }

    // The Shelf (GDD §6.5).
    this.add2(panel(this, SIDE.x, SHELF_Y, SIDE.w, 70));
    this.text(x, SHELF_Y + 4, `Shelf ${s.shelf.length}/${s.shelfSize}`, { size: 8, color: 'y' });
    const pouring = this.mode.kind === 'pour';
    if (s.shelf.length) {
      const pour = this.add2(button(this, SIDE.x + SIDE.w - 30, SHELF_Y + 9, pouring ? 'Cancel' : 'Pour out', () => {
        this.mode = pouring ? { kind: 'idle' } : { kind: 'pour' };
        this.render();
      }, { w: 52, color: pouring ? 'Y' : 'W' }));
      pour.setScale(0.85);
    }
    s.shelf.forEach((p, i) => {
      const [px, py] = shelfSpot(s, i, x);
      const img = this.add2(this.add.image(px, py, `potion/${p.family}`));
      this.text(px, py + 9, TIER_NAME[p.tier][0]!, { size: 6, color: TIER_COLOR[p.tier]!, stroke: 'k' }).setOrigin(0.5, 0);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => this.tip.text(recipeName(p.recipe), potionLines(s, p, this.pinned), px, py - 10, py + 10));
      img.on('pointerout', () => this.tip.hide());
      img.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // Right-click, or a click while pouring, pours it away.
        if (pointer.rightButtonDown() || this.mode.kind === 'pour') {
          this.mode = { kind: 'idle' };
          this.tip.hide();
          return void this.dispatch({ type: 'pourOut', uid: p.uid });
        }
        if (this.mode.kind === 'select' && this.mode.purpose === 'shelf-one') {
          const tincture = this.mode.tincture!;
          this.mode = { kind: 'idle' };
          return void this.dispatch({ type: 'playTincture', uid: tincture, targets: [p.uid] });
        }
        this.deliverShelf(s, p);
      });
    });
    const decanting = this.mode.kind === 'select' && this.mode.purpose === 'shelf-one';
    if (decanting || pouring) this.add2(this.add.rectangle(SIDE.x, SHELF_Y, SIDE.w, 70).setOrigin(0).setStrokeStyle(2, hex('Y')));
    const hint = decanting ? 'Click a potion to Decant it.' : pouring ? 'Click a potion to pour it away.' : s.shelf.length ? 'Click a potion to deliver it.' : 'Potions you keep wait here.';
    this.text(x, SHELF_Y + 56, hint, { size: 7, color: decanting || pouring ? 'y' : 'a' });
  }

  private deliverShelf(s: RunState, p: Potion) {
    if (s.phase !== 'brewing') return this.toast('Open the shop first.');
    const order = bestOrderFor(s, p, this.pinned);
    if (!order) return this.toast('No open order wants that potion.');
    this.dispatch({ type: 'deliver', order: order.id, potion: p.uid });
  }

  private drawCauldronSlots(s: RunState) {
    if (s.phase !== 'brewing') return;
    const n = s.cauldronSlots;
    for (let i = 0; i < n; i++) {
      const x = 320 + (i - (n - 1) / 2) * 40;
      const card = s.cauldron[i];
      if (!card) {
        this.add2(this.add.rectangle(x, SLOT_Y, 34, 46, hex('k'), 0.35).setStrokeStyle(1, hex('a'), 0.5));
        continue;
      }
      const c = this.add2(createCard(this, x, SLOT_Y, card.card, card.woven, card.modifier).setScale(0.6));
      c.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dispatch({ type: 'unslot', uid: card.uid }));
      this.inspect(c, card.card, 0.6, card);
    }
  }

  private handX(i: number, n: number) {
    const spacing = Math.min(62, 470 / Math.max(n, 1));
    return 340 + (i - (n - 1) / 2) * spacing;
  }

  private drawHand(s: RunState) {
    // Draw pile at the left end of the counter.
    for (let i = 0; i < 3; i++) {
      const back = this.add2(this.add.image(34 + i, HAND_Y - i, 'card/back'));
      back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openBook('deck'));
    }
    this.text(36, HAND_Y + 37, `Draw ${s.drawPile.length}`, { size: 7, color: 'a', align: 'center', shadow: true }).setOrigin(0.5, 0);
    // The discard pile: click to see what's in it.
    const discarded = this.text(36, HAND_Y + 46, `Discarded ${s.discardPile.length}`, { size: 7, color: 'a', align: 'center', shadow: true }).setOrigin(0.5, 0);
    discarded.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openBook('deck', DECK_VIEWS.indexOf('discard')));

    const picked = this.mode.kind === 'select' ? this.mode.picked : [];
    const tincture = this.mode.kind === 'select' ? this.mode.tincture : undefined;
    s.hand.forEach((inst, i) => {
      const x = this.handX(i, s.hand.length);
      const lifted = picked.includes(inst.uid) || inst.uid === tincture;
      const card = createCard(this, x, lifted ? HAND_Y - 14 : HAND_Y, inst.card, inst.woven, inst.modifier);
      if (lifted) card.addAt(this.add.rectangle(0, 0, 60, 80).setStrokeStyle(2, hex(inst.uid === tincture ? 'Y' : 'R')), 0);
      this.add2(card);
      card.setInteractive({ useHandCursor: s.phase === 'brewing' });
      this.inspect(card, inst.card, 1, inst);
      if (s.phase !== 'brewing') {
        card.setAlpha(0.85);
        return;
      }
      const restY = card.y;
      card.on('pointerover', () => this.tweens.add({ targets: card, y: restY - 8, duration: 90 }));
      card.on('pointerout', () => this.tweens.add({ targets: card, y: restY, duration: 90 }));
      card.on('pointerdown', () => this.clickCard(s, inst));
    });
  }

  private clickCard(s: RunState, inst: CardInstance) {
    if (this.busy) return;
    if (this.mode.kind === 'select') {
      const mode = this.mode;
      if (inst.uid === mode.tincture) return;
      if (mode.purpose === 'top-3' || mode.purpose === 'shelf-one') return;
      if (mode.purpose === 'hand-one') {
        if (!codex.ingredients.has(inst.card)) return this.toast('Only an ingredient can be infused.');
        mode.picked = mode.picked.includes(inst.uid) ? [] : [inst.uid];
        return this.render();
      }
      mode.picked = mode.picked.includes(inst.uid) ? mode.picked.filter((u) => u !== inst.uid) : [...mode.picked, inst.uid].slice(-5);
      return this.render();
    }
    this.confirm = null;
    if (codex.ingredients.has(inst.card)) return void this.dispatch({ type: 'slot', uid: inst.uid });
    const targets = codex.tinctures.has(inst.card) ? targetsOf(inst.card) : undefined;
    if (targets) {
      if (targets === 'shelf-one' && s.shelf.length === 0) return this.toast('Your Shelf is empty: nothing to Decant.');
      if (targets === 'top-3' && s.drawPile.length + s.discardPile.length === 0) return this.toast('Your draw pile is empty.');
      this.mode = { kind: 'select', purpose: targets, tincture: inst.uid, picked: [] };
      this.toast(PICK_PROMPT[targets]);
      return this.render();
    }
    if (codex.tinctures.has(inst.card)) return void this.dispatch({ type: 'playTincture', uid: inst.uid });
    this.toast('Sludge does nothing. Discard it, or burn it at the Hearth.');
  }

  private drawControls(s: RunState) {
    const y = 244;
    if (s.phase === 'morning') {
      this.add2(button(this, 320, y, 'Open the shop', () => this.dispatch({ type: 'openShop' }), { w: 96, color: 'Y' }));
      return;
    }
    if (this.mode.kind === 'select') {
      const mode = this.mode;
      const n = mode.picked.length;
      const top = mode.purpose === 'top-3' ? Math.min(3, s.drawPile.length) : 0;
      const label = mode.purpose === 'discard' ? `Discard ${n}`
        : mode.purpose === 'hand' ? `Sift ${n}`
          : mode.purpose === 'hand-one' ? 'Infuse'
            : mode.purpose === 'top-3' ? (n === top ? 'Put back' : 'Keep order') : null;
      if (label) this.add2(button(this, 290, y, label, () => this.confirmSelect(), { w: 64, enabled: n > 0 || mode.purpose === 'top-3' }));
      if (mode.purpose === 'top-3') this.drawPeek(s, mode.picked);
      this.add2(button(this, 360, y, 'Cancel', () => {
        this.mode = { kind: 'idle' };
        this.render();
      }, { w: 52 }));
      return;
    }
    const preview = this.previewOf(s);
    const brewLabel = this.confirm === 'sludge' ? 'Brew Sludge?' : `Brew (${s.brewsLeft})`;
    const blocked = brewBlocked(s, s.cauldron) !== null;
    this.add2(button(this, 320, y, brewLabel, () => this.brew(), { w: 76, color: this.confirm === 'sludge' ? 'I' : 'Y', enabled: preview.kind !== 'empty' && s.brewsLeft > 0 && !blocked }));
    this.add2(button(this, 236, y, `Discard (${s.discardsLeft})`, () => this.startDiscard(s), { w: 76, enabled: s.discardsLeft > 0 }));
    const open = s.orders.filter((o) => o.status === 'open').length;
    const endLabel = this.confirm === 'endDay' ? `Decline ${open} & end?` : 'End day';
    this.add2(button(this, 580, y, endLabel, () => this.endDay(), { w: this.confirm === 'endDay' ? 96 : 60, color: this.confirm === 'endDay' ? 'I' : 'W' }));
  }

  private startDiscard(s: RunState) {
    if (s.discardsLeft <= 0) return this.toast('No Discards left today.');
    this.confirm = null;
    this.mode = { kind: 'select', purpose: 'discard', picked: [] };
    this.render();
  }

  private confirmSelect() {
    if (this.mode.kind !== 'select') return;
    const { purpose, picked, tincture } = this.mode;
    this.mode = { kind: 'idle' };
    if (purpose === 'top-3') {
      // A partial order keeps the pile as it was.
      const top = Math.min(3, store.getState()!.drawPile.length);
      return void this.dispatch({ type: 'playTincture', uid: tincture!, targets: picked.length === top ? picked : [] });
    }
    if (picked.length === 0) return this.render();
    if (purpose === 'discard') this.dispatch({ type: 'discard', uids: picked });
    else this.dispatch({ type: 'playTincture', uid: tincture!, targets: picked });
  }

  /** Taste Test: the top cards of the draw pile, numbered in the order the player clicks them. */
  private drawPeek(s: RunState, picked: number[]) {
    const top = s.drawPile.slice(0, 3);
    this.add2(panel(this, 196, 118, 248, 112, 'k', 0.95, 'n'));
    this.text(320, 122, 'Taste Test: top of your draw pile', { size: 8, color: 'y', align: 'center' }).setOrigin(0.5, 0);
    top.forEach((inst, i) => {
      const x = 320 + (i - (top.length - 1) / 2) * 70;
      const card = this.add2(createCard(this, x, 178, inst.card, inst.woven, inst.modifier));
      const at = picked.indexOf(inst.uid);
      if (at >= 0) {
        card.addAt(this.add.rectangle(0, 0, 60, 80).setStrokeStyle(2, hex('Y')), 0);
        this.text(x + 24, 140, String(at + 1), { size: 10, color: 'y', stroke: 'k' }).setOrigin(0.5, 0);
      }
      card.setInteractive({ useHandCursor: true });
      this.inspect(card, inst.card, 1, inst);
      card.on('pointerdown', () => {
        if (this.mode.kind !== 'select') return;
        this.mode.picked = at >= 0 ? picked.filter((u) => u !== inst.uid) : [...picked, inst.uid];
        this.render();
      });
    });
  }

  /** The brew in the cauldron, as the recipe picked for these cards if there is one. */
  private previewOf(s: RunState) {
    const pick = this.recipePick?.cauldron === cauldronKey(s) ? this.recipePick.recipe : undefined;
    return previewBrew(s, s.cauldron, s.hand, pick);
  }

  /** Brew the next recipe these cards fit. */
  private nextRecipe(s: RunState) {
    const preview = this.previewOf(s);
    if (preview.kind !== 'potion' || preview.options.length < 2) return;
    const recipe = preview.options[(preview.options.indexOf(preview.recipe) + 1) % preview.options.length]!;
    this.recipePick = { cauldron: cauldronKey(s), recipe };
    this.confirm = null;
    this.render();
  }

  private brew() {
    const s = store.getState()!;
    const preview = this.previewOf(s);
    // GDD §6.2: an invalid mix warns first, then makes Sludge if you insist. Blindfolded, no warning.
    if (preview.kind === 'sludge' && this.confirm !== 'sludge' && !s.blindBrew) {
      this.confirm = 'sludge';
      return this.render();
    }
    this.confirm = null;
    const potion = previewPotion(preview, s.cauldron);
    const target = potion ? bestOrderFor(s, potion, this.pinned) : null;
    if (target?.id === this.pinned) this.pinned = null;
    // Name the recipe only when the cards fit more than one, so a plain brew stays a plain action.
    const recipe = preview.kind === 'potion' && preview.options.length > 1 ? { recipe: preview.recipe } : {};
    this.dispatch(target ? { type: 'brew', deliverTo: target.id, ...recipe } : { type: 'brew', ...recipe });
  }

  private endDay() {
    const s = store.getState()!;
    const open = s.orders.filter((o) => o.status === 'open').length;
    if (open > 0 && this.confirm !== 'endDay') {
      this.confirm = 'endDay';
      return this.render();
    }
    this.confirm = null;
    this.pinned = null;
    this.dispatch({ type: 'endDay' });
  }

  // ---------------------------------------------------------------- order dialogue

  private drawDialog(s: RunState, id: number) {
    const o = s.orders.find((x) => x.id === id);
    if (!o) return;
    const shade = this.add2(this.add.rectangle(0, 0, 640, 360, hex('K'), 0.55).setOrigin(0).setInteractive());
    shade.on('pointerdown', () => this.closeDialog());
    const x0 = 170;
    const y0 = 70;
    const w = 300;
    this.add2(panel(this, x0, y0, w, 150, 'k', 0.97, 'n'));
    this.text(x0 + 12, y0 + 10, customerName(o.customer), { size: 12, color: isPatron(o.customer) ? 'v' : 'y' });
    if (isRegular(o.customer)) this.text(x0 + w - 12, y0 + 12, friendshipLine(friendshipOf(s, o.customer)), { size: 8, color: 'R' }).setOrigin(1, 0);
    this.text(x0 + 12, y0 + 28, customerBlurb(o.customer), { size: 7, color: 'a' });
    this.text(x0 + 12, y0 + 44, `"${customerLine(o)}"`, { size: 8, color: 'W', wrap: w - 24 });
    this.text(x0 + 12, y0 + 70, `Wants: ${requestText(o, true)}`, { size: 8, color: 'w' });
    this.text(x0 + 12, y0 + 82, orderTerms(o), { size: 8, color: 'c' });
    const extra = extraPay(o.customer);
    const needs = orderNeeds(o);
    const hint = newRecipeHint(s, o);
    const notes = [
      ...(favouriteNote(o) ? [{ t: favouriteNote(o)!, c: 'R' as const }] : []),
      ...(hint ? [{ t: hint, c: 'l' as const }] : []),
      ...(familyRecipesNote(s, o) ? [{ t: familyRecipesNote(s, o)!, c: 'l' as const }] : []),
      ...(o.bonus ? [{ t: `★ Bonus: ${BONUS_TEXT[o.bonus]} (+2g, +1 Friendship)`, c: 'o' as const }] : []),
      ...(extra ? [{ t: `Also pays: ${extra}`, c: 'l' as const }] : []),
      ...(needs ? [{ t: needs, c: 'I' as const }] : []),
    ];
    notes.slice(0, 3).forEach((n, i) => this.text(x0 + 12, y0 + 94 + i * 10, n.t, { size: 7, color: n.c }));

    const by = y0 + 130;
    if (o.status !== 'open') {
      this.text(x0 + w / 2, y0 + 108, o.status === 'filled' ? 'Delivered. Thank you kindly!' : 'Declined.', { size: 8, color: 'a' }).setOrigin(0.5, 0);
      this.add2(button(this, x0 + w / 2, by, 'Back', () => this.closeDialog(), { w: 56 }));
      return;
    }
    const fromShelf = s.phase === 'brewing' ? s.shelf.find((p) => bestOrderFor({ orders: [o] }, p)) : undefined;
    const fulfil = fromShelf ? `Fulfill (Shelf)` : this.pinned === o.id ? 'Brewing for them' : 'Fulfill';
    this.add2(button(this, x0 + 60, by, fulfil, () => this.fulfil(o, fromShelf), { w: 96, color: 'L' }));
    this.add2(button(this, x0 + 150, by, 'Decline', () => {
      this.mode = { kind: 'idle' };
      this.dispatch({ type: 'decline', order: o.id });
    }, { w: 60, color: 'I' }));
    this.add2(button(this, x0 + 240, by, 'Back', () => this.closeDialog(), { w: 56 }));
  }

  private fulfil(o: Order, fromShelf: Potion | undefined) {
    this.mode = { kind: 'idle' };
    if (fromShelf) return void this.dispatch({ type: 'deliver', order: o.id, potion: fromShelf.uid });
    this.pinned = o.id;
    this.render();
    this.toast(`Your next fitting brew goes to ${customerName(o.customer)}.`);
  }

  private closeDialog() {
    this.mode = { kind: 'idle' };
    this.render();
  }

  // ---------------------------------------------------------------- brewing animation

  /** Plays the scoring event stream (GDD §6.3): cards drop in, numbers climb, the potion flies off. */
  private playBrew(before: RunState, after: RunState, events: GameEvent[]): Promise<void> {
    return new Promise((resolve) => {
      const layer = this.add.container(0, 0);
      const n = before.cauldronSlots;
      const cards = before.cauldron.map((c, i) => {
        const card = createCard(this, 320 + (i - (n - 1) / 2) * 40, SLOT_Y, c.card, c.woven, c.modifier).setScale(0.6);
        layer.add(card);
        return card;
      });
      const score = pixelText(this, 320, 76, '', { size: 10, color: 'W', stroke: 'k', align: 'center' }).setOrigin(0.5);
      layer.add(score);
      const steps = events.filter((e): e is Extract<GameEvent, { type: 'scoreStep' }> => e.type === 'scoreStep');
      let t = 0;
      const STEP = 260;
      steps.forEach((step) => {
        this.time.delayedCall(t, () => {
          score.setText(`${step.potency} × ${step.harmony}${step.note ? `  (${step.note})` : ''}`);
          this.tweens.add({ targets: score, scale: { from: 1.3, to: 1 }, duration: 160 });
          play('tick', { pitch: tickPitch(steps.indexOf(step)) });
          if (step.source === 'ingredient') {
            play('bubble', { volume: 0.6 });
            const card = cards.shift();
            if (card) this.tweens.add({ targets: card, y: this.cauldronY - 6, scale: 0.2, alpha: 0, duration: 220, ease: 'Quad.easeIn' });
            this.bubbles();
          }
        });
        t += STEP;
      });
      // Sludge: the cards drop in and it burps.
      if (steps.length === 0) {
        cards.forEach((card, i) => this.tweens.add({ targets: card, y: this.cauldronY - 6, scale: 0.2, alpha: 0, delay: i * 120, duration: 220 }));
        t += 300;
      }

      const brewed = events.find((e) => e.type === 'brewed');
      this.time.delayedCall(t, () => {
        this.brewFinale(events, 0.9);
        if (!brewed) {
          score.setText('Sludge!').setColor(PALETTE.R);
          this.bubbles(10);
          return;
        }
        const p = brewed.potion;
        score.setText(`${p.quality} · ${TIER_NAME[p.tier]}${brewed.copies > 1 ? ' ×2' : ''}`).setColor(PALETTE[TIER_COLOR[p.tier]!]);
        this.tweens.add({ targets: score, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.easeOut' });
        if (events.some((e) => e.type === 'recipeDiscovered')) {
          const d = pixelText(this, 320, 60, `New recipe: ${recipeName(p.recipe)}!`, { size: 8, color: 'v', stroke: 'k' }).setOrigin(0.5);
          layer.add(d);
        }
        const bottle = this.add.image(320, this.cauldronY - 10, `potion/${p.family}`).setScale(2);
        layer.add(bottle);
        const filled = events.find((e) => e.type === 'orderFilled');
        const spilled = events.some((e) => e.type === 'potionSpilled');
        const idx = filled ? after.orders.findIndex((o) => o.id === filled.order) : -1;
        const dest = filled ? { x: ORDERS.x + ORDERS.w - 20, y: this.ticketY(idx) + TICKET_H / 2 } : spilled ? { x: 320, y: 230 } : { x: SIDE.x + 20, y: SHELF_Y + 30 };
        this.tweens.add({
          targets: bottle, y: this.cauldronY - 50, duration: 300, delay: 250, ease: 'Quad.easeOut',
          onComplete: () => this.tweens.add({ targets: bottle, x: dest.x, y: dest.y, scale: 1, alpha: spilled ? 0 : 1, duration: 420, ease: 'Quad.easeInOut' }),
        });
        if (filled) {
          const gold = pixelText(this, dest.x, dest.y - 8, `+${filled.pay + filled.tip}g`, { size: 10, color: 'y', stroke: 'k' }).setOrigin(0.5).setAlpha(0);
          layer.add(gold);
          this.tweens.add({ targets: gold, alpha: 1, y: dest.y - 20, delay: 900, duration: 300 });
        }
      });
      this.time.delayedCall(t + 1500, () => {
        layer.destroy(true);
        resolve();
      });
    });
  }

  /** The end of a brew: its tier's jingle (or Sludge's burp), a new recipe, and coins when it filled an order `coinsAt` seconds later. */
  private brewFinale(events: readonly GameEvent[], coinsAt: number) {
    const brewed = events.find((e) => e.type === 'brewed');
    if (!brewed) return play('sludge');
    play(TIER_SOUND[brewed.potion.tier]);
    if (events.some((e) => e.type === 'recipeDiscovered')) play('discover');
    if (events.some((e) => e.type === 'orderFilled')) play('filled', { at: coinsAt });
  }

  private bubbles(count = 4) {
    for (let i = 0; i < count; i++) {
      const b = this.add.image(320 + Phaser.Math.Between(-22, 22), this.cauldronY - 18, 'fx/bubble');
      this.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(16, 40), alpha: 0, duration: Phaser.Math.Between(400, 800), onComplete: () => b.destroy() });
    }
  }

  // ---------------------------------------------------------------- twilight, night market, the end

  private drawEvening(s: RunState) {
    this.add2(this.add.rectangle(0, 0, 640, 360, hex('K'), 0.5).setOrigin(0));
    const offer = s.offer;
    const title = (t: string, sub: string) => {
      this.text(320, 46, t, { size: 16, color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5);
      this.text(320, 60, sub, { size: 8, color: 'a', stroke: 'k', align: 'center', wrap: 440 }).setOrigin(0.5, 0);
    };

    if (s.phase === 'game-over' && s.lostTo === 'finale') {
      title('The Moonless Patron leaves unhappy', `Rent is paid, but the month is lost. The Moonless Patron wanted ${FINALE_ORDERS === 1 ? 'one of their orders' : FINALE_ORDERS >= 3 ? 'all three of their orders' : `${FINALE_ORDERS} of their orders`} done.`);
      this.endButtons(s, 'Try again');
      return;
    }
    if (s.phase === 'game-over') {
      title('The Guild reclaims your stall', `You couldn't make week ${s.week}'s rent of ${rentOf(s)}g.`);
      this.endButtons(s, 'Try again');
      return;
    }
    if (s.phase === 'victory') {
      const out = this.endOutcome(s);
      if (out.yearDone) return this.yearEnding(s, out);
      title('The month is done', `Rent paid every week and the Moonless Patron served. The stall is yours, with ${s.gold}g to spare.`);
      if (out.opened) this.text(320, 120, `${cap(out.opened)} is open: set out for it from your cottage.`, { size: 10, color: 'L', stroke: 'k', align: 'center', wrap: 440 }).setOrigin(0.5);
      this.endButtons(s, 'Play again');
      return;
    }
    if (!offer) return;

    switch (offer.kind) {
      case 'reward': {
        title('Twilight', `The shop is shut. Pick a card to add to your deck, or skip it for ${SKIP_GOLD} gold.${s.skipStreak > 0 ? ` Skipped ${s.skipStreak} in a row: rarer cards are coming.` : ''}`);
        offer.cards.forEach((id, i) => this.offerCard(240 + i * 80, 150, id, () => this.dispatch({ type: 'pickReward', index: i })));
        this.add2(button(this, 320, 250, 'Skip (+2 gold)', () => this.dispatch({ type: 'skipReward' }), { w: 90 }));
        return;
      }
      case 'errands': {
        title('An errand before bed', 'Choose one. Tomorrow the shop opens again with new orders.');
        offer.options.forEach((errand, i) => {
          const x = 220 + i * 200;
          const t = ERRAND_TEXT[errand];
          const tile = this.add2(panel(this, x - 85, 110, 170, 80, 'k', 0.95, 'n'));
          this.text(x, 124, t.name, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
          this.text(x, 144, t.text, { size: 8, color: 'w', align: 'center', wrap: 150 }).setOrigin(0.5, 0);
          tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dispatch({ type: 'chooseErrand', errand }));
          tile.on('pointerover', () => tile.setStrokeStyle(2, hex('y')));
          tile.on('pointerout', () => tile.setStrokeStyle(1, hex('n')));
        });
        return;
      }
      case 'market': {
        title(offer.off ? 'Market Day' : 'Market Square', `${offer.off ? `Every price is ${Math.round(offer.off * 100)}% off tonight. ` : ''}Buy cards for your deck or upgrades for the shop. You have ${s.gold} gold.`);
        this.drawStock(s, offer.stock);
        this.add2(button(this, 320, 262, 'Leave', () => this.dispatch({ type: 'leaveErrand' }), { w: 60 }));
        return;
      }
      case 'forage': {
        title('Wychwood Forage', offer.picksLeft > 0 ? `Wild ingredients, free. Take ${offer.picksLeft} more for your deck.` : 'Your basket is full.');
        offer.cards.forEach((id, i) => this.offerCard(320 + (i - (offer.cards.length - 1) / 2) * 74, 150, id, () => this.dispatch({ type: 'forage', index: i }), offer.picksLeft <= 0));
        this.add2(button(this, 320, 262, 'Head home', () => this.dispatch({ type: 'leaveErrand' }), { w: 72 }));
        return;
      }
      case 'hearth': {
        const lift = !offer.removed && s.curses.length > 0;
        title('The Hearth', offer.removed ? 'Done. The fire crackles.' : `Burn one card from your deck for good. A thinner deck draws its best cards more often.${lift ? ' Or burn away a Curse instead.' : ''}`);
        this.deckGrid(blackMarketDeck(s), offer.removed ? null : (inst) => this.dispatch({ type: 'removeCard', uid: inst.uid }));
        if (lift) {
          s.curses.forEach((id, i) => {
            const x = 320 + (i - (s.curses.length - 1) / 2) * 96;
            this.add2(button(this, x, 238, `Lift ${codex.curses.get(id)!.name}`, () => this.dispatch({ type: 'liftCurse', curse: id }), { w: 90, color: 'v' }));
          });
        }
        this.add2(button(this, 320, 262, 'Head home', () => this.dispatch({ type: 'leaveErrand' }), { w: 72 }));
        return;
      }
      case 'creek':
        return this.drawCreek(s, offer, title);
      case 'guild':
        return this.drawGuild(s, offer, title);
      case 'event':
        return this.drawEvent(s, offer, title);
      case 'favour': {
        const v = codex.visitors.get(offer.visitor)!;
        const burn = offer.job === 'burn';
        title(burn ? `${v.name} carries one off` : `${v.name} tunes one up`, burn
          ? 'Choose a card for him to take out of your deck for good, or keep them all.'
          : `Choose an ingredient: +${MODIFIER_RULES.temperPotency} Potency for the rest of the run.`);
        this.deckGrid(burn ? blackMarketDeck(s) : allCards(s).filter((c) => codex.ingredients.has(c.card)), (inst) => this.dispatch({ type: 'doFavour', uid: inst.uid }));
        this.add2(button(this, 320, 262, 'No thanks', () => this.dispatch({ type: 'passGift' }), { w: 72 }));
        return;
      }
      case 'gift': {
        const [head, sub] = offer.from ? visitorGiftTitle(offer.from) : GIFT_TITLE[offer.source];
        const where = offer.into === 'satchel' ? 'It goes in your Night Satchel, which joins your deck only on Night Shifts.'
          : offer.into === 'familiar' ? (s.familiars.length < s.familiarSlots ? 'It takes a familiar slot.' : 'Every familiar slot is taken: sell one first (bottom right).')
            : 'It goes in your deck.';
        title(head, `${sub} ${where}`);
        offer.cards.forEach((id, i) => {
          const x = 320 + (i - (offer.cards.length - 1) / 2) * 80;
          const take = () => this.dispatch({ type: 'takeGift', index: i });
          if (offer.into === 'familiar') this.offerFamiliar(x, 150, id, take, s.familiars.length >= s.familiarSlots);
          else this.offerCard(x, 150, id, take);
        });
        this.add2(button(this, 320, 250, 'No thanks', () => this.dispatch({ type: 'passGift' }), { w: 72 }));
        return;
      }
      case 'night-market':
        return this.drawNightMarket(s, offer, title);
      case 'fair':
        return this.drawFair(s, offer, title);
      case 'vigil':
        return this.drawVigil(s, offer, title);
    }
  }

  /** The Longest Night vigil (GDD §4.2): the regulars' gifts, then a blessing from the Solstice Fire for the finale. */
  private drawVigil(s: RunState, offer: Extract<Offer, { kind: 'vigil' }>, title: (t: string, sub: string) => void) {
    if (!this.scenesSeen.has('vigil')) {
      this.seasonScene('The Longest Night', VIGIL_SCENE, () => this.scenesSeen.add('vigil'));
      return;
    }
    title('The Longest Night', 'The town keeps watch by the Solstice Fire until morning. Tomorrow night the Moonless Patron comes.');
    this.text(320, 86, 'Gifts from the town', { size: 8, color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
    if (offer.gifts.length === 0) {
      this.text(320, 116, `No one is close enough to bring a gift yet. Regulars at Friendship ${FRIENDSHIP.vigilLevel} or more bring one.`, { size: 7, color: 'a', stroke: 'k', align: 'center', wrap: 360 }).setOrigin(0.5, 0);
    } else {
      this.text(320, 97, 'They go in your Night Satchel, for tomorrow night.', { size: 6, color: 'a', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
      offer.gifts.forEach((g, i) => {
        const x = 320 + (i - (offer.gifts.length - 1) / 2) * 56;
        this.text(x, 108, customerName(g.regular), { size: 6, color: 'W', stroke: 'k', align: 'center', wrap: 54 }).setOrigin(0.5, 0);
        const c = this.add2(createCard(this, x, 146, g.card).setScale(0.6));
        c.setInteractive();
        this.inspect(c, g.card, 0.6);
      });
    }
    this.text(320, 178, offer.chose ? 'The fire burns low and warm.' : 'The Solstice Fire: choose a blessing for the Moonless Patron\'s night.', { size: 8, color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
    offer.blessings.forEach((id, i) => {
      const b = codex.blessings.get(id)!;
      const x = 320 + (i - (offer.blessings.length - 1) / 2) * 160;
      const chosen = offer.chose === id;
      const tile = this.add2(panel(this, x - 74, 194, 148, 44, 'k', 0.95, chosen ? 'y' : 'n'));
      this.text(x, 200, b.name, { size: 8, color: 'y', align: 'center' }).setOrigin(0.5, 0);
      this.text(x, 214, b.text, { size: 6, color: 'w', align: 'center', wrap: 136 }).setOrigin(0.5, 0);
      if (offer.chose) {
        if (!chosen) tile.setAlpha(0.4);
        return;
      }
      tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dispatch({ type: 'chooseBlessing', index: i }));
      tile.on('pointerover', () => tile.setStrokeStyle(2, hex('y')));
      tile.on('pointerout', () => tile.setStrokeStyle(1, hex('n')));
    });
    if (offer.chose) this.add2(button(this, 320, 262, 'Head home', () => this.dispatch({ type: 'leaveErrand' }), { w: 72 }));
  }

  /** A seasonal fair after closing on festival day (GDD §4.2): lantern-lit stalls in the square, then home. */
  private drawFair(s: RunState, offer: Extract<Offer, { kind: 'fair' }>, title: (t: string, sub: string) => void) {
    const fair = codex.fairs.get(offer.fair)!;
    const seen = `fair-${fair.id}`;
    if (!this.scenesSeen.has(seen)) {
      this.seasonScene(fair.name, fair.intro, () => this.scenesSeen.add(seen));
      return;
    }
    title(fair.name, `Lantern-lit stalls in the square, tonight only. Buy what you like, then head home. You have ${s.gold}g.`);
    const step = 72;
    const widths = offer.stalls.map((st) => Math.max(1, st.stock.length) * step + 12);
    const gap = 10;
    let left = 320 - (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2;
    offer.stalls.forEach((st, si) => {
      const meta = fair.stalls.find((m) => m.id === st.id)!;
      const w = widths[si]!;
      const cx = left + w / 2;
      this.add2(panel(this, left, 88, w, 168, 'k', 0.85, 'n'));
      this.text(cx, 94, meta.name, { size: 8, color: 'y', align: 'center' }).setOrigin(0.5, 0);
      this.text(cx, 106, meta.text, { size: 6, color: 'a', align: 'center', wrap: w - 10 }).setOrigin(0.5, 0);
      if (st.stock.length === 0) this.text(cx, 170, 'Nothing left\nfor you here.', { size: 7, color: 'h', align: 'center' }).setOrigin(0.5);
      st.stock.forEach((item, i) => {
        const x = cx + (i - (st.stock.length - 1) / 2) * step;
        const y = 180;
        const buy = () => this.dispatch({ type: 'buyAtFair', stall: si, index: i });
        const full = item.kind === 'familiar' && s.familiars.length >= s.familiarSlots;
        if (item.kind === 'card') this.offerCard(x, y, item.card, buy, item.sold);
        else if (item.kind === 'familiar') this.offerFamiliar(x, y, item.familiar, buy, item.sold || full);
        else if (item.kind === 'relic') this.offerRelic(x, y, item.relic, buy, item.sold);
        this.text(x, y - 52, item.sold ? 'sold' : `${item.price}g`, { size: 8, color: item.sold ? 'h' : item.price > s.gold ? 'R' : 'y', stroke: 'k' }).setOrigin(0.5, 0);
      });
      left += w + gap;
    });
    this.add2(button(this, 320, 272, 'Head home', () => this.dispatch({ type: 'leaveErrand' }), { w: 72 }));
  }

  /** A dusk event (GDD §7): one choice, then home. */
  private drawEvent(s: RunState, offer: Extract<Offer, { kind: 'event' }>, title: (t: string, sub: string) => void) {
    const ev = codex.duskEvents.get(offer.event)!;
    const home = () => {
      this.mode = { kind: 'idle' };
      this.dispatch({ type: 'leaveErrand' });
    };
    if (this.mode.kind === 'event-card' && offer.chose === null) {
      const choice = this.mode.choice;
      const ask = eventChoiceAsk(s, offer.event, choice);
      const choose = (pick: { uid?: number; pick?: string }) => {
        const events = this.dispatch({ type: 'chooseEvent', index: choice, ...pick });
        if (!events.some((e) => e.type === 'rejected')) this.mode = { kind: 'idle' };
      };
      const what = { deck: 'card', shelf: 'potion', recipe: 'recipe', card: 'card' }[ask?.kind ?? 'deck'];
      title(ev.name, `${ev.choices[choice]!.text} Choose the ${what}.`);
      // Buttons in rows of three, for Shelf potions and recipes.
      const rows = (labels: string[], onPick: (i: number) => void) => labels.forEach((label, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const across = Math.min(labels.length, 3);
        this.add2(button(this, 320 + (col - (across - 1) / 2) * 140, 120 + row * 24, label, () => onPick(i), { w: 132 }));
      });
      if (ask?.kind === 'deck') this.deckGrid(ask.cards, (inst) => choose({ uid: inst.uid }));
      else if (ask?.kind === 'shelf') rows(ask.potions.map((p) => `${TIER_NAME[p.tier]} ${recipeName(p.recipe)}`), (i) => choose({ uid: ask.potions[i]!.uid }));
      else if (ask?.kind === 'recipe') rows(ask.recipes.map(recipeName), (i) => choose({ pick: ask.recipes[i] }));
      else if (ask?.kind === 'card') ask.cards.forEach((id, i) => this.offerCard(320 + (i - (ask.cards.length - 1) / 2) * 76, 140, id, () => choose({ pick: id })));
      this.add2(button(this, 320, 262, 'Back', () => {
        this.mode = { kind: 'idle' };
        this.render();
      }, { w: 72 }));
      return;
    }
    title(ev.name, ev.text);
    ev.choices.forEach((c, i) => {
      const x = 320 + (i - (ev.choices.length - 1) / 2) * 150;
      const blocked = offer.chose === null ? eventChoiceBlocked(s, offer.event, i) : null;
      const tile = this.add2(panel(this, x - 68, 96, 136, 76, 'k', 0.95, 'n'));
      this.text(x, 104, c.label, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
      this.text(x, 122, c.text, { size: 8, color: 'w', align: 'center', wrap: 124 }).setOrigin(0.5, 0);
      if (offer.chose === i) return void tile.setStrokeStyle(2, hex('l'));
      if (offer.chose !== null || blocked) {
        if (blocked) this.text(x, 158, `Can't: ${blocked}`, { size: 7, color: 'R', align: 'center', wrap: 124 }).setOrigin(0.5, 0);
        return void tile.setAlpha(0.4);
      }
      tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (eventChoiceAsk(s, offer.event, i)) {
          this.mode = { kind: 'event-card', choice: i };
          this.render();
        } else this.dispatch({ type: 'chooseEvent', index: i });
      });
      tile.on('pointerover', () => tile.setStrokeStyle(2, hex('y')));
      tile.on('pointerout', () => tile.setStrokeStyle(1, hex('n')));
    });
    if (offer.outcome) {
      this.add2(panel(this, 170, 186, 300, 30, 'k', 0.85, 'n'));
      this.text(320, 195, offer.outcome, { size: 8, color: 'l', align: 'center', wrap: 290 }).setOrigin(0.5, 0);
    }
    if (eventDone(s, offer)) this.add2(button(this, 320, 262, 'Head home', home, { w: 72 }));
  }

  /** The Guild Hall (GDD §7): take one of two commissions, due by a Night Shift. */
  private drawGuild(s: RunState, offer: Extract<Offer, { kind: 'guild' }>, title: (t: string, sub: string) => void) {
    const full = s.commissions.length >= COMMISSIONS.max;
    title('Guild Hall', offer.taken ? 'Signed. The clerk files it away.' : full ? `You already hold ${COMMISSIONS.max} commissions.` : 'Take one commission, or none. Finish it in time for its reward; failing costs nothing.');
    offer.options.forEach((id, i) => {
      const c = codex.commissions.get(id)!;
      const x = 320 + (i - (offer.options.length - 1) / 2) * 190;
      const due = dueWeekOf(s, c);
      const tile = this.add2(panel(this, x - 88, 92, 176, 104, 'k', 0.95, 'n'));
      this.text(x, 100, c.name, { size: 10, color: 'y', align: 'center' }).setOrigin(0.5, 0);
      this.text(x, 118, c.goal, { size: 8, color: 'w', align: 'center', wrap: 160 }).setOrigin(0.5, 0);
      this.text(x, 154, `Due ${commissionDue(due, s.week)}`, { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0);
      this.text(x, 168, `Reward: ${commissionReward(id)}`, { size: 7, color: 'l', align: 'center', wrap: 160 }).setOrigin(0.5, 0);
      if (offer.taken && s.commissions.some((a) => a.id === id)) {
        tile.setStrokeStyle(2, hex('l'));
        this.text(x, 182, 'Taken', { size: 8, color: 'l', align: 'center' }).setOrigin(0.5, 0);
        return;
      }
      if (offer.taken || full) return void tile.setAlpha(0.4);
      tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dispatch({ type: 'takeCommission', index: i }));
      tile.on('pointerover', () => tile.setStrokeStyle(2, hex('y')));
      tile.on('pointerout', () => tile.setStrokeStyle(1, hex('n')));
    });
    if (s.commissions.length) {
      this.add2(panel(this, 200, 206, 240, 18 + s.commissions.length * 11, 'k', 0.85, 'n'));
      this.text(320, 210, 'Held', { size: 8, color: 'a', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
      s.commissions.forEach((a, i) => {
        const c = codex.commissions.get(a.id)!;
        this.text(320, 222 + i * 11, `${c.name}: ${a.progress}/${goalOf(a.id).target}, ${commissionDue(a.dueWeek, s.week)}`, { size: 7, color: 'w', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
      });
    }
    this.add2(button(this, 320, 262, 'Head home', () => this.dispatch({ type: 'leaveErrand' }), { w: 72 }));
  }

  /** The Creek Bank (GDD §7): temper a card for free, or buy it a modifier. One card a visit. */
  private drawCreek(s: RunState, offer: Extract<Offer, { kind: 'creek' }>, title: (t: string, sub: string) => void) {
    const leave = () => {
      this.mode = { kind: 'idle' };
      this.dispatch({ type: 'leaveErrand' });
    };
    if (offer.done) {
      title('Creek Bank', 'Done. The water runs on.');
      this.deckGrid(allCards(s).filter((c) => codex.ingredients.has(c.card)), null);
      this.add2(button(this, 320, 262, 'Head home', leave, { w: 72 }));
      return;
    }
    const pick: CreekPick = this.mode.kind === 'creek' ? this.mode.pick : 'temper';
    title('Creek Bank', `Choose what to do, then the card it's for. One card a visit. You have ${s.gold}g.`);
    const picks: CreekPick[] = ['temper', ...[...codex.modifiers.values()].filter((m) => m.price !== null).map((m) => m.id)];
    picks.forEach((p, i) => {
      const price = p === 'temper' ? 0 : codex.modifiers.get(p)!.price!;
      const label = p === 'temper' ? 'Temper, free' : `${codex.modifiers.get(p)!.name} ${price}g`;
      const x = 320 + (i - (picks.length - 1) / 2) * 92;
      const on = p === pick;
      if (on) this.add2(this.add.rectangle(x, 90, 88, 20).setStrokeStyle(1, hex('Y')));
      if (p !== 'temper') this.add2(this.add.image(x - 34, 90, `badge/${p}`));
      this.add2(button(this, x + (p === 'temper' ? 0 : 6), 90, label, () => {
        this.mode = { kind: 'creek', pick: p };
        this.render();
      }, { w: p === 'temper' ? 80 : 68, color: on ? 'Y' : price > s.gold ? 'R' : 'W', enabled: price <= s.gold }));
    });
    const what = pick === 'temper' ? `+${MODIFIER_RULES.temperPotency} Potency on one ingredient for the run.` : `${codex.modifiers.get(pick)!.name}. ${codex.modifiers.get(pick)!.text} One per card.`;
    this.text(320, 104, what, { size: 8, color: 'w', stroke: 'k', align: 'center', wrap: 440 }).setOrigin(0.5, 0);
    const cards = allCards(s).filter((c) => (pick === 'temper' ? codex.ingredients.has(c.card) : cantModify(c, pick) === null));
    this.deckGrid(cards, (inst) => {
      const events = this.dispatch(pick === 'temper' ? { type: 'temper', uid: inst.uid } : { type: 'enchant', uid: inst.uid, modifier: pick });
      if (!events.some((e) => e.type === 'rejected')) this.mode = { kind: 'idle' };
    }, [], 136);
    this.add2(button(this, 320, 262, 'Head home', leave, { w: 72 }));
  }

  /** Stock on sale: cards, or a cauldron or Shelf slot. The day's Market Square and the Night Market's sellers. */
  private drawStock(s: RunState, stock: readonly StockItem[], after?: (item: StockItem, i: number, x: number) => void) {
    stock.forEach((item, i) => {
      const x = 320 + (i - (stock.length - 1) / 2) * 74;
      const y = 150;
      const buy = () => this.dispatch({ type: 'buy', index: i });
      if (item.kind === 'card') {
        this.offerCard(x, y, item.card, buy, item.sold);
      } else if (item.kind === 'familiar') {
        this.offerFamiliar(x, y, item.familiar, buy, item.sold);
      } else if (item.kind === 'relic') {
        this.offerRelic(x, y, item.relic, buy, item.sold);
      } else {
        const tile = this.add2(panel(this, x - 28, y - 38, 56, 76, 'k', 0.95, 'n'));
        this.text(x, y - 24, item.kind === 'cauldron-slot' ? 'Cauldron\nslot' : 'Shelf\nslot', { size: 8, color: 'y', align: 'center' }).setOrigin(0.5, 0);
        this.text(x, y + 4, item.kind === 'cauldron-slot' ? 'Brew with one more ingredient' : '+1 potion space', { size: 7, color: 'w', align: 'center', wrap: 50 }).setOrigin(0.5, 0);
        if (item.sold) tile.setAlpha(0.4);
        else tile.setInteractive({ useHandCursor: true }).on('pointerdown', buy);
      }
      // The Firefly Keeper's half-price buy shows on every price at the Night Market.
      const price = priceAt(s, item);
      const label = item.sold ? 'sold' : price < item.price ? `${price}g, half` : `${price}g`;
      this.text(x, y - 54, label, { size: 8, color: item.sold ? 'h' : price > s.gold ? 'R' : price < item.price ? 'L' : 'y', stroke: 'k' }).setOrigin(0.5, 0);
      after?.(item, i, x);
    });
  }

  /** Deck cards laid out to pick from, sorted by name (the Hearth, the Hollow Tailor, the Black Market). */
  private deckGrid(cards: readonly CardInstance[], onPick: ((inst: CardInstance) => void) | null, picked: readonly number[] = [], top = 112) {
    const deck = sortedDeck(cards);
    const perRow = 12;
    deck.forEach((inst, i) => {
      const x = 320 + ((i % perRow) - (Math.min(deck.length, perRow) - 1) / 2) * 32;
      const y = top + Math.floor(i / perRow) * 44;
      const on = picked.includes(inst.uid);
      const c = this.add2(createCard(this, x, on ? y - 6 : y, inst.card, inst.woven, inst.modifier).setScale(0.5));
      if (on) this.add2(this.add.rectangle(x, y - 6, 29, 41).setStrokeStyle(1, hex('y')));
      c.setInteractive();
      this.inspect(c, inst.card, 0.5, inst);
      if (!onPick) return void c.setAlpha(0.6);
      c.setInteractive({ useHandCursor: true }).on('pointerdown', () => onPick(inst));
      c.on('pointerover', () => c.setScale(0.6));
      c.on('pointerout', () => c.setScale(0.5));
    });
  }

  /** The Night Market (GDD §9): a street of stalls, then rent. */
  private drawNightMarket(s: RunState, offer: Extract<Offer, { kind: 'night-market' }>, title: (t: string, sub: string) => void) {
    const due = rentOf(s);
    const stall = offer.at === null ? null : offer.stalls[offer.at]!;
    const back = () => {
      this.mode = { kind: 'idle' };
      void this.dispatch({ type: 'leaveStall' });
    };
    const backButton = () => this.add2(button(this, 320, 262, 'Back to the street', back, { w: 110 }));
    const info = stall ? codex.stalls.get(stall.id)! : null;
    const half = s.halfPrice > 0 ? ' The Firefly Keeper put in a word: your next buy is half price.' : '';
    const head = (sub: string) => title(info!.name, `${sub}${half} You have ${s.gold}g.`);

    if (!stall) {
      const buried = snowedIn(s, s.week);
      if (buried && !this.scenesSeen.has(`snowed-in-${s.week}`)) {
        this.seasonScene('Snowed In', SNOWED_IN_SCENE, () => this.scenesSeen.add(`snowed-in-${s.week}`));
        return;
      }
      title(buried ? 'The Night Market, Snowed In' : 'The Night Market', `${buried ? SNOWED_IN_LINE : MOON_LINE[moonOf(s.week)]} Visit any stall, then the Guild collects this week's rent: ${due}g. You have ${s.gold}g.${s.halfPrice > 0 ? ' The Firefly Keeper put in a word: your next buy here is half price.' : ''}`);
      const n = offer.stalls.length;
      const w = Math.min(84, Math.floor(600 / n) - 6);
      offer.stalls.forEach((st, i) => {
        const x = 320 + (i - (n - 1) / 2) * (w + 6);
        const meta = codex.stalls.get(st.id)!;
        const tile = this.add2(panel(this, x - w / 2, 96, w, 96, 'k', 0.95, 'n'));
        this.text(x, 102, meta.name, { size: 8, color: 'y', align: 'center', wrap: w - 8 }).setOrigin(0.5, 0);
        this.text(x, 128, meta.currency, { size: 7, color: 'a', align: 'center', wrap: w - 8 }).setOrigin(0.5, 0);
        this.text(x, 142, meta.text, { size: 6, color: 'w', align: 'center', wrap: w - 8 }).setOrigin(0.5, 0);
        const note = stallNote(s, st);
        if (note) this.text(x, 180, note, { size: 6, color: 'h', align: 'center' }).setOrigin(0.5, 0);
        tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dispatch({ type: 'visitStall', index: i }));
        tile.on('pointerover', () => tile.setStrokeStyle(2, hex('y')));
        tile.on('pointerout', () => tile.setStrokeStyle(1, hex('n')));
      });
      const short = s.gold < due;
      this.add2(button(this, 320, 214, short ? `Can't pay ${due}g: leave` : `Pay ${due}g rent and go home`, () => this.dispatch({ type: 'leaveMarket' }), { w: 160, color: short ? 'I' : 'Y' }));
      return;
    }

    switch (stall.id) {
      case 'fence': {
        head(s.season === 'winter'
          ? 'Sells potions from your Shelf. Folks want warmth this time of year: Warming potions fetch half again, the rest a little less. Umbra or Lunar still fetch half again.'
          : 'Sells potions from your Shelf. Potions with Umbra or Lunar in them fetch half again.');
        if (s.shelf.length === 0) this.text(320, 140, 'Your Shelf is empty.', { size: 8, color: 'a', align: 'center' }).setOrigin(0.5);
        s.shelf.forEach((p, i) => {
          const x = 320 + (i - (s.shelf.length - 1) / 2) * 50;
          const img = this.add2(this.add.image(x, 140, `potion/${p.family}`).setScale(2));
          this.text(x, 160, `${TIER_NAME[p.tier]}\n${fencePrice(p, s)}g`, { size: 7, color: 'y', align: 'center' }).setOrigin(0.5, 0);
          img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dispatch({ type: 'sellPotion', uid: p.uid }));
        });
        break;
      }
      case 'lantern-seller':
        head(`Lunar ingredients and Omens. They go in your Night Satchel, which joins your deck only on Night Shifts.${s.season === 'winter' ? ' Lunar stock runs low in Winter, but there is a Yule Candle.' : ''}`);
        this.drawStock(s, stall.stock);
        break;
      case 'wandering-tinker':
        head(stall.stock.length ? `Here only at the full moon, and cheaper than the Market.${s.season === 'winter' ? ' A Frost familiar rides in his cart this time of year.' : ''}` : 'Your shop has every slot already. The Tinker shrugs.');
        this.drawStock(s, stall.stock);
        break;
      case 'black-market': {
        const picking = this.mode.kind === 'stall' && this.mode.swap !== undefined ? this.mode : null;
        if (picking) {
          const item = stall.stock[picking.swap!]!;
          head(`Pick ${BLACK_MARKET.swap} cards from your deck to trade for ${item.kind === 'card' ? cardName(item.card) : 'it'}.`);
          this.deckGrid(blackMarketDeck(s), (inst) => {
            const picked = picking.picked.includes(inst.uid) ? picking.picked.filter((u) => u !== inst.uid) : [...picking.picked, inst.uid];
            if (picked.length < BLACK_MARKET.swap) {
              this.mode = { ...picking, picked };
              return this.render();
            }
            this.mode = { kind: 'idle' };
            void this.dispatch({ type: 'swapForCard', index: picking.swap!, uids: picked });
          }, picking.picked);
          this.add2(button(this, 320, 262, 'Cancel', () => {
            this.mode = { kind: 'idle' };
            this.render();
          }, { w: 60 }));
          return;
        }
        head(`Rare cards for gold, or for any ${BLACK_MARKET.swap} cards from your deck. And a relic, for gold only.`);
        this.drawStock(s, stall.stock, (item, i, x) => {
          if (item.sold || item.kind !== 'card') return;
          this.add2(button(this, x, 236, `or ${BLACK_MARKET.swap} cards`, () => {
            this.mode = { kind: 'stall', picked: [], swap: i };
            this.render();
          }, { w: 64 }));
        });
        break;
      }
      case 'moth-broker': {
        if (stall.cards.length) {
          head(`${recipeName(stall.forgot!)} is gone from your Grimoire. Take a Rare card or a familiar for it.`);
          const n = stall.cards.length + stall.familiars.length;
          const at = (i: number) => 320 + (i - (n - 1) / 2) * 76;
          stall.cards.forEach((id, i) => this.offerCard(at(i), 150, id, () => this.dispatch({ type: 'brokerPick', index: i })));
          stall.familiars.forEach((id, k) => this.offerFamiliar(at(stall.cards.length + k), 150, id, () => this.dispatch({ type: 'brokerPick', index: stall.cards.length + k }), s.familiars.length >= s.familiarSlots));
          break;
        }
        if (stall.done) {
          head('The moths settle back into his coat.');
          break;
        }
        const options = forgettable(s);
        head(options.length ? 'Forget a recipe you learned this run, and take a Rare card or a familiar for the memory. You can learn it again by brewing it.' : 'He only takes recipes you learned this run, not the four you started with. You have none yet.');
        options.forEach((r, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          this.add2(button(this, 320 + (col - 1) * 130, 112 + row * 22, recipeName(r), () => this.dispatch({ type: 'forgetRecipe', recipe: r }), { w: 124 }));
        });
        break;
      }
      case 'hollow-tailor': {
        if (stall.done) {
          head('Snip, stitch, done. The Tailor sews one card a night.');
          break;
        }
        const picked = this.mode.kind === 'stall' ? this.mode.picked : [];
        const from = picked.length ? tailorCards(s).find((c) => c.uid === picked[0]) : undefined;
        head(from
          ? `Now pick the card to sew ${ESSENCE_NAME[essencesOf(from)[0]!]} into. It gains it in place of its second essence, and +${TAILOR_POTENCY} Potency.`
          : 'Pick a card to give up for good. Its essence (its main one, if it has two) is sewn into another card.');
        this.deckGrid(tailorCards(s), (inst) => {
          if (!from) {
            this.mode = { kind: 'stall', picked: [inst.uid] };
            return this.render();
          }
          if (inst.uid === from.uid) {
            this.mode = { kind: 'idle' };
            return this.render();
          }
          this.mode = { kind: 'idle' };
          void this.dispatch({ type: 'weave', from: from.uid, into: inst.uid });
        }, picked);
        break;
      }
      case 'name-taker': {
        if (stall.done) {
          head('He writes something in a little book and smiles. One deal a night.');
          break;
        }
        if (!stall.deals.length) {
          head('He looks you over and shakes his head. Nothing he wants tonight.');
          break;
        }
        head('Take a Curse for the rest of the run, and a relic or a Cursed card for it. The worse the Curse, the better the relic.');
        stall.deals.forEach((deal, i) => this.drawDeal(320 + (i - (stall.deals.length - 1) / 2) * 176, deal, (take) => this.dispatch({ type: 'takeDeal', index: i, take })));
        break;
      }
      case 'seed-swapper': {
        if (stall.done) {
          head('He pockets your seeds and hums. One swap a night.');
          break;
        }
        const picking = this.mode.kind === 'stall' && this.mode.swap !== undefined ? this.mode : null;
        if (picking) {
          head(`Pick ${SEED_SWAPPER.give} Common cards from your deck to swap, with ${SEED_SWAPPER.price}g, for ${cardName(stall.cards[picking.swap!]!)}.`);
          this.deckGrid(commonCards(s), (inst) => {
            const picked = picking.picked.includes(inst.uid) ? picking.picked.filter((u) => u !== inst.uid) : [...picking.picked, inst.uid];
            if (picked.length < SEED_SWAPPER.give) {
              this.mode = { ...picking, picked };
              return this.render();
            }
            this.mode = { kind: 'idle' };
            void this.dispatch({ type: 'seedSwap', index: picking.swap!, uids: picked });
          }, picking.picked);
          this.add2(button(this, 320, 262, 'Cancel', () => {
            this.mode = { kind: 'idle' };
            this.render();
          }, { w: 60 }));
          return;
        }
        head(`Pick an Uncommon card, then give ${SEED_SWAPPER.give} Common cards from your deck and ${SEED_SWAPPER.price}g for it. One swap a night.`);
        stall.cards.forEach((id, i) => this.offerCard(320 + (i - (stall.cards.length - 1) / 2) * 76, 150, id, () => {
          this.mode = { kind: 'stall', picked: [], swap: i };
          this.render();
        }, commonCards(s).length < SEED_SWAPPER.give || s.gold < SEED_SWAPPER.price));
        break;
      }
      case 'blossom-oracle': {
        const next = s.calendar.weather[s.week]!.slice(0, NIGHT_SHIFT_DAY - 1);
        head(stall.done ? 'The petals have spoken.' : `She reads the petals and rolls next week's weather again. ${BLOSSOM_ORACLE_PRICE}g, once a night.`);
        this.text(320, 110, 'Next week', { size: 8, color: 'a', align: 'center' }).setOrigin(0.5, 0);
        next.forEach((w, d) => {
          const x = 320 + (d - (next.length - 1) / 2) * 84;
          this.add2(panel(this, x - 38, 126, 76, 40, 'k', 0.95, 'n'));
          this.text(x, 132, `Day ${d + 1}`, { size: 7, color: 'a', align: 'center' }).setOrigin(0.5, 0);
          this.text(x, 146, WEATHER_NAME[w], { size: 8, color: 'W', align: 'center' }).setOrigin(0.5, 0);
        });
        if (!stall.done) this.add2(button(this, 320, 200, `Read the petals (${BLOSSOM_ORACLE_PRICE}g)`, () => this.dispatch({ type: 'readPetals' }), { w: 120, color: s.gold < BLOSSOM_ORACLE_PRICE ? 'R' : 'Y', enabled: s.gold >= BLOSSOM_ORACLE_PRICE }));
        break;
      }
      case 'firefly-games': {
        if (stall.prizes.length) {
          head('A ringer! Pick a familiar.');
          stall.prizes.forEach((id, i) => this.offerFamiliar(320 + (i - (stall.prizes.length - 1) / 2) * 76, 150, id, () => this.dispatch({ type: 'takePrize', index: i })));
          break;
        }
        head(`Toss a ring for ${FIREFLY_GAMES.price}g. One in ${FIREFLY_GAMES.odds} wins a familiar (an Uncommon card if your slots are full). A miss still wins a Common card.`);
        const last = stall.last;
        if (last?.card) {
          this.text(320, 100, last.won ? 'A ringer, and a prize:' : 'A miss. A consolation prize:', { size: 8, color: last.won ? 'y' : 'a', align: 'center' }).setOrigin(0.5, 0);
          this.offerCard(320, 160, last.card, () => undefined, false);
        } else if (!last) {
          this.text(320, 150, 'Fireflies circle the pegs.', { size: 8, color: 'a', align: 'center' }).setOrigin(0.5);
        }
        this.add2(button(this, 320, 236, `Toss a ring (${FIREFLY_GAMES.price}g)`, () => this.dispatch({ type: 'tossRing' }), { w: 110, color: s.gold < FIREFLY_GAMES.price ? 'R' : 'Y', enabled: s.gold >= FIREFLY_GAMES.price }));
        break;
      }
      case 'nectar-trader': {
        const pays = cheapestPotion(s, NECTAR_TRADER.minTier);
        if (stall.done) {
          head('She corks your potion and smiles. One trade a night.');
          break;
        }
        head(pays
          ? `A Rare card for a ${TIER_NAME[NECTAR_TRADER.minTier]} or better potion. She takes your lowest: ${TIER_NAME[pays.tier]} ${recipeName(pays.recipe)}.`
          : `She only takes ${TIER_NAME[NECTAR_TRADER.minTier]} or better potions, and your Shelf has none.`);
        stall.cards.forEach((id, i) => this.offerCard(320 + (i - (stall.cards.length - 1) / 2) * 76, 150, id, () => this.dispatch({ type: 'tradeNectar', index: i }), !pays));
        break;
      }
      case 'cider-press': {
        const pays = cheapestPotion(s);
        const left = CIDER_PRESS.max - stall.pressed;
        head(!left
          ? 'The press is dry for tonight.'
          : pays
            ? `Press your lowest Shelf potion (${TIER_NAME[pays.tier]} ${recipeName(pays.recipe)}) and pick an ingredient: +${CIDER_PRESS.potency} Potency for the run. ${left} more tonight.`
            : 'The press wants a potion from your Shelf, and it is empty.');
        this.deckGrid(pressable(s), left && pays ? (inst) => void this.dispatch({ type: 'pressCider', uid: inst.uid }) : null);
        break;
      }
      case 'harvest-auction': {
        if (!stall.relic) {
          head('Nothing worth bidding on tonight.');
          break;
        }
        const bid = stall.bid;
        const won = bid !== null && bid >= stall.rival;
        head(bid === null
          ? 'One sealed bid against the farmers. Win and you pay your bid; lose and you pay nothing.'
          : won ? `Sold! Your ${bid}g beat the farmers' ${stall.rival}g.` : `The farmers bid ${stall.rival}g. No sale, and no charge.`);
        this.offerRelic(320, 140, stall.relic, () => undefined, bid !== null && !won);
        if (bid === null) {
          HARVEST_AUCTION.bids.forEach((amount, i) => {
            const x = 320 + (i - (HARVEST_AUCTION.bids.length - 1) / 2) * 56;
            this.add2(button(this, x, 222, `Bid ${amount}g`, () => this.dispatch({ type: 'placeBid', amount }), { w: 52, color: amount > s.gold ? 'R' : 'Y', enabled: amount <= s.gold }));
          });
        }
        break;
      }
      case 'hearth-trader': {
        const mode = this.mode.kind === 'stall' ? this.mode : null;
        const tab = mode?.tab ?? 'trade';
        const tabs: [HearthTab, string, boolean][] = [
          ['trade', `Trade ${FRIENDSHIP.traderGold}g`, stall.done],
          ['yule', `The Yule Log ${YULE_LOG.price}g`, stall.burned],
          ['crown', `The Holly Crown ${HOLLY_CROWN.price}g`, stall.crowned || !stall.crown.length],
        ];
        tabs.forEach(([id, label, used], i) => {
          const x = 320 + (i - 1) * 118;
          const on = id === tab;
          if (on) this.add2(this.add.rectangle(x, 86, 112, 20).setStrokeStyle(1, hex('Y')));
          this.add2(button(this, x, 86, used ? `${label} ✓` : label, () => {
            this.mode = { kind: 'stall', picked: [], tab: id };
            this.render();
          }, { w: 108, color: on ? 'Y' : 'W' }));
        });
        if (tab === 'yule') {
          if (stall.burned) {
            head('The Yule Log crackles. What burned is gone for good. Once a night.');
            break;
          }
          const picked = mode?.picked ?? [];
          head(`Burn one or two cards from your deck in the Yule fire, for good. ${YULE_LOG.price}g, once a night.`);
          this.deckGrid(blackMarketDeck(s), (inst) => {
            const has = picked.includes(inst.uid);
            if (!has && picked.length >= YULE_LOG.cards) return;
            this.mode = { kind: 'stall', tab: 'yule', picked: has ? picked.filter((u) => u !== inst.uid) : [...picked, inst.uid] };
            this.render();
          }, picked, 120);
          const ok = picked.length > 0 && s.gold >= YULE_LOG.price;
          this.add2(button(this, 320, 238, picked.length ? `Burn ${picked.length} (${YULE_LOG.price}g)` : 'Pick 1 or 2 cards', () => {
            this.mode = { kind: 'stall', picked: [], tab: 'yule' };
            void this.dispatch({ type: 'burnYule', uids: picked });
          }, { w: 100, color: ok ? 'Y' : 'W', enabled: ok }));
          break;
        }
        if (tab === 'crown') {
          head(stall.crowned ? 'The holly sits well on them. Once a night.'
            : stall.crown.length ? `Wear the Holly Crown: ${HOLLY_CROWN.price}g for a Frost familiar. Once a night.` : 'Every Frost familiar already keeps your hearth.');
          stall.crown.forEach((id, i) => {
            const x = 320 + (i - (stall.crown.length - 1) / 2) * 90;
            this.offerFamiliar(x, 160, id, () => void this.dispatch({ type: 'wearCrown', index: i }),
              stall.crowned || s.gold < HOLLY_CROWN.price || s.familiars.length >= s.familiarSlots);
          });
          break;
        }
        if (stall.done) {
          head('He warms his hands and nods. One trade a night.');
          break;
        }
        // He trades on the name of your best friend among the regulars (GDD §4.1): level 2 to trade, level 6 to see all three cards.
        const shown = hearthOffers(s, stall);
        const friend = shown.regular;
        head(friend
          ? `A friend of ${customerName(friend)}'s? ${FRIENDSHIP.traderGold}g for a Rare card or a familiar.${shown.cards.length < stall.cards.length ? ` At Friendship ${FRIENDSHIP.traderBigLevel} he shows a third card.` : ''}`
          : `He trades only with friends of the town: Friendship ${FRIENDSHIP.traderLevel} with a regular.`);
        const n = shown.cards.length + shown.familiars.length;
        const x = (i: number) => 320 + (i - (n - 1) / 2) * 76;
        const shut = !friend || s.gold < FRIENDSHIP.traderGold;
        const trade = (index: number) => this.dispatch({ type: 'hearthTrade', index });
        shown.cards.forEach((id, i) => this.offerCard(x(i), 170, id, () => void trade(i), shut));
        shown.familiars.forEach((id, k) => this.offerFamiliar(x(shown.cards.length + k), 170, id, () => void trade(shown.cards.length + k), shut || s.familiars.length >= s.familiarSlots));
        break;
      }
      case 'fortune-tent': {
        const price = fortunePrice(stall.drawn.length);
        head(s.week < WEEKS ? 'Draw a tarot. Boons come at once; twists change next week.' : 'Draw a tarot. A boon, or a small curse. Next week is past saving.');
        stall.drawn.forEach((id, i) => {
          const t = codex.tarot.get(id)!;
          const x = 320 + (i - (stall.drawn.length - 1) / 2) * 96;
          this.add2(panel(this, x - 44, 96, 88, 90, 'k', 0.95, t.kind === 'boon' ? 'y' : 'v'));
          this.text(x, 104, t.name, { size: 8, color: t.kind === 'boon' ? 'y' : 'v', align: 'center', wrap: 80 }).setOrigin(0.5, 0);
          this.text(x, 122, t.kind === 'boon' ? 'Boon' : 'Twist', { size: 6, color: 'a', align: 'center' }).setOrigin(0.5, 0);
          this.text(x, 136, t.text, { size: 7, color: 'w', align: 'center', wrap: 80 }).setOrigin(0.5, 0);
        });
        if (!stall.drawn.length) this.text(320, 150, 'The cards wait, face-down.', { size: 8, color: 'a', align: 'center' }).setOrigin(0.5);
        this.add2(button(this, 320, 230, `Draw a card (${price}g)`, () => this.dispatch({ type: 'drawTarot' }), { w: 110, color: price > s.gold ? 'R' : 'Y', enabled: price <= s.gold }));
        break;
      }
    }
    backButton();
  }

  private offerCard(x: number, y: number, id: string, onPick: () => void, dim = false) {
    const c = this.add2(createCard(this, x, y, id));
    this.text(x, y + 42, cardText(id), { size: 6, color: 'w', align: 'center', wrap: 70 }).setOrigin(0.5, 0);
    c.setInteractive();
    this.inspect(c, id);
    if (dim) return void c.setAlpha(0.4);
    c.setInteractive({ useHandCursor: true }).on('pointerdown', onPick);
    c.on('pointerover', () => this.tweens.add({ targets: c, y: y - 6, duration: 90 }));
    c.on('pointerout', () => this.tweens.add({ targets: c, y, duration: 90 }));
  }

  private newRun(season: Season = 'spring') {
    this.tutorial = wantsTutorial() ? new TutorialProgress() : null;
    this.scenesSeen.clear();
    this.openingPending = !this.fixtureRun && wantsIntros() && !this.tutorial && loadProfile().seasonOpenings;
    store.dispatch({ type: 'startRun', seed: this.tutorial ? TUTORIAL_SEED : `run-${Math.floor(Math.random() * 1e9)}`, ...this.kit(this.fixtureRun ? this.fixture : null), season, ...this.fromProfile(this.fixtureRun) });
    this.scene.restart({ resume: true });
  }

  /**
   * The witch and cauldron a new run starts with: the cottage's pick (GDD §12), a fixture's own,
   * or the Hedge Witch in Copper for the tutorial and fixtures that name none.
   */
  private kit(fixture: Fixture | null | undefined): { witch: string; cauldron: string } {
    if (fixture) return { witch: fixture.witch ?? 'hedge-witch', cauldron: fixture.cauldron ?? 'copper' };
    if (this.tutorial) return { witch: 'hedge-witch', cauldron: 'copper' };
    return runStartChoice(loadProfile());
  }

  /**
   * What the profile brings to a new run: cottage perks, and what the Almanac added to the pools.
   * Neither in the tutorial, which plays a fixed deal, or in fixtures.
   */
  private fromProfile(fixture: boolean): { perks?: string[]; unlocks?: string[]; year?: number; boon?: string; friendship?: Record<string, number>; keepsakes?: string[] } {
    // A fixture's own profile can bring Friendship from earlier runs (the Townsfolk page) and keepsakes.
    if (fixture) {
      const p = this.fixture?.profile ? migrateProfile(this.fixture.profile) : null;
      const keepsakes = p ? runKeepsakes(p) : [];
      return { ...(p && Object.keys(p.friendship).length ? { friendship: p.friendship } : {}), ...(keepsakes.length ? { keepsakes } : {}) };
    }
    if (this.tutorial) return {};
    const p = loadProfile();
    const unlocks = almanacUnlocks(p.almanac);
    return {
      ...(p.perks.length ? { perks: p.perks } : {}),
      ...(unlocks.length ? { unlocks } : {}),
      ...(p.year > 1 ? { year: p.year } : {}),
      ...(boonOf(p) ? { boon: boonOf(p)! } : {}),
      ...(Object.keys(p.friendship).length ? { friendship: p.friendship } : {}),
      ...(runKeepsakes(p).length ? { keepsakes: runKeepsakes(p) } : {}),
    };
  }

  /** What the run that just ended changed in the profile. A fixture shows it against its own `profile`. */
  private endOutcome(s: RunState): RunOutcome {
    if (this.outcome) return this.outcome;
    const before = this.fixtureRun ? migrateProfile(this.fixture?.profile ?? null) : loadProfile();
    return recordRun(before, s);
  }

  /**
   * A Winter win: the "year in Elmbrook" ending (GDD §13). Winning your top Year's Winter, once
   * looping is open, opens the next Year: you choose it at the cottage, like an Ascension level.
   */
  private yearEnding(s: RunState, out: RunOutcome) {
    this.add2(panel(this, 100, 28, 440, 300, 'k', 0.94, 'n'));
    this.text(320, 40, `A Year in Elmbrook`, { size: 16, color: 'y', stroke: 'k', align: 'center' }).setOrigin(0.5, 0);
    this.text(320, 62, YEAR_ENDING, { size: 8, color: 'w', align: 'center', wrap: 400 }).setOrigin(0.5, 0);
    const year = s.year;
    const done = `Year ${year} done${out.profile.years > 1 ? `, ${out.profile.years} Years in all` : ''}. The stall is yours, with ${s.gold}g to spare.`;
    this.text(320, 168, done, { size: 8, color: 'L', align: 'center', wrap: 400 }).setOrigin(0.5, 0);
    if (out.reputation > 0) this.text(320, 184, `+${out.reputation} Reputation to spend at your cottage`, { size: 8, color: 'Y', align: 'center' }).setOrigin(0.5, 0);
    if (out.almanac.length) this.text(320, 198, `New in your Almanac: ${listOf(out.almanac.map((id) => codex.almanac.get(id)!.name))}.`, { size: 8, color: 'L', align: 'center', wrap: 400 }).setOrigin(0.5, 0);
    const top = out.profile.yearSeasons.length;
    const news = out.newYear
      ? `Year ${out.newYear} is open: choose it at your cottage, with a boon, under a new rule. ${yearModifiers(out.newYear).at(-1)!.text} Reputation ×${reputationMult(out.newYear)}.`
      : year < top || top >= MAX_YEAR
        ? null
        : `Win another Year, or finish ${LOOP_ALMANAC} Almanac entries, and your next Winter win opens Year ${top + 1}.`;
    if (news) this.text(320, 222, news, { size: 7, color: out.newYear ? 'L' : 'a', align: 'center', wrap: 400 }).setOrigin(0.5, 0);
    const more = [perkNews(out), kitNews(out)].filter(Boolean).join(' ');
    if (more) this.text(320, news ? 240 : 222, more, { size: 7, color: 'Y', align: 'center', wrap: 400 }).setOrigin(0.5, 0);
    this.add2(button(this, 270, 296, 'Play again', () => this.newRun(s.season), { w: 80 }));
    this.add2(button(this, 370, 296, 'Home', () => this.scene.start('Cottage', {}), { w: 80, color: 'Y' }));
  }

  /** Play the same season again, or go home to the cottage to choose another. */
  private endButtons(s: RunState, again: string) {
    const out = this.endOutcome(s);
    if (out.reputation > 0) this.text(320, 146, `+${out.reputation} Reputation to spend at your cottage`, { size: 8, color: 'Y', stroke: 'k', align: 'center' }).setOrigin(0.5);
    if (out.almanac.length) {
      const names = out.almanac.map((id) => codex.almanac.get(id)!.name);
      const tiers = out.perkTiers.length ? ` ${perkNews(out)}` : '';
      this.text(320, 160, `New in your Almanac: ${listOf(names)}. More joins the pools next run.${tiers}`, { size: 8, color: 'L', stroke: 'k', align: 'center', wrap: 440 }).setOrigin(0.5, 0);
    }
    if (kitNews(out)) this.text(320, 132, kitNews(out), { size: 8, color: 'L', stroke: 'k', align: 'center', wrap: 440 }).setOrigin(0.5);
    this.add2(button(this, 270, 190, again, () => this.newRun(s.season), { w: 80, color: 'Y' }));
    this.add2(button(this, 370, 190, 'Home', () => this.scene.start('Cottage', {}), { w: 80 }));
  }

  /**
   * Keep the run in this browser so the title screen can continue it. Fixtures and the tutorial
   * aren't saved: a fixture would overwrite a real run, and the tutorial can't pick up halfway.
   */
  private save() {
    if (this.fixtureRun) return;
    const s = store.getState();
    if (!s) return;
    // A finished run counts in the profile once: a win opens the next season.
    if ((s.phase === 'victory' || s.phase === 'game-over') && !this.outcome) this.outcome = recordFinishedRun(s);
    if (this.tutorial) clearRun();
    else saveRun(s);
  }

  // ---------------------------------------------------------------- keyboard

  private bindKeys() {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.busy || this.settingsOpen) return;
      const s = store.getState()!;
      if (this.intro) {
        if (e.key === 'Enter' || e.key === ' ') {
          this.intro.done();
          this.render();
        }
        return;
      }
      if (e.key === 'g' || e.key === 'G') return this.toggleBook(s);
      if (this.book) {
        if (e.key === 'Escape') this.openBook(null);
        return;
      }
      if (e.key === 'Escape') {
        if (this.mode.kind === 'idle' && !this.confirm) return this.openSettings();
        this.mode = { kind: 'idle' };
        this.confirm = null;
        return this.render();
      }
      if (s.phase === 'morning' && (e.key === 'Enter' || e.key === ' ')) return void this.dispatch({ type: 'openShop' });
      if (s.phase !== 'brewing' || this.mode.kind === 'dialog') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && s.hand[n - 1]) return this.clickCard(s, s.hand[n - 1]!);
      if (e.key === 'Enter') return this.mode.kind === 'select' ? this.confirmSelect() : this.brew();
      if (e.key === 'r' || e.key === 'R') return this.nextRecipe(s);
      if (e.key === 'd' || e.key === 'D') {
        if (this.mode.kind === 'select') return this.confirmSelect();
        return this.startDiscard(s);
      }
    });
  }
}

/** The cauldron's cards, so a recipe pick lasts only while they stay the same. */
const cauldronKey = (s: Pick<RunState, 'cauldron'>) => s.cauldron.map((c) => c.uid).join(',');

const RARITY_BORDER: Record<'common' | 'uncommon' | 'rare', PaletteKey> = { common: 'n', uncommon: 'c', rare: 'v' };

/** A familiar's sprite, or the placeholder until its grid is authored (M5). */
function familiarTexture(scene: Phaser.Scene, id: string): string {
  return scene.textures.exists(`familiar/${id}`) ? `familiar/${id}` : 'placeholder/16';
}

/** The scene screen for a Snowed In night (GDD §9): why only the Hearth Trader is open. */
const SNOWED_IN_SCENE = [
  'Snow came down all through the Night Shift, and the lane is drifted to the shutters.',
  'The stalls are buried tonight. Only one fire is lit: the Hearth Trader has dug himself out, as he always does.',
];
/** The scene screen for the Longest Night vigil (GDD §4.2). */
const VIGIL_SCENE = [
  'The solstice: the longest night of the year, and the last before the new moon.',
  'Nobody in Elmbrook sleeps tonight. The square fills with lanterns around the Solstice Fire, and the people you have come to know bring something to see you through tomorrow.',
];

const SNOWED_IN_LINE = 'Snow has buried the stalls. Only the Hearth Trader\'s fire is lit.';

const MOON_LINE: Record<ReturnType<typeof moonOf>, string> = {
  quarter: 'A quarter moon: three stalls tonight.',
  'full-moon': 'The full moon: every stall is out, and the Wandering Tinker is in town.',
  'new-moon': 'The new moon: every stall, and the Black Market by the well.',
};

/** A line for relics gained, Curses lifted or a relic that acted, to toast after an action. */
function relicNote(events: readonly GameEvent[]): string | null {
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === 'relicGained' && e.source !== 'debug') lines.push(`Relic: ${codex.relics.get(e.relic)!.name}. ${codex.relics.get(e.relic)!.text}`);
    if (e.type === 'curseLifted') lines.push(`${codex.curses.get(e.curse)!.name} is lifted.`);
    if (e.type === 'relicFired' && e.relic === 'iron-lid') lines.push('The Iron Lid caught the Sludge.');
    if (e.type === 'glamourUsed') lines.push('A little glamour: it passes for what they asked. (Once a day.)');
    if (e.type === 'commissionDone') lines.push(`Commission done: ${codex.commissions.get(e.commission)!.name}.`);
    if (e.type === 'commissionFailed') lines.push(`${codex.commissions.get(e.commission)!.name} ran out of time.`);
    if (e.type === 'cardModified' && e.by !== 'debug' && e.by !== 'event') lines.push(`${cardName(e.card)} is ${codex.modifiers.get(e.modifier)!.name}.`);
  }
  return lines.length ? lines.join(' ') : null;
}

/** What's left to do at a stall, for its sign on the street. */
function stallNote(s: RunState, st: StallState): string | null {
  if ('stock' in st) return st.stock.length && st.stock.every((i) => i.sold) ? 'sold out' : null;
  if (st.id === 'fence') return s.shelf.length ? `${s.shelf.length} on your Shelf` : null;
  if (st.id === 'hearth-trader') {
    const used = [st.done, st.burned, st.crowned || !st.crown.length].filter(Boolean).length;
    return used === 3 ? 'done' : used ? `${used} of 3 done` : null;
  }
  if ('done' in st) return st.done ? 'done' : null;
  if (st.id === 'firefly-games') return st.tosses ? `${st.tosses} tossed` : null;
  if (st.id === 'cider-press') return st.pressed >= CIDER_PRESS.max ? 'done' : null;
  if (st.id === 'harvest-auction') return st.bid !== null ? 'bid placed' : null;
  return st.drawn.length ? `drew ${st.drawn.length}` : null;
}

/** Cards the stall you're at works with, for picking from (fixtures name them by position in this list, sorted). */
function stallDeck(s: RunState): CardInstance[] {
  const o = s.offer;
  const st = o?.kind === 'night-market' && o.at !== null ? o.stalls[o.at] : undefined;
  if (st?.id === 'seed-swapper') return commonCards(s);
  if (st?.id === 'cider-press') return pressable(s);
  return st?.id === 'hollow-tailor' ? tailorCards(s) : blackMarketDeck(s);
}

const blackMarketDeck = (s: RunState) => [...s.drawPile, ...s.hand, ...s.discardPile];

const sortedDeck = (cards: readonly CardInstance[]) => cards.slice().sort((a, b) => a.card.localeCompare(b.card) || a.uid - b.uid);

const cardName = (id: string) => codex.ingredients.get(id)?.name ?? codex.tinctures.get(id)?.name ?? codex.junk.get(id)?.name ?? id;

const ESSENCE_NAME: Record<Essence, string> = { vital: 'Vital', ember: 'Ember', tide: 'Tide', gale: 'Gale', stone: 'Stone', umbra: 'Umbra', lunar: 'Lunar' };

const GIFT_TITLE: Record<Gift['source'], [string, string]> = {
  'first-night': ['A gift from the night', 'Week 1 is nearly done. Take one Lunar ingredient, free.'],
  'lantern-witch': ['The Lantern Witch pays', 'She pays in moonlight. Take one Lunar ingredient.'],
  'bog-hag': ['Granny Bogwort pays', 'Something rare from the fen. Take one.'],
  patron: ['The patron\'s reward', 'Take one, with their thanks.'],
  commission: ['The Guild pays', 'A commission done. Take one, with the Guild\'s seal on it.'],
  visitor: ['A visitor pays', 'Take one, with their thanks.'],
};

/** A visitor's card pick: who pays, and with what. */
function visitorGiftTitle(id: string): [string, string] {
  const v = codex.visitors.get(id);
  const pays = v?.paysIn.kind === 'card-pick' ? v.paysIn : null;
  const what = pays?.tincture ? 'one Tincture' : pays?.tag ? `one ${cap(pays.tag)} ingredient` : pays?.essence ? `one ${cap(pays.essence)} ingredient` : 'one';
  return [`${v?.name ?? 'A visitor'} pays`, `Take ${what}, with their thanks.`];
}

/** First-time players get the tutorial; ?tutorial=0, a chosen ?seed= or a finished one skip it, ?tutorial=1 forces it. */
function wantsTutorial(): boolean {
  const flag = params.get('tutorial');
  if (flag) return flag === '1';
  return !params.get('seed') && !loadProfile().tutorialDone;
}

/** Season openings and weather firsts show on real runs: a chosen ?seed= skips them, like the tutorial. */
function wantsIntros(): boolean {
  return !params.get('seed');
}

/** A line for the witches and cauldrons a run opened, to choose at the cottage. */
function kitNews(out: RunOutcome): string {
  const names = [...out.witches.map((id) => codex.witches.get(id)!.name), ...out.cauldrons.map((id) => codex.cauldrons.get(id)!.name)];
  if (!names.length) return '';
  return `${cap(listOf(names.map((n) => `the ${n}`)))} ${names.length === 1 ? 'is' : 'are'} waiting at your cottage.`;
}

/** A line for perk board tiers a run opened. */
function perkNews(out: RunOutcome): string {
  if (!out.perkTiers.length) return '';
  const tiers = out.perkTiers.map((t) => `tier ${t}`);
  return `New perks at your cottage: ${listOf(tiers)} of the perk board is open.`;
}
