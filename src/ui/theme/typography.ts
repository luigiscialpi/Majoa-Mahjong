import type { TextStyle } from 'react-native';

/**
 * File e mapping dei font incorporati per l'app.
 *
 * Scelta tipografica per un Mahjong di successo (sostituisce Georgia e Trebuchet MS dell'originale):
 * - Titoli e numeri di livello: «Lora» (Serif contemporaneo, caldo, raffinato, erede moderno di Georgia).
 * - Interfaccia, pulsanti e testi: «Nunito» (Humanist Sans arrotondato, morbido, leggibile e accogliente,
 *   standard dei giochi mobile casual di successo, sostituto di Trebuchet MS).
 *
 * SOSTITUZIONE FUTURA:
 * Per cambiare i font in futuro, basta:
 * 1. Aggiungere i nuovi file .ttf in assets/fonts/
 * 2. Aggiornare FONT_MAP e fontFamilies in questo file.
 * Tutte le schermate e i componenti ereditano automaticamente le modifiche.
 */
export const FONT_MAP = {
  'Lora-Bold': require('../../../assets/fonts/Lora-Bold.ttf'),
  'Lora-SemiBold': require('../../../assets/fonts/Lora-SemiBold.ttf'),
  'Nunito-Regular': require('../../../assets/fonts/Nunito-Regular.ttf'),
  'Nunito-Bold': require('../../../assets/fonts/Nunito-Bold.ttf'),
  'Nunito-ExtraBold': require('../../../assets/fonts/Nunito-ExtraBold.ttf'),
};

export const fontFamilies = {
  /** Titoli di schermata, numeri di livello, dialoghi di rilievo (serif) */
  title: 'Lora-Bold',
  titleSemiBold: 'Lora-SemiBold',
  /** Testi di interfaccia, etichette, chip e descrizioni (sans) */
  body: 'Nunito-Regular',
  bodyBold: 'Nunito-Bold',
  bodyExtraBold: 'Nunito-ExtraBold',
} as const;

/**
 * NOTA SUI PESI DEI FONT SU ANDROID (React Native):
 * Quando si carica un font specifico (es. 'Lora-Bold', 'Nunito-Bold'), il peso è già
 * incorporato nel file TTF. Su Android, accoppiare `fontFamily: 'Lora-Bold'` con `fontWeight: '700'`
 * o `'bold'` fa fallire la risoluzione del font (Android cerca una variante 'bold' inesistente
 * all'interno del file già bold) e provoca il fallback al font di sistema (Roboto).
 * Pertanto le definizioni di stile che usano i font incorporati NON devono impostare fontWeight.
 */
export const typography = {
  /** Titolo principale delle schermate (Home, Fine partita) */
  title: {
    fontFamily: fontFamilies.title,
  } as TextStyle,
  /** Titoli intermedi e sottotitoli eleganti */
  titleSemiBold: {
    fontFamily: fontFamilies.titleSemiBold,
  } as TextStyle,
  /** Testi correnti, spiegazioni, etichette standard */
  body: {
    fontFamily: fontFamilies.body,
  } as TextStyle,
  /** Testi in risalto, etichette attive, avvisi */
  bodyBold: {
    fontFamily: fontFamilies.bodyBold,
  } as TextStyle,
  /** Testi marcati, badge, titoli compatti */
  bodyExtraBold: {
    fontFamily: fontFamilies.bodyExtraBold,
  } as TextStyle,
  /** Etichette dei pulsanti d'azione */
  button: {
    fontFamily: fontFamilies.bodyBold,
  } as TextStyle,
  /** Timer e cifre numeriche */
  timer: {
    fontFamily: fontFamilies.bodyBold,
  } as TextStyle,
} as const;

