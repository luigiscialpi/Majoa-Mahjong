import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Profile } from '../domain/profile';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { newProgress, type Progress } from '../domain/progress';
import { legacyIslands, trisLevelIds } from '../infrastructure/content/legacyIslands';
import { createMemorySettingsStore } from '../application/settingsStore';
import { LevelPicker, REASON_MS } from './LevelPicker';
import { SettingsProvider } from './SettingsProvider';
import { LanguageProvider, type Language } from '../infrastructure/i18n';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

async function renderPicker(onPlay: (level: number, profile: Profile) => void = () => {}, progress: Progress = newProgress(), lang: Language = 'it', settings?: Settings) {
  const store = createMemorySettingsStore(settings);
  const view = await render(
    <LanguageProvider initial={lang}>
      <SettingsProvider store={store} initial={settings}>
        <LevelPicker progress={progress} islands={legacyIslands} onPlay={onPlay} />
      </SettingsProvider>
    </LanguageProvider>,
  );
  return Object.assign(view, { store });
}

const press = async (testID: string) => {
  await fireEvent.press(screen.getByTestId(testID));
};

const toggle = async (value: boolean) => {
  await fireEvent(screen.getByTestId('prova-switch'), 'valueChange', value);
};

async function visitIsland(id: string) {
  if (!screen.queryByTestId('island-map-list')) await press('btn-back-islands');
  await press('island-' + id);
}

async function visitLevel(level: number) {
  const island = legacyIslands.find((candidate) => candidate.levelIds.includes(level));
  await visitIsland(island?.id ?? 'tris');
}

async function pressLevel(level: number) {
  await visitLevel(level);
  await press('level-' + level);
}

function extractTexts(node: unknown): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(extractTexts);
  if (typeof node === 'object' && 'children' in (node as Record<string, unknown>)) {
    return extractTexts((node as { children: unknown }).children);
  }
  return [];
}
const texts = (): string => extractTexts(screen.toJSON()).join('|');
const label = (level: number): string => screen.getByTestId('level-' + level).props.accessibilityLabel;
const islandText = (id: string): string => extractTexts(screen.getByTestId('island-' + id)).join('');
const withStars = (byLevel: Record<number, number>): Progress => ({
  ...newProgress(),
  levels: Object.fromEntries(Object.entries(byLevel).map(([id, stars]) => [id, { stars, bestSeconds: null, gold: 0, profile: null }])),
});

test('la mappa mostra le isole disponibili e apre i livelli dell’isola scelta', async () => {
  const calls: [number, Profile][] = [];
  await renderPicker((level, profile) => calls.push([level, profile]));
  expect(screen.getByTestId('island-map-list')).toBeTruthy();
  await pressLevel(1);
  expect(calls).toEqual([[1, 'normal']]);
  expect(screen.getByTestId('btn-back-islands')).toBeTruthy();
});

test('la mappa con progressione mostra solo isole aperte e la prossima chiusa', async () => {
  await renderPicker();
  await toggle(false);
  expect(screen.getByTestId('island-prologue')).toBeTruthy();
  expect(islandText('animals')).toContain('Servono 40 ★ per aprire Animali');
  expect(screen.queryByTestId('island-sweets')).toBeNull();
  expect(screen.queryByTestId('island-tris')).toBeNull();
});

test('la soglia apre l’isola successiva solo dopo aver vinto l’ultima dell’isola', async () => {
  const atThreshold = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, { stars: 2, bestSeconds: null, gold: 0, profile: null }])) as Progress['levels'];
  await renderPicker(() => {}, { ...newProgress(), levels: atThreshold });
  await toggle(false);
  expect(screen.getByTestId('island-animals')).toBeTruthy();
  expect(islandText('sweets')).toContain('Servono 40 ★ per aprire Dolci');
});

test('con le stelle ma senza aver completato l’isola indica l’ultimo livello da vincere', async () => {
  const unfinished = Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, { stars: 3, bestSeconds: null, gold: 0, profile: null }])) as Progress['levels'];
  await renderPicker(() => {}, { ...newProgress(), levels: unfinished });
  await toggle(false);
  expect(islandText('animals')).toContain('Vinci il livello 20 per aprire Animali');
});

test('il profilo scelto si applica ai livelli avviati', async () => {
  const calls: [number, Profile][] = [];
  await renderPicker((level, profile) => calls.push([level, profile]));
  await visitIsland('prologue');
  await press('profile-master');
  await press('level-7');
  await press('profile-easy');
  await press('level-3');
  expect(calls).toEqual([[7, 'master'], [3, 'easy']]);
});

describe('profilo: è l\'impostazione «Difficoltà»', () => {
  const chipOn = () => (['easy', 'normal', 'medium', 'hard', 'expert', 'master'] as const).filter((p) => screen.getByTestId('profile-' + p).props.accessibilityState.selected);

  test('parte dal profilo delle impostazioni (non sempre da Normale) e lo applica ai livelli', async () => {
    const calls: [number, Profile][] = [];
    await renderPicker((level, profile) => calls.push([level, profile]), newProgress(), 'it', { ...DEFAULT_SETTINGS, defaultProfile: 'expert' });
    await visitIsland('prologue'); // i profili si vedono dentro un'isola
    expect(chipOn()).toEqual(['expert']);
    await press('level-2');
    expect(calls).toEqual([[2, 'expert']]);
  });

  test('di base è Normale', async () => {
    await renderPicker();
    await visitIsland('prologue');
    expect(chipOn()).toEqual(['normal']);
  });

  test('scegliere un profilo qui lo salva nelle impostazioni, e vale anche alla riapertura', async () => {
    const { store } = await renderPicker();
    await visitIsland('prologue');
    await press('profile-hard');
    expect(chipOn()).toEqual(['hard']);
    expect((await store.loadSettings()).defaultProfile).toBe('hard');
  });
});

describe('modalità prova', () => {
  test('è accesa all’inizio e rende accessibili anche isole e Tris', async () => {
    await renderPicker();
    expect(texts()).toContain('Mappa delle isole');
    expect(screen.getByTestId('prova-switch').props.value).toBe(true);
    expect(screen.getByTestId('island-flowers')).toBeTruthy();
    expect(screen.getByTestId('island-tris')).toBeTruthy();
    await pressLevel(95);
    expect(label(95)).toBe('Livello 5 (Tris), 0 stelle su 3');
  });

  test('spenta, i livelli consecutivi restano bloccati finché non si vince il precedente', async () => {
    await renderPicker();
    await visitIsland('prologue');
    await toggle(false);
    await press('level-1');
    expect(label(2)).toBe('Livello 2, bloccato. Vinci il livello 1 per aprire questo');
  });

  test('riaccendendola si può aprire ogni isola e livello della campagna', async () => {
    await renderPicker();
    await toggle(false);
    await toggle(true);
    await press('island-flowers');
    await press('level-90');
    expect(screen.getByTestId('level-90')).toBeTruthy();
  });
});

describe('progressi e accessibilità', () => {
  test('mostra le stelle per isola e livello', async () => {
    await renderPicker(() => {}, withStars({ 1: 3, 2: 0 }));
    expect(islandText('prologue')).toContain('3 / 60 stelle');
    await visitIsland('prologue');
    await toggle(false);
    expect(label(1)).toBe('Livello 1, 3 stelle su 3');
    expect(label(3)).toBe('Livello 3, bloccato. Vinci il livello 2 per aprire questo');
  });

  test('i Tris restano fuori dalla campagna e si provano solo in modalità prova', async () => {
    const tris = trisLevelIds[0];
    await renderPicker();
    await visitIsland('tris');
    await toggle(false);
    expect(label(tris)).toContain('bloccato. Si sbloccano più avanti');
  });

  test('il motivo di blocco si aggiorna e sparisce dopo REASON_MS', async () => {
    jest.useFakeTimers();
    try {
      await renderPicker();
      await visitIsland('prologue');
      await toggle(false);
      await press('level-2');
      expect(texts()).toContain('Vinci il livello 1 per aprire questo');
      await act(async () => { jest.advanceTimersByTime(REASON_MS); });
      expect(screen.queryByTestId('level-reason')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('i controlli principali rispettano 48 dp', async () => {
    await renderPicker();
    for (const id of ['prova-row', 'lang-it', 'btn-settings']) {
      const node = screen.queryByTestId(id);
      if (node) {
        const style = StyleSheet.flatten(node.props.style);
        expect(Math.max(style?.minHeight ?? 0, style?.height ?? 0)).toBeGreaterThanOrEqual(48);
      }
    }
  });
});

describe('cambio lingua al volo', () => {
  test('la mappa e i suoi controlli seguono la lingua selezionata', async () => {
    await renderPicker(() => {}, newProgress(), 'en');
    expect(texts()).toContain('Island map');
    await press('lang-fr');
    expect(texts()).toContain('Carte des îles');
    await press('lang-it');
    expect(texts()).toContain('Mappa delle isole');
  });

  test('il pulsante impostazioni chiama onOpenSettings se fornito', async () => {
    const onOpenSettings = jest.fn();
    await render(
      <LanguageProvider initial="it">
        <LevelPicker progress={newProgress()} islands={legacyIslands} onPlay={() => {}} onOpenSettings={onOpenSettings} />
      </LanguageProvider>,
    );
    await press('btn-settings');
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
