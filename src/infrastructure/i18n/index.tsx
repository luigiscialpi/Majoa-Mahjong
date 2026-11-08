/**
 * Sistema i18n — punto di ingresso.
 *
 * - `t(key, params?)` traduce una chiave stringa nella lingua attiva (fallback: 'fr').
 * - `LanguageProvider` / `useTranslation()` per il cambio lingua al volo in React.
 * - `setActiveLanguage(lang)` per aggiornare la lingua fuori da React (es. messages.ts).
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Language, Locale, TranslationKey, TranslationParams } from './types';
import it from './locales/it';
import en from './locales/en';
import fr from './locales/fr';

export type { Language, Locale, TranslationKey, TranslationParams };

// ─── dizionari ───────────────────────────────────────────────────────────────

const LOCALES: Record<Language, Locale> = { it, en, fr };

/** Lingua di fallback (come nell'originale). */
const FALLBACK: Language = 'fr';

// ─── modulo-globale per contesti non-React ────────────────────────────────────

let _activeLang: Language = 'it';

/** Imposta la lingua attiva a livello di modulo (chiamata da LanguageProvider). */
export function setActiveLanguage(lang: Language): void {
  _activeLang = lang;
}

/** Legge la lingua attiva a livello di modulo. */
export function getActiveLanguage(): Language {
  return _activeLang;
}

// ─── interpolazione ───────────────────────────────────────────────────────────

/** Sostituisce `{k}` con i valori di `params` (fedele all'originale). */
export function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  let result = text;
  for (const k of Object.keys(params)) {
    result = result.split(`{${k}}`).join(String(params[k]));
  }
  return result;
}

// ─── funzione globale t() ─────────────────────────────────────────────────────

/**
 * Traduce una chiave nella lingua attiva (con fallback su 'fr').
 * Usabile anche fuori da React (messages.ts, format.ts, ecc.).
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const locale = LOCALES[_activeLang];
  const fallback = LOCALES[FALLBACK];
  const raw = (locale[key] ?? fallback[key] ?? key) as string;
  return interpolate(raw, params);
}

// ─── React Context ────────────────────────────────────────────────────────────

type LanguageContextValue = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'it',
  setLang: setActiveLanguage,
  t,
});

type LanguageProviderProps = {
  children: ReactNode;
  initial?: Language;
};

export function LanguageProvider({ children, initial = 'it' }: LanguageProviderProps) {
  const [lang, setLangState] = useState<Language>(initial);

  const setLang = useCallback((next: Language) => {
    setActiveLanguage(next);
    setLangState(next);
  }, []);

  // t() legato alla lingua corrente del provider (garantisce re-render)
  const tLang = useCallback(
    (key: TranslationKey, params?: TranslationParams): string => {
      const locale = LOCALES[lang];
      const fallback = LOCALES[FALLBACK];
      const raw = (locale[key] ?? fallback[key] ?? key) as string;
      return interpolate(raw, params);
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Hook per i componenti React: `{ t, lang, setLang }`. */
export function useTranslation() {
  return useContext(LanguageContext);
}

/** Espone i dizionari grezzi per accedere a tn/names/intro. */
export function locale(lang: Language): Locale {
  return LOCALES[lang];
}
