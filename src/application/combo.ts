// Combo: abbinamenti consecutivi a meno di 4,5 secondi l'uno dall'altro (`tap`, riga 2133 di "Majoa Mahjong.html").
// Funzione pura: l'orologio entra come argomento (README, regola 9). Lo stato sta nell'interfaccia: non fa parte della
// sessione, non si salva e non entra nella ricostruzione da eventi.

/** Distanza massima tra due abbinamenti perché la combo cresca; da questa in su riparte da 0. */
export const COMBO_WINDOW_MS = 4500;

export type ComboState = { readonly count: number; readonly lastMs: number | null };

/** Nessun abbinamento ancora: inizio di una partita. */
export const NO_COMBO: ComboState = { count: 0, lastMs: null };

/** Stato dopo un abbinamento fatto a `nowMs`: `count` vale 0 al primo, 1 al secondo ravvicinato, e così via senza tetto. */
export function nextCombo(prev: ComboState, nowMs: number): ComboState {
  const close = prev.lastMs !== null && nowMs - prev.lastMs < COMBO_WINDOW_MS;
  return { count: close ? prev.count + 1 : 0, lastMs: nowMs };
}
