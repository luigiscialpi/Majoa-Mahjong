/**
 * Le mascotte dell'originale (`MASCOTS`, riga 821 di "Majoa Mahjong.html"): quattro busti a fumetto e «nessuna». Compaiono
 * nella scritta della combo (58 px), nella finestra regalo (92 px) e nel selettore delle impostazioni (76 px).
 */
export const MASCOT_IDS = ['collie', 'sheltie', 'siamshort', 'siamlong'] as const;
export type MascotId = (typeof MASCOT_IDS)[number];
/** La scelta del giocatore: una mascotte o `'none'` (nessun disegno, `S.mascot` dell'originale). */
export type Mascot = MascotId | 'none';

/** Mascotte iniziale: Collie (`SDEF`, riga 1362 dell'originale). */
export const DEFAULT_MASCOT: Mascot = 'collie';

export function isMascot(value: unknown): value is Mascot {
  return value === 'none' || (MASCOT_IDS as readonly unknown[]).includes(value);
}
