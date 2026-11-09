import { act } from 'react';
import { renderHook } from '@testing-library/react-native';
import type { Feedback } from '../application/session';
import { startSession } from '../application/session';
import { boardMetrics, tileRect } from '../domain/board';
import type { PlacedTile } from '../domain/types';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { COMBO_ORIGIN_Y, GOLD_BURST, PLAIN_BURST, SPARK_MAX_MS } from './effects';
import { useMatchEffects } from './useMatchEffects';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const started = startSession({ spec: toSpec(legacyLevels[0]), profile: 'normal', seed: 7 });
if (!started.ok) throw new Error('livello 1 non generato');
const tiles: readonly PlacedTile[] = started.value.game.tiles;
const column = { x: 20, y: 0, w: 320, h: 560 };
const areaWidth = 360;

const matched = (a: number, b: number): Feedback => ({ kind: 'matched', group: [a, b], unlocked: false, gold: 0 });

type Props = { feedback: Feedback | null; seq: number; enabled?: boolean; tiles?: readonly PlacedTile[] };

/** Orologio e casualità sotto controllo: la combo dipende solo dagli istanti dati. */
async function setup(initial: Props = { feedback: null, seq: 0 }) {
  let clock = 0;
  const hook = await renderHook(
    (p?: Props) => {
      const props = p ?? initial;
      return useMatchEffects({ feedback: props.feedback, seq: props.seq, tiles: props.tiles ?? tiles, column, areaWidth, enabled: props.enabled ?? true, now: () => clock, rand: () => 0.5 });
    },
    { initialProps: initial },
  );
  let seq = initial.seq;
  return {
    ...hook,
    /** Un abbinamento a `at` ms: nuovo numero d'azione e nuovo feedback. */
    async match(at: number, extra: Partial<Props> = {}, pair: [number, number] = [0, 1]) {
      clock = at;
      seq += 1;
      await hook.rerender({ feedback: matched(...pair), seq, ...extra });
    },
  };
}

describe('scintille degli abbinamenti', () => {
  test('una esplosione per tessera tolta, centrata sulla tessera nell\'area di gioco', async () => {
    const h = await setup();
    await h.match(0);
    const m = boardMetrics(tiles, column.w, column.h);
    expect(h.result.current.bursts).toHaveLength(2);
    h.result.current.bursts.forEach((b, n) => {
      const r = tileRect(m, tiles[n]);
      expect([b.x, b.y]).toEqual([column.x + r.x + r.w / 2, r.y + r.h / 2]);
      expect(b.particles).toHaveLength(PLAIN_BURST.count);
    });
    expect(h.result.current.banner).toBeNull();
  });

  test('una tessera d\'oro ha un\'esplosione più ricca', async () => {
    const h = await setup();
    await h.match(0, { tiles: tiles.map((t, i) => (i === 0 ? { ...t, gold: true } : t)) });
    const [first, second] = h.result.current.bursts;
    expect([first.particles.length, second.particles.length]).toEqual([GOLD_BURST.count, PLAIN_BURST.count]);
  });

  test('le esplosioni spariscono da sole a fine animazione', async () => {
    const h = await setup();
    await h.match(0);
    await act(() => {
      jest.advanceTimersByTime(SPARK_MAX_MS);
    });
    expect(h.result.current.bursts).toHaveLength(2);
    await act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(h.result.current.bursts).toHaveLength(0);
  });

  test('altri feedback non producono nulla', async () => {
    const h = await setup();
    await h.rerender({ feedback: { kind: 'selected' }, seq: 1 });
    await h.rerender({ feedback: { kind: 'hint', group: [0, 1] }, seq: 2 });
    expect(h.result.current.bursts).toHaveLength(0);
    expect(h.result.current.banner).toBeNull();
  });
});

describe('combo', () => {
  test('dal secondo abbinamento ravvicinato compare la scritta, con le scintille della scritta al centro', async () => {
    const h = await setup();
    await h.match(0);
    await h.match(1000, {}, [2, 3]);
    expect(h.result.current.banner).toMatchObject({ level: 1 });
    const combo = h.result.current.bursts.at(-1)!;
    expect([combo.x, combo.y, combo.particles.length]).toEqual([areaWidth / 2, COMBO_ORIGIN_Y, 7]);
    expect(new Set(h.result.current.bursts.map((b) => b.id)).size).toBe(h.result.current.bursts.length);
  });

  test('a 4,5 secondi dall\'abbinamento precedente la combo riparte e la scritta non compare', async () => {
    const h = await setup();
    await h.match(0);
    await h.match(4500, {}, [2, 3]);
    expect(h.result.current.banner).toBeNull();
    await h.match(5000, {}, [4, 5]);
    expect(h.result.current.banner).toMatchObject({ level: 1 });
  });

  test('la scritta cresce fino al livello 4 e lì si ferma, con scintille e distanza al tetto', async () => {
    const h = await setup();
    const levels: (number | undefined)[] = [];
    for (let n = 0; n < 7; n++) {
      await h.match(n * 1000, {}, [0, 1]);
      levels.push(h.result.current.banner?.level);
    }
    expect(levels).toEqual([undefined, 1, 2, 3, 4, 4, 4]);
    expect(h.result.current.bursts.at(-1)!.particles).toHaveLength(5 + 4 * 2);
  });

  test('ogni combo ha una chiave nuova e si può chiudere solo con la sua', async () => {
    const h = await setup();
    await h.match(0);
    await h.match(500);
    const first = h.result.current.banner!;
    await h.match(1000);
    const second = h.result.current.banner!;
    expect(second.key).not.toBe(first.key);
    await act(() => h.result.current.clearBanner(first.key));
    expect(h.result.current.banner).toEqual(second);
    await act(() => h.result.current.clearBanner(second.key));
    expect(h.result.current.banner).toBeNull();
  });

  test('con gli effetti spenti non si mostra nulla ma la combo si conta lo stesso', async () => {
    const h = await setup();
    await h.match(0, { enabled: false });
    await h.match(1000, { enabled: false });
    expect(h.result.current.bursts).toHaveLength(0);
    expect(h.result.current.banner).toBeNull();
    await h.match(2000, { enabled: true }); // è il terzo abbinamento ravvicinato: livello 2
    expect(h.result.current.banner).toMatchObject({ level: 2 });
  });

  test('lo stesso abbinamento non si conta due volte se il componente si ridisegna', async () => {
    const h = await setup();
    await h.match(0);
    const same = { feedback: matched(0, 1), seq: 1 };
    await h.rerender(same);
    await h.rerender(same);
    expect(h.result.current.bursts).toHaveLength(2);
    await h.match(1000);
    expect(h.result.current.banner).toMatchObject({ level: 1 }); // 1 e non 3
  });
});
