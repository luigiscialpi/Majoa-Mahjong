import { STAR_TYPE, type Cell, type PlacedTile } from '../types';

// Oracoli: logica dell'originale ("Majoa Mahjong.html"), tradotta in TypeScript per confrontarla con il dominio.

/** `isFree` dell'originale (riga 1762). */
export function originalIsFree(t: Cell, alive: readonly Cell[]): boolean {
  let left = false;
  let right = false;
  for (const u of alive) {
    if (u === t) continue;
    if (u.z === t.z + 1 && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1) return false;
    if (u.z === t.z && Math.abs(u.y - t.y) < 1) {
      if (u.x < t.x && t.x - u.x < 2) left = true;
      if (u.x > t.x && u.x - t.x < 2) right = true;
    }
  }
  return !(left && right);
}

/**
 * `findMove` dell'originale per le coppie (riga 1936): la prima coppia per ordine delle tessere libere e non nascoste;
 * finché `unlocked < groups` preferisce una coppia di stelle. Restituisce gli indici, oppure `null`.
 */
export function originalFindPair(tiles: readonly PlacedTile[], alive: ReadonlySet<number>, unlocked: number, groups: number): number[] | null {
  const aliveCells = [...alive].map((i) => tiles[i]);
  const free = [...alive].filter((i) => tiles[i].hiddenGroup <= unlocked && originalIsFree(tiles[i], aliveCells));
  const all: number[][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) if (tiles[free[i]].type === tiles[free[j]].type) all.push([free[i], free[j]]);
  }
  if (all.length === 0) return null;
  if (unlocked < groups) {
    const star = all.find((p) => tiles[p[0]].type === STAR_TYPE);
    if (star) return star;
  }
  return all[0];
}

/** Costanti dei profili dell'originale (righe 1369-1373), indicizzate 0-5: facile, normale, medio, difficile, esperto, maestro. */
export const ORIGINAL_DIF = {
  aid: [2, 1, 0.75, 0.5, 0.25, 0],
  aidNull: [null, null, 10, 6, 3, 0],
  n: [-2, 0, 1, 2, 3, 5],
  resc: [null, null, 3, 2, 1, 0],
  tm: [1.5, 1, 0.9, 0.8, 0.7, 0.6],
  fogM: [0.5, 1, 1.25, 1.5, 2, 3],
  fogAdd: [0, 0, 0, 1, 2, 3],
  bonus: [0, 0, 1, 2, 3, 5],
} as const;

/** `scaleAid` dell'originale (riga 1978); `d` è l'indice del profilo. */
export function originalScaleAid(v: number | null, d: number, kind: 'hints' | 'shuffles' | 'undo'): number | null {
  if (d === 1) return v;
  let r: number | null;
  if (v === null) r = ORIGINAL_DIF.aidNull[d];
  else {
    r = Math.round(v * ORIGINAL_DIF.aid[d]);
    if (d === 0 && v >= 8) r = null;
  }
  if (kind === 'shuffles' && r !== null && r < 1) r = 1;
  return r;
}

/** `nEff` dell'originale (riga 1975) senza Modalità comoda; `poolLen` è la lunghezza del gruppo di disegni dell'isola. */
export function originalNEff(n: number, poolLen: number, d: number): number {
  return Math.max(5, Math.min(n + ORIGINAL_DIF.n[d], poolLen - 2));
}

/** Tessere di nebbia dell'originale (riga 2375) senza Modalità comoda. */
export function originalFogCount(fog: number, d: number): number {
  return Math.round(fog * ORIGINAL_DIF.fogM[d]) + ORIGINAL_DIF.fogAdd[d];
}

/** `calcStars` dell'originale (riga 2274); `noTime` = «senza pressione del tempo». */
export function originalCalcStars(sec: number, pairs: number, aids: number, d: number, noTime: boolean): number {
  const tm = ORIGINAL_DIF.tm[d] || 1;
  const byTime = noTime ? 3 : sec <= pairs * 5 * tm ? 3 : sec <= pairs * 10 * tm ? 2 : 1;
  const cap = aids <= 1 ? 3 : aids <= Math.max(3, Math.ceil(pairs / 6)) ? 2 : 1;
  return Math.min(byTime, cap);
}

/** ✨ guadagnate in `win()` (righe 2279-2292): stelle, tessere d'oro e bonus di profilo; `pd` è il profilo più alto già battuto. */
export function originalCoinGain(stars: number, prevStars: number, goldGot: number, prevGold: number, d: number, pd: number | undefined): number {
  let gain = Math.max(0, stars - prevStars);
  if (prevGold < goldGot) gain += goldGot - prevGold;
  const pb = pd === undefined ? 0 : ORIGINAL_DIF.bonus[pd];
  if (ORIGINAL_DIF.bonus[d] > pb) gain += ORIGINAL_DIF.bonus[d] - pb;
  return gain;
}
