/**
 * Test unitari per le funzioni pure di src/ui/tile.tsx:
 * - designBox: geometria del riquadro SVG
 * - starPathD: path corretto per la stella della tessera nascosta
 * - blockedDimOverlay: colore di oscuramento per profilo
 */

// Mock manuale di react-native-reanimated per evitare di caricare react-native-worklets nativi.
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => ({ value: v }),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  withTiming: (v: unknown) => v,
  withSequence: (...args: unknown[]) => args[args.length - 1],
  Easing: { linear: (t: number) => t, inOut: () => (t: number) => t, ease: (t: number) => t },
  default: {},
}));

import { blockedDimOverlay, designBox, starPathD } from './tile';

describe('designBox', () => {
  it('scala al minimo tra larghezza e altezza', () => {
    // Tessera 56×75 (tw-3=56, th-3=75): iw=48 ih=69, scale=min(48/60,69/80)=min(0.8,0.8625)=0.8
    const box = designBox(0, 0, 56, 75);
    expect(box.width).toBeCloseTo(48);
    expect(box.height).toBeCloseTo(64);
  });

  it('centra il riquadro nel tile', () => {
    const box = designBox(10, 20, 56, 75);
    // x = 10 + 4 + (iw - width)/2; iw=48, width=48, (48-48)/2=0 → x=14
    expect(box.x).toBeCloseTo(14);
    // y = 20 + 3 + (ih - height)/2; ih=69, height=64, (69-64)/2=2.5 → y=25.5
    expect(box.y).toBeCloseTo(25.5);
  });
});

describe('starPathD', () => {
  it('inizia con M e termina con Z', () => {
    const d = starPathD(30, 19, 8.5, 3.8);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('contiene 10 punti (M + 9 L)', () => {
    const d = starPathD(30, 19, 8.5, 3.8);
    const points = d.replace('Z', '').split('L');
    expect(points).toHaveLength(10);
  });

  it('il primo punto è il vertice superiore (a = -PI/2, R=8.5)', () => {
    const d = starPathD(30, 19, 8.5, 3.8);
    // Primo punto: M + cx + 8.5*cos(-PI/2) + ' ' + cy + 8.5*sin(-PI/2)
    // cos(-PI/2)≈0, sin(-PI/2)=-1 → x≈30, y≈10.5
    expect(d).toMatch(/^M30\.0 10\.5/);
  });
});

describe('blockedDimOverlay', () => {
  it('restituisce null per master', () => {
    expect(blockedDimOverlay('master')).toBeNull();
  });

  it('restituisce 40% per normal', () => {
    expect(blockedDimOverlay('normal')).toBe('rgba(0,0,0,0.40)');
  });

  it('restituisce 28% per hard', () => {
    expect(blockedDimOverlay('hard')).toBe('rgba(0,0,0,0.28)');
  });

  it('restituisce 15% per expert', () => {
    expect(blockedDimOverlay('expert')).toBe('rgba(0,0,0,0.15)');
  });

  it('usa normal come default', () => {
    expect(blockedDimOverlay()).toBe('rgba(0,0,0,0.40)');
  });
});
