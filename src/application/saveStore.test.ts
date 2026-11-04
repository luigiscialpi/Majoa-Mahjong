import { newProgress, recordWin, type Progress } from '../domain/progress';
import { serializeProgress } from './progressCodec';
import { createMemorySaveStore } from './saveStore';
import { serializeSavedGame, toSavedGame, type SavedGame } from './savedGame';
import { startSession } from './session';
import { pyramid90 } from '../domain/__fixtures__/shapes';
import type { LevelSpec } from '../domain/types';

const SPEC: LevelSpec = { id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids: { hints: 5, shuffles: 3, undo: null } };
const started = startSession({ spec: SPEC, profile: 'normal', seed: 5 });
if (!started.ok) throw new Error('avvio');
const game: SavedGame = toSavedGame(started.value, 7);
const won: Progress = recordWin(newProgress(), { levelId: 7, stars: 3, seconds: 60, gold: 0, profile: 'normal', noTimePressure: false }).progress;

describe('archivio in memoria', () => {
  test('vuoto: progressi iniziali e nessuna partita', async () => {
    const store = createMemorySaveStore();
    expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
    expect(await store.loadGame()).toEqual({ ok: true, value: null });
  });

  test('salva e rilegge i progressi e la partita', async () => {
    const store = createMemorySaveStore();
    expect(await store.saveProgress(won)).toEqual({ ok: true, value: undefined });
    expect(await store.saveGame(game)).toEqual({ ok: true, value: undefined });
    expect(await store.loadProgress()).toEqual({ ok: true, value: won });
    expect(await store.loadGame()).toEqual({ ok: true, value: game });
  });

  test('una nuova partita sostituisce la precedente', async () => {
    const store = createMemorySaveStore();
    await store.saveGame(game);
    const other = { ...game, levelId: 8 };
    await store.saveGame(other);
    expect(await store.loadGame()).toEqual({ ok: true, value: other });
  });

  test('clearGame toglie la partita e lascia i progressi', async () => {
    const store = createMemorySaveStore();
    await store.saveProgress(won);
    await store.saveGame(game);
    expect(await store.clearGame()).toEqual({ ok: true, value: undefined });
    expect(await store.loadGame()).toEqual({ ok: true, value: null });
    expect(await store.loadProgress()).toEqual({ ok: true, value: won });
  });

  test('finishGame scrive i progressi e toglie la partita', async () => {
    const store = createMemorySaveStore();
    await store.saveGame(game);
    expect(await store.finishGame(won)).toEqual({ ok: true, value: undefined });
    expect(await store.loadProgress()).toEqual({ ok: true, value: won });
    expect(await store.loadGame()).toEqual({ ok: true, value: null });
  });

  test('resetAll riporta i progressi iniziali e toglie la partita', async () => {
    const store = createMemorySaveStore();
    await store.saveProgress(won);
    await store.saveGame(game);
    expect(await store.resetAll()).toEqual({ ok: true, value: undefined });
    expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
    expect(await store.loadGame()).toEqual({ ok: true, value: null });
  });

  test('parte da contenuti scritti a mano', async () => {
    const store = createMemorySaveStore({ progress: serializeProgress(won), game: serializeSavedGame(game) });
    expect(await store.loadProgress()).toEqual({ ok: true, value: won });
    expect(await store.loadGame()).toEqual({ ok: true, value: game });
  });

  test('un contenuto illeggibile dà un errore tipizzato e non si cancella da solo', async () => {
    const store = createMemorySaveStore({ progress: '{', game: '{"version":2}' });
    expect(await store.loadProgress()).toEqual({ ok: false, error: { kind: 'malformed', field: 'json' } });
    expect(await store.loadGame()).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 2 } });
    expect(await store.loadGame()).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 2 } });
  });

  test('una partita illeggibile non tocca i progressi', async () => {
    const store = createMemorySaveStore({ progress: serializeProgress(won), game: 'xx' });
    expect((await store.loadGame()).ok).toBe(false);
    expect(await store.loadProgress()).toEqual({ ok: true, value: won });
  });

  test('due archivi non condividono i dati', async () => {
    const a = createMemorySaveStore();
    const b = createMemorySaveStore();
    await a.saveGame(game);
    expect(await b.loadGame()).toEqual({ ok: true, value: null });
  });
});
