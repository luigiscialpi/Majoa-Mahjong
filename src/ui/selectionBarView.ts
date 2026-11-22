import type { Feedback } from '../application/session';
import type { GameState } from '../domain/gameState';
import { designOf } from '../infrastructure/content/legacyThemes';

// Barra delle tessere selezionate (`#selbar` dell'originale, righe 192 e 444; `sbShow`, riga 1960). Logica pura: cosa mostra la
// barra a ogni azione e per quanto. Il disegno è di `SelectionBar`, lo stato nel tempo di `useSelectionBar`.

/** Una casella: il disegno di una tessera (indice dei 129 disegni), oppure una tessera nascosta o nebbiosa. */
export type BarSlot = number | 'locked' | 'fog';
/** Il segno accanto alle caselle: abbinamento riuscito, tessere diverse, tessera nascosta toccata, tessera bloccata toccata. */
export type BarStatus = 'ok' | 'bad' | 'locked' | 'blocked' | null;
export type BarView = { readonly slots: readonly BarSlot[]; readonly status: BarStatus };

/** Quanto restano visibili un rifiuto o due tessere diverse (`sbLater(..., 900)`, righe 2122, 2123 e 2151). */
export const BAR_REJECT_MS = 900;
/** Quanto resta visibile un abbinamento riuscito (`sbLater(..., 1100)`, riga 2143). */
export const BAR_MATCH_MS = 1100;
/** Quante tessere abbinate di recente mostra la barra (`sbRecent.slice(-4)`, riga 1968). */
export const BAR_RECENT = 4;

/** Le tessere selezionate in questo momento, senza segno. */
export function selectionView(game: GameState, island: string, selected: readonly number[]): BarView {
  return { slots: selected.map((i) => designOf(island, game.tiles[i].type)), status: null };
}

export type Transient = { readonly view: BarView; readonly ms: number };

/**
 * Cosa mostra la barra, per un po', dopo un'azione: i rifiuti (nascosta 🔒, bloccata ⛔), due tessere diverse (✖, con la
 * selezione precedente) e un abbinamento (✔, con tutto il gruppo). Altre azioni non hanno nulla di passeggero: la barra
 * torna alla selezione. `previous` è la selezione di prima dell'azione, che nel feedback `mismatch` non c'è più.
 */
export function transientView(feedback: Feedback | null, game: GameState, island: string, tapped: number | null, previous: readonly number[]): Transient | null {
  const design = (i: number): BarSlot => designOf(island, game.tiles[i].type);
  if (feedback?.kind === 'matched') return { view: { slots: feedback.group.map(design), status: 'ok' }, ms: BAR_MATCH_MS };
  if (tapped === null) return null;
  if (feedback?.kind === 'rejected' && feedback.reason === 'locked') return { view: { slots: ['locked'], status: 'locked' }, ms: BAR_REJECT_MS };
  if (feedback?.kind === 'rejected' && feedback.reason === 'tile-blocked') {
    // Una tessera bloccata non è libera: con la nebbia è ancora velata (`t.fogOn`, riga 1957).
    return { view: { slots: [game.tiles[tapped].fog ? 'fog' : design(tapped)], status: 'blocked' }, ms: BAR_REJECT_MS };
  }
  if (feedback?.kind === 'mismatch' && previous.length > 0) return { view: { slots: [design(previous[0]), design(tapped)], status: 'bad' }, ms: BAR_REJECT_MS };
  return null;
}

/** Il nome di una casella nella lingua attiva (`tName`, riga 1957). */
function slotName(slot: BarSlot, tn: readonly string[], hidden: string, fog: string): string {
  return slot === 'locked' ? hidden : slot === 'fog' ? fog : (tn[slot] ?? '');
}

/** Il nome mostrato: quello della prima tessera e, se la seconda ne ha uno diverso, «primo ≠ secondo» (`sbShow`, riga 1967). */
export function barName(slots: readonly BarSlot[], tn: readonly string[], hidden: string, fog: string): string {
  if (slots.length === 0) return '';
  const first = slotName(slots[0], tn, hidden, fog);
  if (slots.length < 2) return first;
  const second = slotName(slots[1], tn, hidden, fog);
  return second !== first ? `${first} ≠ ${second}` : first;
}
