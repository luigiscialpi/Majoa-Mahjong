import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import it from './locales/it';
import en from './locales/en';
import fr from './locales/fr';
import { interpolate, t, setActiveLanguage, getActiveLanguage, useTranslation, LanguageProvider } from './index';
import type { Language, Locale } from './types';

// ─── parità chiavi tra le 3 lingue ───────────────────────────────────────────

const LOCALES: Record<Language, Locale> = { it, en, fr };
const STRING_KEYS = (Object.keys(fr) as (keyof Locale)[]).filter((k) => k !== 'tn' && k !== 'names' && k !== 'intro');

describe('i18n — parità dizionari', () => {
  for (const lang of ['it', 'en'] as Language[]) {
    test(`${lang} ha tutte le chiavi di fr`, () => {
      const locale = LOCALES[lang];
      const missing = STRING_KEYS.filter((k) => locale[k] === undefined || locale[k] === null);
      expect(missing).toEqual([]);
    });
  }

  test('tn ha 129 voci in tutte le lingue', () => {
    for (const lang of ['it', 'en', 'fr'] as Language[]) {
      expect(LOCALES[lang].tn).toHaveLength(129);
    }
  });

  test('names ha 20 voci in tutte le lingue', () => {
    for (const lang of ['it', 'en', 'fr'] as Language[]) {
      expect(LOCALES[lang].names).toHaveLength(20);
    }
  });

  test('intro ha lo stesso numero di chiavi in tutte le lingue', () => {
    const counts = (['it', 'en', 'fr'] as Language[]).map((l) => Object.keys(LOCALES[l].intro).length);
    expect(new Set(counts).size).toBe(1);
  });
});

// ─── interpolazione ───────────────────────────────────────────────────────────

describe('interpolate', () => {
  test('sostituisce un parametro singolo', () => {
    expect(interpolate('Livello {n}', { n: 42 })).toBe('Livello 42');
  });

  test('sostituisce più parametri', () => {
    expect(interpolate('Tempo: {t}, Aiuti: {n}', { t: '1:30', n: 2 })).toBe('Tempo: 1:30, Aiuti: 2');
  });

  test('testo senza parametri rimane invariato', () => {
    expect(interpolate('Aiuto')).toBe('Aiuto');
  });

  test('parametro assente rimane come {k}', () => {
    expect(interpolate('Livello {n}', {})).toBe('Livello {n}');
  });
});

// ─── funzione globale t() ─────────────────────────────────────────────────────

describe('t() globale', () => {
  beforeEach(() => setActiveLanguage('it'));
  afterEach(() => setActiveLanguage('it'));

  test('traduce in italiano', () => {
    expect(t('hint')).toBe('Aiuto');
  });

  test('cambia con setActiveLanguage → en', () => {
    setActiveLanguage('en');
    expect(t('hint')).toBe('Hint');
  });

  test('cambia con setActiveLanguage → fr', () => {
    setActiveLanguage('fr');
    expect(t('hint')).toBe('Aide');
  });

  test('interpola i parametri', () => {
    expect(t('level', { n: 5 })).toBe('Livello 5');
  });

  test('getActiveLanguage restituisce la lingua corrente', () => {
    setActiveLanguage('fr');
    expect(getActiveLanguage()).toBe('fr');
  });
});

// ─── LanguageProvider / useTranslation ───────────────────────────────────────

function makeWrapper(initial: Language = 'it') {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(LanguageProvider, { initial, children });
  };
}

describe('useTranslation', () => {
  test('restituisce la traduzione nella lingua iniziale', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: makeWrapper('it') });
    expect(result.current.lang).toBe('it');
    expect(result.current.t('hint')).toBe('Aiuto');
  });

  test('setLang → en cambia lingua al volo', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: makeWrapper('it') });
    await act(async () => { result.current.setLang('en'); });
    expect(result.current.lang).toBe('en');
    expect(result.current.t('hint')).toBe('Hint');
  });

  test('setLang → fr', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: makeWrapper('it') });
    await act(async () => { result.current.setLang('fr'); });
    expect(result.current.t('hint')).toBe('Aide');
  });

  test('t con parametri in italiano', async () => {
    const { result } = await renderHook(() => useTranslation(), { wrapper: makeWrapper('it') });
    expect(result.current.t('level', { n: 7 })).toBe('Livello 7');
  });
});

