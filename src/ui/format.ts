import type { Profile } from '../domain/profile';
import { t, type TranslationKey } from '../infrastructure/i18n';

export const PROFILE_KEYS = {
  easy: 'dif_easy',
  normal: 'dif_normal',
  medium: 'dif_medium',
  hard: 'dif_hard',
  expert: 'dif_expert',
  master: 'dif_master',
} as const satisfies Readonly<Record<Profile, TranslationKey>>;

/** Secondi come `m:ss` (o `h:mm:ss` oltre l'ora). */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Stelle piene e vuote su tre, per esempio `★★☆`. */
export function starsText(stars: number): string {
  const full = Math.max(0, Math.min(3, Math.round(stars)));
  return '★'.repeat(full) + '☆'.repeat(3 - full);
}

/** Aiuti rimasti come testo: `∞` se illimitati. */
export function aidText(left: number | null): string {
  return left === null ? '∞' : String(left);
}

const ISLAND_NAME_KEYS: Readonly<Record<string, TranslationKey | undefined>> = {
  prologue: 'islandNamePrologue',
  animals: 'islandNameAnimals',
  sweets: 'islandNameSweets',
  art: 'islandNameArt',
  science: 'islandNameScience',
  sea: 'islandNameSea',
  flowers: 'islandNameFlowers',
};

export function islandName(id: string, translate: typeof t = t): string {
  const key = ISLAND_NAME_KEYS[id];
  return key ? translate(key) : id;
}
