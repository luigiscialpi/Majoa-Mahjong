import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { playRandomSession } from '../application/__fixtures__/play';
import { toSavedGame } from '../application/savedGame';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { startSession } from '../application/session';
import { newProgress, recordWin } from '../domain/progress';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { LanguageProvider } from '../infrastructure/i18n';
import { SaveProvider, useSaves, type Saves } from './SaveProvider';

let current: Saves | null = null;
function Probe() {
  current = useSaves();
  return <Text testID="probe">{`${current.home.resume.kind}|${current.home.progress.ok ? 'progressi' : 'errore'}`}</Text>;
}

async function mount(open: () => Promise<SaveStore>) {
  return render(
    <SaveProvider open={open}>
      <Probe />
    </SaveProvider>,
  );
}

afterEach(() => {
  current = null;
});

const midGame = () => {
  const started = startSession({ spec: toSpec(legacyLevels[0]), profile: 'normal', seed: 7 });
  if (!started.ok) throw new Error('avvio');
  return playRandomSession(started.value, 7, 3);
};

describe('SaveProvider', () => {
  test("durante il caricamento mostra l'attesa, poi le schermate con archivio e stato letto", async () => {
    let release!: (store: SaveStore) => void;
    const open = () => new Promise<SaveStore>((resolve) => (release = resolve));
    await render(
      <SaveProvider open={open}>
        <Probe />
      </SaveProvider>,
    );

    expect(screen.getByTestId('saves-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('probe')).not.toBeOnTheScreen();

    await act(async () => {
      release(createMemorySaveStore());
    });

    expect(screen.queryByTestId('saves-loading')).not.toBeOnTheScreen();
    expect(screen.getByTestId('probe')).toHaveTextContent('none|progressi');
  });

  test("legge la partita in corso trovata all'avvio", async () => {
    const store = createMemorySaveStore();
    await store.saveGame(toSavedGame(midGame(), 1));
    await mount(async () => store);
    expect(screen.getByTestId('probe')).toHaveTextContent('ready|progressi');
    expect(current!.store).toBe(store);
  });

  test('una partita o dei progressi illeggibili non sono un errore di apertura: la schermata riceve lo stato', async () => {
    await mount(async () => createMemorySaveStore({ progress: '{', game: 'xx' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('broken|errore');
  });

  test("se l'archivio non si apre mostra l'errore con «Riprova», che riprova ad aprirlo", async () => {
    const open = jest.fn<Promise<SaveStore>, []>().mockRejectedValueOnce(new Error('non si apre')).mockResolvedValue(createMemorySaveStore());
    await mount(open);
    expect(screen.getByTestId('saves-failed')).toBeOnTheScreen();
    expect(screen.getByTestId('btn-retry-open')).toBeOnTheScreen();
    expect(screen.queryByTestId('probe')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('btn-retry-open'));
    expect(screen.getByTestId('probe')).toBeOnTheScreen();
    expect(open).toHaveBeenCalledTimes(2);
  });

  test('caricamento e errori di apertura seguono la lingua selezionata', async () => {
    let rejectOpen!: (error: Error) => void;
    const open = () => new Promise<SaveStore>((_, reject) => (rejectOpen = reject));

    await render(
      <LanguageProvider initial="en">
        <SaveProvider open={open}>
          <Probe />
        </SaveProvider>
      </LanguageProvider>,
    );

    expect(screen.getByText('Loading your progress...')).toBeOnTheScreen();

    await act(async () => {
      rejectOpen(new Error('disk unavailable'));
    });

    expect(screen.getByText('Unable to open saved games')).toBeOnTheScreen();
    expect(screen.getByText('Your game and progress have not been changed.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  test("«Riprova» mostra subito l'attesa mentre riapre", async () => {
    let release!: (store: SaveStore) => void;
    const open = jest.fn<Promise<SaveStore>, []>().mockRejectedValueOnce(new Error('no')).mockImplementation(() => new Promise<SaveStore>((resolve) => (release = resolve)));
    await mount(open);
    await fireEvent.press(screen.getByTestId('btn-retry-open'));
    expect(screen.getByTestId('saves-loading')).toBeOnTheScreen();

    await act(async () => {
      release(createMemorySaveStore());
    });
    expect(screen.getByTestId('probe')).toBeOnTheScreen();
  });

  test("rileggere non riapre l'archivio ma ne rilegge il contenuto", async () => {
    const store = createMemorySaveStore();
    const open = jest.fn(async () => store);
    await mount(open);
    expect(screen.getByTestId('probe')).toHaveTextContent('none|progressi');

    await store.saveGame(toSavedGame(midGame(), 1));
    await act(async () => {
      await current!.reload();
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('ready|progressi');
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('setProgress aggiorna i progressi in memoria e lascia il resto', async () => {
    const store = createMemorySaveStore();
    await store.saveGame(toSavedGame(midGame(), 1));
    await mount(async () => store);
    const won = recordWin(newProgress(), { levelId: 1, stars: 3, seconds: 40, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    await act(async () => {
      current!.setProgress(won);
    });
    expect(current!.home.progress).toEqual({ ok: true, value: won });
    expect(current!.home.resume.kind).toBe('ready');
  });

  test('useSaves fuori dal provider è un errore', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Probe />)).rejects.toThrow('useSaves fuori da SaveProvider');
    jest.restoreAllMocks();
  });
});
