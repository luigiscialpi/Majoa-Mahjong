/**
 * Test unitari per le funzioni pure di src/ui/tile.tsx:
 * - designBox: geometria del riquadro SVG
 * - starPathD: path corretto per la stella della tessera nascosta
 * - blockedDimOverlay: colore di oscuramento per profilo
 * - tinDelayMs, tinTransform: animazione ingresso tavola (tin)
 * - flipTransform: animazione sblocco e diradamento nebbia (flip)
 */

// Mock manuale di react-native-reanimated per evitare di caricare react-native-worklets nativi.
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => ({ value: v }),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  withTiming: (v: unknown) => v,
  withDelay: (_d: number, v: unknown) => v,
  withSequence: (...args: unknown[]) => args[args.length - 1],
  Easing: {
    linear: (t: number) => t,
    inOut: () => (t: number) => t,
    out: () => (t: number) => t,
    ease: (t: number) => t,
    bezier: () => (t: number) => t,
  },
  default: {},
}));

import { blockedDimOverlay, designBox, flipEase, flipTransform, starPathD, tinDelayMs, tinEase, tinTransform } from './tile';

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

describe('tinDelayMs, tinEase e tinTransform', () => {
  it('calcola il delay proporzionale a z (120ms), y (30ms) e x (20ms)', () => {
    expect(tinDelayMs(0, 0, 0)).toBe(0);
    // x=2, y=3, z=1 -> 1*120 + 3*30 + 2*20 = 120 + 90 + 40 = 250 ms
    expect(tinDelayMs(2, 3, 1)).toBe(250);
  });

  it('tinEase replica cubic-bezier(.34, 1.25, .64, 1) con rimbalzo armonico (overshoot)', () => {
    expect(tinEase(0)).toBe(0);
    expect(tinEase(1)).toBe(1);
    // Nella seconda metà del progresso supera 1.0 (overshoot elastico morbido)
    expect(tinEase(0.7)).toBeGreaterThan(1.0);
  });

  it('tinTransform parte da translateY(-28), scale(0.82), opacity(0) a progress=0', () => {
    const t0 = tinTransform(0);
    expect(t0.opacity).toBe(0);
    expect(t0.transform).toEqual([{ translateY: -28 }, { scale: 0.82 }]);
  });

  it('tinTransform a progress=1 è a riposo: translateY(0), scale(1.0), opacity(1)', () => {
    const t1 = tinTransform(1);
    expect(t1.opacity).toBe(1);
    expect(t1.transform).toEqual([{ translateY: 0 }, { scale: 1 }]);
  });

  it('tinTransform a progress intermedio (0.5) include rimbalzo elastico e opacità pronta', () => {
    const tMid = tinTransform(0.5);
    expect(tMid.opacity).toBeCloseTo(Math.sqrt(0.5));
    const eased = tinEase(0.5);
    expect(tMid.transform[0]).toEqual({ translateY: -28 * (1 - eased) });
    expect(tMid.transform[1]).toEqual({ scale: 0.82 + 0.18 * eased });
  });
});

describe('flipEase e flipTransform', () => {
  it('flipEase rispetta gli estremi [0, 1]', () => {
    expect(flipEase(0)).toBe(0);
    expect(flipEase(1)).toBe(1);
    expect(flipEase(0.5)).toBeGreaterThan(1.0);
  });

  it('a progress=0 ruota a 90 gradi (PI/2) con scala 0.8 e prospettiva 300', () => {
    const f0 = flipTransform(0);
    expect(f0).toEqual([
      { perspective: 300 },
      { rotateY: Math.PI / 2 },
      { scale: 0.8 },
    ]);
  });

  it('a progress=1 è dritto a 0 gradi con scala 1.0', () => {
    const f1 = flipTransform(1);
    expect(f1).toEqual([
      { perspective: 300 },
      { rotateY: 0 },
      { scale: 1.0 },
    ]);
  });

  it('a progress=0.5 include la rotazione con curva flipEase', () => {
    const fMid = flipTransform(0.5);
    const eased = flipEase(0.5);
    expect(fMid[0]).toEqual({ perspective: 300 });
    expect((fMid[1] as { rotateY: number }).rotateY).toBeCloseTo((1 - eased) * (Math.PI / 2));
    expect((fMid[2] as { scale: number }).scale).toBeCloseTo(0.8 + 0.2 * eased);
  });
});
