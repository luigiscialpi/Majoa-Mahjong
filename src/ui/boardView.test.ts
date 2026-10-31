import { pyramid90 } from '../domain/__fixtures__/shapes';
import { findMove } from '../domain/hint';
import type { LevelSpec } from '../domain/types';
import { hint, playGroup, shuffle, startSession, undo, type Session } from '../application/session';
import { goneTiles, newlyRemoved, statusKey, tileStatuses } from './boardView';

const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids: { hints: 5, shuffles: 3, undo: null }, ...over });
function start(over: Partial<LevelSpec> = {}, seed = 1): Session {
  const r = startSession({ spec: spec(over), profile: 'normal', seed });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}
const move = (s: Session): number[] => {
  const m = findMove(s.game);
  if (!m) throw new Error('nessuna mossa');
  return m;
};

describe('newlyRemoved', () => {
  test('dopo una mossa sono le tessere del gruppo; senza cambiamenti nessuna', () => {
    const s = start();
    const group = move(s);
    const after = playGroup(s, group).session;
    expect([...newlyRemoved(s.game, after.game)].sort((a, b) => a - b)).toEqual([...group].sort((a, b) => a - b));
    expect(newlyRemoved(s.game, s.game).size).toBe(0);
  });

  test('Annulla (tessere tornate), rimescolo (altra tavola) e nuova partita: niente da animare', () => {
    const s = start();
    const played = playGroup(s, move(s)).session;
    expect(newlyRemoved(played.game, undo(played).session.game).size).toBe(0);
    expect(newlyRemoved(played.game, shuffle(played).session.game).size).toBe(0);
    expect(newlyRemoved(s.game, start({}, 2).game).size).toBe(0);
  });

  test('un\'azione che non cambia la tavola (Aiuto) non anima nulla', () => {
    const s = start();
    expect(newlyRemoved(s.game, hint(s).session.game).size).toBe(0);
  });
});

describe('goneTiles', () => {
  test('sono le tessere tolte, meno quelle che si stanno ancora animando', () => {
    const s = start();
    const group = move(s);
    const after = playGroup(s, group).session;
    expect([...goneTiles(after.game, new Set())].sort((a, b) => a - b)).toEqual([...group].sort((a, b) => a - b));
    expect(goneTiles(after.game, new Set(group)).size).toBe(0);
    expect(goneTiles(s.game, new Set()).size).toBe(0);
  });
});

describe('tileStatuses e statusKey', () => {
  test('nascosta finché il suo gruppo è chiuso; oro come da tessera; nebbia solo se non libera', () => {
    const s = start({ hidden: [4, 4], fog: 6, gold: 5 });
    const statuses = tileStatuses(s.game);
    s.game.tiles.forEach((t, i) => {
      expect({ i, locked: statuses[i].locked, gold: statuses[i].gold, fog: statuses[i].fog }).toEqual({ i, locked: t.hiddenGroup > 0, gold: t.gold, fog: t.fog && !s.game.ft.isFree(i) });
    });
    expect(statuses.some((x) => x.locked)).toBe(true);
    expect(statuses.some((x) => x.gold)).toBe(true);
    expect(statuses.some((x) => x.fog)).toBe(true);
  });

  test('aprendo un gruppo nascosto le sue tessere non risultano più nascoste, e la chiave cambia', () => {
    const s = start({ hidden: [4, 4] });
    const before = tileStatuses(s.game);
    let session = s;
    for (let i = 0; i < 100 && session.game.unlocked === 0; i++) session = playGroup(session, move(session)).session;
    expect(session.game.unlocked).toBe(1);
    const after = tileStatuses(session.game);
    expect(after.filter((x) => x.locked).length).toBeLessThan(before.filter((x) => x.locked).length);
    expect(statusKey(after)).not.toBe(statusKey(before));
  });

  test('la chiave è la stessa se l\'aspetto non cambia', () => {
    const s = start({ hidden: [4, 4], gold: 5 });
    expect(statusKey(tileStatuses(s.game))).toBe(statusKey(tileStatuses(s.game)));
    expect(statusKey([{ locked: true, fog: false, gold: false }, { locked: false, fog: true, gold: true }])).toBe('16');
  });
});
