jest.mock('react-native-reanimated', () => ({
  useDerivedValue: (fn: any) => ({ value: fn() }),
}));

import { blockedDimOverlay, designBox } from './tile';

describe('tile rendering logic', () => {
  test('designBox calcola il riquadro centrato con aspect ratio 60x80', () => {
    const box = designBox(10, 20, 100, 120);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.width / box.height).toBeCloseTo(60 / 80, 2);
    expect(box.x).toBeGreaterThanOrEqual(10);
    expect(box.y).toBeGreaterThanOrEqual(20);
  });

  test('blockedDimOverlay restituisce lo scurimento graduato per profilo come da CSS originale', () => {
    // Facile, Normale, Medio: oscuramento pieno (~40%)
    expect(blockedDimOverlay('easy')).toBe('rgba(0,0,0,0.40)');
    expect(blockedDimOverlay('normal')).toBe('rgba(0,0,0,0.40)');
    expect(blockedDimOverlay('medium')).toBe('rgba(0,0,0,0.40)');

    // Difficile (nodim): oscuramento medio (~28%)
    expect(blockedDimOverlay('hard')).toBe('rgba(0,0,0,0.28)');

    // Esperto (nodim2): oscuramento leggero (~15%)
    expect(blockedDimOverlay('expert')).toBe('rgba(0,0,0,0.15)');

    // Maestro (nodim3): nessun oscuramento, tessere indistinguibili
    expect(blockedDimOverlay('master')).toBeNull();
  });
});
