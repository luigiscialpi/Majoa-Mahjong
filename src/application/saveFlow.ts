import type { Profile } from '../domain/profile';
import { levelProgress, openGifts, recordWin, type IslandInfo, type Progress } from '../domain/progress';
import type { Result } from '../domain/types';
import type { SaveError } from './saveFormat';
import { restoreSession, toSavedGame, type SavedGame } from './savedGame';
import type { SaveStore } from './saveStore';
import type { Session } from './session';

// Logica dei salvataggi collegata all'archivio, senza interfaccia (`docs/salvataggi.md`): cosa si trova all'avvio, quando
// chiedere conferma, come salvare da soli e come chiudere una partita. La UI la usa e decide cosa mostrare.

/** Quanto mostra la scheda «Continua» e la conferma di sostituzione. */
export type ResumeInfo = { levelId: number; profile: Profile; seconds: number; remaining: number };

/** La partita in corso trovata all'avvio. `saved` è `null` se il documento non si è nemmeno letto. */
export type Resume =
  | { kind: 'none' }
  | { kind: 'ready'; saved: SavedGame; session: Session; info: ResumeInfo }
  | { kind: 'broken'; error: SaveError; saved: SavedGame | null };

export type Home = { progress: Result<Progress, SaveError>; resume: Resume };

/**
 * Legge progressi e partita in corso. I due dati sono indipendenti: una partita illeggibile non toglie i progressi, e
 * viceversa. Una partita che si legge ma non si ricostruisce (`start-failed`, `event-rejected`, `board-mismatch`) tiene
 * il documento letto, così si sa quale livello e profilo ripartire.
 */
export async function loadHome(store: SaveStore): Promise<Home> {
  const [progress, game] = await Promise.all([store.loadProgress(), store.loadGame()]);
  if (!game.ok) return { progress, resume: { kind: 'broken', error: game.error, saved: null } };
  const saved = game.value;
  if (saved === null) return { progress, resume: { kind: 'none' } };
  const restored = restoreSession(saved);
  if (!restored.ok) return { progress, resume: { kind: 'broken', error: restored.error, saved } };
  const session = restored.value;
  return { progress, resume: { kind: 'ready', saved, session, info: { levelId: saved.levelId, profile: saved.profile, seconds: session.seconds, remaining: session.game.remaining } } };
}

export type StartPlan = { kind: 'start' } | { kind: 'confirm'; info: ResumeInfo };

/**
 * Avviare una partita sopra una salvata che si può riprendere chiede conferma, anche per lo stesso livello e profilo:
 * riprendere è un'altra strada («Continua»). Una partita illeggibile non si può riprendere e non chiede conferma.
 */
export function planStart(resume: Resume): StartPlan {
  return resume.kind === 'ready' ? { kind: 'confirm', info: resume.info } : { kind: 'start' };
}

export type Autosaver = { save(session: Session): Promise<void> };

/**
 * Salva la partita di `levelId` a ogni chiamata. Un errore di scrittura non interrompe il gioco: `onTrouble(true)` scatta
 * al secondo errore di fila (una sola volta) e `onTrouble(false)` al primo salvataggio riuscito dopo. `onError` riceve la
 * causa di ogni errore di scrittura (per i log): l'avviso a schermo non la dice, e senza questo si perderebbe.
 */
export function createAutosaver(store: SaveStore, levelId: number, onTrouble: (trouble: boolean) => void, onError?: (error: SaveError) => void): Autosaver {
  let failures = 0;
  return {
    async save(session) {
      const result = await store.saveGame(toSavedGame(session, levelId));
      if (result.ok) {
        const wasInTrouble = failures >= 2;
        failures = 0;
        if (wasInTrouble) onTrouble(false);
        return;
      }
      failures++;
      onError?.(result.error);
      if (failures === 2) onTrouble(true);
    },
  };
}

/** Ricompense della vittoria da mostrare. `coins` sono le ✨ della partita e `giftCoins` quelle dei regali delle isole aperte. */
export type Rewards = { stars: number; coins: number; newRecord: boolean; gifts: IslandInfo[]; giftCoins: number };

export type Finished = {
  /** Progressi nuovi, da usare anche se la scrittura è fallita. */
  progress: Progress;
  rewards: Rewards;
  /** Esito della scrittura: se fallisce la partita salvata resta com'era e i progressi su disco sono quelli di prima. */
  saved: Result<void, SaveError>;
};

/**
 * Chiude una partita vinta: registra la vittoria (`recordWin`), dà i regali delle isole appena aperte (`openGifts`) e
 * scrive progressi e cancellazione della partita salvata in un'unica transazione (`finishGame`). «Nuovo record» solo se
 * esisteva un record e il tempo lo migliora, e mai con «senza pressione del tempo».
 */
export async function finishWin(store: SaveStore, progress: Progress, session: Session, levelId: number, islands: readonly IslandInfo[]): Promise<Finished> {
  const outcome = session.outcome;
  if (session.phase !== 'won' || !outcome) throw new Error('finishWin: la partita non è vinta');
  const before = levelProgress(progress, levelId);
  const win = recordWin(progress, { levelId, stars: outcome.stars, seconds: outcome.seconds, gold: outcome.gold, profile: session.profile, noTimePressure: session.noTimePressure });
  const gifts = openGifts(win.progress, islands);
  const newRecord = !session.noTimePressure && before.bestSeconds !== null && outcome.seconds < before.bestSeconds;
  const saved = await store.finishGame(gifts.progress);
  const giftCoins = gifts.opened.reduce((sum, island) => sum + island.gift, 0);
  return { progress: gifts.progress, rewards: { stars: outcome.stars, coins: win.coins, newRecord, gifts: gifts.opened, giftCoins }, saved };
}
