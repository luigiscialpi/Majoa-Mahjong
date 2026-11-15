import { renderHook, act } from '@testing-library/react-native';
import { createMemorySettingsStore } from '../application/settingsStore';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { getSoundService } from '../infrastructure/audio/soundService';
import { SettingsProvider, useSettings } from './SettingsProvider';

describe('SettingsProvider', () => {
  test('fornisce DEFAULT_SETTINGS in assenza di store', async () => {
    const { result } = await renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  test('carica le impostazioni iniziali dallo store', async () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      mascot: 'siamlong',
      sound: false,
      volume: 35,
    };
    const store = createMemorySettingsStore(custom);

    const { result } = await renderHook(() => useSettings(), {
      wrapper: ({ children }) => <SettingsProvider store={store}>{children}</SettingsProvider>,
    });

    await act(async () => {});

    expect(result.current.settings.mascot).toBe('siamlong');
    expect(result.current.settings.sound).toBe(false);
    expect(result.current.settings.volume).toBe(35);
  });

  test('updateSetting aggiorna lo stato, lo store e il SoundService', async () => {
    const store = createMemorySettingsStore();
    const service = getSoundService();

    const { result } = await renderHook(() => useSettings(), {
      wrapper: ({ children }) => <SettingsProvider store={store}>{children}</SettingsProvider>,
    });

    await act(async () => {
      await result.current.updateSetting('sound', false);
      await result.current.updateSetting('volume', 60);
      await result.current.updateSetting('vibration', false);
    });

    expect(result.current.settings.sound).toBe(false);
    expect(result.current.settings.volume).toBe(60);
    expect(result.current.settings.vibration).toBe(false);

    expect(service.isSoundEnabled()).toBe(false);
    expect(service.getVolume()).toBe(0.6);
    expect(service.isHapticsEnabled()).toBe(false);

    const stored = await store.loadSettings();
    expect(stored.sound).toBe(false);
    expect(stored.volume).toBe(60);
    expect(stored.vibration).toBe(false);
  });

  test('resetSettings ripristina i default', async () => {
    const store = createMemorySettingsStore({
      ...DEFAULT_SETTINGS,
      mascot: 'sheltie',
      volume: 10,
    });

    const { result } = await renderHook(() => useSettings(), {
      wrapper: ({ children }) => <SettingsProvider store={store}>{children}</SettingsProvider>,
    });

    await act(async () => {});
    expect(result.current.settings.mascot).toBe('sheltie');

    await act(async () => {
      await result.current.resetSettings();
    });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    const stored = await store.loadSettings();
    expect(stored).toEqual(DEFAULT_SETTINGS);
  });
});
