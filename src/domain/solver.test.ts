import { grid, pyramid90 } from './__fixtures__/shapes';
import { generateLevel } from './generator';
import { createRng } from './prng';
import { playRandom, simulate, solve } from './solver';
import { STAR_TYPE, type LevelSpec, type PlacedTile } from './types';

const tile = (x: number, y: number, z: number, type: number, hiddenGroup = 0): PlacedTile => ({ x, y, z, type, hiddenGroup, fog: false, gold: false });
const aids = { hints: null, shuffles: null, undo: null };
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids, ...over });

describe('solve', () => {
  test('una coppia impilata (stesso tipo sopra e sotto) non è risolvibile', () => {
    const tiles = [tile(0, 0, 0, 0), tile(0, 0, 1, 0), tile(3, 0, 0, 1), tile(5, 0, 0, 1)];
    expect(solve(tiles, 2, 2).status).toBe('unsolvable');
  });

  test('coppie libere si risolvono', () => {
    const tiles = [tile(0, 0, 0, 0), tile(2, 0, 0, 0), tile(4, 0, 0, 1), tile(6, 0, 0, 1)];
    expect(solve(tiles, 2, 2).status).toBe('solvable');
  });

  test('una tessera nascosta si gioca solo dopo il gruppo di stelle', () => {
    const open = [tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1), tile(4, 0, 0, STAR_TYPE), tile(6, 0, 0, STAR_TYPE)];
    expect(solve(open, 2, 1).status).toBe('solvable');
    // Se anche le stelle sono nascoste dietro lo stesso gruppo, il gruppo non si apre mai.
    const locked = [tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1), tile(4, 0, 0, STAR_TYPE, 1), tile(6, 0, 0, STAR_TYPE, 1)];
    expect(solve(locked, 2, 1).status).toBe('unsolvable');
  });

  test('oltre il budget di nodi l\'esito è unknown', () => {
    const r = generateLevel(spec(), 1);
    if (!r.ok) throw new Error('generazione fallita');
    expect(solve(r.value.tiles, 2, 24, 1).status).toBe('unknown');
  });

  test('tutte le tavole generate sono risolvibili, verificato in modo indipendente dalla costruzione', () => {
    const variants = [spec(), spec({ hidden: [4, 4], fog: 6, gold: 5 }), spec({ cells: grid(6, 6, 0), groupSize: 3, types: 6 })];
    for (const s of variants) {
      for (let seed = 1; seed <= 20; seed++) {
        const r = generateLevel(s, seed);
        if (!r.ok) throw new Error(`seme ${seed}: generazione fallita`);
        expect({ seed, status: solve(r.value.tiles, s.groupSize, s.poolSize).status }).toEqual({ seed, status: 'solvable' });
      }
    }
  });
});

describe('partite casuali', () => {
  const board = () => {
    const r = generateLevel(spec(), 5);
    if (!r.ok) throw new Error('generazione fallita');
    return r.value.tiles;
  };

  test('playRandom è deterministica con lo stesso seme e la libertà sta tra 0 e 1', () => {
    const a = playRandom(board(), 2, 24, createRng(9));
    expect(a).toEqual(playRandom(board(), 2, 24, createRng(9)));
    expect(a.freedom).toBeGreaterThan(0);
    expect(a.freedom).toBeLessThanOrEqual(1);
  });

  test('simulate: quota di partite bloccate e libertà media sono frazioni', () => {
    const s = simulate(board(), 2, 24, createRng(1), 30);
    expect(s.stuck).toBeGreaterThanOrEqual(0);
    expect(s.stuck).toBeLessThanOrEqual(1);
    expect(s.freedom).toBeGreaterThan(0);
    expect(s.freedom).toBeLessThanOrEqual(1);
  });
});
