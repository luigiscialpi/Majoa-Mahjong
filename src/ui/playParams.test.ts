import { parsePlayParams } from './playParams';

test('livello e profilo validi', () => {
  const r = parsePlayParams('20', 'hard');
  expect([r.level?.id, r.profile]).toEqual([20, 'hard']);
});

test('profilo mancante o non valido: Normale', () => {
  expect(parsePlayParams('1', undefined).profile).toBe('normal');
  expect(parsePlayParams('1', 'impossibile').profile).toBe('normal');
});

test('i nuovi ID puntano ai livelli estesi e infiniti', () => {
  expect(parsePlayParams('101', 'easy').level?.id).toBe(101);
  expect(parsePlayParams('151', 'easy').level?.id).toBe(151);
});

test('livello mancante, non positivo o non numerico: nessun livello', () => {
  for (const level of [undefined, '0', '-1', 'abc', '']) expect({ level, found: parsePlayParams(level, 'easy').level }).toEqual({ level, found: undefined });
});
