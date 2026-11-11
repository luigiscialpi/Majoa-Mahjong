import type { IslandInfo } from '../domain/progress';

/**
 * Livelli «finali» della vittoria (`win`, riga 2294 dell'originale): l'ultimo dei livelli iniziali, la fine di ogni isola e la
 * fine della campagna. Nei finali i fuochi d'artificio sono più lunghi e partono con più razzi.
 */
export type Finale = 'prologue' | 'island' | 'grand';

const last = (ids: readonly number[]): number | undefined => ids[ids.length - 1];

/**
 * Il finale di `levelId`, o `null` se è un livello comune. `islands` sono le isole della campagna in ordine di apertura (la
 * prima sono i livelli iniziali, l'ultima chiude la campagna); `bonusLevelIds` i livelli dell'isola bonus, fuori dal percorso.
 */
export function finaleOf(levelId: number, islands: readonly IslandInfo[], bonusLevelIds: readonly number[]): Finale | null {
  if (islands.length > 0 && levelId === last(islands[islands.length - 1].levelIds)) return 'grand';
  if (islands.length > 0 && levelId === last(islands[0].levelIds)) return 'prologue';
  if (islands.some((island) => levelId === last(island.levelIds))) return 'island';
  return levelId === last(bonusLevelIds) ? 'island' : null;
}
