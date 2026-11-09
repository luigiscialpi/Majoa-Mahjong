import { render, screen } from '@testing-library/react-native';
import { GOLD_BURST, PLAIN_BURST, tileBurst } from './effects';
import { SparkLayer } from './SparkLayer';

// Reanimated non si carica nei test: finto, con i valori calcolati al primo disegno (tempo trascorso 0).
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => ({ value: v }),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  withTiming: (v: unknown) => v,
  Easing: { linear: (t: number) => t },
}));

type Node = { type: string; props: Record<string, unknown>; children?: Node[] | null };
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

const rand = () => 0.5;

describe('SparkLayer', () => {
  test('senza esplosioni il canvas è vuoto e non prende i tocchi', async () => {
    await render(<SparkLayer bursts={[]} />);
    expect(nodes('Group')).toHaveLength(0);
    expect((screen.toJSON() as unknown as Node).props.pointerEvents).toBe('none');
  });

  test('una scintilla per ogni particella di ogni esplosione, con forma e colore', async () => {
    const bursts = [tileBurst(1, 40, 50, false, rand), tileBurst(2, 90, 120, true, rand)];
    await render(<SparkLayer bursts={bursts} />);
    expect(nodes('Group')).toHaveLength(PLAIN_BURST.count + GOLD_BURST.count);
    // Ogni scintilla disegna due tracciati: scintilla = due stelle a 4 punte; stella e cuore = riempimento e contorno.
    expect(nodes('Path')).toHaveLength(2 * (PLAIN_BURST.count + GOLD_BURST.count));
    const fills = nodes('Path').map((n) => n.props.color);
    expect(fills).toContain('#ffc83d'); // stelle e cuori dorati
    expect(fills).toContain('#ffe040'); // scintille
  });

  test('stella a 5 punte (solo segmenti) e cuore (solo curve), ciascuno con riempimento e contorno', async () => {
    const particle = { dx: 10, dy: -10, ms: 700 };
    const burst = { id: 1, x: 0, y: 0, particles: [{ kind: 'star' as const, ...particle }, { kind: 'heart' as const, ...particle }] };
    await render(<SparkLayer bursts={[burst]} />);
    const [star, starEdge, heart, heartEdge] = nodes('Path').map((n) => [n.props.path as string, n.props.style]);
    expect([star[0], star[1]]).toEqual([starEdge[0], undefined]);
    expect(starEdge[1]).toBe('stroke');
    expect(star[0]).toMatch(/^M[^C]*L[^C]*Z$/);
    expect((star[0] as string).match(/L/g)).toHaveLength(9); // 10 vertici
    expect(heart[0]).toBe(heartEdge[0]);
    expect(heartEdge[1]).toBe('stroke');
    expect(heart[0]).toMatch(/C/);
    expect(heart[0]).not.toMatch(/L/);
  });

  test('all\'inizio ogni scintilla sta nel centro della sua esplosione, piccola e opaca', async () => {
    const burst = tileBurst(1, 40, 50, false, rand);
    await render(<SparkLayer bursts={[burst]} />);
    const g = nodes('Group')[0].props as { transform: { value: unknown }; opacity: { value: number } };
    expect(g.transform.value).toEqual([{ translateX: 40 }, { translateY: 50 }, { scale: 0.6 }]);
    expect(g.opacity.value).toBe(1);
  });
});
