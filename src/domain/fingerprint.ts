import type { GameState } from './gameState';

/**
 * Impronta a 64 bit (due FNV-1a a 32 bit con moltiplicatori diversi): basta a notare una modifica, senza dipendenze.
 * Legge i testi uno dopo l'altro senza separatori: chi la usa chiude ogni parte con un carattere che la delimita.
 * Il suo risultato è fissato da `legacyGolden.test.ts` e dalle partite salvate: non cambiare l'algoritmo.
 */
export function fingerprint(parts: Iterable<string>): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9747b28c;
  for (const text of parts) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function* boardParts(state: GameState): Generator<string> {
  for (let i = 0; i < state.tiles.length; i++) {
    const t = state.tiles[i];
    yield `${t.x},${t.y},${t.z},${t.type},${t.hiddenGroup},${t.fog ? 1 : 0},${t.gold ? 1 : 0},${state.ft.alive[i]};`;
  }
  yield `u${state.unlocked}`;
}

/**
 * Impronta della tavola di una partita: per ogni tessera, in ordine, posizione, disegno, gruppo nascosto, nebbia, oro e
 * se è ancora in tavola, più i gruppi nascosti aperti. Dopo aver ricostruito una partita salvata, se non coincide la
 * tavola è diversa da quella salvata (generatore, rimescoli o regole cambiati) e la partita non si riprende.
 */
export function boardFingerprint(state: GameState): string {
  return fingerprint(boardParts(state));
}
