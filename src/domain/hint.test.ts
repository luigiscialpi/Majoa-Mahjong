import { pyramid90, grid } from './__fixtures__/shapes';
import { GameState, applyMove } from './gameState';
import { generateLevel } from './generator';
import { findMove } from './hint';
import { STAR_TYPE, type LevelSpec, type PlacedTile } from './types';

const tile = (x: number, y: number, z: number, type: number, hiddenGroup = 0): PlacedTile => ({ x, y, z, type, hiddenGroup, fog: false, gold: false });
// Tessere libere e isolate (distanza 2), una per tipo nell'elenco.
const row = (types: number[], g = 2, poolSize = 4) => new GameState(types.map((ty, i) => tile(i * 2, 0, 0, ty)), g, poolSize);
const aids = { hints: null, shuffles: null, undo: null };

describe('findMove', () => {
  test('sceglie la prima coppia per ordine delle tessere, non per tipo', () => {
    expect(findMove(row([0, 1, 0, 1]))).toEqual([0, 2]);
    expect(findMove(row([1, 0, 0, 1]))).toEqual([0, 3]); // la tessera 0 ha il compagno più avanti
  });

  test('senza due tessere giocabili uguali non c\'è nessuna mossa', () => {
    expect(findMove(row([0, 1, 2, 3]))).toBeNull();
  });

  test('una coppia coperta non è una mossa', () => {
    const covered = new GameState([tile(0, 0, 0, 0), tile(0, 0, 1, 0), tile(4, 0, 0, 1)], 2, 2);
    expect(findMove(covered)).toBeNull();
  });

  test('tris: servono tre tessere giocabili uguali e si propone il gruppo con la prima tessera', () => {
    expect(findMove(row([0, 1, 0, 1, 0, 1], 3))).toEqual([0, 2, 4]);
    expect(findMove(row([0, 1, 0, 1, 2, 3], 3))).toBeNull();
  });

  test('finché c\'è un gruppo nascosto chiuso preferisce le stelle, anche se un\'altra coppia viene prima', () => {
    const state = new GameState(
      [tile(0, 0, 0, 0), tile(2, 0, 0, 0), tile(4, 0, 0, STAR_TYPE), tile(6, 0, 0, STAR_TYPE), tile(8, 0, 0, 1, 1), tile(10, 0, 0, 1, 1)],
      2,
      2,
    );
    expect(findMove(state)).toEqual([2, 3]); // le stelle
    const afterStars = applyMove(state, [2, 3]);
    if (!afterStars.ok) throw new Error('mossa rifiutata');
    expect(findMove(afterStars.value)).toEqual([0, 1]); // gruppo aperto: di nuovo il primo per ordine
  });

  test('un gruppo nascosto ancora chiuso non viene mai suggerito', () => {
    const state = new GameState([tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1), tile(4, 0, 0, STAR_TYPE), tile(6, 0, 0, STAR_TYPE)], 2, 1);
    expect(findMove(state)).toEqual([2, 3]);
  });

  test('il gruppo suggerito è sempre accettato da applyMove, e «nessuna mossa» coincide con l\'assenza di gruppi', () => {
    const specs: LevelSpec[] = [
      { id: 'p', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [4, 4], fog: 6, gold: 5, aids },
      { id: 't', cells: grid(6, 6, 0), groupSize: 3, types: 6, poolSize: 24, hidden: [], fog: 0, gold: 0, aids },
    ];
    for (const spec of specs) {
      for (let seed = 1; seed <= 10; seed++) {
        const gen = generateLevel(spec, seed);
        if (!gen.ok) throw new Error(`${spec.id} seme ${seed}: generazione fallita`);
        let state = new GameState(gen.value.tiles, spec.groupSize, spec.poolSize);
        for (;;) {
          const counts = new Map<number, number>();
          for (const i of state.playable()) counts.set(state.slot(state.tiles[i].type), (counts.get(state.slot(state.tiles[i].type)) ?? 0) + 1);
          const exists = [...counts.values()].some((c) => c >= spec.groupSize);
          const move = findMove(state);
          expect({ id: spec.id, seed, rimaste: state.remaining, trovata: move !== null }).toEqual({ id: spec.id, seed, rimaste: state.remaining, trovata: exists });
          if (!move) break;
          const r = applyMove(state, move);
          if (!r.ok) throw new Error(`${spec.id} seme ${seed}: ${r.error}`);
          state = r.value;
        }
      }
    }
  });
});
