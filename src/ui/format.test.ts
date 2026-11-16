import { PROFILES } from '../domain/profile';
import { setActiveLanguage } from '../infrastructure/i18n';
import { PROFILE_KEYS, aidText, displayLevelNumber, formatTime, islandName, starsText } from './format';
import { legacyIslands, trisLevelIds } from '../infrastructure/content/legacyIslands';

test('formatTime: minuti e secondi, ore oltre i 60 minuti, mai negativo', () => {
  expect([0, 9, 59, 60, 61, 599, 3599, 3600, 3725, 45296].map(formatTime)).toEqual(['0:00', '0:09', '0:59', '1:00', '1:01', '9:59', '59:59', '1:00:00', '1:02:05', '12:34:56']);
  expect(formatTime(-5)).toBe('0:00');
  expect(formatTime(75.9)).toBe('1:15');
});

test('starsText: stelle piene e vuote su tre, limitate a 0-3', () => {
  expect([0, 1, 2, 3].map(starsText)).toEqual(['☆☆☆', '★☆☆', '★★☆', '★★★']);
  expect([starsText(-1), starsText(5)]).toEqual(['☆☆☆', '★★★']);
});

test('aidText: ∞ se illimitati', () => {
  expect([aidText(null), aidText(0), aidText(7)]).toEqual(['∞', '0', '7']);
});

test('PROFILE_KEYS: una chiave tradotta per ogni profilo, in ordine di difficoltà', () => {
  expect(PROFILES.map((p) => PROFILE_KEYS[p])).toEqual(['dif_easy', 'dif_normal', 'dif_medium', 'dif_hard', 'dif_expert', 'dif_master']);
});

describe('islandName', () => {
  test.each([
    ['prologue', 'Livelli iniziali'],
    ['animals', 'Animali'],
    ['sweets', 'Dolci'],
    ['art', 'Arte'],
    ['science', 'Scienza'],
    ['sea', 'Mare'],
    ['flowers', 'Fiori'],
  ])('%s è «%s»', (id, name) => {
    expect(islandName(id)).toBe(name);
  });

  test('uses the short name from the active language', () => {
    setActiveLanguage('en');
    try {
      expect(islandName('animals')).toBe('Animals');
    } finally {
      setActiveLanguage('it');
    }
  });

  test('un\'isola sconosciuta si mostra con il suo id', () => {
    expect(islandName('nuvole')).toBe('nuvole');
  });
});

test('il numero visibile segue la posizione di campagna senza cambiare i codici salvati', () => {
  const expanded = [
    legacyIslands[0],
    legacyIslands[1],
    { ...legacyIslands[2], levelIds: [...legacyIslands[2].levelIds, ...Array.from({ length: 10 }, (_, i) => 101 + i)] },
    { ...legacyIslands[3], levelIds: [...legacyIslands[3].levelIds, ...Array.from({ length: 10 }, (_, i) => 111 + i)] },
    { ...legacyIslands[4], levelIds: [...legacyIslands[4].levelIds, ...Array.from({ length: 10 }, (_, i) => 121 + i)] },
    { ...legacyIslands[5], levelIds: [...legacyIslands[5].levelIds, ...Array.from({ length: 10 }, (_, i) => 131 + i)] },
    { ...legacyIslands[6], levelIds: [...legacyIslands[6].levelIds, ...Array.from({ length: 10 }, (_, i) => 141 + i)] },
  ];
  expect(displayLevelNumber(expanded, 101)).toBe(51);
  expect(displayLevelNumber(expanded, 51)).toBe(61);
  expect(displayLevelNumber(expanded, 150)).toBe(140);
  expect(displayLevelNumber(legacyIslands, trisLevelIds[4])).toBe(5);
});
