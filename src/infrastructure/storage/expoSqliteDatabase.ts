import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { SqlDatabase } from './sqlDatabase';

export const DATABASE_NAME = 'majoa.db';

/** Adatta un database di `expo-sqlite` a `SqlDatabase`. */
export function wrapExpoSqlite(db: SQLiteDatabase): SqlDatabase {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      if (params.length > 0) {
        await db.runAsync(sql, [...params]);
      } else {
        await db.runAsync(sql);
      }
    },
    first: (sql, params = []) =>
      params.length > 0
        ? db.getFirstAsync(sql, [...params])
        : db.getFirstAsync(sql),
    transaction: (task) => db.withTransactionAsync(task),
  };
}

/**
 * Connessione condivisa per nome file.
 * Garantisce che non ci siano due `SQLiteDatabase` aperti sullo stesso file,
 * evitando `NullPointerException` su `NativeDatabase.prepareAsync` durante
 * Fast Refresh o aperture concorrenti.
 */
const sharedInstances = new Map<string, Promise<SqlDatabase>>();

export function openExpoSqliteDatabase(name: string = DATABASE_NAME): Promise<SqlDatabase> {
  let instance = sharedInstances.get(name);
  if (!instance) {
    instance = openDatabaseAsync(name).then(wrapExpoSqlite);
    sharedInstances.set(name, instance);
  }
  return instance;
}

/** Solo per i test: rimuove la connessione condivisa per un dato nome. */
export function resetSharedExpoSqliteDatabase(name: string = DATABASE_NAME): void {
  sharedInstances.delete(name);
}
