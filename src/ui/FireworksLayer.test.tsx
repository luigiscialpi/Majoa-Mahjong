import { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRng } from '../domain/prng';
import { BUDGET, FRAME_MS, makeShow } from './fireworks';
import { FireworksLayer } from './FireworksLayer';

// Reanimated non si carica nei test: finto. Il valore derivato si ricalcola a ogni lettura (come farebbe a ogni fotogramma) e
// la funzione del fotogramma si conserva, così il test può far avanzare il tempo.
let frameCallback: (frame: { timeSincePreviousFrame: number | null }) => void = () => {};
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => ({ value: v }),
  useDerivedValue: (fn: () => unknown) => ({
    get value() {
      return fn();
    },
  }),
  useFrameCallback: (cb: typeof frameCallback) => {
    frameCallback = cb;
    return { setActive() {} };
  },
}));

type Node = { type: string; props: Record<string, unknown>; children?: Node[] | null };
type Call = ['save'] | ['restore'] | ['drawPoints', number, number, { color: string; strokeWidth: number; alpha: number; cap: number }];
type Recorded = { calls: Call[]; size: { width: number; height: number } };
const walk = (node: Node | Node[] | null, out: Node[] = []): Node[] => {
  if (!node) return out;
  if (Array.isArray(node)) node.forEach((n) => walk(n, out));
  else {
    out.push(node);
    walk(node.children as Node[] | null, out);
  }
  return out;
};
const nodes = (type: string) => walk(screen.toJSON() as unknown as Node).filter((n) => n.type === type);
/** Ciò che il disegno farebbe adesso: la tela finta registra le chiamate a `drawPoints`. */
const drawn = (): Recorded => (nodes('Picture')[0].props.picture as { value: Recorded }).value;
const layout = (width = 360, height = 780) => fireEvent(screen.getByTestId('fireworks'), 'layout', { nativeEvent: { layout: { width, height } } });
/** Fa avanzare il tempo dello spettacolo di `ms` (come i fotogrammi del thread UI). */
const advance = (ms: number) => act(() => frameCallback({ timeSincePreviousFrame: ms }));

const rngOf = (seed: number) => {
  const r = createRng(seed);
  return () => r.next();
};

beforeEach(() => {
  jest.useFakeTimers();
  const rand = rngOf(4);
  jest.spyOn(Math, 'random').mockImplementation(() => rand());
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('FireworksLayer', () => {
  test('prima della misura non disegna nulla; non prende i tocchi', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    expect(nodes('Picture')).toHaveLength(0);
    expect(screen.getByTestId('fireworks').props.pointerEvents).toBe('none');
  });

  test('dopo la misura ha un solo nodo e un solo disegno, grande quanto l\'area', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    await layout(360, 780);
    expect(nodes('Picture')).toHaveLength(1);
    expect(nodes('Canvas')).toHaveLength(1);
    expect(drawn().size).toEqual({ width: 360, height: 780 });
  });

  test('lo spettacolo si decide alla prima misura: una misura diversa dopo non lo rifà', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    await layout(360, 780);
    await layout(800, 400);
    expect(drawn().size).toEqual({ width: 360, height: 780 });
  });

  test('ignora misure nulle', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    await layout(0, 0);
    expect(nodes('Picture')).toHaveLength(0);
  });

  test('all\'inizio disegna i razzi appena partiti; col tempo compaiono scintille e coriandoli, a lotti', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    await layout();
    const at = (calls: Call[]) => calls.filter((c): c is Extract<Call, ['drawPoints', ...unknown[]]> => c[0] === 'drawPoints');
    const start = at(drawn().calls);
    expect(start.length).toBeGreaterThan(0);
    await advance(1500);
    const later = at(drawn().calls);
    expect(later.length).toBeGreaterThan(start.length);
    expect(later.every((c) => c[1] === 1)).toBe(true); // PointMode.Lines
    expect(later.some((c) => c[3].cap === 0)).toBe(true); // coriandoli: testa piatta
    expect(later.some((c) => c[3].cap === 1)).toBe(true); // razzi e scintille: testa tonda
    // Pochi lotti, non una chiamata per particella: il numero di chiamate non cresce con le particelle.
    expect(later.length).toBeLessThan(BUDGET.maxLiveSparks / 2);
  });

  test('l\'orologio avanza a passi interi e il disegno è lo stesso entro un passo', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    await layout();
    await advance(1010); // 60 passi e 10 ms avanzati: l'orologio sta a 1000 ms
    const a = JSON.stringify(drawn().calls);
    await advance(6); // 16 ms avanzati: ancora meno di un passo (16,7 ms), non cambia nulla
    expect(JSON.stringify(drawn().calls)).toBe(a);
    await advance(1); // 17 ms avanzati: un passo completo
    expect(JSON.stringify(drawn().calls)).not.toBe(a);
  });

  test('con la riduzione del movimento niente coriandoli (nessun lotto a testa piatta)', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced />);
    await layout();
    await advance(1500);
    const caps = drawn().calls.filter((c) => c[0] === 'drawPoints').map((c) => (c as Extract<Call, ['drawPoints', ...unknown[]]>)[3].cap);
    expect(caps.length).toBeGreaterThan(0);
    expect(caps).not.toContain(0);
  });

  test('a fine spettacolo il canvas si smonta e non resta nulla', async () => {
    await render(<FireworksLayer level={5} finale={false} reduced={false} />);
    await layout();
    const expected = makeShow({ width: 360, height: 780, level: 5, finale: false, reduced: false }, rngOf(4)).durationMs;
    await act(() => {
      jest.advanceTimersByTime(expected - 1);
    });
    expect(nodes('Picture')).toHaveLength(1);
    await act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(nodes('Picture')).toHaveLength(0);
    expect(nodes('Canvas')).toHaveLength(0);
  });

  test('i finali durano più dei livelli comuni', async () => {
    const duration = async (finale: boolean) => {
      const { unmount } = await render(<FireworksLayer level={5} finale={finale} reduced={false} />);
      await layout();
      let ms = 0;
      while (nodes('Picture').length === 1 && ms < 60_000) {
        await act(() => {
          jest.advanceTimersByTime(250);
        });
        ms += 250;
      }
      await unmount();
      return ms;
    };
    const normal = await duration(false);
    const finale = await duration(true);
    expect(finale).toBeGreaterThan(normal);
  });
});
