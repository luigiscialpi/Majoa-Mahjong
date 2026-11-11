import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, PaintStyle, Picture, PointMode, Skia, StrokeCap, createPicture, type SkColor, type SkPaint } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { FIREWORKS_COLORS, advanceClock, drawFireworks, makeShow, type FireworksEnums, type Show } from './fireworks';

// Fuochi d'artificio della vittoria (`startFx`, riga 2264 dell'originale) su un canvas Skia trasparente a tutta schermata,
// dietro la scheda. Stessa regola delle scintille (`SparkLayer`): un solo nodo `Picture` e un solo valore derivato, qualunque
// sia il numero di particelle; qui in più il disegno si rifà a 30 passi al secondo (`FPS`) e a lotti (`drawFireworks`).
// Lo spettacolo è finito: a fine animazione il canvas si smonta e non costa più nulla.

const ENUMS: FireworksEnums = { lines: PointMode.Lines, round: StrokeCap.Round, butt: StrokeCap.Butt };

type Pen = { paint: SkPaint; colors: SkColor[] };

/** Un solo pennello (tratto) e i colori dello spettacolo, creati una volta e condivisi con il thread UI. */
function buildPen(): Pen {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  return { paint, colors: FIREWORKS_COLORS.map((c) => Skia.Color(c)) };
}

function FireworksCanvas({ show }: { show: Show }) {
  const pen = useSharedValue(useMemo(buildPen, []));
  const clock = useSharedValue(0);
  const acc = useSharedValue(0);
  // L'orologio avanza a passi di `FRAME_MS`: il valore derivato (e con lui il disegno) cambia 30 volte al secondo.
  useFrameCallback((frame) => {
    const next = advanceClock(clock.value, acc.value, frame.timeSincePreviousFrame ?? 0);
    acc.value = next.accMs;
    if (next.clockMs !== clock.value) clock.value = next.clockMs;
  });
  const picture = useDerivedValue(() =>
    createPicture((canvas) => drawFireworks(canvas, pen.value.paint, pen.value.colors, ENUMS, show, clock.value), { width: show.width, height: show.height }),
  );
  return (
    <Canvas style={styles.canvas}>
      <Picture picture={picture} />
    </Canvas>
  );
}

/**
 * Fuochi della vittoria al livello `level`; `finale` per i livelli finali (più razzi, più a lungo); `reduced` con la riduzione
 * del movimento del sistema (meno scintille e niente coriandoli, come nell'originale). Si decide lo spettacolo alla prima
 * misura e non lo si rifà se la misura cambia.
 */
export function FireworksLayer({ level, finale, reduced }: { level: number; finale: boolean; reduced: boolean }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((current) => current ?? (width > 0 && height > 0 ? { width, height } : null));
  }, []);
  const show = useMemo(() => (size ? makeShow({ ...size, level, finale, reduced }, Math.random) : null), [size, level, finale, reduced]);
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setFinished(true), show.durationMs + 200);
    return () => clearTimeout(id);
  }, [show]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout} testID="fireworks">
      {show && !finished ? <FireworksCanvas show={show} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ canvas: { flex: 1 } });
