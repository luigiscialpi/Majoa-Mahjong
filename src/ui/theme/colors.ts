/**
 * Tavolozza colori principale dell'interfaccia di Majoa Mahjong.
 * Valori ricavati direttamente dalle variabili CSS :root dell'originale
 * (reference/majoa-originale/Majoa Mahjong.html, righe 12-14).
 */
export const colors = {
  /** Feltro chiaro (centro dello sfondo): --felt-a */
  feltA: '#1f6b57',
  /** Feltro scuro (base e bordi dello sfondo): --felt-b */
  feltB: '#134536',
  /** Inchiostro chiaro: colore testo principale: --ink */
  ink: '#f6efd9',
  /** Inchiostro morbido: colore testo secondario e descrizioni: --ink-soft */
  inkSoft: '#d4e6dc',
  /** Sfondo pannelli traslucido: --panel */
  panel: 'rgba(0, 0, 0, 0.30)',
  /** Sfondo pannelli più marcato per avvisi e modali */
  panelHeavy: 'rgba(0, 0, 0, 0.78)',
  /** Pulsanti standard colore avorio: --btn */
  btn: '#f3e7c4',
  /** Testo pulsanti marrone scuro: --btn-ink */
  btnInk: '#3b2a14',
  /** Ombra pulsanti: --btn-shadow */
  btnShadow: '#b49a5e',
  /** Colore accento dorato: --accent */
  accent: '#e8b43a',
  /** Bordo chiaro della tessera: --edge */
  edge: '#2a8a62',
  /** Bordo scuro della tessera: --edge2 */
  edge2: '#17503b',
} as const;
