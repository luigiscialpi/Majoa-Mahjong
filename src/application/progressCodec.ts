import { PROFILES, type Profile } from '../domain/profile';
import type { Progress } from '../domain/progress';
import type { Result } from '../domain/types';
import { at, isInt, isRecord, isSeconds, keysMismatch, malformed, parseJson, versionError, type JsonRecord, type SaveError } from './saveFormat';

/** La 3 aggiunge le carte regalate (`giftCards`); la 2 la firma del livello a ogni record. La 1 e la 2 si leggono ancora. */
export const PROGRESS_VERSION = 3;

export function serializeProgress(progress: Progress): string {
  return JSON.stringify({ version: PROGRESS_VERSION, levels: progress.levels, coins: progress.coins, giftsOpened: progress.giftsOpened, giftCards: progress.giftCards });
}

/** In JSON le chiavi di `levels` sono stringhe: solo interi positivi in forma canonica. */
const LEVEL_KEY = /^[1-9][0-9]*$/;

/** Una firma è l'impronta di `levelSignature`: 16 cifre esadecimali. */
const SIGNATURE = /^[0-9a-f]{16}$/;

function badLevel(v: unknown, path: string, signed: boolean): string | null {
  if (!isRecord(v)) return path;
  // Nella versione 2 la firma può mancare (record precedenti alle firme); nella 1 non esiste
  const hasSignature = signed && isRecord(v) && Object.hasOwn(v, 'signature');
  const keys = keysMismatch(v, hasSignature ? ['stars', 'bestSeconds', 'gold', 'profile', 'signature'] : ['stars', 'bestSeconds', 'gold', 'profile'], path);
  if (keys) return keys;
  if (hasSignature && !(typeof v.signature === 'string' && SIGNATURE.test(v.signature))) return at(path, 'signature');
  if (!isInt(v.stars, 0, 3)) return at(path, 'stars');
  if (v.bestSeconds !== null && !isSeconds(v.bestSeconds)) return at(path, 'bestSeconds');
  if (!isInt(v.gold, 0)) return at(path, 'gold');
  if (v.profile !== null && !PROFILES.includes(v.profile as Profile)) return at(path, 'profile');
  return null;
}

/** Elenco di id testuali non vuoti e senza doppioni: il primo non valido (come percorso) o `null`; `list` non array: `field`. */
function badIds(list: unknown, field: string): string | null {
  if (!Array.isArray(list)) return field;
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const id: unknown = list[i];
    if (typeof id !== 'string' || id === '' || seen.has(id)) return at(field, i);
    seen.add(id);
  }
  return null;
}

/** Primo campo non valido di un documento di una versione che si legge, oppure `null`. */
function badField(r: JsonRecord, version: number): string | null {
  const signed = version >= 2;
  const keys = keysMismatch(r, version >= 3 ? ['version', 'levels', 'coins', 'giftsOpened', 'giftCards'] : ['version', 'levels', 'coins', 'giftsOpened'], '');
  if (keys) return keys;
  if (!isRecord(r.levels)) return 'levels';
  for (const [key, level] of Object.entries(r.levels)) {
    const path = at('levels', key);
    if (!LEVEL_KEY.test(key)) return path;
    const bad = badLevel(level, path, signed);
    if (bad) return bad;
  }
  if (!isInt(r.coins, 0)) return 'coins';
  return badIds(r.giftsOpened, 'giftsOpened') ?? (version >= 3 ? badIds(r.giftCards, 'giftCards') : null);
}

/** Legge e valida un testo JSON: nessuna correzione nascosta, solo `Progress` valido o un errore tipizzato. */
export function parseProgress(text: string): Result<Progress, SaveError> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const root = json.value;
  if (!isRecord(root)) return malformed('root');
  // Si leggono la versione 3 e, con migrazione (nessuna carta regalata), la 2 e la 1 (senza nemmeno le firme)
  const error = versionError(root, PROGRESS_VERSION);
  if (error && !(error.kind === 'unsupported-version' && (error.found === 1 || error.found === 2))) return { ok: false, error };
  const version = root.version as number;
  const field = badField(root, version);
  if (field !== null) return malformed(field);
  return { ok: true, value: { levels: root.levels as Progress['levels'], coins: root.coins as number, giftsOpened: root.giftsOpened as string[], giftCards: version >= 3 ? (root.giftCards as string[]) : [] } };
}
