import { PROFILES, type Profile } from '../domain/profile';
import { campaignLevelById } from '../infrastructure/content/campaignLevels';
import type { LegacyLevel } from '../infrastructure/content/legacyLevels';

/** Parametri della rotta `/play`: il livello (assente se il numero non esiste) e il profilo (Normale se manca o non è valido). */
export function parsePlayParams(level: string | undefined, profile: string | undefined): { level: LegacyLevel | undefined; profile: Profile } {
  const id = level && /^[1-9]\d*$/.test(level) ? Number(level) : NaN;
  return { level: Number.isSafeInteger(id) ? campaignLevelById(id) : undefined, profile: PROFILES.find((p) => p === profile) ?? 'normal' };
}
