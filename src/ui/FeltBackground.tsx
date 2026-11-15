import { useMemo, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ImageFormat, Skia, TileMode } from '@shopify/react-native-skia';
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

const feltCache = new Map<string, string>();

/**
 * Genera l'immagine PNG del feltro fuori schermo una volta sola e la restituisce come data URI.
 * Evita di montare un <Canvas> Skia (TextureView hardware Vulkan da 1080×2340 a pieno schermo)
 * che consuma ~30 MB di buffer e costringe SurfaceFlinger a comporre continuamente un layer trasparente
 * sotto tutti gli elementi di gioco (docs/rendering.md).
 */
function getFeltUri(colorA: string, colorB: string, cyRatio: number): string | null {
  const key = `${colorA}:${colorB}:${cyRatio}`;
  const hit = feltCache.get(key);
  if (hit) return hit;
  try {
    // Dimensioni 270×585 (rapporto 1:2.166 standard smartphone):
    // il gradiente radiale è perfettamente continuo e con il filtro bilineare nativo della GPU
    // risulta identico alla risoluzione nativa, ma con codifica istantanea e minima memoria.
    const w = 270;
    const h = 585;
    const surface = Skia.Surface.MakeOffscreen(w, h);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    const cx = w * 0.5;
    const cy = h * cyRatio;
    const radius = Math.max(w, h) * 0.75;
    const shader = Skia.Shader.MakeRadialGradient(
      { x: cx, y: cy },
      radius,
      [Skia.Color(colorA), Skia.Color(colorB)],
      null,
      TileMode.Clamp,
    );
    const paint = Skia.Paint();
    paint.setShader(shader);
    canvas.drawRect({ x: 0, y: 0, width: w, height: h }, paint);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const uri = `data:image/png;base64,${img.encodeToBase64(ImageFormat.PNG, 90)}`;
    feltCache.set(key, uri);
    return uri;
  } catch {
    return null;
  }
}

/**
 * Sfondo in feltro con gradiente radiale a due toni, fedele a `Majoa Mahjong.html` (righe 20-21 e 93):
 * `radial-gradient(ellipse at 50% 40%, var(--felt-a), var(--felt-b) 75%)`.
 *
 * Disegnato come immagine statica rasterizzata fuori schermo una tantum, per non impegnare
 * un TextureView Vulkan permanente sotto la tavola.
 */
export function FeltBackground({
  colorA = themeColors.feltA,
  colorB = themeColors.feltB,
  cyRatio = 0.4,
  children,
  testID,
}: FeltBackgroundProps) {
  const uri = useMemo(() => getFeltUri(colorA, colorB, cyRatio), [colorA, colorB, cyRatio]);

  return (
    <View style={[styles.root, { backgroundColor: colorB }]} testID={testID}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
