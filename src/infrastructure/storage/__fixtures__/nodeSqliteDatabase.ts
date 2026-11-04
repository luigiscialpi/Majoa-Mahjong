import type { SqlDatabase, SqlValue } from '../sqlDatabase';

// Tipi minimi di `node:sqlite`: il progetto non include i tipi di node (come per gli altri moduli senza tipi, si usa
// `jest.requireActual`).
type Statement = { run(...params: SqlValue[]): unknown; get(...params: SqlValue[]): unknown };
type NodeSqlite = { DatabaseSync: new (path: string) => { exec(sql: string): void; prepare(sql: string): Statement } };

/**
 * `SqlDatabase` su un SQLite vero (`node:sqlite`, Node 22.13 o successivo) per i test. Chi lo usa deve dichiarare
 * `@jest-environment node` nel proprio file di test.
 */
export function createNodeSqliteDatabase(path = ':memory:'): SqlDatabase {
  const { DatabaseSync } = jest.requireActual<NodeSqlite>('node:sqlite');
  const db = new DatabaseSync(path);
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      db.prepare(sql).run(...params);
    },
    first: async <T>(sql: string, params: readonly SqlValue[] = []) => (db.prepare(sql).get(...params) ?? null) as T | null,
    transaction: async (task) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
