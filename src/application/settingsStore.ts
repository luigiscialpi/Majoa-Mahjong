import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';

/**
 * Porta di persistenza per le impostazioni utente.
 */
export interface SettingsStore {
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  resetSettings(): Promise<Settings>;
}

/**
 * Archivio impostazioni in memoria per test e ambienti headless.
 */
export function createMemorySettingsStore(initial?: Settings): SettingsStore {
  let current: Settings = initial ? { ...initial } : { ...DEFAULT_SETTINGS };

  return {
    async loadSettings() {
      return { ...current };
    },
    async saveSettings(settings) {
      current = { ...settings };
    },
    async resetSettings() {
      current = { ...DEFAULT_SETTINGS };
      return { ...current };
    },
  };
}
