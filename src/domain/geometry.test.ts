import { FreeTracker, buildAdjacency } from './geometry';
import type { Cell } from './types';

const free = (cells: Cell[]) => new FreeTracker(buildAdjacency(cells)).freeList();

describe('tessere libere', () => {
  test('una tessera coperta da una al piano superiore non è libera', () => {
    expect(free([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }])).toEqual([1]);
  });

  test('una tessera sfalsata di mezza tessera copre quelle sotto', () => {
    expect(free([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0.5, y: 0, z: 1 }])).toEqual([2]);
  });

  test('una tessera spostata di una tessera intera non copre', () => {
    expect(free([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }])).toEqual([0, 1]);
  });

  test('chiusa a sinistra e a destra non è libera; con un solo lato chiuso sì', () => {
    const row = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }];
    expect(free(row)).toEqual([0, 2]);
  });

  test('tessere a distanza 2 o su righe diverse non si chiudono a vicenda', () => {
    expect(free([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }])).toEqual([0, 1, 2]);
    expect(free([{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 0, z: 0 }])).toEqual([0, 1, 2]);
  });
});

describe('FreeTracker', () => {
  test('togliere la tessera che copre libera quella sotto', () => {
    const ft = new FreeTracker(buildAdjacency([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }]));
    ft.remove(1);
    expect(ft.freeList()).toEqual([0]);
    expect(ft.remaining).toBe(1);
  });

  test('togliere una vicina apre il lato e libera la tessera di mezzo', () => {
    const ft = new FreeTracker(buildAdjacency([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }]));
    expect(ft.isFree(1)).toBe(false);
    ft.remove(0);
    expect(ft.isFree(1)).toBe(true);
  });

  test('clone è indipendente dall\'originale', () => {
    const ft = new FreeTracker(buildAdjacency([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }]));
    const copy = ft.clone();
    copy.remove(1);
    expect(ft.freeList()).toEqual([1]);
    expect(copy.freeList()).toEqual([0]);
  });
});
