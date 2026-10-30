import { createRng } from '../../domain/prng';
import { hint, isStuck, rescue, shuffle, tap, tick, undo, type Session } from '../session';

/** Aspetto confrontabile di una sessione, per verificare ricostruzioni e immutabilità. */
export function snapshot(s: Session) {
  return {
    types: s.game.tiles.map((t) => t.type),
    alive: Array.from(s.game.ft.alive),
    unlocked: s.game.unlocked,
    left: s.left,
    aidsUsed: s.aidsUsed,
    freeShuffles: s.freeShuffles,
    shuffleCount: s.shuffleCount,
    afterShuffle: s.afterShuffle,
    history: s.history.length,
    selected: [...s.selected],
    seconds: s.seconds,
    phase: s.phase,
    outcome: s.outcome,
    events: s.events,
  };
}

/**
 * Gioca a caso fino alla fine della partita o a `maxActions` azioni: tocca gruppi di tessere giocabili, ogni tanto usa
 * Aiuto, Annulla e Mischia, fa passare il tempo e, quando non ci sono mosse, segue il rimescolo automatico e i suoi consigli.
 */
export function playRandomSession(start: Session, seed: number, maxActions = 5000): Session {
  const rng = createRng(seed);
  let session = start;
  for (let n = 0; n < maxActions && session.phase === 'playing'; n++) {
    if (isStuck(session)) {
      const r = rescue(session);
      session = r.session;
      if (r.feedback.kind === 'advice') session = (r.feedback.use === 'shuffle' ? shuffle(session) : undo(session)).session;
      continue;
    }
    const roll = rng.next();
    if (roll < 0.04) session = hint(session).session;
    else if (roll < 0.07) session = undo(session).session;
    else if (roll < 0.09) session = shuffle(session).session;
    else {
      const options = [...session.game.playableByType().values()].filter((v) => v.length >= session.game.g);
      const tiles = rng.shuffle([...options[rng.int(options.length)]]).slice(0, session.game.g);
      for (const t of tiles) session = tap(session, t).session;
      session = tick(session, 1 + rng.int(15));
    }
  }
  return session;
}
