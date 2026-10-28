import { difficultyIndex, dynamicMeasures, staticMeasures, type Measures } from '../../domain/difficulty';
import { generateLevel } from '../../domain/generator';
import { createRng } from '../../domain/prng';
import { simulate } from '../../domain/solver';
import { FREEDOM_RANGE } from '../../domain/weights';
import savedRows from './__fixtures__/legacy-measures.json';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(120_000);

// Misure salvate dal prototipo S4 (`tools/measures.ts`: media su 5 semi × 60 partite simulate per tavola).
type Row = { id: number; island: string; local: number; label: number; freedom: number; stuck: number } & Omit<Measures, 'Lc' | 'R'>;
const rows = savedRows as Row[];

function ranks(a: number[]): number[] {
  const order = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
  const r = new Array<number>(a.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

function spearman(a: number[], b: number[]): number {
  const ra = ranks(a);
  const rb = ranks(b);
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length;
  const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

const full = (r: Row): Measures => ({ T: r.T, Z: r.Z, K: r.K, G: r.G, H: r.H, F: r.F, A: r.A, ...dynamicMeasures({ freedom: r.freedom, stuck: r.stuck }) });

describe('indice di difficoltà sui 100 livelli dell\'originale', () => {
  test('le misure statiche sono tra 0 e 1 e coincidono con quelle salvate', () => {
    expect(rows.map((r) => r.id)).toEqual(legacyLevels.map((l) => l.id));
    for (const l of legacyLevels) {
      const saved = rows.find((r) => r.id === l.id)!;
      for (const [k, v] of Object.entries(staticMeasures(toSpec(l)))) {
        expect({ id: l.id, k, inRange: v >= 0 && v <= 1 }).toEqual({ id: l.id, k, inRange: true });
        expect({ id: l.id, k, v }).toEqual({ id: l.id, k, v: saved[k as keyof Row] });
      }
    }
  });

  test('l\'intervallo di libertà usato per normalizzare Lc è quello osservato nei 100 livelli', () => {
    const freedom = rows.map((r) => r.freedom);
    expect(FREEDOM_RANGE).toEqual([Number(Math.min(...freedom).toFixed(4)), Number(Math.max(...freedom).toFixed(4))]);
  });

  test('l\'indice sta tra 0 e 100 e il livello 20 è più difficile del livello 1', () => {
    for (const r of rows) {
      const d = difficultyIndex(full(r));
      expect({ id: r.id, inRange: d >= 0 && d <= 100 }).toEqual({ id: r.id, inRange: true });
    }
    const d = (id: number) => difficultyIndex(full(rows.find((r) => r.id === id)!));
    expect(d(20)).toBeGreaterThan(d(1) + 20);
  });

  test('con i pesi predefiniti l\'indice segue l\'ordine di progetto dentro ogni isola (Spearman medio ≥ 0,95)', () => {
    const islands = [...new Set(rows.map((r) => r.island))];
    const rhos = islands.map((i) => {
      const g = rows.filter((r) => r.island === i);
      return spearman(g.map((r) => difficultyIndex(full(r))), g.map((r) => r.local));
    });
    const mean = rhos.reduce((a, b) => a + b, 0) / rhos.length;
    expect({ mean: Number(mean.toFixed(3)), ok: mean >= 0.95 }).toEqual({ mean: Number(mean.toFixed(3)), ok: true });
  });

  test('controllo indipendente: correlazione con le etichette 1-5 dell\'originale (livelli 21-90 e Tris) ≥ 0,9', () => {
    const g = rows.filter((r) => r.label > 0);
    expect(g.length).toBeGreaterThanOrEqual(70);
    const rho = spearman(g.map((r) => difficultyIndex(full(r))), g.map((r) => r.label));
    expect({ rho: Number(rho.toFixed(3)), ok: rho >= 0.9 }).toEqual({ rho: Number(rho.toFixed(3)), ok: true });
  });

  test('libertà e blocchi simulati con questo codice riproducono le misure salvate dal prototipo', () => {
    const seeds = 5;
    const runs = 60;
    for (const id of [1, 20, 55, 100]) {
      const l = legacyLevels.find((x) => x.id === id)!;
      const spec = toSpec(l);
      let freedom = 0;
      let stuck = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        const r = generateLevel(spec, seed);
        if (!r.ok) throw new Error(`livello ${id}: generazione fallita`);
        const s = simulate(r.value.tiles, spec.groupSize, spec.poolSize, createRng(1000 + seed), runs);
        freedom += s.freedom / seeds;
        stuck += s.stuck / seeds;
      }
      const saved = rows.find((r) => r.id === id)!;
      expect({ id, freedom, stuck }).toEqual({ id, freedom: saved.freedom, stuck: saved.stuck });
    }
  });
});
