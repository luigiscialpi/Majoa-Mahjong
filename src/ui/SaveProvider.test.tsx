import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { playRandomSession } from '../application/__fixtures__/play';
import { toSavedGame } from '../application/savedGame';
import { createMemorySaveStore, type SaveStore } from '../application/saveStore';
import { startSession } from '../application/session';
import { newProgress, recordWin } from '../domain/progress';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { SaveProvider, useSaves, type Saves } from './SaveProvider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let current: Saves | null = null;
function Probe() {
  current = useSaves();
  return <Text testID="probe">{`${current.home.resume.kind}|${current.home.progress.ok ? 'progressi' : 'errore'}`}</Text>;
}

const mounted: ReactTestRenderer[] = [];
async function mount(open: () => Promise<SaveStore>) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <SaveProvider open={open}>
        <Probe />
      </SaveProvider>,
    );
  });
  mounted.push(renderer);
  return renderer;
}
// Ogni elemento compare con il suo testID più volte (componente e nodo nativo): si tolgono i doppioni.
const ids = (r: ReactTestRenderer) => [...new Set(r.root.findAll((n) => typeof n.props.testID === 'string').map((n) => n.props.testID as string))];
const probe = (r: ReactTestRenderer) => String(r.root.findByProps({ testID: 'probe' }).props.children);

afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.unmount()));
  current = null;
});

const midGame = () => {
  const started = startSession({ spec: toSpec(legacyLevels[0]), profile: 'normal', seed: 7 });
  if (!started.ok) throw new Error('avvio');
  return playRandomSession(started.value, 7, 3);
};

describe('SaveProvider', () => {
  test('durante il caricamento mostra l\'attesa, poi le schermate con archivio e stato letto', async () => {
    let release!: (store: SaveStore) => void;
    const open = () => new Promise<SaveStore>((resolve) => (release = resolve));
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <SaveProvider open={open}>
          <Probe />
        </SaveProvider>,
      );
    });
    mounted.push(renderer);
    expect(ids(renderer)).toEqual(['saves-loading']);
    await act(async () => release(createMemorySaveStore()));
    expect(ids(renderer)).toEqual(['probe']);
    expect(probe(renderer)).toBe('none|progressi');
  });

  test('legge la partita in corso trovata all\'avvio', async () => {
    const store = createMemorySaveStore();
    await store.saveGame(toSavedGame(midGame(), 1));
    const renderer = await mount(async () => store);
    expect(probe(renderer)).toBe('ready|progressi');
    expect(current!.store).toBe(store);
  });

  test('una partita o dei progressi illeggibili non sono un errore di apertura: la schermata riceve lo stato', async () => {
    const renderer = await mount(async () => createMemorySaveStore({ progress: '{', game: 'xx' }));
    expect(probe(renderer)).toBe('broken|errore');
  });

  test('se l\'archivio non si apre mostra l\'errore con «Riprova», che riprova ad aprirlo', async () => {
    const open = jest.fn<Promise<SaveStore>, []>().mockRejectedValueOnce(new Error('non si apre')).mockResolvedValue(createMemorySaveStore());
    const renderer = await mount(open);
    expect(ids(renderer)).toEqual(['saves-failed', 'btn-retry-open']);
    await act(async () => renderer.root.findByProps({ testID: 'btn-retry-open' }).props.onPress());
    expect(ids(renderer)).toEqual(['probe']);
    expect(open).toHaveBeenCalledTimes(2);
  });

  test('«Riprova» mostra subito l\'attesa mentre riapre', async () => {
    let release!: (store: SaveStore) => void;
    const open = jest.fn<Promise<SaveStore>, []>().mockRejectedValueOnce(new Error('no')).mockImplementation(() => new Promise<SaveStore>((resolve) => (release = resolve)));
    const renderer = await mount(open);
    await act(async () => renderer.root.findByProps({ testID: 'btn-retry-open' }).props.onPress());
    expect(ids(renderer)).toEqual(['saves-loading']);
    await act(async () => release(createMemorySaveStore()));
    expect(ids(renderer)).toEqual(['probe']);
  });

  test('rileggere non riapre l\'archivio ma ne rilegge il contenuto', async () => {
    const store = createMemorySaveStore();
    const open = jest.fn(async () => store);
    const renderer = await mount(open);
    expect(probe(renderer)).toBe('none|progressi');
    await store.saveGame(toSavedGame(midGame(), 1));
    await act(async () => current!.reload());
    expect(probe(renderer)).toBe('ready|progressi');
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('setProgress aggiorna i progressi in memoria e lascia il resto', async () => {
    const store = createMemorySaveStore();
    await store.saveGame(toSavedGame(midGame(), 1));
    await mount(async () => store);
    const won = recordWin(newProgress(), { levelId: 1, stars: 3, seconds: 40, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    act(() => current!.setProgress(won));
    expect(current!.home.progress).toEqual({ ok: true, value: won });
    expect(current!.home.resume.kind).toBe('ready');
  });

  test('useSaves fuori dal provider è un errore', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      act(() => {
        create(<Probe />);
      }),
    ).toThrow('useSaves fuori da SaveProvider');
    jest.restoreAllMocks();
  });
});
