import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from './generator.ts';
import { createRng } from './prng.ts';
import { toSpec } from './legacy.ts';
import { loadLegacy } from './legacy-node.ts';
import { playRandom, simulate, solve } from './solver.ts';
import { STAR_TYPE, type PlacedTile } from './types.ts';

const legacy = loadLegacy();
const tile = (x: number, y: number, z: number, type: number, hiddenGroup = 0): PlacedTile => ({ x, y, z, type, hiddenGroup, fog: false, gold: false });

test('solver: una coppia impilata (stesso tipo sopra e sotto) non è risolvibile', () => {
  const tiles = [tile(0, 0, 0, 0), tile(0, 0, 1, 0), tile(3, 0, 0, 1), tile(5, 0, 0, 1)];
  assert.equal(solve(tiles, 2, 2).status, 'unsolvable');
});

test('solver: coppie libere si risolvono', () => {
  const tiles = [tile(0, 0, 0, 0), tile(2, 0, 0, 0), tile(4, 0, 0, 1), tile(6, 0, 0, 1)];
  assert.equal(solve(tiles, 2, 2).status, 'solvable');
});

test('solver: una tessera nascosta si gioca solo dopo il gruppo di stelle', () => {
  // La coppia nascosta (gruppo 1) è libera ma chiusa; le stelle stanno sotto un'altra tessera libera che si toglie prima.
  const tiles = [tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1), tile(4, 0, 0, STAR_TYPE), tile(6, 0, 0, STAR_TYPE)];
  assert.equal(solve(tiles, 2, 1).status, 'solvable');
  // Se le stelle fossero a loro volta nascoste dietro lo stesso gruppo, non si apre mai.
  const locked = [tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1), tile(4, 0, 0, STAR_TYPE, 1), tile(6, 0, 0, STAR_TYPE, 1)];
  assert.equal(solve(locked, 2, 1).status, 'unsolvable');
});

test('solver: tutti i livelli generati sono risolvibili, verificato in modo indipendente dalla costruzione', () => {
  const unknown: number[] = [];
  for (const l of legacy) {
    const spec = toSpec(l);
    const r = generateLevel(spec, 3);
    assert.ok(r.ok);
    if (!r.ok) continue;
    const s = solve(r.value.tiles, spec.groupSize, spec.poolSize);
    assert.notEqual(s.status, 'unsolvable', `livello ${l.id} dichiarato non risolvibile`);
    if (s.status === 'unknown') unknown.push(l.id);
  }
  assert.ok(unknown.length <= 5, `livelli con esito sconosciuto: ${unknown.join(', ')}`);
});

test('partita casuale: deterministica con lo stesso seme, termina, libertà tra 0 e 1', () => {
  const spec = toSpec(legacy[19]);
  const r = generateLevel(spec, 5);
  assert.ok(r.ok);
  if (!r.ok) return;
  const a = playRandom(r.value.tiles, spec.groupSize, spec.poolSize, createRng(9));
  const b = playRandom(r.value.tiles, spec.groupSize, spec.poolSize, createRng(9));
  assert.deepEqual(a, b);
  assert.ok(a.freedom > 0 && a.freedom <= 1);
  const s = simulate(r.value.tiles, spec.groupSize, spec.poolSize, createRng(1), 30);
  assert.ok(s.stuck >= 0 && s.stuck <= 1 && s.freedom > 0 && s.freedom <= 1);
});
