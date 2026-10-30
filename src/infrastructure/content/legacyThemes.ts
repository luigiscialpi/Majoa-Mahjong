import { STAR_TYPE } from '../../domain/types';
import themes from './legacy-themes.json';

/** Tavolozza di un livello: feltro chiaro, feltro scuro, accento, bordo, bordo scuro. */
export type Palette = readonly [string, string, string, string, string];

// ponytail: il JSON entra senza controlli di forma; li fa `legacyThemes.test.ts`, che lo confronta anche con l'originale.
const data = themes as unknown as { starDesign: number; designCount: number; islands: Record<string, number[]>; palettes: Palette[] };

/** Disegno (0-128) della tessera stella. */
export const STAR_DESIGN = data.starDesign;
/** Numero di disegni dell'originale. */
export const DESIGN_COUNT = data.designCount;

/** Tavolozza del livello `levelId` (1-100). */
export function levelPalette(levelId: number): Palette {
  const palette = data.palettes[levelId - 1];
  if (!palette) throw new Error(`il livello ${levelId} non ha una tavolozza`);
  return palette;
}

/**
 * Indice del disegno (0-128) di un tipo di tessera. Il generatore assegna posizioni `0…poolSize-1` del gruppo di disegni
 * dell'isola; la stella ha il suo disegno. La corrispondenza è una per una: tipi diversi hanno disegni diversi.
 */
export function designOf(island: string, type: number): number {
  if (type === STAR_TYPE) return STAR_DESIGN;
  const design = data.islands[island]?.[type];
  if (design === undefined) throw new Error(`il tipo ${type} è fuori dal gruppo di disegni dell'isola ${island}`);
  return design;
}
