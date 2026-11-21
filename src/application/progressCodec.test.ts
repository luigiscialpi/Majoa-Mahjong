import { newProgress, recordWin, type Progress } from '../domain/progress';
import { SIG } from './__fixtures__/content';
import { parseProgress, PROGRESS_VERSION, serializeProgress } from './progressCodec';

const win = { signature: SIG, levelId: 20, stars: 2, seconds: 83.5, gold: 3, profile: 'hard', noTimePressure: false } as const;
const played: Progress = { ...recordWin(recordWin(newProgress(), win).progress, { ...win, levelId: 3, stars: 3, profile: 'master' }).progress, giftsOpened: ['animals', 'sea'] };

const malformed = (field: string) => ({ ok: false, error: { kind: 'malformed', field } });
const doc = (mutate: (d: Record<string, any>) => void = () => {}): string => {
  const d = JSON.parse(serializeProgress(played));
  mutate(d);
  return JSON.stringify(d);
};

describe('serializeProgress e parseProgress', () => {
  test('i progressi iniziali tornano uguali', () => {
    expect(parseProgress(serializeProgress(newProgress()))).toEqual({ ok: true, value: newProgress() });
  });

  test('i progressi giocati tornano uguali, con le chiavi dei livelli come numeri', () => {
    const parsed = parseProgress(serializeProgress(played));
    expect(parsed).toEqual({ ok: true, value: played });
    expect(Object.keys(played.levels)).toEqual(['3', '20']);
    expect(played.levels[20].bestSeconds).toBe(83.5);
  });

  test('scrive la versione', () => {
    expect(JSON.parse(serializeProgress(newProgress())).version).toBe(PROGRESS_VERSION);
  });

  test.each<[string, string, string]>([
    ['testo che non è JSON', '{', 'json'],
    ['vuoto', '', 'json'],
    ['un array', '[]', 'root'],
    ['null', 'null', 'root'],
    ['un numero', '5', 'root'],
  ])('%s', (_, text, field) => {
    expect(parseProgress(text)).toEqual(malformed(field));
  });

  test('versione mancante, non intera o di un altro tipo: malformato', () => {
    expect(parseProgress(doc((d) => delete d.version))).toEqual(malformed('version'));
    expect(parseProgress(doc((d) => (d.version = '1')))).toEqual(malformed('version'));
    expect(parseProgress(doc((d) => (d.version = 1.5)))).toEqual(malformed('version'));
  });

  test('un\'altra versione intera: `unsupported-version`, anche se il resto è diverso', () => {
    expect(parseProgress(doc((d) => (d.version = 3)))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 3 } });
    expect(parseProgress(doc((d) => (d.version = 0)))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 0 } });
    expect(parseProgress(JSON.stringify({ version: 7, livelli: [] }))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 7 } });
  });

  test.each(['version', 'levels', 'coins', 'giftsOpened'])('senza il campo %s: malformato su quel campo', (key) => {
    expect(parseProgress(doc((d) => delete d[key]))).toEqual(malformed(key));
  });

  test('un campo in più non si ignora', () => {
    expect(parseProgress(doc((d) => (d.extra = 1)))).toEqual(malformed('extra'));
  });

  test.each<[string, (d: Record<string, any>) => void, string]>([
    ['livelli non oggetto', (d) => (d.levels = []), 'levels'],
    ['livelli null', (d) => (d.levels = null), 'levels'],
    ['chiave zero', (d) => (d.levels['0'] = d.levels['3']), 'levels.0'],
    ['chiave con zero davanti', (d) => (d.levels['03'] = d.levels['3']), 'levels.03'],
    ['chiave testo', (d) => (d.levels.tre = d.levels['3']), 'levels.tre'],
    ['chiave negativa', (d) => (d.levels['-1'] = d.levels['3']), 'levels.-1'],
    ['chiave non intera', (d) => (d.levels['1.5'] = d.levels['3']), 'levels.1.5'],
    ['livello non oggetto', (d) => (d.levels['3'] = 5), 'levels.3'],
    ['livello null', (d) => (d.levels['3'] = null), 'levels.3'],
    ['livello senza stelle', (d) => delete d.levels['3'].stars, 'levels.3.stars'],
    ['livello con campo in più', (d) => (d.levels['3'].extra = 1), 'levels.3.extra'],
    ['stelle 4', (d) => (d.levels['3'].stars = 4), 'levels.3.stars'],
    ['stelle negative', (d) => (d.levels['3'].stars = -1), 'levels.3.stars'],
    ['stelle non intere', (d) => (d.levels['3'].stars = 1.5), 'levels.3.stars'],
    ['stelle testo', (d) => (d.levels['3'].stars = '3'), 'levels.3.stars'],
    ['tempo negativo', (d) => (d.levels['3'].bestSeconds = -1), 'levels.3.bestSeconds'],
    ['tempo testo', (d) => (d.levels['3'].bestSeconds = '9'), 'levels.3.bestSeconds'],
    ['tempo mancante', (d) => delete d.levels['3'].bestSeconds, 'levels.3.bestSeconds'],
    ['oro negativo', (d) => (d.levels['3'].gold = -1), 'levels.3.gold'],
    ['oro non intero', (d) => (d.levels['3'].gold = 0.5), 'levels.3.gold'],
    ['profilo sconosciuto', (d) => (d.levels['3'].profile = 'legend'), 'levels.3.profile'],
    ['profilo mancante', (d) => delete d.levels['3'].profile, 'levels.3.profile'],
    ['✨ negative', (d) => (d.coins = -1), 'coins'],
    ['✨ non intere', (d) => (d.coins = 2.5), 'coins'],
    ['✨ testo', (d) => (d.coins = '3'), 'coins'],
    ['regali non array', (d) => (d.giftsOpened = 'animals'), 'giftsOpened'],
    ['regalo non testo', (d) => (d.giftsOpened = ['animals', 3]), 'giftsOpened[1]'],
    ['regalo vuoto', (d) => (d.giftsOpened = ['']), 'giftsOpened[0]'],
    ['regalo doppio', (d) => (d.giftsOpened = ['animals', 'sea', 'animals']), 'giftsOpened[2]'],
  ])('%s', (_, mutate, field) => {
    expect(parseProgress(doc(mutate))).toEqual(malformed(field));
  });

  test('un record di tempo nullo e nessuna stella sono validi', () => {
    const parsed = parseProgress(doc((d) => (d.levels['3'] = { stars: 0, bestSeconds: null, gold: 0, profile: null })));
    expect(parsed.ok).toBe(true);
  });

  test('gli estremi validi: tre stelle, tempo zero, ✨ zero', () => {
    const parsed = parseProgress(doc((d) => {
      d.levels['3'].stars = 3;
      d.levels['3'].bestSeconds = 0;
      d.coins = 0;
    }));
    expect(parsed.ok).toBe(true);
  });
});

describe('firme nei progressi (versione 2) e lettura della versione 1', () => {
  const SIG2 = 'fedcba9876543210';
  const withSignature = (): Progress => ({ ...newProgress(), levels: { 7: { stars: 3, bestSeconds: 60, gold: 1, profile: 'hard', signature: SIG2 } } });
  const v1 = (): string => JSON.stringify({ version: 1, levels: { 7: { stars: 3, bestSeconds: 60, gold: 1, profile: 'hard' } }, coins: 3, giftsOpened: [] });

  test('la versione scritta è la 2 e i record firmati tornano uguali, con la firma', () => {
    expect(PROGRESS_VERSION).toBe(2);
    const parsed = parseProgress(serializeProgress(withSignature()));
    expect(parsed).toEqual({ ok: true, value: withSignature() });
    expect(JSON.parse(serializeProgress(withSignature())).levels[7].signature).toBe(SIG2);
  });

  test('un record senza firma si scrive senza la chiave e si rilegge senza firma', () => {
    const unsigned: Progress = { ...newProgress(), levels: { 7: { stars: 1, bestSeconds: null, gold: 0, profile: null } } };
    expect(Object.hasOwn(JSON.parse(serializeProgress(unsigned)).levels[7], 'signature')).toBe(false);
    const parsed = parseProgress(serializeProgress(unsigned));
    expect(parsed).toEqual({ ok: true, value: unsigned });
    expect(parsed.ok && Object.hasOwn(parsed.value.levels[7], 'signature')).toBe(false);
  });

  test('un documento della versione 1 si legge ancora, con i record senza firma', () => {
    const parsed = parseProgress(v1());
    expect(parsed).toEqual({ ok: true, value: { levels: { 7: { stars: 3, bestSeconds: 60, gold: 1, profile: 'hard' } }, coins: 3, giftsOpened: [] } });
  });

  test('un documento della versione 1 non può avere firme; un\'altra versione non si legge', () => {
    const d = JSON.parse(v1());
    d.levels[7].signature = SIG2;
    expect(parseProgress(JSON.stringify(d))).toEqual(malformed('levels.7.signature'));
    expect(parseProgress(JSON.stringify({ ...JSON.parse(v1()), version: 3 }))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 3 } });
  });

  test.each([['non è una stringa', 5], ['è vuota', ''], ['ha lettere maiuscole', 'FEDCBA9876543210'], ['è troppo corta', 'fedcba987654321'], ['è troppo lunga', 'fedcba98765432100'], ['non è esadecimale', 'fedcba987654321g'], ['è nulla', null]])('una firma che %s: malformato su quel campo', (_, value) => {
    expect(parseProgress(doc((d) => (d.levels[3].signature = value)))).toEqual(malformed('levels.3.signature'));
  });
});
