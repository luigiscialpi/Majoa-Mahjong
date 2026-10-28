import { grid, pyramid90 } from './__fixtures__/shapes';
import { RANGES, difficultyIndex, difficultyLabel, dynamicMeasures, staticMeasures, type Measures } from './difficulty';
import { DEFAULT_WEIGHTS, FREEDOM_RANGE } from './weights';
import type { LevelSpec } from './types';

const noAids = { hints: null, shuffles: null, undo: null };
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: grid(4, 4, 0), groupSize: 2, types: 6, poolSize: 24, hidden: [], fog: 0, gold: 0, aids: noAids, ...over });
const measures = (v: number): Measures => ({ T: v, Z: v, K: v, G: v, H: v, F: v, A: v, Lc: v, R: v });

describe('staticMeasures', () => {
  test('livello piccolo senza meccaniche: valori calcolati a mano', () => {
    const m = staticMeasures(spec());
    expect(m.T).toBeCloseTo(1 / 81, 12); // 16 tessere in [15, 96]
    expect(m.Z).toBe(0); // un piano
    expect(m.K).toBeCloseTo(1 / 19, 12); // 6 tipi in [5, 24]
    expect([m.G, m.H, m.F, m.A]).toEqual([0, 0, 0, 0]);
  });

  test('livello con tris, nascoste, nebbia e aiuti scarsi', () => {
    const m = staticMeasures(spec({ cells: pyramid90(), groupSize: 3, types: 12, hidden: [4, 4], fog: 9, aids: { hints: 5, shuffles: 0, undo: null } }));
    expect(m.T).toBeCloseTo(75 / 81, 12);
    expect(m.Z).toBe(1); // 5 piani
    expect(m.K).toBeCloseTo(7 / 19, 12);
    expect(m.G).toBe(1);
    expect(m.H).toBeCloseTo(8 / 90 / RANGES.hiddenShare, 12);
    expect(m.F).toBeCloseTo(9 / 90 / RANGES.fogShare, 12);
    expect(m.A).toBeCloseTo((0.5 + 1 + 0) / 3, 12); // 5 su 10 = 0.5; zero aiuti = 1; senza limite = 0
  });

  test('valori fuori dagli intervalli si fermano a 0 e a 1', () => {
    expect(staticMeasures(spec({ types: 30 })).K).toBe(1);
    expect(staticMeasures(spec({ cells: grid(2, 2, 0), types: 2 })).T).toBe(0);
    expect(staticMeasures(spec({ hidden: [16] })).H).toBe(1);
    expect(staticMeasures(spec({ aids: { hints: 99, shuffles: 99, undo: 99 } })).A).toBe(0);
  });
});

describe('dynamicMeasures', () => {
  test('la libertà si normalizza sull\'intervallo osservato e Lc è il suo complemento', () => {
    const [lo, hi] = FREEDOM_RANGE;
    expect(dynamicMeasures({ freedom: lo, stuck: 0 }).Lc).toBe(1);
    expect(dynamicMeasures({ freedom: hi, stuck: 0 }).Lc).toBe(0);
    expect(dynamicMeasures({ freedom: (lo + hi) / 2, stuck: 0 }).Lc).toBeCloseTo(0.5, 12);
    expect(dynamicMeasures({ freedom: 0, stuck: 0 }).Lc).toBe(1);
    expect(dynamicMeasures({ freedom: 1, stuck: 0 }).Lc).toBe(0);
  });

  test('R è la quota di partite bloccate, limitata a [0, 1]', () => {
    expect(dynamicMeasures({ freedom: 0.5, stuck: 0.25 }).R).toBe(0.25);
    expect(dynamicMeasures({ freedom: 0.5, stuck: 1.5 }).R).toBe(1);
  });
});

describe('difficultyIndex e difficultyLabel', () => {
  test('i pesi predefiniti sommano a 1: indice 0 con tutte le misure a 0 e 100 con tutte a 1', () => {
    expect(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(difficultyIndex(measures(0))).toBe(0);
    expect(difficultyIndex(measures(1))).toBeCloseTo(100, 10);
  });

  test('con pesi propri conta solo la misura pesata', () => {
    const only = (k: keyof Measures): Measures => ({ ...measures(0), [k]: 1 });
    expect(difficultyIndex({ ...measures(0), H: 0.5, Z: 1 }, only('H'))).toBeCloseTo(50, 10);
  });

  test('aumentare una misura aumenta l\'indice', () => {
    const base = measures(0.3);
    for (const k of Object.keys(base) as (keyof Measures)[]) {
      expect(difficultyIndex({ ...base, [k]: 0.6 })).toBeGreaterThan(difficultyIndex(base));
    }
  });

  test('l\'etichetta divide l\'indice in cinque fasce uguali', () => {
    const cases: [number, number][] = [[0, 1], [19.99, 1], [20, 2], [39.99, 2], [40, 3], [59.99, 3], [60, 4], [79.99, 4], [80, 5], [100, 5]];
    for (const [index, label] of cases) expect({ index, label: difficultyLabel(index) }).toEqual({ index, label });
  });
});
