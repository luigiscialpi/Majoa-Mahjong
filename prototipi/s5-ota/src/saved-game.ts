import { LevelSpec, SavedGame, RestoreResult, StorageAdapter } from './types';
import { ContentRepository } from './content-repository';

const SAVED_GAME_KEY = 'majoa_active_game_v1';

// Hash deterministico della tavola derivato da spec, seme e storico mosse (FNV-1a 32-bit)
export function computeBoardHash(spec: LevelSpec, seed: number, moves: number[]): string {
  const payload = `${spec.id}:${spec.tileCount}:${spec.groupSize}:${spec.K}:${spec.version}:${seed}:${moves.join(',')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function saveGame(storage: StorageAdapter, game: SavedGame): void {
  storage.setItem(SAVED_GAME_KEY, JSON.stringify(game));
}

export function loadSavedGame(storage: StorageAdapter): SavedGame | null {
  const raw = storage.getItem(SAVED_GAME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedGame;
  } catch {
    return null;
  }
}

export function clearSavedGame(storage: StorageAdapter): void {
  storage.removeItem(SAVED_GAME_KEY);
}

// Regola 3: Ripristina o scarta in modo sicuro la partita in corso a fronte dei contenuti attivi
export function restoreSavedGame(
  storage: StorageAdapter,
  repository: ContentRepository
): RestoreResult {
  const saved = loadSavedGame(storage);
  if (!saved) {
    return {
      status: 'discarded',
      reason: 'spec-not-found',
      message: 'Nessuna partita salvata trovata in memoria.',
    };
  }

  const currentSpec = repository.getLevel(saved.levelId);
  if (!currentSpec) {
    // Il livello non esiste più nel catalogo attivo
    clearSavedGame(storage);
    return {
      status: 'discarded',
      reason: 'spec-not-found',
      message: `Il livello ${saved.levelId} non esiste più nel catalogo dei contenuti. Partita scartata.`,
    };
  }

  // Verifica integrità della tavola (l'hash deve coincidere esattamente)
  const expectedHash = computeBoardHash(currentSpec, saved.seed, saved.moves);
  if (saved.boardHash !== expectedHash) {
    // Lo spec o la configurazione sono stati alterati: scarto transazionale pulito
    clearSavedGame(storage);
    return {
      status: 'discarded',
      reason: 'hash-mismatch',
      message: `Incongruenza nella configurazione del livello ${saved.levelId} (hash mismatch). Partita scartata in modo sicuro.`,
    };
  }

  return {
    status: 'restored',
    levelSpec: currentSpec,
    playedMoves: saved.moves.length,
    message: `Partita su ${currentSpec.id} ripristinata con successo (${saved.moves.length} mosse giocate).`,
  };
}
