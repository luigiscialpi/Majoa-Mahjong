import { ALBUM_IDS, THEME_CARDS } from '../../domain/album';
import type { MascotId } from '../../domain/mascot';
import { designOf } from './legacyThemes';

/** Cosa mostra una carta d'album: un disegno (0-128, come le tessere) o una mascotte. */
export type CardArt = { design: number } | { mascot: MascotId };

/**
 * Disegni dell'album «Animali» per categoria, nell'ordine dell'originale (`ALBUM_SRC`, riga 3199 di \"Majoa Mahjong.html\"):
 * un numero è un disegno e `m:nome` una mascotte. I disegni 110-128 compaiono solo nell'album.
 */
export const ANIMAL_SOURCES: Readonly<Record<string, readonly (number | string)[]>> = {
  dogs: [1, 30, 31, 32, 33, 'm:collie', 'm:sheltie', 110, 111, 112],
  cats: [0, 34, 35, 36, 'm:siamlong', 113, 114, 128],
  parrots: [37, 39, 115, 116, 117, 127],
  budgies: [38, 123, 124, 125, 126],
  zoo: [17, 6, 4, 10, 7, 8, 18, 118, 119, 120, 121, 122],
};

const art = new Map<string, CardArt>();
for (const [category, sources] of Object.entries(ANIMAL_SOURCES)) {
  sources.forEach((source, i) => art.set(`${category}${i}`, typeof source === 'string' ? { mascot: source.slice(2) as MascotId } : { design: source }));
}
// Gli album di tema sono i 14 disegni dell'isola, nell'ordine del suo gruppo di disegni (senza la stella)
for (const album of ALBUM_IDS) {
  if (album !== 'animals') for (let i = 0; i < THEME_CARDS; i++) art.set(`${album}${i}`, { design: designOf(album, i) });
}

/** Il disegno di una carta (id di `ALBUM_CARDS`), o `undefined` se l'id non è di nessuna carta. */
export function cardArt(cardId: string): CardArt | undefined {
  return art.get(cardId);
}
