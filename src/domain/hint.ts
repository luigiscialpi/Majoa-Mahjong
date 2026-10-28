import type { GameState } from './gameState';
import { STAR_TYPE } from './types';

/**
 * Mossa suggerita dall'Aiuto: `groupSize` tessere giocabili dello stesso tipo, oppure `null` se non esiste nessuna mossa
 * (stato «bloccato», che nell'originale avvia il rimescolo automatico). Finché ci sono gruppi nascosti chiusi preferisce
 * il gruppo di stelle; altrimenti sceglie il gruppo che contiene la prima tessera giocabile (nell'ordine delle tessere).
 * Nei Tris l'originale sceglie il tipo con l'indice più basso: la mossa suggerita può differire, la regola no.
 */
export function findMove(state: GameState): number[] | null {
  const byType = state.playableByType();
  const candidates = [...byType.entries()].filter(([, tiles]) => tiles.length >= state.g);
  if (candidates.length === 0) return null;
  const hiddenGroups = state.tiles.reduce((max, t) => Math.max(max, t.hiddenGroup), 0);
  if (state.unlocked < hiddenGroups) {
    const stars = candidates.find(([slot]) => slot === state.slot(STAR_TYPE));
    if (stars) return stars[1].slice(0, state.g);
  }
  const [, tiles] = candidates.reduce((best, c) => (c[1][0] < best[1][0] ? c : best));
  return tiles.slice(0, state.g);
}
