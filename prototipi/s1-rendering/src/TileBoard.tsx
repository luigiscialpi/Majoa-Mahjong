import { memo, useEffect, useMemo } from 'react';
import { Canvas, Group, LinearGradient, RoundedRect, Shadow, vec, type SkSVG } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { boardMetrics, drawOrder, hitTest, tileRect, type Metrics, type Tile } from './board';
import { SvgAt } from './SvgAt';

// Tavolozza del livello 20 dell'originale: [feltro chiaro, feltro scuro, accento, bordo, bordo scuro].
export const PALETTE = ['#e0742a', '#6a1f4a', '#fff1a8', '#f09a3a', '#8a3a1f'];

type SpriteProps = {
  tile: Tile;
  rect: { x: number; y: number; w: number; h: number };
  radius: number;
  svg: SkSVG | null;
  phase: number;
  delay: number;
  pulse: SharedValue<number>;
  entrance: SharedValue<number>;
  selected: boolean;
  shadow: boolean;
};

const TileSprite = memo(function TileSprite({ rect, radius, svg, phase, delay, pulse, entrance, selected, shadow }: SpriteProps) {
  const { x, y, w, h } = rect;
  const transform = useDerivedValue(() => {
    const p = Math.min(1, Math.max(0, (entrance.value - delay) / 0.5));
    const bob = Math.sin((pulse.value + phase) * 2 * Math.PI) * 0.04;
    return [{ translateY: (1 - p) * -40 }, { scale: 1 + bob }];
  });
  const opacity = useDerivedValue(() => Math.min(1, Math.max(0, (entrance.value - delay) / 0.25)));

  // Il disegno occupa l'area interna (padding 3px 4px dell'originale), «meet» e centrato.
  const iw = w - 8;
  const ih = h - 6;
  const scale = Math.min(iw / 60, ih / 80);
  const dw = 60 * scale;
  const dh = 80 * scale;

  return (
    <Group transform={transform} origin={vec(x + w / 2, y + h / 2)} opacity={opacity}>
      <RoundedRect x={x + 2} y={y + 3} width={w + 2} height={h + 2} r={radius + 1} color={PALETTE[4]} />
      <RoundedRect x={x + 3} y={y + 4} width={w} height={h} r={radius} color={PALETTE[3]}>
        {shadow ? <Shadow dx={4} dy={6} blur={5} color="rgba(0,0,0,0.45)" /> : null}
      </RoundedRect>
      <RoundedRect x={x} y={y} width={w} height={h} r={radius}>
        <LinearGradient start={vec(x, y)} end={vec(x + w, y + h)} colors={['#fffdf3', '#f6edd2', '#eadcb4']} positions={[0, 0.6, 1]} />
      </RoundedRect>
      <RoundedRect x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h - 1.5} r={radius} style="stroke" strokeWidth={1.5} color="rgba(120,95,40,0.35)" />
      <SvgAt svg={svg} x={x + 4 + (iw - dw) / 2} y={y + 3 + (ih - dh) / 2} width={dw} height={dh} />
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
  onTap: (index: number | null, metrics: Metrics) => void;
};

/** Tavola in un unico canvas Skia; il tocco si risolve con `hitTest` del dominio, non con viste per tessera. */
export function TileBoard({ tiles, svgs, width, height, animate, shadow, entranceKey, selected, onTap }: BoardProps) {
  const metrics = useMemo(() => boardMetrics(tiles, width, height), [tiles, width, height]);
  const order = useMemo(() => drawOrder(tiles), [tiles]);
  const pulse = useSharedValue(0);
  const entrance = useSharedValue(1);
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
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => onTap(hitTest(tiles, metrics, e.x, e.y, 0, order), metrics));

  return (
    <GestureDetector gesture={tap}>
      <Canvas style={{ width, height }}>
        {order.map((i, k) => (
          <TileSprite
            key={i}
            tile={tiles[i]}
            rect={tileRect(metrics, tiles[i])}
            radius={radius}
            svg={svgs[tiles[i].type] ?? null}
            phase={k / order.length}
            delay={((tiles[i].z * 0.12 + tiles[i].y * 0.03 + tiles[i].x * 0.02) / maxDelay) * 0.5}
            pulse={pulse}
            entrance={entrance}
            selected={selected === i}
            shadow={shadow}
          />
        ))}
      </Canvas>
    </GestureDetector>
  );
}
