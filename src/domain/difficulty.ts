import { DEFAULT_WEIGHTS, FREEDOM_RANGE } from './weights';
import type { LevelSpec } from './types';

/** Misure della difficoltà di un livello, tutte normalizzate tra 0 e 1 (più alto = più difficile). */
export type Measures = {
  /** Tessere. */
  T: number;
  /** Piani. */
  Z: number;
  /** Tipi di disegno. */
  K: number;
  /** Gruppo da 3 (tris). */
  G: number;
  /** Quota di tessere nascoste. */
  H: number;
  /** Quota di tessere nebbiose. */
  F: number;
  /** Scarsità di aiuti iniziali. */
  A: number;
  /** Mancanza di libertà di manovra (1 − libertà normalizzata), da partite simulate. */
  Lc: number;
  /** Rischio di blocco: quota di partite casuali che restano senza mosse. */
  R: number;
};

/** Intervalli del catalogo dell'originale (100 livelli), usati per normalizzare. */
export const RANGES = {
  tiles: [15, 96],
  layers: [1, 5],
  types: [5, 24],
  hiddenShare: 0.41,
  fogShare: 0.18,
  aidCap: 10,
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const scale = (v: number, [lo, hi]: readonly [number, number] | readonly number[]) => clamp01((v - lo) / (hi - lo));

/** Misure che dipendono solo dalla specifica (non servono tavola né simulazione). */
export function staticMeasures(spec: LevelSpec): Pick<Measures, 'T' | 'Z' | 'K' | 'G' | 'H' | 'F' | 'A'> {
  const n = spec.cells.length;
  const layers = Math.max(...spec.cells.map((c) => c.z)) + 1;
  const hidden = spec.hidden.reduce((a, b) => a + b, 0);
  const aid = (v: number | null) => (v === null ? 0 : 1 - Math.min(v, RANGES.aidCap) / RANGES.aidCap);
  return {
    T: scale(n, RANGES.tiles),
    Z: scale(layers, RANGES.layers),
    K: scale(spec.types, RANGES.types),
    G: spec.groupSize === 3 ? 1 : 0,
    H: clamp01(hidden / n / RANGES.hiddenShare),
    F: clamp01(spec.fog / n / RANGES.fogShare),
    A: (aid(spec.aids.hints) + aid(spec.aids.shuffles) + aid(spec.aids.undo)) / 3,
  };
}

/** Misure ricavate da partite simulate: `freedom` è la libertà media (0-1), `stuck` la quota di partite bloccate. */
export function dynamicMeasures(sim: { freedom: number; stuck: number }): Pick<Measures, 'Lc' | 'R'> {
  return { Lc: 1 - scale(sim.freedom, FREEDOM_RANGE), R: clamp01(sim.stuck) };
}

/** Indice di difficoltà tra 0 e 100: somma pesata delle misure (i pesi sommano a 1). */
export function difficultyIndex(m: Measures, w: Measures = DEFAULT_WEIGHTS): number {
  const keys = Object.keys(m) as (keyof Measures)[];
  return 100 * keys.reduce((acc, k) => acc + w[k] * m[k], 0);
}

/** Etichetta da 1 a 5 (puntini): l'indice in cinque fasce uguali. */
export function difficultyLabel(index: number): 1 | 2 | 3 | 4 | 5 {
  return (Math.min(5, Math.floor(index / 20) + 1)) as 1 | 2 | 3 | 4 | 5;
}
