import { parseProgress, serializeProgress } from '../../application/progressCodec';
import type { SaveError } from '../../application/saveFormat';
import { parseSavedGame, serializeSavedGame, type SavedGame } from '../../application/savedGame';
import type { SaveStore } from '../../application/saveStore';
import { newProgress } from '../../domain/progress';
import type { Result } from '../../domain/types';
import type { SqlDatabase } from './sqlDatabase';

/**
 * Migrazioni dello schema, in ordine: la versione del database (`PRAGMA user_version`) è il numero di quelle già
 * applicate. Una migrazione già pubblicata non si modifica: se ne aggiunge un'altra in fondo.
 */
export const MIGRATIONS: readonly string[] = ['CREATE TABLE save (slot TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL)'];

const PROGRESS = 'progress';
const GAME = 'game';
const ok: Result<void, SaveError> = { ok: true, value: undefined };

/**
 * Porta il database all'ultima versione, applicando in una sola transazione le migrazioni mancanti: tutte o nessuna.
 * Un database più recente dell'app non si tocca (`unsupported-version`). Le eccezioni del database si propagano.
 */
export async function migrate(db: SqlDatabase, migrations: readonly string[] = MIGRATIONS): Promise<SaveError | null> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > migrations.length) return { kind: 'unsupported-version', found: current };
  if (current === migrations.length) return null;
  await db.transaction(async () => {
    for (let v = current; v < migrations.length; v++) await db.exec(migrations[v]);
    await db.exec(`PRAGMA user_version = ${migrations.length}`);
  });
  return null;
}

/**
 * Archivio dei salvataggi su SQLite: due righe di JSON nella tabella `save`, una per i progressi e una per la partita.
 * Le operazioni vanno una alla volta, nell'ordine in cui arrivano, così una transazione non si mescola con altre
 * scritture; lo schema si aggiorna alla prima operazione (e si riprova se fallisce). Ogni eccezione del database diventa
 * `storage-failed`. Le letture non correggono né cancellano nulla.
 */
export function createSqliteSaveStore(db: SqlDatabase, migrations: readonly string[] = MIGRATIONS): SaveStore {
  let migrated = false;
  let queue: Promise<unknown> = Promise.resolve();

  function operation<T>(task: () => Promise<Result<T, SaveError>>): Promise<Result<T, SaveError>> {
    const run = async (): Promise<Result<T, SaveError>> => {
      try {
        if (!migrated) {
          const error = await migrate(db, migrations);
          if (error) return { ok: false, error };
          migrated = true;
        }
        return await task();
      } catch (e) {
        return { ok: false, error: { kind: 'storage-failed', message: e instanceof Error ? e.message : String(e) } };
      }
    };
    const result = queue.then(run);
    queue = result;
    return result;
  }

  const read = (slot: string) => db.first<{ json: string }>('SELECT json FROM save WHERE slot = ?', [slot]);
  const write = (slot: string, json: string) => db.run('INSERT OR REPLACE INTO save (slot, json) VALUES (?, ?)', [slot, json]);
  const remove = (slot: string) => db.run('DELETE FROM save WHERE slot = ?', [slot]);

  return {
    loadProgress: () =>
      operation(async () => {
        const row = await read(PROGRESS);
        return row === null ? { ok: true, value: newProgress() } : parseProgress(row.json);
      }),
    saveProgress: (progress) =>
      operation(async () => {
        await write(PROGRESS, serializeProgress(progress));
        return ok;
      }),
    loadGame: () =>
      operation<SavedGame | null>(async () => {
        const row = await read(GAME);
        return row === null ? { ok: true, value: null } : parseSavedGame(row.json);
      }),
    saveGame: (game) =>
      operation(async () => {
        await write(GAME, serializeSavedGame(game));
        return ok;
      }),
    clearGame: () =>
      operation(async () => {
        await remove(GAME);
        return ok;
      }),
    finishGame: (progress) =>
      operation(async () => {
        const json = serializeProgress(progress);
        await db.transaction(async () => {
          await write(PROGRESS, json);
          await remove(GAME);
        });
        return ok;
      }),
    resetAll: () =>
      operation(async () => {
        await db.transaction(async () => {
          await remove(PROGRESS);
          await remove(GAME);
        });
        return ok;
      }),
  };
}
