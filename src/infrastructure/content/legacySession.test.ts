import { playRandomSession, snapshot } from '../../application/__fixtures__/play';
import { goldCount, isStuck, replaySession, rescue, startSession, type Session } from '../../application/session';
import type { Profile } from '../../domain/profile';
import { starsFor } from '../../domain/stars';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(240_000);

function play(levelIndex: number, profile: Profile) {
  const l = legacyLevels[levelIndex];
  const input = { spec: toSpec(l), profile, seed: l.id };
  const started = startSession(input);
  if (!started.ok) throw new Error(`livello ${l.id}, ${profile}: ${JSON.stringify(started.error)}`);
  const played = playRandomSession(started.value, l.id);
  return { l, input, started: started.value, played };
}

/** Controlli comuni: contatori degli aiuti ricavati dagli eventi, stelle e ricostruzione da specifica, seme ed eventi. */
function checkConsistency(label: string, input: Parameters<typeof replaySession>[0], started: Session, played: Session) {
  const count = (kind: string) => played.events.filter((e) => e.kind === kind).length;
  expect({ label, aidsUsed: played.aidsUsed }).toEqual({ label, aidsUsed: count('hint') + count('undo') + count('shuffle') });
  const left = (initial: number | null, used: number) => (initial === null ? null : initial - used);
  expect({ label, left: played.left }).toEqual({ label, left: { hints: left(started.left.hints, count('hint')), shuffles: left(started.left.shuffles, count('shuffle')), undo: left(started.left.undo, count('undo')) } });
  expect({ label, free: played.freeShuffles }).toEqual({ label, free: started.freeShuffles === null ? null : started.freeShuffles - count('rescue') });
  const replayed = replaySession(input, played.events, played.seconds);
  if (!replayed.ok) throw new Error(`${label}: ${JSON.stringify(replayed.error)}`);
  // Una partita bloccata si ricostruisce senza mosse e ancora in corso; `rescue` la riporta a «bloccata».
  const expected = played.phase === 'dead' ? { ...snapshot(played), phase: 'playing' } : snapshot(played);
  expect({ label, ...snapshot(replayed.value) }).toEqual({ label, ...expected });
  if (played.phase === 'dead') {
    expect({ label, senzaMosse: isStuck(replayed.value), dopoRescue: rescue(replayed.value).session.phase }).toEqual({ label, senzaMosse: true, dopoRescue: 'dead' });
  }
  if (played.phase === 'won') {
    const { total } = goldCount(played);
    expect({ label, remaining: played.game.remaining, outcome: played.outcome }).toEqual({
      label,
      remaining: 0,
      outcome: { stars: starsFor({ seconds: played.seconds, tiles: played.spec.cells.length, aidsUsed: played.aidsUsed, profile: played.profile }), seconds: played.seconds, aidsUsed: played.aidsUsed, gold: total, goldTotal: total },
    });
  }
}

describe('sessione di gioco sui 100 livelli dell\'originale', () => {
  test('con Normale ogni partita giocata a caso finisce con una vittoria, con contatori e stelle coerenti', () => {
    legacyLevels.forEach((_, i) => {
      const { l, input, started, played } = play(i, 'normal');
      expect({ id: l.id, phase: played.phase }).toEqual({ id: l.id, phase: 'won' });
      checkConsistency(`livello ${l.id} Normale`, input, started, played);
    });
  });

  test('con Difficile e Maestro ogni partita finisce; se è bloccata non restava nessuna via d\'uscita', () => {
    let dead = 0;
    for (const profile of ['hard', 'master'] as const) {
      legacyLevels.forEach((_, i) => {
        const { l, input, started, played } = play(i, profile);
        const label = `livello ${l.id} ${profile}`;
        expect({ label, finita: played.phase !== 'playing' }).toEqual({ label, finita: true });
        checkConsistency(label, input, started, played);
        if (played.phase === 'dead') {
          dead++;
          const noShuffle = played.left.shuffles !== null && played.left.shuffles <= 0;
          const noUndo = played.history.length === 0 || (played.left.undo !== null && played.left.undo <= 0);
          expect({ label, gratuitiFiniti: played.freeShuffles === 0, noShuffle, noUndo }).toEqual({ label, gratuitiFiniti: true, noShuffle: true, noUndo: true });
        }
      });
    }
    console.log(`partite bloccate con Difficile e Maestro: ${dead} su 200`);
  });
});
