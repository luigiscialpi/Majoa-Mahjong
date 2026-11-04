import { boardFingerprint } from '../domain/fingerprint';
import { PROFILES, type Profile } from '../domain/profile';
import type { LevelSpec, Result } from '../domain/types';
import { at, isInt, isNumber, isRecord, isSeconds, keysMismatch, malformed, parseJson, versionError, type JsonRecord, type SaveError } from './saveFormat';
import { replaySession, type Session, type SessionEvent } from './session';

export const SAVED_GAME_VERSION = 1;

/**
 * Partita in corso, salvata come specifica di base, profilo, seme ed eventi: le tessere non si salvano, la partita si
 * ricostruisce (`restoreSession`). L'impronta della tavola dice se la ricostruzione coincide con quella salvata.
 */
export type SavedGame = {
  readonly version: typeof SAVED_GAME_VERSION;
  /** Numero del livello nei progressi (`LevelSpec.id` è una stringa e non si interpreta). */
  readonly levelId: number;
  /** Specifica di base, senza il profilo applicato. */
  readonly spec: LevelSpec;
  readonly profile: Profile;
  readonly seed: number;
  readonly noTimePressure: boolean;
  readonly events: readonly SessionEvent[];
  readonly seconds: number;
  /** `boardFingerprint` della partita al momento del salvataggio. */
  readonly fingerprint: string;
};

export function toSavedGame(session: Session, levelId: number): SavedGame {
  return {
    version: SAVED_GAME_VERSION,
    levelId,
    spec: session.base,
    profile: session.profile,
    seed: session.seed,
    noTimePressure: session.noTimePressure,
    events: session.events,
    seconds: session.seconds,
    fingerprint: boardFingerprint(session.game),
  };
}

/**
 * Ricostruisce la sessione con `replaySession` e controlla l'impronta. Una partita salvata subito dopo l'ultima mossa
 * può risultare già vinta: spetta a chi chiama registrarne l'esito.
 */
export function restoreSession(saved: SavedGame): Result<Session, SaveError> {
  const input = { spec: saved.spec, profile: saved.profile, seed: saved.seed, noTimePressure: saved.noTimePressure };
  const replayed = replaySession(input, saved.events, saved.seconds);
  if (!replayed.ok) {
    const e = replayed.error;
    return { ok: false, error: e.kind === 'start-failed' ? { kind: 'start-failed', error: e.error } : { kind: 'event-rejected', index: e.index } };
  }
  if (boardFingerprint(replayed.value.game) !== saved.fingerprint) return { ok: false, error: { kind: 'board-mismatch' } };
  return { ok: true, value: replayed.value };
}

export function serializeSavedGame(saved: SavedGame): string {
  return JSON.stringify(saved);
}

const EVENT_KINDS = ['hint', 'undo', 'shuffle', 'rescue'];

function badEvent(e: unknown, path: string): string | null {
  if (!isRecord(e)) return path;
  if (e.kind === 'move') {
    const keys = keysMismatch(e, ['kind', 'group'], path);
    if (keys) return keys;
    return Array.isArray(e.group) && e.group.every((i) => isInt(i, 0)) ? null : at(path, 'group');
  }
  if (typeof e.kind !== 'string' || !EVENT_KINDS.includes(e.kind)) return at(path, 'kind');
  return keysMismatch(e, ['kind'], path);
}

function badAids(a: unknown, path: string): string | null {
  if (!isRecord(a)) return path;
  const keys = keysMismatch(a, ['hints', 'shuffles', 'undo'], path);
  if (keys) return keys;
  for (const k of ['hints', 'shuffles', 'undo']) if (a[k] !== null && !isInt(a[k], 0)) return at(path, k);
  return null;
}

function badSpec(s: unknown, path: string): string | null {
  if (!isRecord(s)) return path;
  const keys = keysMismatch(s, ['id', 'cells', 'groupSize', 'types', 'poolSize', 'hidden', 'fog', 'gold', 'aids'], path);
  if (keys) return keys;
  if (typeof s.id !== 'string') return at(path, 'id');
  const cellsPath = at(path, 'cells');
  if (!Array.isArray(s.cells)) return cellsPath;
  for (let i = 0; i < s.cells.length; i++) {
    const cell: unknown = s.cells[i];
    const cellPath = at(cellsPath, i);
    if (!isRecord(cell)) return cellPath;
    const cellKeys = keysMismatch(cell, ['x', 'y', 'z'], cellPath);
    if (cellKeys) return cellKeys;
    for (const axis of ['x', 'y', 'z']) if (!isNumber(cell[axis])) return at(cellPath, axis);
  }
  if (s.groupSize !== 2 && s.groupSize !== 3) return at(path, 'groupSize');
  // ponytail: nessun tetto ai conteggi (tipi, disegni, tessere): il disco corrotto non è un avversario.
  if (!isInt(s.types, 1)) return at(path, 'types');
  if (!isInt(s.poolSize, 1)) return at(path, 'poolSize');
  if (!Array.isArray(s.hidden) || !s.hidden.every((n) => isInt(n, 0))) return at(path, 'hidden');
  if (!isInt(s.fog, 0)) return at(path, 'fog');
  if (!isInt(s.gold, 0)) return at(path, 'gold');
  return badAids(s.aids, at(path, 'aids'));
}

/** Primo campo non valido di un documento già riconosciuto come versione corrente, oppure `null`. */
function badField(r: JsonRecord): string | null {
  const keys = keysMismatch(r, ['version', 'levelId', 'spec', 'profile', 'seed', 'noTimePressure', 'events', 'seconds', 'fingerprint'], '');
  if (keys) return keys;
  if (!isInt(r.levelId, 1)) return 'levelId';
  if (!PROFILES.includes(r.profile as Profile)) return 'profile';
  if (!isInt(r.seed, 0, 0xffffffff)) return 'seed';
  if (typeof r.noTimePressure !== 'boolean') return 'noTimePressure';
  if (!isSeconds(r.seconds)) return 'seconds';
  if (typeof r.fingerprint !== 'string' || !/^[0-9a-f]{16}$/.test(r.fingerprint)) return 'fingerprint';
  if (!Array.isArray(r.events)) return 'events';
  for (let i = 0; i < r.events.length; i++) {
    const bad = badEvent(r.events[i], at('events', i));
    if (bad) return bad;
  }
  return badSpec(r.spec, 'spec');
}

/** Legge e valida un testo JSON: nessuna correzione nascosta, solo `SavedGame` valido o un errore tipizzato. */
export function parseSavedGame(text: string): Result<SavedGame, SaveError> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const root = json.value;
  if (!isRecord(root)) return malformed('root');
  const version = versionError(root, SAVED_GAME_VERSION);
  if (version) return { ok: false, error: version };
  const field = badField(root);
  return field === null ? { ok: true, value: root as unknown as SavedGame } : malformed(field);
}
