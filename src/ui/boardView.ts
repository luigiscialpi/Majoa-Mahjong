import type { GameState } from '../domain/gameState';

/** Aspetto di una tessera oltre al suo disegno. */
export type TileStatus = { locked: boolean; fog: boolean; gold: boolean };

/**
 * Tessere appena tolte tra due stati: sono quelle da animare. Se la tavola è un'altra (rimescolo, nuova partita) o una
 * tessera è tornata (Annulla) non c'è nulla da animare.
 */
export function newlyRemoved(previous: GameState, next: GameState): ReadonlySet<number> {
  if (previous.tiles !== next.tiles) return new Set();
  const removed = new Set<number>();
  for (let i = 0; i < next.tiles.length; i++) {
    const was = previous.ft.alive[i] === 1;
    const is = next.ft.alive[i] === 1;
    if (!was && is) return new Set();
    if (was && !is) removed.add(i);
  }
  return removed;
}

/** Tessere già tolte che non si stanno animando. */
export function goneTiles(game: GameState, removing: ReadonlySet<number>): Set<number> {
  const gone = new Set<number>();
  for (let i = 0; i < game.tiles.length; i++) if (game.ft.alive[i] === 0 && !removing.has(i)) gone.add(i);
  return gone;
}

/** Aspetto di ogni tessera: nascosta finché il suo gruppo è chiuso, nebbiosa finché non è libera, oro. */
export function tileStatuses(game: GameState): TileStatus[] {
  return game.tiles.map((t, i) => ({ locked: t.hiddenGroup > game.unlocked, fog: t.fog && !game.ft.isFree(i), gold: t.gold }));
}

/** Una cifra per tessera: cambia solo se cambia l'aspetto di qualche tessera (serve a sapere quando ridisegnare lo strato fermo). */
export function statusKey(statuses: readonly TileStatus[]): string {
  return statuses.map((s) => (s.locked ? 1 : 0) + (s.fog ? 2 : 0) + (s.gold ? 4 : 0)).join('');
}
