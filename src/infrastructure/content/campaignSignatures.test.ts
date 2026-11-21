import { levelSignature } from '../../domain/fingerprint';
import { newProgress, retainValid, type LevelProgress, type Progress } from '../../domain/progress';
import { campaignIslandsForProgress, campaignLevelById, campaignSignatures } from './campaignLevels';
import { legacyLevels } from './legacyLevels';

const done: LevelProgress = { stars: 3, bestSeconds: 60, gold: 1, profile: 'normal' };
const progressWith = (levels: Record<number, LevelProgress>): Progress => ({ ...newProgress(), levels });

describe('campaignSignatures', () => {
  const ids = [...Array.from({ length: 150 }, (_, i) => i + 1), 151, 152, 171, 172, 331];

  test('current è la firma del livello della campagna; undefined per un numero senza livello', () => {
    for (const id of ids) expect(campaignSignatures.current(id)).toBe(levelSignature(campaignLevelById(id)!));
    for (const bad of [0, -1, 1.5, NaN]) expect(campaignSignatures.current(bad)).toBeUndefined();
    for (const bad of [0, -1, 1.5, NaN]) expect(campaignSignatures.base(bad)).toBeUndefined();
  });

  test('base è la firma del livello di prima: diversa da current solo dove il livello è un Tris al primo posto di un\'isola', () => {
    const open = progressWith(Object.fromEntries(Array.from({ length: 12 }, (_, k) => [170 + 20 * k, done])));
    const openers = new Set(campaignIslandsForProgress(open).slice(1).map((island) => island.levelIds[0]));
    expect(openers.has(21) && openers.has(41) && openers.has(151) && openers.has(331)).toBe(true);
    for (const id of ids) expect({ id, differs: campaignSignatures.base(id) !== campaignSignatures.current(id) }).toEqual({ id, differs: openers.has(id) });
  });

  test('i dieci Tris dell\'originale non cambiano: base e current coincidono', () => {
    for (const l of legacyLevels.filter((x) => x.groupSize === 3)) expect(campaignSignatures.base(l.id)).toBe(campaignSignatures.current(l.id));
  });
});

describe('i progressi di un dispositivo che li aveva prima delle firme', () => {
  const slots = [21, 41, 51, 61, 71, 81, 151, 171];
  const others = [1, 20, 22, 40, 52, 91, 100, 101, 152];

  test('le stelle dei livelli diventati Tris si scartano, tutte le altre restano e si firmano', () => {
    const old = progressWith(Object.fromEntries([...slots, ...others].map((id) => [id, done])));
    const kept = retainValid(old, campaignSignatures);
    expect(Object.keys(kept.levels).map(Number).sort((a, b) => a - b)).toEqual([...others].sort((a, b) => a - b));
    for (const id of others) expect(kept.levels[id].signature).toBe(campaignSignatures.current(id));
    expect(kept.coins).toBe(old.coins);
  });

  test('dopo la pulizia, una vittoria sul Tris vale per il Tris, e ricaricando resta', () => {
    const afterWin = progressWith({ 21: { ...done, stars: 1, signature: campaignSignatures.current(21) } });
    expect(retainValid(afterWin, campaignSignatures)).toBe(afterWin);
  });

  test('anche le stelle delle isole contano senza quelle scartate', () => {
    const old = progressWith(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [21 + i, done])));
    const islands = campaignIslandsForProgress(old);
    const animals = islands.find((island) => island.id === 'animals')!;
    const sum = (p: Progress) => animals.levelIds.reduce((total, id) => total + (p.levels[id]?.stars ?? 0), 0);
    expect(sum(old)).toBe(60);
    expect(sum(retainValid(old, campaignSignatures))).toBe(57); // il primo livello è un Tris: 3 stelle in meno
  });
});
