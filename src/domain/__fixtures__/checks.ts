import { GameState, applyMove } from '../gameState';
import { FreeTracker, buildAdjacency } from '../geometry';
import { STAR_TYPE, type Generated, type LevelSpec } from '../types';

/**
 * Rigioca la soluzione costruita con le regole di gioco (`applyMove`), indipendenti dal generatore. Un blocco del piano
 * ha `groupSize` o `2 × groupSize` tessere uguali libere insieme: si toglie a gruppi di `groupSize`.
 */
export function replay(spec: LevelSpec, generated: Generated): void {
  let state = new GameState(generated.tiles, spec.groupSize, spec.poolSize);
  for (const block of generated.plan) {
    for (let k = 0; k < block.length; k += spec.groupSize) {
      const group = block.slice(k, k + spec.groupSize);
      const r = applyMove(state, group);
      if (!r.ok) throw new Error(`${spec.id}: mossa [${group.join(',')}] rifiutata: ${r.error}`);
      state = r.value;
    }
  }
  expect({ id: spec.id, rimaste: state.remaining }).toEqual({ id: spec.id, rimaste: 0 });
}

/** Verifica che una tavola generata rispetti la specifica: tipi, stelle, nascoste, oro e nebbia. */
export function checkInvariants(spec: LevelSpec, generated: Generated): void {
  const { id, groupSize: g } = spec;
  const { tiles } = generated;
  const counts = new Map<number, number>();
  for (const t of tiles) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  for (const [type, c] of counts) expect({ id, type, resto: c % g }).toEqual({ id, type, resto: 0 });
  expect({ id, stelle: counts.get(STAR_TYPE) ?? 0 }).toEqual({ id, stelle: spec.hidden.length * g });
  const usati = counts.size - (counts.has(STAR_TYPE) ? 1 : 0);
  expect({ id, tipiOltreLimite: usati > spec.types }).toEqual({ id, tipiOltreLimite: false });
  spec.hidden.forEach((h, gi) => {
    expect({ id, gruppo: gi + 1, tessere: tiles.filter((t) => t.hiddenGroup === gi + 1).length }).toEqual({ id, gruppo: gi + 1, tessere: h });
  });
  expect({ id, oro: tiles.filter((t) => t.gold).length }).toEqual({ id, oro: Math.min(spec.gold, tiles.length) });
  expect({ id, nebbiaOltreLimite: tiles.filter((t) => t.fog).length > spec.fog }).toEqual({ id, nebbiaOltreLimite: false });
  const first = new FreeTracker(buildAdjacency(tiles));
  tiles.forEach((t, i) => {
    if (t.fog) expect({ id, i, nebbiaSuLibera: first.isFree(i) }).toEqual({ id, i, nebbiaSuLibera: false });
    if (t.gold) expect({ id, i, oroSuStellaONascosta: t.type === STAR_TYPE || t.hiddenGroup > 0 }).toEqual({ id, i, oroSuStellaONascosta: false });
  });
}
