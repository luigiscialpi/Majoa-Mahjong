import { useCallback, useEffect, useRef, useState } from 'react';
import { NO_COMBO, nextCombo } from '../application/combo';
import type { Feedback } from '../application/session';
import { boardMetrics, tileRect, type Rect } from '../domain/board';
import type { PlacedTile } from '../domain/types';
import { COMBO_ORIGIN_Y, SPARK_MAX_MS, comboBurst, comboLevel, tileBurst, type Burst, type ComboLevel } from './effects';

/** Scritta della combo da mostrare: `key` cambia a ogni combo e fa ripartire l'animazione. */
export type ComboBannerState = { readonly key: number; readonly level: ComboLevel };

export type MatchEffectsInput = {
  feedback: Feedback | null;
  /** Numero progressivo dell'azione (`Round.seq`): l'effetto riparte solo quando cambia, quindi ogni feedback si gestisce una volta. */
  seq: number;
  tiles: readonly PlacedTile[];
  /** Colonna di gioco nell'area della tavola: le coordinate delle scintille sono quelle dell'area. */
  column: Rect;
  areaWidth: number;
  /** Falso con la riduzione del movimento: la combo si conta lo stesso (servirà ai suoni), non si mostra nulla. */
  enabled: boolean;
  now?: () => number;
  rand?: () => number;
};

/**
 * Effetti degli abbinamenti (`docs/resa-visiva.md`): a ogni abbinamento scintille su ogni tessera tolta (più ricche se è
 * d'oro) e, dal secondo abbinamento ravvicinato, scritta della combo con altre scintille. La combo sta in un ref: parte da
 * zero a ogni partita (il componente si rimonta) e non si salva.
 */
export function useMatchEffects({ feedback, seq, tiles, column, areaWidth, enabled, now = Date.now, rand = Math.random }: MatchEffectsInput) {
  const combo = useRef(NO_COMBO);
  const ids = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [bursts, setBursts] = useState<readonly Burst[]>([]);
  const [banner, setBanner] = useState<ComboBannerState | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (feedback?.kind !== 'matched') return;
    combo.current = nextCombo(combo.current, now());
    if (!enabled) return;

    const metrics = boardMetrics(tiles, column.w, column.h);
    const fresh: Burst[] = feedback.group.map((i) => {
      const r = tileRect(metrics, tiles[i]);
      return tileBurst(++ids.current, column.x + r.x + r.w / 2, r.y + r.h / 2, tiles[i].gold, rand);
    });
    const level = comboLevel(combo.current.count);
    if (level) {
      fresh.push(comboBurst(++ids.current, areaWidth / 2, COMBO_ORIGIN_Y, level, rand));
      setBanner({ key: ++ids.current, level });
    }
    setBursts((b) => [...b, ...fresh]);
    const gone = new Set(fresh.map((b) => b.id));
    const id = setTimeout(() => {
      timers.current.delete(id);
      setBursts((b) => b.filter((x) => !gone.has(x.id)));
    }, SPARK_MAX_MS + 50);
    timers.current.add(id);
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps -- si gestisce una volta per azione, con i valori di quel render

  const clearBanner = useCallback((key: number) => setBanner((b) => (b?.key === key ? null : b)), []);
  return { bursts, banner, clearBanner };
}
