import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { playRandomSession } from '../application/__fixtures__/play';
import { loadHome } from '../application/saveFlow';
import { serializeSavedGame, toSavedGame, type SavedGame } from '../application/savedGame';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { startSession } from '../application/session';
import type { Profile } from '../domain/profile';
import { newProgress, recordWin } from '../domain/progress';
import { serializeProgress } from '../application/progressCodec';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { LanguageProvider, type Language } from '../infrastructure/i18n';
import { HomeScreen } from './HomeScreen';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

/** Partita a metà del livello 1 salvata come livello 20, profilo Difficile, 4:12. */
function savedGame(over: Partial<SavedGame> = {}): SavedGame {
  const started = startSession({ spec: toSpec(legacyLevels[0]), profile: 'hard', seed: 7 });
  if (!started.ok) throw new Error('avvio');
  const session = { ...playRandomSession(started.value, 7, 3), seconds: 252 };
  return { ...toSavedGame(session, 20), ...over };
}
const storeWith = (game?: SavedGame, progress?: string) => createMemorySaveStore({ game: game ? serializeSavedGame(game) : undefined, progress });

async function mount(store: SaveStore, extra: Partial<Parameters<typeof HomeScreen>[0]> = {}, lang: Language = 'it') {
  const home = await loadHome(store);
  const calls = { onPlay: jest.fn(), onResume: jest.fn(), onReload: jest.fn(async () => {}) };
  const res = await render(
    <LanguageProvider initial={lang}>
      <HomeScreen home={home} store={store} {...calls} {...extra} />
    </LanguageProvider>,
  );
  return { ...res, ...calls, home };
}

const press = async (testID: string) => {
  await fireEvent.press(screen.getByTestId(testID));
};

const triggerPress = (testID: string) => {
  const el = screen.getByTestId(testID);
  if (typeof el.props.onClick === 'function') {
    el.props.onClick({ defaultPrevented: false });
  } else if (typeof el.props.onResponderRelease === 'function') {
    el.props.onResponderRelease({ defaultPrevented: false });
  } else {
    throw new Error(`onClick o onResponderRelease non trovato per ${testID}`);
  }
};

const has = (testID: string) => screen.queryByTestId(testID) !== null;

function extractTextNodes(node: any): string[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(extractTextNodes);
  if (node.type === 'Text') {
    return [extractChildrenString(node.children)];
  }
  if (node.children) return extractTextNodes(node.children);
  return [];
}
function extractChildrenString(children: any): string {
  if (!children) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractChildrenString).join('');
  if (children.children) return extractChildrenString(children.children);
  return '';
}
const texts = (): string => extractTextNodes(screen.toJSON()).join('|');

const isDisabled = (testID: string): boolean => {
  const el = screen.getByTestId(testID);
  return el.props.accessibilityState?.disabled === true || el.props.disabled === true;
};

const savedOf = async (store: SaveStore) => {
  const loaded = await store.loadGame();
  return loaded.ok ? loaded.value : 'illeggibile';
};

const requestCloseModal = async (testID: string) => {
  const dialog = screen.getByTestId(testID);
  let node: any = dialog;
  while (node && typeof node.props?.onRequestClose !== 'function') {
    node = node.parent;
  }
  if (node && node.props.onRequestClose) {
    await act(async () => {
      node.props.onRequestClose();
    });
  } else {
    throw new Error(`onRequestClose non trovato per ${testID}`);
  }
};

describe('senza partita salvata', () => {
  test('mostra il selettore, senza scheda «Continua» né avvisi, e un livello parte subito', async () => {
    const { onPlay } = await mount(storeWith());
    expect(texts()).toContain('Majoa Mahjong');
    expect(has('continue-card')).toBe(false);
    expect(has('broken-notice')).toBe(false);
    await press('profile-master');
    await press('level-3');
    expect(onPlay).toHaveBeenCalledWith(3, 'master');
    expect(has('replace-dialog')).toBe(false);
  });

  test('i progressi si vedono nel selettore', async () => {
    const progress = recordWin(newProgress(), { levelId: 1, stars: 3, seconds: 50, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    await mount(storeWith(undefined, serializeProgress(progress)));
    expect(texts()).toContain('★★★');
  });
});

describe('scheda «Continua»', () => {
  test('in cima: livello, profilo, tempo e tessere rimaste; un tocco riprende', async () => {
    const saved = savedGame();
    const { onResume, onPlay, home } = await mount(storeWith(saved));
    if (home.resume.kind !== 'ready') throw new Error('atteso ready');
    const t = texts();
    expect(t).toContain('Continua');
    expect(t).toContain('Livello 20');
    expect(t).toContain(`Difficile · 4:12 · ${home.resume.info.remaining} tessere`);
    expect(screen.getByTestId('continue-card').props.accessibilityLabel).toBe(`Continua: livello 20, Difficile, 4:12, ${home.resume.info.remaining} tessere`);
    await press('continue-card');
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });
});

describe('localizzazione della home', () => {
  test('la scheda «Continua» e la conferma di sostituzione seguono la lingua selezionata', async () => {
    const { home } = await mount(storeWith(savedGame()), {}, 'en');
    if (home.resume.kind !== 'ready') throw new Error('atteso ready');

    expect(screen.getByText('Continue')).toBeOnTheScreen();
    expect(screen.getByText('Level 20')).toBeOnTheScreen();
    expect(screen.getByText(`Hard · 4:12 · ${home.resume.info.remaining} tiles`)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `Continue: level 20, Hard, 4:12, ${home.resume.info.remaining} tiles` }),
    ).toBeOnTheScreen();

    await press('level-5');
    expect(screen.getByText('A game is in progress')).toBeOnTheScreen();
    expect(screen.getByText('Your saved game at level 20 (Hard, 4:12) will be lost.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue saved game' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeOnTheScreen();
  });
});

describe('conferma prima di sostituire', () => {
  test('avviare un livello con una partita salvata chiede conferma e dice cosa si perde', async () => {
    const { onPlay } = await mount(storeWith(savedGame()));
    await press('level-5');
    expect(has('replace-dialog')).toBe(true);
    const t = texts();
    expect(t).toContain('Hai una partita in corso');
    expect(t).toContain('La partita del livello 20 (Difficile, 4:12) andrà persa.');
    expect(t).toContain('Continua quella');
    expect(t).toContain('Sostituisci');
    expect(onPlay).not.toHaveBeenCalled();
  });

  test('anche per lo stesso livello e profilo della partita salvata', async () => {
    await mount(storeWith(savedGame()));
    await press('profile-hard');
    await press('level-20');
    expect(has('replace-dialog')).toBe(true);
  });

  test('«Continua quella» riprende la salvata e non la tocca', async () => {
    const store = storeWith(savedGame());
    const { onPlay, onResume } = await mount(store);
    await press('level-5');
    await press('btn-keep');
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
    expect(has('replace-dialog')).toBe(false);
    expect(await savedOf(store)).not.toBeNull();
  });

  test('«Sostituisci» cancella la salvata e avvia il livello scelto con il profilo scelto', async () => {
    const store = storeWith(savedGame());
    const { onPlay, onResume } = await mount(store);
    await press('profile-master');
    await press('level-5');
    await press('btn-replace');
    expect(onPlay).toHaveBeenCalledWith(5, 'master' satisfies Profile);
    expect(onResume).not.toHaveBeenCalled();
    expect(has('replace-dialog')).toBe(false);
    expect(await savedOf(store)).toBeNull();
  });

  test('la conferma ha un titolo per i lettori di schermo', async () => {
    await mount(storeWith(savedGame()));
    await press('level-5');
    const title = screen.getByText('Hai una partita in corso');
    expect(title.props.accessibilityRole).toBe('header');
  });

  test("se nel frattempo non c'è più una partita da riprendere la conferma sparisce", async () => {
    const store = storeWith(savedGame());
    const { home, onPlay, onResume, onReload, rerender } = await mount(store);
    await press('level-5');
    expect(has('replace-dialog')).toBe(true);
    const empty = { ...home, resume: { kind: 'none' } as const };
    await rerender(<HomeScreen home={empty} store={store} onPlay={onPlay} onResume={onResume} onReload={onReload} />);
    expect(has('replace-dialog')).toBe(false);
  });

  test('il tasto indietro chiude la conferma senza fare nulla', async () => {
    const store = storeWith(savedGame());
    const { onPlay, onResume } = await mount(store);
    await press('level-5');
    await requestCloseModal('replace-dialog');
    expect(has('replace-dialog')).toBe(false);
    expect([onPlay, onResume].map((f) => f.mock.calls.length)).toEqual([0, 0]);
    expect(await savedOf(store)).not.toBeNull();
  });

  test('mentre scrive i pulsanti sono disattivati, poi la partita parte', async () => {
    const base = storeWith(savedGame());
    let release!: () => void;
    const store: SaveStore = { ...base, clearGame: () => new Promise((resolve) => (release = () => resolve({ ok: true, value: undefined }))) };
    const { onPlay } = await mount(store);
    await press('level-5');
    expect([isDisabled('btn-keep'), isDisabled('btn-replace')]).toEqual([false, false]);
    await act(async () => {
      triggerPress('btn-replace');
    });
    expect([isDisabled('btn-keep'), isDisabled('btn-replace')]).toEqual([true, true]);
    expect(onPlay).not.toHaveBeenCalled();
    await act(async () => {
      release();
    });
    expect(onPlay).toHaveBeenCalledWith(5, 'normal');
  });
});

describe('partita salvata illeggibile', () => {
  const broken = () => createMemorySaveStore({ game: 'xx' });

  test('avviso con «Ricomincia»; i livelli partono senza conferma', async () => {
    const { onPlay } = await mount(broken());
    expect(texts()).toContain('Non riesco a riprendere la partita salvata');
    expect(has('continue-card')).toBe(false);
    await press('level-4');
    expect(onPlay).toHaveBeenCalledWith(4, 'normal');
    expect(has('replace-dialog')).toBe(false);
  });

  test('«Ricomincia» senza sapere quale livello era: scarta e resta nella home', async () => {
    const store = broken();
    const { onPlay, onReload } = await mount(store);
    await press('btn-restart-saved');
    expect(onPlay).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(await savedOf(store)).toBeNull();
  });

  test('«Ricomincia» di una partita che si leggeva: riavvia lo stesso livello e profilo', async () => {
    const store = storeWith(savedGame({ fingerprint: '0000000000000000' }));
    const { onPlay, onReload, home } = await mount(store);
    expect(home.resume.kind).toBe('broken');
    await press('btn-restart-saved');
    expect(onPlay).toHaveBeenCalledWith(20, 'hard');
    expect(onReload).not.toHaveBeenCalled();
    expect(await savedOf(store)).toBeNull();
  });

  test('se il livello salvato non esiste più resta nella home', async () => {
    const store = storeWith(savedGame({ levelId: 999, fingerprint: '0000000000000000' }));
    const { onPlay, onReload } = await mount(store);
    await press('btn-restart-saved');
    expect(onPlay).not.toHaveBeenCalled();
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test('mentre scarta, «Ricomincia» è disattivato', async () => {
    const base = broken();
    let release!: () => void;
    const store: SaveStore = { ...base, clearGame: () => new Promise((resolve) => (release = () => resolve({ ok: true, value: undefined }))) };
    const { onReload } = await mount(store);
    await act(async () => {
      triggerPress('btn-restart-saved');
    });
    expect(isDisabled('btn-restart-saved')).toBe(true);
    await act(async () => {
      release();
    });
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(isDisabled('btn-restart-saved')).toBe(false);
  });
});

describe('progressi illeggibili', () => {
  const unreadable = () => storeWith(savedGame(), '{');

  test('schermata con «Riprova» e «Riparti da zero», senza selettore', async () => {
    const { onReload } = await mount(unreadable());
    expect(has('progress-error')).toBe(true);
    const t = texts();
    expect(t).toContain('Non riesco a leggere i tuoi progressi');
    expect(t).toContain('Puoi riprovare oppure ripartire da zero.');
    expect(has('level-1')).toBe(false);
    expect(has('continue-card')).toBe(false);
    await press('btn-progress-retry');
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  test('«Riparti da zero» chiede conferma e dice cosa si perde; «Annulla» non tocca nulla', async () => {
    const store = unreadable();
    const { onReload } = await mount(store);
    await press('btn-progress-reset');
    const t = texts();
    expect(t).toContain('Cancellare tutto?');
    expect(t).toContain('Perderai stelle, record e ✨.');
    await press('btn-reset-cancel');
    expect(has('reset-dialog')).toBe(false);
    expect((await store.loadProgress()).ok).toBe(false);
    expect(await savedOf(store)).not.toBeNull();
    expect(onReload).not.toHaveBeenCalled();
  });

  test('il tasto indietro chiude la conferma senza cancellare', async () => {
    const store = unreadable();
    await mount(store);
    await press('btn-progress-reset');
    await requestCloseModal('reset-dialog');
    expect(has('reset-dialog')).toBe(false);
    expect((await store.loadProgress()).ok).toBe(false);
  });

  test('«Cancella tutto» riporta i progressi iniziali, toglie la partita e rilegge', async () => {
    const store = unreadable();
    const { onReload } = await mount(store);
    await press('btn-progress-reset');
    await press('btn-reset-confirm');
    expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
    expect(await savedOf(store)).toBeNull();
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(has('reset-dialog')).toBe(false);
  });

  test("«Annulla» è l'azione in rilievo e i pulsanti si disattivano mentre cancella", async () => {
    const base = unreadable();
    let release!: () => void;
    const store: SaveStore = { ...base, resetAll: () => new Promise((resolve) => (release = () => resolve({ ok: true, value: undefined }))) };
    await mount(store);
    await press('btn-progress-reset');
    const cancelBtn = screen.getByTestId('btn-reset-cancel');
    expect(cancelBtn).toBeOnTheScreen();
    await act(async () => {
      triggerPress('btn-reset-confirm');
    });
    expect([isDisabled('btn-reset-cancel'), isDisabled('btn-reset-confirm')]).toEqual([true, true]);
    await act(async () => {
      release();
    });
    expect(isDisabled('btn-progress-retry')).toBe(false);
  });
});
