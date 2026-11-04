import { playRandomSession, snapshot } from '../../application/__fixtures__/play';
import { parseSavedGame, restoreSession, serializeSavedGame, toSavedGame } from '../../application/savedGame';
import { startSession } from '../../application/session';
import type { Profile } from '../../domain/profile';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(240_000);

// Una partita salvata si ricostruisce da specifica di base, seme ed eventi: qui sui 100 livelli dell'originale, con la
// serializzazione e la lettura in mezzo, a metà partita e a partita finita.
function savedAndRestored(levelIndex: number, profile: Profile, maxActions: number) {
  const l = legacyLevels[levelIndex];
  const started = startSession({ spec: toSpec(l), profile, seed: l.id });
  if (!started.ok) throw new Error(`livello ${l.id}, ${profile}: ${JSON.stringify(started.error)}`);
  const played = playRandomSession(started.value, l.id, maxActions);
  const parsed = parseSavedGame(serializeSavedGame(toSavedGame(played, l.id)));
  if (!parsed.ok) throw new Error(`livello ${l.id}, ${profile}: ${JSON.stringify(parsed.error)}`);
  const restored = restoreSession(parsed.value);
  if (!restored.ok) throw new Error(`livello ${l.id}, ${profile}: ${JSON.stringify(restored.error)}`);
  return { l, played, restored: restored.value, saved: parsed.value };
}

function check(levelIndex: number, profile: Profile, maxActions: number) {
  const { l, played, restored, saved } = savedAndRestored(levelIndex, profile, maxActions);
  const label = `livello ${l.id} ${profile} (${maxActions} azioni)`;
  // Una partita bloccata si ricostruisce ancora in corso (docs/sessione-di-gioco.md).
  const expected = played.phase === 'dead' ? { ...snapshot(played), phase: 'playing' } : snapshot(played);
  expect({ label, ...snapshot(restored) }).toEqual({ label, ...expected });
  expect({ label, levelId: saved.levelId, base: restored.base }).toEqual({ label, levelId: l.id, base: toSpec(l) });
}

describe('salvataggio sui 100 livelli dell\'originale', () => {
  test('a metà partita, con ogni profilo', () => {
    for (const profile of ['easy', 'normal', 'medium', 'hard', 'expert', 'master'] as const) {
      legacyLevels.forEach((_, i) => check(i, profile, 25));
    }
  });

  test('a partita finita, con Normale e Maestro', () => {
    for (const profile of ['normal', 'master'] as const) {
      legacyLevels.forEach((_, i) => check(i, profile, 5000));
    }
  });
});
