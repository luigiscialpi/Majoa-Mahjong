import { boardMetrics, hitTest, tileRect, visibleFraction } from '../../domain/board';
import { FreeTracker, buildAdjacency } from '../../domain/geometry';
import { legacyLevels } from './legacyLevels';

const level20 = legacyLevels.find((l) => l.id === 20)!.cells;
const phones: [number, number][] = [[360, 640], [390, 844], [412, 915]];

describe('tavola dell\'originale sullo schermo', () => {
  test('livello 20: 96 tessere su 5 piani', () => {
    expect(level20.length).toBe(96);
    expect(Math.max(...level20.map((t) => t.z)) + 1).toBe(5);
  });

  test('in tutti i 100 livelli ogni tessera sta dentro l\'area, su telefoni e su tablet', () => {
    for (const l of legacyLevels) {
      for (const [w, h] of [...phones, [768, 1024]]) {
        const m = boardMetrics(l.cells, w, h);
        const fuori = l.cells.filter((t) => {
          const r = tileRect(m, t);
          return !(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h);
        });
        expect({ id: l.id, w, h, fuori: fuori.length }).toEqual({ id: l.id, w, h, fuori: 0 });
      }
    }
  });

  test('livello 20: 26 tessere libere all\'inizio, ciascuna raggiungibile al tocco per più dell\'80% dell\'area', () => {
    const free = new FreeTracker(buildAdjacency(level20)).freeList();
    expect(free.length).toBe(26);
    for (const [w, h] of phones) {
      const m = boardMetrics(level20, w, h);
      for (const i of free) {
        const f = visibleFraction(level20, m, i, 2);
        expect({ w, h, i, raggiungibileOltre80: f > 0.8 }).toEqual({ w, h, i, raggiungibileOltre80: true });
      }
    }
  });

  test('livello 20: il tocco al centro di ogni tessera libera seleziona quella tessera', () => {
    const free = new FreeTracker(buildAdjacency(level20)).freeList();
    for (const [w, h] of phones) {
      const m = boardMetrics(level20, w, h);
      for (const i of free) {
        const r = tileRect(m, level20[i]);
        expect({ w, h, i, toccata: hitTest(level20, m, r.x + r.w / 2, r.y + r.h / 2) }).toEqual({ w, h, i, toccata: i });
      }
    }
  });

  test('livello 20: svuotando la tavola a coppie di tessere libere restano sempre libere, fino a 26 insieme', () => {
    const ft = new FreeTracker(buildAdjacency(level20));
    let maxFree = 0;
    while (ft.remaining > 0) {
      const free = ft.freeList();
      maxFree = Math.max(maxFree, free.length);
      expect(free.length).toBeGreaterThanOrEqual(1);
      ft.remove(free[0]);
      if (free.length > 1) ft.remove(free[free.length - 1]);
    }
    expect(maxFree).toBe(26);
  });
});
