import { pyramid90 } from './__fixtures__/shapes';
import { LAYER_DX, LAYER_DY, TILE_RATIO, boardMetrics, drawOrder, gameColumn, hitTest, tileRect, visibleFraction } from './board';
import type { Cell } from './types';

const cells = pyramid90();
const topIndices = cells.map((t, i) => [t, i] as const).filter(([t]) => t.z === 4).map(([, i]) => i);
const stack: Cell[] = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }];

describe('gameColumn', () => {
  test('finestra larga: colonna 3:4 centrata; finestra stretta: intera', () => {
    expect(gameColumn(1200, 800)).toEqual({ x: 300, y: 0, w: 600, h: 800 });
    expect(gameColumn(360, 780)).toEqual({ x: 0, y: 0, w: 360, h: 780 });
  });

  test('il rapporto massimo si può cambiare', () => {
    expect(gameColumn(1000, 500, 1)).toEqual({ x: 250, y: 0, w: 500, h: 500 });
  });
});

describe('boardMetrics e tileRect', () => {
  test('una tessera sola: valori calcolati a mano dalla formula dell\'originale', () => {
    const m = boardMetrics([{ x: 0, y: 0, z: 0 }], 200, 300);
    expect(m.tw).toBeCloseTo(178, 10); // min(200 - 14 - 8, (300 - 10 - 8) / 1.3)
    expect(m.th).toBeCloseTo(178 * 1.3, 10);
    expect([m.cols, m.rows, m.maxZ]).toEqual([1, 1, 0]);
    expect(m.originX).toBeCloseTo(7, 10); // (200 - (178 + 8)) / 2
    const r = tileRect(m, { x: 0, y: 0, z: 0 });
    expect(r.x).toBeCloseTo(11, 10);
    expect(r.y).toBeCloseTo((300 - (178 * 1.3 + 8)) / 2 + 4, 10);
    expect(r.w).toBeCloseTo(175, 10);
    expect(r.h).toBeCloseTo(178 * 1.3 - 3, 10);
  });

  test('ogni piano è spostato di (LAYER_DX, LAYER_DY) rispetto al precedente', () => {
    const m = boardMetrics(stack, 200, 300);
    const under = tileRect(m, stack[0]);
    const over = tileRect(m, stack[1]);
    expect(over.x - under.x).toBeCloseTo(-4, 10);
    expect(over.y - under.y).toBeCloseTo(-5, 10);
  });

  test('le costanti di layout sono quelle dell\'originale', () => {
    expect([LAYER_DX, LAYER_DY, TILE_RATIO]).toEqual([-4, -5, 1.3]);
  });

  test('tutte le tessere stanno dentro l\'area, a più dimensioni di schermo', () => {
    for (const [w, h] of [[360, 640], [412, 915], [768, 1024]]) {
      const m = boardMetrics(cells, w, h);
      for (const t of cells) {
        const r = tileRect(m, t);
        expect({ w, h, dentro: r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h }).toEqual({ w, h, dentro: true });
      }
    }
  });

  test('cap limita la larghezza della tessera', () => {
    expect(boardMetrics(cells, 768, 1024).tw).toBeGreaterThan(40);
    expect(boardMetrics(cells, 768, 1024, 40).tw).toBe(40);
  });
});

describe('hitTest', () => {
  const m = boardMetrics(cells, 360, 640);

  test('il centro di una tessera in cima è quella tessera', () => {
    expect(topIndices.length).toBeGreaterThan(0);
    for (const i of topIndices) {
      const r = tileRect(m, cells[i]);
      expect(hitTest(cells, m, r.x + r.w / 2, r.y + r.h / 2)).toBe(i);
    }
  });

  test('fuori dalla tavola: null', () => {
    expect(hitTest(cells, m, -5, -5)).toBeNull();
  });

  test('tessera coperta: dal bordino scoperto si raggiunge quella sotto', () => {
    const ms = boardMetrics(stack, 200, 300);
    const under = tileRect(ms, stack[0]);
    const over = tileRect(ms, stack[1]);
    const px = under.x + under.w - 1;
    const py = under.y + under.h - 1;
    expect(px > over.x + over.w || py > over.y + over.h).toBe(true);
    expect(hitTest(stack, ms, px, py)).toBe(0);
    expect(hitTest(stack, ms, over.x + over.w / 2, over.y + over.h / 2)).toBe(1);
  });

  test('la tolleranza allarga ogni tessera', () => {
    const r = tileRect(m, cells[topIndices[0]]);
    const px = r.x - 3;
    const py = r.y + r.h / 2;
    expect(hitTest(cells, m, px, py)).not.toBe(topIndices[0]);
    expect(hitTest(cells, m, px, py, 5)).toBe(topIndices[0]);
  });

  test('un ordine di disegno già calcolato dà lo stesso risultato', () => {
    const order = drawOrder(cells);
    const r = tileRect(m, cells[40]);
    const [px, py] = [r.x + r.w - 1, r.y + r.h - 1];
    expect(hitTest(cells, m, px, py, 0, order)).toBe(hitTest(cells, m, px, py));
  });
});

describe('drawOrder e visibleFraction', () => {
  test('i piani alti vengono dopo; a parità di posizione vale l\'ordine dei dati', () => {
    const zs = drawOrder(cells).map((i) => cells[i].z);
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
    expect(drawOrder([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }])).toEqual([0, 1]);
  });

  test('una tessera in cima è raggiungibile quasi al 100%', () => {
    const m = boardMetrics(cells, 360, 640);
    expect(visibleFraction(cells, m, topIndices[0], 2)).toBeGreaterThan(0.99);
  });

  test('una tessera isolata è raggiungibile al 100%', () => {
    const alone: Cell[] = [{ x: 0, y: 0, z: 0 }];
    expect(visibleFraction(alone, boardMetrics(alone, 200, 300), 0, 1)).toBe(1);
  });

  test('una tessera coperta è raggiungibile solo dal bordino scoperto', () => {
    const ms = boardMetrics(stack, 200, 300);
    const f = visibleFraction(stack, ms, 0, 1);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(0.1);
  });
});
