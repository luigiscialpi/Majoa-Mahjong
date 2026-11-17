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

import { render, screen } from '@testing-library/react-native';
import { HATCH, hatchPathD } from './contrastSignals';
import { sparklePathsD } from './effects';
import { HC, HC_DIM, StaticTile, blockedDimOverlay, designBox, flipEase, flipTransform, starPathD, tinDelayMs, tinEase, tinTransform } from './tile';

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

describe('StaticTile d\'oro', () => {
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
  const rect = { x: 30, y: 40, w: 56, h: 75 };
  const props = { rect, radius: 6, svg: null, shadow: false, body: null, palette: ['#fff', '#eee', '#ddd', '#ccc', '#bbb'] as const, font: null };

  it('ha in alto a sinistra la scintilla di sparklePathsD (+7 +7 dal bordo, lato 14), una tessera comune no', async () => {
    await render(<StaticTile {...props} status={{ locked: false, fog: false, gold: true, match: false }} />);
    const sparkle = walk(screen.toJSON() as unknown as Node).filter((n) => n.type === 'Path' && (n.props.color === '#ffe040' || n.props.color === '#fff9c4'));
    expect(sparkle.map((n) => [n.props.path, n.props.color])).toEqual([[sparklePathsD(rect.x + 7, rect.y + 7, 14)[0], '#ffe040'], [sparklePathsD(rect.x + 7, rect.y + 7, 14)[1], '#fff9c4']]);
    await screen.unmount();
    await render(<StaticTile {...props} status={{ locked: false, fog: false, gold: false, match: false }} />);
    expect(walk(screen.toJSON() as unknown as Node).filter((n) => n.type === 'Path' && n.props.color === '#ffe040')).toHaveLength(0);
  });
});

describe('StaticTile: tratteggio delle bloccate', () => {
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
  const rect = { x: 30, y: 40, w: 56, h: 75 };
  const props = { rect, radius: 6, svg: null, shadow: false, body: null, palette: ['#fff', '#eee', '#ddd', '#ccc', '#bbb'] as const, font: null, status: { locked: false, fog: false, gold: false, match: false } };
  const hatchPaths = () => walk(screen.toJSON() as unknown as Node).filter((n) => n.type === 'Path' && n.props.color === HATCH.color);

  it('con `hatch` disegna le strisce del riquadro, a tratto di 5 px, ritagliate sulla tessera arrotondata', async () => {
    await render(<StaticTile {...props} hatch />);
    const [stripes, ...rest] = hatchPaths();
    expect(rest).toHaveLength(0);
    expect(stripes.props).toMatchObject({ path: hatchPathD(rect.w, rect.h), style: 'stroke', strokeWidth: HATCH.width });
    const clipped = walk(screen.toJSON() as unknown as Node).find((n) => n.type === 'Group' && (n.props.clip as { rx?: number } | undefined)?.rx === 6);
    expect(clipped?.props.clip).toEqual({ rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, rx: 6, ry: 6 });
  });

  it('senza `hatch` (o con `hatch` falso) non c\'è nulla', async () => {
    await render(<StaticTile {...props} />);
    expect(hatchPaths()).toHaveLength(0);
    await screen.unmount();
    await render(<StaticTile {...props} hatch={false} />);
    expect(hatchPaths()).toHaveLength(0);
  });

  it('sta sopra l\'oscuramento delle bloccate', async () => {
    await render(<StaticTile {...props} hatch dimColor="rgba(0,0,0,0.40)" />);
    const nodes = walk(screen.toJSON() as unknown as Node);
    const dim = nodes.findIndex((n) => n.type === 'RoundedRect' && n.props.color === 'rgba(0,0,0,0.40)');
    const stripes = nodes.findIndex((n) => n.type === 'Path' && n.props.color === HATCH.color);
    expect(dim).toBeGreaterThanOrEqual(0);
    expect(stripes).toBeGreaterThan(dim);
  });
});

describe('alto contrasto', () => {
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
  const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
  const html = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
  const css = (selector: string) => new RegExp(`\\n${selector.replace(/[.#]/g, '\\$&')}\\{([^}]*)\\}`).exec(html)![1];

  const rect = { x: 30, y: 40, w: 56, h: 75 };
  const palette = ['#fff', '#eee', '#ddd', '#ccc', '#bbb'] as const;
  const base = { rect, radius: 6, svg: null, shadow: true, body: null, palette, font: null };
  const plain = { locked: false, fog: false, gold: false, match: false };
  const rects = () => walk(screen.toJSON() as unknown as Node).filter((n) => n.type === 'RoundedRect');
  const gradients = () => walk(screen.toJSON() as unknown as Node).filter((n) => n.type === 'LinearGradient');
  const solid = (color: string) => rects().filter((n) => n.props.color === color && n.props.style === undefined);
  const stroke = (color: string, width: number) => rects().filter((n) => n.props.color === color && n.props.style === 'stroke' && n.props.strokeWidth === width);

  it('le bloccate si scuriscono al 40% della luminosità, qualunque sia il profilo', () => {
    expect(css('.hc .tile.blocked')).toContain('brightness(.4)');
    expect(HC_DIM).toBe('rgba(0,0,0,0.60)');
    for (const profile of ['easy', 'normal', 'medium', 'hard', 'expert', 'master'] as const) expect(blockedDimOverlay(profile, true)).toBe(HC_DIM);
    expect(blockedDimOverlay('hard')).toBe('rgba(0,0,0,0.28)'); // senza alto contrasto resta quello del profilo
  });

  it('colori letti dall\'HTML: faccia bianca, cornice nera, nascosta, oro e nebbia', () => {
    expect(css('.hc .tile')).toMatch(/^background:#fff;box-shadow:inset 0 0 0 3px #000,3px 4px 0 var\(--edge\),3px 4px 0 1px #000,5px 8px 10px rgba\(0,0,0,\.6\)$/);
    expect(css('.hc .tile.locked')).toMatch(/background:#1b1740;box-shadow:inset 0 0 0 3px #ffd34a/);
    expect(css('.hc .tile.gold')).toBe('background:#fff0a8');
    expect(css('.hc .tile.fog')).toBe('background:#dde6ef');
    expect(HC).toEqual({ face: '#fff', frame: '#000', lockedFace: '#1b1740', lockedFrame: '#ffd34a', gold: '#fff0a8', fog: '#dde6ef', deepShadow: 'rgba(0,0,0,0.6)' });
  });

  it('corpo: faccia bianca piatta con cornice nera di 3 px, filo laterale nero e ombra lunga e scura', async () => {
    await render(<StaticTile {...base} status={plain} highContrast />);
    expect(solid(HC.face)).toHaveLength(1);
    expect(stroke(HC.frame, 3)).toHaveLength(1);
    expect(solid(HC.frame)).toHaveLength(1); // il secondo tono del bordo laterale è nero (`3px 4px 0 1px #000`)
    expect(solid(palette[4])).toHaveLength(0);
    expect(gradients()).toHaveLength(0);
    const shadow = walk(screen.toJSON() as unknown as Node).find((n) => n.type === 'Shadow')!;
    expect(shadow.props).toMatchObject({ dx: 5, dy: 8, blur: 10, color: HC.deepShadow });
  });

  it('senza alto contrasto il corpo è quello di sempre: sfumatura crema e filo a due toni', async () => {
    await render(<StaticTile {...base} status={plain} />);
    expect(gradients()).toHaveLength(1);
    expect(solid(HC.face)).toHaveLength(0);
    expect(solid(palette[4])).toHaveLength(1);
    expect(walk(screen.toJSON() as unknown as Node).find((n) => n.type === 'Shadow')!.props).toMatchObject({ dx: 4, dy: 6, blur: 5 });
  });

  it('tessera nascosta: sfondo piatto e cornice dorata piena di 3 px, senza sfumatura', async () => {
    await render(<StaticTile {...base} status={{ ...plain, locked: true }} highContrast />);
    expect(solid(HC.lockedFace)).toHaveLength(1);
    expect(stroke(HC.lockedFrame, 3)).toHaveLength(1);
    expect(gradients()).toHaveLength(0); // né quella della nascosta né quella crema del corpo
    await screen.unmount();
    await render(<StaticTile {...base} status={{ ...plain, locked: true }} />);
    expect(solid(HC.lockedFace)).toHaveLength(0);
    expect(gradients().length).toBeGreaterThan(0);
  });

  it('tessera nebbiosa e tessera d\'oro: fondo piatto', async () => {
    await render(<StaticTile {...base} status={{ ...plain, fog: true }} highContrast />);
    expect(solid(HC.fog)).toHaveLength(1);
    expect(gradients()).toHaveLength(0);
    await screen.unmount();
    await render(<StaticTile {...base} status={{ ...plain, gold: true }} highContrast />);
    expect(solid(HC.gold)).toHaveLength(1);
    expect(gradients()).toHaveLength(0);
    await screen.unmount();
    await render(<StaticTile {...base} status={{ ...plain, gold: true }} />);
    expect(solid(HC.gold)).toHaveLength(0);
    expect(gradients()).toHaveLength(2); // crema del corpo e dorata
  });
});
