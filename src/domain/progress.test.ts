import { INITIAL_COINS, UNLOCK_RATIO, isIslandCompleted, isIslandUnlocked, isLevelUnlocked, islandStars, levelProgress, newProgress, openGifts, recordWin, unlockThreshold, type IslandInfo, type Progress, type WinRecord } from './progress';

// Isole di prova: a (4 livelli, soglia 8), b (3 livelli, soglia 6, regalo 5), c (2 livelli, regalo 3).
const A: IslandInfo = { id: 'a', levelIds: [1, 2, 3, 4], gift: 0 };
const B: IslandInfo = { id: 'b', levelIds: [5, 6, 7], gift: 5 };
const C: IslandInfo = { id: 'c', levelIds: [8, 9], gift: 3 };
const islands = [A, B, C];
const withStars = (stars: Record<number, number>): Progress => ({
  ...newProgress(),
  levels: Object.fromEntries(Object.entries(stars).map(([id, s]) => [id, { stars: s, bestSeconds: null, gold: 0, profile: null }])),
});
const win = (over: Partial<WinRecord> = {}): WinRecord => ({ levelId: 1, stars: 3, seconds: 100, gold: 0, profile: 'normal', noTimePressure: false, ...over });

describe('progressi iniziali', () => {
  test('3 ✨, nessun livello vinto, nessun regalo dato', () => {
    expect(newProgress()).toEqual({ levels: {}, coins: INITIAL_COINS, giftsOpened: [] });
    expect(INITIAL_COINS).toBe(3);
    expect(levelProgress(newProgress(), 7)).toEqual({ stars: 0, bestSeconds: null, gold: 0, profile: null });
  });
});

describe('soglia di sblocco', () => {
  test('⌈ρ × 3 × livelli⌉: 40 su 60 con 20 livelli, 20 con 10 livelli', () => {
    const size = (n: number): IslandInfo => ({ id: 'x', levelIds: Array.from({ length: n }, (_, i) => i + 1), gift: 0 });
    expect([unlockThreshold(size(20)), unlockThreshold(size(10)), unlockThreshold(A), unlockThreshold(B)]).toEqual([40, 20, 8, 6]);
    expect(unlockThreshold(size(20), 0.5)).toBe(30);
    expect(UNLOCK_RATIO).toBeCloseTo(2 / 3, 12);
  });

  test('l\'errore di virgola mobile non sposta la soglia (0,1 × 3 × 10 = 3,0000000000000004)', () => {
    const size = (n: number): IslandInfo => ({ id: 'x', levelIds: Array.from({ length: n }, (_, i) => i + 1), gift: 0 });
    expect([unlockThreshold(size(10), 0.1), unlockThreshold(size(10), 0.2), unlockThreshold(size(5), 0.2), unlockThreshold(size(10), 0.4)]).toEqual([3, 6, 3, 12]);
  });

  test('per ogni ρ da 0,01 a 0,99 e per isole da 3 a 20 livelli coincide con il calcolo in numeri interi', () => {
    for (const n of [3, 4, 5, 10, 15, 20]) {
      const island: IslandInfo = { id: 'x', levelIds: Array.from({ length: n }, (_, i) => i + 1), gift: 0 };
      for (let k = 1; k <= 99; k++) {
        const exact = Math.floor((k * 3 * n + 99) / 100); // ⌈k × 3 × n / 100⌉ senza virgola mobile
        expect({ n, rho: k / 100, soglia: unlockThreshold(island, k / 100) }).toEqual({ n, rho: k / 100, soglia: exact });
      }
    }
  });
});

describe('isole', () => {
  test('stelle dell\'isola e completamento (ultimo livello con almeno una stella)', () => {
    const p = withStars({ 1: 3, 2: 2, 3: 1 });
    expect([islandStars(p, A), isIslandCompleted(p, A)]).toEqual([6, false]);
    const done = withStars({ 1: 3, 2: 2, 3: 1, 4: 1 });
    expect([islandStars(done, A), isIslandCompleted(done, A)]).toEqual([7, true]);
    expect(isIslandCompleted(newProgress(), { id: 'vuota', levelIds: [], gift: 0 })).toBe(false);
  });

  test('la prima isola è sempre aperta; la successiva richiede isola completata E stelle sufficienti', () => {
    expect(isIslandUnlocked(newProgress(), islands, 0)).toBe(true);
    expect(isIslandUnlocked(newProgress(), islands, 1)).toBe(false);
    expect(isIslandUnlocked(withStars({ 1: 2, 2: 2, 3: 2, 4: 2 }), islands, 1)).toBe(true); // 8 stelle, completata
    expect(isIslandUnlocked(withStars({ 1: 2, 2: 2, 3: 2, 4: 1 }), islands, 1)).toBe(false); // 7 stelle: poche
    expect(isIslandUnlocked(withStars({ 1: 3, 2: 3, 3: 3 }), islands, 1)).toBe(false); // 9 stelle ma l'ultimo livello non è vinto
  });

  test('conta solo l\'isola precedente, non le stelle totali', () => {
    const p = withStars({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 1, 6: 1, 7: 1 }); // a: 12 stelle; b: 3 stelle su soglia 6
    expect(isIslandUnlocked(p, islands, 1)).toBe(true);
    expect(isIslandUnlocked(p, islands, 2)).toBe(false);
  });

  test('indici fuori dalle isole non sono aperti; ρ diverso sposta la soglia', () => {
    expect([isIslandUnlocked(newProgress(), islands, -1), isIslandUnlocked(newProgress(), islands, 3)]).toEqual([false, false]);
    const p = withStars({ 1: 1, 2: 1, 3: 1, 4: 1 }); // 4 stelle
    expect([isIslandUnlocked(p, islands, 1), isIslandUnlocked(p, islands, 1, 0.3)]).toEqual([false, true]); // soglia 8 contro ⌈3,6⌉ = 4
  });
});

describe('livelli', () => {
  test('il primo livello di un\'isola aperta è sbloccato; gli altri vincendo il precedente con una stella', () => {
    expect(isLevelUnlocked(newProgress(), islands, 1)).toBe(true);
    expect(isLevelUnlocked(newProgress(), islands, 2)).toBe(false);
    expect(isLevelUnlocked(withStars({ 1: 1 }), islands, 2)).toBe(true);
    expect(isLevelUnlocked(withStars({ 1: 1 }), islands, 3)).toBe(false);
  });

  test('nei livelli di un\'isola chiusa nulla è sbloccato, nemmeno il primo; un livello inesistente neppure', () => {
    expect(isLevelUnlocked(newProgress(), islands, 5)).toBe(false);
    expect(isLevelUnlocked(withStars({ 5: 3, 6: 3 }), islands, 6)).toBe(false);
    expect(isLevelUnlocked(newProgress(), islands, 99)).toBe(false);
    const open = withStars({ 1: 2, 2: 2, 3: 2, 4: 2 });
    expect([isLevelUnlocked(open, islands, 5), isLevelUnlocked(open, islands, 6)]).toEqual([true, false]);
  });
});

describe('recordWin', () => {
  test('prima vittoria: ✨ per le stelle, l\'oro e il bonus del profilo; salva stelle, oro, profilo e tempo', () => {
    const r = recordWin(newProgress(), win({ stars: 3, gold: 2, profile: 'hard', seconds: 100 }));
    expect(r.coins).toBe(3 + 2 + 2);
    expect(r.progress.coins).toBe(INITIAL_COINS + 7);
    expect(levelProgress(r.progress, 1)).toEqual({ stars: 3, bestSeconds: 100, gold: 2, profile: 'hard' });
  });

  test('una vittoria peggiore non toglie nulla e non dà ✨; una migliore dà solo la differenza', () => {
    const first = recordWin(newProgress(), win({ stars: 2, gold: 1, profile: 'medium', seconds: 100 })).progress;
    const worse = recordWin(first, win({ stars: 1, gold: 0, profile: 'easy', seconds: 150 }));
    expect([worse.coins, levelProgress(worse.progress, 1)]).toEqual([0, { stars: 2, bestSeconds: 100, gold: 1, profile: 'medium' }]);
    const better = recordWin(first, win({ stars: 3, gold: 3, profile: 'master', seconds: 80 }));
    expect(better.coins).toBe(1 + 2 + 4); // una stella in più, due tessere d'oro in più, bonus 5 − 1
    expect(levelProgress(better.progress, 1)).toEqual({ stars: 3, bestSeconds: 80, gold: 3, profile: 'master' });
  });

  test('il record di tempo si aggiorna solo se è più veloce, e mai con «senza pressione del tempo»', () => {
    const slow = recordWin(newProgress(), win({ seconds: 100 })).progress;
    expect(levelProgress(recordWin(slow, win({ seconds: 120 })).progress, 1).bestSeconds).toBe(100);
    expect(levelProgress(recordWin(slow, win({ seconds: 100 })).progress, 1).bestSeconds).toBe(100);
    expect(levelProgress(recordWin(slow, win({ seconds: 60, noTimePressure: true })).progress, 1).bestSeconds).toBe(100);
    expect(levelProgress(recordWin(newProgress(), win({ seconds: 60, noTimePressure: true })).progress, 1).bestSeconds).toBeNull();
    expect(levelProgress(recordWin(slow, win({ seconds: 60 })).progress, 1).bestSeconds).toBe(60);
  });

  test('il profilo più alto non scende; ogni livello ha i suoi progressi', () => {
    const hard = recordWin(newProgress(), win({ profile: 'hard' })).progress;
    expect(levelProgress(recordWin(hard, win({ profile: 'normal' })).progress, 1).profile).toBe('hard');
    const two = recordWin(hard, win({ levelId: 2, stars: 1 })).progress;
    expect([levelProgress(two, 1).stars, levelProgress(two, 2).stars]).toEqual([3, 1]);
  });

  test('non modifica i progressi ricevuti', () => {
    const before = newProgress();
    const snapshot = JSON.stringify(before);
    recordWin(before, win());
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('openGifts', () => {
  const finishedA = withStars({ 1: 2, 2: 2, 3: 2, 4: 2 });

  test('dà il regalo di un\'isola appena aperta, una volta sola', () => {
    const first = openGifts(finishedA, islands);
    expect([first.opened.map((i) => i.id), first.progress.coins, first.progress.giftsOpened]).toEqual([['b'], INITIAL_COINS + 5, ['b']]);
    const again = openGifts(first.progress, islands);
    expect([again.opened, again.progress]).toEqual([[], first.progress]);
  });

  test('le isole chiuse e quelle senza regalo non danno nulla', () => {
    expect(openGifts(newProgress(), islands)).toEqual({ progress: newProgress(), opened: [] }); // a ha regalo 0 ed è aperta
    expect(openGifts(withStars({ 1: 1 }), islands).opened).toEqual([]);
  });

  test('più isole aperte insieme danno tutti i loro regali', () => {
    const all = withStars({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 });
    const r = openGifts(all, islands);
    expect([r.opened.map((i) => i.id), r.progress.coins]).toEqual([['b', 'c'], INITIAL_COINS + 5 + 3]);
  });

  test('un\'isola già aperta resta tale anche se ρ cambia dopo', () => {
    const r = openGifts(withStars({ 1: 1, 2: 1, 3: 1, 4: 1 }), islands, 0.3);
    expect(r.opened.map((i) => i.id)).toEqual(['b']);
    expect(openGifts(r.progress, islands, 0.9).opened).toEqual([]);
  });

  test('non modifica i progressi ricevuti', () => {
    const snapshot = JSON.stringify(finishedA);
    openGifts(finishedA, islands);
    expect(JSON.stringify(finishedA)).toBe(snapshot);
  });
});
