import { generateLevel } from '../../domain/generator';
import { newProgress } from '../../domain/progress';
import { displayLevelNumber } from '../../ui/format';
import { legacyLevels, toSpec } from './legacyLevels';
import { campaignIslandsForProgress, campaignLevelById } from './campaignLevels';
import { trisLevelIds } from './legacyIslands';

type Cells = readonly { x: number; y: number; z: number }[];

describe('campagna estesa e livelli generati', () => {
  test('mantiene i 100 riferimenti originali e completa le sette isole a 20 livelli', () => {
    const islands = campaignIslandsForProgress(newProgress());
    const campaign = islands.slice(0, 7);

    expect(legacyLevels.map((level) => level.id)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(trisLevelIds).toEqual(Array.from({ length: 10 }, (_, index) => index + 91));
    expect(campaign.map((island) => island.levelIds.length)).toEqual([20, 20, 20, 20, 20, 20, 20]);
    expect(campaign.flatMap((island) => island.levelIds)).toEqual(expect.arrayContaining([...Array.from({ length: 90 }, (_, index) => index + 1).filter((id) => id < 91), ...Array.from({ length: 50 }, (_, index) => index + 101)]));
    expect(displayLevelNumber(islands, 150)).toBe(140);
    expect(displayLevelNumber(islands, 151)).toBe(141);
    expect(displayLevelNumber(islands, 171)).toBe(161);
  });

  test('estende la mappa man mano che il progresso avanza e arresta la crescita della difficoltà al limite del tema', () => {
    const islands = campaignIslandsForProgress({ ...newProgress(), levels: { 170: { stars: 1, bestSeconds: 1, gold: 0, profile: 'normal' } } });
    expect(islands.slice(7).map((island) => island.id)).toEqual(['generated-8', 'generated-9', 'generated-10']);
    // il primo livello di ogni isola è un Tris (`trisSlots.test.ts`): la curva dei disegni si legge sul secondo
    expect([campaignLevelById(152)?.types, campaignLevelById(172)?.types, campaignLevelById(192)?.types, campaignLevelById(332)?.types]).toEqual([12, 13, 14, 14]);
  });

  test('tutti i livelli aggiunti alla campagna e la prima isola infinita usano forme originali e si generano risolvibili', () => {
    for (const id of Array.from({ length: 70 }, (_, index) => index + 101)) {
      const level = campaignLevelById(id);
      expect(level).toBeDefined();
      // i Tris al primo posto di un'isola sono la forma originale senza una o due tessere dello strato più alto
      const cells = level!.cells;
      const isShapeOf = (original: Cells) => (level!.groupSize === 3 ? original.length - cells.length < 3 && cells.every((c) => original.some((o) => o.x === c.x && o.y === c.y && o.z === c.z)) : JSON.stringify(original) === JSON.stringify(cells));
      expect(legacyLevels.some((original) => isShapeOf(original.cells))).toBe(true);
      expect(generateLevel(toSpec(level!), id).ok).toBe(true);
    }
  });
});
