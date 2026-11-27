import { newProgress, type Progress } from '../domain/progress';
import { beginPuzzle, finishPuzzle, leavePuzzle } from './puzzleFlow';
import { createMemorySaveStore, type SaveStore } from './saveStore';
import { serializeProgress } from './progressCodec';

const withCoins = (coins: number, extra: Partial<Progress> = {}): Progress => ({ ...newProgress(), coins, ...extra });
const storeWith = (progress: Progress): SaveStore => createMemorySaveStore({ progress: serializeProgress(progress) });
const saved = async (store: SaveStore): Promise<Progress> => {
  const loaded = await store.loadProgress();
  if (!loaded.ok) throw new Error('progressi illeggibili');
  return loaded.value;
};
const failing = (store: SaveStore): SaveStore => ({ ...store, saveProgress: async () => ({ ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } }) });

describe('beginPuzzle', () => {
  test('toglie 1 ✨ e la scrive subito', async () => {
    const store = storeWith(withCoins(3));
    const start = await beginPuzzle(store, withCoins(3));
    expect(start).toEqual({ kind: 'started', progress: withCoins(2) });
    expect((await saved(store)).coins).toBe(2);
  });

  test('senza ✨ non parte e non scrive', async () => {
    const store = storeWith(withCoins(0));
    expect(await beginPuzzle(store, withCoins(0))).toEqual({ kind: 'no-coins' });
    expect((await saved(store)).coins).toBe(0);
  });

  test('se la scrittura fallisce non parte e dà l\'errore', async () => {
    const start = await beginPuzzle(failing(storeWith(withCoins(3))), withCoins(3));
    expect(start).toEqual({ kind: 'failed', error: { kind: 'storage-failed', message: 'disco pieno' } });
  });
});

describe('leavePuzzle', () => {
  test('rende la ✨ e la scrive', async () => {
    const store = storeWith(withCoins(2));
    expect(await leavePuzzle(store, withCoins(2))).toEqual({ ok: true, value: withCoins(3) });
    expect((await saved(store)).coins).toBe(3);
  });

  test('se la scrittura fallisce dà l\'errore', async () => {
    expect(await leavePuzzle(failing(storeWith(withCoins(2))), withCoins(2))).toEqual({ ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } });
  });
});

describe('finishPuzzle', () => {
  test('la prima vittoria dà 2 ✨ e registra le stelle, scritte subito', async () => {
    const store = storeWith(withCoins(2));
    const done = await finishPuzzle(store, withCoins(2), 'memory', 'easy', 3, false);
    expect(done).toMatchObject({ stars: 3, coins: 2, newRecord: true, saved: { ok: true } });
    const after = await saved(store);
    expect(after.coins).toBe(4);
    expect(after.puzzles).toEqual({ 'memory:easy': 3 });
  });

  test('con un aiuto le stelle sono 2; rigiocando niente ✨ e il record resta', async () => {
    const store = storeWith(withCoins(2, { puzzles: { 'memory:easy': 3 } }));
    const done = await finishPuzzle(store, withCoins(2, { puzzles: { 'memory:easy': 3 } }), 'memory', 'easy', 3, true);
    expect(done).toMatchObject({ stars: 2, coins: 0, newRecord: false });
    const after = await saved(store);
    expect(after.coins).toBe(2);
    expect(after.puzzles['memory:easy']).toBe(3);
  });

  test('se la scrittura fallisce lo dice, ma il risultato si mostra comunque', async () => {
    const done = await finishPuzzle(failing(storeWith(withCoins(2))), withCoins(2), 'memory', 'hard', 2, false);
    expect(done.saved).toEqual({ ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } });
    expect(done.progress.puzzles['memory:hard']).toBe(2);
  });
});
