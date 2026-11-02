import type { IslandInfo } from '../../domain/progress';
import { legacyLevels } from './legacyLevels';
import { islandData } from './legacyThemes';

/**
 * Le isole della campagna dell'originale in ordine di apertura (livelli iniziali, animali, dolci, arte, scienza, mare, fiori),
 * con i loro livelli e il regalo ✨. I Tris sono un insieme a parte, fuori dal percorso delle isole.
 */
export const legacyIslands: readonly IslandInfo[] = (() => {
  const order: string[] = [];
  const levels = new Map<string, number[]>();
  for (const l of legacyLevels) {
    if (islandData(l.island).bonus) continue;
    if (!levels.has(l.island)) {
      levels.set(l.island, []);
      order.push(l.island);
    }
    levels.get(l.island)?.push(l.id);
  }
  return order.map((id) => ({ id, levelIds: levels.get(id) ?? [], gift: islandData(id).gift }));
})();

/** Livelli dell'isola bonus dei Tris (raggiungibile dalla sala Rompicapi). */
export const trisLevelIds: readonly number[] = legacyLevels.filter((l) => islandData(l.island).bonus).map((l) => l.id);
