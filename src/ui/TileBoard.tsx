import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas, Group, Image, RoundedRect, drawAsImage, matchFont, type SkFont, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { boardMetrics, drawOrder, hitTest, tileRect } from '../domain/board';
import type { Profile } from '../domain/profile';
import type { PlacedTile } from '../domain/types';
import type { Palette } from '../infrastructure/content/legacyThemes';
import { statusKey, type TileStatus } from './boardView';
import { RemovingTile, StaticTile, blockedDimOverlay, useBodyImage } from './tile';

export type TileBoardProps = {
  tiles: readonly PlacedTile[];
  /** Disegno (0-128) di ogni tessera. */
  designs: readonly number[];
  svgs: readonly (SkSVG | null)[];
  statuses: readonly TileStatus[];
  palette: Palette;
  profile?: Profile;
  width: number;
  height: number;
  /** Tessere vive e libere: le sole che possono essere toccate o tolte, quindi disegnate dal vivo. */
  free: ReadonlySet<number>;
  /** Tessere già tolte e tessere che si stanno togliendo (animazione di 250 ms). */
  gone: ReadonlySet<number>;
  removing: ReadonlySet<number>;
  /** Cambia a ogni nuova rimozione e fa ripartire l'animazione. */
  removeKey: number;
  selected: readonly number[];
  hint: readonly number[];
  /** Tessera toccata, oppure `null` se il tocco è fuori da ogni tessera viva. */
  onTap: (index: number | null) => void;
};

const REMOVE_MS = 250;
const EMPTY: ReadonlySet<number> = new Set();
type Layer = { image: SkImage | null; excluded: ReadonlySet<number> };

function useMarkFont(size: number): SkFont | null {
  return useMemo(() => {
    try {
      return matchFont({ fontFamily: 'sans-serif', fontSize: size, fontWeight: 'bold' });
    } catch {
      return null;
    }
  }, [size]);
}

/**
 * Tavola a due strati, portata da `TileBoardLayered` di S1. Strato fermo: le tessere che non si muovono, disegnate UNA volta
 * in un'immagine (`drawAsImage`) e mostrate con un solo `<Image>`. Strato vivo: le tessere libere (le sole che si possono
 * togliere) e quelle in rimozione, con valori condivisi solo per l'animazione. Così il costo per fotogramma segue le tessere
 * vive, non l'intera tavola. Il tocco si risolve con `hitTest` del dominio, non con viste per tessera.
 */
export function TileBoard({ tiles, designs, svgs, statuses, palette, profile = 'normal', width, height, free, gone, removing, removeKey, selected, hint, onTap }: TileBoardProps) {
  const metrics = useMemo(() => boardMetrics(tiles, width, height), [tiles, width, height]);
  const order = useMemo(() => drawOrder(tiles), [tiles]);
  const rects = useMemo(() => tiles.map((t) => tileRect(metrics, t)), [tiles, metrics]);
  const radius = Math.max(4, metrics.tw * 0.14);
  const font = useMarkFont(Math.max(12, metrics.tw * 0.6));
  const body = useBodyImage(metrics.tw - 3, metrics.th - 3, radius, true, palette);
  const dimColor = useMemo(() => blockedDimOverlay(profile), [profile]);

  // Tessere vive: le libere e quelle in rimozione.
  const desired = useMemo(() => new Set([...free, ...removing]), [free, removing]);
  const liveKey = useMemo(() => [...desired].sort((a, b) => a - b).join(','), [desired]);
  const statusesKey = useMemo(() => statusKey(statuses), [statuses]);

  const [layer, setLayer] = useState<Layer>({ image: null, excluded: EMPTY });
  const goneRef = useRef(gone);
  goneRef.current = gone;
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  const rm = useSharedValue(0);
  useEffect(() => {
    if (removeKey === 0) return;
    rm.value = 0;
    rm.value = withTiming(1, { duration: REMOVE_MS, easing: Easing.linear });
  }, [removeKey, rm]);

  // Ricostruisce l'immagine dello strato fermo quando cambia l'insieme delle tessere vive, la tavola o l'aspetto delle tessere
  // (non a ogni selezione). `gone` e `statuses` si leggono dai ref al momento della ricostruzione.
  useEffect(() => {
    let cancelled = false;
    const excluded = new Set(desired);
    const dpr = PixelRatio.get();
    drawAsImage(
      <Group transform={[{ scale: dpr }]}>
        {order
          .filter((i) => !excluded.has(i) && !goneRef.current.has(i))
          .map((i) => {
            const isBlocked = !free.has(i) && !statusesRef.current[i].locked;
            return (
              <StaticTile
                key={i}
                rect={rects[i]}
                radius={radius}
                svg={svgs[designs[i]] ?? null}
                shadow
                body={body}
                palette={palette}
                status={statusesRef.current[i]}
                font={font}
                dimColor={isBlocked ? dimColor : null}
              />
            );
          })}
      </Group>,
      { width: Math.ceil(width * dpr), height: Math.ceil(height * dpr) },
    ).then((image) => {
      if (!cancelled) setLayer({ image, excluded });
    });
    return () => {
      cancelled = true;
    };
    // `desired` entra tramite `liveKey` e gli aspetti tramite `statusesKey`.
  }, [liveKey, statusesKey, width, height, rects, order, radius, svgs, designs, tiles, body, palette, font, dimColor, free]);

  // Finché l'immagine non è pronta si disegna tutto dal vivo; dopo, dal vivo solo ciò che l'immagine non contiene
  // o che sta per muoversi (stessi pixel, nessun buco durante il passaggio).
  const live = order.filter((i) => !gone.has(i) && (!layer.image || layer.excluded.has(i) || desired.has(i)));
  const tappable = useMemo(() => order.filter((i) => !gone.has(i) && !removing.has(i)), [order, gone, removing]);

  // Il gesto si crea una volta sola e legge sempre i dati più recenti da un ref.
  const latest = useRef({ tiles, metrics, tappable, onTap });
  latest.current = { tiles, metrics, tappable, onTap };
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
          const l = latest.current;
          l.onTap(hitTest(l.tiles, l.metrics, e.x, e.y, 0, l.tappable));
        }),
    [],
  );

  return (
    <GestureDetector gesture={tap}>
      <Canvas style={{ width, height }}>
        {layer.image ? <Image image={layer.image} x={0} y={0} width={width} height={height} fit="fill" /> : null}
        {live.map((i) => {
          const isSelected = selected.includes(i);
          const rect = isSelected ? { ...rects[i], y: rects[i].y - 4 } : rects[i];
          const isBlocked = !free.has(i) && !statuses[i].locked;
          const props = {
            rect,
            radius,
            svg: svgs[designs[i]] ?? null,
            shadow: true,
            body,
            palette,
            status: statuses[i],
            font,
            dimColor: isBlocked ? dimColor : null,
          };
          return removing.has(i) ? <RemovingTile key={i} rm={rm} {...props} /> : <StaticTile key={i} {...props} />;
        })}
        {hint.filter((i) => !gone.has(i) && !removing.has(i)).map((i) => (
          <RoundedRect key={`h${i}`} x={rects[i].x + 1.5} y={rects[i].y + 1.5} width={rects[i].w - 3} height={rects[i].h - 3} r={radius} style="stroke" strokeWidth={4} color="#ffffff" />
        ))}
        {selected
          .filter((i) => !gone.has(i) && !removing.has(i))
          .map((i) => {
            const r = { ...rects[i], y: rects[i].y - 4 };
            return (
              <Group key={`s${i}`}>
                {/* Bagliore d'accento sfumato attorno alla tessera sollevata */}
                <RoundedRect
                  x={r.x - 2}
                  y={r.y - 2}
                  width={r.w + 4}
                  height={r.h + 4}
                  r={radius + 2}
                  style="stroke"
                  strokeWidth={3}
                  color={palette[2]}
                  opacity={0.35}
                />
                {/* Bordo principale d'accento (3px) */}
                <RoundedRect
                  x={r.x + 1.5}
                  y={r.y + 1.5}
                  width={r.w - 3}
                  height={r.h - 3}
                  r={radius}
                  style="stroke"
                  strokeWidth={3}
                  color={palette[2]}
                />
                {/* Filo interno chiaro superiore (replica inset 0 2px 3px rgba(255,255,255,.9)) */}
                <RoundedRect
                  x={r.x + 3}
                  y={r.y + 3}
                  width={r.w - 6}
                  height={r.h - 6}
                  r={radius - 1}
                  style="stroke"
                  strokeWidth={1}
                  color="rgba(255,255,255,0.7)"
                />
              </Group>
            );
          })}
      </Canvas>
    </GestureDetector>
  );
}
