import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { difficultyIndex, difficultyLabel, dynamicMeasures, staticMeasures, type Measures } from './difficulty.ts';
import { toSpec } from './legacy.ts';
import { loadLegacy } from './legacy-node.ts';

type Row = { id: number; island: string; local: number; label: number; freedom: number; stuck: number } & Omit<Measures, 'Lc' | 'R'>;
const rows = JSON.parse(readFileSync(new URL('../data/measures.json', import.meta.url), 'utf8')) as Row[];
const legacy = loadLegacy();

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
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}
const full = (r: Row): Measures => ({ T: r.T, Z: r.Z, K: r.K, G: r.G, H: r.H, F: r.F, A: r.A, ...dynamicMeasures({ freedom: r.freedom, stuck: r.stuck }) });

test('le misure statiche dei 100 livelli sono tra 0 e 1 e coincidono con quelle salvate', () => {
  for (const l of legacy) {
    const m = staticMeasures(toSpec(l));
    for (const [k, v] of Object.entries(m)) assert.ok(v >= 0 && v <= 1, `livello ${l.id}: ${k}=${v}`);
    const saved = rows.find((r) => r.id === l.id)!;
    assert.equal(m.T, saved.T);
    assert.equal(m.A, saved.A);
  }
});

test('indice tra 0 e 100 ed etichetta tra 1 e 5', () => {
  for (const r of rows) {
    const d = difficultyIndex(full(r));
    assert.ok(d >= 0 && d <= 100, `livello ${r.id}: ${d}`);
  }
  assert.equal(difficultyLabel(0), 1);
  assert.equal(difficultyLabel(19.9), 1);
  assert.equal(difficultyLabel(20), 2);
  assert.equal(difficultyLabel(100), 5);
});

test('l\'ultimo livello iniziale è più difficile del primo', () => {
  const d1 = difficultyIndex(full(rows.find((r) => r.id === 1)!));
  const d20 = difficultyIndex(full(rows.find((r) => r.id === 20)!));
  assert.ok(d20 > d1 + 20, `${d1} → ${d20}`);
});

test('con i pesi predefiniti l\'indice segue l\'ordine di progetto dentro ogni isola (Spearman medio ≥ 0,95)', () => {
  const islands = [...new Set(rows.map((r) => r.island))];
  const rhos = islands.map((i) => {
    const g = rows.filter((r) => r.island === i);
    return spearman(g.map((r) => difficultyIndex(full(r))), g.map((r) => r.local));
  });
  const mean = rhos.reduce((a, b) => a + b, 0) / rhos.length;
  assert.ok(mean >= 0.95, `rho medio ${mean.toFixed(3)}: ${rhos.map((x) => x.toFixed(2)).join(', ')}`);
});

test('controllo indipendente: correlazione con le etichette 1-5 dell\'originale (livelli 21-90 e Tris) ≥ 0,9', () => {
  const g = rows.filter((r) => r.label > 0);
  assert.ok(g.length >= 70);
  const rho = spearman(g.map((r) => difficultyIndex(full(r))), g.map((r) => r.label));
  assert.ok(rho >= 0.9, `rho ${rho.toFixed(3)}`);
});
