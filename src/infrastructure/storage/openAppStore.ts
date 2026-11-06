import type { SaveStore } from '../../application/saveStore';
import { openExpoSqliteDatabase } from './expoSqliteDatabase';
import { createSqliteSaveStore } from './sqliteSaveStore';

/** L'archivio dell'app: SQLite su disco con `expo-sqlite`. Non si prova con i test (serve il modulo nativo); si verifica solo in compilazione. */
export async function openAppStore(): Promise<SaveStore> {
  return createSqliteSaveStore(await openExpoSqliteDatabase());
}
