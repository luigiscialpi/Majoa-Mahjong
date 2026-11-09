import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SPARK_MAX_MS, SPARK_SIZE, heartPathD, sparkFrame, type Burst, type Particle, type SparkKind } from './effects';
import { Sparkle, starPathD } from './tile';

// Scintille degli abbinamenti (`sparkBurst`, riga 2082 dell'originale) su un canvas Skia trasparente sopra la tavola: lo
// strato fermo e quello vivo della tavola non si toccano (`docs/rendering.md`). Le forme sono vettoriali, non emoji.

const HALF = SPARK_SIZE / 2;
const STAR_D = starPathD(0, 0, HALF, HALF * 0.47);
const HEART_D = heartPathD(0, 0, HALF * 0.85);
const GOLD = '#ffc83d';
const GOLD_EDGE = '#d98e04';

function Glyph({ kind }: { kind: SparkKind }) {
  if (kind === 'sparkle') return <Sparkle x={0} y={0} size={SPARK_SIZE} />;
  const d = kind === 'star' ? STAR_D : HEART_D;
  return (
    <>
      <Path path={d} color={GOLD} />
      <Path path={d} style="stroke" strokeWidth={1} color={GOLD_EDGE} />
    </>
  );
}

/** Una scintilla: posizione, scala e opacità vengono dal tempo trascorso, condiviso da tutta l'esplosione. */
function SparkParticle({ x, y, particle, elapsed }: { x: number; y: number; particle: Particle; elapsed: SharedValue<number> }) {
  const transform = useDerivedValue(() => {
    const f = sparkFrame(particle, elapsed.value);
    return [{ translateX: x + f.x }, { translateY: y + f.y }, { scale: f.scale }];
  });
  const opacity = useDerivedValue(() => sparkFrame(particle, elapsed.value).opacity);
  return (
    <Group transform={transform} opacity={opacity}>
      <Glyph kind={particle.kind} />
    </Group>
  );
}

function BurstView({ burst }: { burst: Burst }) {
  const elapsed = useSharedValue(0);
  useEffect(() => {
    elapsed.value = withTiming(SPARK_MAX_MS, { duration: SPARK_MAX_MS, easing: Easing.linear });
  }, [elapsed]);
  return (
    <>
      {burst.particles.map((p, i) => (
        <SparkParticle key={i} x={burst.x} y={burst.y} particle={p} elapsed={elapsed} />
      ))}
    </>
  );
}

/** Canvas a tutta l'area di gioco, senza tocchi: li lascia alla tavola sotto. Si svuota da solo quando le esplosioni finiscono. */
export function SparkLayer({ bursts }: { bursts: readonly Burst[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={styles.canvas}>
        {bursts.map((b) => (
          <BurstView key={b.id} burst={b} />
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ canvas: { flex: 1 } });
