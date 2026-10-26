import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from './generator.ts';
import { GameState } from './solver.ts';
import { toSpec } from './legacy.ts';
import { loadLegacy } from './legacy-node.ts';
import { STAR_TYPE, type LevelSpec } from './types.ts';

const legacy = loadLegacy();

function replay(spec: LevelSpec, tiles: ReturnType<typeof generateLevel> extends infer R ? (R extends { ok: true; value: infer V } ? V : never) : never) {
  const state = new GameState(tiles.tiles, spec.groupSize, spec.poolSize);
  for (const group of tiles.plan) {
    const playable = new Set(state.playable());
    assert.ok(group.every((i) => playable.has(i)), 'una tessera del gruppo non è giocabile al suo turno');
    assert.equal(new Set(group.map((i) => tiles.tiles[i].type)).size, 1, 'il gruppo ha tipi diversi');
    state.apply(group);
  }
  assert.equal(state.remaining, 0);
}

test('i 100 livelli dell\'originale sono stati esportati', () => {
  assert.equal(legacy.length, 100);
  assert.ok(legacy.every((l) => l.cells.length % l.groupSize === 0));
});

test('stessa specifica e stesso seme producono la stessa tavola; semi diversi no', () => {
  const spec = toSpec(legacy[19]);
  const a = generateLevel(spec, 7);
  const b = generateLevel(spec, 7);
  const c = generateLevel(spec, 8);
  assert.ok(a.ok && b.ok && c.ok);
  if (a.ok && b.ok && c.ok) {
    assert.deepEqual(a.value, b.value);
    assert.notDeepEqual(a.value.tiles.map((t) => t.type), c.value.tiles.map((t) => t.type));
  }
});

test('specifica non valida: tessere non multiple del gruppo', () => {
  const spec: LevelSpec = { ...toSpec(legacy[0]), cells: legacy[0].cells.slice(0, 15) };
  const r = generateLevel(spec, 1);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'invalid-spec');
});

test('tutti i 100 livelli si generano e la soluzione costruita è giocabile secondo le regole', () => {
  for (const l of legacy) {
    for (const seed of [1, 2]) {
      const spec = toSpec(l);
      const r = generateLevel(spec, seed);
      assert.ok(r.ok, `livello ${l.id} seme ${seed}: ${r.ok ? '' : JSON.stringify(r.error)}`);
      if (!r.ok) continue;
      replay(spec, r.value);
      const { tiles } = r.value;
      const g = spec.groupSize;
      const counts = new Map<number, number>();
      for (const t of tiles) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
      for (const [type, c] of counts) assert.equal(c % g, 0, `livello ${l.id}: tipo ${type} con ${c} tessere`);
      assert.equal(counts.get(STAR_TYPE) ?? 0, spec.hidden.length * g, `livello ${l.id}: tessere stella`);
      spec.hidden.forEach((h, gi) => assert.equal(tiles.filter((t) => t.hiddenGroup === gi + 1).length, h, `livello ${l.id}: gruppo nascosto ${gi + 1}`));
      assert.equal(tiles.filter((t) => t.gold).length, Math.min(spec.gold, tiles.length));
      assert.ok(tiles.filter((t) => t.fog).length <= spec.fog);
      assert.ok(counts.size - (counts.has(STAR_TYPE) ? 1 : 0) <= spec.types);
    }
  }
});
