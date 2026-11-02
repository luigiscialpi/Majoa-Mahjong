import { isIslandUnlocked, isLevelUnlocked, newProgress, openGifts, recordWin, unlockThreshold, type Progress } from '../../domain/progress';
import { legacyIslands, trisLevelIds } from './legacyIslands';
import { legacyLevels } from './legacyLevels';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** Progressi di chi ha vinto ogni livello delle isole con `stars` stelle. */
const allWith = (stars: number): Progress => ({
  ...newProgress(),
  levels: Object.fromEntries(legacyLevels.filter((l) => !trisLevelIds.includes(l.id)).map((l) => [l.id, { stars, bestSeconds: null, gold: 0, profile: null }])),
});

describe('isole della campagna dell\'originale', () => {
  test('sette isole in ordine, con i loro livelli e il regalo; i Tris a parte', () => {
    expect(legacyIslands).toEqual([
      { id: 'prologue', levelIds: range(1, 20), gift: 0 },
      { id: 'animals', levelIds: range(21, 40), gift: 3 },
      { id: 'sweets', levelIds: range(41, 50), gift: 5 },
      { id: 'art', levelIds: range(51, 60), gift: 5 },
      { id: 'science', levelIds: range(61, 70), gift: 5 },
      { id: 'sea', levelIds: range(71, 80), gift: 5 },
      { id: 'flowers', levelIds: range(81, 90), gift: 5 },
    ]);
    expect(trisLevelIds).toEqual(range(91, 100));
  });

  test('ogni livello (Tris esclusi) sta in una sola isola', () => {
    const all = legacyIslands.flatMap((i) => i.levelIds);
    expect(all).toEqual(range(1, 90));
    expect(new Set(all).size).toBe(all.length);
  });

  test('soglie di sblocco con ρ = 2/3: 40 stelle per le isole da 20 livelli, 20 per quelle da 10', () => {
    expect(legacyIslands.map((i) => unlockThreshold(i))).toEqual([40, 40, 20, 20, 20, 20, 20]);
  });

  test('chi vince tutto con 3 stelle apre ogni isola e ogni livello e raccoglie 28 ✨ di regali', () => {
    const p = allWith(3);
    expect(legacyIslands.map((_, i) => isIslandUnlocked(p, legacyIslands, i))).toEqual(Array(7).fill(true));
    expect(range(1, 90).every((id) => isLevelUnlocked(p, legacyIslands, id))).toBe(true);
    const gifts = openGifts(p, legacyIslands);
    expect([gifts.opened.map((i) => i.id), gifts.progress.coins - p.coins]).toEqual([['animals', 'sweets', 'art', 'science', 'sea', 'flowers'], 28]);
  });

  test('con 2 stelle di media si aprono ancora tutte le isole; con 1 stella già la seconda resta chiusa', () => {
    expect(legacyIslands.map((_, i) => isIslandUnlocked(allWith(2), legacyIslands, i))).toEqual(Array(7).fill(true));
    expect(legacyIslands.map((_, i) => isIslandUnlocked(allWith(1), legacyIslands, i))).toEqual([true, false, false, false, false, false, false]);
  });

  test('vincendo i livelli iniziali uno alla volta con una stella si sbloccano uno alla volta, e le 20 stelle non aprono gli animali', () => {
    let p = newProgress();
    for (const id of range(1, 20)) {
      expect({ id, aperto: isLevelUnlocked(p, legacyIslands, id), prossimo: isLevelUnlocked(p, legacyIslands, id + 1) }).toEqual({ id, aperto: true, prossimo: false });
      p = recordWin(p, { levelId: id, stars: 1, seconds: 100, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      expect(isLevelUnlocked(p, legacyIslands, id + 1)).toBe(id < 20);
    }
    expect(isIslandUnlocked(p, legacyIslands, 1)).toBe(false); // 20 stelle su 40
  });
});
