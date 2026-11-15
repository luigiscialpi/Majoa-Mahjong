/**
 * Palette di aspetto dell'originale (reference/majoa-originale/Majoa Mahjong.html):
 *   BGP riga 1363: palette sfondo (felt-a, felt-b, accent)
 *   TLP riga 1365: palette bordo tessere (edge, edge2)
 *
 * Il valore 'level' non è in questi dizionari: significa «usa la tavolozza del livello corrente».
 */

import type { BgPalette, TilePalette } from '../../domain/settings';
import type { Palette } from './legacyThemes';

/** Colori di una palette sfondo: [felt-a (chiaro), felt-b (scuro), accent]. */
export type BgColors = { feltA: string; feltB: string; accent: string };

/** Colori di una palette bordo tessere: [edge (chiaro), edge2 (scuro)]. */
export type TileColors = { edge: string; edge2: string };

/**
 * Palette sfondo disponibili (reference HTML riga 1363: BGP).
 * Escluso 'level', che non ha colori fissi (si legge dal livello corrente).
 */
export const BG_PALETTE_COLORS: Record<Exclude<BgPalette, 'level'>, BgColors> = {
  jade:     { feltA: '#1f6b57', feltB: '#134536', accent: '#e8b43a' },
  ocean:    { feltA: '#1f6f94', feltB: '#0d3350', accent: '#7fe0ff' },
  cherry:   { feltA: '#b0476f', feltB: '#5c1f3b', accent: '#ffd1e3' },
  sunset:   { feltA: '#bf5d2c', feltB: '#5e2512', accent: '#ffd166' },
  violet:   { feltA: '#6038a6', feltB: '#2a1757', accent: '#dcbcff' },
  graphite: { feltA: '#3b3f46', feltB: '#15171a', accent: '#f0c040' },
  night:    { feltA: '#2a3a73', feltB: '#0a0e2c', accent: '#9bbcff' },
  sand:     { feltA: '#8a7a55', feltB: '#3e3520', accent: '#fff0b0' },
};

/**
 * Palette bordo tessere disponibili (reference HTML riga 1365: TLP).
 * Escluso 'level'.
 */
export const TILE_PALETTE_COLORS: Record<Exclude<TilePalette, 'level'>, TileColors> = {
  green:    { edge: '#2a8a62', edge2: '#17503b' },
  blue:     { edge: '#2a86b8', edge2: '#154a73' },
  pink:     { edge: '#d8628f', edge2: '#7d2a52' },
  gold:     { edge: '#cfa72f', edge2: '#7a5a0e' },
  violet:   { edge: '#7f58cc', edge2: '#412286' },
  graphite: { edge: '#7d838c', edge2: '#3a3f46' },
  red:      { edge: '#d24f58', edge2: '#7a1c22' },
  teal:     { edge: '#36b5ac', edge2: '#17626c' },
};

/** Campione di preview per ogni palette sfondo: il feltro chiaro (feltA). */
export function bgPreviewColor(key: BgPalette, levelFeltA: string): string {
  if (key === 'level') return levelFeltA;
  return BG_PALETTE_COLORS[key].feltA;
}

/** Campione di preview per ogni palette tessere: il bordo chiaro (edge). */
export function tilePreviewColor(key: TilePalette, levelEdge: string): string {
  if (key === 'level') return levelEdge;
  return TILE_PALETTE_COLORS[key].edge;
}

/**
 * Risolve la tavolozza effettiva applicando le preferenze utente (`bgPalette` e `tilePalette`)
 * alla tavolozza base del livello, fedele a `applyTheme` dell'originale HTML (righe 1871-1875).
 */
export function resolveEffectivePalette(
  basePalette: Palette,
  bgPalette: BgPalette,
  tilePalette: TilePalette,
): Palette {
  const bg = bgPalette !== 'level' ? BG_PALETTE_COLORS[bgPalette] : null;
  const tile = tilePalette !== 'level' ? TILE_PALETTE_COLORS[tilePalette] : null;

  return [
    bg ? bg.feltA : basePalette[0],
    bg ? bg.feltB : basePalette[1],
    bg ? bg.accent : basePalette[2],
    tile ? tile.edge : basePalette[3],
    tile ? tile.edge2 : basePalette[4],
  ];
}
