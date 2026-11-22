import type { IslandInfo, Progress } from '../domain/progress';
import { newProgress } from '../domain/progress';
import { campaignIslandsForProgress } from '../infrastructure/content/campaignLevels';
import { islandAfter, opensWithSpecialLevel } from './teaser';

const done = { stars: 1, bestSeconds: 1, gold: 0, profile: 'normal' } as const;
// Una mappa che arriva a una decina di isole generate
const progress: Progress = { ...newProgress(), levels: Object.fromEntries([170, 190, 210, 230, 250].map((id) => [id, done])) };
const islands = campaignIslandsForProgress(progress);

describe('islandAfter', () => {
  test('l\'isola che segue, solo per l\'ultimo livello di un\'isola', () => {
    islands.slice(0, -1).forEach((island, index) => {
      expect(islandAfter(island.levelIds[island.levelIds.length - 1], islands)?.id).toBe(islands[index + 1].id);
    });
    expect(islandAfter(20, islands)?.id).toBe('animals');
  });

  test('un livello che non è l\'ultimo di un\'isola non ha un seguito', () => {
    for (const island of islands.slice(0, 4)) for (const id of island.levelIds.slice(0, -1)) expect(islandAfter(id, islands)).toBeNull();
  });

  test('l\'ultima isola della mappa non ha un seguito; un livello sconosciuto o una mappa vuota nemmeno', () => {
    const last = islands[islands.length - 1];
    expect(islandAfter(last.levelIds[last.levelIds.length - 1], islands)).toBeNull();
    expect(islandAfter(99999, islands)).toBeNull();
    expect(islandAfter(20, [])).toBeNull();
  });
});

describe('opensWithSpecialLevel', () => {
  test('i livelli iniziali no; ogni isola dopo si apre con un Tris', () => {
    expect(opensWithSpecialLevel(islands[0])).toBe(false);
    for (const island of islands.slice(1)) expect({ id: island.id, special: opensWithSpecialLevel(island) }).toEqual({ id: island.id, special: true });
  });

  test('un\'isola il cui primo livello è a coppie, o che non esiste, no', () => {
    const plain: IslandInfo = { id: 'prova', levelIds: [22, 23], gift: 0 };
    expect(opensWithSpecialLevel(plain)).toBe(false);
    expect(opensWithSpecialLevel({ id: 'vuota', levelIds: [99999999], gift: 0 })).toBe(false);
  });
});
