import { PROFILES, type Profile } from '../domain/profile';
import { legacyLevels, type LegacyLevel } from '../infrastructure/content/legacyLevels';

/** Parametri della rotta `/play`: il livello (assente se il numero non esiste) e il profilo (Normale se manca o non è valido). */
export function parsePlayParams(level: string | undefined, profile: string | undefined): { level: LegacyLevel | undefined; profile: Profile } {
  return { level: legacyLevels.find((l) => String(l.id) === level), profile: PROFILES.find((p) => p === profile) ?? 'normal' };
}
