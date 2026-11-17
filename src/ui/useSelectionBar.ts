import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Round } from '../application/round';
import { designOf } from '../infrastructure/content/legacyThemes';
import { selectionView, transientView, type BarView } from './selectionBar';

const EMPTY: BarView = { slots: [], status: null };

type Options = {
  round: Round;
  island: string;
  /** Ultima tessera toccata: il feedback di un rifiuto o di tessere diverse non dice quale. */
  tapped: RefObject<number | null>;
  /** Con la barra spenta non si tiene nessun conto e la schermata non si ridisegna per lei. */
  enabled: boolean;
};

/**
 * Lo stato della barra delle tessere selezionate: la selezione corrente, sostituita per un po' dall'esito dell'ultima
 * azione (`transientView`), e i disegni degli ultimi abbinamenti, che Annulla toglie. Come la combo, non fa parte della
 * sessione: non si salva e riparte vuota a ogni partita.
 */
export function useSelectionBar({ round, island, tapped, enabled }: Options): { view: BarView; recent: readonly number[] } {
  const { session, feedback, seq } = round;
  const game = session.game;
  const [passing, setPassing] = useState<BarView | null>(null);
  const [recent, setRecent] = useState<readonly number[]>([]);
  const previous = useRef(session.selected);

  useEffect(() => {
    const before = previous.current;
    previous.current = session.selected;
    if (!enabled) return;
    if (feedback?.kind === 'matched') setRecent((r) => [...r, designOf(island, game.tiles[feedback.group[0]].type)]);
    else if (feedback?.kind === 'undone') setRecent((r) => r.slice(0, -1));
    const next = transientView(feedback, game, island, tapped.current, before);
    setPassing(next ? next.view : null);
    if (!next) return;
    const id = setTimeout(() => setPassing(null), next.ms);
    return () => clearTimeout(id);
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps -- reagisce a ogni azione (seq): il resto è di quell'azione

  const live = useMemo(() => (enabled ? selectionView(game, island, session.selected) : EMPTY), [enabled, game, island, session.selected]);
  return { view: passing ?? live, recent };
}
