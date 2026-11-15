import { DEFAULT_MASCOT, MASCOT_IDS, isMascot } from './mascot';

describe('mascotte', () => {
  test('quattro mascotte nell\'ordine dell\'originale; la predefinita è Collie', () => {
    expect(MASCOT_IDS).toEqual(['collie', 'sheltie', 'siamshort', 'siamlong']);
    expect(DEFAULT_MASCOT).toBe('collie');
  });

  test('isMascot accetta le quattro mascotte e «nessuna», nient\'altro', () => {
    for (const valid of [...MASCOT_IDS, 'none']) expect(isMascot(valid)).toBe(true);
    for (const invalid of ['', 'Collie', 'cat', 'none ', null, undefined, 0, {}]) expect(isMascot(invalid)).toBe(false);
  });
});
