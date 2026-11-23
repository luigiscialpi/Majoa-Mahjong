import { isIslandUnlocked, isLevelUnlocked, islandStars, levelProgress, unlockThreshold, type IslandInfo, type Progress } from '../domain/progress';
import { trisLevelIds } from '../infrastructure/content/legacyIslands';
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
 * La sala dei dieci Tris dell'originale, fuori dalle isole, si apre quando si è finito il primo Tris del percorso: quello in
 * apertura della seconda isola (il livello 21). In Modalità prova è sempre aperta. I suoi livelli si aprono in sequenza.
 */
export function isTrisRoomOpen(progress: Progress, islands: readonly IslandInfo[], prova: boolean): boolean {
  if (prova) return true;
  const first = islands[1]?.levelIds[0];
  return first !== undefined && levelProgress(progress, first).stars >= 1;
}

/**
 * Se un livello si può giocare e, se no, perché (`docs/salvataggi.md`, «Scelte per la UI»). Con la modalità prova tutto è
 * aperto. Un'isola chiusa dice cosa serve per aprirla («Servono 40 ★ per aprire Animali», poi il primo livello da vincere
 * nell'isola precedente); dentro un'isola aperta si vince il livello prima.
 */
export function levelStatus(progress: Progress, islands: readonly IslandInfo[], levelId: number, prova: boolean, translate: typeof t = t): LevelStatus {
  if (prova) return { open: true };
  const tris = trisLevelIds.indexOf(levelId);
  if (tris >= 0) {
    if (!isTrisRoomOpen(progress, islands, prova)) return { open: false, reason: translate('trisLocked') };
    if (tris === 0 || levelProgress(progress, trisLevelIds[tris - 1]).stars >= 1) return { open: true };
    return { open: false, reason: translate('winLevelToOpen', { n: displayLevelNumber(islands, trisLevelIds[tris - 1]) }) };
  }
  const index = islands.findIndex((island) => island.levelIds.includes(levelId));
  if (index < 0) return { open: false, reason: translate('trisLocked') };
  const island = islandStatus(progress, islands, index, prova, translate);
  if (!island.open) return island;
  if (prova || isLevelUnlocked(progress, islands, levelId)) return { open: true };

  const position = islands[index].levelIds.indexOf(levelId);
  return { open: false, reason: translate('winLevelToOpen', { n: displayLevelNumber(islands, islands[index].levelIds[position - 1]) }) };
}
