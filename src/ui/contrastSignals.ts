import type { Rect } from '../domain/board';

// Segnali che non dipendono dal colore (`.cb` e `.hc`, righe 211-234 dell'originale): geometria pura, senza Skia. Il CSS
// descrive contorni (`outline`) e anelli (`box-shadow`); qui diventano anelli tratteggiati o pieni attorno alla tessera.

/** Un anello: rettangolo arrotondato disegnato a tratto. `dash` = lunghezza di tratto e di spazio. */
export type Ring = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  readonly width: number;
  readonly color: string;
  readonly dash?: readonly [number, number];
};

/** Anello centrato a `e` px dal bordo della tessera (negativo = dentro). */
function ring(rect: Rect, radius: number, e: number, width: number, color: string, dash?: readonly [number, number]): Ring {
  return { x: rect.x - e, y: rect.y - e, w: rect.w + 2 * e, h: rect.h + 2 * e, r: Math.max(0, radius + e), width, color, ...(dash ? { dash } : {}) };
}

/** `outline: <width> <stile> <color>; outline-offset: <offset>`: il tratto sta fuori dal bordo, a `offset` px. */
const outline = (rect: Rect, radius: number, width: number, offset: number, color: string, dash?: readonly [number, number]) => ring(rect, radius, offset + width / 2, width, color, dash);
/** `0 0 0 <to> <color>` dopo uno strato di `from` px: l'anello occupa da `from` a `to` px fuori dal bordo. */
const spread = (rect: Rect, radius: number, from: number, to: number, color: string) => ring(rect, radius, (from + to) / 2, to - from, color);
/** `inset 0 0 0 <width> <color>`: l'anello sta dentro il bordo. */
const inset = (rect: Rect, radius: number, width: number, color: string) => ring(rect, radius, -width / 2, width, color);

export const SIGNAL_WHITE = '#fff';
export const SIGNAL_BLACK = '#000';

/** `.cb .tile.sel`: contorno pieno bianco di 5 px, a 2 px dal bordo (riga 213). */
export const selectedSignal = (rect: Rect, radius: number): Ring[] => [outline(rect, radius, 5, 2, SIGNAL_WHITE)];

/**
 * `.cb .tile.hint`: contorno tratteggiato bianco di 4 px, a 3 px dal bordo (riga 214). Il browser sceglie la lunghezza
 * dei tratti: qui 3 volte lo spessore di tratto e 2 di spazio.
 */
export const hintSignal = (rect: Rect, radius: number): Ring[] => [outline(rect, radius, 4, 3, SIGNAL_WHITE, [12, 8])];

/**
 * `.cb .tile.blocker`: contorno «double» bianco di 5 px, a 2 px dal bordo (righe 222 e 227). `double` sono due linee sottili,
 * ciascuna un terzo dello spessore, con un terzo di vuoto in mezzo.
 */
export const blockerSignal = (rect: Rect, radius: number): Ring[] => [outline(rect, radius, 5 / 3, 2, SIGNAL_WHITE), outline(rect, radius, 5 / 3, 2 + (2 * 5) / 3, SIGNAL_WHITE)];

/** `.cb .tile.match`: anello interno nero di 4 px, poi bianco di 4 px e nero di altri 4 px fuori dal bordo (riga 230). */
export const matchSignal = (rect: Rect, radius: number): Ring[] => [inset(rect, radius, 4, SIGNAL_BLACK), spread(rect, radius, 0, 4, SIGNAL_WHITE), spread(rect, radius, 4, 8, SIGNAL_BLACK)];

/** `.cb .tile.match::before`: il segno ✔ è in un quadrato nero dagli angoli smussati (raggio 7 px su un lato di 28) con un anello bianco di 3 px (riga 232). */
export const MATCH_BADGE = { fill: SIGNAL_BLACK, ring: SIGNAL_WHITE, ringWidth: 3, cornerRatio: 7 / 28 } as const;

/** `.cb .tile.blocked::after`: strisce a 45° nere al 40%, 5 px di striscia e 6 di vuoto (righe 212). */
export const HATCH = { color: 'rgba(0,0,0,0.4)', width: 5, period: 11 } as const;

/**
 * Le strisce del tratteggio nel riquadro `w`×`h` della tessera (origine in alto a sinistra). `repeating-linear-gradient(45deg)`
 * parte dall'angolo in basso a sinistra e sale verso destra: le strisce corrono dall'alto a sinistra al basso a destra,
 * e la prima sta a `width/2` dall'angolo. Le linee sporgono oltre il riquadro: poi si ritaglia sulla tessera.
 */
export function hatchPathD(w: number, h: number): string {
  const step = HATCH.period * Math.SQRT2; // distanza tra due strisce misurata lungo x
  const first = -h + (HATCH.width / 2) * Math.SQRT2;
  const reach = HATCH.width; // quanto sporge ogni linea oltre il riquadro, per non lasciare i capi tondi o a sbalzo dentro la tessera
  let d = '';
  for (let c = first; c <= w + HATCH.width; c += step) {
    d += `M${(c - reach).toFixed(2)} ${(-reach).toFixed(2)}L${(c + h + reach).toFixed(2)} ${(h + reach).toFixed(2)}`;
  }
  return d;
}
