import { PROFILES, type Profile } from '../domain/profile';
import type { Progress } from '../domain/progress';
import type { Result } from '../domain/types';
import { at, isInt, isRecord, isSeconds, keysMismatch, malformed, parseJson, versionError, type JsonRecord, type SaveError } from './saveFormat';

export const PROGRESS_VERSION = 1;

export function serializeProgress(progress: Progress): string {
  return JSON.stringify({ version: PROGRESS_VERSION, levels: progress.levels, coins: progress.coins, giftsOpened: progress.giftsOpened });
}

/** In JSON le chiavi di `levels` sono stringhe: solo interi positivi in forma canonica. */
const LEVEL_KEY = /^[1-9][0-9]*$/;

function badLevel(v: unknown, path: string): string | null {
  if (!isRecord(v)) return path;
  const keys = keysMismatch(v, ['stars', 'bestSeconds', 'gold', 'profile'], path);
  if (keys) return keys;
  if (!isInt(v.stars, 0, 3)) return at(path, 'stars');
  if (v.bestSeconds !== null && !isSeconds(v.bestSeconds)) return at(path, 'bestSeconds');
  if (!isInt(v.gold, 0)) return at(path, 'gold');
  if (v.profile !== null && !PROFILES.includes(v.profile as Profile)) return at(path, 'profile');
  return null;
}

/** Primo campo non valido di un documento già riconosciuto come versione corrente, oppure `null`. */
function badField(r: JsonRecord): string | null {
  const keys = keysMismatch(r, ['version', 'levels', 'coins', 'giftsOpened'], '');
  if (keys) return keys;
  if (!isRecord(r.levels)) return 'levels';
  for (const [key, level] of Object.entries(r.levels)) {
    const path = at('levels', key);
    if (!LEVEL_KEY.test(key)) return path;
    const bad = badLevel(level, path);
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
  const version = versionError(root, PROGRESS_VERSION);
  if (version) return { ok: false, error: version };
  const field = badField(root);
  if (field !== null) return malformed(field);
  return { ok: true, value: { levels: root.levels as Progress['levels'], coins: root.coins as number, giftsOpened: root.giftsOpened as string[] } };
}
