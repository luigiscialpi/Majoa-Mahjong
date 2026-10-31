import { checkReshuffle } from '../domain/__fixtures__/checks';
import { grid, pyramid90 } from '../domain/__fixtures__/shapes';
import { GameState } from '../domain/gameState';
import { generateLevel } from '../domain/generator';
import { findMove } from '../domain/hint';
import { createRng } from '../domain/prng';
import type { Profile } from '../domain/profile';
import { starsFor } from '../domain/stars';
import { STAR_TYPE, type LevelSpec, type PlacedTile } from '../domain/types';
import { playRandomSession, snapshot } from './__fixtures__/play';
import { goldCount, hint, isStuck, playGroup, replaySession, rescue, shuffle, startSession, tap, tick, undo, type Session } from './session';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids: { hints: 5, shuffles: 3, undo: null }, ...over });
const hiddenSpec = () => spec({ hidden: [4, 4], fog: 6, gold: 5 });
// Tavole piatte: all'inizio le tessere libere sono molte e di tipi diversi (sulla piramide sono solo le 4 in cima).
const flatPairs = (): Partial<LevelSpec> => ({ cells: grid(6, 6, 0), types: 6 });
const flatTris = (): Partial<LevelSpec> => ({ cells: grid(6, 6, 0), groupSize: 3, types: 6 });

function start(over: Partial<LevelSpec> = {}, profile: Profile = 'normal', seed = 1, noTimePressure = false): Session {
  const r = startSession({ spec: spec(over), profile, seed, noTimePressure });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}
const move = (s: Session): number[] => {
  const m = findMove(s.game);
  if (!m) throw new Error('nessuna mossa');
  return m;
};
const tile = (x: number, type: number): PlacedTile => ({ x, y: 0, z: 0, type, hiddenGroup: 0, fog: false, gold: false });

/** Gioca le mosse suggerite finché la prossima è un gruppo di stelle (che apre un gruppo nascosto). */
function untilStarsNext(s0: Session): Session {
  let s = s0;
  for (let i = 0; i < 100; i++) {
    const m = move(s);
    if (s.game.tiles[m[0]].type === STAR_TYPE) return s;
    s = playGroup(s, m).session;
  }
  throw new Error('nessun gruppo di stelle giocabile');
}

/** Gioca gruppi a caso, senza rimescolo automatico, fino a vincere o a rimanere senza mosse. */
function playUntilStuck(s: Session, seed: number): Session {
  const rng = createRng(seed);
  let session = s;
  while (session.phase === 'playing' && !isStuck(session)) {
    const options = [...session.game.playableByType().values()].filter((v) => v.length >= session.game.g);
    session = playGroup(session, rng.shuffle([...options[rng.int(options.length)]]).slice(0, session.game.g)).session;
  }
  return session;
}

function findStuck(profile: Profile = 'normal'): Session {
  for (let seed = 1; seed <= 200; seed++) {
    const s = playUntilStuck(start(hiddenSpec(), profile, seed), seed);
    if (isStuck(s)) return s;
  }
  throw new Error('nessuna partita bloccata trovata');
}

/** Rigioca il piano del generatore: vince la partita. */
function playPlan(s: Session): Session {
  const gen = generateLevel(s.spec, s.seed);
  if (!gen.ok) throw new Error('generazione fallita');
  let session = s;
  for (const block of gen.value.plan) {
    for (let k = 0; k < block.length; k += s.spec.groupSize) {
      const r = playGroup(session, block.slice(k, k + s.spec.groupSize));
      if (r.feedback.kind !== 'matched') throw new Error(`mossa rifiutata: ${JSON.stringify(r.feedback)}`);
      session = r.session;
    }
  }
  return session;
}

describe('startSession', () => {
  test('applica il profilo: aiuti iniziali e rimescoli gratuiti', () => {
    const normal = start();
    expect([normal.left, normal.freeShuffles, normal.phase, normal.seconds, normal.aidsUsed, normal.events, normal.game.remaining]).toEqual([{ hints: 5, shuffles: 3, undo: null }, null, 'playing', 0, 0, [], 90]);
    const hard = start({}, 'hard');
    expect([hard.left, hard.freeShuffles]).toEqual([{ hints: 3, shuffles: 2, undo: 6 }, 2]);
  });

  test('specifica non valida: errore tipizzato', () => {
    const r = startSession({ spec: spec({ cells: pyramid90().slice(0, 89) }), profile: 'normal', seed: 1 });
    expect(r).toMatchObject({ ok: false, error: { kind: 'invalid-spec' } });
  });

  test('stessa specifica, profilo e seme: stessa partita', () => {
    expect(snapshot(start({}, 'medium', 4))).toEqual(snapshot(start({}, 'medium', 4)));
    expect(snapshot(start({}, 'medium', 4)).types).not.toEqual(snapshot(start({}, 'medium', 5)).types);
  });
});

describe('tap', () => {
  test('seleziona e deseleziona', () => {
    const [a] = move(start());
    const selected = tap(start(), a);
    expect([selected.feedback, selected.session.selected]).toEqual([{ kind: 'selected' }, [a]]);
    const again = tap(selected.session, a);
    expect([again.feedback, again.session.selected]).toEqual([{ kind: 'deselected' }, []]);
  });

  test('un gruppo uguale si toglie: stato, cronologia ed evento', () => {
    const s = start();
    const [a, b] = move(s);
    const first = tap(s, a).session;
    const r = tap(first, b);
    expect(r.feedback).toEqual({ kind: 'matched', group: [a, b], unlocked: false, gold: 0 });
    expect([r.session.game.remaining, r.session.history.length, r.session.selected, r.session.events]).toEqual([88, 1, [], [{ kind: 'move', group: [a, b] }]]);
  });

  test('tipo diverso: sostituisce la selezione', () => {
    const s = start(flatPairs());
    const [a] = move(s);
    const other = s.game.playable().find((i) => s.game.tiles[i].type !== s.game.tiles[a].type);
    if (other === undefined) throw new Error('nessuna tessera di tipo diverso');
    const r = tap(tap(s, a).session, other);
    expect([r.feedback, r.session.selected, r.session.game.remaining]).toEqual([{ kind: 'mismatch' }, [other], 36]);
  });

  test('tessera non libera o ancora nascosta: rifiutata, la selezione resta', () => {
    const s = start();
    const [a] = move(s);
    const covered = s.game.tiles.findIndex((_, i) => !s.game.ft.isFree(i));
    const selected = tap(s, a).session;
    const r = tap(selected, covered);
    expect([r.feedback, r.session.selected]).toEqual([{ kind: 'rejected', reason: 'tile-blocked' }, [a]]);
    const h = start(hiddenSpec());
    const locked = h.game.tiles.findIndex((t) => t.hiddenGroup > 0);
    expect(tap(h, locked).feedback).toEqual({ kind: 'rejected', reason: 'locked' }); // «nascosta» vince su «non libera»
  });

  test('tessera inesistente, già tolta o partita finita: ignorato', () => {
    const s = start();
    const [a, b] = move(s);
    expect(tap(s, -1).feedback).toEqual({ kind: 'ignored' });
    expect(tap(s, 999).feedback).toEqual({ kind: 'ignored' });
    const played = playGroup(s, [a, b]).session;
    expect(tap(played, a).feedback).toEqual({ kind: 'ignored' });
    expect(tap({ ...s, phase: 'dead' }, a).feedback).toEqual({ kind: 'ignored' });
  });

  test('il gruppo di stelle apre il gruppo nascosto', () => {
    const s = untilStarsNext(start(hiddenSpec()));
    const [a, b] = move(s);
    const r = tap(tap(s, a).session, b);
    expect(r.feedback).toMatchObject({ kind: 'matched', unlocked: true });
    expect(r.session.game.unlocked).toBe(s.game.unlocked + 1);
  });

  test('tris: servono tre tessere uguali; un tipo diverso sostituisce la selezione', () => {
    const s = start(flatTris());
    const [a, b, c] = move(s);
    const two = tap(tap(s, a).session, b);
    expect([two.feedback, two.session.selected]).toEqual([{ kind: 'selected' }, [a, b]]);
    const three = tap(two.session, c);
    expect([three.feedback, three.session.game.remaining]).toEqual([{ kind: 'matched', group: [a, b, c], unlocked: false, gold: 0 }, 33]);
    const other = s.game.playable().find((i) => s.game.tiles[i].type !== s.game.tiles[a].type);
    if (other === undefined) throw new Error('nessuna tessera di tipo diverso');
    const replaced = tap(two.session, other);
    expect([replaced.feedback, replaced.session.selected]).toEqual([{ kind: 'mismatch' }, [other]]);
  });
});

describe('hint', () => {
  test('suggerisce la mossa, consuma un uso e conta come aiuto, senza toccare la selezione', () => {
    const s = start();
    const [a] = move(s);
    const selected = tap(s, a).session;
    const r = hint(selected);
    expect(r.feedback).toEqual({ kind: 'hint', group: move(s) });
    expect([r.session.left.hints, r.session.aidsUsed, r.session.selected, r.session.events]).toEqual([4, 1, [a], [{ kind: 'hint' }]]);
  });

  test('senza usi rimasti non fa nulla; illimitato non si consuma', () => {
    const none = start({ aids: { hints: 0, shuffles: 3, undo: null } });
    const r = hint(none);
    expect([r.feedback, snapshot(r.session)]).toEqual([{ kind: 'no-aid-left', aid: 'hints' }, snapshot(none)]);
    const unlimited = hint(start({ aids: { hints: null, shuffles: 3, undo: null } }));
    expect([unlimited.session.left.hints, unlimited.session.aidsUsed]).toEqual([null, 1]);
  });

  test('senza mosse avvia il rimescolo automatico, senza consumare l\'Aiuto', () => {
    const stuck = findStuck();
    const r = hint(stuck);
    expect(r.feedback).toEqual({ kind: 'rescued' });
    expect([r.session.left.hints, r.session.aidsUsed, r.session.events[r.session.events.length - 1]]).toEqual([stuck.left.hints, stuck.aidsUsed, { kind: 'rescue' }]);
  });
});

describe('undo', () => {
  test('ripristina lo stato precedente, anche lo sblocco, e conta come aiuto', () => {
    const s = untilStarsNext(start(hiddenSpec()));
    const before = snapshot(s);
    const played = playGroup(s, move(s)).session; // il gruppo di stelle apre un gruppo nascosto
    expect(played.game.unlocked).toBe(s.game.unlocked + 1);
    const r = undo(played);
    expect(r.feedback).toEqual({ kind: 'undone' });
    expect([snapshot(r.session).types, snapshot(r.session).alive, r.session.game.unlocked]).toEqual([before.types, before.alive, before.unlocked]);
    expect([r.session.history.length, r.session.selected, r.session.aidsUsed, r.session.left.undo]).toEqual([s.history.length, [], 1, null]);
  });

  test('consuma un uso; senza usi rimasti non fa nulla', () => {
    const s = playGroup(start({ aids: { hints: 5, shuffles: 3, undo: 3 } }), move(start())).session;
    expect(undo(s).session.left.undo).toBe(2);
    const none = playGroup(start({ aids: { hints: 5, shuffles: 3, undo: 0 } }), move(start())).session;
    expect(undo(none)).toMatchObject({ feedback: { kind: 'no-aid-left', aid: 'undo' } });
  });

  test('senza cronologia non c\'è nulla da annullare (e si controlla prima degli usi); dopo un rimescolo lo dice', () => {
    expect(undo(start({ aids: { hints: 5, shuffles: 3, undo: 0 } })).feedback).toEqual({ kind: 'nothing-to-undo', afterShuffle: false });
    const shuffled = shuffle(playGroup(start(), move(start())).session).session;
    expect(undo(shuffled).feedback).toEqual({ kind: 'nothing-to-undo', afterShuffle: true });
  });
});

describe('shuffle', () => {
  test('riassegna i disegni mantenendo la partita risolvibile; azzera la cronologia e conta come aiuto', () => {
    const s = playGroup(start(hiddenSpec()), move(start(hiddenSpec()))).session;
    const r = shuffle(s);
    expect(r.feedback).toEqual({ kind: 'shuffled' });
    checkReshuffle(s.game, r.session.game, s.spec.types, 'mischia');
    expect([r.session.left.shuffles, r.session.aidsUsed, r.session.history.length, r.session.selected, r.session.afterShuffle, r.session.shuffleCount]).toEqual([2, 1, 0, [], true, 1]);
    expect(r.session.events[r.session.events.length - 1]).toEqual({ kind: 'shuffle' });
  });

  test('senza usi rimasti non fa nulla; con meno di due tessere neppure', () => {
    const none = start({ aids: { hints: 5, shuffles: 0, undo: null } });
    expect([shuffle(none).feedback, snapshot(shuffle(none).session)]).toEqual([{ kind: 'no-aid-left', aid: 'shuffles' }, snapshot(none)]);
    const tiny: Session = { ...start(), game: new GameState([tile(0, 0)], 2, 24) };
    expect(shuffle(tiny).feedback).toEqual({ kind: 'ignored' });
  });

  test('ogni rimescolo usa un seme diverso', () => {
    const first = shuffle(start()).session;
    const second = shuffle(first).session;
    expect(snapshot(second).types).not.toEqual(snapshot(first).types);
  });
});

describe('rescue', () => {
  test('senza mosse: rimescolo gratuito, senza contare come aiuto, che azzera cronologia e selezione', () => {
    const stuck = findStuck();
    const r = rescue(stuck);
    expect(r.feedback).toEqual({ kind: 'rescued' });
    checkReshuffle(stuck.game, r.session.game, stuck.spec.types, 'rimescolo');
    expect(isStuck(r.session)).toBe(false);
    expect([r.session.aidsUsed, r.session.freeShuffles, r.session.history.length, r.session.afterShuffle, r.session.shuffleCount, r.session.left]).toEqual([stuck.aidsUsed, null, 0, true, 1, stuck.left]);
  });

  test('i rimescoli gratuiti del profilo si consumano', () => {
    const stuck = findStuck('medium');
    expect(stuck.freeShuffles).toBe(3);
    expect(rescue(stuck).session.freeShuffles).toBe(2);
  });

  test('con una mossa ancora possibile non fa nulla', () => {
    const s = start();
    expect([rescue(s).feedback, snapshot(rescue(s).session)]).toEqual([{ kind: 'ignored' }, snapshot(s)]);
  });

  test('gratuiti esauriti: prima Mischia, poi Annulla, poi la partita è bloccata', () => {
    const stuck = findStuck();
    expect(stuck.history.length).toBeGreaterThan(0);
    const out = { ...stuck, freeShuffles: 0 };
    expect(rescue(out).feedback).toEqual({ kind: 'advice', use: 'shuffle' });
    const noShuffle = { ...out, left: { ...out.left, shuffles: 0, undo: null } };
    expect(rescue(noShuffle).feedback).toEqual({ kind: 'advice', use: 'undo' });
    const dead = rescue({ ...noShuffle, left: { ...noShuffle.left, undo: 0 } });
    expect([dead.feedback, dead.session.phase]).toEqual([{ kind: 'dead' }, 'dead']);
    expect(rescue({ ...noShuffle, history: [] }).session.phase).toBe('dead');
    expect(rescue(out).session.phase).toBe('playing');
  });
});

describe('rescue su una tavola senza soluzione', () => {
  // Quattro tessere impilate in colonna: una sola libera per volta, quindi nessun disegno dà una coppia.
  const stack = () => new GameState([0, 1, 2, 3].map((z) => ({ x: 0, y: 0, z, type: z < 2 ? 0 : 1, hiddenGroup: 0, fog: false, gold: false })), 2, 24);

  test('il rimescolo non riesce: si salta Mischia, che fallirebbe uguale, e si consiglia Annulla', () => {
    const s0 = start();
    const stuck: Session = { ...s0, game: stack(), history: [s0.game] };
    expect(isStuck(stuck)).toBe(true);
    expect(rescue(stuck)).toMatchObject({ feedback: { kind: 'advice', use: 'undo' } }); // anche se Mischia ha ancora usi
    expect(stuck.left.shuffles).toBeGreaterThan(0);
  });

  test('senza cronologia o senza Annulla la partita è bloccata', () => {
    const s0 = start();
    const stuck: Session = { ...s0, game: stack(), history: [s0.game] };
    expect(rescue({ ...stuck, history: [] }).feedback).toEqual({ kind: 'dead' });
    expect(rescue({ ...stuck, left: { ...stuck.left, undo: 0 } }).feedback).toEqual({ kind: 'dead' });
  });

  test('Mischia a mano fallisce senza consumare nulla', () => {
    const s0 = start();
    const stuck: Session = { ...s0, game: stack(), history: [s0.game] };
    const r = shuffle(stuck);
    expect([r.feedback, r.session.left.shuffles, r.session.aidsUsed, r.session.history.length]).toEqual([{ kind: 'shuffle-failed' }, stuck.left.shuffles, 0, 1]);
  });
});

describe('vittoria e tempo', () => {
  test('rigiocando il piano del generatore la partita è vinta, con stelle, aiuti e oro', () => {
    const won = playPlan(start(hiddenSpec()));
    expect(won.phase).toBe('won');
    const { total } = goldCount(start(hiddenSpec()));
    expect(total).toBeGreaterThan(0);
    expect(won.outcome).toEqual({ stars: 3, seconds: 0, aidsUsed: 0, gold: total, goldTotal: total });
  });

  test('le stelle seguono tempo e aiuti (90 tessere, 45 coppie, Normale)', () => {
    const at = (seconds: number, aids = 0) => {
      let s = tick(start(), seconds);
      for (let i = 0; i < aids; i++) s = hint(s).session;
      return playPlan(s).outcome;
    };
    expect(at(225)).toMatchObject({ stars: 3, seconds: 225 });
    expect(at(300)).toMatchObject({ stars: 2 });
    expect(at(500)).toMatchObject({ stars: 1 });
    expect(at(0, 2)).toMatchObject({ stars: 2, aidsUsed: 2 });
    const same = (profile: Profile) => starsFor({ seconds: 300, tiles: 90, aidsUsed: 0, profile });
    expect(playPlan(tick(start({}, 'master'), 300)).outcome?.stars).toBe(same('master'));
    expect(playPlan(tick(start({}, 'normal', 1, true), 5000)).outcome?.stars).toBe(3);
  });

  test('a partita finita il tempo e le azioni non cambiano nulla', () => {
    const won = playPlan(start());
    expect(tick(won, 10)).toBe(won);
    for (const r of [tap(won, 0), hint(won), undo(won), shuffle(won), rescue(won), playGroup(won, [0, 1])]) expect(r.feedback).toEqual({ kind: 'ignored' });
  });

  test('il tempo passa solo mentre si gioca', () => {
    expect([tick(start()).seconds, tick(start(), 5).seconds]).toEqual([1, 5]);
    expect(tick({ ...start(), phase: 'dead' }, 5).seconds).toBe(0);
  });
});

describe('immutabilità', () => {
  test('nessuna azione modifica la sessione ricevuta', () => {
    const s = playGroup(start(hiddenSpec()), move(start(hiddenSpec()))).session;
    const before = snapshot(s);
    const [a, b] = move(s);
    const actions = [() => tap(s, a), () => tap(tap(s, a).session, b), () => tap(s, -1), () => playGroup(s, [a, b]), () => hint(s), () => undo(s), () => shuffle(s), () => rescue(s), () => tick(s, 3)];
    for (const run of actions) {
      run();
      expect(snapshot(s)).toEqual(before);
    }
  });
});

describe('replaySession', () => {
  const cases: [string, Partial<LevelSpec>, Profile][] = [
    ['coppie, Normale', {}, 'normal'],
    ['nascoste, nebbia e oro, Difficile', { hidden: [4, 4], fog: 6, gold: 5 }, 'hard'],
    ['tris, Maestro', { cells: grid(6, 6, 0), groupSize: 3, types: 6 }, 'master'],
  ];

  test.each(cases)('%s: da specifica, seme ed eventi si ricostruisce la stessa partita', (_name, over, profile) => {
    for (let seed = 1; seed <= 8; seed++) {
      const s0 = start(over, profile, seed);
      const played = playRandomSession(s0, 100 + seed);
      const r = replaySession({ spec: spec(over), profile, seed }, played.events, played.seconds);
      if (!r.ok) throw new Error(`seme ${seed}: ${JSON.stringify(r.error)}`);
      expect({ seed, ...snapshot(r.value) }).toEqual({ seed, ...snapshot(played) });
      expect(played.events.length).toBeGreaterThan(0);
    }
  });

  test('una partita bloccata si ricostruisce senza mosse, e rescue la riporta a bloccata', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const played = playRandomSession(start(hiddenSpec(), 'master', seed), seed);
      if (played.phase !== 'dead') continue;
      const r = replaySession({ spec: hiddenSpec(), profile: 'master', seed }, played.events, played.seconds);
      if (!r.ok) throw new Error(JSON.stringify(r.error));
      expect([r.value.phase, isStuck(r.value), rescue(r.value).session.phase]).toEqual(['playing', true, 'dead']);
      return;
    }
    throw new Error('nessuna partita bloccata trovata');
  });

  test('un evento che non si applica o una partita non avviabile danno errore', () => {
    const input = { spec: spec(), profile: 'normal' as const, seed: 1 };
    expect(replaySession(input, [{ kind: 'move', group: [0, 1] }])).toEqual({ ok: false, error: { kind: 'event-rejected', index: 0, event: { kind: 'move', group: [0, 1] } } });
    expect(replaySession(input, [{ kind: 'undo' }])).toMatchObject({ ok: false, error: { kind: 'event-rejected', index: 0 } });
    expect(replaySession({ ...input, spec: spec({ cells: pyramid90().slice(0, 89) }) }, [])).toMatchObject({ ok: false, error: { kind: 'start-failed' } });
  });
});
