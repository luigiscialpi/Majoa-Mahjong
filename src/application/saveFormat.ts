import type { GenError, Result } from '../domain/types';

/** Perché un salvataggio non si legge, non si ricostruisce o non si scrive (`docs/salvataggi.md`, «Stati ed errori»). */
export type SaveError =
  | { kind: 'unsupported-version'; found: number }
  | { kind: 'malformed'; field: string }
  | { kind: 'start-failed'; error: GenError }
  | { kind: 'event-rejected'; index: number }
  | { kind: 'board-mismatch' }
  | { kind: 'storage-failed'; message: string };

export type JsonRecord = Record<string, unknown>;

export const malformed = (field: string): { ok: false; error: SaveError } => ({ ok: false, error: { kind: 'malformed', field } });

export const isRecord = (v: unknown): v is JsonRecord => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Intero sicuro nell'intervallo `[min, max]`. */
export const isInt = (v: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Numero finito (anche frazionario: le tessere possono stare a mezzi passi). */
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Numero finito non negativo (secondi). */
export const isSeconds = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Percorso di un campo: `at('spec', 'id')` è `spec.id`, `at('events', 3)` è `events[3]`. */
export const at = (path: string, key: string | number): string => (typeof key === 'number' ? `${path}[${key}]` : path === '' ? key : `${path}.${key}`);

/** Legge un testo JSON; se non lo è, errore sul campo `json`. */
export function parseJson(text: string): Result<unknown, SaveError> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return malformed('json');
  }
}

/** Controlla `version` di un documento letto: manca o non è intera (`malformed`) o è un'altra versione (`unsupported-version`). */
export function versionError(root: JsonRecord, expected: number): SaveError | null {
  const v = root.version;
  if (!isInt(v)) return { kind: 'malformed', field: 'version' };
  return v === expected ? null : { kind: 'unsupported-version', found: v };
}

/** Primo campo mancante o in più di `value` rispetto a `keys` (come percorso), oppure `null` se coincidono. */
export function keysMismatch(value: JsonRecord, keys: readonly string[], path: string): string | null {
  for (const k of keys) if (!Object.hasOwn(value, k)) return at(path, k);
  for (const k of Object.keys(value)) if (!keys.includes(k)) return at(path, k);
  return null;
}
