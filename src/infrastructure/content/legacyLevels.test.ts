import { checkInvariants, replay } from '../../domain/__fixtures__/checks';
import { FreeTracker, buildAdjacency } from '../../domain/geometry';
import { generateLevel } from '../../domain/generator';
import { createRng } from '../../domain/prng';
import { solve } from '../../domain/solver';
import type { Cell } from '../../domain/types';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(120_000);

// Oracolo: `isFree` dell'originale, copiato da `reference/majoa-originale/Majoa Mahjong.html` (riga 1762).
function originalIsFree(t: Cell, alive: readonly Cell[]): boolean {
  let left = false;
  let right = false;
  for (const u of alive) {
    if (u === t) continue;
    if (u.z === t.z + 1 && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1) return false;
    if (u.z === t.z && Math.abs(u.y - t.y) < 1) {
      if (u.x < t.x && t.x - u.x < 2) left = true;
      if (u.x > t.x && u.x - t.x < 2) right = true;
    }
  }
  return !(left && right);
}

describe('campagna dell\'originale', () => {
  test('sono i 100 livelli, in ordine, con una forma valida', () => {
    expect(legacyLevels.map((l) => l.id)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    for (const l of legacyLevels) {
      const forma = {
        id: l.id,
        gruppoValido: l.groupSize === 2 || l.groupSize === 3,
        multiplo: l.cells.length % l.groupSize === 0,
        tipiNelMazzo: l.types >= 1 && l.types <= l.poolSize,
        celleDistinte: new Set(l.cells.map((c) => `${c.x},${c.y},${c.z}`)).size === l.cells.length,
      };
      expect(forma).toEqual({ id: l.id, gruppoValido: true, multiplo: true, tipiNelMazzo: true, celleDistinte: true });
    }
  });

  test('la tessera libera coincide con isFree dell\'originale in partite casuali su tutti i livelli', () => {
    const rng = createRng(11);
    for (const l of legacyLevels) {
      const ft = new FreeTracker(buildAdjacency(l.cells));
      const alive = new Set(l.cells.keys());
      while (alive.size > 0) {
        const aliveCells = [...alive].map((i) => l.cells[i]);
        const oracolo = [...alive].filter((i) => originalIsFree(l.cells[i], aliveCells)).sort((a, b) => a - b);
        const nostre = [...ft.freeList()].sort((a, b) => a - b);
        expect({ id: l.id, rimaste: alive.size, libere: nostre }).toEqual({ id: l.id, rimaste: alive.size, libere: oracolo });
        const next = oracolo[rng.int(oracolo.length)];
        ft.remove(next);
        alive.delete(next);
      }
    }
  });

  test('tutti i livelli si generano e la soluzione costruita è giocabile secondo le regole', () => {
    for (const l of legacyLevels) {
      const spec = toSpec(l);
      for (const seed of [1, 2]) {
        const r = generateLevel(spec, seed);
        if (!r.ok) throw new Error(`livello ${l.id} seme ${seed}: ${JSON.stringify(r.error)}`);
        replay(spec, r.value);
        checkInvariants(spec, r.value);
      }
    }
  });

  test('nessuna tavola generata è dichiarata irrisolvibile dal solver; al più 5 restano senza esito', () => {
    const unsolvable: number[] = [];
    const unknown: number[] = [];
    for (const l of legacyLevels) {
      const spec = toSpec(l);
      const r = generateLevel(spec, 3);
      if (!r.ok) throw new Error(`livello ${l.id}: generazione fallita`);
      const { status } = solve(r.value.tiles, spec.groupSize, spec.poolSize);
      if (status === 'unsolvable') unsolvable.push(l.id);
      if (status === 'unknown') unknown.push(l.id);
    }
    expect(unsolvable).toEqual([]);
    expect(unknown.length <= 5 ? [] : unknown).toEqual([]);
  });
});
