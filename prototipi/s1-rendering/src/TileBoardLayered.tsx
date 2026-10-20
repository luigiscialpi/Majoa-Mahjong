import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas, Group, Image, RoundedRect, drawAsImage, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { boardMetrics, drawOrder, hitTest, tileRect, type Metrics, type Rect, type Tile } from './board';
import { SvgAt } from './SvgAt';
import { PALETTE, TileBody, designBox, useBodyImage } from './TileBody';
import { TileSprite } from './TileBoard';

/** Tessera ferma: componente senza hook né valori condivisi, adatto a essere disegnato una volta sola in un'immagine. */
function StaticTile({ rect, radius, svg, shadow }: { rect: Rect; radius: number; svg: SkSVG | null; shadow: boolean }) {
  const box = designBox(rect.x, rect.y, rect.w, rect.h);
  return (
    <>
      <TileBody x={rect.x} y={rect.y} w={rect.w} h={rect.h} radius={radius} shadow={shadow} />
      <SvgAt svg={svg} x={box.x} y={box.y} width={box.width} height={box.height} />
    </>
  );
}

export type LayeredProps = {
  tiles: readonly Tile[];
  svgs: (SkSVG | null)[];
  width: number;
  height: number;
  shadow: boolean;
  /** Indici delle tessere disegnate dal vivo (animate); tutte le altre stanno nell'immagine dello strato fermo. */
  liveIndices: readonly number[];
  selected: number | null;
  onTap: (index: number | null, metrics: Metrics) => void;
  /** Tempo (ms) per costruire l'immagine dello strato fermo. */
  onStaticBuilt?: (ms: number) => void;
};

type Layer = { image: SkImage | null; excluded: ReadonlySet<number> };

/**
 * Tavola a due strati. Strato fermo: tutte le tessere che non si muovono, disegnate UNA volta in un'immagine
 * (`drawAsImage`) e mostrate con un solo `<Image>`. Strato vivo: solo le tessere animate, con valori condivisi.
 * Così la ripetizione del disegno a ogni fotogramma costa quanto le tessere animate, non quanto l'intera tavola.
 */
export function TileBoardLayered({ tiles, svgs, width, height, shadow, liveIndices, selected, onTap, onStaticBuilt }: LayeredProps) {
  const metrics = useMemo(() => boardMetrics(tiles, width, height), [tiles, width, height]);
  const order = useMemo(() => drawOrder(tiles), [tiles]);
  const rects = useMemo(() => tiles.map((t) => tileRect(metrics, t)), [tiles, metrics]);
  const radius = Math.max(4, metrics.tw * 0.14);
  const body = useBodyImage(true, metrics.tw - 3, metrics.th - 3, radius, shadow);
  const desired = useMemo(() => new Set(liveIndices), [liveIndices]);
  const [layer, setLayer] = useState<Layer>({ image: null, excluded: new Set() });
  const built = useRef(onStaticBuilt);
  built.current = onStaticBuilt;

  const pulse = useSharedValue(0);
  const entrance = useSharedValue(1);
  useEffect(() => {
    if (liveIndices.length > 0) pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    else pulse.value = 0;
  }, [liveIndices.length, pulse]);

  // Ricostruisce l'immagine dello strato fermo quando cambia l'insieme delle tessere vive (non a ogni selezione).
  const liveKey = liveIndices.join(',');
  useEffect(() => {
    let cancelled = false;
    const excluded = new Set(liveIndices);
    const dpr = PixelRatio.get();
    const t0 = Date.now();
    drawAsImage(
      <Group transform={[{ scale: dpr }]}>
        {order
          .filter((i) => !excluded.has(i))
          .map((i) => (
            <StaticTile key={i} rect={rects[i]} radius={radius} svg={svgs[tiles[i].type] ?? null} shadow={shadow} />
          ))}
      </Group>,
      { width: Math.ceil(width * dpr), height: Math.ceil(height * dpr) },
    ).then((image) => {
      if (cancelled) return;
      built.current?.(Date.now() - t0);
      setLayer({ image, excluded });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, shadow, width, height, rects, order, radius, svgs, tiles]);

  // Finché l'immagine non è pronta si disegna tutto dal vivo; dopo, dal vivo solo ciò che l'immagine non contiene
  // o che sta per muoversi (stessi pixel, nessun buco durante il passaggio).
  const live = layer.image ? order.filter((i) => layer.excluded.has(i) || desired.has(i)) : order;

  const latest = useRef({ tiles, metrics, order, onTap });
  latest.current = { tiles, metrics, order, onTap };
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
          const l = latest.current;
          l.onTap(hitTest(l.tiles, l.metrics, e.x, e.y, 0, l.order), l.metrics);
        }),
    [],
  );

  const sel = selected === null ? null : rects[selected];
  return (
    <GestureDetector gesture={tap}>
      <Canvas style={{ width, height }}>
        {layer.image ? <Image image={layer.image} x={0} y={0} width={width} height={height} fit="fill" /> : null}
        {live.map((i, k) => (
          <TileSprite
            key={i}
            rect={rects[i]}
            radius={radius}
            svg={svgs[tiles[i].type] ?? null}
            body={body}
            phase={k / Math.max(1, live.length)}
            delay={0}
            pulse={pulse}
            entrance={entrance}
            selected={false}
            shadow={shadow}
            bob={desired.has(i)}
          />
        ))}
        {sel ? (
          <RoundedRect x={sel.x + 1.5} y={sel.y + 1.5} width={sel.w - 3} height={sel.h - 3} r={radius} style="stroke" strokeWidth={3} color={PALETTE[2]} />
        ) : null}
      </Canvas>
    </GestureDetector>
  );
}
