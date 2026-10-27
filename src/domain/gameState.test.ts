import { GameState, applyMove } from './gameState';
import { STAR_TYPE, type PlacedTile } from './types';

const tile = (x: number, y: number, z: number, type: number, hiddenGroup = 0): PlacedTile => ({ x, y, z, type, hiddenGroup, fog: false, gold: false });
// Quattro tessere libere e isolate (distanza 2): due coppie di tipi 0 e 1.
const pairs = () => new GameState([tile(0, 0, 0, 0), tile(2, 0, 0, 0), tile(4, 0, 0, 1), tile(6, 0, 0, 1)], 2, 2);

describe('applyMove', () => {
  test('toglie un gruppo valido e non modifica lo stato ricevuto', () => {
    const before = pairs();
    const r = applyMove(before, [0, 1]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.remaining).toBe(2);
    expect(r.value.playable()).toEqual([2, 3]);
    expect(before.remaining).toBe(4);
    expect(before.playable()).toEqual([0, 1, 2, 3]);
  });

  test('tipi diversi: not-matching', () => {
    expect(applyMove(pairs(), [0, 2])).toEqual({ ok: false, error: 'not-matching' });
  });

  test('tessera coperta: tile-blocked', () => {
    const covered = new GameState([tile(0, 0, 0, 0), tile(0, 0, 1, 0)], 2, 1);
    expect(applyMove(covered, [0, 1])).toEqual({ ok: false, error: 'tile-blocked' });
  });

  test('gruppo di tessere nascoste: tile-blocked finché non si toglie il gruppo di stelle', () => {
    const state = new GameState([tile(0, 0, 0, 0, 1), tile(2, 0, 0, 0, 1), tile(4, 0, 0, STAR_TYPE), tile(6, 0, 0, STAR_TYPE)], 2, 1);
    expect(applyMove(state, [0, 1])).toEqual({ ok: false, error: 'tile-blocked' });
    const afterStars = applyMove(state, [2, 3]);
    expect(afterStars.ok).toBe(true);
    if (!afterStars.ok) return;
    const last = applyMove(afterStars.value, [0, 1]);
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.value.remaining).toBe(0);
  });

  test('gruppo non valido: dimensione sbagliata, doppioni, indice fuori tavola, tessera già tolta', () => {
    const state = pairs();
    const invalid = { ok: false, error: 'invalid-group' };
    expect(applyMove(state, [0])).toEqual(invalid);
    expect(applyMove(state, [0, 1, 2])).toEqual(invalid);
    expect(applyMove(state, [0, 0])).toEqual(invalid);
    expect(applyMove(state, [0, 9])).toEqual(invalid);
    expect(applyMove(state, [-1, 0])).toEqual(invalid);
    const next = applyMove(state, [0, 1]);
    if (next.ok) expect(applyMove(next.value, [0, 1])).toEqual(invalid);
  });

  test('tris: servono tre tessere uguali', () => {
    const tris = new GameState([tile(0, 0, 0, 0), tile(2, 0, 0, 0), tile(4, 0, 0, 0)], 3, 1);
    expect(applyMove(tris, [0, 1])).toEqual({ ok: false, error: 'invalid-group' });
    const r = applyMove(tris, [0, 1, 2]);
    expect(r.ok && r.value.remaining).toBe(0);
  });
});
