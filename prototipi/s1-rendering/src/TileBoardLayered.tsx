import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas, Group, Image, RoundedRect, drawAsImage, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { boardMetrics, drawOrder, freeIndices, hitTest, tileRect, type Metrics, type Rect, type Tile } from './board';
import { SvgAt } from './SvgAt';
import { BODY_PAD, PALETTE, TileBody, designBox, useBodyImage } from './TileBody';
import { TileSprite } from './TileBoard';

/** Tessera ferma: componente senza hook né valori condivisi, adatto a essere disegnato una volta sola in un'immagine. */
export function StaticTile({ rect, radius, svg, shadow, body }: { rect: Rect; radius: number; svg: SkSVG | null; shadow: boolean; body: SkImage | null }) {
  const box = designBox(rect.x, rect.y, rect.w, rect.h);
  return (
    <>
      {body ? (
        <Group transform={[{ translateX: rect.x - BODY_PAD }, { translateY: rect.y - BODY_PAD }]}>
          <Image image={body} x={0} y={0} width={rect.w + 2 * BODY_PAD} height={rect.h + 2 * BODY_PAD} fit="fill" />
        </Group>
      ) : (
        <TileBody x={rect.x} y={rect.y} w={rect.w} h={rect.h} radius={radius} shadow={shadow} />
      )}
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
  /** Modalità manuale: indici delle tessere disegnate dal vivo (animate); tutte le altre stanno nell'immagine dello strato fermo. */
  liveIndices: readonly number[];
  /** Modalità partita: le tessere vive sono sempre le libere (le sole che si possono toccare o rimuovere) più quelle in rimozione. */
  autoLive?: boolean;
  /** Tessere già rimosse dalla tavola e tessere in animazione di rimozione (modalità partita). */
  gone?: ReadonlySet<number>;
  removing?: ReadonlySet<number>;
  /** Cambia a ogni nuova rimozione e fa ripartire l'animazione. */
  removeKey?: number;
  /** Disegna il corpo delle tessere dello strato fermo da un'immagine in cache (ricostruzione più veloce). */
  staticCache?: boolean;
  selected: number | null;
  onTap: (index: number | null, metrics: Metrics) => void;
  /** Tempo (ms) per costruire l'immagine dello strato fermo. */
  onStaticBuilt?: (ms: number) => void;
  /** Conta le tessere rimosse mentre erano ancora nell'immagine dello strato fermo (restano visibili finché non si ricostruisce). */
  ghosts?: MutableRefObject<number>;
};

type Layer = { image: SkImage | null; excluded: ReadonlySet<number> };
const EMPTY: ReadonlySet<number> = new Set();

/**
 * Tavola a due strati. Strato fermo: tutte le tessere che non si muovono, disegnate UNA volta in un'immagine
 * (`drawAsImage`) e mostrate con un solo `<Image>`. Strato vivo: solo le tessere animate, con valori condivisi.
 * Così il costo per fotogramma segue le tessere vive, non l'intera tavola.
 */
export function TileBoardLayered({ tiles, svgs, width, height, shadow, liveIndices, autoLive = false, gone = EMPTY, removing = EMPTY, removeKey = 0, staticCache = false, selected, onTap, onStaticBuilt, ghosts }: LayeredProps) {
  const metrics = useMemo(() => boardMetrics(tiles, width, height), [tiles, width, height]);
  const order = useMemo(() => drawOrder(tiles), [tiles]);
  const rects = useMemo(() => tiles.map((t) => tileRect(metrics, t)), [tiles, metrics]);
  const radius = Math.max(4, metrics.tw * 0.14);
  const body = useBodyImage(true, metrics.tw - 3, metrics.th - 3, radius, shadow);
  const staticBody = staticCache ? body : null;

  // Tessere vive: in modalità partita le libere (senza quelle in rimozione, che non bloccano più nessuno) e quelle in rimozione.
  const desired = useMemo(() => {
    if (!autoLive) return new Set(liveIndices);
    const out = new Set(freeIndices(tiles, new Set([...gone, ...removing])));
    removing.forEach((i) => out.add(i));
    return out;
  }, [autoLive, liveIndices, tiles, gone, removing]);
  const liveKey = useMemo(() => [...desired].sort((a, b) => a - b).join(','), [desired]);

  const [layer, setLayer] = useState<Layer>({ image: null, excluded: EMPTY });
  const built = useRef(onStaticBuilt);
  built.current = onStaticBuilt;
  const goneRef = useRef(gone);
  goneRef.current = gone;

  const pulse = useSharedValue(0);
  const entrance = useSharedValue(1);
  const rm = useSharedValue(0);
  const pulsing = !autoLive && liveIndices.length > 0;
  useEffect(() => {
    if (pulsing) pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    else pulse.value = 0;
  }, [pulsing, pulse]);
  useEffect(() => {
    if (removeKey === 0) return;
    rm.value = 0;
    rm.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
  }, [removeKey, rm]);

  // Ricostruisce l'immagine dello strato fermo quando cambia l'insieme delle tessere vive (non a ogni selezione).
  useEffect(() => {
    let cancelled = false;
    const excluded = new Set(desired);
    const dpr = PixelRatio.get();
    const t0 = Date.now();
    drawAsImage(
      <Group transform={[{ scale: dpr }]}>
        {order
          .filter((i) => !excluded.has(i) && !goneRef.current.has(i))
          .map((i) => (
            <StaticTile key={i} rect={rects[i]} radius={radius} svg={svgs[tiles[i].type] ?? null} shadow={shadow} body={staticBody} />
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
    // `desired` entra tramite `liveKey`; `gone` si legge dal ref al momento della ricostruzione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, shadow, width, height, rects, order, radius, svgs, tiles, staticBody]);

  // Una tessera rimossa che non era stata ancora esclusa dall'immagine resta visibile (fantasma) fino alla ricostruzione.
  const counted = useRef(new Set<number>());
  useEffect(() => {
    if (!ghosts || !layer.image) return;
    gone.forEach((i) => {
      if (!counted.current.has(i)) {
        counted.current.add(i);
        if (!layer.excluded.has(i)) ghosts.current += 1;
      }
    });
    if (gone.size === 0) counted.current.clear();
  }, [gone, layer, ghosts]);

  // Finché l'immagine non è pronta si disegna tutto dal vivo; dopo, dal vivo solo ciò che l'immagine non contiene
  // o che sta per muoversi (stessi pixel, nessun buco durante il passaggio).
  const live = order.filter((i) => !gone.has(i) && (!layer.image || layer.excluded.has(i) || desired.has(i)));

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

  const sel = selected === null || gone.has(selected) ? null : rects[selected];
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
            bob={!autoLive && desired.has(i)}
            rm={rm}
            removing={removing.has(i)}
          />
        ))}
        {sel ? (
          <RoundedRect x={sel.x + 1.5} y={sel.y + 1.5} width={sel.w - 3} height={sel.h - 3} r={radius} style="stroke" strokeWidth={3} color={PALETTE[2]} />
        ) : null}
      </Canvas>
    </GestureDetector>
  );
}
