import type { IslandInfo } from '../domain/progress';
import { campaignLevelById } from '../infrastructure/content/campaignLevels';
import { introFor } from './intros';

// Anticipazione del livello speciale che apre un'isola (oggi il Tris): chi finisce un'isola sa che nella prossima c'è qualcosa di diverso.

/** L'isola che viene dopo quella che finisce con `levelId`, se `levelId` ne è l'ultimo livello. */
export function islandAfter(levelId: number, islands: readonly IslandInfo[]): IslandInfo | null {
  const index = islands.findIndex((island) => island.levelIds[island.levelIds.length - 1] === levelId);
  return index >= 0 && index + 1 < islands.length ? islands[index + 1] : null;
}

/** Il primo livello dell'isola è di un tipo con la sua spiegazione (un Tris). */
export function opensWithSpecialLevel(island: IslandInfo): boolean {
  const opener = campaignLevelById(island.levelIds[0]);
  return opener !== undefined && introFor(opener) !== null;
}
