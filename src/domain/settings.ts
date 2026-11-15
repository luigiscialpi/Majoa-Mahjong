import { isMascot, type Mascot } from './mascot';
import { PROFILES, type Profile } from './profile';

/**
 * Impostazioni dell'app (reference/majoa-originale/Majoa Mahjong.html, riga 1362: SDEF).
 * Modello puro del dominio, immutabile, senza effetti collaterali.
 */
export type Settings = {
  /** Mascotte scelta per la combo e le finestre ('collie', 'sheltie', 'siamshort', 'siamlong', 'none'). */
  mascot: Mascot;
  /** Effetti sonori attivi o mutati. */
  sound: boolean;
  /** Volume dei suoni (0..100). */
  volume: number;
  /** Vibrazione aptica attiva. */
  vibration: boolean;
  /** Effetti speciali: scintille, combo animate e tessere d'oro brillanti. */
  effects: boolean;
  /** Modalità comoda (senior): tessere più grandi, nessun limite di tempo, aiuti illimitati. */
  comfort: boolean;
  /** Difficoltà/profilo predefinito per le nuove partite. */
  defaultProfile: Profile;
  /** Illumina tessere libere uguali a quella selezionata con spunta verde. */
  highlightEqual: boolean;
  /** Aiuto automatico dopo 120 secondi di inattività. */
  autoHint: boolean;
  /** Testi e pulsanti ingranditi. */
  bigUi: boolean;
  /** Contrasto alto: tessere bianche e contorni marcati. */
  highContrast: boolean;
  /** Colori sicuri per il daltonismo (blu/arancio). */
  colorBlind: boolean;
  /** Senza pressione del tempo: cronometro nascosto e stelle slegate dal tempo. */
  noTimeLimit: boolean;
  /** Mostra la barra delle tessere selezionate in fondo. */
  selectedBar: boolean;
};

/** Valori predefiniti delle impostazioni (fedeli a SDEF dell'originale). */
export const DEFAULT_SETTINGS: Settings = {
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
};

/**
 * Valida un oggetto parziale o sconosciuto e restituisce impostazioni complete e sicure.
 * I valori assenti o fuori intervallo ripiegano sui predefiniti.
 */
export function validateSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = input as Record<string, unknown>;

  const mascot = isMascot(raw.mascot) ? raw.mascot : DEFAULT_SETTINGS.mascot;
  const sound = typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound;
  const rawVol = typeof raw.volume === 'number' ? raw.volume : Number(raw.volume);
  const volume = Number.isFinite(rawVol) ? Math.max(0, Math.min(100, Math.round(rawVol))) : DEFAULT_SETTINGS.volume;
  const vibration = typeof raw.vibration === 'boolean' ? raw.vibration : DEFAULT_SETTINGS.vibration;
  const effects = typeof raw.effects === 'boolean' ? raw.effects : DEFAULT_SETTINGS.effects;
  const comfort = typeof raw.comfort === 'boolean' ? raw.comfort : DEFAULT_SETTINGS.comfort;
  const defaultProfile = typeof raw.defaultProfile === 'string' && (PROFILES as readonly string[]).includes(raw.defaultProfile)
    ? (raw.defaultProfile as Profile)
    : DEFAULT_SETTINGS.defaultProfile;
  const highlightEqual = typeof raw.highlightEqual === 'boolean' ? raw.highlightEqual : DEFAULT_SETTINGS.highlightEqual;
  const autoHint = typeof raw.autoHint === 'boolean' ? raw.autoHint : DEFAULT_SETTINGS.autoHint;
  const bigUi = typeof raw.bigUi === 'boolean' ? raw.bigUi : DEFAULT_SETTINGS.bigUi;
  const highContrast = typeof raw.highContrast === 'boolean' ? raw.highContrast : DEFAULT_SETTINGS.highContrast;
  const colorBlind = typeof raw.colorBlind === 'boolean' ? raw.colorBlind : DEFAULT_SETTINGS.colorBlind;
  const noTimeLimit = typeof raw.noTimeLimit === 'boolean' ? raw.noTimeLimit : DEFAULT_SETTINGS.noTimeLimit;
  const selectedBar = typeof raw.selectedBar === 'boolean' ? raw.selectedBar : DEFAULT_SETTINGS.selectedBar;

  return {
    mascot,
    sound,
    volume,
    vibration,
    effects,
    comfort,
    defaultProfile,
    highlightEqual,
    autoHint,
    bigUi,
    highContrast,
    colorBlind,
    noTimeLimit,
    selectedBar,
  };
}

/** Deserializza una stringa JSON in impostazioni sicure. Se la stringa è corrotta ripiega sui predefiniti. */
export function parseSettings(json: string | null | undefined): Settings {
  if (!json) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(json);
    return validateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Serializza le impostazioni in JSON. */
export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

/**
 * Calcola le impostazioni effettive applicate al gameplay.
 * Quando `comfort` è attivo:
 * - disabilita il cronometro (`noTimeLimit: true`);
 * - attiva testi e pulsanti ingranditi (`bigUi: true`);
 * - attiva l'aiuto automatico dopo inattività (`autoHint: true`);
 * - NON forza `highlightEqual` (resta opzione indipendente a discrezione dell'utente).
 */
export function effectiveSettings(settings: Settings): Settings {
  if (!settings.comfort) {
    return settings;
  }
  return {
    ...settings,
    noTimeLimit: true,
    bigUi: true,
    autoHint: true,
  };
}
