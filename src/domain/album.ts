import { createRng, hashSeed } from './prng';
import { islandStars, levelProgress, type IslandInfo, type Progress } from './progress';

// Album da collezionare (`docs/motore-livelli.md`, «Progressione e sblocco», punto 7): 111 carte in 6 album. Logica pura e senza
// disegni: una carta è un id (`dogs0`, `sweets13`) e il disegno che mostra sta nei contenuti (`albumCards.ts`). Le carte guadagnate
// giocando seguono un ordine fisso come nell'originale; quelle dei regali delle isole sono a caso tra le mancanti.

export const ALBUM_IDS = ['animals', 'sweets', 'art', 'science', 'sea', 'flowers'] as const;
export type AlbumId = (typeof ALBUM_IDS)[number];

export function isAlbumId(value: unknown): value is AlbumId {
  return (ALBUM_IDS as readonly unknown[]).includes(value);
}

/** Carte di ogni album di tema (i 14 disegni dell'isola); l'ultima viene dal regalo d'isola, le altre 13 dal gioco. */
export const THEME_CARDS = 14;

/** Categorie dell'album «Animali» nell'ordine dell'originale (`ALB_CATS`) con le loro carte: 10 + 8 + 6 + 5 + 12 = 41. */
const ANIMAL_CATEGORIES = [['dogs', 10], ['cats', 8], ['parrots', 6], ['budgies', 5], ['zoo', 12]] as const;

/** Le carte di ogni album nell'ordine in cui si guadagnano giocando. «Animali» gira tra le categorie (la prima carta di ognuna, poi la seconda, ecc.). */
export const ALBUM_CARDS: Readonly<Record<AlbumId, readonly string[]>> = (() => {
  const animals: string[] = [];
  for (let i = 0; i < Math.max(...ANIMAL_CATEGORIES.map(([, count]) => count)); i++) {
    for (const [category, count] of ANIMAL_CATEGORIES) if (i < count) animals.push(`${category}${i}`);
  }
  const theme = (id: AlbumId) => Array.from({ length: THEME_CARDS }, (_, i) => `${id}${i}`);
  return { animals, sweets: theme('sweets'), art: theme('art'), science: theme('science'), sea: theme('sea'), flowers: theme('flowers') };
})();

/** Stelle per ogni carta guadagnata giocando: album di tema, per le stelle della sua isola. */
export const STARS_PER_THEME_CARD = 5;
/** Stelle per ogni carta guadagnata giocando: album «Animali», per le stelle di tutta la campagna. */
export const STARS_PER_ANIMAL_CARD = 8;

/** Carte di un album di tema guadagnate giocando: una ogni 5 stelle delle isole del tema più una per ogni boss vinto, al massimo 13. */
export function themePlayCards(themeStars: number, bossesWon: number): number {
  return Math.min(THEME_CARDS - 1, Math.floor(themeStars / STARS_PER_THEME_CARD) + bossesWon);
}

/** Carte di «Animali» guadagnate giocando: una ogni 8 stelle della campagna, al massimo 41. Boss e Tris dell'originale non contano. */
export function animalsPlayCards(campaignStars: number): number {
  return Math.min(ALBUM_CARDS.animals.length, Math.floor(campaignStars / STARS_PER_ANIMAL_CARD));
}

/** Boss vinti nell'isola: i suoi livelli boss con almeno una stella. */
function bossesWon(progress: Progress, island: IslandInfo): number {
  return (island.bossLevelIds ?? []).filter((id) => levelProgress(progress, id).stars >= 1).length;
}

/** Quante carte di `album` si sono guadagnate giocando. */
export function playCards(album: AlbumId, progress: Progress, islands: readonly IslandInfo[]): number {
  if (album === 'animals') return animalsPlayCards(islands.reduce((sum, island) => sum + islandStars(progress, island), 0));
  // Le isole che ripetono il tema (dall'isola 8) contano con la prima: si sommano le stelle di tutte e poi si dividono
  const themed = islands.filter((candidate) => candidate.album === album);
  return themePlayCards(themed.reduce((sum, island) => sum + islandStars(progress, island), 0), themed.reduce((sum, island) => sum + bossesWon(progress, island), 0));
}

/**
 * Le carte che il giocatore ha di `album`, nell'ordine del catalogo: quelle dei regali e, per le guadagnate giocando, le prime
 * che mancano nell'ordine fisso. Una carta regalata non si conta due volte: il totale è carte giocate + carte regalate.
 */
export function ownedCards(album: AlbumId, progress: Progress, islands: readonly IslandInfo[]): string[] {
  const order = ALBUM_CARDS[album];
  const owned = new Set(progress.giftCards.filter((card) => order.includes(card)));
  let left = playCards(album, progress, islands);
  for (const card of order) {
    if (left === 0) break;
    if (!owned.has(card)) {
      owned.add(card);
      left--;
    }
  }
  return order.filter((card) => owned.has(card));
}

/** Le carte di tutti gli album, album per album nell'ordine di `ALBUM_IDS`. */
export function allOwnedCards(progress: Progress, islands: readonly IslandInfo[]): string[] {
  return ALBUM_IDS.flatMap((album) => ownedCards(album, progress, islands));
}

/** Le carte di `after` che non erano in `before`, nello stesso ordine. */
export function cardsNotIn(before: readonly string[], after: readonly string[]): string[] {
  const had = new Set(before);
  return after.filter((card) => !had.has(card));
}

/**
 * Dà la carta del regalo di ogni isola appena aperta (`opened`): una a caso tra quelle che mancano nell'album dell'isola, nessuna
 * se l'album è completo (restano le ✨). Il seme viene dall'isola: stessi progressi, stessa carta, anche se il calcolo si ripete.
 */
export function drawGiftCards(progress: Progress, opened: readonly IslandInfo[], islands: readonly IslandInfo[]): Progress {
  let current = progress;
  for (const island of opened) {
    if (island.album === undefined) continue;
    const owned = new Set(ownedCards(island.album, current, islands));
    const missing = ALBUM_CARDS[island.album].filter((card) => !owned.has(card));
    if (missing.length === 0) continue;
    const card = missing[createRng(hashSeed('album', island.id)).int(missing.length)];
    current = { ...current, giftCards: [...current.giftCards, card] };
  }
  return current;
}
