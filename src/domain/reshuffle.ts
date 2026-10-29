import { GameState } from './gameState';
import { MAX_ATTEMPTS, pickRandom, planChunks } from './generator';
import { createRng, hashSeed } from './prng';
import { STAR_TYPE, type GenError, type Result } from './types';

/**
 * Mischia (e rimescolo automatico): riassegna i disegni delle tessere rimaste, mantenendo la partita risolvibile.
 * Restano uguali posizioni, tessere tolte, gruppi nascosti aperti e flag di nascosta, nebbia e oro; cambiano i tipi, stelle
 * comprese (i gruppi di stelle ancora da aprire si ripianificano). Come per la generazione, simula la partita in avanti,
 * scegliendo solo tessere libere e già giocabili; se un tentativo non riesce ne prova un altro con un seme derivato.
 * `types` è il numero di disegni normali da usare. Non conta come aiuto e non azzera nulla: spetta a chi chiama.
 * Se nessun tentativo riesce restituisce `generation-failed`: nell'originale in quel caso l'assegnazione non è garantita.
 */
export function reshuffle(state: GameState, types: number, seed: number, maxAttempts = MAX_ATTEMPTS): Result<GameState, GenError> {
  const g = state.g;
  const poolSize = state.slots - 1;
  const alive = state.tiles.map((_, i) => i).filter((i) => state.ft.alive[i] === 1);
  const need = state.tiles.reduce((max, t) => Math.max(max, t.hiddenGroup), 0) - state.unlocked;
  if (alive.length % g !== 0) return invalid(`le tessere rimaste (${alive.length}) non sono un multiplo del gruppo (${g})`);
  if (types < 1 || types > poolSize) return invalid(`tipi (${types}) fuori dall'intervallo 1-${poolSize}`);
  if (need * g > alive.length) return invalid('più gruppi di stelle da aprire che tessere rimaste');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rng = createRng(hashSeed(seed, attempt));
    const chunks = planChunks(alive.length, g, need, types, poolSize, rng);
    const ft = state.ft.clone();
    let unlocked = state.unlocked;
    const type = new Int16Array(state.tiles.length).fill(-2);
    let ok = true;
    for (const chunk of chunks) {
      const free = ft.freeList().filter((i) => state.tiles[i].hiddenGroup <= unlocked);
      if (free.length < chunk.size) {
        ok = false;
        break;
      }
      const picked = pickRandom(free, chunk.size, rng);
      for (const t of picked) type[t] = chunk.type;
      for (const t of picked) ft.remove(t);
      if (chunk.type === STAR_TYPE) unlocked++;
    }
    if (!ok) continue;
    const tiles = state.tiles.map((t, i) => (state.ft.alive[i] === 1 ? { ...t, type: type[i] } : t));
    return { ok: true, value: new GameState(tiles, g, poolSize, state) };
  }
  return { ok: false, error: { kind: 'generation-failed', attempts: maxAttempts } };
}

function invalid(reason: string): Result<GameState, GenError> {
  return { ok: false, error: { kind: 'invalid-spec', reason } };
}
