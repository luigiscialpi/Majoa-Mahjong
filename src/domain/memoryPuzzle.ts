import { createRng } from './prng';
import { PUZZLE_HINTS, type PuzzleDifficulty } from './puzzles';
import type { Stars } from './stars';

// Memory (`docs/gioco-originale.md`, sezione 8; `buildMemory` nell'originale): si girano due carte alla volta, le uguali restano scoperte.
// Il motore è una macchina a stati pura: la schermata chiama `flipCard`, poi `settle` dopo i tempi sotto (`lock` dice cosa si sta aspettando).

/** Griglie dell'originale: colonne × righe; le coppie sono colonne × righe / 2 (6, 8, 10). */
export const MEMORY_LAYOUTS: Readonly<Record<PuzzleDifficulty, { columns: number; rows: number }>> = {
  easy: { columns: 3, rows: 4 },
  medium: { columns: 4, rows: 4 },
  hard: { columns: 4, rows: 5 },
};

/** Dopo quanto le carte diverse si rigirano (ms). */
export const MEMORY_MISMATCH_MS = 800;
/** Dopo quanto una coppia trovata si segna come tale (ms, solo animazione). */
export const MEMORY_MATCH_MS = 350;
/** Quanto l'aiuto mostra tutte le carte (ms). */
export const MEMORY_HINT_MS = 1500;

/** Cosa si sta aspettando: nulla, che le carte diverse si rigirino, o la fine dell'aiuto. Nel frattempo le carte non si girano. */
export type MemoryLock = 'none' | 'mismatch' | 'hint';

export type MemoryState = {
  readonly difficulty: PuzzleDifficulty;
  /** Il disegno di ogni carta: ogni disegno compare due volte. */
  readonly cards: readonly number[];
  /** Carte girate e non ancora risolte (0, 1 o 2). */
  readonly up: readonly number[];
  /** Carte di una coppia già trovata. */
  readonly matched: readonly boolean[];
  /** Coppie di carte girate, giuste o sbagliate (`moves` nell'originale). */
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly lock: MemoryLock;
};

export function memoryPairs(difficulty: PuzzleDifficulty): number {
  const { columns, rows } = MEMORY_LAYOUTS[difficulty];
  return (columns * rows) / 2;
}

/** Una partita nuova: `pairs` disegni diversi presi a caso da `pool` (almeno `pairs`), ognuno due volte, mescolati. Stesso seme, stessa partita. */
export function createMemory(difficulty: PuzzleDifficulty, pool: readonly number[], seed: number): MemoryState {
  const rng = createRng(seed);
  const types = rng.shuffle([...pool]).slice(0, memoryPairs(difficulty));
  const cards = rng.shuffle([...types, ...types]);
  return { difficulty, cards, up: [], matched: cards.map(() => false), attempts: 0, hintsUsed: 0, lock: 'none' };
}

/** Gira la carta `index`; non fa niente se si sta aspettando, se è già girata o trovata. Alla seconda carta conta un tentativo. */
export function flipCard(state: MemoryState, index: number): MemoryState {
  if (state.lock !== 'none' || state.up.includes(index) || state.matched[index] !== false) return state;
  const up = [...state.up, index];
  if (up.length < 2) return { ...state, up };
  const [a, b] = up;
  if (state.cards[a] === state.cards[b]) {
    return { ...state, up: [], attempts: state.attempts + 1, matched: state.matched.map((done, i) => done || i === a || i === b) };
  }
  return { ...state, up, attempts: state.attempts + 1, lock: 'mismatch' };
}

/** Finisce l'attesa: le carte diverse si rigirano (dopo `MEMORY_MISMATCH_MS`) o l'aiuto si chiude (dopo `MEMORY_HINT_MS`). */
export function settle(state: MemoryState): MemoryState {
  if (state.lock === 'mismatch') return { ...state, up: [], lock: 'none' };
  return state.lock === 'hint' ? { ...state, lock: 'none' } : state;
}

/** Aiuto 💡: mostra tutte le carte per `MEMORY_HINT_MS`. `null` se si sta aspettando, se ne sono già stati usati 3 o se è finita. */
export function hintMemory(state: MemoryState): MemoryState | null {
  if (state.lock !== 'none' || state.hintsUsed >= PUZZLE_HINTS || isMemoryWon(state)) return null;
  return { ...state, hintsUsed: state.hintsUsed + 1, lock: 'hint' };
}

/** Se la carta si vede: trovata, girata o durante l'aiuto. */
export function isFaceUp(state: MemoryState, index: number): boolean {
  return state.matched[index] || state.up.includes(index) || state.lock === 'hint';
}

export function isMemoryWon(state: MemoryState): boolean {
  return state.matched.every(Boolean);
}

/** Si esce senza aver fatto nessuna mossa (nessuna coppia girata) e senza vincere: la ✨ torna indietro, come nell'originale. */
export function canRefundMemory(state: MemoryState): boolean {
  return state.attempts === 0 && !isMemoryWon(state);
}

/** Stelle: con `errori = tentativi − coppie`, fino a metà coppie 3 stelle, fino alle coppie 2, altrimenti 1. */
export function memoryStars(attempts: number, pairs: number): Stars {
  const errors = attempts - pairs;
  return errors <= pairs / 2 ? 3 : errors <= pairs ? 2 : 1;
}
