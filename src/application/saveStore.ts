import { newProgress, type Progress } from '../domain/progress';
import type { Result } from '../domain/types';
import { parseProgress, serializeProgress } from './progressCodec';
import { parseSavedGame, serializeSavedGame, type SavedGame } from './savedGame';
import type { SaveError } from './saveFormat';

type Done = Promise<Result<void, SaveError>>;

/**
 * Porta di archiviazione di progressi e partita in corso (`docs/salvataggi.md`). Ogni operazione restituisce un valore
 * con l'errore tipizzato. Senza progressi salvati `loadProgress` dà i progressi iniziali; senza partita, `null`.
 */
export type SaveStore = {
  loadProgress(): Promise<Result<Progress, SaveError>>;
  saveProgress(progress: Progress): Done;
  loadGame(): Promise<Result<SavedGame | null, SaveError>>;
  saveGame(game: SavedGame): Done;
  clearGame(): Done;
  /** Scrive i progressi e cancella la partita, insieme o per niente. */
  finishGame(progress: Progress): Done;
  /** Progressi iniziali e nessuna partita, insieme o per niente. */
  resetAll(): Done;
};

const ok: Result<void, SaveError> = { ok: true, value: undefined };

/**
 * Archivio in memoria per i test e per sviluppare la UI. Tiene i testi serializzati come un archivio vero, quindi passa
 * dagli stessi codec; `initial` permette di partire da contenuti scritti a mano, anche illeggibili.
 */
export function createMemorySaveStore(initial: { progress?: string; game?: string } = {}): SaveStore {
  let progressText: string | null = initial.progress ?? null;
  let gameText: string | null = initial.game ?? null;
  return {
    async loadProgress() {
      return progressText === null ? { ok: true, value: newProgress() } : parseProgress(progressText);
    },
    async saveProgress(progress) {
      progressText = serializeProgress(progress);
      return ok;
    },
    async loadGame() {
      return gameText === null ? { ok: true, value: null } : parseSavedGame(gameText);
    },
    async saveGame(game) {
      gameText = serializeSavedGame(game);
      return ok;
    },
    async clearGame() {
      gameText = null;
      return ok;
    },
    async finishGame(progress) {
      progressText = serializeProgress(progress);
      gameText = null;
      return ok;
    },
    async resetAll() {
      progressText = null;
      gameText = null;
      return ok;
    },
  };
}
