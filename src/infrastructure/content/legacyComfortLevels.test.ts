import { comfortCellsForLevel, COMFORT_LEVEL_COUNT } from './legacyComfortLevels';

describe('legacyComfortLevels', () => {
  const EXPECTED_COUNTS = [
    16, 20, 20, 30, 38, 42, 48, 54, 60, 62,
    38, 42, 48, 54, 60, 56, 60, 62, 66, 72,
  ];

  test('ha esattamente 20 livelli comodi configurati', () => {
    expect(COMFORT_LEVEL_COUNT).toBe(20);
  });

  test('tutti i 20 livelli hanno il conteggio di tessere esatto conforme alla documentazione', () => {
    for (let i = 1; i <= 20; i++) {
      const cells = comfortCellsForLevel(i);
      expect(cells).toBeDefined();
      expect(cells!.length).toBe(EXPECTED_COUNTS[i - 1]);
    }
  });

  test('nessun livello comodo supera le 5 colonne o le 6 righe', () => {
    for (let i = 1; i <= 20; i++) {
      const cells = comfortCellsForLevel(i)!;
      for (const cell of cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(5); // max 5 colonne (0..4)
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(6); // max 6 righe (0..5)
        expect(cell.z).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('restituisce undefined per livelli fuori dai primi 20', () => {
    expect(comfortCellsForLevel(0)).toBeUndefined();
    expect(comfortCellsForLevel(21)).toBeUndefined();
    expect(comfortCellsForLevel(100)).toBeUndefined();
  });
});
