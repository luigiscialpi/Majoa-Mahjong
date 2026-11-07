import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { colors as themeColors } from './theme/colors';

export type FeltBackgroundProps = {
  /** Colore centrale del feltro (chiaro, default theme.feltA). */
  colorA?: string;
  /** Colore periferico del feltro (scuro, default theme.feltB). */
  colorB?: string;
  /** Posizione verticale del centro in frazione dell'altezza (0..1, default 0.4 come riga 21 dell'originale). */
  cyRatio?: number;
  children?: ReactNode;
  testID?: string;
};

/**
 * Sfondo in feltro con gradiente radiale a due toni, fedele a `Majoa Mahjong.html` (righe 20-21 e 93):
 * `radial-gradient(ellipse at 50% 40%, var(--felt-a), var(--felt-b) 75%)`.
 *
 * Disegnato con Skia Canvas accelerato su GPU sotto i contenuti dell'interfaccia.
 */
export function FeltBackground({
  colorA = themeColors.feltA,
  colorB = themeColors.feltB,
  cyRatio = 0.4,
  children,
  testID,
}: FeltBackgroundProps) {
  const { width, height } = Dimensions.get('window');
  const radius = Math.max(width, height) * 0.75;
  const cx = width * 0.5;
  const cy = height * cyRatio;

  return (
    <View style={[styles.root, { backgroundColor: colorB }]} testID={testID}>
      {width > 0 && height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient c={vec(cx, cy)} r={radius} colors={[colorA, colorB]} />
          </Rect>
        </Canvas>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
