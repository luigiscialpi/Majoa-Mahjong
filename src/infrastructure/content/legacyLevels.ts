import type { LevelSpec } from '../../domain/types';
import legacyData from './legacy-levels.json';

/** Livello dell'originale come esportato da `prototipi/s4-generatore/tools/export-levels.js`. */
export type LegacyLevel = {
  id: number;
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

/** Specifica del dominio a partire da un livello esportato dall'originale. */
export function toSpec(l: LegacyLevel): LevelSpec {
  return { id: `legacy-${l.id}`, cells: l.cells, groupSize: l.groupSize, types: l.types, poolSize: l.poolSize, hidden: l.hidden, fog: l.fog, gold: l.gold, aids: l.aids };
}
