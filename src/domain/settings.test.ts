import { DEFAULT_SETTINGS, contrastOf, effectiveSettings, parseSettings, serializeSettings, validateSettings, type Settings } from './settings';

describe('impostazioni (dominio)', () => {
  test('DEFAULT_SETTINGS ha i valori predefiniti dell\'originale, tranne l\'evidenzia-uguali che è acceso di base', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      mascot: 'collie',
      sound: true,
      volume: 100,
      vibration: true,
      effects: true,
      comfort: false,
      defaultProfile: 'normal',
      highlightEqual: true,
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

  describe('contrastOf', () => {
    const of = (colorBlind: boolean, highContrast: boolean) => contrastOf({ ...DEFAULT_SETTINGS, colorBlind, highContrast });

    test('di base nessun segnale e nessun alto contrasto', () => {
      expect(of(false, false)).toEqual({ signals: false, high: false });
    });
    test('il daltonismo dà i segnali, ma non cambia i colori dell\'alto contrasto', () => {
      expect(of(true, false)).toEqual({ signals: true, high: false });
    });
    test('l\'alto contrasto porta con sé i segnali del daltonismo (`cb` = `S.cb||S.hc`)', () => {
      expect(of(false, true)).toEqual({ signals: true, high: true });
      expect(of(true, true)).toEqual({ signals: true, high: true });
    });
    test('la Modalità comoda non li accende', () => {
      expect(contrastOf(effectiveSettings({ ...DEFAULT_SETTINGS, comfort: true }))).toEqual({ signals: false, high: false });
    });
  });

  describe('evidenzia-uguali acceso di base', () => {
    const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
    const html = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');

    test('è una scelta diversa dall\'originale, che lo ha spento (`SDEF`: `eq:0`)', () => {
      expect(/var SDEF=\{[^}]*\beq:0\b/.test(html)).toBe(true);
      expect(DEFAULT_SETTINGS.highlightEqual).toBe(true);
    });

    test('un valore mancante o non valido ripiega su «acceso»; uno salvato si rispetta, anche se spento', () => {
      expect(validateSettings({}).highlightEqual).toBe(true);
      expect(validateSettings({ highlightEqual: 'no' }).highlightEqual).toBe(true);
      expect(validateSettings({ highlightEqual: false }).highlightEqual).toBe(false);
      expect(validateSettings({ highlightEqual: true }).highlightEqual).toBe(true);
      expect(parseSettings(serializeSettings({ ...DEFAULT_SETTINGS, highlightEqual: false })).highlightEqual).toBe(false);
    });

    test('la Modalità comoda non lo cambia, né da acceso né da spento', () => {
      expect(effectiveSettings({ ...DEFAULT_SETTINGS, comfort: true }).highlightEqual).toBe(true);
      expect(effectiveSettings({ ...DEFAULT_SETTINGS, comfort: true, highlightEqual: false }).highlightEqual).toBe(false);
    });
  });
});
