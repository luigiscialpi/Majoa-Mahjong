import { pyramid90 } from '../domain/__fixtures__/shapes';
import { findMove } from '../domain/hint';
import type { LevelSpec } from '../domain/types';
import { reduceRound, startRound, type Round } from './round';
import { hint, shuffle, tap, tick, undo } from './session';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids: { hints: 5, shuffles: 3, undo: null }, ...over });
function start(): Round {
  const r = startRound({ spec: spec(), profile: 'normal', seed: 1 });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

test('startRound: partita nuova senza feedback; specifica non valida: errore tipizzato', () => {
  const round = start();
  expect([round.feedback, round.seq, round.session.phase]).toEqual([null, 0, 'playing']);
  expect(startRound({ spec: spec({ cells: pyramid90().slice(0, 89) }), profile: 'normal', seed: 1 })).toMatchObject({ ok: false, error: { kind: 'invalid-spec' } });
});

test('ogni azione dà lo stesso risultato della funzione di sessione e fa avanzare il numero progressivo', () => {
  const round = start();
  const [a, b] = findMove(round.session.game) ?? [];
  const afterTap = reduceRound(round, { type: 'tap', tile: a });
  expect([afterTap.feedback, afterTap.seq, afterTap.session.selected]).toEqual([tap(round.session, a).feedback, 1, [a]]);
  const afterMatch = reduceRound(afterTap, { type: 'tap', tile: b });
  expect([afterMatch.feedback?.kind, afterMatch.seq, afterMatch.session.game.remaining]).toEqual(['matched', 2, 88]);
  expect(reduceRound(afterMatch, { type: 'hint' }).feedback).toEqual(hint(afterMatch.session).feedback);
  expect(reduceRound(afterMatch, { type: 'undo' }).feedback).toEqual(undo(afterMatch.session).feedback);
  expect(reduceRound(afterMatch, { type: 'shuffle' }).feedback).toEqual(shuffle(afterMatch.session).feedback);
  expect(reduceRound(afterMatch, { type: 'rescue' }).feedback).toEqual({ kind: 'ignored' }); // c'è ancora una mossa
});

test('il tempo passa senza toccare feedback e numero progressivo', () => {
  const round = reduceRound(start(), { type: 'hint' });
  const later = reduceRound(round, { type: 'tick', seconds: 5 });
  expect([later.feedback, later.seq, later.session.seconds]).toEqual([round.feedback, round.seq, tick(round.session, 5).seconds]);
  expect(reduceRound(round, { type: 'tick' }).session.seconds).toBe(round.session.seconds + 1);
});

test('non modifica il round ricevuto', () => {
  const round = start();
  const before = JSON.stringify([round.seq, round.feedback, round.session.selected, round.session.seconds, round.session.events]);
  reduceRound(round, { type: 'tap', tile: findMove(round.session.game)?.[0] ?? 0 });
  reduceRound(round, { type: 'tick' });
  expect(JSON.stringify([round.seq, round.feedback, round.session.selected, round.session.seconds, round.session.events])).toBe(before);
});

test('a partita finita il tempo non produce un round nuovo (React non ridisegna)', () => {
  const finished: Round = { ...start(), session: { ...start().session, phase: 'dead' } };
  expect(reduceRound(finished, { type: 'tick' })).toBe(finished);
  const playing = start();
  expect(reduceRound(playing, { type: 'tick' })).not.toBe(playing);
});
