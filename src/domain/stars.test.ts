import { originalCalcStars, originalCoinGain } from './__fixtures__/original';
import { PROFILES } from './profile';
import { coinsForWin, starsFor } from './stars';

describe('starsFor', () => {
  test('tempo: soglie a coppie × 5 × k e coppie × 10 × k (Normale, 10 coppie)', () => {
    const s = (seconds: number) => starsFor({ seconds, tiles: 20, aidsUsed: 0, profile: 'normal' });
    expect([s(0), s(50), s(51), s(100), s(101), s(9999)]).toEqual([3, 3, 2, 2, 1, 1]);
  });

  test('il fattore del profilo sposta le soglie: Facile ×1,5, Maestro ×0,6', () => {
    const at = (profile: 'easy' | 'master', seconds: number) => starsFor({ seconds, tiles: 20, aidsUsed: 0, profile });
    expect([at('easy', 75), at('easy', 76), at('easy', 150), at('easy', 151)]).toEqual([3, 2, 2, 1]);
    expect([at('master', 30), at('master', 31), at('master', 60), at('master', 61)]).toEqual([3, 2, 2, 1]);
  });

  test('aiuti: 3 stelle con 0-1, 2 con al più max(3, ⌈coppie/6⌉), altrimenti 1', () => {
    const a = (aidsUsed: number, tiles: number) => starsFor({ seconds: 0, tiles, aidsUsed, profile: 'normal' });
    expect([a(0, 20), a(1, 20), a(2, 20), a(3, 20), a(4, 20)]).toEqual([3, 3, 2, 2, 1]);
    expect([a(5, 60), a(6, 60)]).toEqual([2, 1]); // 30 coppie: ⌈30/6⌉ = 5
  });

  test('vale il minore tra tempo e aiuti; senza pressione del tempo il tempo dà sempre 3', () => {
    expect(starsFor({ seconds: 9999, tiles: 20, aidsUsed: 0, profile: 'normal' })).toBe(1);
    expect(starsFor({ seconds: 0, tiles: 20, aidsUsed: 9, profile: 'normal' })).toBe(1);
    expect(starsFor({ seconds: 80, tiles: 20, aidsUsed: 0, profile: 'normal' })).toBe(2);
    expect(starsFor({ seconds: 9999, tiles: 20, aidsUsed: 0, profile: 'normal', noTimePressure: true })).toBe(3);
    expect(starsFor({ seconds: 9999, tiles: 20, aidsUsed: 3, profile: 'normal', noTimePressure: true })).toBe(2);
  });

  test('coincide con calcStars dell\'originale su una griglia di tempi, tessere, aiuti e profili (Tris compresi)', () => {
    PROFILES.forEach((profile, d) => {
      for (const tiles of [16, 24, 45, 60, 96]) {
        for (const seconds of [0, 10, 40, 75, 76, 100, 150, 151, 300, 1000]) {
          for (const aidsUsed of [0, 1, 2, 3, 4, 5, 6, 9]) {
            for (const noTimePressure of [false, true]) {
              const got = starsFor({ seconds, tiles, aidsUsed, profile, noTimePressure });
              expect({ profile, tiles, seconds, aidsUsed, noTimePressure, got }).toEqual({ profile, tiles, seconds, aidsUsed, noTimePressure, got: originalCalcStars(seconds, tiles / 2, aidsUsed, d, noTimePressure) });
            }
          }
        }
      }
    });
  });
});

describe('coinsForWin', () => {
  const base = { stars: 3, previousStars: 0, gold: 0, previousGold: 0, profile: 'normal' as const };

  test('prima vittoria: una ✨ per stella; migliorare dà la differenza; peggiorare non toglie', () => {
    expect(coinsForWin(base)).toBe(3);
    expect(coinsForWin({ ...base, stars: 3, previousStars: 1 })).toBe(2);
    expect(coinsForWin({ ...base, stars: 1, previousStars: 3 })).toBe(0);
  });

  test('tessere d\'oro: solo quelle oltre il massimo precedente', () => {
    expect(coinsForWin({ ...base, gold: 4, previousGold: 2, previousStars: 3 })).toBe(2);
    expect(coinsForWin({ ...base, gold: 1, previousGold: 4, previousStars: 3 })).toBe(0);
  });

  test('bonus di profilo: la differenza con il più alto già battuto, mai negativa', () => {
    expect(coinsForWin({ ...base, previousStars: 3, profile: 'medium' })).toBe(1);
    expect(coinsForWin({ ...base, previousStars: 3, profile: 'master', previousProfile: 'medium' })).toBe(4);
    expect(coinsForWin({ ...base, previousStars: 3, profile: 'medium', previousProfile: 'master' })).toBe(0);
    expect(coinsForWin({ ...base, previousStars: 3, profile: 'hard', previousProfile: 'hard' })).toBe(0);
    expect(coinsForWin({ ...base, previousStars: 3, profile: 'easy', previousProfile: 'normal' })).toBe(0);
  });

  test('coincide con il calcolo di win() dell\'originale su una griglia di combinazioni', () => {
    const profiles = [undefined, ...PROFILES.map((_, i) => i)];
    PROFILES.forEach((profile, d) => {
      for (const stars of [1, 2, 3]) for (const previousStars of [0, 1, 2, 3]) {
        for (const gold of [0, 2, 5]) for (const previousGold of [0, 2, 6]) {
          for (const pd of profiles) {
            const got = coinsForWin({ stars, previousStars, gold, previousGold, profile, previousProfile: pd === undefined ? undefined : PROFILES[pd] });
            expect({ profile, stars, previousStars, gold, previousGold, pd, got }).toEqual({ profile, stars, previousStars, gold, previousGold, pd, got: originalCoinGain(stars, previousStars, gold, previousGold, d, pd) });
          }
        }
      }
    });
  });
});
