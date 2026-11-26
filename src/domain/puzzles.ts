import type { Progress } from './progress';
import type { Stars } from './stars';

// Telaio comune dei rompicapi (`docs/gioco-originale.md`, sezione 8): costi, ✨, stelle e aiuti uguali per i dieci giochi.
// Ogni gioco calcola le sue stelle (da errori o mosse) e questo modulo applica le regole comuni; i progressi tengono le
// migliori per ogni coppia «rompicapo + difficoltà».

export const PUZZLE_IDS = ['memory', 'missingPiece', 'sudoku', 'sliding', 'maze', 'differences', 'jars', 'links', 'wordSearch', 'dots'] as const;
export type PuzzleId = (typeof PUZZLE_IDS)[number];

export const PUZZLE_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type PuzzleDifficulty = (typeof PUZZLE_DIFFICULTIES)[number];

/** Chiave di una coppia rompicapo + difficoltà nei progressi, ad esempio `memory:easy`. */
export type PuzzleKey = `${PuzzleId}:${PuzzleDifficulty}`;

/** Le 30 coppie, rompicapo per rompicapo. */
export const PUZZLE_KEYS: readonly PuzzleKey[] = PUZZLE_IDS.flatMap((id) => PUZZLE_DIFFICULTIES.map((difficulty): PuzzleKey => `${id}:${difficulty}`));

export function puzzleKey(id: PuzzleId, difficulty: PuzzleDifficulty): PuzzleKey {
  return `${id}:${difficulty}`;
}

/** Le stelle migliori per coppia; manca la coppia che non si è mai vinta. */
export type PuzzleResults = Readonly<Partial<Record<PuzzleKey, Stars>>>;

/** ✨ per iniziare un rompicapo. */
export const PUZZLE_COST = 1;
/** ✨ della prima vittoria di ogni coppia (netto +1 rispetto al costo). */
export const PUZZLE_FIRST_WIN_COINS = 2;
/** Aiuti gratuiti 💡 per partita. */
export const PUZZLE_HINTS = 3;
/** Con anche un solo aiuto usato, le stelle arrivano al massimo a 2. */
export const PUZZLE_MAX_STARS_WITH_HINT: Stars = 2;

/** Toglie il costo per iniziare; `null` senza ✨ sufficienti (il gioco non parte e si avvisa). */
export function startPuzzle(progress: Progress): Progress | null {
  return progress.coins >= PUZZLE_COST ? { ...progress, coins: progress.coins - PUZZLE_COST } : null;
}

/** Rende il costo: si esce senza aver fatto nessuna mossa. Chi chiama lo fa una volta sola per partita. */
export function refundPuzzle(progress: Progress): Progress {
  return { ...progress, coins: progress.coins + PUZZLE_COST };
}

/** Le stelle che contano: con un aiuto usato non si superano le 2. */
export function effectiveStars(stars: Stars, usedHint: boolean): Stars {
  return usedHint ? (Math.min(stars, PUZZLE_MAX_STARS_WITH_HINT) as Stars) : stars;
}

/**
 * Registra una vittoria: tiene la stella migliore della coppia e dà le ✨ della prima vittoria (rigiocando non c'è rimborso).
 * `stars` sono quelle del gioco, prima dell'aiuto. Restituisce i progressi nuovi, le stelle che contano, le ✨ e se è un record.
 */
export function recordPuzzleWin(progress: Progress, id: PuzzleId, difficulty: PuzzleDifficulty, stars: Stars, usedHint: boolean): { progress: Progress; stars: Stars; coins: number; newRecord: boolean } {
  const key = puzzleKey(id, difficulty);
  const previous = progress.puzzles[key];
  const earned = effectiveStars(stars, usedHint);
  const coins = previous === undefined ? PUZZLE_FIRST_WIN_COINS : 0;
  const best = previous === undefined ? earned : (Math.max(previous, earned) as Stars);
  return { progress: { ...progress, coins: progress.coins + coins, puzzles: { ...progress.puzzles, [key]: best } }, stars: earned, coins, newRecord: previous === undefined || earned > previous };
}
