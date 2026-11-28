import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { serializeProgress } from '../application/progressCodec';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { newProgress, type Progress } from '../domain/progress';
import { createSudoku } from '../domain/sudokuPuzzle';
import { ANIMAL_DESIGNS } from '../infrastructure/content/puzzleAnimals';
import { LanguageProvider } from '../infrastructure/i18n';
import { SudokuScreen } from './SudokuScreen';

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
const board = createSudoku('easy', ANIMAL_DESIGNS, SEED);
const blanks = board.grid.flatMap((v, i) => (v < 0 ? [i] : []));
const given = board.fixed.findIndex(Boolean);
const wrongValue = (i: number) => (board.solution[i] + 1) % 4;

const cell = (i: number) => `sudoku-cell-${i}`;
const pick = (v: number) => `sudoku-pick-${v}`;
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const isSelected = (i: number) => screen.getByTestId(cell(i)).props.accessibilityState.selected === true;
const hasAnimal = (i: number, v: number) => within(screen.getByTestId(cell(i))).queryByTestId(`mini-${board.symbols[v]}`) !== null;
const isEmpty = (i: number) => within(screen.getByTestId(cell(i))).queryByTestId(/^mini-/) === null;
const wait = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
const saved = async (store: SaveStore): Promise<Progress> => {
  const loaded = await store.loadProgress();
  if (!loaded.ok) throw new Error('progressi illeggibili');
  return loaded.value;
};

async function fillCell(i: number) {
  await press(cell(i));
  await press(pick(board.solution[i]));
}
async function solveAll() {
  for (const i of blanks) await fillCell(i);
}

async function setup(coins = 3, extra: Partial<Progress> = {}, wrap: (store: SaveStore) => SaveStore = (s) => s) {
  const progress: Progress = { ...newProgress(), coins, ...extra };
  const store = wrap(createMemorySaveStore({ progress: serializeProgress(progress) }));
  const onProgress = jest.fn();
  const onExit = jest.fn();
  await render(
    <LanguageProvider initial="it">
      <SudokuScreen difficulty="easy" store={store} progress={progress} onProgress={onProgress} onExit={onExit} seed={SEED} />
    </LanguageProvider>,
  );
  return { store, onProgress, onExit };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('avvio', () => {
  test('toglie 1 ✨, la scrive subito e mostra la griglia 4×4 con le caselle date', async () => {
    const { store, onProgress } = await setup(3);
    expect(await screen.findByTestId(cell(15))).toBeTruthy();
    expect(screen.queryByTestId(cell(16))).toBeNull();
    expect(screen.getByTestId('sudoku-coins').props.children).toBe('✨ 2');
    expect((await saved(store)).coins).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ coins: 2 }));
    expect(screen.getByTestId('sudoku-errors').props.children).toBe('Errori: 0');
    expect(screen.getByTestId('sudoku-hint').props.accessibilityLabel).toBe('Aiuto (3)');
    expect(blanks).toHaveLength(6);
    for (let i = 0; i < 16; i++) expect(isEmpty(i)).toBe(blanks.includes(i));
  });

  test('senza ✨ mostra l\'avviso, non mostra la griglia e non scrive', async () => {
    const { store, onExit } = await setup(0);
    expect(await screen.findByTestId('sudoku-notice')).toBeTruthy();
    expect(screen.getByTestId('sudoku-notice').props.children).toContain('Monete insufficienti');
    expect(screen.queryByTestId(cell(0))).toBeNull();
    expect((await saved(store)).coins).toBe(0);
    await press('sudoku-notice-exit');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('se la scrittura fallisce non parte', async () => {
    const failing = (store: SaveStore): SaveStore => ({ ...store, saveProgress: async () => ({ ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } }) });
    await setup(3, {}, failing);
    expect(await screen.findByTestId('sudoku-notice')).toBeTruthy();
    expect(screen.queryByTestId(cell(0))).toBeNull();
  });
});

describe('scegliere e mettere gli animali', () => {
  test('una casella vuota si sceglie, una data dall\'inizio no', async () => {
    await setup();
    await screen.findByTestId(cell(0));
    await press(cell(given));
    expect(isSelected(given)).toBe(false);
    await press(cell(blanks[0]));
    expect(isSelected(blanks[0])).toBe(true);
    await press(cell(blanks[1]));
    expect([isSelected(blanks[0]), isSelected(blanks[1])]).toEqual([false, true]);
  });

  test('l\'animale giusto entra e la casella resta scelta', async () => {
    await setup();
    await screen.findByTestId(cell(0));
    const i = blanks[0];
    await fillCell(i);
    expect(hasAnimal(i, board.solution[i])).toBe(true);
    expect(isSelected(i)).toBe(true);
    expect(screen.getByTestId('sudoku-errors').props.children).toBe('Errori: 0');
  });

  test('uno sbagliato non entra, conta un errore e la casella lo segnala per 0,45 s', async () => {
    await setup();
    await screen.findByTestId(cell(0));
    const i = blanks[blanks.length - 1]; // non la prima casella, così si vede che lampeggia quella scelta
    await press(cell(i));
    await press(pick(wrongValue(i)));
    expect(isEmpty(i)).toBe(true);
    expect(screen.getByTestId('sudoku-errors').props.children).toBe('Errori: 1');
    expect(screen.getByTestId(cell(i)).props.accessibilityValue).toEqual({ text: 'Sbagliato' });
    await wait(449);
    expect(screen.getByTestId(cell(i)).props.accessibilityValue).toEqual({ text: 'Sbagliato' });
    await wait(1);
    expect(screen.getByTestId(cell(i)).props.accessibilityValue?.text).toBeUndefined();
  });

  test('senza casella scelta toccare un animale non fa niente', async () => {
    await setup();
    await screen.findByTestId(cell(0));
    await press(pick(0));
    expect(screen.getByTestId('sudoku-errors').props.children).toBe('Errori: 0');
    expect(blanks.every(isEmpty)).toBe(true);
  });

  test('la gomma svuota una casella', async () => {
    await setup();
    await screen.findByTestId(cell(0));
    const i = blanks[0];
    await fillCell(i);
    await press('sudoku-erase');
    expect(isEmpty(i)).toBe(true);
  });
});

describe('vittoria', () => {
  test('senza errori: 3 stelle, +2 ✨ della prima volta, scritti subito', async () => {
    const { store, onExit } = await setup(3);
    await screen.findByTestId(cell(0));
    await solveAll();
    expect(screen.queryByTestId('sudoku-win')).toBeNull();
    await wait(399);
    expect(screen.queryByTestId('sudoku-win')).toBeNull();
    await wait(1);
    await act(async () => {}); // il tempo di scrivere i progressi
    expect(screen.getByTestId('sudoku-win')).toBeTruthy();
    expect(screen.getByTestId('gift-title').props.children).toBe('Bravo!');
    expect(screen.getByTestId('gift-body').props.children).toBe('★★★\nPrima vittoria: +2 monete');
    const after = await saved(store);
    expect(after.coins).toBe(4);
    expect(after.puzzles).toEqual({ 'sudoku:easy': 3 });
    await press('gift-ok');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test.each([[1, '★★☆'], [2, '★★☆'], [3, '★☆☆']])('con %i errori: %s', async (errors, stars) => {
    await setup(3);
    await screen.findByTestId(cell(0));
    for (let k = 0; k < errors; k++) {
      await press(cell(blanks[0]));
      await press(pick(wrongValue(blanks[0])));
    }
    await solveAll();
    await wait(400);
    await act(async () => {});
    expect(screen.getByTestId('gift-body').props.children).toBe(`${stars}\nPrima vittoria: +2 monete`);
  });

  test('rigiocando non ci sono altre ✨', async () => {
    const { store } = await setup(3, { puzzles: { 'sudoku:easy': 3 } });
    await screen.findByTestId(cell(0));
    await solveAll();
    await wait(400);
    await act(async () => {});
    expect(screen.getByTestId('gift-body').props.children).toBe('★★★\nAncora bravo!');
    expect((await saved(store)).coins).toBe(2);
  });

  test('a partita vinta le caselle e gli animali non rispondono più', async () => {
    await setup(3);
    await screen.findByTestId(cell(0));
    await solveAll();
    await press(pick(wrongValue(blanks[blanks.length - 1])));
    expect(screen.getByTestId('sudoku-errors').props.children).toBe('Errori: 0');
  });
});

describe('aiuto', () => {
  test('riempie una casella a caso, dice che le stelle arrivano a 2 e ne restano due', async () => {
    await setup(3);
    await screen.findByTestId(cell(0));
    await press('sudoku-hint');
    expect(blanks.filter((i) => !isEmpty(i))).toHaveLength(1);
    expect(screen.getByTestId('sudoku-note').props.children).toBe('È stata riempita una casella · con aiuto: massimo 2 ★');
    expect(screen.getByTestId('sudoku-hint').props.accessibilityLabel).toBe('Aiuto (2)');
  });

  test('con un aiuto usato la vittoria dà al massimo 2 stelle', async () => {
    await setup(3);
    await screen.findByTestId(cell(0));
    await press('sudoku-hint');
    await solveAll();
    await wait(400);
    await act(async () => {});
    expect(screen.getByTestId('gift-body').props.children).toBe('★★☆\nPrima vittoria: +2 monete');
  });

  test('dopo tre aiuti non ce ne sono più', async () => {
    await setup(3);
    await screen.findByTestId(cell(0));
    for (let n = 0; n < 3; n++) await press('sudoku-hint');
    expect(screen.getByTestId('sudoku-hint').props.accessibilityLabel).toBe('Aiuto (0)');
    await press('sudoku-hint');
    expect(screen.getByTestId('sudoku-note').props.children).toContain('Non ci sono più aiuti per questo rompicapo');
  });
});

describe('uscita', () => {
  test('senza aver messo niente la ✨ torna indietro, anche dopo aver scelto una casella o usato un aiuto', async () => {
    const { store, onExit, onProgress } = await setup(3);
    await screen.findByTestId(cell(0));
    await press(cell(blanks[0]));
    await press('sudoku-hint');
    await press('sudoku-back');
    await act(async () => {});
    expect((await saved(store)).coins).toBe(3);
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ coins: 3 }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('dopo un animale messo, anche sbagliato, la ✨ resta pagata', async () => {
    const { store, onExit } = await setup(3);
    await screen.findByTestId(cell(0));
    await press(cell(blanks[0]));
    await press(pick(wrongValue(blanks[0])));
    await press('sudoku-back');
    await act(async () => {});
    expect((await saved(store)).coins).toBe(2);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
