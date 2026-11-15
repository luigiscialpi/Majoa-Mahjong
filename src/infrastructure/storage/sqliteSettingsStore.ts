import type { SettingsStore } from '../../application/settingsStore';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from '../../domain/settings';
import { openExpoSqliteDatabase } from './expoSqliteDatabase';
import type { SqlDatabase } from './sqlDatabase';

const KEY = 'app_settings';

/**
 * Archivio impostazioni su SQLite (`expo-sqlite` su Android o `node:sqlite` nei test).
 * Crea la tabella `settings` se non esiste, indipendente dalla tabella `save` dei progressi.
 */
export function createSqliteSettingsStore(db: SqlDatabase): SettingsStore {
  let tableEnsured = false;

  async function ensureTable() {
    if (tableEnsured) return;
    await db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    tableEnsured = true;
  }

  return {
    async loadSettings(): Promise<Settings> {
      try {
        await ensureTable();
        const row = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [KEY]);
        return row ? parseSettings(row.value) : { ...DEFAULT_SETTINGS };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },

    async saveSettings(settings: Settings): Promise<void> {
      await ensureTable();
      await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [KEY, serializeSettings(settings)]);
    },

    async resetSettings(): Promise<Settings> {
      await ensureTable();
      await db.run('DELETE FROM settings WHERE key = ?', [KEY]);
      return { ...DEFAULT_SETTINGS };
    },
  };
}

/** Apre l'archivio delle impostazioni dell'app su SQLite. */
export async function openAppSettingsStore(db?: SqlDatabase): Promise<SettingsStore> {
  const database = db ?? (await openExpoSqliteDatabase());
  return createSqliteSettingsStore(database);
}
