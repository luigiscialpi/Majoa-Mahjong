// Pesi e intervalli dell'indice di difficoltà. Valori ricavati con `prototipi/s4-generatore/tools/calibrate.py`.
// Pesi uniformi (1/9 ciascuno: l'indice massimo è 100). Correlazione di Spearman media tra indice e posizione
// nell'isola: uniformi 0.991, tarati 0.999 (convalida lascia-fuori-un'isola 0.998): l'ordine dell'originale non
// identifica i pesi. Con le etichette 1-5 dei livelli 21-90: uniformi 0.943, tarati 0.864.
import type { Measures } from './difficulty';

export const DEFAULT_WEIGHTS: Measures = { T: 1 / 9, Z: 1 / 9, K: 1 / 9, G: 1 / 9, H: 1 / 9, F: 1 / 9, A: 1 / 9, Lc: 1 / 9, R: 1 / 9 };
/** Intervallo della libertà media osservato nei 100 livelli, per normalizzare `Lc` tra 0 e 1. */
export const FREEDOM_RANGE: [number, number] = [0.2709, 0.6988];
