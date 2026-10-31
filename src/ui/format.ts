import type { Profile } from '../domain/profile';

/** Nomi dei profili di difficoltà. Testi provvisori: le lingue sono da fare. */
export const PROFILE_NAMES: Readonly<Record<Profile, string>> = { easy: 'Facile', normal: 'Normale', medium: 'Medio', hard: 'Difficile', expert: 'Esperto', master: 'Maestro' };

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
