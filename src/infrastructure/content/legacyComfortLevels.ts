import type { Cell } from '../../domain/types';

function rect(cells: Cell[], x0: number, y0: number, w: number, h: number, z: number, corners?: boolean): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (corners && (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1)) continue;
      cells.push({ x, y, z });
    }
  }
}

type ComfortBuilder = (cells: Cell[]) => void;

/**
 * Le 20 forme scritte a mano per la Modalità comoda (senior) dell'originale
 * (reference/majoa-originale/Majoa Mahjong.html, riga 1280: COMFORT).
 * Massimo 5 colonne × 6 righe, tessere più grandi e conteggi ridotti (da 16 a 72 tessere).
 */
const COMFORT_BUILDERS: readonly ComfortBuilder[] = [
  (a) => { rect(a, 0, 0, 4, 4, 0); },
  (a) => { rect(a, 0, 0, 5, 4, 0); },
  (a) => { rect(a, 0, 0, 5, 5, 0, true); },
  (a) => { rect(a, 0, 0, 5, 5, 0, true); rect(a, 1, 1, 3, 3, 1); },
  (a) => { rect(a, 0, 0, 5, 6, 0, true); rect(a, 1, 1, 3, 4, 1); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 2, 3, 2, 2); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 2, 3, 2, 3); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 2, 3, 2, 3); rect(a, 1, 2, 3, 1, 4); },
  (a) => { rect(a, 0, 0, 5, 6, 0, true); rect(a, 1, 1, 3, 4, 1); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 2, 3, 2, 2); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 2, 3, 2, 3); },
  (a) => { rect(a, 0, 0, 5, 6, 0, true); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 2, 3, 2, 3); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 2, 3, 2, 3); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 2, 3, 2, 3); rect(a, 1, 2, 3, 1, 4); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 1, 3, 4, 3); },
  (a) => { rect(a, 0, 0, 5, 6, 0); rect(a, 1, 1, 3, 4, 1); rect(a, 1, 1, 3, 4, 2); rect(a, 1, 1, 3, 4, 3); rect(a, 1, 2, 3, 2, 4); },
];

function buildComfortCells(index: number): readonly Cell[] {
  const builder = COMFORT_BUILDERS[index];
  if (!builder) return [];
  const cells: Cell[] = [];
  builder(cells);
  if (cells.length % 2 !== 0) cells.pop();
  return cells;
}

// Pre-calcolate una volta sola:
const COMFORT_CELLS: readonly (readonly Cell[])[] = Array.from({ length: 20 }, (_, i) => buildComfortCells(i));

/**
 * Restituisce le celle della tavola per la Modalità comoda per i livelli 1-20.
 * Per livelli > 20 o non validi, restituisce `undefined`.
 */
export function comfortCellsForLevel(levelId: number): readonly Cell[] | undefined {
  if (levelId < 1 || levelId > 20) return undefined;
  return COMFORT_CELLS[levelId - 1];
}

/** Numero di livelli che hanno un layout dedicato per la Modalità comoda. */
export const COMFORT_LEVEL_COUNT = 20;
