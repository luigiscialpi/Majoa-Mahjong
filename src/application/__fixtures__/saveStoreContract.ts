import { pyramid90 } from '../../domain/__fixtures__/shapes';
import { newProgress, recordWin, type Progress } from '../../domain/progress';
import type { LevelSpec } from '../../domain/types';
import { serializeProgress } from '../progressCodec';
import type { SaveStore } from '../saveStore';
import { serializeSavedGame, toSavedGame, type SavedGame } from '../savedGame';
import { startSession } from '../session';

const SPEC: LevelSpec = { id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids: { hints: 5, shuffles: 3, undo: null } };
const started = startSession({ spec: SPEC, profile: 'normal', seed: 5 });
if (!started.ok) throw new Error('avvio');

export const sampleGame: SavedGame = toSavedGame(started.value, 7);
export const sampleProgress: Progress = recordWin(newProgress(), { levelId: 7, stars: 3, seconds: 60, gold: 0, profile: 'normal', noTimePressure: false }).progress;

/** Crea un archivio nuovo, eventualmente con contenuti scritti a mano (anche illeggibili). */
export type StoreFactory = (initial?: { progress?: string; game?: string }) => SaveStore | Promise<SaveStore>;

const done = { ok: true, value: undefined };

/** Comportamento che ogni archivio deve avere, in memoria o su disco. */
export function describeSaveStore(name: string, create: StoreFactory): void {
  describe(name, () => {
    test('vuoto: progressi iniziali e nessuna partita', async () => {
      const store = await create();
      expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
      expect(await store.loadGame()).toEqual({ ok: true, value: null });
    });

    test('salva e rilegge i progressi e la partita', async () => {
      const store = await create();
      expect(await store.saveProgress(sampleProgress)).toEqual(done);
      expect(await store.saveGame(sampleGame)).toEqual(done);
      expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
      expect(await store.loadGame()).toEqual({ ok: true, value: sampleGame });
    });

    test('una nuova partita sostituisce la precedente', async () => {
      const store = await create();
      await store.saveGame(sampleGame);
      const other = { ...sampleGame, levelId: 8 };
      await store.saveGame(other);
      expect(await store.loadGame()).toEqual({ ok: true, value: other });
    });

    test('clearGame toglie la partita e lascia i progressi', async () => {
      const store = await create();
      await store.saveProgress(sampleProgress);
      await store.saveGame(sampleGame);
      expect(await store.clearGame()).toEqual(done);
      expect(await store.loadGame()).toEqual({ ok: true, value: null });
      expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
    });

    test('finishGame scrive i progressi e toglie la partita', async () => {
      const store = await create();
      await store.saveGame(sampleGame);
      expect(await store.finishGame(sampleProgress)).toEqual(done);
      expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
      expect(await store.loadGame()).toEqual({ ok: true, value: null });
    });

    test('resetAll riporta i progressi iniziali e toglie la partita', async () => {
      const store = await create();
      await store.saveProgress(sampleProgress);
      await store.saveGame(sampleGame);
      expect(await store.resetAll()).toEqual(done);
      expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
      expect(await store.loadGame()).toEqual({ ok: true, value: null });
    });

    test('parte da contenuti scritti a mano', async () => {
      const store = await create({ progress: serializeProgress(sampleProgress), game: serializeSavedGame(sampleGame) });
      expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
      expect(await store.loadGame()).toEqual({ ok: true, value: sampleGame });
    });

    test('un contenuto illeggibile dà un errore tipizzato e non si cancella da solo', async () => {
      const store = await create({ progress: '{', game: '{"version":2}' });
      expect(await store.loadProgress()).toEqual({ ok: false, error: { kind: 'malformed', field: 'json' } });
      expect(await store.loadGame()).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 2 } });
      expect(await store.loadGame()).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 2 } });
    });

    test('una partita illeggibile non tocca i progressi', async () => {
      const store = await create({ progress: serializeProgress(sampleProgress), game: 'xx' });
      expect((await store.loadGame()).ok).toBe(false);
      expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
    });

    test('due archivi non condividono i dati', async () => {
      const a = await create();
      const b = await create();
      await a.saveGame(sampleGame);
      expect(await b.loadGame()).toEqual({ ok: true, value: null });
    });
  });
}
