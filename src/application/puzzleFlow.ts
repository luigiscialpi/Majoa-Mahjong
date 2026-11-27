import type { Progress } from '../domain/progress';
import { recordPuzzleWin, refundPuzzle, startPuzzle, type PuzzleDifficulty, type PuzzleId } from '../domain/puzzles';
import type { Stars } from '../domain/stars';
import type { Result } from '../domain/types';
import type { SaveError } from './saveFormat';
import type { SaveStore } from './saveStore';

// Flusso di una partita di rompicapo (`docs/gioco-originale.md`, sezione 8): costo all'avvio, rimborso se si esce senza mosse,
// vittoria con le ✨ della prima volta. Ogni passo scrive subito i progressi, così se l'app si chiude il costo resta pagato.

export type PuzzleStart = { kind: 'started'; progress: Progress } | { kind: 'no-coins' } | { kind: 'failed'; error: SaveError };

/** Toglie la ✨ per iniziare e la scrive; senza ✨ non parte (`no-coins`) e non scrive niente. */
export async function beginPuzzle(store: SaveStore, progress: Progress): Promise<PuzzleStart> {
  const started = startPuzzle(progress);
  if (!started) return { kind: 'no-coins' };
  const saved = await store.saveProgress(started);
  return saved.ok ? { kind: 'started', progress: started } : { kind: 'failed', error: saved.error };
}

/** Rende la ✨ (si esce senza aver fatto nessun tentativo) e la scrive. Chi chiama lo fa una volta sola per partita. */
export async function leavePuzzle(store: SaveStore, progress: Progress): Promise<Result<Progress, SaveError>> {
  const refunded = refundPuzzle(progress);
  const saved = await store.saveProgress(refunded);
  return saved.ok ? { ok: true, value: refunded } : saved;
}

export type PuzzleFinished = { progress: Progress; stars: Stars; coins: number; newRecord: boolean; saved: Result<void, SaveError> };

/** Registra la vittoria (stelle migliori, ✨ della prima volta) e la scrive. `stars` sono quelle del gioco, prima dell'aiuto. */
export async function finishPuzzle(store: SaveStore, progress: Progress, id: PuzzleId, difficulty: PuzzleDifficulty, stars: Stars, usedHint: boolean): Promise<PuzzleFinished> {
  const win = recordPuzzleWin(progress, id, difficulty, stars, usedHint);
  const saved = await store.saveProgress(win.progress);
  return { ...win, saved };
}
