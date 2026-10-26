// Pesi e intervalli dell'indice di difficoltà. Generato da `tools/calibrate.py`: non modificare a mano.
// Pesi uniformi. Correlazione di Spearman media tra indice e posizione nell'isola: uniformi 0.991, tarati 0.999
// (convalida lascia-fuori-un'isola 0.998): l'ordine dell'originale non identifica i pesi. Con le etichette 1-5 dei livelli 21-90: uniformi 0.943, tarati 0.864.
// Dettagli in src/data/calibration.json.
import type { Measures } from './difficulty.ts';

export const DEFAULT_WEIGHTS: Measures = { T: 0.1111, Z: 0.1111, K: 0.1111, G: 0.1111, H: 0.1111, F: 0.1111, A: 0.1111, Lc: 0.1111, R: 0.1111 };
/** Intervallo della libertà media osservato nei 100 livelli, per normalizzare `Lc` tra 0 e 1. */
export const FREEDOM_RANGE: [number, number] = [0.2709, 0.6988];
