import { render, screen } from '@testing-library/react-native';
import { GOLD_BURST, PLAIN_BURST, SPARK_MAX_MS, heartPathD, sparklePathsD, tileBurst, type Burst, type Particle } from './effects';
import { SparkLayer } from './SparkLayer';
import { starPathD } from './tile';

// Reanimated non si carica nei test: finto, con il valore derivato calcolato al primo disegno (tempo trascorso 0).
const mockDerived = jest.fn();
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => ({ value: v }),
  useDerivedValue: (fn: () => unknown) => {
    mockDerived();
    return { value: fn() };
  },
  withTiming: (v: unknown) => v,
  Easing: { linear: (t: number) => t },
}));

type Node = { type: string; props: Record<string, unknown>; children?: Node[] | null };
type Call = ['save'] | ['restore'] | ['translate', number, number] | ['scale', number, number] | ['drawPath', string, { color: string; style: number; strokeWidth: number; alpha: number }];
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
/** Ciò che l'esplosione `n` disegnerebbe al tempo 0: il suo disegno registrato dalla tela finta. */
const drawn = (n = 0): Recorded => (nodes('Picture')[n].props.picture as { value: Recorded }).value;

const rand = () => 0.5;
const W = 360;
const H = 560;
const particle = (kind: Particle['kind'], over: Partial<Particle> = {}): Particle => ({ kind, dx: 10, dy: -10, ms: 700, ...over });
const burstOf = (particles: Particle[], over: Partial<Burst> = {}): Burst => ({ id: 1, x: 40, y: 50, particles, ...over });

beforeEach(() => mockDerived.mockClear());

describe('SparkLayer', () => {
  test('senza esplosioni il canvas è vuoto e non prende i tocchi', async () => {
    await render(<SparkLayer bursts={[]} width={W} height={H} />);
    expect(nodes('Picture')).toHaveLength(0);
    expect((screen.toJSON() as unknown as Node).props.pointerEvents).toBe('none');
  });

  test('un solo nodo e un solo valore derivato per esplosione, qualunque sia il numero di scintille', async () => {
    const bursts = [tileBurst(1, 40, 50, false, rand), tileBurst(2, 90, 120, true, rand), burstOf(Array.from({ length: 13 }, () => particle('star')), { id: 3 })];
    await render(<SparkLayer bursts={bursts} width={W} height={H} />);
    // Con 4, 12 e 13 scintille: 3 nodi e 3 valori derivati, non 29 gruppi e 58 valori derivati (il costo che ha dato il singhiozzo).
    const sparks = bursts.reduce((n, b) => n + b.particles.length, 0);
    expect(sparks).toBe(PLAIN_BURST.count + GOLD_BURST.count + 13);
    expect(nodes('Picture')).toHaveLength(bursts.length);
    expect(mockDerived).toHaveBeenCalledTimes(bursts.length);
    expect(bursts.length).toBeLessThan(sparks / 5);
  });

  test('il disegno copre tutta l\'area di gioco', async () => {
    await render(<SparkLayer bursts={[tileBurst(1, 40, 50, false, rand)]} width={W} height={H} />);
    expect(drawn().size).toEqual({ width: W, height: H });
  });

  test('all\'inizio ogni scintilla sta nel centro della sua esplosione, in scala 0,6 e piena opacità, in ordine', async () => {
    await render(<SparkLayer bursts={[burstOf([particle('star'), particle('star', { dx: 5 })])]} width={W} height={H} />);
    const calls = drawn().calls;
    expect(calls.filter(([op]) => op === 'save')).toHaveLength(2);
    expect(calls.filter(([op]) => op === 'restore')).toHaveLength(2);
    expect(calls.slice(0, 3)).toEqual([['save'], ['translate', 40, 50], ['scale', 0.6, 0.6]]);
    for (const c of calls.filter(([op]) => op === 'drawPath')) expect((c as Call & { 2: { alpha: number } })[2].alpha).toBe(1);
  });

  test('scintilla: due stelle a 4 punte piene; stella a 5 punte e cuore: riempimento dorato e contorno di 1 px', async () => {
    const burst = burstOf([particle('sparkle'), particle('star'), particle('heart')]);
    await render(<SparkLayer bursts={[burst]} width={W} height={H} />);
    const paths = drawn().calls.filter((c): c is Extract<Call, ['drawPath', ...unknown[]]> => c[0] === 'drawPath');
    const [sparkleA, sparkleB] = sparklePathsD(0, 0, 18);
    expect(paths.map((c) => [c[1], c[2].color, c[2].style, c[2].strokeWidth])).toEqual([
      [sparkleA, '#ffe040', 0, 0],
      [sparkleB, '#fff9c4', 0, 0],
      [starPathD(0, 0, 9, 9 * 0.47), '#ffc83d', 0, 0],
      [starPathD(0, 0, 9, 9 * 0.47), '#d98e04', 1, 1],
      [heartPathD(0, 0, 9 * 0.85), '#ffc83d', 0, 0],
      [heartPathD(0, 0, 9 * 0.85), '#d98e04', 1, 1],
    ]);
  });

  test('ogni esplosione disegna le proprie scintille, centrate sul proprio punto', async () => {
    const bursts = [burstOf([particle('star')], { id: 1, x: 40, y: 50 }), burstOf([particle('heart')], { id: 2, x: 200, y: 300 })];
    await render(<SparkLayer bursts={bursts} width={W} height={H} />);
    expect(drawn(0).calls[1]).toEqual(['translate', 40, 50]);
    expect(drawn(1).calls[1]).toEqual(['translate', 200, 300]);
  });

  test('la durata di tutta l\'animazione è quella della scintilla più lunga', () => {
    expect(SPARK_MAX_MS).toBe(950);
  });
});
