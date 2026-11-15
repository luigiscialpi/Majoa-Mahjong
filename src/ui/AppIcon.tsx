import { Image, StyleSheet, Text, View } from 'react-native';
import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

export type AppIconName = 'help' | 'shuffle' | 'undo' | 'lock';

const ICON_PATHS = {
  undo: Skia.Path.MakeFromSVGString('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H13')!,
  shuffle: Skia.Path.MakeFromSVGString('M3 6h2.5a4 4 0 0 1 3.2 1.6l6.6 8.8a4 4 0 0 0 3.2 1.6H21m-4-4 4 4-4 4M3 18h2.5a4 4 0 0 0 3.2-1.6l6.6-8.8A4 4 0 0 1 18.5 6H21m-4-4 4 4-4 4')!,
};

const iconCache = new Map<string, string>();

/**
 * Genera l'immagine PNG dell'icona una volta sola fuori schermo e la restituisce come data URI.
 * Evita di montare un <Canvas> Skia (TextureView hardware Vulkan) permanente nella barra dei comandi
 * per ogni singola icona statica da 24 dp (docs/rendering.md).
 */
function getIconUri(name: 'undo' | 'shuffle', size: number, color: string): string | null {
  const key = `${name}:${size}:${color}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  try {
    const scale = 2; // retina 2x per nitidezza perfetta
    const pxSize = Math.round(size * scale);
    const surface = Skia.Surface.MakeOffscreen(pxSize, pxSize);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(pxSize / 24, pxSize / 24);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(1.9);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setColor(Skia.Color(color));
    canvas.drawPath(ICON_PATHS[name], paint);
    surface.flush();
    const img = surface.makeImageSnapshot();
    const uri = `data:image/png;base64,${img.encodeToBase64(ImageFormat.PNG, 100)}`;
    iconCache.set(key, uri);
    return uri;
  } catch {
    return null;
  }
}

/** Piccolo set di icone monocromatiche per i controlli dell'interfaccia. */
export function AppIcon({ name, size = 24, color = colors.ink }: { name: AppIconName; size?: number; color?: string }) {
  if (name === 'help') {
    return (
      <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.helpCircle, { width: size * 0.82, height: size * 0.82, borderRadius: size, borderColor: color }]}>
          <Text allowFontScaling={false} style={{ color, fontFamily: fontFamilies.bodyBold, fontSize: size * 0.57, lineHeight: size * 0.67 }}>?</Text>
        </View>
      </View>
    );
  }

  if (name === 'lock') {
    return (
      <View style={[styles.lockBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.lockShackle, { width: size * 0.52, height: size * 0.44, borderColor: color }]} />
        <View style={[styles.lockBody, { width: size * 0.78, height: size * 0.52, borderColor: color }]} />
      </View>
    );
  }

  if (name === 'undo' || name === 'shuffle') {
    const uri = getIconUri(name, size, color);
    return (
      <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  helpCircle: { borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  lockBox: { alignItems: 'center', justifyContent: 'center' },
  lockShackle: { borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, marginBottom: -1 },
  lockBody: { borderWidth: 1.5, borderRadius: 2 },
});
