/** @jest-environment node */
import { describeSaveStore, sampleGame, sampleProgress } from '../../application/__fixtures__/saveStoreContract';
import { newProgress } from '../../domain/progress';
import { createNodeSqliteDatabase } from './__fixtures__/nodeSqliteDatabase';
import type { SqlDatabase, SqlValue } from './sqlDatabase';
import { createSqliteSaveStore, migrate, MIGRATIONS } from './sqliteSaveStore';

const version = async (db: SqlDatabase) => (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version;
const count = async (db: SqlDatabase, where = '1') => (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM save WHERE ${where}`))?.n;
const tableExists = async (db: SqlDatabase) => (await db.first("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'save'")) !== null;
const storageFailed = (message: string) => ({ ok: false, error: { kind: 'storage-failed', message } });

/** Un database che si può far fallire e che registra le chiamate. */
function faulty(db: SqlDatabase) {
  const state = { failRun: null as null | ((sql: string, params: readonly SqlValue[]) => boolean), failTransaction: false, thrown: new Error('disco pieno') as unknown, log: [] as string[] };
  const wrapped: SqlDatabase = {
    exec: (sql) => db.exec(sql),
    run: async (sql, params = []) => {
      state.log.push(`run ${sql.split(' ')[0]} ${params[0] ?? ''}`.trim());
      if (state.failRun?.(sql, params)) throw state.thrown;
      await db.run(sql, params);
    },
    first: (sql, params) => {
      if (sql.startsWith('PRAGMA')) state.log.push('pragma');
      return db.first(sql, params);
    },
    transaction: async (task) => {
      if (state.failTransaction) {
        state.failTransaction = false;
        throw state.thrown;
      }
      state.log.push('begin');
      await db.transaction(task);
      state.log.push('end');
    },
  };
  return { db: wrapped, state };
}

describeSaveStore('archivio SQLite (node:sqlite)', async (initial = {}) => {
  const db = createNodeSqliteDatabase();
  expect(await migrate(db)).toBeNull();
  if (initial.progress !== undefined) await db.run('INSERT INTO save (slot, json) VALUES (?, ?)', ['progress', initial.progress]);
  if (initial.game !== undefined) await db.run('INSERT INTO save (slot, json) VALUES (?, ?)', ['game', initial.game]);
  return createSqliteSaveStore(db);
});

describe('schema e migrazioni', () => {
  test('al primo uso crea la tabella e porta la versione all\'ultima migrazione', async () => {
    const db = createNodeSqliteDatabase();
    expect(await version(db)).toBe(0);
    expect(await tableExists(db)).toBe(false);
    expect((await createSqliteSaveStore(db).loadProgress()).ok).toBe(true);
    expect(await version(db)).toBe(MIGRATIONS.length);
    expect(await tableExists(db)).toBe(true);
  });

  test('controlla lo schema una sola volta, non a ogni operazione', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    await store.loadProgress();
    await store.saveGame(sampleGame);
    await store.loadGame();
    expect(state.log.filter((l) => l === 'pragma')).toHaveLength(1);
  });

  test('un secondo archivio sullo stesso database non rifà le migrazioni e vede i dati', async () => {
    const base = createNodeSqliteDatabase();
    await createSqliteSaveStore(base).saveProgress(sampleProgress);
    const { db, state } = faulty(base);
    const second = createSqliteSaveStore(db);
    expect(await second.loadProgress()).toEqual({ ok: true, value: sampleProgress });
    expect(state.log).toEqual(['pragma']);
    expect(await version(base)).toBe(MIGRATIONS.length);
  });

  test('applica solo le migrazioni mancanti e conserva i dati', async () => {
    const db = createNodeSqliteDatabase();
    const [first] = MIGRATIONS;
    const extra = 'ALTER TABLE save ADD COLUMN extra TEXT';
    await createSqliteSaveStore(db, [first]).saveProgress(sampleProgress);
    expect(await version(db)).toBe(1);
    const upgraded = createSqliteSaveStore(db, [first, extra]);
    expect(await upgraded.loadProgress()).toEqual({ ok: true, value: sampleProgress });
    expect(await version(db)).toBe(2);
    expect(await db.first('SELECT extra FROM save')).toEqual({ extra: null });
  });

  test('una migrazione che fallisce annulla tutte quelle in corso', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSaveStore(db, [...MIGRATIONS, 'QUESTO NON È SQL']);
    const result = await store.loadProgress();
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(await version(db)).toBe(0);
    expect(await tableExists(db)).toBe(false);
  });

  test('se la migrazione fallisce, l\'operazione dopo riprova', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    state.failTransaction = true;
    expect(await store.loadProgress()).toEqual(storageFailed('disco pieno'));
    expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
    expect(await version(db)).toBe(MIGRATIONS.length);
  });

  test('un database più recente dell\'app non si tocca', async () => {
    const db = createNodeSqliteDatabase();
    await db.exec('PRAGMA user_version = 99');
    const store = createSqliteSaveStore(db);
    const error = { ok: false, error: { kind: 'unsupported-version', found: 99 } };
    expect(await store.loadProgress()).toEqual(error);
    expect(await store.loadGame()).toEqual(error);
    expect(await store.saveGame(sampleGame)).toEqual(error);
    expect(await store.resetAll()).toEqual(error);
    expect(await version(db)).toBe(99);
    expect(await tableExists(db)).toBe(false);
  });
});

describe('righe e contenuti', () => {
  test('salvare due volte lascia una sola riga per ogni dato', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSaveStore(db);
    await store.saveGame(sampleGame);
    await store.saveGame({ ...sampleGame, levelId: 9 });
    await store.saveProgress(sampleProgress);
    await store.saveProgress(newProgress());
    expect(await count(db, "slot = 'game'")).toBe(1);
    expect(await count(db, "slot = 'progress'")).toBe(1);
    expect(await count(db)).toBe(2);
  });

  test('finishGame lascia solo i progressi; resetAll nessuna riga', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSaveStore(db);
    await store.saveGame(sampleGame);
    await store.finishGame(sampleProgress);
    expect(await count(db, "slot = 'progress'")).toBe(1);
    expect(await count(db, "slot = 'game'")).toBe(0);
    await store.saveGame(sampleGame);
    await store.resetAll();
    expect(await count(db)).toBe(0);
  });

  test('una riga illeggibile non si corregge né si cancella', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSaveStore(db);
    await store.loadGame();
    await db.run('INSERT INTO save (slot, json) VALUES (?, ?)', ['game', '{"versione": "rotta"']);
    expect(await store.loadGame()).toEqual({ ok: false, error: { kind: 'malformed', field: 'json' } });
    expect(await db.first<{ json: string }>("SELECT json FROM save WHERE slot = 'game'")).toEqual({ json: '{"versione": "rotta"' });
  });
});

describe('errori di scrittura', () => {
  test('un errore del database diventa `storage-failed` col suo messaggio', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    state.failRun = (sql) => sql.startsWith('INSERT');
    expect(await store.saveGame(sampleGame)).toEqual(storageFailed('disco pieno'));
    expect(await store.saveProgress(sampleProgress)).toEqual(storageFailed('disco pieno'));
  });

  test('anche un errore che non è un Error dà `storage-failed`', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    state.failRun = () => true;
    state.thrown = 'database bloccato';
    expect(await store.clearGame()).toEqual(storageFailed('database bloccato'));
  });

  test('dopo un errore l\'archivio continua a funzionare', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    state.failRun = () => true;
    expect((await store.saveGame(sampleGame)).ok).toBe(false);
    state.failRun = null;
    expect((await store.saveGame(sampleGame)).ok).toBe(true);
    expect(await store.loadGame()).toEqual({ ok: true, value: sampleGame });
  });

  test('finishGame è tutto o niente: se la cancellazione fallisce, i progressi restano quelli di prima', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    await store.saveProgress(newProgress());
    await store.saveGame(sampleGame);
    state.failRun = (sql) => sql.startsWith('DELETE');
    expect(await store.finishGame(sampleProgress)).toEqual(storageFailed('disco pieno'));
    state.failRun = null;
    expect(await store.loadProgress()).toEqual({ ok: true, value: newProgress() });
    expect(await store.loadGame()).toEqual({ ok: true, value: sampleGame });
  });

  test('resetAll è tutto o niente: se la seconda cancellazione fallisce, resta tutto', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    await store.saveProgress(sampleProgress);
    await store.saveGame(sampleGame);
    state.failRun = (sql, params) => sql.startsWith('DELETE') && params[0] === 'game';
    expect(await store.resetAll()).toEqual(storageFailed('disco pieno'));
    state.failRun = null;
    expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
    expect(await store.loadGame()).toEqual({ ok: true, value: sampleGame });
  });
});

describe('operazioni una alla volta', () => {
  test('una transazione non si mescola con una scrittura che arriva subito dopo', async () => {
    const { db, state } = faulty(createNodeSqliteDatabase());
    const store = createSqliteSaveStore(db);
    await store.loadProgress();
    state.log.length = 0;
    const results = await Promise.all([store.finishGame(sampleProgress), store.saveGame(sampleGame), store.clearGame()]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(state.log).toEqual(['begin', 'run INSERT progress', 'run DELETE game', 'end', 'run INSERT game', 'run DELETE game']);
    expect(await store.loadGame()).toEqual({ ok: true, value: null });
  });

  test('le operazioni finiscono nell\'ordine in cui sono arrivate', async () => {
    const store = createSqliteSaveStore(createNodeSqliteDatabase());
    const other = { ...sampleGame, levelId: 8 };
    await Promise.all([store.saveGame(sampleGame), store.saveGame(other), store.finishGame(sampleProgress), store.saveGame(sampleGame)]);
    expect(await store.loadGame()).toEqual({ ok: true, value: sampleGame });
    expect(await store.loadProgress()).toEqual({ ok: true, value: sampleProgress });
  });
});
