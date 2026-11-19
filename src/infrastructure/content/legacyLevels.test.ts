import { checkInvariants, replay } from '../../domain/__fixtures__/checks';
import { originalIsFree } from '../../domain/__fixtures__/original';
import { FreeTracker, buildAdjacency } from '../../domain/geometry';
import { generateLevel } from '../../domain/generator';
import { createRng } from '../../domain/prng';
import { PROFILES, applyProfile } from '../../domain/profile';
import { solve } from '../../domain/solver';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(120_000);

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

  test('in Modalità comoda i livelli 1-20 usano i layout COMFORT, tipi ridotti e nessun limite di aiuti', () => {
    const expectedCounts = [
      16, 20, 20, 30, 38, 42, 48, 54, 60, 62,
      38, 42, 48, 54, 60, 56, 60, 62, 66, 72,
    ];
    for (let i = 0; i < 20; i++) {
      const l = legacyLevels[i];
      const spec = toSpec(l, { comfort: true });
      expect(spec.cells.length).toBe(expectedCounts[i]);
      expect(spec.types).toBe(Math.max(6, Math.min(l.poolSize, Math.round(l.types * 0.7))));
      expect(spec.fog).toBe(0);
      expect(spec.aids).toEqual({ hints: null, shuffles: null, undo: null });

      const gen = generateLevel(spec, 42);
      expect(gen.ok).toBe(true);
      if (gen.ok) {
        checkInvariants(spec, gen.value);
      }
    }
  });
});

describe('nebbia e profili sui 100 livelli (difetto 7 corretto)', () => {
  test('i primi livelli, fino al 32, e i dieci Tris non hanno mai nebbia, nemmeno a Maestro', () => {
    const noFog = legacyLevels.filter((l) => l.id < 33 || l.groupSize === 3);
    expect(noFog).toHaveLength(32 + 10);
    expect(legacyLevels.find((l) => l.fog > 0)?.id).toBe(33);
    for (const level of noFog) for (const profile of PROFILES) expect(applyProfile(toSpec(level), profile).fog).toBe(0);
  });

  test('un livello con nebbia ne ha di più a Maestro che a Normale', () => {
    const level = legacyLevels.find((l) => l.id === 33)!;
    expect(applyProfile(toSpec(level), 'master').fog).toBeGreaterThan(applyProfile(toSpec(level), 'normal').fog);
  });
});
