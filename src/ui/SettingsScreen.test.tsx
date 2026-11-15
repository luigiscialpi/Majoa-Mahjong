import { render, fireEvent, screen, cleanup, act } from '@testing-library/react-native';
import { createMemorySettingsStore } from '../application/settingsStore';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { LanguageProvider } from '../infrastructure/i18n';
import { SettingsProvider } from './SettingsProvider';
import { SettingsScreen } from './SettingsScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

afterEach(async () => {
  cleanup();
});

async function renderSettings(initialSettings?: Settings, onBack = jest.fn()) {
  const store = createMemorySettingsStore(initialSettings);
  await render(
    <LanguageProvider initial="it">
      <SettingsProvider store={store} initial={initialSettings}>
        <SettingsScreen onBack={onBack} />
      </SettingsProvider>
    </LanguageProvider>,
  );
  return {
    onBack,
    store,
  };
}

describe('SettingsScreen', () => {
  test('mostra tutte le sezioni di impostazione con i loro titoli', async () => {
    await renderSettings();

    expect(screen.getByText('Impostazioni')).toBeTruthy();
    expect(screen.getByText('Mascotte')).toBeTruthy();
    expect(screen.getByText('Suoni e vibrazione')).toBeTruthy();
    expect(screen.getByText('Aiuti di gioco')).toBeTruthy();
    expect(screen.getByText('Comfort e accessibilità')).toBeTruthy();
    expect(screen.getByText('Lingua')).toBeTruthy();
    expect(screen.getByText('Ripristina predefiniti')).toBeTruthy();
  });

  test('il pulsante Indietro chiama onBack', async () => {
    const onBack = jest.fn();
    await renderSettings(DEFAULT_SETTINGS, onBack);

    const backBtn = screen.getByTestId('btn-settings-back');
    await fireEvent.press(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('permette di selezionare una mascotte diversa', async () => {
    const { store } = await renderSettings();

    const sheltieBtn = screen.getByTestId('mascot-sheltie');
    await fireEvent.press(sheltieBtn);

    const saved = await store.loadSettings();
    expect(saved.mascot).toBe('sheltie');
  });

  test('permette di attivare/disattivare suoni e vibrazione', async () => {
    const { store } = await renderSettings();

    const soundSwitch = screen.getByTestId('switch-sound');
    await fireEvent(soundSwitch, 'valueChange', false);

    const vibSwitch = screen.getByTestId('switch-vib');
    await fireEvent(vibSwitch, 'valueChange', false);

    const saved = await store.loadSettings();
    expect(saved.sound).toBe(false);
    expect(saved.vibration).toBe(false);
  });

  test('permette di cambiare il volume', async () => {
    const { store } = await renderSettings();

    const vol50 = screen.getByTestId('volume-50');
    await fireEvent.press(vol50);

    const saved = await store.loadSettings();
    expect(saved.volume).toBe(50);
  });

  test('permette di cambiare la lingua', async () => {
    await renderSettings();

    const enBtn = screen.getByTestId('lang-btn-en');
    await fireEvent.press(enBtn);

    expect(screen.getByText('Settings')).toBeTruthy();
  });

  test('il tasto Ripristina predefiniti resetta le impostazioni modificate', async () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      mascot: 'siamlong',
      sound: false,
      volume: 25,
      comfort: true,
    };
    const { store } = await renderSettings(custom);

    const resetBtn = screen.getByTestId('btn-reset-settings');
    await fireEvent.press(resetBtn);

    const saved = await store.loadSettings();
    expect(saved).toEqual(DEFAULT_SETTINGS);
  });
});
