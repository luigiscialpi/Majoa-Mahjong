import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { SqlDatabase } from './sqlDatabase';

export const DATABASE_NAME = 'majoa.db';

/** Adatta un database di `expo-sqlite` a `SqlDatabase`. */
export function wrapExpoSqlite(db: SQLiteDatabase): SqlDatabase {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      await db.runAsync(sql, [...params]);
    },
    first: (sql, params = []) => db.getFirstAsync(sql, [...params]),
    transaction: (task) => db.withTransactionAsync(task),
  };
}

export async function openExpoSqliteDatabase(name: string = DATABASE_NAME): Promise<SqlDatabase> {
  return wrapExpoSqlite(await openDatabaseAsync(name));
}
