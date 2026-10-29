import { PROFILE_RULES, type Profile } from './profile';

export type Stars = 1 | 2 | 3;

export type WinInput = {
  /** Secondi impiegati. */
  seconds: number;
  /** Tessere del livello. Come nell'originale, anche nei Tris le «coppie» sono `tessere / 2`. */
  tiles: number;
  /** Aiuti usati: Aiuto, Annulla e Mischia (il rimescolo automatico non conta). */
  aidsUsed: number;
  profile: Profile;
  /** «Senza pressione del tempo»: il tempo dà sempre 3 stelle. */
  noTimePressure?: boolean;
};

/**
 * Stelle (1-3) di una vittoria: vale il minore tra le stelle per tempo (3 entro `coppie × 5 × k` secondi, 2 entro
 * `coppie × 10 × k`, `k` fattore del profilo) e quelle per aiuti (3 con 0-1 aiuti, 2 con al più `max(3, ⌈coppie / 6⌉)`).
 */
export function starsFor(w: WinInput): Stars {
  const pairs = w.tiles / 2;
  const k = PROFILE_RULES[w.profile].timeFactor;
  const byTime = w.noTimePressure ? 3 : w.seconds <= pairs * 5 * k ? 3 : w.seconds <= pairs * 10 * k ? 2 : 1;
  const byAids = w.aidsUsed <= 1 ? 3 : w.aidsUsed <= Math.max(3, Math.ceil(pairs / 6)) ? 2 : 1;
  return Math.min(byTime, byAids) as Stars;
}

export type CoinInput = {
  stars: number;
  /** Migliori stelle già ottenute nel livello (0 se mai vinto). */
  previousStars: number;
  /** Tessere d'oro prese ora e al massimo in passato. */
  gold: number;
  previousGold: number;
  profile: Profile;
  /** Profilo più alto già battuto in questo livello (assente se mai vinto). */
  previousProfile?: Profile;
};

/**
 * ✨ guadagnate con una vittoria: una per ogni stella in più del massimo precedente, una per ogni tessera d'oro in più
 * del massimo precedente e la differenza di bonus del profilo rispetto al più alto già battuto. Non comprende i regali
 * all'apertura delle isole né i rompicapi.
 */
export function coinsForWin(w: CoinInput): number {
  const bonus = PROFILE_RULES[w.profile].bonus - (w.previousProfile ? PROFILE_RULES[w.previousProfile].bonus : 0);
  return Math.max(0, w.stars - w.previousStars) + Math.max(0, w.gold - w.previousGold) + Math.max(0, bonus);
}
