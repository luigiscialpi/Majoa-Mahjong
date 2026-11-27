import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { newProgress, type Progress } from '../domain/progress';
import { PUZZLE_IDS } from '../domain/puzzles';
import { LanguageProvider, type Language } from '../infrastructure/i18n';
import { GamesScreen, starsText } from './GamesScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

async function setup(progress: Progress = { ...newProgress(), coins: 3 }, language: Language = 'it') {
  const onPlay = jest.fn();
  await render(
    <LanguageProvider initial={language}>
      <GamesScreen progress={progress} onPlay={onPlay} />
    </LanguageProvider>,
  );
  return { onPlay };
}

describe('elenco dei rompicapi', () => {
  test('ci sono i dieci rompicapi dell\'originale, con i loro nomi', async () => {
    await setup();
    const names = ['Memory', 'Pezzo mancante', 'Sudoku degli animali', 'Puzzle scorrevole', 'Labirinto', 'Trova le differenze', 'Smista i barattoli', 'Collega le coppie', 'Cerca parole', 'Unisci i puntini'];
    expect(PUZZLE_IDS).toHaveLength(names.length);
    // ogni riga ha il nome del suo rompicapo, nell'ordine dell'originale
    PUZZLE_IDS.forEach((id, i) => expect(within(screen.getByTestId(`games-row-${id}`)).getByText(names[i])).toBeTruthy());
    expect(screen.getByText('Giochi')).toBeTruthy();
  });

  test('si legge anche in inglese e in francese', async () => {
    await setup(undefined, 'en');
    expect(screen.getByText('Games')).toBeTruthy();
    expect(screen.getByText('Spot the differences')).toBeTruthy();
    expect(screen.getAllByText('Coming soon')).toHaveLength(9);
  });

  test('in francese titolo e scritta «in arrivo»', async () => {
    await setup(undefined, 'fr');
    expect(screen.getByText('Jeux')).toBeTruthy();
    expect(screen.getAllByText('Bientôt')).toHaveLength(9);
  });

  test('solo Memory si può giocare: gli altri nove sono «In arrivo» e non hanno pulsanti', async () => {
    await setup();
    expect(screen.getAllByText('In arrivo')).toHaveLength(9);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  test('mostra le ✨ che ci sono', async () => {
    await setup({ ...newProgress(), coins: 7 });
    expect(screen.getByTestId('games-coins').props.children).toBe('✨ 7');
  });
});

describe('Memory: difficoltà e stelle', () => {
  test('stelle migliori per ogni difficoltà; senza vittorie tre stelle vuote', async () => {
    await setup({ ...newProgress(), coins: 3, puzzles: { 'memory:easy': 3, 'memory:hard': 1 } });
    expect(screen.getByTestId('games-memory-easy-stars').props.children).toBe('★★★');
    expect(screen.getByTestId('games-memory-medium-stars').props.children).toBe('☆☆☆');
    expect(screen.getByTestId('games-memory-hard-stars').props.children).toBe('★☆☆');
    expect(within(screen.getByTestId('games-memory-easy')).getByText('Facile')).toBeTruthy();
    expect(within(screen.getByTestId('games-memory-medium')).getByText('Medio')).toBeTruthy();
    expect(within(screen.getByTestId('games-memory-hard')).getByText('Difficile')).toBeTruthy();
  });

  test('le stelle di un altro rompicapo non contano', async () => {
    await setup({ ...newProgress(), coins: 3, puzzles: { 'sudoku:easy': 3 } });
    expect(screen.getByTestId('games-memory-easy-stars').props.children).toBe('☆☆☆');
  });

  test('toccare una difficoltà avvia Memory con quella difficoltà', async () => {
    const { onPlay } = await setup();
    await fireEvent.press(screen.getByTestId('games-memory-medium'));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith('memory', 'medium');
    await fireEvent.press(screen.getByTestId('games-memory-hard'));
    expect(onPlay).toHaveBeenLastCalledWith('memory', 'hard');
  });

  test('con una sola ✨ si può iniziare', async () => {
    const { onPlay } = await setup({ ...newProgress(), coins: 1 });
    expect(screen.getByTestId('games-memory-easy').props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('games-memory-easy'));
    expect(onPlay).toHaveBeenCalledWith('memory', 'easy');
  });

  test('senza ✨ le difficoltà sono grigie e non avviano niente', async () => {
    const { onPlay } = await setup({ ...newProgress(), coins: 0 });
    for (const difficulty of ['easy', 'medium', 'hard']) {
      expect(screen.getByTestId(`games-memory-${difficulty}`).props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(screen.getByTestId(`games-memory-${difficulty}`));
    }
    expect(onPlay).not.toHaveBeenCalled();
  });
});

describe('starsText', () => {
  test.each([[0, '☆☆☆'], [1, '★☆☆'], [2, '★★☆'], [3, '★★★']])('%i stelle: %s', (stars, text) => {
    expect(starsText(stars)).toBe(text);
  });
});
