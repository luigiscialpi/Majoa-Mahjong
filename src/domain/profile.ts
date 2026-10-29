import type { LevelSpec } from './types';

/** Profilo di difficoltà scelto dal giocatore. Si sommano: ognuno conserva le restrizioni del precedente. */
export type Profile = 'easy' | 'normal' | 'medium' | 'hard' | 'expert' | 'master';

/** Profili in ordine di difficoltà crescente. */
export const PROFILES: readonly Profile[] = ['easy', 'normal', 'medium', 'hard', 'expert', 'master'];

export type ProfileRules = {
  /** Moltiplicatore degli aiuti iniziali. */
  aidFactor: number;
  /** Valore che prende un aiuto illimitato (`null` = resta illimitato). */
  unlimitedAidBecomes: number | null;
  /** Disegni in più o in meno rispetto al livello. */
  typesDelta: number;
  /** Rimescoli automatici gratuiti (`null` = illimitati). */
  freeShuffles: number | null;
  /** Fattore delle soglie di tempo per le stelle. */
  timeFactor: number;
  /** Moltiplicatore della nebbia del livello e tessere di nebbia in più. */
  fogFactor: number;
  fogAdd: number;
  /** ✨ in più la prima volta che si vince a quel profilo (conta solo la differenza con il profilo più alto già battuto). */
  bonus: number;
};

// Valori dell'originale ("Majoa Mahjong.html", righe 1369-1373): tabella di `docs/gioco-originale.md`, sezione 6.2.
// Il difetto 7 (la nebbia in più si somma anche ai livelli che di base non ne hanno) è replicato: decisione aperta.
export const PROFILE_RULES: Readonly<Record<Profile, ProfileRules>> = {
  easy: { aidFactor: 2, unlimitedAidBecomes: null, typesDelta: -2, freeShuffles: null, timeFactor: 1.5, fogFactor: 0.5, fogAdd: 0, bonus: 0 },
  normal: { aidFactor: 1, unlimitedAidBecomes: null, typesDelta: 0, freeShuffles: null, timeFactor: 1, fogFactor: 1, fogAdd: 0, bonus: 0 },
  medium: { aidFactor: 0.75, unlimitedAidBecomes: 10, typesDelta: 1, freeShuffles: 3, timeFactor: 0.9, fogFactor: 1.25, fogAdd: 0, bonus: 1 },
  hard: { aidFactor: 0.5, unlimitedAidBecomes: 6, typesDelta: 2, freeShuffles: 2, timeFactor: 0.8, fogFactor: 1.5, fogAdd: 1, bonus: 2 },
  expert: { aidFactor: 0.25, unlimitedAidBecomes: 3, typesDelta: 3, freeShuffles: 1, timeFactor: 0.7, fogFactor: 2, fogAdd: 2, bonus: 3 },
  master: { aidFactor: 0, unlimitedAidBecomes: 0, typesDelta: 5, freeShuffles: 0, timeFactor: 0.6, fogFactor: 3, fogAdd: 3, bonus: 5 },
};

export type AidKind = 'hints' | 'shuffles' | 'undo';

/**
 * Aiuti iniziali secondo il profilo (`null` = illimitato). Normale li lascia invariati. Facile rende illimitati i valori
 * da 8 in su. Il Mischia non scende mai sotto 1, in nessun profilo tranne Normale (dove non si tocca).
 */
export function scaleAid(value: number | null, profile: Profile, kind: AidKind): number | null {
  if (profile === 'normal') return value;
  const rules = PROFILE_RULES[profile];
  let scaled = value === null ? rules.unlimitedAidBecomes : Math.round(value * rules.aidFactor);
  if (profile === 'easy' && value !== null && value >= 8) scaled = null;
  if (kind === 'shuffles' && scaled !== null && scaled < 1) scaled = 1;
  return scaled;
}

/**
 * Disegni usati dal livello secondo il profilo: almeno 5 e al più `poolSize − 1`. L'originale limita a «lunghezza del
 * gruppo di disegni − 2», e il suo gruppo comprende la stella in tutte le isole tranne i Tris: sui 100 livelli le due
 * formule danno lo stesso risultato in tutte le combinazioni con i sei profili.
 */
export function effectiveTypes(types: number, poolSize: number, profile: Profile): number {
  return Math.max(5, Math.min(types + PROFILE_RULES[profile].typesDelta, poolSize - 1));
}

/** Tessere di nebbia secondo il profilo, a partire dalla nebbia del livello. */
export function fogCount(baseFog: number, profile: Profile): number {
  const rules = PROFILE_RULES[profile];
  return Math.round(baseFog * rules.fogFactor) + rules.fogAdd;
}

/** Specifica del livello per un profilo: cambiano disegni, nebbia e aiuti; tavola, nascoste e oro restano. */
export function applyProfile(spec: LevelSpec, profile: Profile): LevelSpec {
  return {
    ...spec,
    types: effectiveTypes(spec.types, spec.poolSize, profile),
    fog: fogCount(spec.fog, profile),
    aids: {
      hints: scaleAid(spec.aids.hints, profile, 'hints'),
      shuffles: scaleAid(spec.aids.shuffles, profile, 'shuffles'),
      undo: scaleAid(spec.aids.undo, profile, 'undo'),
    },
  };
}
