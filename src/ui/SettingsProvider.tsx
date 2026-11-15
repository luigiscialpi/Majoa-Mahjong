import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SettingsStore } from '../application/settingsStore';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { getSoundService } from '../infrastructure/audio/soundService';

export type SettingsContextValue = {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  resetSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Fallback sicuro se usato fuori da SettingsProvider (es. test isolati)
    return {
      settings: DEFAULT_SETTINGS,
      updateSetting: async () => {},
      resetSettings: async () => {},
    };
  }
  return ctx;
}

export type SettingsProviderProps = {
  children: ReactNode;
  store?: SettingsStore;
  open?: () => Promise<SettingsStore>;
  initial?: Settings;
};

/**
 * Fornisce le impostazioni dell'app all'albero dei componenti React e le sincronizza
 * con l'archivio persistente e i servizi audio/aptici di sistema.
 */
export function SettingsProvider({ children, store: propStore, open, initial }: SettingsProviderProps) {
  const [store, setStore] = useState<SettingsStore | null>(propStore ?? null);
  const [settings, setSettings] = useState<Settings>(initial ?? DEFAULT_SETTINGS);

  useEffect(() => {
    if (propStore) {
      setStore(propStore);
      return;
    }
    if (open) {
      let cancelled = false;
      open().then((s) => {
        if (!cancelled) setStore(s);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [propStore, open]);

  // Caricamento iniziale dall'archivio
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    store.loadSettings().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Sincronizzazione con il servizio audio e vibrazione di sistema
  useEffect(() => {
    const soundService = getSoundService();
    soundService.setSoundEnabled(settings.sound);
    soundService.setVolume(settings.volume / 100);
    soundService.setHapticsEnabled(settings.vibration);
  }, [settings.sound, settings.volume, settings.vibration]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      const next = { ...settingsRef.current, [key]: value };
      settingsRef.current = next;
      setSettings(next);
      if (store) {
        await store.saveSettings(next);
      }
    },
    [store],
  );

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    if (store) {
      await store.resetSettings();
    }
  }, [store]);

  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      resetSettings,
    }),
    [settings, updateSetting, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
