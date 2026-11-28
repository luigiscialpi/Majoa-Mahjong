import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { serializeProgress } from '../application/progressCodec';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { createMemory, type MemoryState } from '../domain/memoryPuzzle';
import { newProgress, type Progress } from '../domain/progress';
import { ANIMAL_DESIGNS } from '../infrastructure/content/puzzleAnimals';
import { LanguageProvider } from '../infrastructure/i18n';
import { MemoryScreen } from './MemoryScreen';

// Come in `SelectionBar.test.tsx`: le miniature disegnano con Skia e Reanimated, che i test non caricano
jest.mock('./miniTiles', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { MiniTile: ({ slot }: { slot: unknown }) => React.createElement(View, { testID: `mini-${String(slot)}` }) };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.setTimeout(20_000);

const SEED = 3;
const board: MemoryState = createMemory('easy', ANIMAL_DESIGNS, SEED);

/** Le due posizioni di ogni disegno (la partita del test è quella del seme). */
function pairs(): [number, number][] {
  const first = new Map<number, number>();
  const out: [number, number][] = [];
  board.cards.forEach((design, i) => {
    const other = first.get(design);
    if (other === undefined) first.set(design, i);
    else out.push([other, i]);
  });
  return out;
}
/** Due carte con disegni diversi. */
const differentPair = (): [number, number] => [0, board.cards.findIndex((design) => design !== board.cards[0])];

const saved = async (store: SaveStore): Promise<Progress> => {
  const loaded = await store.loadProgress();
  if (!loaded.ok) throw new Error('progressi illeggibili');
  return loaded.value;
};
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const card = (i: number) => `memory-card-${i}`;
const isUp = (i: number) => screen.getByTestId(card(i)).props.accessibilityState.selected === true;
const wait = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

async function setup(coins = 3, extra: Partial<Progress> = {}, wrap: (store: SaveStore) => SaveStore = (s) => s) {
  const progress: Progress = { ...newProgress(), coins, ...extra };
  const store = wrap(createMemorySaveStore({ progress: serializeProgress(progress) }));
  const onProgress = jest.fn();
  const onExit = jest.fn();
  await render(
    <LanguageProvider initial="it">
      <MemoryScreen difficulty="easy" store={store} progress={progress} onProgress={onProgress} onExit={onExit} seed={SEED} />
    </LanguageProvider>,
  );
  return { store, onProgress, onExit };
}

async function playAll() {
  for (const [a, b] of pairs()) {
    await press(card(a));
    await press(card(b));
  }
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('avvio', () => {
  test('toglie 1 ✨, la scrive subito e mostra la griglia 3×4', async () => {
    const { store, onProgress } = await setup(3);
    expect(await screen.findByTestId(card(11))).toBeTruthy();
    expect(screen.queryByTestId(card(12))).toBeNull();
    expect(screen.getByTestId('memory-coins').props.children).toBe('✨ 2');
    expect((await saved(store)).coins).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ coins: 2 }));
    expect(screen.getByTestId('memory-attempts').props.children).toBe('Tentativi: 0');
  });

  test('senza ✨ mostra l\'avviso, non mostra le carte e non scrive', async () => {
    const { store, onExit } = await setup(0);
    expect(await screen.findByTestId('memory-notice')).toBeTruthy();
    expect(screen.getByTestId('memory-notice').props.children).toContain('Monete insufficienti');
    expect(screen.queryByTestId(card(0))).toBeNull();
    expect((await saved(store)).coins).toBe(0);
    await press('memory-notice-exit');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('se la scrittura fallisce non parte', async () => {
    const failing = (store: SaveStore): SaveStore => ({ ...store, saveProgress: async () => ({ ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } }) });
    await setup(3, {}, failing);
    expect(await screen.findByTestId('memory-notice')).toBeTruthy();
    expect(screen.queryByTestId(card(0))).toBeNull();
  });
});

describe('partita', () => {
  test('due carte uguali restano girate e contano un tentativo', async () => {
    await setup();
    await screen.findByTestId(card(0));
    const [a, b] = pairs()[0];
    await press(card(a));
    expect(isUp(a)).toBe(true);
    await press(card(b));
    expect([isUp(a), isUp(b)]).toEqual([true, true]);
    expect(screen.getByTestId('memory-attempts').props.children).toBe('Tentativi: 1');
  });

  test('due carte diverse si rigirano dopo 0,8 s e nel frattempo le altre non si girano', async () => {
    await setup();
    await screen.findByTestId(card(0));
    const [a, b] = differentPair();
    await press(card(a));
    await press(card(b));
    expect([isUp(a), isUp(b)]).toEqual([true, true]);
    const other = [...board.cards.keys()].find((i) => i !== a && i !== b)!;
    await press(card(other));
    expect(isUp(other)).toBe(false);
    await wait(799);
    expect(isUp(a)).toBe(true);
    await wait(1);
    expect([isUp(a), isUp(b)]).toEqual([false, false]);
  });
});

describe('vittoria', () => {
  test('senza errori: 3 stelle, +2 ✨ della prima volta, scritti subito', async () => {
    const { store, onExit } = await setup(3);
    await screen.findByTestId(card(0));
    await playAll();
    expect(screen.queryByTestId('memory-win')).toBeNull();
    await wait(699);
    expect(screen.queryByTestId('memory-win')).toBeNull();
    await wait(1);
    await act(async () => {}); // il tempo di scrivere i progressi
    expect(screen.getByTestId('memory-win')).toBeTruthy();
    expect(screen.getByTestId('gift-title').props.children).toBe('Bravo!');
    expect(screen.getByTestId('gift-body').props.children).toBe('★★★\nPrima vittoria: +2 monete');
    const after = await saved(store);
    expect(after.coins).toBe(4);
    expect(after.puzzles).toEqual({ 'memory:easy': 3 });
    await press('gift-ok');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('rigiocando non ci sono altre ✨', async () => {
    const { store } = await setup(3, { puzzles: { 'memory:easy': 3 } });
    await screen.findByTestId(card(0));
    await playAll();
    await wait(700);
    expect(await screen.findByTestId('memory-win')).toBeTruthy();
    expect(screen.getByTestId('gift-body').props.children).toBe('★★★\nAncora bravo!');
    expect((await saved(store)).coins).toBe(2);
  });

  test('con tentativi sbagliati le stelle scendono: 6 coppie e 7 errori sono 1 stella', async () => {
    await setup(3);
    await screen.findByTestId(card(0));
    const [a, b] = differentPair();
    for (let i = 0; i < 7; i++) {
      await press(card(a));
      await press(card(b));
      await wait(800);
    }
    await playAll();
    await wait(700);
    expect(await screen.findByTestId('memory-win')).toBeTruthy();
    expect(screen.getByTestId('gift-body').props.children).toBe('★☆☆\nPrima vittoria: +2 monete');
  });
});

describe('aiuto', () => {
  test('mostra tutte le carte per 1,5 s e dice che le stelle arrivano a 2', async () => {
    await setup(3);
    await screen.findByTestId(card(0));
    expect(screen.getByTestId('memory-hint').props.accessibilityLabel).toBe('Aiuto (3)');
    await press('memory-hint');
    expect([...board.cards.keys()].every(isUp)).toBe(true);
    expect(screen.getByTestId('memory-note').props.children).toBe('Guarda bene le carte! · con aiuto: massimo 2 ★');
    expect(screen.getByTestId('memory-hint').props.accessibilityLabel).toBe('Aiuto (2)');
    await wait(1499);
    expect(isUp(0)).toBe(true);
    await wait(1);
    expect([...board.cards.keys()].some(isUp)).toBe(false);
  });

  test('con un aiuto usato la vittoria dà al massimo 2 stelle', async () => {
    await setup(3);
    await screen.findByTestId(card(0));
    await press('memory-hint');
    await wait(1500);
    await playAll();
    await wait(700);
    expect(await screen.findByTestId('memory-win')).toBeTruthy();
    expect(screen.getByTestId('gift-body').props.children).toBe('★★☆\nPrima vittoria: +2 monete');
  });

  test('dopo tre aiuti non ce ne sono più', async () => {
    await setup(3);
    await screen.findByTestId(card(0));
    for (let i = 0; i < 3; i++) {
      await press('memory-hint');
      await wait(1500);
    }
    expect(screen.getByTestId('memory-hint').props.accessibilityLabel).toBe('Aiuto (0)');
    await press('memory-hint');
    expect(screen.getByTestId('memory-note').props.children).toContain('Non ci sono più aiuti per questo rompicapo');
  });
});

describe('uscita', () => {
  test('senza tentativi la ✨ torna indietro', async () => {
    const { store, onExit, onProgress } = await setup(3);
    await screen.findByTestId(card(0));
    await press(card(0));
    await press('memory-back');
    await act(async () => {});
    expect((await saved(store)).coins).toBe(3);
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ coins: 3 }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('dopo un tentativo la ✨ resta pagata', async () => {
    const { store, onExit } = await setup(3);
    await screen.findByTestId(card(0));
    const [a, b] = pairs()[0];
    await press(card(a));
    await press(card(b));
    await press('memory-back');
    await act(async () => {});
    expect((await saved(store)).coins).toBe(2);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
