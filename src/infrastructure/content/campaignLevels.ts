import type { IslandInfo, Progress } from '../../domain/progress';
import { legacyIslands, trisLevelIds } from './legacyIslands';
import { legacyLevels, type LegacyLevel } from './legacyLevels';
import { isTrisSlot, trisVariant } from './trisSlots';

const EXTENSION_START_ID = 101;
const INFINITE_START_ID = 151;
const ISLAND_SIZE = 20;
const GENERATED_THEMES = ['sweets', 'art', 'science', 'sea', 'flowers'] as const;

const legacyById = new Map(legacyLevels.map((level) => [level.id, level]));
const levelsByTheme = new Map<string, readonly LegacyLevel[]>();
for (const level of legacyLevels) {
  if (level.groupSize === 3) continue;
  levelsByTheme.set(level.island, [...(levelsByTheme.get(level.island) ?? []), level]);
}

/**
 * Livelli 11–20 per le cinque isole che nell'originale si fermano a 10. Gli ID nuovi partono da 101:
 * i riferimenti 1–100, inclusi i Tris, restano invariati.
 */
const campaignExtensions: readonly LegacyLevel[] = legacyIslands.slice(2).flatMap((island, islandOffset) => {
  const original = island.levelIds.map((id) => legacyById.get(id)).filter((level): level is LegacyLevel => level !== undefined);
  return original.map((template, localOffset) => ({
    ...template,
    id: EXTENSION_START_ID + islandOffset * 10 + localOffset,
    islandId: island.id,
    local: localOffset + 11,
    islandSize: ISLAND_SIZE,
    types: Math.min(template.poolSize, template.types + 2),
    boss: localOffset === 9,
  }));
});

const extensionById = new Map(campaignExtensions.map((level) => [level.id, level]));

function infiniteLevel(id: number): LegacyLevel {
  const offset = id - INFINITE_START_ID;
  const islandNumber = 8 + Math.floor(offset / ISLAND_SIZE);
  const local = (offset % ISLAND_SIZE) + 1;
  const theme = GENERATED_THEMES[(islandNumber - 8) % GENERATED_THEMES.length];
  const templates = levelsByTheme.get(theme) ?? [];
  // Riusa ciclicamente tutte le forme verificate del tema; il generatore varia la disposizione delle tessere.
  const template = templates[(local - 1) % templates.length] ?? templates[0];
  if (!template) throw new Error(`nessuna forma disponibile per l'isola generata ${islandNumber}`);

  // ponytail: una curva semplice aumenta i disegni di un'unità per isola, fino al limite disponibile nel tema.
  const types = Math.min(template.poolSize, 12 + (islandNumber - 8));
  return {
    ...template,
    id,
    islandId: `generated-${islandNumber}`,
    local,
    islandSize: ISLAND_SIZE,
    types,
    boss: local === ISLAND_SIZE,
  };
}

/**
 * Restituisce un livello originale o generato. Il primo livello di ogni isola dalla seconda in poi è un Tris (`trisSlots.ts`);
 * i dieci Tris dell'originale restano disponibili, fuori dalla campagna. Il numero di un livello non è una garanzia sul suo
 * contenuto: i progressi stanno per numero, quindi fino alla prima uscita pubblica si possono azzerare.
 */
export function campaignLevelById(id: number): LegacyLevel | undefined {
  if (!Number.isSafeInteger(id) || id < 1) return undefined;
  const level = legacyById.get(id) ?? extensionById.get(id) ?? (id >= INFINITE_START_ID ? infiniteLevel(id) : undefined);
  return level && isTrisSlot(level) ? trisVariant(level) : level;
}

/** Tutti i livelli visibili per le isole indicate, in ordine locale. */
export function campaignLevelsFor(island: IslandInfo): LegacyLevel[] {
  return island.levelIds.map(campaignLevelById).filter((level): level is LegacyLevel => level !== undefined);
}

/**
 * Costruisce la campagna fino a due isole oltre l'ultimo livello generato salvato. Questo mantiene visibile una prossima
 * isola chiusa senza allocare in memoria un catalogo infinito; il limite avanza man mano che l'utente gioca.
 */
export function campaignIslandsForProgress(progress: Progress): readonly IslandInfo[] {
  let completedInfiniteIslands = 0;
  while (progress.levels[INFINITE_START_ID + (completedInfiniteIslands + 1) * ISLAND_SIZE - 1]?.stars >= 1) completedInfiniteIslands++;
  const extraIslandCount = 2 + completedInfiniteIslands;

  const extensions = campaignExtensions.reduce((byIsland, level) => {
    const current = byIsland.get(level.islandId ?? level.island) ?? [];
    current.push(level.id);
    byIsland.set(level.islandId ?? level.island, current);
    return byIsland;
  }, new Map<string, number[]>());

  const original = legacyIslands.map((island) => {
    const extra = extensions.get(island.id) ?? [];
    return extra.length > 0 ? { ...island, levelIds: [...island.levelIds, ...extra] } : island;
  });
  const infinite: IslandInfo[] = Array.from({ length: extraIslandCount }, (_, index) => {
    const islandNumber = 8 + index;
    const firstId = INFINITE_START_ID + index * ISLAND_SIZE;
    return {
      id: `generated-${islandNumber}`,
      levelIds: Array.from({ length: ISLAND_SIZE }, (_, levelIndex) => firstId + levelIndex),
      gift: 5,
    };
  });
  return [...original, ...infinite];
}

/** ID dei livelli Tris, separati dal percorso della campagna. */
export { trisLevelIds };
