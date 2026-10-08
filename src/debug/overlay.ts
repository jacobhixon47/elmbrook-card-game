import type Phaser from 'phaser';
import { NIGHT_SHIFT_DAY, rentDue, skyTime, WEEKS, type RunState } from '../core';
import { PALETTE } from '../art/palette';
import { store } from '../store';

// Dev overlay (backtick): seed, a state inspector, add gold, jump to any day, export the action log.
// Plain DOM on top of the canvas so it never touches game rendering.

const CSS = `
#elmbrook-overlay { position: fixed; top: 8px; right: 8px; width: 300px; max-height: calc(100% - 16px); overflow: auto;
  background: ${PALETTE.k}e8; color: ${PALETTE.a}; border: 1px solid ${PALETTE.h}; border-radius: 4px; padding: 8px 10px;
  font: 11px/1.45 ui-monospace, Menlo, Consolas, monospace; z-index: 10; }
#elmbrook-overlay h2 { margin: 0 0 4px; font-size: 12px; color: ${PALETTE.y}; }
#elmbrook-overlay .row { display: flex; gap: 6px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
#elmbrook-overlay button, #elmbrook-overlay select { font: inherit; background: ${PALETTE.h}; color: ${PALETTE.a};
  border: 1px solid ${PALETTE.a}55; border-radius: 3px; padding: 1px 6px; cursor: pointer; }
#elmbrook-overlay .dim { opacity: 0.65; }
#elmbrook-overlay pre { white-space: pre-wrap; word-break: break-all; font-size: 10px; max-height: 260px; overflow: auto; }
#elmbrook-overlay ul { margin: 2px 0; padding-left: 16px; }
`;

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function summary(s: RunState): string {
  const orders = s.orders
    .map((o) => {
      const want = o.request.kind === 'recipe' ? o.request.recipe : `any ${o.request.family}`;
      return `<li class="${o.status === 'open' ? '' : 'dim'}">${esc(o.customer)}: ${esc(want)}, ${o.minTier}+ · ${o.pay}g${o.bonus ? ` · ${o.bonus}` : ''} · ${o.status}</li>`;
    })
    .join('');
  const deck = s.drawPile.length + s.hand.length + s.discardPile.length + s.cauldron.length;
  return `
    <div>seed <b>${esc(s.seed)}</b> · ${s.season} · ${s.witch}</div>
    <div>week ${s.week} · ${s.day === NIGHT_SHIFT_DAY ? 'Night Shift' : `day ${s.day}`} · ${s.phase} · sky ${skyTime(s)}</div>
    <div>gold <b>${s.gold}</b> · rent due ${rentDue(s.season, s.week)}</div>
    <div>brews ${s.brewsLeft} · discards ${s.discardsLeft} · cauldron ${s.cauldron.length}/${s.cauldronSlots} · shelf ${s.shelf.length}/${s.shelfSize}</div>
    <div>deck ${deck} (draw ${s.drawPile.length}, hand ${s.hand.length}, discard ${s.discardPile.length})</div>
    <div>offer ${s.offer?.kind ?? 'none'}</div>
    <div>orders</div><ul>${orders || '<li class="dim">none</li>'}</ul>`;
}

export function installOverlay(game: Phaser.Game, openAtStart = false): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'elmbrook-overlay';
  root.hidden = !openAtStart;
  document.body.appendChild(root);

  const weeks = Array.from({ length: WEEKS }, (_, i) => `<option>${i + 1}</option>`).join('');
  const days = Array.from({ length: NIGHT_SHIFT_DAY }, (_, i) => `<option value="${i + 1}">${i + 1 === NIGHT_SHIFT_DAY ? 'night' : i + 1}</option>`).join('');
  root.innerHTML = `
    <h2>Elmbrook dev · \` to close</h2>
    <div id="eo-summary"></div>
    <div class="row"><button data-gold="10">+10 gold</button><button data-gold="100">+100 gold</button></div>
    <div class="row">jump to week <select id="eo-week">${weeks}</select> day <select id="eo-day">${days}</select><button id="eo-jump">go</button></div>
    <div class="row"><button id="eo-export">export action log</button><span id="eo-note" class="dim"></span></div>
    <details><summary>state</summary><pre id="eo-state"></pre></details>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  const render = () => {
    const s = store.getState();
    $('#eo-summary').innerHTML = s ? summary(s) : '<div class="dim">no run in progress</div>';
    $('#eo-state').textContent = s ? JSON.stringify(s, null, 1) : '';
  };

  // The M1 scenes draw once, so redraw the hand from the new state after a debug change.
  const redraw = () => {
    if (game.scene.isActive('Hand')) game.scene.getScene('Hand').scene.restart({ fixture: { scene: 'Hand', state: store.getState() } });
  };

  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (!store.getState()) return;
    if (el.dataset.gold) {
      store.dispatch({ type: 'debug', op: 'addGold', amount: Number(el.dataset.gold) });
      redraw();
    } else if (el.id === 'eo-jump') {
      store.dispatch({ type: 'debug', op: 'jumpToDay', week: Number($<HTMLSelectElement>('#eo-week').value), day: Number($<HTMLSelectElement>('#eo-day').value) });
      redraw();
    } else if (el.id === 'eo-export') {
      const s = store.getState()!;
      const log = JSON.stringify({ seed: s.seed, actions: store.log }, null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([log], { type: 'application/json' }));
      a.download = `elmbrook-${s.seed}.json`;
      a.click();
      $('#eo-note').textContent = store.log[0]?.type === 'startRun' ? 'saved; replay with pnpm sim --replay' : 'saved (loaded from a fixture, so not replayable)';
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== '`') return;
    root.hidden = !root.hidden;
    render();
  });
  store.subscribe(() => {
    if (!root.hidden) render();
  });
  render();
}
