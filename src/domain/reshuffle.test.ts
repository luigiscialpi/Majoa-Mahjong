import { checkReshuffle } from './__fixtures__/checks';
import { playRandomMoves } from './__fixtures__/play';
import { grid, pyramid90 } from './__fixtures__/shapes';
import { GameState, applyMove } from './gameState';
import { generateLevel } from './generator';
import { findMove } from './hint';
import { createRng } from './prng';
import { reshuffle } from './reshuffle';
import type { LevelSpec, PlacedTile } from './types';

const aids = { hints: null, shuffles: null, undo: null };
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids, ...over });
const variants: [string, LevelSpec][] = [
  ['coppie su 5 piani', spec()],
  ['nascoste, nebbia e oro', spec({ hidden: [4, 4], fog: 6, gold: 5 })],
  ['tris su un piano', spec({ cells: grid(6, 6, 0), groupSize: 3, types: 6 })],
];
const tile = (x: number, y: number, z: number, type: number, hiddenGroup = 0): PlacedTile => ({ x, y, z, type, hiddenGroup, fog: false, gold: false });

function start(s: LevelSpec, seed: number): GameState {
  const r = generateLevel(s, seed);
  if (!r.ok) throw new Error(`seme ${seed}: generazione fallita`);
  return new GameState(r.value.tiles, s.groupSize, s.poolSize);
}

describe('reshuffle', () => {
  test.each(variants)('%s: cambia solo i tipi e la partita resta risolvibile, a diversi punti della partita', (_name, s) => {
    let unknown = 0;
    let total = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const moves of [0, 8, 20]) {
        const before = playRandomMoves(start(s, seed), createRng(100 + seed), moves);
        const r = reshuffle(before, s.types, 7);
        if (!r.ok) throw new Error(`seme ${seed}, ${moves} mosse: ${JSON.stringify(r.error)}`);
        total++;
        if (checkReshuffle(before, r.value, s.types, `${s.id} seme ${seed} dopo ${moves} mosse`) === 'unknown') unknown++;
      }
    }
    expect({ unknown, total }).toEqual({ unknown: 0, total });
  });

  test('da una partita bloccata, il rimescolo restituisce uno stato con una mossa', () => {
    const s = spec({ hidden: [4, 4], fog: 6, gold: 5 });
    let recovered = 0;
    for (let seed = 1; seed <= 60 && recovered < 3; seed++) {
      const stuck = playRandomMoves(start(s, seed), createRng(seed), 1000);
      if (stuck.remaining === 0 || findMove(stuck) !== null) continue;
      const r = reshuffle(stuck, s.types, seed);
      if (!r.ok) throw new Error(`seme ${seed}: ${JSON.stringify(r.error)}`);
      expect({ seed, mossa: findMove(r.value) !== null }).toEqual({ seed, mossa: true });
      recovered++;
    }
    expect(recovered).toBeGreaterThan(0);
  });

  test('stesso stato e stesso seme danno lo stesso risultato; semi diversi, disposizioni diverse', () => {
    const before = playRandomMoves(start(spec(), 3), createRng(5), 10);
    const types = (seed: number) => {
      const r = reshuffle(before, 12, seed);
      if (!r.ok) throw new Error('rimescolo fallito');
      return r.value.tiles.map((t) => t.type);
    };
    expect(types(9)).toEqual(types(9));
    expect(types(9)).not.toEqual(types(10));
  });

  test('non modifica lo stato ricevuto', () => {
    const before = playRandomMoves(start(spec(), 3), createRng(5), 10);
    const snapshot = before.tiles.map((t) => t.type);
    reshuffle(before, 12, 1);
    expect(before.tiles.map((t) => t.type)).toEqual(snapshot);
    expect(before.left.reduce((a, b) => a + b, 0)).toBe(before.remaining);
  });

  test('a tavola vuota restituisce uno stato vuoto', () => {
    const s = spec({ cells: grid(4, 4, 0), types: 5 });
    const gen = generateLevel(s, 1);
    if (!gen.ok) throw new Error('generazione fallita');
    let state = new GameState(gen.value.tiles, s.groupSize, s.poolSize);
    for (const block of gen.value.plan) {
      for (let k = 0; k < block.length; k += s.groupSize) {
        const r = applyMove(state, block.slice(k, k + s.groupSize));
        if (!r.ok) throw new Error(r.error);
        state = r.value;
      }
    }
    expect(state.remaining).toBe(0);
    const r = reshuffle(state, 5, 1);
    expect(r.ok && r.value.remaining).toBe(0);
  });

  test('invalid-spec: tessere rimaste non multiple del gruppo, tipi fuori intervallo, troppi gruppi di stelle', () => {
    const odd = new GameState([tile(0, 0, 0, 0), tile(2, 0, 0, 0), tile(4, 0, 0, 1)], 2, 2);
    expect(reshuffle(odd, 2, 1)).toMatchObject({ ok: false, error: { kind: 'invalid-spec' } });
    const even = new GameState([tile(0, 0, 0, 0), tile(2, 0, 0, 0)], 2, 2);
    expect(reshuffle(even, 3, 1)).toMatchObject({ ok: false, error: { kind: 'invalid-spec' } });
    expect(reshuffle(even, 0, 1)).toMatchObject({ ok: false, error: { kind: 'invalid-spec' } });
    const manyStars = new GameState([tile(0, 0, 0, 0, 3), tile(2, 0, 0, 0, 3)], 2, 2); // 3 gruppi da aprire, una sola coppia
    expect(reshuffle(manyStars, 2, 1)).toMatchObject({ ok: false, error: { kind: 'invalid-spec' } });
  });

  test('generation-failed: un gruppo nascosto che nessuna stella può aprire', () => {
    const locked = new GameState([tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1)], 2, 2); // sono nascoste tutte e due le tessere
    expect(reshuffle(locked, 2, 1, 5)).toEqual({ ok: false, error: { kind: 'generation-failed', attempts: 5 } });
  });
});
