import { GameState, applyMove } from '../gameState';
import { FreeTracker, buildAdjacency } from '../geometry';
import { solveFrom, type SolveResult } from '../solver';
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

/**
 * Verifica un rimescolo: la tavola (posizioni, flag, tessere tolte, gruppi aperti) è uguale, le tessere tolte non cambiano
 * tipo, i tipi delle rimaste sono multipli di `groupSize`, le stelle sono quelle dei gruppi ancora chiusi, i disegni
 * normali non superano `types`, e il solver non dichiara la partita irrisolvibile. Restituisce l'esito del solver.
 */
export function checkReshuffle(before: GameState, after: GameState, types: number, label: string): SolveResult['status'] {
  expect({ label, tessere: after.tiles.length }).toEqual({ label, tessere: before.tiles.length });
  expect({ label, aperti: after.unlocked, rimaste: after.remaining }).toEqual({ label, aperti: before.unlocked, rimaste: before.remaining });
  const counts = new Map<number, number>();
  before.tiles.forEach((t, i) => {
    const a = after.tiles[i];
    const alive = before.ft.alive[i] === 1;
    const stessa = { x: a.x, y: a.y, z: a.z, hiddenGroup: a.hiddenGroup, fog: a.fog, gold: a.gold, viva: after.ft.alive[i] === 1 };
    expect({ label, i, ...stessa }).toEqual({ label, i, x: t.x, y: t.y, z: t.z, hiddenGroup: t.hiddenGroup, fog: t.fog, gold: t.gold, viva: alive });
    if (!alive) expect({ label, i, tipo: a.type }).toEqual({ label, i, tipo: t.type });
    else counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  });
  const g = before.g;
  for (const [type, c] of counts) expect({ label, type, resto: c % g }).toEqual({ label, type, resto: 0 });
  // I conteggi per tipo dello stato devono corrispondere alle tessere rimaste, calcolate qui dalle tessere.
  for (const [type, c] of counts) expect({ label, type, left: after.left[after.slot(type)] }).toEqual({ label, type, left: c });
  expect({ label, totale: after.left.reduce((a, b) => a + b, 0) }).toEqual({ label, totale: after.remaining });
  const closed = before.tiles.reduce((m, t) => Math.max(m, t.hiddenGroup), 0) - before.unlocked;
  expect({ label, stelle: counts.get(STAR_TYPE) ?? 0 }).toEqual({ label, stelle: closed * g });
  const normali = counts.size - (counts.has(STAR_TYPE) ? 1 : 0);
  expect({ label, tipiOltreLimite: normali > types }).toEqual({ label, tipiOltreLimite: false });
  const { status } = solveFrom(after);
  expect({ label, irrisolvibile: status === 'unsolvable' }).toEqual({ label, irrisolvibile: false });
  return status;
}
