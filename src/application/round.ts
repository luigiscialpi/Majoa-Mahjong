import type { GenError, Result } from '../domain/types';
import { hint, rescue, shuffle, startSession, tap, tick, undo, type Feedback, type Session, type StartInput } from './session';

// Round: una sessione con l'ultimo feedback, nella forma che serve a un reducer di React (`useReducer`).

export type Round = {
  readonly session: Session;
  /** Ultimo feedback e numero progressivo: cambia a ogni azione, così l'interfaccia reagisce anche a feedback uguali. */
  readonly feedback: Feedback | null;
  readonly seq: number;
};

export type RoundAction = { type: 'tap'; tile: number } | { type: 'hint' } | { type: 'undo' } | { type: 'shuffle' } | { type: 'rescue' } | { type: 'tick'; seconds?: number };

export function startRound(input: StartInput): Result<Round, GenError> {
  const started = startSession(input);
  if (!started.ok) return started;
  return { ok: true, value: { session: started.value, feedback: null, seq: 0 } };
}

export function reduceRound(round: Round, action: RoundAction): Round {
  if (action.type === 'tick') {
    const next = tick(round.session, action.seconds ?? 1);
    return next === round.session ? round : { ...round, session: next }; // a partita finita il tempo non cambia nulla: stesso round, nessun render
  }
  const step =
    action.type === 'tap' ? tap(round.session, action.tile) : action.type === 'hint' ? hint(round.session) : action.type === 'undo' ? undo(round.session) : action.type === 'shuffle' ? shuffle(round.session) : rescue(round.session);
  return { session: step.session, feedback: step.feedback, seq: round.seq + 1 };
}
