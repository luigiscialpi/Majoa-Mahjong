import { generateLevel } from '../../domain/generator';
import { STAR_TYPE } from '../../domain/types';
import { DESIGN_COUNT, STAR_DESIGN, designOf, levelPalette } from './legacyThemes';
import { legacyLevels, toSpec } from './legacyLevels';
import { TILE_SOURCES } from './tileSources';
import themes from './legacy-themes.json';

const islands = themes.islands as Record<string, number[]>;

describe('disegni e tavolozze dell\'originale', () => {
  test('ogni isola ha tanti disegni quanti ne dichiarano i suoi livelli, tutti validi e distinti, senza la stella', () => {
    const fromLevels = new Map<string, Set<number>>();
    for (const l of legacyLevels) fromLevels.set(l.island, (fromLevels.get(l.island) ?? new Set<number>()).add(l.poolSize));
    expect(Object.keys(islands).sort()).toEqual([...fromLevels.keys()].sort());
    for (const [island, pool] of Object.entries(islands)) {
      expect({ island, poolSize: [...(fromLevels.get(island) ?? [])] }).toEqual({ island, poolSize: [pool.length] });
      expect({ island, distinti: new Set(pool).size === pool.length, validi: pool.every((d) => Number.isInteger(d) && d >= 0 && d < DESIGN_COUNT), senzaStella: !pool.includes(STAR_DESIGN) }).toEqual({ island, distinti: true, validi: true, senzaStella: true });
    }
  });

  test('i 129 disegni hanno un file ciascuno, in ordine', () => {
    expect([DESIGN_COUNT, STAR_DESIGN, TILE_SOURCES.length]).toEqual([129, 26, 129]);
  });

  test('ogni livello ha una tavolozza di cinque colori esadecimali; quella del livello 20 è quella usata nel prototipo S1', () => {
    expect(themes.palettes.length).toBe(100);
    for (const l of legacyLevels) {
      const palette = levelPalette(l.id);
      expect({ id: l.id, ok: palette.length === 5 && palette.every((c) => /^#[0-9a-f]{6}$/i.test(c)) }).toEqual({ id: l.id, ok: true });
    }
    expect(levelPalette(20)).toEqual(['#e0742a', '#6a1f4a', '#fff1a8', '#f09a3a', '#8a3a1f']);
    expect(() => levelPalette(0)).toThrow();
    expect(() => levelPalette(101)).toThrow();
  });

  test('designOf: la stella ha il suo disegno, gli altri tipi sono posizioni nel gruppo dell\'isola', () => {
    expect(designOf('animals', STAR_TYPE)).toBe(26);
    expect(designOf('animals', 0)).toBe(0);
    expect(designOf('animals', 12)).toBe(16);
    expect(designOf('sweets', 0)).toBe(40);
    expect(() => designOf('animals', 28)).toThrow();
    expect(() => designOf('inesistente', 0)).toThrow();
  });

  test('le tavole generate dei 100 livelli usano solo disegni validi, uno per tipo', () => {
    for (const l of legacyLevels) {
      const generated = generateLevel(toSpec(l), 1);
      if (!generated.ok) throw new Error(`livello ${l.id}: generazione fallita`);
      const designOfType = new Map<number, number>();
      for (const t of generated.value.tiles) {
        const design = designOf(l.island, t.type);
        expect({ id: l.id, valido: design >= 0 && design < DESIGN_COUNT }).toEqual({ id: l.id, valido: true });
        designOfType.set(t.type, design);
      }
      expect({ id: l.id, tipi: designOfType.size, disegni: new Set(designOfType.values()).size }).toEqual({ id: l.id, tipi: designOfType.size, disegni: designOfType.size });
    }
  });
});
