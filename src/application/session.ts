import { GameState, applyMove } from '../domain/gameState';
import { generateLevel } from '../domain/generator';
import { findMove } from '../domain/hint';
import { hashSeed } from '../domain/prng';
import { PROFILE_RULES, applyProfile, type Profile } from '../domain/profile';
import { reshuffle } from '../domain/reshuffle';
import { starsFor, type Stars } from '../domain/stars';
import type { GenError, LevelSpec, MoveError, Result } from '../domain/types';

// Sessione di gioco: una partita in corso (tavola, selezione, aiuti, tempo) e le azioni del giocatore.
// Stato immutabile: ogni azione restituisce una nuova sessione e il `feedback` per suoni e animazioni.
// Senza React, senza timer e senza disco: i ritardi (rimescolo automatico dopo 1,1 s) li gestisce l'interfaccia.

export type Phase = 'playing' | 'won' | 'dead';

/** Aiuti rimasti; `null` = illimitati. */
export type Aids = { hints: number | null; shuffles: number | null; undo: number | null };

/** Azioni che cambiano la partita, nell'ordine in cui sono avvenute: bastano per ricostruirla (`replaySession`). */
export type SessionEvent =
  | { kind: 'move'; group: readonly number[] }
  | { kind: 'hint' }
  | { kind: 'undo' }
  | { kind: 'shuffle' }
  | { kind: 'rescue' };

export type Outcome = { stars: Stars; seconds: number; aidsUsed: number; gold: number; goldTotal: number };

export type Session = {
  /** Specifica con il profilo già applicato. */
  readonly spec: LevelSpec;
  readonly profile: Profile;
  readonly seed: number;
  readonly noTimePressure: boolean;
  readonly game: GameState;
  /** Stati precedenti, per Annulla; si svuota dopo ogni rimescolo. */
  readonly history: readonly GameState[];
  readonly selected: readonly number[];
  readonly left: Aids;
  /** Aiuti usati: Aiuto, Annulla e Mischia (il rimescolo automatico non conta). */
  readonly aidsUsed: number;
  /** Rimescoli automatici gratuiti rimasti; `null` = illimitati. */
  readonly freeShuffles: number | null;
  readonly shuffleCount: number;
  /** C'è stato un rimescolo: spiega perché Annulla non ha nulla da annullare. */
  readonly afterShuffle: boolean;
  readonly seconds: number;
  readonly phase: Phase;
  readonly outcome: Outcome | null;
  readonly events: readonly SessionEvent[];
};

export type Feedback =
  | { kind: 'ignored' }
  | { kind: 'selected' }
  | { kind: 'deselected' }
  | { kind: 'mismatch' }
  | { kind: 'rejected'; reason: 'locked' | MoveError }
  | { kind: 'matched'; group: readonly number[]; unlocked: boolean; gold: number }
  | { kind: 'hint'; group: readonly number[] }
  | { kind: 'undone' }
  | { kind: 'shuffled' }
  | { kind: 'shuffle-failed' }
  | { kind: 'rescued' }
  | { kind: 'no-aid-left'; aid: keyof Aids }
  | { kind: 'nothing-to-undo'; afterShuffle: boolean }
  | { kind: 'advice'; use: 'shuffle' | 'undo' }
  | { kind: 'dead' };

export type Step = { session: Session; feedback: Feedback };

export type StartInput = { spec: LevelSpec; profile: Profile; seed: number; noTimePressure?: boolean };

const step = (session: Session, feedback: Feedback): Step => ({ session, feedback });
const ignored = (session: Session): Step => step(session, { kind: 'ignored' });
const spend = (n: number | null): number | null => (n === null ? null : n - 1);

/** Nuova partita: applica il profilo alla specifica e genera la tavola con il seme. */
export function startSession(input: StartInput): Result<Session, GenError> {
  const spec = applyProfile(input.spec, input.profile);
  const generated = generateLevel(spec, input.seed);
  if (!generated.ok) return generated;
  return {
    ok: true,
    value: {
      spec,
      profile: input.profile,
      seed: input.seed,
      noTimePressure: input.noTimePressure ?? false,
      game: new GameState(generated.value.tiles, spec.groupSize, spec.poolSize),
      history: [],
      selected: [],
      left: spec.aids,
      aidsUsed: 0,
      freeShuffles: PROFILE_RULES[input.profile].freeShuffles,
      shuffleCount: 0,
      afterShuffle: false,
      seconds: 0,
      phase: 'playing',
      outcome: null,
      events: [],
    },
  };
}

/** Tessere d'oro prese e totali. */
export function goldCount(session: Session): { got: number; total: number } {
  let got = 0;
  let total = 0;
  session.game.tiles.forEach((t, i) => {
    if (!t.gold) return;
    total++;
    if (session.game.ft.alive[i] === 0) got++;
  });
  return { got, total };
}

/** Nessuna mossa possibile: l'interfaccia avvia `rescue` dopo un breve avviso. */
export function isStuck(session: Session): boolean {
  return session.phase === 'playing' && session.game.remaining > 0 && findMove(session.game) === null;
}

/** Passa del tempo di gioco; a partita finita non conta. */
export function tick(session: Session, seconds = 1): Session {
  return session.phase === 'playing' ? { ...session, seconds: session.seconds + seconds } : session;
}

/**
 * Tocco su una tessera. Nascosta o non libera: rifiutata, la selezione non cambia. Già selezionata: si deseleziona tutto.
 * Dello stesso tipo della prima selezionata: completa il gruppo (nei Tris serve una seconda tessera) e lo toglie.
 * Di tipo diverso: sostituisce la selezione.
 */
export function tap(session: Session, tile: number): Step {
  const { game } = session;
  if (session.phase !== 'playing' || !Number.isInteger(tile) || tile < 0 || tile >= game.tiles.length || game.ft.alive[tile] === 0) return ignored(session);
  if (game.tiles[tile].hiddenGroup > game.unlocked) return step(session, { kind: 'rejected', reason: 'locked' });
  if (!game.ft.isFree(tile)) return step(session, { kind: 'rejected', reason: 'tile-blocked' });
  const selected = session.selected;
  if (selected.includes(tile)) return step({ ...session, selected: [] }, { kind: 'deselected' });
  if (selected.length === 0) return step({ ...session, selected: [tile] }, { kind: 'selected' });
  if (game.tiles[selected[0]].type !== game.tiles[tile].type) return step({ ...session, selected: [tile] }, { kind: 'mismatch' });
  if (game.g === 3 && selected.length === 1) return step({ ...session, selected: [selected[0], tile] }, { kind: 'selected' });
  return playGroup(session, [...selected, tile]);
}

/** Toglie un gruppo di tessere (come dopo i tocchi), con le stesse regole di `applyMove`. Se è l'ultimo, la partita è vinta. */
export function playGroup(session: Session, group: readonly number[]): Step {
  if (session.phase !== 'playing') return ignored(session);
  const moved = applyMove(session.game, group);
  if (!moved.ok) return step(session, { kind: 'rejected', reason: moved.error });
  const before = session.game;
  let next: Session = {
    ...session,
    game: moved.value,
    history: [...session.history, before],
    selected: [],
    events: [...session.events, { kind: 'move', group: [...group] }],
  };
  if (moved.value.remaining === 0) next = win(next);
  const gold = group.filter((i) => before.tiles[i].gold).length;
  return step(next, { kind: 'matched', group: [...group], unlocked: moved.value.unlocked > before.unlocked, gold });
}

function win(session: Session): Session {
  const { got, total } = goldCount(session);
  const stars = starsFor({ seconds: session.seconds, tiles: session.spec.cells.length, aidsUsed: session.aidsUsed, profile: session.profile, noTimePressure: session.noTimePressure });
  return { ...session, phase: 'won', outcome: { stars, seconds: session.seconds, aidsUsed: session.aidsUsed, gold: got, goldTotal: total } };
}

/** Aiuto: suggerisce una mossa e conta come aiuto. Senza mosse possibili avvia il rimescolo automatico. */
export function hint(session: Session): Step {
  if (session.phase !== 'playing') return ignored(session);
  if (session.left.hints !== null && session.left.hints <= 0) return step(session, { kind: 'no-aid-left', aid: 'hints' });
  const group = findMove(session.game);
  if (!group) return rescue(session);
  const next: Session = { ...session, left: { ...session.left, hints: spend(session.left.hints) }, aidsUsed: session.aidsUsed + 1, events: [...session.events, { kind: 'hint' }] };
  return step(next, { kind: 'hint', group });
}

/** Annulla l'ultima mossa (anche lo sblocco di un gruppo e le tessere d'oro) e conta come aiuto. */
export function undo(session: Session): Step {
  if (session.phase !== 'playing') return ignored(session);
  const previous = session.history[session.history.length - 1];
  if (!previous) return step(session, { kind: 'nothing-to-undo', afterShuffle: session.afterShuffle });
  if (session.left.undo !== null && session.left.undo <= 0) return step(session, { kind: 'no-aid-left', aid: 'undo' });
  const next: Session = {
    ...session,
    game: previous,
    history: session.history.slice(0, -1),
    selected: [],
    left: { ...session.left, undo: spend(session.left.undo) },
    aidsUsed: session.aidsUsed + 1,
    events: [...session.events, { kind: 'undo' }],
  };
  return step(next, { kind: 'undone' });
}

/** Mischia: riassegna i disegni delle tessere rimaste (partita sempre risolvibile), conta come aiuto e azzera la cronologia. */
export function shuffle(session: Session): Step {
  if (session.phase !== 'playing') return ignored(session);
  if (session.left.shuffles !== null && session.left.shuffles <= 0) return step(session, { kind: 'no-aid-left', aid: 'shuffles' });
  if (session.game.remaining < 2) return ignored(session);
  const shuffled = reshuffleGame(session);
  if (!shuffled.ok) return step(session, { kind: 'shuffle-failed' });
  const next: Session = {
    ...session,
    game: shuffled.value,
    history: [],
    selected: [],
    left: { ...session.left, shuffles: spend(session.left.shuffles) },
    aidsUsed: session.aidsUsed + 1,
    shuffleCount: session.shuffleCount + 1,
    afterShuffle: true,
    events: [...session.events, { kind: 'shuffle' }],
  };
  return step(next, { kind: 'shuffled' });
}

/**
 * Rimescolo automatico quando non c'è più nessuna mossa: gratuito e senza contare come aiuto, ma limitato dal profilo.
 * Esauriti i gratuiti (o se il rimescolo non riesce) suggerisce Mischia, poi Annulla; senza altre vie la partita è bloccata.
 * Se una mossa esiste ancora non fa nulla.
 */
export function rescue(session: Session): Step {
  if (session.phase !== 'playing' || session.game.remaining < 2 || findMove(session.game) !== null) return ignored(session);
  if (session.freeShuffles !== null && session.freeShuffles <= 0) return advise(session);
  const shuffled = reshuffleGame(session);
  if (!shuffled.ok) return advise(session);
  const next: Session = {
    ...session,
    game: shuffled.value,
    history: [],
    selected: [],
    freeShuffles: spend(session.freeShuffles),
    shuffleCount: session.shuffleCount + 1,
    afterShuffle: true,
    events: [...session.events, { kind: 'rescue' }],
  };
  return step(next, { kind: 'rescued' });
}

function advise(session: Session): Step {
  if (session.left.shuffles === null || session.left.shuffles > 0) return step(session, { kind: 'advice', use: 'shuffle' });
  if (session.history.length > 0 && (session.left.undo === null || session.left.undo > 0)) return step(session, { kind: 'advice', use: 'undo' });
  return step({ ...session, phase: 'dead' }, { kind: 'dead' });
}

function reshuffleGame(session: Session): Result<GameState, GenError> {
  return reshuffle(session.game, session.spec.types, hashSeed(session.seed, 'reshuffle', session.shuffleCount));
}

export type ReplayError = { kind: 'start-failed'; error: GenError } | { kind: 'event-rejected'; index: number; event: SessionEvent };

/**
 * Ricostruisce una partita da specifica, profilo, seme ed eventi. `seconds` è il tempo trascorso, che non è un evento ma
 * serve alle stelle di una vittoria. Se un evento non si applica (partita alterata o regole cambiate) restituisce errore.
 * Una partita bloccata (`dead`) si ricostruisce fino all'ultima azione: resta senza mosse e `rescue` la riporta a `dead`,
 * perché «bloccata» non è un evento ma l'effetto di `rescue` su uno stato senza vie d'uscita.
 */
export function replaySession(input: StartInput, events: readonly SessionEvent[], seconds = 0): Result<Session, ReplayError> {
  const started = startSession(input);
  if (!started.ok) return { ok: false, error: { kind: 'start-failed', error: started.error } };
  let session: Session = { ...started.value, seconds };
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    const result =
      event.kind === 'move' ? playGroup(session, event.group) : event.kind === 'hint' ? hint(session) : event.kind === 'undo' ? undo(session) : event.kind === 'shuffle' ? shuffle(session) : rescue(session);
    const logged = result.session.events;
    if (logged.length !== session.events.length + 1 || logged[logged.length - 1].kind !== event.kind) return { ok: false, error: { kind: 'event-rejected', index, event } };
    session = result.session;
  }
  return { ok: true, value: session };
}
