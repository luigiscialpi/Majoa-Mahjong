import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, PaintStyle, Picture, Skia, createPicture, type SkPaint, type SkPath } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { SPARK_MAX_MS, SPARK_SIZE, drawSparks, heartPathD, sparklePathsD, type Burst, type GlyphLayer, type SparkKind } from './effects';
import { starPathD } from './tile';

// Scintille degli abbinamenti (`sparkBurst`, riga 2082 dell'originale) su un canvas Skia trasparente sopra la tavola: lo
// strato fermo e quello vivo della tavola non si toccano (`docs/rendering.md`). Le forme sono vettoriali, non emoji.
//
// Costo: ogni esplosione è UN solo nodo `Picture` con UN solo valore derivato, qualunque sia il numero di scintille (4-13,
// 12 per tessera d'oro). Un nodo e due valori derivati per scintilla (come `RemovingTile`) avrebbero fatto fino a 37 gruppi e
// 74 valori derivati al momento dell'abbinamento, che è già il più carico della partita: è lo schema che ha dato il
// «singhiozzo» dell'ingresso (`TileWaveGroup`). Così sono al massimo 3 valori derivati per abbinamento.

const HALF = SPARK_SIZE / 2;
const GOLD = '#ffc83d';
const GOLD_EDGE = '#d98e04';
const [SPARKLE_A, SPARKLE_B] = sparklePathsD(0, 0, SPARK_SIZE);
const STAR_D = starPathD(0, 0, HALF, HALF * 0.47);
const HEART_D = heartPathD(0, 0, HALF * 0.85);

/** Strati di ogni forma, solo dati: la scintilla ha due stelle piene; stella e cuore un riempimento e un contorno. */
const GLYPHS: Record<SparkKind, readonly GlyphLayer[]> = {
  sparkle: [
    { d: SPARKLE_A, color: '#ffe040' },
    { d: SPARKLE_B, color: '#fff9c4' },
  ],
  star: [
    { d: STAR_D, color: GOLD },
    { d: STAR_D, color: GOLD_EDGE, stroke: 1 },
  ],
  heart: [
    { d: HEART_D, color: GOLD },
    { d: HEART_D, color: GOLD_EDGE, stroke: 1 },
  ],
};

type Layer = { path: SkPath; paint: SkPaint };

/**
 * Gli oggetti di Skia sono dati condivisi con i worklet UI. `usePathValue` di Skia usa lo stesso schema per i path.
 */
function buildGlyphs(): Record<SparkKind, Layer[]> {
  const make = (layer: GlyphLayer): Layer => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(layer.color));
    if (layer.stroke) {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(layer.stroke);
    }
    return { path: Skia.Path.MakeFromSVGString(layer.d)!, paint };
  };
  return { sparkle: GLYPHS.sparkle.map(make), star: GLYPHS.star.map(make), heart: GLYPHS.heart.map(make) };
}

/** Un'esplosione: un solo disegno rifatto a ogni fotogramma dal tempo trascorso. */
function BurstView({ burst, glyphs, width, height }: { burst: Burst; glyphs: SharedValue<Record<SparkKind, Layer[]>>; width: number; height: number }) {
  const elapsed = useSharedValue(0);
  useEffect(() => {
    elapsed.value = withTiming(SPARK_MAX_MS, { duration: SPARK_MAX_MS, easing: Easing.linear });
  }, [elapsed]);
  const picture = useDerivedValue(() =>
    createPicture((canvas) => drawSparks(canvas, glyphs.value, burst, elapsed.value), { width, height }),
  );
  return <Picture picture={picture} />;
}

/** Un solo set di tracciati e pennelli per tutte le esplosioni presenti nel canvas. */
function SparkCanvas({ bursts, width, height }: { bursts: readonly Burst[]; width: number; height: number }) {
  // ponytail: il set condiviso elimina sei path SVG e sei paint ricreati a ogni frame e per ogni esplosione.
  const glyphs = useSharedValue(useMemo(buildGlyphs, []));

  return (
    <Canvas style={styles.canvas}>
      {bursts.map((b) => (
        <BurstView key={b.id} burst={b} glyphs={glyphs} width={width} height={height} />
      ))}
    </Canvas>
  );
}

/** Canvas a tutta l'area di gioco, senza tocchi: li lascia alla tavola sotto. Si svuota da solo quando le esplosioni finiscono. */
export function SparkLayer({ bursts, width, height }: { bursts: readonly Burst[]; width: number; height: number }) {
  // ponytail: senza esplosioni evita un layer GL a tutta tavola che non disegna nulla.
  if (bursts.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SparkCanvas bursts={bursts} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({ canvas: { flex: 1 } });
