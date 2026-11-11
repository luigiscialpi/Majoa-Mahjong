import { finaleOf } from '../../application/finale';
import { legacyIslands, trisLevelIds } from './legacyIslands';
import { legacyLevels } from './legacyLevels';

const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const src = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8'); // percorso dalla radice del progetto

// Isole dell'originale con i loro intervalli di livelli (`ISLANDS`, riga 1159) e la regola dei finali di `win` (riga 2294).
const BASE_LV = Number(/var BASE_LV=(\d+);/.exec(src)![1]);
const islandRanges = [...src.matchAll(/\{id:'(\w+)',icon:'[^']*',(?:[^{}]*?)levels:\[(\d+),(\d+)\]/g)].map((m) => ({ id: m[1], first: Number(m[2]), last: Number(m[3]) }));
const originalFinale = (lv: number) => {
  const island = islandRanges.find((i) => lv >= i.first && lv <= i.last) ?? islandRanges[0];
  const grand = lv === 90;
  const prologueEnd = lv === BASE_LV;
  const islandEnd = (!grand && !prologueEnd && lv === island.last && lv > 40) || lv === 40;
  return grand ? 'grand' : prologueEnd ? 'prologue' : islandEnd ? 'island' : null;
};

describe('finaleOf', () => {
  test('le isole dell\'originale sono quelle lette dall\'HTML', () => {
    expect(islandRanges.map((i) => i.id)).toEqual(['prologue', 'animals', 'sweets', 'art', 'science', 'sea', 'flowers', 'tris']);
    expect(BASE_LV).toBe(20);
  });

  test('per ogni livello coincide con la regola dell\'originale', () => {
    const ids = legacyLevels.map((l) => l.id);
    expect(ids.length).toBe(100);
    for (const id of ids) expect([id, finaleOf(id, legacyIslands, trisLevelIds)]).toEqual([id, originalFinale(id)]);
  });

  test('i finali sono 20, 40, 50, 60, 70, 80, 90 e 100, con 20 iniziale e 90 conclusivo', () => {
    const finals = legacyLevels.map((l) => l.id).filter((id) => finaleOf(id, legacyIslands, trisLevelIds) !== null);
    expect(finals).toEqual([20, 40, 50, 60, 70, 80, 90, 100]);
    expect(finaleOf(20, legacyIslands, trisLevelIds)).toBe('prologue');
    expect(finaleOf(90, legacyIslands, trisLevelIds)).toBe('grand');
    expect(finaleOf(40, legacyIslands, trisLevelIds)).toBe('island');
    expect(finaleOf(100, legacyIslands, trisLevelIds)).toBe('island');
  });

  test('senza isole né livelli bonus nessun livello è un finale', () => {
    expect(finaleOf(5, [], [])).toBeNull();
  });
});
