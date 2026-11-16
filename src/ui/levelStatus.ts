import { isIslandUnlocked, isLevelUnlocked, islandStars, levelProgress, unlockThreshold, type IslandInfo, type Progress } from '../domain/progress';
import { displayLevelNumber, islandName } from './format';
import { t } from '../infrastructure/i18n';

export type LevelStatus = { open: true } | { open: false; reason: string };

/** Se un'isola è accessibile e, se no, quale requisito manca. */
export function islandStatus(progress: Progress, islands: readonly IslandInfo[], index: number, prova: boolean, translate: typeof t = t): LevelStatus {
  if (prova || isIslandUnlocked(progress, islands, index)) return { open: true };
  if (index < 0 || index >= islands.length) return { open: false, reason: translate('trisLocked') };

  const previous = islands[index - 1];
  if (!previous) return { open: true };
  const name = islandName(islands[index].id, translate);
  if (islandStars(progress, previous) < unlockThreshold(previous)) {
    return { open: false, reason: translate('starsNeededForIsland', { n: unlockThreshold(previous), name }) };
  }

  const next = previous.levelIds.find((id) => levelProgress(progress, id).stars < 1);
  return { open: false, reason: translate('winLevelToOpenIsland', { n: next === undefined ? '' : displayLevelNumber(islands, next), name }) };
}

/**
 * Se un livello si può giocare e, se no, perché (`docs/salvataggi.md`, «Scelte per la UI»). Con la modalità prova tutto è
 * aperto. Un'isola chiusa dice cosa serve per aprirla («Servono 40 ★ per aprire Animali», poi il primo livello da vincere
 * nell'isola precedente); dentro un'isola aperta si vince il livello prima.
 */
export function levelStatus(progress: Progress, islands: readonly IslandInfo[], levelId: number, prova: boolean, translate: typeof t = t): LevelStatus {
  if (prova) return { open: true };
  const index = islands.findIndex((island) => island.levelIds.includes(levelId));
  if (index < 0) return { open: false, reason: translate('trisLocked') };
  const island = islandStatus(progress, islands, index, prova, translate);
  if (!island.open) return island;
  if (prova || isLevelUnlocked(progress, islands, levelId)) return { open: true };

  const position = islands[index].levelIds.indexOf(levelId);
  return { open: false, reason: translate('winLevelToOpen', { n: displayLevelNumber(islands, islands[index].levelIds[position - 1]) }) };
}
