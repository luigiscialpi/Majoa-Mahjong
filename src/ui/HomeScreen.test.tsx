import { Modal } from 'react-native';
import { playRandomSession } from '../application/__fixtures__/play';
import { loadHome } from '../application/saveFlow';
import { serializeSavedGame, toSavedGame, type SavedGame } from '../application/savedGame';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { startSession } from '../application/session';
import type { Profile } from '../domain/profile';
import { newProgress, recordWin } from '../domain/progress';
import { serializeProgress } from '../application/progressCodec';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { HomeScreen } from './HomeScreen';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// react-test-renderer non ha tipi nel progetto: `requireActual` lo restituisce come `any`.
const { act, create } = jest.requireActual('react-test-renderer');
const originalError = console.error;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  console.error = (...args: unknown[]) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

const mounted: any[] = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.unmount()));
});

/** Partita a metà del livello 1 salvata come livello 20, profilo Difficile, 4:12. */
function savedGame(over: Partial<SavedGame> = {}): SavedGame {
  const started = startSession({ spec: toSpec(legacyLevels[0]), profile: 'hard', seed: 7 });
  if (!started.ok) throw new Error('avvio');
  const session = { ...playRandomSession(started.value, 7, 3), seconds: 252 };
  return { ...toSavedGame(session, 20), ...over };
}
const storeWith = (game?: SavedGame, progress?: string) => createMemorySaveStore({ game: game ? serializeSavedGame(game) : undefined, progress });

async function mount(store: SaveStore, extra: Partial<Parameters<typeof HomeScreen>[0]> = {}) {
  const home = await loadHome(store);
  const calls = { onPlay: jest.fn(), onResume: jest.fn(), onReload: jest.fn(async () => {}) };
  let renderer: any;
  await act(async () => {
    renderer = create(<HomeScreen home={home} store={store} {...calls} {...extra} />);
  });
  mounted.push(renderer);
  return { renderer, ...calls, home };
}
const flush = () => act(async () => {});
const press = async (renderer: any, testID: string) => {
  await act(async () => {
    renderer.root.findAllByProps({ testID })[0].props.onPress();
  });
};
const has = (renderer: any, testID: string) => renderer.root.findAllByProps({ testID }).length > 0;
const texts = (renderer: any): string => renderer.root.findAll((n: any) => n.type === 'Text').map((n: any) => [n.props.children].flat(Infinity).join('')).join('|');
const isDisabled = (renderer: any, testID: string): boolean => renderer.root.findAllByProps({ testID }).find((n: any) => n.props.accessibilityState).props.accessibilityState.disabled;
const savedOf = async (store: SaveStore) => {
  const loaded = await store.loadGame();
  return loaded.ok ? loaded.value : 'illeggibile';
};

describe('senza partita salvata', () => {
  test('mostra il selettore, senza scheda «Continua» né avvisi, e un livello parte subito', async () => {
    const { renderer, onPlay } = await mount(storeWith());
    expect(texts(renderer)).toContain('Majoa Mahjong');
    expect(has(renderer, 'continue-card')).toBe(false);
    expect(has(renderer, 'broken-notice')).toBe(false);
    await press(renderer, 'profile-master');
    await press(renderer, 'level-3');
    expect(onPlay).toHaveBeenCalledWith(3, 'master');
    expect(has(renderer, 'replace-dialog')).toBe(false);
  });

  test('i progressi si vedono nel selettore', async () => {
    const progress = recordWin(newProgress(), { levelId: 1, stars: 3, seconds: 50, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    const { renderer } = await mount(storeWith(undefined, serializeProgress(progress)));
    expect(texts(renderer)).toContain('★★★');
  });
});

describe('scheda «Continua»', () => {
  test('in cima: livello, profilo, tempo e tessere rimaste; un tocco riprende', async () => {
    const saved = savedGame();
    const { renderer, onResume, onPlay, home } = await mount(storeWith(saved));
    if (home.resume.kind !== 'ready') throw new Error('atteso ready');
    const t = texts(renderer);
    expect(t).toContain('Continua');
    expect(t).toContain('Livello 20');
    expect(t).toContain(`Difficile · 4:12 · ${home.resume.info.remaining} tessere`);
    expect(renderer.root.findAllByProps({ testID: 'continue-card' }).find((n: any) => n.props.accessibilityLabel).props.accessibilityLabel).toBe(`Continua: livello 20, Difficile, 4:12, ${home.resume.info.remaining} tessere`);
    await press(renderer, 'continue-card');
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });
});

describe('conferma prima di sostituire', () => {
  test('avviare un livello con una partita salvata chiede conferma e dice cosa si perde', async () => {
    const { renderer, onPlay } = await mount(storeWith(savedGame()));
    await press(renderer, 'level-5');
    expect(has(renderer, 'replace-dialog')).toBe(true);
    const t = texts(renderer);
    expect(t).toContain('Hai una partita in corso');
    expect(t).toContain('La partita del livello 20 (Difficile, 4:12) andrà persa.');
    expect(t).toContain('Continua quella');
    expect(t).toContain('Sostituisci');
    expect(onPlay).not.toHaveBeenCalled();
  });

  test('anche per lo stesso livello e profilo della partita salvata', async () => {
    const { renderer } = await mount(storeWith(savedGame()));
    await press(renderer, 'profile-hard');
    await press(renderer, 'level-20');
    expect(has(renderer, 'replace-dialog')).toBe(true);
  });

  test('«Continua quella» riprende la salvata e non la tocca', async () => {
    const store = storeWith(savedGame());
    const { renderer, onPlay, onResume } = await mount(store);
    await press(renderer, 'level-5');
    await press(renderer, 'btn-keep');
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
    expect(has(renderer, 'replace-dialog')).toBe(false);
    expect(await savedOf(store)).not.toBeNull();
  });

  test('«Sostituisci» cancella la salvata e avvia il livello scelto con il profilo scelto', async () => {
    const store = storeWith(savedGame());
    const { renderer, onPlay, onResume } = await mount(store);
    await press(renderer, 'profile-master');
    await press(renderer, 'level-5');
    await press(renderer, 'btn-replace');
    expect(onPlay).toHaveBeenCalledWith(5, 'master' satisfies Profile);
    expect(onResume).not.toHaveBeenCalled();
    expect(has(renderer, 'replace-dialog')).toBe(false);
    expect(await savedOf(store)).toBeNull();
  });

  test('la conferma ha un titolo per i lettori di schermo', async () => {
    const { renderer } = await mount(storeWith(savedGame()));
    await press(renderer, 'level-5');
    const title = renderer.root.findAll((n: any) => n.type === 'Text' && n.props.children === 'Hai una partita in corso')[0];
    expect(title.props.accessibilityRole).toBe('header');
  });

  test('se nel frattempo non c\'è più una partita da riprendere la conferma sparisce', async () => {
    const store = storeWith(savedGame());
    const { renderer, home, onPlay, onResume, onReload } = await mount(store);
    await press(renderer, 'level-5');
    expect(has(renderer, 'replace-dialog')).toBe(true);
    const empty = { ...home, resume: { kind: 'none' } as const };
    await act(async () => renderer.update(<HomeScreen home={empty} store={store} onPlay={onPlay} onResume={onResume} onReload={onReload} />));
    expect(has(renderer, 'replace-dialog')).toBe(false);
  });

  test('il tasto indietro chiude la conferma senza fare nulla', async () => {
    const store = storeWith(savedGame());
    const { renderer, onPlay, onResume } = await mount(store);
    await press(renderer, 'level-5');
    await act(async () => renderer.root.findByType(Modal).props.onRequestClose());
    expect(has(renderer, 'replace-dialog')).toBe(false);
    expect([onPlay, onResume].map((f) => f.mock.calls.length)).toEqual([0, 0]);
    expect(await savedOf(store)).not.toBeNull();
  });

  test('mentre scrive i pulsanti sono disattivati, poi la partita parte', async () => {
    const base = storeWith(savedGame());
    let release!: () => void;
    const store: SaveStore = { ...base, clearGame: () => new Promise((resolve) => (release = () => resolve({ ok: true, value: undefined }))) };
    const { renderer, onPlay } = await mount(store);
    await press(renderer, 'level-5');
    expect([isDisabled(renderer, 'btn-keep'), isDisabled(renderer, 'btn-replace')]).toEqual([false, false]);
    await press(renderer, 'btn-replace');
    expect([isDisabled(renderer, 'btn-keep'), isDisabled(renderer, 'btn-replace')]).toEqual([true, true]);
    expect(onPlay).not.toHaveBeenCalled();
    await act(async () => release());
    expect(onPlay).toHaveBeenCalledWith(5, 'normal');
  });
});

describe('partita salvata illeggibile', () => {
  const broken = () => createMemorySaveStore({ game: 'xx' });

  test('avviso con «Ricomincia»; i livelli partono senza conferma', async () => {
    const { renderer, onPlay } = await mount(broken());
    expect(texts(renderer)).toContain('Non riesco a riprendere la partita salvata');
    expect(has(renderer, 'continue-card')).toBe(false);
    await press(renderer, 'level-4');
    expect(onPlay).toHaveBeenCalledWith(4, 'normal');
    expect(has(renderer, 'replace-dialog')).toBe(false);
  });

  test('«Ricomincia» senza sapere quale livello era: scarta e resta nella home', async () => {
    const store = broken();
    const { renderer, onPlay, onReload } = await mount(store);
    await press(renderer, 'btn-restart-saved');
    expect(onPlay).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(await savedOf(store)).toBeNull();
  });

  test('«Ricomincia» di una partita che si leggeva: riavvia lo stesso livello e profilo', async () => {
    const store = storeWith(savedGame({ fingerprint: '0000000000000000' }));
    const { renderer, onPlay, onReload, home } = await mount(store);
    expect(home.resume.kind).toBe('broken');
    await press(renderer, 'btn-restart-saved');
    expect(onPlay).toHaveBeenCalledWith(20, 'hard');
    expect(onReload).not.toHaveBeenCalled();
    expect(await savedOf(store)).toBeNull();
  });

  test('se il livello salvato non esiste più resta nella home', async () => {
    const store = storeWith(savedGame({ levelId: 999, fingerprint: '0000000000000000' }));
    const { renderer, onPlay, onReload } = await mount(store);
    await press(renderer, 'btn-restart-saved');
    expect(onPlay).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test('mentre scarta, «Ricomincia» è disattivato', async () => {
    const base = broken();
    let release!: () => void;
    const store: SaveStore = { ...base, clearGame: () => new Promise((resolve) => (release = () => resolve({ ok: true, value: undefined }))) };
    const { renderer, onReload } = await mount(store);
    await press(renderer, 'btn-restart-saved');
    expect(isDisabled(renderer, 'btn-restart-saved')).toBe(true);
    await act(async () => release());
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(isDisabled(renderer, 'btn-restart-saved')).toBe(false);
  });
});

describe('progressi illeggibili', () => {
  const unreadable = () => storeWith(savedGame(), '{');

  test('schermata con «Riprova» e «Riparti da zero», senza selettore', async () => {
    const { renderer, onReload } = await mount(unreadable());
    expect(has(renderer, 'progress-error')).toBe(true);
    const t = texts(renderer);
    expect(t).toContain('Non riesco a leggere i tuoi progressi');
    expect(t).toContain('Puoi riprovare oppure ripartire da zero.');
    expect(has(renderer, 'level-1')).toBe(false);
    expect(has(renderer, 'continue-card')).toBe(false);
    await press(renderer, 'btn-progress-retry');
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test('«Riparti da zero» chiede conferma e dice cosa si perde; «Annulla» non tocca nulla', async () => {
    const store = unreadable();
    const { renderer, onReload } = await mount(store);
    await press(renderer, 'btn-progress-reset');
    const t = texts(renderer);
    expect(t).toContain('Cancellare tutto?');
    expect(t).toContain('Perderai stelle, record e ✨.');
    await press(renderer, 'btn-reset-cancel');
    expect(has(renderer, 'reset-dialog')).toBe(false);
    expect((await store.loadProgress()).ok).toBe(false);
    expect(await savedOf(store)).not.toBeNull();
    expect(onReload).not.toHaveBeenCalled();
  });

  test('il tasto indietro chiude la conferma senza cancellare', async () => {
    const store = unreadable();
    const { renderer } = await mount(store);
    await press(renderer, 'btn-progress-reset');
    await act(async () => renderer.root.findByType(Modal).props.onRequestClose());
    expect(has(renderer, 'reset-dialog')).toBe(false);
    expect((await store.loadProgress()).ok).toBe(false);
  });

  test('«Cancella tutto» riporta i progressi iniziali, toglie la partita e rilegge', async () => {
    const store = unreadable();
    const { renderer, onReload } = await mount(store);
    await press(renderer, 'btn-progress-reset');
    await press(renderer, 'btn-reset-confirm');
    expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
    expect(await savedOf(store)).toBeNull();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(has(renderer, 'reset-dialog')).toBe(false);
  });

  test('«Annulla» è l\'azione in rilievo e i pulsanti si disattivano mentre cancella', async () => {
    const base = unreadable();
    let release!: () => void;
    const store: SaveStore = { ...base, resetAll: () => new Promise((resolve) => (release = () => resolve({ ok: true, value: undefined }))) };
    const { renderer } = await mount(store);
    await press(renderer, 'btn-progress-reset');
    expect(renderer.root.findAllByProps({ testID: 'btn-reset-cancel' }).find((n: any) => n.props.kind).props.kind).toBe('primary');
    await press(renderer, 'btn-reset-confirm');
    expect([isDisabled(renderer, 'btn-reset-cancel'), isDisabled(renderer, 'btn-reset-confirm')]).toEqual([true, true]);
    await act(async () => release());
    await flush();
    expect(isDisabled(renderer, 'btn-progress-retry')).toBe(false);
  });
});
