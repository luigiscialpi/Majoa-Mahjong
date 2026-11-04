import { grid, pyramid90 } from '../domain/__fixtures__/shapes';
import { boardFingerprint } from '../domain/fingerprint';
import { PROFILES, type Profile } from '../domain/profile';
import type { LevelSpec } from '../domain/types';
import { playRandomSession, snapshot } from './__fixtures__/play';
import { parseSavedGame, restoreSession, SAVED_GAME_VERSION, serializeSavedGame, toSavedGame, type SavedGame } from './savedGame';
import { startSession, type Session } from './session';

const SPEC: LevelSpec = { id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [4, 4], fog: 6, gold: 5, aids: { hints: 5, shuffles: 3, undo: null } };

function start(profile: Profile = 'normal', seed = 5, noTimePressure = false, spec: LevelSpec = SPEC): Session {
  const r = startSession({ spec, profile, seed, noTimePressure });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

function roundTrip(session: Session, levelId = 20): Session {
  const parsed = parseSavedGame(serializeSavedGame(toSavedGame(session, levelId)));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  const restored = restoreSession(parsed.value);
  if (!restored.ok) throw new Error(JSON.stringify(restored.error));
  return restored.value;
}

describe('toSavedGame', () => {
  test('salva specifica di base, profilo, seme, eventi, secondi e impronta, non la specifica col profilo', () => {
    const played = playRandomSession(start('hard', 5, true), 7, 40);
    expect(played.events.length).toBeGreaterThan(0);
    expect(played.seconds).toBeGreaterThan(0);
    const saved = toSavedGame(played, 20);
    expect(saved).toEqual({
      version: SAVED_GAME_VERSION,
      levelId: 20,
      spec: SPEC,
      profile: 'hard',
      seed: 5,
      noTimePressure: true,
      events: played.events,
      seconds: played.seconds,
      fingerprint: boardFingerprint(played.game),
    });
    expect(played.spec).not.toEqual(SPEC);
  });

  test('con una partita appena iniziata non ha eventi né tempo', () => {
    const saved = toSavedGame(start(), 3);
    expect(saved.events).toEqual([]);
    expect(saved.seconds).toBe(0);
    expect(saved.levelId).toBe(3);
  });
});

describe('restoreSession', () => {
  test.each(PROFILES.flatMap((p) => [1, 2, 3].map((seed) => [p, seed] as const)))('con %s e seme %i la partita ricostruita è identica, a metà e finita', (profile, seed) => {
    for (const maxActions of [30, 5000]) {
      const played = playRandomSession(start(profile, seed, seed === 2), seed, maxActions);
      const restored = roundTrip(played);
      // Una partita bloccata si ricostruisce ancora in corso (docs/sessione-di-gioco.md).
      const expected = played.phase === 'dead' ? { ...snapshot(played), phase: 'playing' } : snapshot(played);
      expect(snapshot(restored)).toEqual(expected);
      expect(restored.base).toEqual(SPEC);
      expect(restored.noTimePressure).toBe(seed === 2);
    }
  });

  test('una partita vinta si ricostruisce vinta, con lo stesso esito', () => {
    const flat: LevelSpec = { ...SPEC, cells: grid(6, 6, 0), types: 6, hidden: [], fog: 0, gold: 0 };
    const played = playRandomSession(start('normal', 1, false, flat), 1);
    expect(played.phase).toBe('won');
    const restored = roundTrip(played);
    expect(restored.phase).toBe('won');
    expect(restored.outcome).toEqual(played.outcome);
  });

  test('una partita appena iniziata si riprende', () => {
    const restored = roundTrip(start('easy', 9));
    expect(snapshot(restored)).toEqual(snapshot(start('easy', 9)));
  });

  const saved = (over: Partial<SavedGame> = {}): SavedGame => ({ ...toSavedGame(start(), 1), ...over });

  test('un evento che non si applica dà `event-rejected` con la sua posizione', () => {
    const result = restoreSession(saved({ events: [{ kind: 'hint' }, { kind: 'hint' }, { kind: 'undo' }] }));
    expect(result).toEqual({ ok: false, error: { kind: 'event-rejected', index: 2 } });
  });

  test('una specifica che non si genera dà `start-failed` con la causa', () => {
    const result = restoreSession(saved({ spec: { ...SPEC, cells: SPEC.cells.slice(0, 89) } }));
    expect(result).toEqual({ ok: false, error: { kind: 'start-failed', error: { kind: 'invalid-spec', reason: expect.any(String) } } });
  });

  test('una tavola diversa da quella salvata dà `board-mismatch`', () => {
    expect(restoreSession(saved({ seed: 6 }))).toEqual({ ok: false, error: { kind: 'board-mismatch' } });
    expect(restoreSession(saved({ fingerprint: '0000000000000000' }))).toEqual({ ok: false, error: { kind: 'board-mismatch' } });
  });

  test('con gli eventi di una partita giocata, un\'impronta diversa si nota anche a fine partita', () => {
    const played = playRandomSession(start('normal', 5), 7, 40);
    const tampered = { ...toSavedGame(played, 1), fingerprint: boardFingerprint(start('normal', 5).game) };
    expect(restoreSession(tampered)).toEqual({ ok: false, error: { kind: 'board-mismatch' } });
  });
});

describe('parseSavedGame', () => {
  const base = toSavedGame(playRandomSession(start('normal', 5), 7, 20), 20);
  const doc = (mutate: (d: Record<string, any>) => void = () => {}): string => {
    const d = JSON.parse(serializeSavedGame(base));
    mutate(d);
    return JSON.stringify(d);
  };
  const malformed = (field: string) => ({ ok: false, error: { kind: 'malformed', field } });

  test('legge ciò che serializeSavedGame scrive', () => {
    expect(parseSavedGame(serializeSavedGame(base))).toEqual({ ok: true, value: base });
    expect(base.events.length).toBeGreaterThan(0);
  });

  test.each<[string, string, string]>([
    ['testo che non è JSON', '{', 'json'],
    ['vuoto', '', 'json'],
    ['un array', '[]', 'root'],
    ['null', 'null', 'root'],
    ['una stringa', '"x"', 'root'],
  ])('%s', (_, text, field) => {
    expect(parseSavedGame(text)).toEqual(malformed(field));
  });

  test('versione mancante, non intera o di un altro tipo: malformato', () => {
    expect(parseSavedGame(doc((d) => delete d.version))).toEqual(malformed('version'));
    expect(parseSavedGame(doc((d) => (d.version = '1')))).toEqual(malformed('version'));
    expect(parseSavedGame(doc((d) => (d.version = 1.5)))).toEqual(malformed('version'));
  });

  test('un\'altra versione intera: `unsupported-version`, anche se il resto è diverso', () => {
    expect(parseSavedGame(doc((d) => (d.version = 2)))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 2 } });
    expect(parseSavedGame(doc((d) => (d.version = 0)))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 0 } });
    expect(parseSavedGame(JSON.stringify({ version: 3, altro: true }))).toEqual({ ok: false, error: { kind: 'unsupported-version', found: 3 } });
  });

  test.each(Object.keys(base))('senza il campo %s: malformato su quel campo', (key) => {
    expect(parseSavedGame(doc((d) => delete d[key]))).toEqual(malformed(key));
  });

  test('un campo in più non si ignora', () => {
    expect(parseSavedGame(doc((d) => (d.extra = 1)))).toEqual(malformed('extra'));
  });

  test.each<[string, (d: Record<string, any>) => void, string]>([
    ['levelId zero', (d) => (d.levelId = 0), 'levelId'],
    ['levelId non intero', (d) => (d.levelId = 1.5), 'levelId'],
    ['levelId testo', (d) => (d.levelId = '3'), 'levelId'],
    ['profilo sconosciuto', (d) => (d.profile = 'easyy'), 'profile'],
    ['seme negativo', (d) => (d.seed = -1), 'seed'],
    ['seme oltre 32 bit', (d) => (d.seed = 2 ** 32), 'seed'],
    ['seme non intero', (d) => (d.seed = 1.5), 'seed'],
    ['noTimePressure testo', (d) => (d.noTimePressure = 'no'), 'noTimePressure'],
    ['secondi negativi', (d) => (d.seconds = -1), 'seconds'],
    ['secondi testo', (d) => (d.seconds = '5'), 'seconds'],
    ['secondi non finiti', (d) => (d.seconds = null), 'seconds'],
    ['impronta non esadecimale', (d) => (d.fingerprint = 'xyz'), 'fingerprint'],
    ['impronta maiuscola', (d) => (d.fingerprint = 'ABCDEF0123456789'), 'fingerprint'],
    ['impronta corta', (d) => (d.fingerprint = '0123456789abcde'), 'fingerprint'],
    ['impronta lunga', (d) => (d.fingerprint = '0123456789abcdef0'), 'fingerprint'],
    ['impronta numero', (d) => (d.fingerprint = 1234567890123456), 'fingerprint'],
    ['eventi non array', (d) => (d.events = {}), 'events'],
    ['evento non oggetto', (d) => (d.events = ['move']), 'events[0]'],
    ['evento di tipo sconosciuto', (d) => (d.events = [{ kind: 'hint' }, { kind: 'jump' }]), 'events[1].kind'],
    ['evento senza tipo', (d) => (d.events = [{}]), 'events[0].kind'],
    ['mossa senza gruppo', (d) => (d.events = [{ kind: 'move' }]), 'events[0].group'],
    ['mossa con gruppo non array', (d) => (d.events = [{ kind: 'move', group: 3 }]), 'events[0].group'],
    ['mossa con indice testo', (d) => (d.events = [{ kind: 'move', group: [0, 'a'] }]), 'events[0].group'],
    ['mossa con indice negativo', (d) => (d.events = [{ kind: 'move', group: [-1, 2] }]), 'events[0].group'],
    ['mossa con indice non intero', (d) => (d.events = [{ kind: 'move', group: [0.5, 2] }]), 'events[0].group'],
    ['mossa con campo in più', (d) => (d.events = [{ kind: 'move', group: [0, 1], extra: 1 }]), 'events[0].extra'],
    ['aiuto con campo in più', (d) => (d.events = [{ kind: 'hint', group: [0, 1] }]), 'events[0].group'],
  ])('%s', (_, mutate, field) => {
    expect(parseSavedGame(doc(mutate))).toEqual(malformed(field));
  });

  test.each<[string, (s: Record<string, any>) => void, string]>([
    ['specifica non oggetto', () => {}, 'spec'],
    ['senza id', (s) => delete s.id, 'spec.id'],
    ['id numero', (s) => (s.id = 5), 'spec.id'],
    ['campo in più', (s) => (s.extra = 1), 'spec.extra'],
    ['tessere non array', (s) => (s.cells = {}), 'spec.cells'],
    ['tessera non oggetto', (s) => (s.cells[2] = 5), 'spec.cells[2]'],
    ['tessera senza z', (s) => delete s.cells[2].z, 'spec.cells[2].z'],
    ['tessera con z non numerica', (s) => (s.cells[2].z = null), 'spec.cells[2].z'],
    ['tessera con x testo', (s) => (s.cells[2].x = '1'), 'spec.cells[2].x'],
    ['tessera con campo in più', (s) => (s.cells[2].w = 1), 'spec.cells[2].w'],
    ['gruppo di 4', (s) => (s.groupSize = 4), 'spec.groupSize'],
    ['tipi zero', (s) => (s.types = 0), 'spec.types'],
    ['disegni zero', (s) => (s.poolSize = 0), 'spec.poolSize'],
    ['nascoste non array', (s) => (s.hidden = 4), 'spec.hidden'],
    ['nascoste negative', (s) => (s.hidden = [1, -1]), 'spec.hidden'],
    ['nebbia negativa', (s) => (s.fog = -1), 'spec.fog'],
    ['oro negativo', (s) => (s.gold = -1), 'spec.gold'],
    ['oro non intero', (s) => (s.gold = 1.5), 'spec.gold'],
    ['aiuti non oggetto', (s) => (s.aids = 3), 'spec.aids'],
    ['aiuti senza shuffles', (s) => delete s.aids.shuffles, 'spec.aids.shuffles'],
    ['aiuti con campo in più', (s) => (s.aids.extra = 1), 'spec.aids.extra'],
    ['suggerimenti negativi', (s) => (s.aids.hints = -1), 'spec.aids.hints'],
    ['annulla testo', (s) => (s.aids.undo = 'x'), 'spec.aids.undo'],
  ])('specifica: %s', (name, mutate, field) => {
    const text = doc((d) => (name === 'specifica non oggetto' ? (d.spec = 7) : mutate(d.spec)));
    expect(parseSavedGame(text)).toEqual(malformed(field));
  });

  test('un gruppo di 3 (tris) è valido', () => {
    expect(parseSavedGame(doc((d) => (d.spec.groupSize = 3))).ok).toBe(true);
  });

  test('le tessere possono stare a mezzi passi', () => {
    const parsed = parseSavedGame(doc((d) => (d.spec.cells[0].x = 0.5)));
    expect(parsed.ok).toBe(true);
  });

  test('una specifica con valori null negli aiuti è valida: aiuti illimitati', () => {
    const parsed = parseSavedGame(doc((d) => (d.spec.aids = { hints: null, shuffles: null, undo: null })));
    expect(parsed.ok).toBe(true);
  });
});
