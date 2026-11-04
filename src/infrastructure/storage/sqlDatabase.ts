/** Valori che si possono passare a una query. */
export type SqlValue = string | number | null;

/**
 * Interfaccia minima di un database SQL, quanto basta all'archivio dei salvataggi (`sqliteSaveStore.ts`). La implementano
 * `expo-sqlite` sul telefono (`expoSqliteDatabase.ts`) e `node:sqlite` nei test. Le eccezioni del database non si
 * catturano qui: le trasforma in `storage-failed` l'archivio.
 */
export type SqlDatabase = {
  /** Esegue uno o più comandi senza risultato (schema, `PRAGMA`). */
  exec(sql: string): Promise<void>;
  /** Esegue un comando con parametri. */
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  /** Prima riga del risultato, oppure `null`. */
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /** Esegue `task` in una transazione: conferma se finisce, annulla tutto e rilancia l'errore se fallisce. */
  transaction(task: () => Promise<void>): Promise<void>;
};
