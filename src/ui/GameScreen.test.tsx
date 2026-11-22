import { act } from 'react';
import { AccessibilityInfo, AppState, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { playRandomSession } from '../application/__fixtures__/play';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { restoreSession, toSavedGame } from '../application/savedGame';
import { startSession, type Session } from '../application/session';
import type { Profile } from '../domain/profile';
import { newProgress, recordWin } from '../domain/progress';
import { STAR_TYPE } from '../domain/types';
import { levelSignature } from '../domain/fingerprint';
import { startRound } from '../application/round';
import type { GameState } from '../domain/gameState';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { equalFreeTiles } from './equalTiles';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { SettingsProvider } from './SettingsProvider';
import { LanguageProvider, locale, t, type Language } from '../infrastructure/i18n';
import en from '../infrastructure/i18n/locales/en';
import { GameScreen, NO_MATCH_MS, type GameScreenProps } from './GameScreen';
import type { Burst } from './effects';
import type { TileBoardProps } from './TileBoard';

// Si prova la logica della schermata (effetti, timer, avvisi, animazione, vittoria) con la tavola Skia sostituita da un
// finto componente che registra le proprietà ricevute. Il disegno vero si prova solo su dispositivo.
// Reanimated non si carica nei test (richiede i moduli nativi di worklets): finto. Le animazioni non finiscono da sole: `withTiming`
// registra la funzione di fine, che il test chiama per far svanire il premio «+N» della vittoria.
const mockAnimationEnds: ((finished: boolean) => void)[] = [];
jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  const { useRef } = require('react');
  return {
    __esModule: true,
    default: { View, Text },
    Easing: { ease: 0, out: (f: unknown) => f, in: (f: unknown) => f, inOut: (f: unknown) => f, bezier: () => 0 },
    // Stabile da un disegno all'altro, come i valori condivisi veri: un oggetto nuovo a ogni disegno rifarebbe partire gli effetti.
    useSharedValue: (v: unknown) => useRef({ value: v }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown, _options?: unknown, done?: (finished: boolean) => void) => {
      if (done) mockAnimationEnds.push(done);
      return v;
    },
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withDelay: (_ms: unknown, v: unknown) => v,
    withRepeat: (v: unknown) => v,
    runOnJS: (fn: unknown) => fn,
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./svgs', () => ({ useTileSvgs: () => Array.from({ length: 129 }, () => null) }));
import { BG_PALETTE_COLORS, COLORBLIND_PALETTE, TILE_PALETTE_COLORS } from '../infrastructure/content/appearancePalettes';
import { levelPalette } from '../infrastructure/content/legacyThemes';

jest.mock('./TileBoard', () => ({
  TileBoard: (props: unknown) => {
    (globalThis as { __board?: unknown }).__board = props;
    return null;
  },
}));

// Anche scintille e scritta della combo sono sostituite da finti componenti: registrano ciò che ricevono (il disegno vero
// usa Skia e Reanimated, che qui non si caricano).
jest.mock('./SparkLayer', () => ({
  SparkLayer: (props: unknown) => {
    (globalThis as { __sparks?: unknown }).__sparks = props;
    return null;
  },
}));
// Anche la barra delle tessere selezionate registra ciò che riceve (il suo disegno è provato in SelectionBar.test.tsx).
jest.mock('./SelectionBar', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    SelectionBar: (props: unknown) => {
      (globalThis as { __bar?: unknown }).__bar = props;
      return React.createElement('View', { testID: 'selection-bar' });
    },
  };
});
jest.mock('./ComboBanner', () => {
  const React = require('react');
  return {
    ComboBanner: (props: { text: string; hot: boolean; mascotUri?: string | null; onDone: () => void }) => {
      React.useEffect(() => {
        const g = globalThis as unknown as { __banners: { text: string; hot: boolean }[]; __bannerDone: () => void; __bannerMascot: unknown };
        g.__banners.push({ text: props.text, hot: props.hot });
        g.__bannerMascot = props.mascotUri;
        g.__bannerDone = props.onDone;
      }, []); // eslint-disable-line react-hooks/exhaustive-deps -- si registra al montaggio: ogni scritta nuova rimonta (key)
      return React.createElement('View', { testID: 'combo-banner' });
    },
  };
});

// L'immagine della mascotte la decide il test (`__mascotUri`); si registra quale mascotte si è chiesta.
jest.mock('./mascots', () => ({
  useMascotUri: (mascot: string) => {
    const g = globalThis as { __mascotAsked?: string; __mascotUri?: string };
    g.__mascotAsked = mascot;
    return g.__mascotUri ?? null;
  },
}));
jest.mock('./FireworksLayer', () => {
  const React = require('react');
  return {
    FireworksLayer: (props: unknown) => {
      (globalThis as { __fireworks?: unknown }).__fireworks = props;
      return React.createElement('View', { testID: 'fireworks-layer' });
    },
  };
});

beforeEach(() => {
  mockAnimationEnds.length = 0;
  jest.useFakeTimers();
  (globalThis as { __fireworks?: unknown }).__fireworks = undefined;
  (globalThis as { __mascotUri?: unknown }).__mascotUri = undefined;
  (globalThis as { __mascotAsked?: unknown }).__mascotAsked = undefined;
  (globalThis as { __bannerMascot?: unknown }).__bannerMascot = undefined;
  jest.spyOn(Math, 'random').mockReturnValue(0.123);
  (globalThis as { __sparks?: unknown }).__sparks = undefined;
  (globalThis as { __banners?: unknown }).__banners = [];
  jest.spyOn(console, 'error');
});
afterEach(() => {
  // Gli avvisi di React (per esempio «aggiornamento fuori da act») sono errori: la schermata non deve produrne.
  const errors = (console.error as jest.Mock).mock.calls;
  jest.restoreAllMocks();
  jest.useRealTimers();
  expect(errors).toEqual([]);
});

const board = (): TileBoardProps => (globalThis as unknown as { __board: TileBoardProps }).__board;
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
type BarProps = { view: { slots: (number | string)[]; status: string | null }; recent: number[]; groupSize: number };
const bar = (): BarProps => (globalThis as unknown as { __bar: BarProps }).__bar;

const press = (testID: string) => {
  const el = screen.getByTestId(testID);
  act(() => {
    if (typeof el.props.onClick === 'function') {
      el.props.onClick({ defaultPrevented: false });
    } else if (typeof el.props.onPress === 'function') {
      el.props.onPress();
    } else if (typeof el.props.onResponderRelease === 'function') {
      el.props.onResponderRelease({ defaultPrevented: false });
    }
  });
};

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
const texts = (): string => extractTextNodes(screen.toJSON()).join(' | ');

/** Nei test non c'è layout: si simula quello dell'area della tavola (un telefono). Su un dispositivo arriva da solo a ogni montaggio. */
const layout = () => {
  const el = screen.queryByTestId('board-area');
  if (el) {
    act(() => {
      el.props.onLayout({ nativeEvent: { layout: { width: 360, height: 560 } } });
    });
  }
};

async function mount(levelId = 1, profile: Profile = 'normal', extra: Partial<GameScreenProps> & { settings?: Settings } = {}, lang: Language = 'it') {
  const onExit = jest.fn();
  const onProgress = jest.fn();
  const store = extra.store ?? createMemorySaveStore();
  const { settings, ...gameProps } = extra;
  const content = (
    <LanguageProvider initial={lang}>
      <GameScreen
        level={legacyLevels[levelId - 1]}
        profile={profile}
        onExit={onExit}
        store={store}
        progress={newProgress()}
        onProgress={onProgress}
        {...gameProps}
      />
    </LanguageProvider>
  );
  const res = await render(
    settings ? <SettingsProvider initial={settings}>{content}</SettingsProvider> : content,
  );
  layout();
  return { ...res, onExit, onProgress, store };
}

/**
 * Prima coppia (per indice) di tessere libere, giocabili e dello stesso disegno, oppure `null` se non ce ne sono:
 * la stessa scelta di `findMove` per i livelli senza gruppi nascosti.
 */
function freePair(): [number, number] | null {
  const b = board();
  const playable = [...b.free].filter((i) => !b.statuses[i].locked && !b.gone.has(i) && !b.removing.has(i)).sort((x, y) => x - y);
  if (b.statuses.some((st, i) => st.locked && !b.gone.has(i) && !b.removing.has(i))) {
    const stars = playable.filter((i) => b.tiles[i].type === STAR_TYPE); // gruppi nascosti ancora chiusi: prima le stelle
    if (stars.length >= 2) return [stars[0], stars[1]];
  }
  for (let a = 0; a < playable.length; a++) {
    for (let c = a + 1; c < playable.length; c++) if (b.designs[playable[a]] === b.designs[playable[c]]) return [playable[a], playable[c]];
  }
  return null;
}
const playPair = (pair: [number, number]) => {
  act(() => { board().onTap(pair[0]); });
  act(() => { board().onTap(pair[1]); });
};

describe('GameScreen', () => {
  test('localizza le etichette di navigazione e quelle per l\'accessibilità', async () => {
    await mount(1, 'normal', {}, 'en');
    expect(screen.getByRole('button', { name: 'Back to islands' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Hint, (?:\d+|∞) remaining$/ })).toBeOnTheScreen();
  });

  test('mostra intestazione e aiuti e passa le tessere alla tavola', async () => {
    await mount(1);
    const total = legacyLevels[0].cells.length;
    expect(texts()).toContain('Livello 1');
    expect(texts()).toContain(`Normale · ${total} coppie`);
    for (const label of ['Aiuto', 'Annulla', 'Mescola']) expect(texts()).toContain(label);
    const b = board();
    expect([b.tiles.length, b.designs.length, b.statuses.length, b.gone.size, b.removing.size, b.removeKey, b.selected.length]).toEqual([total, total, total, 0, 0, 0, 0]);
    expect(b.free.size).toBeGreaterThan(0);
  });

  test('un tocco seleziona; fuori da ogni tessera non succede nulla', async () => {
    await mount(1);
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(pair[0]); });
    expect(board().selected).toEqual([pair[0]]);
    act(() => { board().onTap(null); });
    expect(board().selected).toEqual([pair[0]]);
  });

  test('una coppia si toglie: prima «in rimozione» per 250 ms senza sparire per un fotogramma, poi tolta', async () => {
    await mount(1);
    const total = legacyLevels[0].cells.length;
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    playPair(pair);
    expect([...board().removing].sort((a, b) => a - b)).toEqual([...pair].sort((a, b) => a - b));
    expect([board().gone.size, board().removeKey, board().selected.length]).toEqual([0, 1, 0]);
    expect(pair.some((i) => board().free.has(i))).toBe(false);
    expect(texts()).toContain(`${total - 2} coppie`);
    advance(300);
    expect([board().removing.size, [...board().gone].sort((a, b) => a - b)]).toEqual([0, [...pair].sort((a, b) => a - b)]);
  });

  test('il tempo scorre ogni secondo', async () => {
    await mount(1);
    expect(texts()).toContain('0:00');
    advance(3000);
    expect(texts()).toContain('0:03');
  });

  test('una tessera bloccata dà un avviso che sparisce dopo due secondi', async () => {
    await mount(1);
    const blocked = board().tiles.findIndex((_, i) => !board().free.has(i));
    act(() => { board().onTap(blocked); });
    expect(texts()).toContain(t('tBlockSides'));
    advance(2100);
    expect(texts()).not.toContain(t('tBlockSides'));
  });

  test('Aiuto evidenzia una coppia per due secondi', async () => {
    await mount(1);
    press('btn-hint');
    expect(board().hint.length).toBe(2);
    advance(2100);
    expect(board().hint.length).toBe(0);
  });

  test('Annulla rimette la coppia; Mischia cambia i disegni senza cambiare le tessere rimaste', async () => {
    await mount(1);
    const total = legacyLevels[0].cells.length;
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    playPair(pair);
    advance(300);
    press('btn-undo');
    expect([board().gone.size, board().removing.size, texts().includes(`${total} coppie`)]).toEqual([0, 0, true]);
    const before = board().designs;
    press('btn-shuffle');
    expect(board().designs).not.toEqual(before);
    expect(texts()).toContain(`${total} coppie`);
  });

  test('giocando fino in fondo (con il rimescolo automatico quando serve) compare la vittoria; Rigioca ricomincia', async () => {
    await mount(1);
    const total = legacyLevels[0].cells.length;
    for (let n = 0; n < 600 && !texts().includes('superato!'); n++) {
      const pair = freePair();
      if (pair) playPair(pair);
      else advance(1200); // nessuna mossa: dopo l'avviso parte il rimescolo automatico
      advance(300);
    }
    expect(texts()).toContain('superato!');
    expect(screen.getByTestId('win-stars')).toBeOnTheScreen();
    expect(texts()).toContain('Tempo');
    press('btn-restart');
    layout(); // la schermata si rimonta: l'area riparte da zero finché non arriva il layout
    expect(texts()).not.toContain('superato!');
    expect(texts()).toContain(`${total} coppie`);
    expect([board().gone.size, board().removing.size]).toEqual([0, 0]);
  });

  /** Gioca sempre la prima coppia finché non restano mosse; restituisce quante tessere restano. */
  function playUntilStuck(): number {
    for (let n = 0; n < 400; n++) {
      const pair = freePair();
      if (!pair) return board().tiles.length - board().gone.size;
      playPair(pair);
      advance(300);
    }
    throw new Error('la partita non si è bloccata');
  }

  test("senza mosse: dopo l'avviso parte il rimescolo automatico e si può continuare", async () => {
    // Livello 20 con questo seme: giocando sempre la prima coppia si resta senza mosse con molte tessere (verificato).
    (Math.random as jest.Mock).mockReturnValue(0.2);
    await mount(20);
    const remaining = playUntilStuck();
    expect(remaining).toBeGreaterThan(10);
    expect(texts()).not.toContain('rimescolo le tessere'); // prima dell'avviso non è ancora successo nulla
    advance(1100);
    expect(texts()).toContain('Nessuna mossa: rimescolo le tessere per te.');
    expect(freePair()).not.toBeNull();
    expect(board().tiles.length - board().gone.size).toBe(remaining);
  });

  test('senza mosse e senza soluzione: si consiglia Annulla (non Mischia) e Annulla riporta una mossa', async () => {
    // Livello 10 con questo seme: restano 4 tessere impilate, che nessun rimescolo può sbloccare (verificato).
    (Math.random as jest.Mock).mockReturnValue(0.75);
    await mount(10);
    expect(playUntilStuck()).toBe(4);
    advance(1100);
    expect(texts()).toContain('Nessuna mossa: usa Annulla');
    expect(texts()).not.toContain('usa Mescola');
    advance(2100);
    press('btn-undo');
    expect(freePair()).not.toBeNull();
    expect(board().tiles.length - board().gone.size).toBe(6);
  });

  test('la freccia di ritorno chiama onExit', async () => {
    const { onExit } = await mount(1);
    press('btn-back');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

// Salvataggi: salvataggio automatico, tempo fermo in secondo piano, ripresa, chiusura della partita (docs/salvataggi.md).
describe('GameScreen: scintille e combo', () => {
  const sparks = () => (globalThis as unknown as { __sparks?: { bursts: readonly Burst[]; width: number; height: number } }).__sparks;
  const banners = () => (globalThis as unknown as { __banners: { text: string; hot: boolean }[] }).__banners;

  /** Gioca la prima coppia libera e lascia finire la rimozione (300 ms: restiamo ben dentro la finestra della combo). */
  const playNext = () => {
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    playPair(pair);
    advance(300);
  };

  test('un abbinamento fa partire le scintille sulle due tessere tolte, senza scritta', async () => {
    await mount(1);
    expect(sparks()?.bursts).toEqual([]);
    expect(sparks()).toMatchObject({ width: 360, height: 560 }); // la misura dell'area di gioco, che sono le coordinate delle scintille
    playPair(freePair()!);
    expect(sparks()!.bursts).toHaveLength(2);
    expect(banners()).toEqual([]);
    expect(screen.queryByTestId('combo-banner')).toBeNull();
  });

  test('dal secondo abbinamento ravvicinato la scritta cresce (Bene, Super, Grande, Incredibile) e al livello 4 si ferma; rosa dal 3', async () => {
    await mount(1);
    for (let n = 0; n < 7; n++) playNext();
    expect(banners()).toEqual(
      (['cmb1', 'cmb2', 'cmb3', 'cmb4', 'cmb4', 'cmb4'] as const).map((key) => ({ text: t(key), hot: key === 'cmb3' || key === 'cmb4' })),
    );
  });

  test('la scritta della combo porta la mascotte scelta: Collie finché non ci sono le impostazioni', async () => {
    (globalThis as { __mascotUri?: string }).__mascotUri = 'data:image/png;base64,TEST';
    await mount(1);
    playNext();
    playNext();
    expect((globalThis as unknown as { __mascotAsked?: string }).__mascotAsked).toBe('collie');
    expect((globalThis as unknown as { __bannerMascot?: unknown }).__bannerMascot).toBe('data:image/png;base64,TEST');
  });

  test('senza l\'immagine della mascotte la scritta è solo testo', async () => {
    await mount(1);
    playNext();
    playNext();
    expect(banners()).toHaveLength(1);
    expect((globalThis as unknown as { __bannerMascot?: unknown }).__bannerMascot).toBeNull();
  });

  test('la scritta segue la lingua scelta', async () => {
    await mount(1, 'normal', {}, 'en');
    playNext();
    playNext();
    expect(banners().map((b) => b.text)).toEqual([en.cmb1]);
  });

  test('a più di 4,5 secondi dall\'abbinamento precedente la combo riparte da capo', async () => {
    await mount(1);
    playNext();
    advance(5000);
    playNext();
    expect(banners()).toEqual([]);
    playNext();
    expect(banners()).toHaveLength(1);
  });

  test('la scritta si toglie da sola quando l\'animazione finisce', async () => {
    await mount(1);
    playNext();
    playNext();
    expect(screen.getByTestId('combo-banner')).toBeOnTheScreen();
    act(() => { (globalThis as unknown as { __bannerDone: () => void }).__bannerDone(); });
    expect(screen.queryByTestId('combo-banner')).toBeNull();
  });

  test('con la riduzione del movimento del sistema non compare nulla: né scintille né scritta', async () => {
    // Una volta sola: `isReduceMotionEnabled` è già un finto del preset di Jest e `restoreAllMocks` non lo ripristina, quindi
    // un valore fisso resterebbe attivo per tutti i test successivi del file.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    await mount(1);
    await act(async () => {}); // la risposta del sistema arriva dopo il primo disegno
    (globalThis as { __sparks?: unknown }).__sparks = undefined;
    playNext();
    playNext();
    playNext();
    expect(sparks()).toBeUndefined();
    expect(banners()).toEqual([]);
    expect(screen.queryByTestId('combo-banner')).toBeNull();
  });
});

describe('GameScreen: salvataggi', () => {
  const flush = () => act(async () => {});
  const savedGame = async (store: SaveStore) => {
    const loaded = await store.loadGame();
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    return loaded.value;
  };
  const DISK_FULL = { ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } } as const;

  /** Sessione del livello `levelId` giocata a caso con quel seme; con `pick` si cerca il primo seme che dà l'esito voluto. */
  function sessionOf(levelId: number, profile: Profile, seed: number, maxActions: number): Session {
    const started = startSession({ spec: toSpec(legacyLevels[levelId - 1]), profile, seed });
    if (!started.ok) throw new Error('avvio');
    return playRandomSession(started.value, seed, maxActions);
  }
  function wonSession(levelId: number, profile: Profile): Session {
    for (let seed = 1; seed < 400; seed++) {
      const s = sessionOf(levelId, profile, seed, 5000);
      if (s.phase === 'won') return s;
    }
    throw new Error('nessuna partita vinta');
  }
  function playToEnd() {
    for (let n = 0; n < 600 && !texts().includes('superato!'); n++) {
      const pair = freePair();
      if (pair) playPair(pair);
      else advance(1200);
      advance(300);
    }
    expect(texts()).toContain('superato!');
  }

  test('si salva dopo una mossa, con livello, profilo ed evento; non per un tocco di selezione né per il passare del tempo', async () => {
    const { store } = await mount(3, 'hard');
    advance(5000);
    act(() => { board().onTap([...board().free][0]); });
    await flush();
    expect(await savedGame(store)).toBeNull();
    const pair = freePair()!;
    playPair(pair);
    await flush();
    const saved = (await savedGame(store))!;
    expect([saved.levelId, saved.profile, saved.events.length, saved.events[0].kind]).toEqual([3, 'hard', 1, 'move']);
    expect(saved.seconds).toBe(5);
    expect(texts()).not.toContain('Non riesco a salvare');
  });

  /** Archivio che ricorda ogni partita scritta. */
  function recording() {
    const base = createMemorySaveStore();
    const writes: Awaited<ReturnType<typeof savedGame>>[] = [];
    const store: SaveStore = { ...base, saveGame: async (game) => (writes.push(game), base.saveGame(game)) };
    return { store, writes };
  }

  test('una mossa si scrive una volta sola: il tempo che passa dopo non riscrive nulla', async () => {
    const { store, writes } = recording();
    await mount(1, 'normal', { store });
    playPair(freePair()!);
    await flush();
    advance(8000);
    await flush();
    expect(writes).toHaveLength(1);
  });

  test("si scrivono solo partite in corso: l'ultima mossa, che vince, non si salva", async () => {
    const { store, writes } = recording();
    await mount(1, 'normal', { store });
    playToEnd();
    await flush();
    expect(writes.length).toBeGreaterThan(0);
    for (const game of writes) {
      const restored = restoreSession(game!);
      expect(restored.ok && restored.value.phase).toBe('playing');
    }
    expect(writes[writes.length - 1]!.events.length).toBeLessThan(legacyLevels[0].cells.length);
  });

  test('la freccia di ritorno è almeno 48 dp, come ogni controllo', async () => {
    await mount(1);
    const style = StyleSheet.flatten(screen.getByTestId('btn-back').props.style);
    expect(Math.min(style.width, style.height)).toBeGreaterThanOrEqual(48);
  });

  test('si registra con il numero del livello giocato', async () => {
    const { onProgress } = await mount(2);
    playToEnd();
    await flush();
    expect(Object.keys(onProgress.mock.calls[0][0].levels)).toEqual(['2']);
  });

  test('anche un aiuto entra nel salvataggio', async () => {
    const { store } = await mount(1);
    press('btn-hint');
    await flush();
    expect((await savedGame(store))!.events).toEqual([{ kind: 'hint' }]);
  });

  describe('in secondo piano', () => {
    let handlers: ((state: string) => void)[];
    beforeEach(() => {
      handlers = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: (state: string) => void) => {
        handlers.push(handler);
        return { remove: () => (handlers = handlers.filter((h) => h !== handler)) };
      }) as never);
    });
    const goTo = (state: string) => act(() => { handlers.forEach((h) => h(state)); });

    test('il tempo si ferma e la partita si salva con il tempo trascorso; al ritorno il tempo riparte', async () => {
      const { store } = await mount(1);
      advance(3000);
      expect(texts()).toContain('0:03');
      goTo('background');
      await flush();
      expect((await savedGame(store))!.seconds).toBe(3);
      advance(10000);
      expect(texts()).toContain('0:03');
      goTo('active');
      advance(2000);
      expect(texts()).toContain('0:05');
    });

    test("smontando la schermata si smette di ascoltare lo stato dell'app", async () => {
      const { unmount } = await mount(1);
      expect(handlers).toHaveLength(1);
      await unmount();
      expect(handlers).toHaveLength(0);
    });

    test("se l'app parte già in secondo piano il tempo non corre", async () => {
      // Nel mock di React Native `currentState` è una funzione: lo si imposta e lo si ripristina a mano.
      const original = AppState.currentState;
      (AppState as { currentState: unknown }).currentState = 'background';
      try {
        await mount(1);
        advance(4000);
        expect(texts()).toContain('0:00');
      } finally {
        (AppState as { currentState: unknown }).currentState = original;
      }
    });

    test('anche «inactive» ferma il tempo; una partita vinta non si salva in secondo piano', async () => {
      const { store } = await mount(1);
      advance(1000);
      goTo('inactive');
      advance(5000);
      expect(texts()).toContain('0:01');
      goTo('active');
      playToEnd();
      await flush();
      expect(await savedGame(store)).toBeNull();
      goTo('background');
      await flush();
      expect(await savedGame(store)).toBeNull();
    });
  });

  test('riprende la partita ricostruita: stesso tempo, stesse tessere, e continua a salvarsi dopo gli eventi già presenti', async () => {
    const session = sessionOf(1, 'normal', 7, 3);
    expect(session.phase).toBe('playing');
    expect(session.events.length).toBeGreaterThan(0);
    const { store } = await mount(1, 'normal', { resume: session });
    expect(texts()).toContain(formatTimeOf(session));
    expect(texts()).toContain(`${session.game.remaining} coppie`);
    expect(board().tiles.length - board().gone.size).toBe(session.game.remaining);
    await flush();
    expect(await savedGame(store)).toBeNull(); // riprendere non cambia nulla: non serve riscrivere
    playPair(freePair()!);
    await flush();
    expect((await savedGame(store))!.events.length).toBe(session.events.length + 1);
  });

  test('«Rigioca» dopo una partita ripresa ne avvia una nuova, non rifà la salvata', async () => {
    const session = wonSession(1, 'normal');
    await mount(1, 'normal', { resume: session });
    await flush();
    press('btn-restart');
    layout();
    expect(texts()).not.toContain('superato!');
    expect(texts()).toContain(`${legacyLevels[0].cells.length} coppie`);
  });

  describe('fine partita', () => {
    test('la vittoria registra i progressi, cancella la partita salvata e mostra stelle, ✨ e nessun «Nuovo record!» alla prima vittoria', async () => {
      const { store, onProgress } = await mount(1);
      playPair(freePair()!);
      await flush();
      expect(await savedGame(store)).not.toBeNull();
      playToEnd();
      await flush();
      expect(await savedGame(store)).toBeNull();
      expect(onProgress).toHaveBeenCalledTimes(1);
      const progress = onProgress.mock.calls[0][0];
      expect(progress.levels[1].stars).toBeGreaterThanOrEqual(1);
      expect(progress.levels[1].signature).toBe(levelSignature(legacyLevels[0])); // la firma è quella del livello
      expect(await store.loadProgress()).toEqual({ ok: true, value: progress });
      expect(screen.getByTestId('win-stars')).toBeOnTheScreen();
      const coins = progress.coins - newProgress().coins;
      if (coins > 0) expect(texts()).toContain(`+${coins}`);
      expect(texts()).not.toContain('Nuovo record!');
      expect(texts()).not.toContain('Non riesco a salvare');
    });

    test('in Modalità comoda la firma è comunque quella del livello (la disposizione cambia, il livello no)', async () => {
      const level = legacyLevels[2]; // il 3: la sua disposizione comoda è diversa (nel 1 e nel 2 è uguale)
      expect(toSpec(level, { comfort: true }).cells).not.toEqual(toSpec(level).cells);
      const { onProgress } = await mount(level.id, 'normal', { settings: { ...DEFAULT_SETTINGS, comfort: true } });
      playToEnd();
      await flush();
      expect(onProgress.mock.calls[0][0].levels[level.id].signature).toBe(levelSignature(level));
    });

    test('un tempo migliore di un record esistente mostra «Nuovo record!»', async () => {
      const slow = recordWin(newProgress(), { signature: levelSignature(legacyLevels[0]), levelId: 1, stars: 1, seconds: 99999, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      await mount(1, 'normal', { progress: slow });
      playToEnd();
      await flush();
      expect(texts()).toContain('Nuovo record!');
    });

    test('una vittoria che non migliora nulla non dà ✨ né «Nuovo record!»', async () => {
      const best = recordWin(newProgress(), { signature: levelSignature(legacyLevels[0]), levelId: 1, stars: 3, seconds: 1, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      const { onProgress } = await mount(1, 'normal', { progress: best });
      playToEnd();
      await flush();
      expect(onProgress.mock.calls[0][0].coins).toBe(best.coins);
      expect(texts()).not.toContain('✨');
      expect(texts()).not.toContain('Nuovo record!');
    });

    describe('anticipazione del livello speciale', () => {
      /** Il livello 1 è l'ultimo della prima isola; la seconda si apre con `opener`. */
      const win = async (opener: number, extraFirst: number[] = [], lang: Language = 'it') => {
        const islands = [
          { id: 'prologue', levelIds: [...extraFirst, 1].sort((a, b) => (a === 1 ? 1 : b === 1 ? -1 : a - b)), gift: 0 },
          { id: 'animals', levelIds: [opener, opener + 1], gift: 0 },
        ];
        await mount(1, 'normal', { progress: newProgress(), islands }, lang);
        const doneText = lang === 'en' ? 'complete!' : 'superato!';
        for (let n = 0; n < 600 && !texts().includes(doneText); n++) {
          const pair = freePair();
          if (pair) playPair(pair);
          else advance(1200);
          advance(300);
        }
        expect(texts()).toContain(doneText);
        await flush();
      };

      test("dopo l'ultimo livello di un'isola che precede un Tris, la scheda di vittoria lo anticipa senza dire quale", async () => {
        await win(21); // il 21 è un Tris
        expect(screen.getByTestId('win-teaser').props.children).toBe(locale('it').teaserNext);
        expect(texts()).not.toContain('Tris');
      });

      test("nella lingua attiva", async () => {
        await win(21, [], 'en');
        expect(screen.getByTestId('win-teaser').props.children).toBe(locale('en').teaserNext);
      });

      test("se l'isola successiva si apre con un livello a coppie, niente", async () => {
        await win(22);
        expect(screen.queryByTestId('win-teaser')).toBeNull();
      });

      test("un livello che non è l'ultimo dell'isola non anticipa nulla", async () => {
        const islands = [
          { id: 'prologue', levelIds: [1, 2], gift: 0 },
          { id: 'animals', levelIds: [21, 22], gift: 0 },
        ];
        await mount(1, 'normal', { progress: newProgress(), islands });
        playToEnd();
        await flush();
        expect(screen.queryByTestId('win-teaser')).toBeNull();
      });

      test("l'ultima isola che si conosce non ha un seguito da anticipare", async () => {
        await mount(1, 'normal', { progress: newProgress(), islands: [{ id: 'prologue', levelIds: [1], gift: 0 }] });
        playToEnd();
        await flush();
        expect(screen.queryByTestId('win-teaser')).toBeNull();
      });

      test("durante la partita non si vede", async () => {
        await mount(1, 'normal', { progress: newProgress(), islands: [{ id: 'prologue', levelIds: [1], gift: 0 }, { id: 'animals', levelIds: [21], gift: 0 }] });
        expect(screen.queryByTestId('win-teaser')).toBeNull();
      });
    });

    test("aprire un'isola mostra il regalo, una volta sola", async () => {
      const islands = [
        { id: 'prologue', levelIds: [1], gift: 0 },
        { id: 'animals', levelIds: [2], gift: 3 },
      ];
      const before = recordWin(newProgress(), { signature: levelSignature(legacyLevels[0]), levelId: 1, stars: 3, seconds: 99999, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      const { onProgress } = await mount(1, 'normal', { progress: before, islands });
      playToEnd();
      await flush();
      expect(texts()).toContain('Animali è aperta! Regalo: +3 monete');
      expect(onProgress.mock.calls[0][0].giftsOpened).toEqual(['animals']);
    });

    test('se i progressi non si scrivono si mostrano comunque le ricompense, con un avviso, e la partita salvata resta', async () => {
      const base = createMemorySaveStore();
      const store: SaveStore = { ...base, finishGame: async () => DISK_FULL };
      const { onProgress } = await mount(1, 'normal', { store });
      playPair(freePair()!);
      await flush();
      playToEnd();
      await flush();
      expect(texts()).toContain('Non riesco a salvare i progressi');
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(await savedGame(base)).not.toBeNull();
    });

    test('una partita ricostruita già vinta registra la vittoria al primo disegno', async () => {
      const session = wonSession(1, 'normal');
      const store = createMemorySaveStore();
      await store.saveGame(toSavedGame(session, 1));
      const { onProgress } = await mount(1, 'normal', { resume: session, store });
      await flush();
      expect(texts()).toContain('superato!');
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(await savedGame(store)).toBeNull();
    });

    test('la vittoria mostra i fuochi d\'artificio dietro la scheda: comuni, da finale al livello 20', async () => {
      const fireworks = () => (globalThis as unknown as { __fireworks?: { level: number; finale: boolean; reduced: boolean } }).__fireworks;
      await mount(1, 'normal');
      expect(fireworks()).toBeUndefined(); // durante la partita nessun fuoco
      await mount(1, 'normal', { resume: wonSession(1, 'normal') });
      await flush();
      expect(fireworks()).toEqual({ level: 1, finale: false, reduced: false });
      // Tra lo sfondo scuro e la scheda: nell'albero il canvas dei fuochi precede il titolo della scheda.
      const flat: { type: string; props: Record<string, unknown> }[] = [];
      const walk = (n: unknown): void => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        const node = n as { type: string; props: Record<string, unknown>; children?: unknown };
        flat.push(node);
        walk(node.children);
      };
      walk(screen.toJSON());
      const at = (pred: (n: (typeof flat)[number]) => boolean) => flat.findIndex(pred);
      expect(at((n) => n.props.testID === 'fireworks-layer')).toBeGreaterThan(-1);
      expect(at((n) => n.props.testID === 'fireworks-layer')).toBeLessThan(at((n) => n.props.testID === 'btn-restart'));
      await screen.unmount();
      await mount(20, 'normal', { resume: wonSession(20, 'normal') });
      await flush();
      expect(fireworks()).toEqual({ level: 20, finale: true, reduced: false });
    });

    test('con la riduzione del movimento del sistema i fuochi sono ridotti (non spenti, come nell\'originale)', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
      await mount(1, 'normal', { resume: wonSession(1, 'normal') });
      await flush();
      expect((globalThis as unknown as { __fireworks?: { reduced: boolean } }).__fireworks?.reduced).toBe(true);
    });

    test('il premio «+N» compare alla vittoria e svanisce quando finisce la dissolvenza', async () => {
      const { onProgress } = await mount(1);
      playToEnd();
      await flush();
      const coins = onProgress.mock.calls[0][0].coins - newProgress().coins;
      expect(coins).toBeGreaterThan(0);
      expect(screen.getByTestId('win-coins-reward')).toBeOnTheScreen();
      expect(texts()).toContain(`+${coins}`);
      expect(mockAnimationEnds).toHaveLength(1); // la dissolvenza finale è l'unica animazione con una funzione di fine
      act(() => mockAnimationEnds.forEach((end) => end(false))); // interrotta: resta
      expect(screen.queryByTestId('win-coins-reward')).not.toBeNull();
      act(() => mockAnimationEnds.forEach((end) => end(true))); // finita: sparisce
      expect(screen.queryByTestId('win-coins-reward')).toBeNull();
      expect(texts()).not.toContain(`+${coins}`);
    });

    test('con la riduzione del movimento il premio compare subito, pieno e fermo, senza animazione', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
      await mount(1);
      await act(async () => {});
      playToEnd();
      await flush();
      const reward = screen.getByTestId('win-coins-reward');
      expect(StyleSheet.flatten(reward.props.style)).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] });
      expect(mockAnimationEnds).toHaveLength(0);
    });

    test('la scheda di vittoria mostra il trofeo 🏆', async () => {
      await mount(1, 'normal', { resume: wonSession(1, 'normal') });
      await flush();
      expect(screen.getByTestId('win-trophy')).toBeOnTheScreen();
    });

    test('la scheda di vittoria mostra le stelle (win-stars)', async () => {
      await mount(1, 'normal', { resume: wonSession(1, 'normal') });
      await flush();
      expect(screen.getByTestId('win-stars')).toBeOnTheScreen();
    });

    test('con la riduzione del movimento le stelle compaiono già visibili, senza animazione', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
      await mount(1);
      await act(async () => {});
      playToEnd();
      await flush();
      // Le stelle attive hanno opacity:1 fin dall'inizio; nessuna animazione registrata oltre il premio
      expect(screen.getByTestId('win-stars')).toBeOnTheScreen();
      expect(screen.getByTestId('win-trophy')).toBeOnTheScreen();
    });

    test('la scheda di vittoria interpola il conteggio delle tessere d’oro', async () => {
      const session = wonSession(23, 'easy');
      expect(session.outcome).toMatchObject({ gold: 1, goldTotal: 1 });
      await mount(23, 'easy', { resume: session });
      await flush();
      expect(texts()).toContain("Tessere d'oro: 1/1");
    });

    test('una partita ricostruita già bloccata cancella la partita salvata', async () => {
      // Una partita bloccata vera è rara con il gioco a caso: come negli altri test la si costruisce dalla fase.
      const session: Session = { ...sessionOf(1, 'normal', 7, 3), phase: 'dead' };
      const store = createMemorySaveStore();
      await store.saveGame(toSavedGame(session, 1));
      const { onProgress } = await mount(1, 'normal', { resume: session, store });
      await flush();
      expect(texts()).toContain('Bloccato!');
      expect(onProgress).not.toHaveBeenCalled();
      expect(await savedGame(store)).toBeNull();
    });
  });

  describe('salvataggio che non riesce', () => {
    function flaky() {
      const base = createMemorySaveStore();
      const state = { failing: true };
      const store: SaveStore = { ...base, saveGame: async (game) => (state.failing ? DISK_FULL : base.saveGame(game)) };
      return { store, state };
    }

    test("il gioco continua; l'avviso compare al secondo errore di fila e sparisce al primo salvataggio riuscito", async () => {
      const { store, state } = flaky();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await mount(1, 'normal', { store });
      playPair(freePair()!);
      await flush();
      expect(texts()).not.toContain('Non riesco a salvare la partita');
      advance(300);
      playPair(freePair()!);
      await flush();
      expect(texts()).toContain('Non riesco a salvare la partita');
      expect(texts()).toContain(`${legacyLevels[0].cells.length - 4} coppie`);
      // La causa va nei log, a ogni errore: sullo schermo l'avviso non la dice.
      expect(warn.mock.calls).toEqual([
        [expect.stringContaining('"kind":"storage-failed","message":"disco pieno"')],
        [expect.stringContaining('"kind":"storage-failed","message":"disco pieno"')],
      ]);
      state.failing = false;
      advance(300);
      playPair(freePair()!);
      await flush();
      expect(texts()).not.toContain('Non riesco a salvare la partita');
    });
  });

  describe('GameScreen: modalità comoda (senior)', () => {
    test("senza modalità comoda il timer è visibile e il badge Comoda non c'è", async () => {
      await mount(1, 'normal');
      expect(screen.queryByTestId('timer')).not.toBeNull();
      expect(screen.queryByTestId('comfort-chip')).toBeNull();
    });

    test('con modalità comoda attiva, il cronometro è sostituito dal chip Comoda e gli aiuti sono infiniti', async () => {
      await mount(1, 'normal', { settings: { ...DEFAULT_SETTINGS, comfort: true } });
      expect(screen.queryByTestId('timer')).toBeNull();
      expect(screen.queryByTestId('comfort-chip')).not.toBeNull();
      expect(texts()).toContain('Comoda');
      expect(texts()).toContain('∞');
    });

    test('il livello 20 usa il layout comodo a 5 colonne (72 tessere) invece di quello standard (96 tessere)', async () => {
      await mount(20, 'normal', { settings: { ...DEFAULT_SETTINGS, comfort: true } });
      expect(board().tiles.length).toBe(72);
      expect(texts()).toContain('72 coppie');
    });

    test('aiuto automatico dopo 120s di inattività evidenzia una coppia senza consumare aiuti', async () => {
      await mount(1, 'normal', { settings: { ...DEFAULT_SETTINGS, comfort: true } });
      expect(board().hint).toEqual([]);
      advance(120_000);
      expect(board().hint.length).toBeGreaterThan(0);
      advance(2_500);
      expect(board().hint).toEqual([]);
    });
  });
});

describe('GameScreen: barra delle tessere selezionate', () => {
  const withBar = { ...DEFAULT_SETTINGS, selectedBar: true };

  test('di default non c\'è; la modalità comoda non la accende (resta un\'opzione a sé)', async () => {
    await mount(1);
    expect(screen.queryByTestId('selection-bar')).toBeNull();
    await screen.unmount();
    await mount(1, 'normal', { settings: { ...DEFAULT_SETTINGS, comfort: true } });
    expect(screen.queryByTestId('selection-bar')).toBeNull();
  });

  test('con l\'impostazione accesa c\'è, vuota, con due caselle', async () => {
    await mount(1, 'normal', { settings: withBar });
    expect(screen.queryByTestId('selection-bar')).not.toBeNull();
    expect(bar()).toMatchObject({ view: { slots: [], status: null }, recent: [], groupSize: 2 });
  });

  test('una tessera toccata compare nella barra con il suo disegno; toccata di nuovo sparisce', async () => {
    await mount(1, 'normal', { settings: withBar });
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(pair[0]); });
    expect(bar().view).toEqual({ slots: [board().designs[pair[0]]], status: null });
    act(() => { board().onTap(pair[0]); });
    expect(bar().view).toEqual({ slots: [], status: null });
  });

  test('una coppia: ✔ con le due tessere e l\'abbinamento tra i recenti; dopo 1100 ms la barra si svuota', async () => {
    await mount(1, 'normal', { settings: withBar });
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    playPair(pair);
    expect(bar().view).toEqual({ slots: [board().designs[pair[0]], board().designs[pair[1]]], status: 'ok' });
    expect(bar().recent).toEqual([board().designs[pair[0]]]);
    advance(1100);
    expect(bar().view).toEqual({ slots: [], status: null });
    expect(bar().recent).toHaveLength(1);
  });

  test('una tessera bloccata: segno «blocked» per 900 ms, poi torna la selezione', async () => {
    await mount(1, 'normal', { settings: withBar });
    const blocked = board().tiles.findIndex((_, i) => !board().free.has(i));
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(pair[0]); });
    act(() => { board().onTap(blocked); });
    expect(bar().view.status).toBe('blocked');
    advance(900);
    expect(bar().view).toEqual({ slots: [board().designs[pair[0]]], status: null });
  });

  test('nei livelli Tris la barra ha tre caselle', async () => {
    const tris = legacyLevels.findIndex((l) => l.groupSize === 3) + 1;
    expect(tris).toBeGreaterThan(0);
    await mount(tris, 'normal', { settings: withBar });
    expect(bar().groupSize).toBe(3);
  });
});

describe('GameScreen: daltonismo e alto contrasto', () => {
  const level = legacyLevels[0];
  const base = [...levelPalette(level.id, level.island)];
  const on = (extra: Partial<Settings>): { settings: Settings } => ({ settings: { ...DEFAULT_SETTINGS, ...extra } });

  test('di base: tavolozza del livello, nessun segnale, scurimento della difficoltà', async () => {
    await mount(1, 'hard', on({}));
    expect([...board().palette]).toEqual(base);
    expect(board().signals).toBe(false);
    expect(board().profile).toBe('hard');
  });

  test('daltonismo: tavolozza blu e arancio al posto di quella del livello, segnali accesi, scurimento fisso come Normale', async () => {
    await mount(1, 'hard', on({ colorBlind: true }));
    expect([...board().palette]).toEqual([...COLORBLIND_PALETTE]);
    expect(board().signals).toBe(true);
    expect(board().profile).toBe('normal');
  });

  test('alto contrasto: segnali accesi e scurimento fisso, ma la tavolozza resta quella del livello (la CBP è del solo daltonismo)', async () => {
    await mount(1, 'hard', on({ highContrast: true }));
    expect([...board().palette]).toEqual(base);
    expect(board().signals).toBe(true);
    expect(board().profile).toBe('normal');
  });

  test('la Modalità comoda non accende i segnali', async () => {
    await mount(1, 'normal', on({ comfort: true }));
    expect(board().signals).toBe(false);
  });

  test('sfondo e bordo scelti dall\'utente si applicano sopra la tavolozza del daltonismo', async () => {
    await mount(1, 'normal', on({ colorBlind: true, bgPalette: 'ocean', tilePalette: 'red' }));
    const ocean = BG_PALETTE_COLORS.ocean;
    const red = TILE_PALETTE_COLORS.red;
    expect([...board().palette]).toEqual([ocean.feltA, ocean.feltB, ocean.accent, red.edge, red.edge2]);
    await screen.unmount();
    await mount(1, 'normal', on({ colorBlind: true, bgPalette: 'ocean' }));
    expect([...board().palette]).toEqual([ocean.feltA, ocean.feltB, ocean.accent, COLORBLIND_PALETTE[3], COLORBLIND_PALETTE[4]]);
  });

  test('l\'alto contrasto arriva alla tavola solo con la sua impostazione (non con il daltonismo né con la Modalità comoda)', async () => {
    await mount(1, 'normal', on({ highContrast: true }));
    expect(board().highContrast).toBe(true);
    await screen.unmount();
    for (const extra of [{}, { colorBlind: true }, { comfort: true }] as Partial<Settings>[]) {
      await mount(1, 'normal', on(extra));
      expect(board().highContrast).toBe(false);
      await screen.unmount();
    }
  });

  test('alto contrasto: testi bianchi in testata e nei pulsanti, bordo nero di 2 px sui pulsanti, sfondo scuro dietro le impostazioni', async () => {
    const color = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as object) as { color?: string }).color;
    await mount(1, 'normal', { ...on({ highContrast: true }), onOpenSettings: jest.fn() });
    expect(color(screen.getByText('Livello 1'))).toBe('#fff');
    expect(color(screen.getByText(/coppie/))).toBe('#fff');
    expect(StyleSheet.flatten(screen.getByTestId('btn-hint').props.style)).toMatchObject({ borderWidth: 2, borderColor: '#000' });
    expect(StyleSheet.flatten(screen.getByTestId('btn-game-settings').props.style).backgroundColor).toBe('rgba(0,0,0,0.65)');
    await screen.unmount();
    await mount(1, 'normal', { ...on({}), onOpenSettings: jest.fn() });
    expect(color(screen.getByText('Livello 1'))).toBe('#f6efd9');
    expect(StyleSheet.flatten(screen.getByTestId('btn-hint').props.style)).toMatchObject({ borderWidth: 1 });
    expect(StyleSheet.flatten(screen.getByTestId('btn-game-settings').props.style).backgroundColor).toBe('rgba(0,0,0,0.2)');
  });

  test('la barra delle tessere selezionate riceve l\'alto contrasto solo con la sua impostazione', async () => {
    const received = () => (globalThis as unknown as { __bar: { highContrast?: boolean } }).__bar.highContrast;
    await mount(1, 'normal', on({ highContrast: true, selectedBar: true }));
    expect(received()).toBe(true);
    await screen.unmount();
    await mount(1, 'normal', on({ colorBlind: true, selectedBar: true }));
    expect(received()).toBe(false);
  });

  test('anche la barra delle tessere selezionate usa la tavolozza del daltonismo', async () => {
    await mount(1, 'normal', on({ colorBlind: true, selectedBar: true }));
    expect((globalThis as unknown as { __bar: { palette: string[] } }).__bar.palette).toEqual([...COLORBLIND_PALETTE]);
  });
});

describe('GameScreen: evidenzia-uguali', () => {
  const on = (extra: Partial<Settings>): { settings: Settings } => ({ settings: { ...DEFAULT_SETTINGS, ...extra } });
  const html = (jest.requireActual('fs') as { readFileSync(p: string, e: string): string }).readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
  const message = 'Nessuna tessera uguale è libera per ora';

  /** Il primo seme per cui la partita di quel livello soddisfa `wanted`: così la prova non dipende dalla sorte. */
  function seedWhere(levelId: number, wanted: (game: GameState) => boolean): number {
    for (let seed = 1; seed <= 300; seed++) {
      const started = startRound({ spec: toSpec(legacyLevels[levelId - 1]), profile: 'normal', seed });
      if (started.ok && wanted(started.value.session.game)) return seed;
    }
    throw new Error(`nessun seme adatto per il livello ${levelId}`);
  }
  /** Fa partire `GameScreen` (che sceglie il seme a caso) con quel seme. */
  async function mountWithSeed(seed: number, levelId: number, extra: Partial<Settings> = {}) {
    const random = jest.spyOn(Math, 'random').mockReturnValue((seed + 0.5) / 2147483647);
    try {
      await mount(levelId, 'normal', on(extra));
    } finally {
      random.mockRestore();
    }
  }
  const lockedAt = (game: GameState, i: number) => game.tiles[i].hiddenGroup > game.unlocked;
  const free = (game: GameState) => [...game.ft.freeList()];
  const pairOf = (game: GameState) => free(game).find((i) => !lockedAt(game, i) && equalFreeTiles(game, [i]).length > 0);
  const loneOf = (game: GameState) => free(game).find((i) => !lockedAt(game, i) && equalFreeTiles(game, [i]).length === 0);

  test('acceso di base: la selezione evidenzia le compagne libere', async () => {
    await mount(1, 'normal', on({}));
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(pair[0]); });
    expect(board().match).toContain(pair[1]);
    expect(board().match).not.toContain(pair[0]);
  });

  test('spento dalle impostazioni: nessuna evidenziazione, e le altre tessere non si scuriscono', async () => {
    await mount(1, 'normal', on({ highlightEqual: false }));
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(pair[0]); });
    expect(board().match).toEqual([]);
    expect(board().selected).toEqual([pair[0]]); // la selezione resta
  });

  test('la Modalità comoda non lo accende né lo spegne: vale l\'impostazione', async () => {
    await mount(1, 'normal', on({ comfort: true, highlightEqual: false }));
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(pair[0]); });
    expect(board().match).toEqual([]);
    await screen.unmount();
    await mount(1, 'normal', on({ comfort: true }));
    const again = freePair();
    if (!again) throw new Error('nessuna coppia libera');
    act(() => { board().onTap(again[0]); });
    expect(board().match.length).toBeGreaterThan(0);
  });

  test('una tessera nascosta libera dello stesso tipo non si evidenzia (svelerebbe il gioco)', async () => {
    const level = legacyLevels.find((l) => l.id >= 11)!.id;
    const seed = seedWhere(level, (g) => free(g).some((i) => !lockedAt(g, i) && free(g).some((l) => lockedAt(g, l) && g.tiles[l].type === g.tiles[i].type)));
    await mountWithSeed(seed, level);
    const b = board();
    const visible = [...b.free].find((i) => !b.statuses[i].locked && [...b.free].some((l) => b.statuses[l].locked && b.tiles[l].type === b.tiles[i].type))!;
    act(() => { board().onTap(visible); });
    expect(board().match.some((i) => board().statuses[i].locked)).toBe(false);
  });

  test('avviso «Nessuna tessera uguale è libera»: alla prima tessera senza compagne, per 2400 ms', async () => {
    expect(html).toContain("toast(tx('tNoMatchFree'),2400)");
    expect(NO_MATCH_MS).toBe(2400);
    const seed = seedWhere(1, (g) => loneOf(g) !== undefined);
    await mountWithSeed(seed, 1);
    expect(screen.queryByText(message)).toBeNull();
    act(() => { board().onTap(loneOf(startedGame(seed))!); });
    expect(screen.getByText(message)).toBeTruthy();
    advance(2000); // la durata degli altri avvisi: questo resta
    expect(screen.getByText(message)).toBeTruthy();
    advance(NO_MATCH_MS - 2000);
    expect(screen.queryByText(message)).toBeNull();
  });

  test('nessun avviso se la tessera ha una compagna libera, se si cambia tessera o se l\'evidenziazione è spenta', async () => {
    const seed = seedWhere(1, (g) => loneOf(g) !== undefined && pairOf(g) !== undefined);
    const game = startedGame(seed);
    await mountWithSeed(seed, 1);
    act(() => { board().onTap(pairOf(game)!); });
    expect(screen.queryByText(message)).toBeNull(); // ha una compagna libera
    act(() => { board().onTap(loneOf(game)!); }); // tessere diverse: non è una «prima scelta»
    expect(screen.queryByText(message)).toBeNull();
    await screen.unmount();
    await mountWithSeed(seed, 1, { highlightEqual: false });
    act(() => { board().onTap(loneOf(game)!); });
    expect(screen.queryByText(message)).toBeNull();
  });

  test('nei Tris l\'avviso c\'è solo alla prima tessera scelta, non alla seconda', async () => {
    const tris = legacyLevels.find((l) => l.groupSize === 3)!.id;
    const oneMate = (g: GameState) => free(g).find((i) => !lockedAt(g, i) && equalFreeTiles(g, [i]).length === 1);
    const seed = seedWhere(tris, (g) => oneMate(g) !== undefined);
    const game = startedGame(seed, tris);
    const first = oneMate(game)!;
    const second = equalFreeTiles(game, [first])[0];
    await mountWithSeed(seed, tris);
    act(() => { board().onTap(first); });
    expect(screen.getByText(message)).toBeTruthy(); // ne servono due e ce n'è una sola
    advance(NO_MATCH_MS);
    expect(screen.queryByText(message)).toBeNull();
    act(() => { board().onTap(second); }); // seconda tessera del gruppo: nessun nuovo avviso
    expect(board().selected).toEqual([first, second]);
    expect(screen.queryByText(message)).toBeNull();
  });

  /** La partita di quel seme, per sapere quali tessere toccare. */
  function startedGame(seed: number, levelId = 1): GameState {
    const started = startRound({ spec: toSpec(legacyLevels[levelId - 1]), profile: 'normal', seed });
    if (!started.ok) throw new Error('la partita non parte');
    return started.value.session.game;
  }
});

const formatTimeOf = (session: Session) => `${Math.floor(session.seconds / 60)}:${String(session.seconds % 60).padStart(2, '0')}`;
