import { boardFingerprint, fingerprint } from './fingerprint';
import { GameState } from './gameState';
import type { PlacedTile } from './types';

const tile = (over: Partial<PlacedTile> = {}): PlacedTile => ({ x: 0, y: 0, z: 0, type: 0, hiddenGroup: 0, fog: false, gold: false, ...over });
const tiles = (): PlacedTile[] => [tile({ x: 0, type: 1 }), tile({ x: 2, type: 1 }), tile({ x: 4, type: 2 }), tile({ x: 6, type: 2 })];
const state = (t: PlacedTile[] = tiles()) => new GameState(t, 2, 3);

describe('fingerprint', () => {
  test('valori fissi: salvataggi e tavole dipendono dall\'algoritmo', () => {
    expect(fingerprint([])).toBe('811c9dc59747b28c');
    expect(fingerprint(['a'])).toBe('e40c292ca111d8f1');
    expect(fingerprint(['ab'])).toBe('4d2505ca0e83d88f');
    expect(fingerprint(['mahjong ✨'])).toBe('fdb835e992dfdeb8');
  });

  test('dipende dall\'ordine e legge le parti senza separatori', () => {
    expect(fingerprint(['ba'])).toBe('3c2ba6ccb88baf73');
    expect(fingerprint(['a', 'b'])).toBe(fingerprint(['ab']));
  });
});

describe('boardFingerprint', () => {
  test('è un valore a 64 bit in esadecimale e coincide per stati uguali', () => {
    expect(boardFingerprint(state())).toMatch(/^[0-9a-f]{16}$/);
    expect(boardFingerprint(state())).toBe(boardFingerprint(state()));
  });

  test.each<[string, Partial<PlacedTile>]>([
    ['x', { x: 8 }],
    ['y', { y: 2 }],
    ['z', { z: 1 }],
    ['disegno', { type: 0 }],
    ['gruppo nascosto', { hiddenGroup: 1 }],
    ['nebbia', { fog: true }],
    ['oro', { gold: true }],
  ])('cambia se cambia %s di una tessera', (_, over) => {
    const changed = tiles();
    changed[1] = { ...changed[1], ...over };
    expect(boardFingerprint(state(changed))).not.toBe(boardFingerprint(state()));
  });

  test('cambia se una tessera esce dalla tavola e se si apre un gruppo nascosto', () => {
    const base = state();
    const removed = base.clone();
    removed.ft.remove(0);
    expect(boardFingerprint(removed)).not.toBe(boardFingerprint(base));
    const opened = base.clone();
    opened.unlocked++;
    expect(boardFingerprint(opened)).not.toBe(boardFingerprint(base));
  });

  test('distingue quale tessera è uscita, non solo quante', () => {
    const a = state();
    a.ft.remove(0);
    const b = state();
    b.ft.remove(1);
    expect(boardFingerprint(a)).not.toBe(boardFingerprint(b));
  });

  test('non confonde tessere vicine: le parti sono delimitate', () => {
    // 1,11 e 11,1 diventerebbero la stessa stringa senza il delimitatore.
    const a = [tile({ x: 1, y: 11 })];
    const b = [tile({ x: 11, y: 1 })];
    expect(boardFingerprint(new GameState(a, 2, 3))).not.toBe(boardFingerprint(new GameState(b, 2, 3)));
  });
});
