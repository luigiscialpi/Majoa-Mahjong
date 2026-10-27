import { ContentBundle, IslandSpec, LevelSpec } from './types';

function createLevelsForIsland(islandId: string, count: number, version = 1): Record<string, LevelSpec> {
  const levels: Record<string, LevelSpec> = {};
  for (let i = 1; i <= count; i++) {
    const id = `${islandId}-lv-${i}`;
    levels[id] = {
      id,
      islandId,
      levelIndex: i,
      tileCount: 16 + (i * 4),
      groupSize: 2,
      K: Math.min(6 + Math.floor(i / 2), 24),
      mechanics: i > 10 ? ['fog'] : [],
      version,
    };
  }
  return levels;
}

// Bundle V1 (Fornito all'installazione dell'app)
const islandsV1: IslandSpec[] = [
  { id: 'island-1', name: 'Atollo Corallino', icon: '🏝️', order: 1, levelCount: 20, theme: 'coral' },
  { id: 'island-2', name: 'Foresta Tropicale', icon: '🌴', order: 2, levelCount: 20, theme: 'jungle' },
];

const levelsV1: Record<string, LevelSpec> = {
  ...createLevelsForIsland('island-1', 20, 1),
  ...createLevelsForIsland('island-2', 20, 1),
};

export const BUNDLE_V1: ContentBundle = {
  contentVersion: 1,
  minAppVersion: '1.0.0',
  islands: islandsV1,
  levels: levelsV1,
};

// Bundle V2 (Rilasciato via OTA: Nuova Isola 3 Vulcanica in modalità Append-Only)
const islandsV2: IslandSpec[] = [
  ...islandsV1,
  { id: 'island-3', name: 'Picco Vulcanico', icon: '🌋', order: 3, levelCount: 20, theme: 'volcano' },
];

const levelsV2: Record<string, LevelSpec> = {
  ...levelsV1, // Mantiene identici i livelli di Isola 1 e 2
  ...createLevelsForIsland('island-3', 20, 1), // Aggiunge 20 nuovi livelli
};

export const BUNDLE_V2: ContentBundle = {
  contentVersion: 2,
  minAppVersion: '1.0.0',
  islands: islandsV2,
  levels: levelsV2,
};

// Bundle Invalido (Viola la regola 2: modifica uno spec esistente alterando il conteggio tessere)
export const BUNDLE_INVALID_MUTATED: ContentBundle = {
  contentVersion: 3,
  minAppVersion: '1.0.0',
  islands: islandsV2,
  levels: {
    ...levelsV2,
    'island-1-lv-5': {
      ...levelsV2['island-1-lv-5'],
      tileCount: 999, // Mutazione non retrocompatibile dello spec
      version: 2,
    },
  },
};
