import { PROFILES, type Profile } from './profile';
import { coinsForWin } from './stars';

// Progressi del giocatore e regole di sblocco di livelli e isole (`docs/motore-livelli.md`, «Progressione e sblocco»).
// Funzioni pure sullo stato: ogni aggiornamento restituisce un nuovo `Progress`. Il salvataggio su disco è altrove.

/** Rapporto di stelle dell'isola precedente che apre la successiva. Proposta di partenza (2/3, cioè 40 stelle su 60 con isole da 20 livelli): decisione aperta. */
export const UNLOCK_RATIO = 2 / 3;

/** ✨ di partenza (nell'originale). */
export const INITIAL_COINS = 3;

export type LevelProgress = {
  /** Migliore stella (0 = mai vinto). */
  stars: number;
  /** Record di tempo in secondi, non registrato con «senza pressione del tempo». */
  bestSeconds: number | null;
  /** Massimo di tessere d'oro prese. */
  gold: number;
  /** Profilo più alto battuto. */
  profile: Profile | null;
};

export type Progress = {
  readonly levels: Readonly<Record<number, LevelProgress>>;
  /** ✨ possedute. */
  readonly coins: number;
  /** Isole il cui regalo è già stato dato. */
  readonly giftsOpened: readonly string[];
};

/** Un'isola della mappa: i suoi livelli in ordine e le ✨ regalate all'apertura (0 = nessuna). */
export type IslandInfo = { id: string; levelIds: readonly number[]; gift: number };

export function newProgress(): Progress {
  return { levels: {}, coins: INITIAL_COINS, giftsOpened: [] };
}

const NONE: LevelProgress = { stars: 0, bestSeconds: null, gold: 0, profile: null };

export function levelProgress(progress: Progress, levelId: number): LevelProgress {
  return progress.levels[levelId] ?? NONE;
}

/** Somma delle stelle dei livelli dell'isola. */
export function islandStars(progress: Progress, island: IslandInfo): number {
  return island.levelIds.reduce((sum, id) => sum + levelProgress(progress, id).stars, 0);
}

/** Un'isola è completata quando il suo ultimo livello ha almeno una stella. */
export function isIslandCompleted(progress: Progress, island: IslandInfo): boolean {
  const last = island.levelIds[island.levelIds.length - 1];
  return last !== undefined && levelProgress(progress, last).stars >= 1;
}

/**
 * Stelle dell'isola necessarie ad aprire la successiva: `⌈ρ × 3 × livelli⌉` (con 20 livelli e ρ = 2/3, 40 su 60). Il prodotto in
 * virgola mobile può finire appena sopra un intero (0,1 × 3 × 10 = 3,0000000000000004) e far salire la soglia di uno: si toglie
 * una tolleranza prima di arrotondare.
 */
export function unlockThreshold(island: IslandInfo, rho: number = UNLOCK_RATIO): number {
  return Math.ceil(rho * 3 * island.levelIds.length - 1e-9);
}

/** La prima isola è sempre aperta; le altre si aprono quando la precedente è completata e ha almeno `unlockThreshold` stelle. */
export function isIslandUnlocked(progress: Progress, islands: readonly IslandInfo[], index: number, rho: number = UNLOCK_RATIO): boolean {
  if (index < 0 || index >= islands.length) return false;
  if (index === 0) return true;
  const previous = islands[index - 1];
  return isIslandCompleted(progress, previous) && islandStars(progress, previous) >= unlockThreshold(previous, rho);
}

/** Dentro un'isola aperta i livelli si sbloccano in sequenza: il primo sempre, gli altri vincendo il precedente con almeno una stella. */
export function isLevelUnlocked(progress: Progress, islands: readonly IslandInfo[], levelId: number, rho: number = UNLOCK_RATIO): boolean {
  const index = islands.findIndex((island) => island.levelIds.includes(levelId));
  if (index < 0 || !isIslandUnlocked(progress, islands, index, rho)) return false;
  const position = islands[index].levelIds.indexOf(levelId);
  return position === 0 || levelProgress(progress, islands[index].levelIds[position - 1]).stars >= 1;
}

export type WinRecord = {
  levelId: number;
  stars: number;
  seconds: number;
  /** Tessere d'oro prese in questa partita. */
  gold: number;
  profile: Profile;
  noTimePressure: boolean;
};

/**
 * Registra una vittoria: migliore stella, massimo di oro, profilo più alto e record di tempo (non con «senza pressione
 * del tempo»), e dà le ✨ di `coinsForWin`. Restituisce i progressi nuovi e le ✨ guadagnate.
 */
export function recordWin(progress: Progress, win: WinRecord): { progress: Progress; coins: number } {
  const previous = levelProgress(progress, win.levelId);
  const coins = coinsForWin({ stars: win.stars, previousStars: previous.stars, gold: win.gold, previousGold: previous.gold, profile: win.profile, previousProfile: previous.profile ?? undefined });
  const record = win.noTimePressure || (previous.bestSeconds !== null && previous.bestSeconds <= win.seconds) ? previous.bestSeconds : win.seconds;
  const highest = previous.profile !== null && PROFILES.indexOf(previous.profile) >= PROFILES.indexOf(win.profile) ? previous.profile : win.profile;
  const level: LevelProgress = { stars: Math.max(previous.stars, win.stars), bestSeconds: record, gold: Math.max(previous.gold, win.gold), profile: highest };
  return { progress: { ...progress, levels: { ...progress.levels, [win.levelId]: level }, coins: progress.coins + coins }, coins };
}

/**
 * Dà il regalo delle isole appena aperte (una volta sola ciascuna) e restituisce le isole di cui mostrare la finestra regalo.
 * Le isole senza regalo non contano. Un'isola già aperta resta tale anche se `ρ` cambia.
 */
export function openGifts(progress: Progress, islands: readonly IslandInfo[], rho: number = UNLOCK_RATIO): { progress: Progress; opened: IslandInfo[] } {
  const opened = islands.filter((island, index) => island.gift > 0 && !progress.giftsOpened.includes(island.id) && isIslandUnlocked(progress, islands, index, rho));
  if (opened.length === 0) return { progress, opened };
  return { progress: { ...progress, coins: progress.coins + opened.reduce((sum, island) => sum + island.gift, 0), giftsOpened: [...progress.giftsOpened, ...opened.map((island) => island.id)] }, opened };
}
