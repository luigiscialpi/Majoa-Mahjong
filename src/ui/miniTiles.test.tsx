import { act } from 'react';
import { PixelRatio } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type * as SkiaModule from '@shopify/react-native-skia';
import type { Palette } from '../infrastructure/content/legacyThemes';
import { MINI_FACE, MINI_PAD, MINI_RECENT, MiniTile } from './miniTiles';

// Mock manuale di react-native-reanimated: `tile.tsx` lo importa e i moduli nativi non si caricano nei test.
jest.mock('react-native-reanimated', () => ({ useSharedValue: (v: unknown) => ({ value: v }), useDerivedValue: (fn: () => unknown) => ({ value: fn() }), withTiming: (v: unknown) => v, Easing: {}, default: {} }));

type Skia = typeof SkiaModule;
type DrawnElement = { props: { transform: unknown; children: { props: Record<string, unknown> } } };
const image = (base64: string) => ({ encodeToBase64: jest.fn(() => base64) });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Skia = require('@shopify/react-native-skia') as Skia;
const palette: Palette = ['#111', '#222', '#333', '#444', '#555'];
const svg = { svg: 'faccia' } as never;

afterEach(() => jest.restoreAllMocks());

/** Una copia nuova del modulo, con la sua cache e la sua finta di Skia: ogni prova parte da zero. */
function fresh() {
  let mod!: typeof import('./miniTiles');
  let skia!: Skia;
  jest.isolateModules(() => {
    skia = require('@shopify/react-native-skia') as Skia; // eslint-disable-line @typescript-eslint/no-require-imports
    mod = require('./miniTiles') as typeof import('./miniTiles'); // eslint-disable-line @typescript-eslint/no-require-imports
  });
  return { load: mod.loadMiniTileUri, skia };
}

// Misure di `.sbslot .mt` (riga 196 dell'originale: 42×54) e `.sbrec .mt` (riga 200: 24×31), lette dall'HTML.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const html = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
const css = (selector: string, prop: string) => new RegExp(`${selector.replace(/[.#]/g, '\\$&')}\\{[^}]*?${prop}:(\\d+)px`).exec(html)?.[1];

describe('misure', () => {
  test('la faccia è quella di una casella dell\'originale e la piccola ha lo stesso rapporto', () => {
    expect([MINI_FACE.w, MINI_FACE.h]).toEqual([Number(css('.sbslot', 'width')), Number(css('.sbslot', 'height'))]);
    expect([MINI_RECENT.w, MINI_RECENT.h]).toEqual([Number(css('.sbrec .mt', 'width')), Number(css('.sbrec .mt', 'height'))]);
    expect(MINI_RECENT.w / MINI_RECENT.h).toBeCloseTo(MINI_FACE.w / MINI_FACE.h, 1);
    expect(MINI_FACE.radius).toBe(Number(/\.mt\{[^}]*?border-radius:(\d+)px/.exec(html)![1]));
  });
});

describe('loadMiniTileUri', () => {
  test('disegna la tessera con la stessa `StaticTile` della tavola, in un\'immagine con il margine del bordo, e la dà come PNG', async () => {
    const { load, skia } = fresh();
    const png = image('QUJD');
    const draw = jest.spyOn(skia, 'drawAsImage').mockResolvedValue(png as never);
    await expect(load(3, svg, palette)).resolves.toBe('data:image/png;base64,QUJD');
    expect(png.encodeToBase64).toHaveBeenCalledWith(skia.ImageFormat.PNG, 100);
    const [element, size] = draw.mock.calls[0] as unknown as [DrawnElement, { width: number; height: number }];
    const dpr = PixelRatio.get();
    expect(size).toEqual({ width: Math.ceil((MINI_FACE.w + MINI_PAD) * dpr), height: Math.ceil((MINI_FACE.h + MINI_PAD) * dpr) });
    expect(element.props.transform).toEqual([{ scale: dpr }]);
    expect(element.props.children.props).toMatchObject({
      rect: { x: 0, y: 0, w: MINI_FACE.w, h: MINI_FACE.h },
      radius: MINI_FACE.radius,
      svg,
      shadow: false,
      body: null,
      palette,
      status: { locked: false, fog: false, gold: false, match: false },
    });
  });

  test('le tessere nascoste e nebbiose si disegnano senza bisogno del disegno', async () => {
    const { load, skia } = fresh();
    const draw = jest.spyOn(skia, 'drawAsImage').mockResolvedValue(image('TA==') as never);
    await load('locked', null, palette);
    await load('fog', null, palette);
    const statuses = draw.mock.calls.map((c) => (c[0] as unknown as DrawnElement).props.children.props.status);
    expect(statuses).toEqual([
      { locked: true, fog: false, gold: false, match: false },
      { locked: false, fog: true, gold: false, match: false },
    ]);
  });

  test('si disegna una volta sola per casella e tavolozza: la seconda richiesta riusa la prima', async () => {
    const { load, skia } = fresh();
    const draw = jest.spyOn(skia, 'drawAsImage').mockResolvedValue(image('U0hFTA==') as never);
    const first = load(5, svg, palette);
    expect(load(5, svg, palette)).toBe(first);
    await first;
    expect(draw).toHaveBeenCalledTimes(1);
    await load(6, svg, palette); // un altro disegno
    await load(5, svg, ['#111', '#222', '#333', '#abc', '#555']); // lo stesso disegno con un altro bordo (altra tavolozza)
    expect(draw).toHaveBeenCalledTimes(3);
  });

  test('un disegno non ancora caricato non dà nulla e non resta in cache: ricaricato, si disegna', async () => {
    const { load, skia } = fresh();
    const draw = jest.spyOn(skia, 'drawAsImage').mockResolvedValue(image('QQ==') as never);
    await expect(load(8, null, palette)).resolves.toBeNull();
    expect(draw).not.toHaveBeenCalled();
    await expect(load(8, svg, palette)).resolves.toBe('data:image/png;base64,QQ==');
  });

  test('se il disegno non riesce, la casella resta crema (null) senza far fallire il resto', async () => {
    const { load, skia } = fresh();
    jest.spyOn(skia, 'drawAsImage').mockRejectedValue(new Error('gpu'));
    await expect(load(9, svg, palette)).resolves.toBeNull();
    jest.spyOn(skia, 'drawAsImage').mockResolvedValue(null as never);
    await expect(load(10, svg, palette)).resolves.toBeNull();
  });
});

// `MiniTile` usa il modulo vero (la stessa copia di Skia di questo file): ogni prova usa disegni diversi, per la cache.
type Json = { type: string; props: Record<string, unknown>; children?: Json[] | null };
const images = (node: Json | Json[] | null): Json[] => {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(images);
  return [...(node.type === 'Image' ? [node] : []), ...images(node.children ?? null)];
};
const shown = () => images(screen.toJSON() as Json | Json[] | null);
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const svgs = Array.from({ length: 30 }, () => svg);

describe('MiniTile', () => {
  test('finché l\'immagine non c\'è la casella è vuota; poi la mostra con il margine del bordo, ridotta se piccola', async () => {
    let release!: (value: unknown) => void;
    jest.spyOn(Skia, 'drawAsImage').mockReturnValue(new Promise((resolve) => (release = resolve)) as never); // il disegno finisce quando lo decide la prova
    await render(<MiniTile slot={11} svgs={svgs} palette={palette} width={MINI_FACE.w} height={MINI_FACE.h} testID="mini" />);
    expect(shown()).toHaveLength(0);
    release(image('SU1H'));
    await settle();
    expect(shown()).toHaveLength(1);
    expect(shown()[0].props.source).toEqual({ uri: 'data:image/png;base64,SU1H' });
    expect(shown()[0].props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: MINI_FACE.w + MINI_PAD, height: MINI_FACE.h + MINI_PAD })]));
    const small = await render(<MiniTile slot={11} svgs={svgs} palette={palette} width={MINI_RECENT.w} height={MINI_RECENT.h} testID="mini-small" />);
    await settle();
    const style = images(small.toJSON() as Json | Json[] | null)[0].props.style as { width: number; height: number }[];
    expect(style[1].width).toBeCloseTo(((MINI_FACE.w + MINI_PAD) * MINI_RECENT.w) / MINI_FACE.w, 5);
  });

  test('cambiando casella non resta mai l\'immagine della casella di prima, nemmeno mentre la nuova si disegna', async () => {
    let release!: (value: unknown) => void;
    jest.spyOn(Skia, 'drawAsImage').mockResolvedValueOnce(image('UFJJTUE=') as never).mockReturnValueOnce(new Promise((resolve) => (release = resolve)) as never);
    const { rerender } = await render(<MiniTile slot={12} svgs={svgs} palette={palette} width={MINI_FACE.w} height={MINI_FACE.h} />);
    await settle();
    expect(shown()[0].props.source).toEqual({ uri: 'data:image/png;base64,UFJJTUE=' });
    await rerender(<MiniTile slot={13} svgs={svgs} palette={palette} width={MINI_FACE.w} height={MINI_FACE.h} />);
    expect(shown()).toHaveLength(0); // la nuova non è pronta: crema, non la tessera di prima
    release(image('U0VDT05EQQ=='));
    await settle();
    expect(shown()[0].props.source).toEqual({ uri: 'data:image/png;base64,U0VDT05EQQ==' });
  });

  test('la casella è decorativa: nascosta ai lettori di schermo', async () => {
    jest.spyOn(Skia, 'drawAsImage').mockResolvedValue(null as never);
    await render(<MiniTile slot={14} svgs={svgs} palette={palette} width={MINI_FACE.w} height={MINI_FACE.h} testID="mini-deco" />);
    expect(screen.getByTestId('mini-deco', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });
});
