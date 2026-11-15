import { DEFAULT_SETTINGS, effectiveSettings, parseSettings, serializeSettings, validateSettings, type Settings } from './settings';

describe('impostazioni (dominio)', () => {
  test('DEFAULT_SETTINGS ha valori predefiniti fedeli all\'originale', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      mascot: 'collie',
      sound: true,
      volume: 100,
      vibration: true,
      effects: true,
      comfort: false,
      defaultProfile: 'normal',
      highlightEqual: false,
      autoHint: false,
      bigUi: false,
      highContrast: false,
      colorBlind: false,
      noTimeLimit: false,
      selectedBar: false,
      bgPalette: 'level',
      tilePalette: 'level',
    });
  });

  test('validateSettings accetta impostazioni valide', () => {
    const custom: Settings = {
      mascot: 'sheltie',
      sound: false,
      volume: 45,
      vibration: false,
      effects: false,
      comfort: true,
      defaultProfile: 'expert',
      highlightEqual: true,
      autoHint: true,
      bigUi: true,
      highContrast: true,
      colorBlind: true,
      noTimeLimit: true,
      selectedBar: true,
      bgPalette: 'ocean',
      tilePalette: 'pink',
    };
    expect(validateSettings(custom)).toEqual(custom);
  });

  test('validateSettings ripiega sui default per valori non validi o mancanti', () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings('not an object')).toEqual(DEFAULT_SETTINGS);

    const bad = {
      mascot: 'drago_alato',
      volume: 999,
      defaultProfile: 'impossibile',
      sound: 'no',
      bgPalette: 'arcobaleno',
      tilePalette: 'invisibile',
    };
    const validated = validateSettings(bad);
    expect(validated.mascot).toBe('collie');
    expect(validated.volume).toBe(100);
    expect(validated.defaultProfile).toBe('normal');
    expect(validated.sound).toBe(true);
    expect(validated.bgPalette).toBe('level');
    expect(validated.tilePalette).toBe('level');
  });

  test('validateSettings limita il volume tra 0 e 100', () => {
    expect(validateSettings({ volume: -50 }).volume).toBe(0);
    expect(validateSettings({ volume: 150 }).volume).toBe(100);
    expect(validateSettings({ volume: 55.4 }).volume).toBe(55);
  });

  test('parseSettings e serializeSettings mantengono i dati (roundtrip)', () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      mascot: 'siamshort',
      volume: 75,
      sound: false,
    };
    const json = serializeSettings(custom);
    expect(parseSettings(json)).toEqual(custom);
  });

  test('parseSettings ripiega su DEFAULT_SETTINGS se il JSON è corrotto o nullo', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{ json corrotto')).toEqual(DEFAULT_SETTINGS);
  });

  describe('effectiveSettings', () => {
    test('con comfort=false restituisce le impostazioni inalterate', () => {
      const s: Settings = { ...DEFAULT_SETTINGS, comfort: false, highlightEqual: false };
      expect(effectiveSettings(s)).toBe(s);
    });

    test('con comfort=true attiva noTimeLimit, bigUi e autoHint ma NON highlightEqual', () => {
      const s: Settings = { ...DEFAULT_SETTINGS, comfort: true, highlightEqual: false, noTimeLimit: false };
      const eff = effectiveSettings(s);
      expect(eff.noTimeLimit).toBe(true);
      expect(eff.bigUi).toBe(true);
      expect(eff.autoHint).toBe(true);
      expect(eff.highlightEqual).toBe(false); // non forzato
    });

    test('con comfort=true e highlightEqual=true mantiene highlightEqual=true', () => {
      const s: Settings = { ...DEFAULT_SETTINGS, comfort: true, highlightEqual: true };
      const eff = effectiveSettings(s);
      expect(eff.highlightEqual).toBe(true);
    });
  });
});
