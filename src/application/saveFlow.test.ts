import { grid, pyramid90 } from '../domain/__fixtures__/shapes';
import { newProgress, recordWin, type IslandInfo, type Progress } from '../domain/progress';
import type { LevelSpec } from '../domain/types';
import { playRandomSession, snapshot } from './__fixtures__/play';
import { serializeProgress } from './progressCodec';
import { createAutosaver, finishWin, loadHome, planStart, prepareWin, type Resume } from './saveFlow';
import type { SaveError } from './saveFormat';
import { serializeSavedGame, toSavedGame } from './savedGame';
import { createMemorySaveStore, type SaveStore } from './saveStore';
import { startSession, type Session } from './session';
import { SIG, sameContent } from './__fixtures__/content';

const SPEC: LevelSpec = { id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [4, 4], fog: 6, gold: 5, aids: { hints: 5, shuffles: 3, undo: null } };
const FLAT: LevelSpec = { ...SPEC, cells: grid(6, 6, 0), types: 6, hidden: [], fog: 0, gold: 0 };
const DISK_FULL: { ok: false; error: SaveError } = { ok: false, error: { kind: 'storage-failed', message: 'disco pieno' } };

function start(spec: LevelSpec, profile: 'easy' | 'normal' | 'hard' = 'normal', seed = 5, noTimePressure = false): Session {
  const r = startSession({ spec, profile, seed, noTimePressure });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

/** Una partita vinta; con `seconds` si fissa il tempo dell'esito. */
function won(seconds?: number, noTimePressure = false): Session {
  const played = playRandomSession(start(FLAT, 'normal', 1, noTimePressure), 1);
  if (played.phase !== 'won' || !played.outcome) throw new Error('la partita di prova doveva essere vinta');
  return seconds === undefined ? played : { ...played, seconds, outcome: { ...played.outcome, seconds } };
}

const midGame = () => playRandomSession(start(SPEC, 'hard', 5), 7, 20);

describe('loadHome', () => {
  test('archivio vuoto: progressi iniziali e nessuna partita', async () => {
    expect(await loadHome(createMemorySaveStore(), sameContent)).toEqual({ progress: { ok: true, value: newProgress() }, resume: { kind: 'none' } });
  });

  test('con una partita salvata dà la sessione ricostruita e quanto serve alla scheda «Continua»', async () => {
    const played = midGame();
    const store = createMemorySaveStore();
    await store.saveGame(toSavedGame(played, 20));
    const { resume } = await loadHome(store, sameContent);
    if (resume.kind !== 'ready') throw new Error(`atteso ready, trovato ${resume.kind}`);
    expect(resume.info).toEqual({ levelId: 20, profile: 'hard', seconds: played.seconds, remaining: played.game.remaining });
    expect(resume.info.remaining).toBeLessThan(90);
    expect(resume.saved).toEqual(toSavedGame(played, 20));
    expect(snapshot(resume.session)).toEqual(snapshot(played));
  });

  test('una partita illeggibile non toglie i progressi e non dice quale livello fosse', async () => {
    const store = createMemorySaveStore({ game: 'xx' });
    const home = await loadHome(store, sameContent);
    expect(home.progress).toEqual({ ok: true, value: newProgress() });
    expect(home.resume).toEqual({ kind: 'broken', error: { kind: 'malformed', field: 'json' }, saved: null });
  });

  test.each<[string, Partial<ReturnType<typeof toSavedGame>>, SaveError['kind']]>([
    ['impronta diversa', { fingerprint: '0000000000000000' }, 'board-mismatch'],
    ['evento che non si applica', { events: [{ kind: 'undo' }] }, 'event-rejected'],
    ['specifica che non si genera', { spec: { ...SPEC, cells: SPEC.cells.slice(0, 89) } }, 'start-failed'],
  ])('una partita che si legge ma non si ricostruisce (%s) tiene il documento letto', async (_, change, kind) => {
    const saved = { ...toSavedGame(midGame(), 20), ...change };
    const { resume } = await loadHome(createMemorySaveStore({ game: serializeSavedGame(saved) }), sameContent);
    expect(resume).toMatchObject({ kind: 'broken', error: { kind }, saved });
  });

  test('progressi illeggibili non toccano la partita', async () => {
    const store = createMemorySaveStore({ progress: '{' });
    await store.saveGame(toSavedGame(midGame(), 20));
    const home = await loadHome(store, sameContent);
    expect(home.progress).toEqual({ ok: false, error: { kind: 'malformed', field: 'json' } });
    expect(home.resume.kind).toBe('ready');
  });

  test('un errore di lettura della partita non toglie i progressi', async () => {
    const base = createMemorySaveStore();
    const home = await loadHome({ ...base, loadGame: async () => DISK_FULL }, sameContent);
    expect(home.progress).toEqual({ ok: true, value: newProgress() });
    expect(home.resume).toEqual({ kind: 'broken', error: DISK_FULL.error, saved: null });
  });

  test('un errore di lettura dei progressi non toglie la partita', async () => {
    const base = createMemorySaveStore();
    await base.saveGame(toSavedGame(midGame(), 20));
    const home = await loadHome({ ...base, loadProgress: async () => DISK_FULL }, sameContent);
    expect(home.progress).toEqual(DISK_FULL);
    expect(home.resume.kind).toBe('ready');
  });
});

describe('planStart', () => {
  const info = { levelId: 20, profile: 'hard', seconds: 252, remaining: 40 } as const;
  const ready = (): Resume => ({ kind: 'ready', saved: toSavedGame(midGame(), 20), session: midGame(), info });

  test('senza partita salvata si parte subito', () => {
    expect(planStart({ kind: 'none' })).toEqual({ kind: 'start' });
  });

  test('con una partita da riprendere chiede conferma e dice cosa si perde', () => {
    expect(planStart(ready())).toEqual({ kind: 'confirm', info });
  });

  test('una partita illeggibile non si può riprendere: non chiede conferma', () => {
    expect(planStart({ kind: 'broken', error: { kind: 'board-mismatch' }, saved: null })).toEqual({ kind: 'start' });
  });
});

describe('createAutosaver', () => {
  /** Archivio la cui scrittura della partita si può far fallire. */
  function flaky() {
    const base = createMemorySaveStore();
    const state = { failing: false };
    const store: SaveStore = { ...base, saveGame: async (game) => (state.failing ? DISK_FULL : base.saveGame(game)) };
    const calls: boolean[] = [];
    return { store, state, calls, autosaver: createAutosaver(store, 20, (trouble) => calls.push(trouble)) };
  }

  test('salva la partita del livello indicato', async () => {
    const { store, autosaver } = flaky();
    const played = midGame();
    await autosaver.save(played);
    expect(await store.loadGame()).toEqual({ ok: true, value: toSavedGame(played, 20) });
  });

  test('ogni errore di scrittura passa la sua causa a `onError`, un salvataggio riuscito no', async () => {
    const base = createMemorySaveStore();
    let failing = true;
    const store: SaveStore = { ...base, saveGame: async (game) => (failing ? DISK_FULL : base.saveGame(game)) };
    const errors: SaveError[] = [];
    const autosaver = createAutosaver(store, 20, () => {}, (error) => errors.push(error));
    await autosaver.save(midGame());
    await autosaver.save(midGame());
    await autosaver.save(midGame());
    expect(errors).toEqual([DISK_FULL.error, DISK_FULL.error, DISK_FULL.error]);
    failing = false;
    await autosaver.save(midGame());
    expect(errors).toHaveLength(3);
  });

  test('senza `onError` un errore non cambia nulla', async () => {
    const { state, calls, autosaver } = flaky();
    state.failing = true;
    await autosaver.save(midGame());
    await autosaver.save(midGame());
    expect(calls).toEqual([true]);
  });

  test('un errore solo non dà l\'avviso', async () => {
    const { state, calls, autosaver } = flaky();
    state.failing = true;
    await autosaver.save(midGame());
    expect(calls).toEqual([]);
  });

  test('al secondo errore di fila scatta l\'avviso, una volta sola', async () => {
    const { state, calls, autosaver } = flaky();
    state.failing = true;
    for (let i = 0; i < 5; i++) await autosaver.save(midGame());
    expect(calls).toEqual([true]);
  });

  test('un salvataggio riuscito azzera la serie e, se c\'era l\'avviso, lo toglie', async () => {
    const { state, calls, autosaver } = flaky();
    state.failing = true;
    await autosaver.save(midGame());
    await autosaver.save(midGame());
    state.failing = false;
    await autosaver.save(midGame());
    expect(calls).toEqual([true, false]);
    state.failing = true;
    await autosaver.save(midGame());
    expect(calls).toEqual([true, false]);
    await autosaver.save(midGame());
    expect(calls).toEqual([true, false, true]);
  });

  test('errore, successo, errore: nessun avviso', async () => {
    const { state, calls, autosaver } = flaky();
    state.failing = true;
    await autosaver.save(midGame());
    state.failing = false;
    await autosaver.save(midGame());
    state.failing = true;
    await autosaver.save(midGame());
    expect(calls).toEqual([]);
  });

  test('un salvataggio riuscito senza errori prima non segnala nulla', async () => {
    const { calls, autosaver } = flaky();
    await autosaver.save(midGame());
    await autosaver.save(midGame());
    expect(calls).toEqual([]);
  });

  test('una scrittura fallita lascia la partita salvata com\'era', async () => {
    const { store, state, autosaver } = flaky();
    const first = midGame();
    await autosaver.save(first);
    state.failing = true;
    await autosaver.save(playRandomSession(first, 3, 10));
    state.failing = false;
    expect(await store.loadGame()).toEqual({ ok: true, value: toSavedGame(first, 20) });
  });
});

describe('finishWin', () => {
  const ISLANDS: IslandInfo[] = [
    { id: 'a', levelIds: [1, 2, 3], gift: 0 },
    { id: 'b', levelIds: [4, 5, 6], gift: 5 },
  ];

  test('registra la vittoria, scrive i progressi e cancella la partita salvata', async () => {
    const store = createMemorySaveStore();
    const session = won(60);
    await store.saveGame(toSavedGame(session, 1));
    const done = await finishWin(store, newProgress(), session, 1, ISLANDS, SIG);
    const expected = recordWin(newProgress(), { signature: SIG, levelId: 1, stars: session.outcome!.stars, seconds: 60, gold: session.outcome!.gold, profile: 'normal', noTimePressure: false });
    expect(done.progress).toEqual(expected.progress);
    expect(done.rewards).toEqual({ stars: session.outcome!.stars, coins: expected.coins, newRecord: false, gifts: [], giftCoins: 0 });
    expect(done.saved).toEqual({ ok: true, value: undefined });
    expect(await store.loadProgress()).toEqual({ ok: true, value: expected.progress });
    expect(await store.loadGame()).toEqual({ ok: true, value: null });
  });

  test('registra le tessere d\'oro prese', async () => {
    const session = playRandomSession(start({ ...FLAT, gold: 3 }, 'normal', 1), 1);
    expect(session.phase).toBe('won');
    expect(session.outcome!.gold).toBeGreaterThan(0);
    const done = await finishWin(createMemorySaveStore(), newProgress(), session, 1, ISLANDS, SIG);
    expect(done.progress.levels[1].gold).toBe(session.outcome!.gold);
    expect(done.rewards.coins).toBe(recordWin(newProgress(), { signature: SIG, levelId: 1, stars: session.outcome!.stars, seconds: session.outcome!.seconds, gold: session.outcome!.gold, profile: 'normal', noTimePressure: false }).coins);
  });

  test('la prima vittoria non è un «nuovo record»', async () => {
    const done = await finishWin(createMemorySaveStore(), newProgress(), won(60), 1, ISLANDS, SIG);
    expect(done.rewards.newRecord).toBe(false);
    expect(done.progress.levels[1].bestSeconds).toBe(60);
  });

  test('un tempo migliore del record è un «nuovo record»; uguale o peggiore no', async () => {
    const store = createMemorySaveStore();
    const before = recordWin(newProgress(), { signature: SIG, levelId: 1, stars: 1, seconds: 60, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    expect((await finishWin(store, before, won(59), 1, ISLANDS, SIG)).rewards.newRecord).toBe(true);
    expect((await finishWin(store, before, won(60), 1, ISLANDS, SIG)).rewards.newRecord).toBe(false);
    expect((await finishWin(store, before, won(61), 1, ISLANDS, SIG)).rewards.newRecord).toBe(false);
  });

  test('con «senza pressione del tempo» non c\'è record e quello vecchio resta', async () => {
    const before = recordWin(newProgress(), { signature: SIG, levelId: 1, stars: 1, seconds: 60, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    const done = await finishWin(createMemorySaveStore(), before, won(10, true), 1, ISLANDS, SIG);
    expect(done.rewards.newRecord).toBe(false);
    expect(done.progress.levels[1].bestSeconds).toBe(60);
  });

  test('apre l\'isola successiva e dà il regalo, una volta sola', async () => {
    const store = createMemorySaveStore();
    const star = (levelId: number) => ({ signature: SIG, levelId, stars: 3, seconds: 50, gold: 0, profile: 'normal', noTimePressure: false }) as const;
    const almost: Progress = recordWin(recordWin(newProgress(), star(1)).progress, star(2)).progress;
    const first = await finishWin(store, almost, won(60), 3, ISLANDS, SIG);
    expect(first.rewards.gifts).toEqual([ISLANDS[1]]);
    expect(first.rewards.giftCoins).toBe(5);
    expect(first.progress.giftsOpened).toEqual(['b']);
    expect(first.progress.coins).toBe(almost.coins + first.rewards.coins + 5);
    const again = await finishWin(store, first.progress, won(70), 3, ISLANDS, SIG);
    expect(again.rewards.gifts).toEqual([]);
    expect(again.rewards.giftCoins).toBe(0);
    expect(again.progress.giftsOpened).toEqual(['b']);
  });

  test('se la scrittura fallisce dà comunque progressi e ricompense, e la partita salvata resta', async () => {
    const base = createMemorySaveStore();
    const session = won(60);
    await base.saveGame(toSavedGame(session, 1));
    const done = await finishWin({ ...base, finishGame: async () => DISK_FULL }, newProgress(), session, 1, ISLANDS, SIG);
    expect(done.saved).toEqual(DISK_FULL);
    expect(done.progress.levels[1].stars).toBeGreaterThan(0);
    expect(done.rewards.stars).toBeGreaterThan(0);
    expect(await base.loadGame()).toEqual({ ok: true, value: toSavedGame(session, 1) });
    expect(await base.loadProgress()).toEqual({ ok: true, value: newProgress() });
  });

  test('una partita non vinta non si chiude', async () => {
    await expect(finishWin(createMemorySaveStore(), newProgress(), midGame(), 1, ISLANDS, SIG)).rejects.toThrow('non è vinta');
  });
});

describe('firme dei livelli nei progressi', () => {
  const ISLANDS: IslandInfo[] = [
    { id: 'a', levelIds: [1, 2, 3], gift: 0 },
    { id: 'b', levelIds: [4, 5, 6], gift: 5 },
  ];
  const OLD = 'fedcba9876543210';
  const NEW = '0f1e2d3c4b5a6978';
  const levelRecord = (stars: number, signature?: string) => ({ stars, bestSeconds: 60, gold: 0, profile: 'normal' as const, ...(signature ? { signature } : {}) });
  const stored = (levels: Record<number, ReturnType<typeof levelRecord>>) => createMemorySaveStore({ progress: serializeProgress({ ...newProgress(), levels }) });
  /** Il livello 21 è cambiato (era `OLD`, ora `NEW`); gli altri sono come prima. */
  const changed = { current: (id: number) => (id === 21 ? NEW : SIG), base: (id: number) => (id === 21 ? OLD : SIG) };

  test('loadHome non mostra le stelle di un livello che nel frattempo è cambiato, e firma quelle che restano valide', async () => {
    const store = stored({ 21: levelRecord(3), 22: levelRecord(2), 23: levelRecord(1, SIG), 24: levelRecord(3, OLD) });
    const { progress } = await loadHome(store, changed);
    if (!progress.ok) throw new Error('progressi illeggibili');
    expect(Object.keys(progress.value.levels)).toEqual(['22', '23']); // il 21 era senza firma ed era del livello di prima; il 24 ha una firma che non è la sua
    expect(progress.value.levels[22].signature).toBe(SIG); // senza firma e ancora valido: si firma
    expect(progress.value.levels[23].signature).toBe(SIG);
  });

  test('i progressi illeggibili passano come sono, senza passare dalle firme', async () => {
    const store = createMemorySaveStore({ progress: '{' });
    const { progress } = await loadHome(store, changed);
    expect(progress.ok).toBe(false);
  });

  test('una vittoria firma il record con la firma del livello giocato', async () => {
    const store = createMemorySaveStore();
    const done = await finishWin(store, newProgress(), won(60), 1, ISLANDS, NEW);
    expect(done.progress.levels[1].signature).toBe(NEW);
    const reread = await store.loadProgress();
    expect(reread.ok && reread.value.levels[1].signature).toBe(NEW);
  });

  test('le stelle di un livello cambiato non contano per «Nuovo record!» né si sommano alla vittoria', async () => {
    const old = recordWin(newProgress(), { signature: OLD, levelId: 1, stars: 3, seconds: 100, gold: 2, profile: 'master', noTimePressure: false }).progress;
    const prepared = prepareWin(old, won(500), 1, ISLANDS, NEW);
    expect(prepared.rewards.newRecord).toBe(false); // nessun record precedente di questo livello
    const level = prepared.progress.levels[1];
    expect(level.signature).toBe(NEW);
    expect(level.bestSeconds).toBe(500); // non 100, che era di un altro livello
    expect(level.profile).toBe('normal');
    expect(level.gold).toBe(prepareWin(newProgress(), won(500), 1, ISLANDS, NEW).progress.levels[1].gold);
  });

  test('lo stesso livello: il record precedente conta e un tempo migliore è «Nuovo record!»', () => {
    const before = recordWin(newProgress(), { signature: NEW, levelId: 1, stars: 1, seconds: 60, gold: 0, profile: 'normal', noTimePressure: false }).progress;
    expect(prepareWin(before, won(59), 1, ISLANDS, NEW).rewards.newRecord).toBe(true);
  });
});
