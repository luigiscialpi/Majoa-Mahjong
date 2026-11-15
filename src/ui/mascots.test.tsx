import { act } from 'react';
import { renderHook } from '@testing-library/react-native';
import type * as SkiaModule from '@shopify/react-native-skia';
import { MASCOT_RASTER, useMascotUri } from './mascots';

type ImageNode = { props: { svg: unknown; width: number; height: number } };
type Skia = typeof SkiaModule;
const image = (base64: string) => ({ encodeToBase64: jest.fn(() => base64) });
type FakeImage = ReturnType<typeof image>;

// L'oggetto che vede il codice provato: né `import * as` (una copia) né `jest.requireMock` (un'altra istanza della finta) vanno bene
// per spiarlo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Skia = require('@shopify/react-native-skia') as Skia;
/** Lascia finire tutta la catena di caricamento (SVG, disegno, codifica). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

afterEach(() => jest.restoreAllMocks());

/** Una copia nuova del caricatore, con la sua cache e la sua finta di Skia: ogni prova parte da zero. */
function fresh() {
  let loader!: typeof import('./mascots');
  let skia!: Skia;
  jest.isolateModules(() => {
    skia = require('@shopify/react-native-skia') as Skia; // eslint-disable-line @typescript-eslint/no-require-imports
    loader = require('./mascots') as typeof import('./mascots'); // eslint-disable-line @typescript-eslint/no-require-imports
  });
  return { load: loader.loadMascotUri, skia };
}
const drawing = (skia: Skia, result: unknown) => jest.spyOn(skia, 'drawAsImage').mockResolvedValue(result as never);

describe('loadMascotUri', () => {
  test('disegna l\'SVG in un\'immagine con il rapporto del viewBox e la restituisce come PNG in un URI di dati', async () => {
    const { load, skia } = fresh();
    const png = image('QUJD');
    const draw = drawing(skia, png);
    await expect(load('collie')).resolves.toBe('data:image/png;base64,QUJD');
    expect(png.encodeToBase64).toHaveBeenCalledWith(skia.ImageFormat.PNG, 100); // il formato è quello dichiarato nell'URI
    expect(MASCOT_RASTER.width / MASCOT_RASTER.height).toBeCloseTo(100 / 112, 6);
    const [element, size] = draw.mock.calls[0] as unknown as [ImageNode, typeof MASCOT_RASTER];
    expect(size).toEqual(MASCOT_RASTER);
    expect([element.props.width, element.props.height]).toEqual([MASCOT_RASTER.width, MASCOT_RASTER.height]);
    expect(element.props.svg).toEqual({ svg: { finto: true } }); // l'SVG letto dall'asset dalla finta di `loadData`
  });

  test('si disegna una volta sola per mascotte: la seconda richiesta riusa la prima', async () => {
    const { load, skia } = fresh();
    const draw = drawing(skia, image('U0hFTA=='));
    const first = load('sheltie');
    expect(load('sheltie')).toBe(first);
    await first;
    await load('sheltie');
    expect(draw).toHaveBeenCalledTimes(1);
    await load('collie'); // un'altra mascotte si disegna a parte
    expect(draw).toHaveBeenCalledTimes(2);
  });

  test('se il disegno non riesce, la mascotte manca (null) senza far fallire il resto', async () => {
    const { load, skia } = fresh();
    jest.spyOn(skia, 'drawAsImage').mockRejectedValue(new Error('gpu'));
    await expect(load('siamshort')).resolves.toBeNull();
  });

  test('se l\'immagine non si crea, la mascotte manca', async () => {
    const { load, skia } = fresh();
    drawing(skia, null);
    await expect(load('siamlong')).resolves.toBeNull();
  });

  test('se l\'SVG non si carica o non si interpreta, la mascotte manca e non si prova a disegnarla', async () => {
    const { load, skia } = fresh();
    const draw = drawing(skia, image('QUJD'));
    jest.spyOn(skia, 'loadData').mockResolvedValue(undefined as never);
    await expect(load('collie')).resolves.toBeNull();
    jest.spyOn(skia, 'loadData').mockRejectedValue(new Error('asset'));
    await expect(load('sheltie')).resolves.toBeNull();
    expect(draw).not.toHaveBeenCalled();
  });
});

describe('useMascotUri', () => {
  // Il gancio usa il modulo vero (la stessa copia di React di `renderHook`): ogni prova una mascotte diversa, per la cache.
  test('restituisce l\'immagine quando è pronta', async () => {
    jest.spyOn(Skia, 'drawAsImage').mockResolvedValue(image('QUJD') as never);
    const { result } = await renderHook(() => useMascotUri('collie'));
    await settle();
    expect(result.current).toBe('data:image/png;base64,QUJD');
  });

  test('passando a «nessuna» l\'immagine sparisce subito, già nel primo disegno dopo il cambio', async () => {
    jest.spyOn(Skia, 'drawAsImage').mockResolvedValue(image('U0hFTA==') as never);
    const load = jest.spyOn(Skia, 'loadData');
    const seen: (string | null)[] = [];
    const { result, rerender } = await renderHook((mascot: 'sheltie' | 'none') => {
      const uri = useMascotUri(mascot);
      seen.push(uri);
      return uri;
    }, { initialProps: 'sheltie' as 'sheltie' | 'none' });
    await settle();
    expect(result.current).toBe('data:image/png;base64,U0hFTA==');
    const before = seen.length;
    await rerender('none');
    await settle();
    expect(seen.slice(before).every((value) => value === null)).toBe(true);
    expect(result.current).toBeNull();
    expect(load).toHaveBeenCalledTimes(1); // solo la mascotte di prima: «nessuna» non carica nulla (e non lascia nulla in cache)
  });

  test('se la mascotte non si disegna resta null', async () => {
    jest.spyOn(Skia, 'drawAsImage').mockResolvedValue(null as never);
    const { result } = await renderHook(() => useMascotUri('siamshort'));
    await settle();
    expect(result.current).toBeNull();
  });

  test('«nessuna» non carica nulla e restituisce null', async () => {
    const draw = jest.spyOn(Skia, 'drawAsImage');
    const load = jest.spyOn(Skia, 'loadData');
    const { result } = await renderHook(() => useMascotUri('none'));
    await settle();
    expect(result.current).toBeNull();
    expect(draw).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });
});
