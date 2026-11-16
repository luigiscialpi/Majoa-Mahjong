import type { LevelSpec } from '../../domain/types';
import legacyData from './legacy-levels.json';
import { comfortCellsForLevel } from './legacyComfortLevels';

/** Livello dell'originale come esportato da `prototipi/s4-generatore/tools/export-levels.js`. */
export type LegacyLevel = {
  id: number;
  /** Identificativo dell'isola nella progressione; per i livelli originali coincide con `island`. */
  islandId?: string;
  island: string;
  local: number;
  islandSize: number;
  name: string;
  cells: { x: number; y: number; z: number }[];
  groupSize: 2 | 3;
  types: number;
  poolSize: number;
  hidden: number[];
  fog: number;
  gold: number;
  aids: { hints: number | null; shuffles: number | null; undo: number | null };
  label: number;
  boss: boolean;
};

// ponytail: il JSON entra senza controlli di forma; li fa `legacyLevels.test.ts` sui 100 livelli, che sono dati fissi.
export const legacyLevels = legacyData as unknown as readonly LegacyLevel[];

export type ToSpecOptions = {
  /** Se `true`, applica le regole e il layout della Modalità comoda (senior). */
  comfort?: boolean;
};

/**
 * Specifica del dominio a partire da un livello esportato dall'originale.
 * In Modalità comoda:
 * - layout dedicato a 5 colonne per i livelli 1-20 (`COMFORT`), standard per le altre isole;
 * - numero di disegni ridotto: max(6, round(types * 0.7));
 * - nessuna nebbia (`fog: 0`);
 * - aiuti illimitati (`hints: null, undo: null, shuffles: null`).
 */
export function toSpec(l: LegacyLevel, options?: ToSpecOptions): LevelSpec {
  if (!options?.comfort) {
    return {
      id: `legacy-${l.id}`,
      cells: l.cells,
      groupSize: l.groupSize,
      types: l.types,
      poolSize: l.poolSize,
      hidden: l.hidden,
      fog: l.fog,
      gold: l.gold,
      aids: l.aids,
    };
  }

  const comfortCells = (l.id >= 1 && l.id <= 20 ? comfortCellsForLevel(l.id) : undefined) ?? l.cells;
  const comfortTypes = Math.max(6, Math.min(l.poolSize, Math.round(l.types * 0.7)));

  return {
    id: `legacy-${l.id}`,
    cells: comfortCells,
    groupSize: l.groupSize,
    types: comfortTypes,
    poolSize: l.poolSize,
    hidden: l.hidden,
    fog: 0,
    gold: l.gold,
    aids: { hints: null, shuffles: null, undo: null },
  };
}
