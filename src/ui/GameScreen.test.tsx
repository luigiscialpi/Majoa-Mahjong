import { Children } from 'react';
import { Text } from 'react-native';
import type { Profile } from '../domain/profile';
import { STAR_TYPE } from '../domain/types';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { GameScreen } from './GameScreen';
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

const { act, create } = jest.requireActual('react-test-renderer'); // senza tipi: `any`
const originalError = console.error;
const mounted: any[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  console.error = (...args: unknown[]) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.123);
});
afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.unmount()));
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const board = (): TileBoardProps => (globalThis as unknown as { __board: TileBoardProps }).__board;
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const press = (renderer: any, testID: string) => act(() => renderer.root.findAllByProps({ testID })[0].props.onPress());
const texts = (renderer: any): string => renderer.root.findAllByType(Text).map((t: any) => Children.toArray(t.props.children).join('')).join(' | ');

/** Nei test non c'è layout: si simula quello dell'area della tavola (un telefono). Su un dispositivo arriva da solo a ogni montaggio. */
const layout = (renderer: any) =>
  act(() => renderer.root.findAll((n: any) => typeof n.props.onLayout === 'function')[0].props.onLayout({ nativeEvent: { layout: { width: 360, height: 560 } } }));

function mount(levelId = 1, profile: Profile = 'normal') {
  const onExit = jest.fn();
  let renderer: any;
  act(() => {
    renderer = create(<GameScreen level={legacyLevels[levelId - 1]} profile={profile} onExit={onExit} />);
  });
  layout(renderer);
  mounted.push(renderer);
  return { renderer, onExit };
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
  act(() => board().onTap(pair[0]));
  act(() => board().onTap(pair[1]));
};

describe('GameScreen', () => {
  test('mostra intestazione e aiuti e passa le tessere alla tavola', () => {
    const { renderer } = mount(1);
    const total = legacyLevels[0].cells.length;
    expect(texts(renderer)).toContain('Livello 1');
    expect(texts(renderer)).toContain(`Normale · ${total} tessere`);
    for (const label of ['Aiuto', 'Annulla', 'Mischia']) expect(texts(renderer)).toContain(label);
    const b = board();
    expect([b.tiles.length, b.designs.length, b.statuses.length, b.gone.size, b.removing.size, b.removeKey, b.selected.length]).toEqual([total, total, total, 0, 0, 0, 0]);
    expect(b.free.size).toBeGreaterThan(0);
  });

  test('un tocco seleziona; fuori da ogni tessera non succede nulla', () => {
    mount(1);
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    act(() => board().onTap(pair[0]));
    expect(board().selected).toEqual([pair[0]]);
    act(() => board().onTap(null));
    expect(board().selected).toEqual([pair[0]]);
  });

  test('una coppia si toglie: prima «in rimozione» per 250 ms senza sparire per un fotogramma, poi tolta', () => {
    const { renderer } = mount(1);
    const total = legacyLevels[0].cells.length;
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    playPair(pair);
    expect([...board().removing].sort((a, b) => a - b)).toEqual([...pair].sort((a, b) => a - b));
    expect([board().gone.size, board().removeKey, board().selected.length]).toEqual([0, 1, 0]);
    expect(pair.some((i) => board().free.has(i))).toBe(false);
    expect(texts(renderer)).toContain(`${total - 2} tessere`);
    advance(300);
    expect([board().removing.size, [...board().gone].sort((a, b) => a - b)]).toEqual([0, [...pair].sort((a, b) => a - b)]);
  });

  test('il tempo scorre ogni secondo', () => {
    const { renderer } = mount(1);
    expect(texts(renderer)).toContain('0:00');
    advance(3000);
    expect(texts(renderer)).toContain('0:03');
  });

  test('una tessera bloccata dà un avviso che sparisce dopo due secondi', () => {
    const { renderer } = mount(1);
    const blocked = board().tiles.findIndex((_, i) => !board().free.has(i));
    act(() => board().onTap(blocked));
    expect(texts(renderer)).toContain('Tessera bloccata');
    advance(2100);
    expect(texts(renderer)).not.toContain('Tessera bloccata');
  });

  test('Aiuto evidenzia una coppia per due secondi', () => {
    const { renderer } = mount(1);
    press(renderer, 'btn-hint');
    expect(board().hint.length).toBe(2);
    advance(2100);
    expect(board().hint.length).toBe(0);
  });

  test('Annulla rimette la coppia; Mischia cambia i disegni senza cambiare le tessere rimaste', () => {
    const { renderer } = mount(1);
    const total = legacyLevels[0].cells.length;
    const pair = freePair();
    if (!pair) throw new Error('nessuna coppia libera');
    playPair(pair);
    advance(300);
    press(renderer, 'btn-undo');
    expect([board().gone.size, board().removing.size, texts(renderer).includes(`${total} tessere`)]).toEqual([0, 0, true]);
    const before = board().designs;
    press(renderer, 'btn-shuffle');
    expect(board().designs).not.toEqual(before);
    expect(texts(renderer)).toContain(`${total} tessere`);
  });

  test('giocando fino in fondo (con il rimescolo automatico quando serve) compare la vittoria; Rigioca ricomincia', () => {
    const { renderer } = mount(1);
    const total = legacyLevels[0].cells.length;
    for (let n = 0; n < 600 && !texts(renderer).includes('Livello completato!'); n++) {
      const pair = freePair();
      if (pair) playPair(pair);
      else advance(1200); // nessuna mossa: dopo l'avviso parte il rimescolo automatico
      advance(300);
    }
    expect(texts(renderer)).toContain('Livello completato!');
    expect(texts(renderer)).toMatch(/[★☆]{3}/);
    expect(texts(renderer)).toContain('Tempo');
    press(renderer, 'btn-restart');
    layout(renderer); // la schermata si rimonta: l'area riparte da zero finché non arriva il layout
    expect(texts(renderer)).not.toContain('Livello completato!');
    expect(texts(renderer)).toContain(`${total} tessere`);
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

  test('senza mosse: dopo l\'avviso parte il rimescolo automatico e si può continuare', () => {
    // Livello 20 con questo seme: giocando sempre la prima coppia si resta senza mosse con molte tessere (verificato).
    (Math.random as jest.Mock).mockReturnValue(0.2);
    const { renderer } = mount(20);
    const remaining = playUntilStuck();
    expect(remaining).toBeGreaterThan(10);
    expect(texts(renderer)).not.toContain('tessere rimescolate'); // prima dell'avviso non è ancora successo nulla
    advance(1100);
    expect(texts(renderer)).toContain('Nessuna mossa: tessere rimescolate');
    expect(freePair()).not.toBeNull();
    expect(board().tiles.length - board().gone.size).toBe(remaining);
  });

  test('senza mosse e senza soluzione: si consiglia Annulla (non Mischia) e Annulla riporta una mossa', () => {
    // Livello 10 con questo seme: restano 4 tessere impilate, che nessun rimescolo può sbloccare (verificato).
    (Math.random as jest.Mock).mockReturnValue(0.75);
    const { renderer } = mount(10);
    expect(playUntilStuck()).toBe(4);
    advance(1100);
    expect(texts(renderer)).toContain('Nessuna mossa: prova Annulla');
    expect(texts(renderer)).not.toContain('usa Mischia');
    advance(2100);
    press(renderer, 'btn-undo');
    expect(freePair()).not.toBeNull();
    expect(board().tiles.length - board().gone.size).toBe(6);
  });

  test('la freccia di ritorno chiama onExit', () => {
    const { renderer, onExit } = mount(1);
    press(renderer, 'btn-back');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
