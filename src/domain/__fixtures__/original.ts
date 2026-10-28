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
