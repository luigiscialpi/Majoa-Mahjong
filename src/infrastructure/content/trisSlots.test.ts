import { checkInvariants, replay } from '../../domain/__fixtures__/checks';
import { generateLevel } from '../../domain/generator';
import { PROFILES, applyProfile } from '../../domain/profile';
import { newProgress, type IslandInfo } from '../../domain/progress';
import { solve } from '../../domain/solver';
import { displayLevelNumber } from '../../ui/format';
import { campaignIslandsForProgress, campaignLevelById, campaignLevelsFor } from './campaignLevels';
import { legacyLevels, toSpec, type LegacyLevel } from './legacyLevels';
import { isTrisSlot, trisVariant } from './trisSlots';

jest.setTimeout(120_000);

// Una mappa che arriva a una decina di isole generate: i livelli iniziali, poi le isole con un Tris in apertura.
const done = { stars: 1, bestSeconds: 1, gold: 0, profile: 'normal' } as const;
const islands: readonly IslandInfo[] = campaignIslandsForProgress({ ...newProgress(), levels: { 170: done, 190: done, 210: done, 230: done, 250: done } });
const openers = islands.slice(1).map((island) => campaignLevelById(island.levelIds[0])!);

describe('un Tris ogni 20 livelli, a partire dal 21', () => {
  test('sono i primi livelli di ogni isola dalla seconda, ai numeri mostrati 21, 41, 61…', () => {
    expect(islands.length).toBeGreaterThanOrEqual(12);
    islands.forEach((island, index) => {
      const first = campaignLevelById(island.levelIds[0])!;
      expect({ island: island.id, tris: first.groupSize === 3 }).toEqual({ island: island.id, tris: index > 0 });
      expect(displayLevelNumber(islands, island.levelIds[0])).toBe(20 * index + 1);
    });
    expect(islands.slice(1, 5).map((island) => displayLevelNumber(islands, island.levelIds[0]))).toEqual([21, 41, 61, 81]);
  });

  test('nessun altro livello della campagna è un Tris: i livelli iniziali e tutti gli altri restano a coppie', () => {
    for (const island of islands) {
      campaignLevelsFor(island).forEach((level, position) => {
        const expected = island.id !== 'prologue' && position === 0 ? 3 : 2;
        expect({ id: level.id, g: level.groupSize }).toEqual({ id: level.id, g: expected });
      });
    }
  });

  test('i dieci Tris dell\'originale (91-100) restano com\'erano, fuori dalla campagna', () => {
    for (const original of legacyLevels.filter((l) => l.groupSize === 3)) {
      expect(isTrisSlot(original)).toBe(false);
      expect(campaignLevelById(original.id)).toBe(original);
    }
  });

  test('isTrisSlot: primo livello, a coppie, non dei livelli iniziali', () => {
    const base = legacyLevels.find((l) => l.island === 'animals' && l.local === 1)!;
    expect(isTrisSlot(base)).toBe(true);
    expect(isTrisSlot({ ...base, local: 2 })).toBe(false);
    expect(isTrisSlot({ ...base, island: 'prologue' })).toBe(false);
    expect(isTrisSlot({ ...base, groupSize: 3 })).toBe(false);
  });
});

describe('trisVariant', () => {
  const sample: LegacyLevel[] = [legacyLevels.find((l) => l.island === 'animals' && l.local === 1)!, ...legacyLevels.filter((l) => l.groupSize === 2 && l.island !== 'prologue').slice(0, 40)];

  test('stessa forma, tessere multiple di 3, tolte al più due, solo dello strato più alto e senza che nessuna poggi su di loro', () => {
    for (const level of sample) {
      const v = trisVariant(level);
      const removed = level.cells.filter((c) => !v.cells.some((k) => k.x === c.x && k.y === c.y && k.z === c.z));
      expect(v.cells.length % 3).toBe(0);
      expect(removed).toHaveLength(level.cells.length % 3);
      expect(v.cells.every((c) => level.cells.some((o) => o.x === c.x && o.y === c.y && o.z === c.z))).toBe(true);
      const topZ = Math.max(...level.cells.map((c) => c.z));
      for (const cell of removed) expect(cell.z).toBe(topZ);
      expect(v.cells).toEqual(level.cells.filter((c) => !removed.includes(c))); // l'ordine delle altre non cambia
    }
  });

  test('con un numero di tessere già multiplo di 3 non se ne toglie nessuna', () => {
    const multiple = legacyLevels.find((l) => l.groupSize === 2 && l.cells.length % 3 === 0)!;
    expect(trisVariant(multiple).cells).toEqual(multiple.cells);
  });

  test('a gruppi di tre, senza oro, nascoste o nebbia, con al più un disegno per gruppo; il resto non cambia', () => {
    for (const level of sample) {
      const v = trisVariant(level);
      expect(v).toMatchObject({ groupSize: 3, hidden: [], fog: 0, gold: 0 });
      expect(v.types).toBeLessThanOrEqual(v.cells.length / 3);
      expect(v.types).toBeLessThanOrEqual(level.types);
      expect({ ...v, cells: 0, groupSize: 0, types: 0, hidden: 0, fog: 0, gold: 0 }).toEqual({ ...level, cells: 0, groupSize: 0, types: 0, hidden: 0, fog: 0, gold: 0 });
    }
  });

  test('non modifica il livello ricevuto', () => {
    const level = legacyLevels.find((l) => l.island === 'animals' && l.local === 1)!;
    const before = JSON.stringify(level);
    trisVariant(level);
    expect(JSON.stringify(level)).toBe(before);
  });
});

describe('i Tris della campagna si generano e sono risolvibili', () => {
  test('con molti semi: la soluzione costruita è giocabile secondo le regole', () => {
    for (const level of openers) {
      const spec = toSpec(level);
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const r = generateLevel(spec, seed);
        if (!r.ok) throw new Error(`livello ${level.id} seme ${seed}: ${JSON.stringify(r.error)}`);
        replay(spec, r.value);
        checkInvariants(spec, r.value);
      }
    }
  });

  test('con ogni profilo e in Modalità comoda', () => {
    for (const level of openers) {
      for (const profile of PROFILES) {
        const spec = applyProfile(toSpec(level), profile);
        const r = generateLevel(spec, 11);
        if (!r.ok) throw new Error(`livello ${level.id} profilo ${profile}: ${JSON.stringify(r.error)}`);
        checkInvariants(spec, r.value);
      }
      expect(generateLevel(toSpec(level, { comfort: true }), 5).ok).toBe(true);
    }
  });

  test('il solver non dichiara irrisolvibile nessuna tavola', () => {
    for (const level of openers) {
      const spec = toSpec(level);
      const r = generateLevel(spec, 3);
      if (!r.ok) throw new Error(`livello ${level.id}: generazione fallita`);
      expect(solve(r.value.tiles, spec.groupSize, spec.poolSize).status).not.toBe('unsolvable');
    }
  });
});
