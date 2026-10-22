import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, Group, Image, RoundedRect, vec, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { boardMetrics, drawOrder, hitTest, tileRect, type Metrics, type Rect, type Tile } from './board';
import { SvgAt } from './SvgAt';
import { BODY_PAD, PALETTE, TileBody, designBox, useBodyImage } from './TileBody';

export type SpriteProps = {
  rect: Rect;
  radius: number;
  svg: SkSVG | null;
  body: SkImage | null;
  phase: number;
  delay: number;
  pulse: SharedValue<number>;
  entrance: SharedValue<number>;
  selected: boolean;
  shadow: boolean;
  /** `true`: la tessera oscilla quando «Anima» è attivo. */
  bob: boolean;
  /** Avanzamento (0-1) dell'animazione di rimozione e tessere a cui si applica. */
  rm: SharedValue<number>;
  removing: boolean;
};

export const TileSprite = memo(function TileSprite({ rect, radius, svg, body, phase, delay, pulse, entrance, selected, shadow, bob, rm, removing }: SpriteProps) {
  const { x, y, w, h } = rect;
  const transform = useDerivedValue(() => {
    const p = Math.min(1, Math.max(0, (entrance.value - delay) / 0.5));
    const amp = bob ? Math.sin((pulse.value + phase) * 2 * Math.PI) * 0.04 : 0;
    // Rimozione come nell'originale (`.tile.gone`): scala 0,6 e rotazione di 8° in 120 ms, dissolvenza in 250 ms.
    const qt = removing ? Math.min(1, rm.value / 0.48) : 0;
    const et = 1 - (1 - qt) * (1 - qt);
    return [{ translateY: (1 - p) * -40 }, { scale: (1 + amp) * (1 - 0.4 * et) }, { rotate: (et * 8 * Math.PI) / 180 }];
  });
  const opacity = useDerivedValue(() => Math.min(1, Math.max(0, (entrance.value - delay) / 0.25)) * (removing ? (1 - rm.value) * (1 - rm.value) : 1));

  const box = designBox(x, y, w, h);

  return (
    <Group transform={transform} origin={vec(x + w / 2, y + h / 2)} opacity={opacity}>
      {body ? (
        <Group transform={[{ translateX: x - BODY_PAD }, { translateY: y - BODY_PAD }]}>
          <Image image={body} x={0} y={0} width={w + 2 * BODY_PAD} height={h + 2 * BODY_PAD} fit="fill" />
        </Group>
      ) : (
        <TileBody x={x} y={y} w={w} h={h} radius={radius} shadow={shadow} />
      )}
      <SvgAt svg={svg} x={box.x} y={box.y} width={box.width} height={box.height} />
      {selected ? <RoundedRect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} r={radius} style="stroke" strokeWidth={3} color={PALETTE[2]} /> : null}
    </Group>
  );
});

export type BoardProps = {
  tiles: readonly Tile[];
  svgs: (SkSVG | null)[];
  width: number;
  height: number;
  animate: boolean;
  shadow: boolean;
  entranceKey: number;
  selected: number | null;
  /** `true`: il corpo delle tessere è un'immagine disegnata una volta sola (ombra e sfumatura non si ricalcolano a ogni fotogramma). */
  cache: boolean;
  /** `true`: proprietà stabili tra un render e l'altro (sprite memorizzati). `false`: riproduce il comportamento della prima versione, per il confronto. */
  stable: boolean;
  /** Indici delle tessere che oscillano con «Anima»; `null` = tutte. */
  animatedSet: ReadonlySet<number> | null;
  onTap: (index: number | null, metrics: Metrics) => void;
};

/** Tavola in un unico canvas Skia; il tocco si risolve con `hitTest` del dominio, non con viste per tessera. */
export function TileBoard({ tiles, svgs, width, height, animate, shadow, entranceKey, selected, stable, cache, animatedSet, onTap }: BoardProps) {
  const metrics = useMemo(() => boardMetrics(tiles, width, height), [tiles, width, height]);
  const order = useMemo(() => drawOrder(tiles), [tiles]);
  const rects = useMemo(() => tiles.map((t) => tileRect(metrics, t)), [tiles, metrics]);
  const pulse = useSharedValue(0);
  const entrance = useSharedValue(1);
  const rm = useSharedValue(0);
  const maxDelay = useMemo(() => Math.max(...tiles.map((t) => t.z * 0.12 + t.y * 0.03 + t.x * 0.02)) || 1, [tiles]);

  useEffect(() => {
    if (animate) {
      pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    } else {
      pulse.value = 0;
    }
  }, [animate, pulse]);

  useEffect(() => {
    if (entranceKey === 0) return;
    entrance.value = 0;
    entrance.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) });
  }, [entranceKey, entrance]);

  const radius = Math.max(4, metrics.tw * 0.14);
  const body = useBodyImage(cache, metrics.tw - 3, metrics.th - 3, radius, shadow);
  // Il gesto si crea una sola volta e legge sempre i dati più recenti da un ref.
  const latest = useRef({ tiles, metrics, order, onTap });
  latest.current = { tiles, metrics, order, onTap };
  const stableTap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
          const l = latest.current;
          l.onTap(hitTest(l.tiles, l.metrics, e.x, e.y, 0, l.order), l.metrics);
        }),
    [],
  );
  const freshTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => onTap(hitTest(tiles, metrics, e.x, e.y, 0, order), metrics));
  const tap = stable ? stableTap : freshTap;

  return (
    <GestureDetector gesture={tap}>
      <Canvas style={{ width, height }}>
        {order.map((i, k) => (
          <TileSprite
            key={i}
            rect={stable ? rects[i] : tileRect(metrics, tiles[i])}
            radius={radius}
            svg={svgs[tiles[i].type] ?? null}
            body={body}
            phase={k / order.length}
            delay={((tiles[i].z * 0.12 + tiles[i].y * 0.03 + tiles[i].x * 0.02) / maxDelay) * 0.5}
            pulse={pulse}
            entrance={entrance}
            selected={selected === i}
            shadow={shadow}
            bob={animatedSet === null || animatedSet.has(i)}
            rm={rm}
            removing={false}
          />
        ))}
      </Canvas>
    </GestureDetector>
  );
}
