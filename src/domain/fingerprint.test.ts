import { boardFingerprint, fingerprint, levelSignature } from './fingerprint';
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

describe('levelSignature', () => {
  const GOLDEN = '3b044d467f96abd7'; // fissato: cambiarlo azzererebbe i progressi di tutti
  const cells = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }];
  const level = { groupSize: 3, cells };

  test('sono 16 cifre esadecimali, sempre le stesse per lo stesso livello (valore fissato)', () => {
    expect(levelSignature(level)).toMatch(/^[0-9a-f]{16}$/);
    expect(levelSignature({ ...level, cells: cells.map((c) => ({ ...c })) })).toBe(levelSignature(level));
    expect(levelSignature(level)).toBe(GOLDEN);
  });

  test('cambiano con il gruppo, con ogni coordinata, con il numero e con l\'ordine delle celle', () => {
    const base = levelSignature(level);
    expect(levelSignature({ ...level, groupSize: 2 })).not.toBe(base);
    for (const key of ['x', 'y', 'z'] as const) {
      expect(levelSignature({ ...level, cells: cells.map((c, i) => (i === 1 ? { ...c, [key]: c[key] + 1 } : c)) })).not.toBe(base);
    }
    expect(levelSignature({ ...level, cells: cells.slice(1) })).not.toBe(base);
    expect(levelSignature({ ...level, cells: [...cells, { x: 3, y: 3, z: 0 }] })).not.toBe(base);
    expect(levelSignature({ ...level, cells: [cells[1], cells[0], cells[2]] })).not.toBe(base);
  });

  test('non dipendono da altro: disegni, nebbia, oro e aiuti di un livello non la cambiano', () => {
    const decorated = { ...level, types: 9, fog: 4, gold: 2, hidden: [3], aids: { hint: 1 }, name: 'x' };
    expect(levelSignature(decorated)).toBe(levelSignature(level));
  });

  test('due celle non si confondono con una sola con coordinate «attaccate»', () => {
    expect(levelSignature({ groupSize: 2, cells: [{ x: 1, y: 23, z: 4 }] })).not.toBe(levelSignature({ groupSize: 2, cells: [{ x: 12, y: 3, z: 4 }] }));
  });
});
