import { parsePlayParams } from './playParams';

test('livello e profilo validi', () => {
  const r = parsePlayParams('20', 'hard');
  expect([r.level?.id, r.profile]).toEqual([20, 'hard']);
});

test('profilo mancante o non valido: Normale', () => {
  expect(parsePlayParams('1', undefined).profile).toBe('normal');
  expect(parsePlayParams('1', 'impossibile').profile).toBe('normal');
});

test('livello mancante, fuori dai 100 o non numerico: nessun livello', () => {
  for (const level of [undefined, '0', '101', 'abc', '']) expect({ level, found: parsePlayParams(level, 'easy').level }).toEqual({ level, found: undefined });
});
