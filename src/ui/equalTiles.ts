import type { GameState } from '../domain/gameState';

// Tessere uguali a quella scelta (evidenzia-uguali): logica pura, senza schermo.

/** Una tessera nascosta (con il lucchetto) non si può toccare: non è «libera» per il gioco (`fr=!lk&&isFree`, riga 1927 dell'originale). */
const isLocked = (game: GameState, i: number): boolean => game.tiles[i].hiddenGroup > game.unlocked;

/**
 * Le tessere libere dello stesso tipo della prima selezionata, escluse quelle già selezionate e quelle nascoste: rivelare
 * quale nascosta combacia sarebbe svelare il gioco (CSS `.tile.match`, riga 1928: `eqOn && fr && t.type === sel.type`).
 */
export function equalFreeTiles(game: GameState, selected: readonly number[]): number[] {
  if (selected.length === 0) return [];
  const type = game.tiles[selected[0]]?.type;
  if (type === undefined) return [];
  const chosen = new Set(selected);
  return [...game.ft.freeList()].filter((i) => !chosen.has(i) && game.tiles[i].type === type && !isLocked(game, i));
}

/**
 * Dopo aver scelto `tile`, mancano tessere uguali libere per completare il gruppo? Ne servono una nei livelli a coppie e
 * due nei Tris (`al.filter(...).length < GS-1`, riga 2127). Da qui l'avviso «Nessuna tessera uguale è libera per ora».
 */
export function lacksFreeMatch(game: GameState, tile: number): boolean {
  return equalFreeTiles(game, [tile]).length < game.g - 1;
}
