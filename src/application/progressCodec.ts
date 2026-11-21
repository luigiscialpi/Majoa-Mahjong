import { PROFILES, type Profile } from '../domain/profile';
import type { Progress } from '../domain/progress';
import type { Result } from '../domain/types';
import { at, isInt, isRecord, isSeconds, keysMismatch, malformed, parseJson, versionError, type JsonRecord, type SaveError } from './saveFormat';

/** La 2 aggiunge la firma del livello a ogni record; la 1 si legge ancora (record senza firma). */
export const PROGRESS_VERSION = 2;

export function serializeProgress(progress: Progress): string {
  return JSON.stringify({ version: PROGRESS_VERSION, levels: progress.levels, coins: progress.coins, giftsOpened: progress.giftsOpened });
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

/** Primo campo non valido di un documento già riconosciuto come versione corrente, oppure `null`. */
function badField(r: JsonRecord, signed: boolean): string | null {
  const keys = keysMismatch(r, ['version', 'levels', 'coins', 'giftsOpened'], '');
  if (keys) return keys;
  if (!isRecord(r.levels)) return 'levels';
  for (const [key, level] of Object.entries(r.levels)) {
    const path = at('levels', key);
    if (!LEVEL_KEY.test(key)) return path;
    const bad = badLevel(level, path, signed);
    if (bad) return bad;
  }
  if (!isInt(r.coins, 0)) return 'coins';
  if (!Array.isArray(r.giftsOpened)) return 'giftsOpened';
  const seen = new Set<string>();
  for (let i = 0; i < r.giftsOpened.length; i++) {
    const gift: unknown = r.giftsOpened[i];
    if (typeof gift !== 'string' || gift === '' || seen.has(gift)) return at('giftsOpened', i);
    seen.add(gift);
  }
  return null;
}

/** Legge e valida un testo JSON: nessuna correzione nascosta, solo `Progress` valido o un errore tipizzato. */
export function parseProgress(text: string): Result<Progress, SaveError> {
  const json = parseJson(text);
  if (!json.ok) return json;
  const root = json.value;
  if (!isRecord(root)) return malformed('root');
  // Si leggono la versione 2 e la 1 (senza firme)
  const version = versionError(root, PROGRESS_VERSION);
  if (version && !(version.kind === 'unsupported-version' && version.found === 1)) return { ok: false, error: version };
  const field = badField(root, version === null);
  if (field !== null) return malformed(field);
  return { ok: true, value: { levels: root.levels as Progress['levels'], coins: root.coins as number, giftsOpened: root.giftsOpened as string[] } };
}
