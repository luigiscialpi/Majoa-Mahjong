import { createRng, hashSeed } from './prng';

describe('hashSeed', () => {
  test('stessi valori, stesso seme; valori diversi, semi diversi', () => {
    expect(hashSeed(1, 2)).toBe(hashSeed(1, 2));
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
    expect(hashSeed('a', 'b')).not.toBe(hashSeed('a', 'c'));
  });

  test('valori fissati: cambiarli cambierebbe tutti i livelli generati', () => {
    expect(hashSeed(1, 2)).toBe(2999402140);
    expect(hashSeed('a', 'b')).toBe(3592667708);
  });
});

describe('createRng', () => {
  test('la sequenza dipende solo dal seme ed è fissata', () => {
    const r = createRng(42);
    expect(r.next()).toBe(0.6011037519201636);
    expect(r.next()).toBe(0.44829055899754167);
    expect(r.int(100)).toBe(85);
    expect(createRng(42).next()).toBe(0.6011037519201636);
    expect(createRng(43).next()).not.toBe(0.6011037519201636);
  });

  test('next è in [0, 1) e int è in [0, n)', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const k = r.int(7);
      expect(Number.isInteger(k) && k >= 0 && k < 7).toBe(true);
    }
  });

  test('shuffle è una permutazione deterministica', () => {
    expect(createRng(7).shuffle([1, 2, 3, 4, 5, 6])).toEqual([5, 2, 3, 4, 6, 1]);
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect([...createRng(3).shuffle([...items])].sort((a, b) => a - b)).toEqual(items);
  });
});
