import { act } from 'react';
import { renderHook } from '@testing-library/react-native';
import { reduceRound, resumeRound, startRound, type Round, type RoundAction } from '../application/round';
import { STAR_TYPE } from '../domain/types';
import { designOf } from '../infrastructure/content/legacyThemes';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { BAR_MATCH_MS, BAR_REJECT_MS } from './selectionBarView';
import { useSelectionBar } from './useSelectionBar';

const level = legacyLevels[0];
const island = level.island;

function start(): Round {
  const started = startRound({ spec: toSpec(level), profile: 'normal', seed: 7 });
  if (!started.ok) throw new Error('la partita non parte');
  return started.value;
}
const designs = (round: Round, tiles: number[]) => tiles.map((i) => designOf(island, round.session.game.tiles[i].type));
const freeTiles = (round: Round) => [...round.session.game.ft.freeList()].sort((a, b) => a - b).filter((i) => round.session.game.tiles[i].type !== STAR_TYPE);

/** Una coppia libera dello stesso disegno, due libere di disegni diversi e una tessera bloccata. */
function scenario(round: Round) {
  const free = freeTiles(round);
  const pair = free.flatMap((a, i) => free.slice(i + 1).filter((b) => round.session.game.tiles[a].type === round.session.game.tiles[b].type).map((b) => [a, b] as const))[0];
  const other = free.find((i) => round.session.game.tiles[i].type !== round.session.game.tiles[pair[0]].type)!;
  const blocked = round.session.game.tiles.findIndex((_, i) => round.session.game.ft.alive[i] === 1 && !round.session.game.ft.isFree(i));
  return { pair, other, blocked };
}

async function setup(enabled = true) {
  const tapped = { current: null as number | null };
  let round = start();
  const hook = await renderHook((props: { round: Round; enabled: boolean }) => useSelectionBar({ round: props.round, island, tapped, enabled: props.enabled }), {
    initialProps: { round, enabled },
  });
  const act_ = async (action: RoundAction) => {
    if (action.type === 'tap') tapped.current = action.tile;
    round = reduceRound(round, action);
    await hook.rerender({ round, enabled });
  };
  return { hook, act: act_, round: () => round };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

describe('useSelectionBar', () => {
  test('senza selezione la barra è vuota; con una tessera toccata mostra il suo disegno', async () => {
    const s = await setup();
    expect(s.hook.result.current.view).toEqual({ slots: [], status: null });
    const { pair } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [pair[0]]), status: null });
    await s.act({ type: 'tap', tile: pair[0] }); // un secondo tocco sulla stessa tessera la deseleziona
    expect(s.hook.result.current.view).toEqual({ slots: [], status: null });
  });

  test('abbinamento: il gruppo con ✔ per 1100 ms, poi vuota; gli ultimi abbinamenti si ricordano', async () => {
    const s = await setup();
    const { pair } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: pair[1] });
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [...pair]), status: 'ok' });
    expect(s.hook.result.current.recent).toEqual([designs(s.round(), [pair[0]])[0]]);
    advance(BAR_MATCH_MS - 1);
    expect(s.hook.result.current.view.status).toBe('ok');
    advance(1);
    expect(s.hook.result.current.view).toEqual({ slots: [], status: null });
    expect(s.hook.result.current.recent).toHaveLength(1);
  });

  test('Annulla toglie l\'ultimo abbinamento dai recenti', async () => {
    const s = await setup();
    const { pair } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: pair[1] });
    expect(s.hook.result.current.recent).toHaveLength(1);
    await s.act({ type: 'undo' });
    expect(s.hook.result.current.recent).toEqual([]);
    expect(s.hook.result.current.view).toEqual({ slots: [], status: null });
  });

  test('tessere diverse: la selezione di prima e la nuova con ✖ per 900 ms, poi resta solo la nuova', async () => {
    const s = await setup();
    const { pair, other } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: other });
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [pair[0], other]), status: 'bad' });
    advance(BAR_REJECT_MS);
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [other]), status: null });
  });

  test('tessera bloccata: il suo disegno con il segno «blocked» per 900 ms, poi torna la selezione (anche vuota)', async () => {
    const s = await setup();
    const { pair, blocked } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: blocked });
    expect(s.hook.result.current.view.status).toBe('blocked');
    expect(s.hook.result.current.view.slots).toHaveLength(1);
    advance(BAR_REJECT_MS);
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [pair[0]]), status: null });
  });

  test('un\'azione nuova sostituisce subito l\'esito passeggero, senza aspettare', async () => {
    const s = await setup();
    const { pair, other } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: pair[1] });
    expect(s.hook.result.current.view.status).toBe('ok');
    await s.act({ type: 'tap', tile: other }); // dopo l'abbinamento la selezione è vuota: è una selezione normale
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [other]), status: null });
    advance(BAR_MATCH_MS); // il vecchio timer non deve cancellare né rimettere nulla
    expect(s.hook.result.current.view).toEqual({ slots: designs(s.round(), [other]), status: null });
  });

  test('il timer di un esito vecchio non chiude quello nuovo: ognuno dura il suo tempo', async () => {
    const s = await setup();
    const { pair } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: pair[1] }); // ✔ per 1100 ms
    advance(500);
    const game = s.round().session.game;
    await s.act({ type: 'tap', tile: game.tiles.findIndex((_, i) => game.ft.alive[i] === 1 && !game.ft.isFree(i)) }); // una bloccata di adesso: ⛔ per 900 ms, cioè fino al 1400
    advance(BAR_MATCH_MS - 500); // arriva il momento in cui finiva il ✔
    expect(s.hook.result.current.view.status).toBe('blocked');
    advance(BAR_REJECT_MS - (BAR_MATCH_MS - 500));
    expect(s.hook.result.current.view.status).toBeNull();
  });

  test('il tempo che passa non cambia la barra né la ridisegna per niente', async () => {
    const s = await setup();
    const { pair } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    const before = s.hook.result.current.view;
    await s.act({ type: 'tick' });
    expect(s.hook.result.current.view).toBe(before);
  });

  test('spenta: niente selezione, niente esiti, niente recenti', async () => {
    const s = await setup(false);
    const { pair, other } = scenario(s.round());
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: other });
    await s.act({ type: 'tap', tile: other });
    await s.act({ type: 'tap', tile: pair[0] });
    await s.act({ type: 'tap', tile: pair[1] }); // anche un abbinamento: né esito né recenti
    expect(s.hook.result.current).toEqual({ view: { slots: [], status: null }, recent: [] });
  });

  test('una partita ripresa con una tessera già selezionata la mostra subito', async () => {
    const base = start();
    const { pair } = scenario(base);
    const selected = reduceRound(base, { type: 'tap', tile: pair[0] });
    const resumed = resumeRound(selected.session);
    const tapped = { current: null as number | null };
    const hook = await renderHook(() => useSelectionBar({ round: resumed, island, tapped, enabled: true }));
    expect(hook.result.current.view).toEqual({ slots: designs(resumed, [pair[0]]), status: null });
  });
});
