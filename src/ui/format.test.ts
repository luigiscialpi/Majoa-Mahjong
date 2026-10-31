import { PROFILES } from '../domain/profile';
import { PROFILE_NAMES, aidText, formatTime, starsText } from './format';

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

test('PROFILE_NAMES: un nome per ogni profilo, in ordine di difficoltà', () => {
  expect(PROFILES.map((p) => PROFILE_NAMES[p])).toEqual(['Facile', 'Normale', 'Medio', 'Difficile', 'Esperto', 'Maestro']);
});
