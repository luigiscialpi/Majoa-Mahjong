export interface IslandSpec {
  id: string;
  name: string;
  icon: string;
  order: number;
  levelCount: number;
  theme: string;
}

export interface LevelSpec {
  id: string;
  islandId: string;
  levelIndex: number;
  tileCount: number;
  groupSize: 2 | 3;
  K: number;
  mechanics: string[];
  version: number;
}

export interface ContentBundle {
  contentVersion: number;
  minAppVersion: string;
  islands: IslandSpec[];
  levels: Record<string, LevelSpec>;
}

export interface SavedGame {
  levelId: string;
  contentVersion: number;
  seed: number;
  moves: number[];
  boardHash: string;
  timestamp: number;
}

export type RestoreResult =
  | {
      status: 'restored';
      levelSpec: LevelSpec;
      playedMoves: number;
      message: string;
    }
  | {
      status: 'discarded';
      reason: 'spec-not-found' | 'content-version-incompatible' | 'hash-mismatch';
      message: string;
    };

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
