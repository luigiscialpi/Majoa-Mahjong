import type { LegacyLevel } from './legacyLevels';

// Il primo livello di ogni isola, dalla seconda in poi, è un Tris (decisione del 19 novembre 2026): con le isole da 20 livelli
// i Tris cadono ai numeri mostrati 21, 41, 61... Non sono livelli nuovi: sono il primo livello dell'isola giocato a gruppi di
// tre, sulla stessa forma e con lo stesso tema, quindi con la stessa difficoltà di apertura.

/** Il primo livello di un'isola a coppie, escluso quello della prima isola (i livelli iniziali). I Tris dell'originale restano com'erano. */
export function isTrisSlot(level: LegacyLevel): boolean {
  return level.local === 1 && level.island !== 'prologue' && level.groupSize === 2;
}

/**
 * Il livello giocato a gruppi di tre. Un Tris vuole un numero di tessere multiplo di 3: si tolgono, se serve, una o due tessere
 * dello strato più alto (nessuna poggia su di loro, quindi la forma resta valida). Disegni: al più uno per gruppo. Nessuna
 * tessera d'oro, nascosta o nebbiosa, come nei Tris dell'originale.
 */
export function trisVariant(level: LegacyLevel): LegacyLevel {
  const surplus = level.cells.length % 3;
  const top = new Set(
    level.cells
      .map((cell, index) => ({ cell, index }))
      .sort((a, b) => b.cell.z - a.cell.z || b.cell.x - a.cell.x || b.cell.y - a.cell.y)
      .slice(0, surplus)
      .map(({ index }) => index),
  );
  const cells = level.cells.filter((_, index) => !top.has(index));
  return { ...level, groupSize: 3, cells, types: Math.min(level.types, cells.length / 3), hidden: [], fog: 0, gold: 0 };
}
