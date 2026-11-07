import { act } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { playRandomSession } from '../application/__fixtures__/play';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { restoreSession, toSavedGame } from '../application/savedGame';
import { startSession, type Session } from '../application/session';
import type { Profile } from '../domain/profile';
import { newProgress, recordWin } from '../domain/progress';
import { STAR_TYPE } from '../domain/types';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { GameScreen, type GameScreenProps } from './GameScreen';
import type { TileBoardProps } from './TileBoard';

// Si prova la logica della schermata (effetti, timer, avvisi, animazione, vittoria) con la tavola Skia sostituita da un
// finto componente che registra le proprietà ricevute. Il disegno vero si prova solo su dispositivo.
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('./svgs', () => ({ useTileSvgs: () => Array.from({ length: 129 }, () => null) }));
jest.mock('./TileBoard', () => ({
  TileBoard: (props: unknown) => {
    (globalThis as { __board?: unknown }).__board = props;
    return null;
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.123);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const board = (): TileBoardProps => (globalThis as unknown as { __board: TileBoardProps }).__board;
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

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

async function mount(levelId = 1, profile: Profile = 'normal', extra: Partial<GameScreenProps> = {}) {
  const onExit = jest.fn();
  const onProgress = jest.fn();
  const store = extra.store ?? createMemorySaveStore();
  const res = await render(
    <GameScreen
      level={legacyLevels[levelId - 1]}
      profile={profile}
      onExit={onExit}
      store={store}
      progress={newProgress()}
      onProgress={onProgress}
      {...extra}
    />,
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
  test('mostra intestazione e aiuti e passa le tessere alla tavola', async () => {
    await mount(1);
    const total = legacyLevels[0].cells.length;
    expect(texts()).toContain('Livello 1');
    expect(texts()).toContain(`Normale · ${total} tessere`);
    for (const label of ['Aiuto', 'Annulla', 'Mischia']) expect(texts()).toContain(label);
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
    expect(texts()).toContain(`${total - 2} tessere`);
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
    expect(texts()).toContain('Tessera bloccata');
    advance(2100);
    expect(texts()).not.toContain('Tessera bloccata');
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
    expect([board().gone.size, board().removing.size, texts().includes(`${total} tessere`)]).toEqual([0, 0, true]);
    const before = board().designs;
    press('btn-shuffle');
    expect(board().designs).not.toEqual(before);
    expect(texts()).toContain(`${total} tessere`);
  });

  test('giocando fino in fondo (con il rimescolo automatico quando serve) compare la vittoria; Rigioca ricomincia', async () => {
    await mount(1);
    const total = legacyLevels[0].cells.length;
    for (let n = 0; n < 600 && !texts().includes('Livello completato!'); n++) {
      const pair = freePair();
      if (pair) playPair(pair);
      else advance(1200); // nessuna mossa: dopo l'avviso parte il rimescolo automatico
      advance(300);
    }
    expect(texts()).toContain('Livello completato!');
    expect(texts()).toMatch(/[★☆]{3}/);
    expect(texts()).toContain('Tempo');
    press('btn-restart');
    layout(); // la schermata si rimonta: l'area riparte da zero finché non arriva il layout
    expect(texts()).not.toContain('Livello completato!');
    expect(texts()).toContain(`${total} tessere`);
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
    expect(texts()).not.toContain('tessere rimescolate'); // prima dell'avviso non è ancora successo nulla
    advance(1100);
    expect(texts()).toContain('Nessuna mossa: tessere rimescolate');
    expect(freePair()).not.toBeNull();
    expect(board().tiles.length - board().gone.size).toBe(remaining);
  });

  test('senza mosse e senza soluzione: si consiglia Annulla (non Mischia) e Annulla riporta una mossa', async () => {
    // Livello 10 con questo seme: restano 4 tessere impilate, che nessun rimescolo può sbloccare (verificato).
    (Math.random as jest.Mock).mockReturnValue(0.75);
    await mount(10);
    expect(playUntilStuck()).toBe(4);
    advance(1100);
    expect(texts()).toContain('Nessuna mossa: prova Annulla');
    expect(texts()).not.toContain('usa Mischia');
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
    for (let n = 0; n < 600 && !texts().includes('Livello completato!'); n++) {
      const pair = freePair();
      if (pair) playPair(pair);
      else advance(1200);
      advance(300);
    }
    expect(texts()).toContain('Livello completato!');
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
    expect(texts()).toContain(`${session.game.remaining} tessere`);
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
    expect(texts()).not.toContain('Livello completato!');
    expect(texts()).toContain(`${legacyLevels[0].cells.length} tessere`);
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
      expect(await store.loadProgress()).toEqual({ ok: true, value: progress });
      expect(texts()).toMatch(/[★☆]{3}/);
      const coins = progress.coins - newProgress().coins;
      if (coins > 0) expect(texts()).toContain(`+${coins} ✨`);
      expect(texts()).not.toContain('Nuovo record!');
      expect(texts()).not.toContain('Non riesco a salvare');
    });

    test('un tempo migliore di un record esistente mostra «Nuovo record!»', async () => {
      const slow = recordWin(newProgress(), { levelId: 1, stars: 1, seconds: 99999, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      await mount(1, 'normal', { progress: slow });
      playToEnd();
      await flush();
      expect(texts()).toContain('Nuovo record!');
    });

    test('una vittoria che non migliora nulla non dà ✨ né «Nuovo record!»', async () => {
      const best = recordWin(newProgress(), { levelId: 1, stars: 3, seconds: 1, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      const { onProgress } = await mount(1, 'normal', { progress: best });
      playToEnd();
      await flush();
      expect(onProgress.mock.calls[0][0].coins).toBe(best.coins);
      expect(texts()).not.toContain('✨');
      expect(texts()).not.toContain('Nuovo record!');
    });

    test("aprire un'isola mostra il regalo, una volta sola", async () => {
      const islands = [
        { id: 'prologue', levelIds: [1], gift: 0 },
        { id: 'animals', levelIds: [2], gift: 3 },
      ];
      const before = recordWin(newProgress(), { levelId: 1, stars: 3, seconds: 99999, gold: 0, profile: 'normal', noTimePressure: false }).progress;
      const { onProgress } = await mount(1, 'normal', { progress: before, islands });
      playToEnd();
      await flush();
      expect(texts()).toContain('Isola Animali aperta: +3 ✨');
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
      expect(texts()).toContain('⚠ Non riesco a salvare i progressi');
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(await savedGame(base)).not.toBeNull();
    });

    test('una partita ricostruita già vinta registra la vittoria al primo disegno', async () => {
      const session = wonSession(1, 'normal');
      const store = createMemorySaveStore();
      await store.saveGame(toSavedGame(session, 1));
      const { onProgress } = await mount(1, 'normal', { resume: session, store });
      await flush();
      expect(texts()).toContain('Livello completato!');
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(await savedGame(store)).toBeNull();
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
      await mount(1, 'normal', { store });
      playPair(freePair()!);
      await flush();
      expect(texts()).not.toContain('Non riesco a salvare la partita');
      advance(300);
      playPair(freePair()!);
      await flush();
      expect(texts()).toContain('⚠ Non riesco a salvare la partita');
      expect(texts()).toContain(`${legacyLevels[0].cells.length - 4} tessere`);
      state.failing = false;
      advance(300);
      playPair(freePair()!);
      await flush();
      expect(texts()).not.toContain('Non riesco a salvare la partita');
    });
  });
});

const formatTimeOf = (session: Session) => `${Math.floor(session.seconds / 60)}:${String(session.seconds % 60).padStart(2, '0')}`;
