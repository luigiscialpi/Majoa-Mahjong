import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { beginPuzzle, finishPuzzle, leavePuzzle, type PuzzleFinished } from '../application/puzzleFlow';
import type { SaveStore } from '../application/saveStore';
import type { Progress } from '../domain/progress';
import type { PuzzleDifficulty, PuzzleId } from '../domain/puzzles';
import type { Stars } from '../domain/stars';

export type PuzzlePhase = 'starting' | 'playing' | 'no-coins' | 'failed';

export type PuzzleSessionOptions = {
  id: PuzzleId;
  difficulty: PuzzleDifficulty;
  store: SaveStore;
  progress: Progress;
  /** Aggiorna i progressi in memoria dopo costo, rimborso o vittoria. */
  onProgress: (progress: Progress) => void;
  onExit: () => void;
  /** Se uscire adesso rende la ✨: nessuna mossa fatta e partita non finita (lo dice il gioco). */
  canRefund: boolean;
};

export type PuzzleSession = {
  phase: PuzzlePhase;
  /** Le ✨ che ci sono adesso, dopo il costo pagato all'avvio. */
  coins: number;
  /** L'esito, dopo la vittoria. */
  result: PuzzleFinished | null;
  /** Registra la vittoria con le stelle del gioco (prima dell'aiuto) e se è stato usato un aiuto; vale una volta sola. */
  finish: (stars: Stars, usedHint: boolean) => void;
  /** Esce: con `canRefund` rende prima la ✨ e la scrive. Vale una volta sola. */
  exit: () => Promise<void>;
};

/**
 * Parte comune di tutti i rompicapi (`puzzleFlow.ts` dentro una schermata): paga la ✨ all'avvio una volta sola, tiene
 * le ✨ aggiornate, registra la vittoria, rimborsa all'uscita e intercetta il tasto Indietro di sistema.
 */
export function usePuzzleSession({ id, difficulty, store, progress, onProgress, onExit, canRefund }: PuzzleSessionOptions): PuzzleSession {
  const [phase, setPhase] = useState<PuzzlePhase>('starting');
  const [current, setCurrent] = useState(progress);
  const [result, setResult] = useState<PuzzleFinished | null>(null);
  const begun = useRef(false);
  const finished = useRef(false);
  const left = useRef(false);

  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    beginPuzzle(store, progress).then((start) => {
      if (start.kind === 'started') {
        setCurrent(start.progress);
        onProgress(start.progress);
      }
      setPhase(start.kind === 'started' ? 'playing' : start.kind);
    });
  }, [store, progress, onProgress]);

  const finish = useCallback(
    (stars: Stars, usedHint: boolean) => {
      if (finished.current) return;
      finished.current = true;
      finishPuzzle(store, current, id, difficulty, stars, usedHint).then((done) => {
        setCurrent(done.progress);
        onProgress(done.progress);
        setResult(done);
      });
    },
    [store, current, id, difficulty, onProgress],
  );

  const exit = useCallback(async () => {
    if (left.current) return;
    left.current = true;
    if (phase === 'playing' && canRefund) {
      const refunded = await leavePuzzle(store, current);
      if (refunded.ok) onProgress(refunded.value);
    }
    onExit();
  }, [phase, canRefund, store, current, onProgress, onExit]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void exit();
      return true;
    });
    return () => subscription.remove();
  }, [exit]);

  return { phase, coins: current.coins, result, finish, exit };
}
