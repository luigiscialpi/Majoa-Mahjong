import { PixelRatio } from 'react-native';
import { AlphaType, ColorType, Group, drawAsImage, vec, type SkSVG } from '@shopify/react-native-skia';
import { drawOrder, tileRect, type Metrics, type Tile } from './board';
import { StaticTile } from './TileBoardLayered';

export type Equivalence = { diffPct: number; maxDiff: number; ms: number };

/**
 * Confronta due disegni della stessa tavola: tutte le tessere come nello strato fermo, e le stesse tessere avvolte
 * in un gruppo con trasformazione identica, come fanno gli sprite vivi. Se coincidono, il passaggio di una tessera
 * dallo strato fermo a quello vivo non si vede. Il confronto è fatto sui pixel (RGBA, soglia 12/255 per canale).
 */
export async function layerEquivalence(tiles: readonly Tile[], svgs: (SkSVG | null)[], metrics: Metrics, width: number, height: number, shadow: boolean): Promise<Equivalence> {
  const t0 = Date.now();
  const dpr = PixelRatio.get();
  const size = { width: Math.ceil(width * dpr), height: Math.ceil(height * dpr) };
  const order = drawOrder(tiles);
  const radius = Math.max(4, metrics.tw * 0.14);
  const rects = tiles.map((t) => tileRect(metrics, t));
  const flat = (
    <Group transform={[{ scale: dpr }]}>
      {order.map((i) => (
        <StaticTile key={i} rect={rects[i]} radius={radius} svg={svgs[tiles[i].type] ?? null} shadow={shadow} body={null} />
      ))}
    </Group>
  );
  const wrapped = (
    <Group transform={[{ scale: dpr }]}>
      {order.map((i) => (
        <Group key={i} transform={[{ translateY: 0 }, { scale: 1 }]} origin={vec(rects[i].x + rects[i].w / 2, rects[i].y + rects[i].h / 2)} opacity={1}>
          <StaticTile rect={rects[i]} radius={radius} svg={svgs[tiles[i].type] ?? null} shadow={shadow} body={null} />
        </Group>
      ))}
    </Group>
  );
  const [a, b] = await Promise.all([drawAsImage(flat, size), drawAsImage(wrapped, size)]);
  if (!a || !b) throw new Error('drawAsImage non ha prodotto un\'immagine');
  const info = { width: size.width, height: size.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul };
  const pa = a.readPixels(0, 0, info);
  const pb = b.readPixels(0, 0, info);
  if (!pa || !pb) throw new Error('readPixels non disponibile');
  let diff = 0;
  let maxDiff = 0;
  for (let k = 0; k < pa.length; k += 4) {
    const d = Math.max(Math.abs(pa[k] - pb[k]), Math.abs(pa[k + 1] - pb[k + 1]), Math.abs(pa[k + 2] - pb[k + 2]), Math.abs(pa[k + 3] - pb[k + 3]));
    if (d > 12) diff++;
    if (d > maxDiff) maxDiff = d;
  }
  return { diffPct: Math.round((diff / (pa.length / 4)) * 1000) / 1000, maxDiff, ms: Date.now() - t0 };
}
