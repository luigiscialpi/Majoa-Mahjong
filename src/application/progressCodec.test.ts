import { newProgress, recordWin, type Progress } from '../domain/progress';
import { parseProgress, PROGRESS_VERSION, serializeProgress } from './progressCodec';

const win = { levelId: 20, stars: 2, seconds: 83.5, gold: 3, profile: 'hard', noTimePressure: false } as const;
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
    expect(parseProgress(doc((d) => (d.version = 2)))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 2 } });
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
