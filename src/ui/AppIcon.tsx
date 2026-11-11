import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

export type AppIconName = 'help' | 'shuffle' | 'undo' | 'lock';

const ICON_PATHS = {
  undo: Skia.Path.MakeFromSVGString('M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H13')!,
  shuffle: Skia.Path.MakeFromSVGString('M3 6h2.5a4 4 0 0 1 3.2 1.6l6.6 8.8a4 4 0 0 0 3.2 1.6H21m-4-4 4 4-4 4M3 18h2.5a4 4 0 0 0 3.2-1.6l6.6-8.8A4 4 0 0 1 18.5 6H21m-4-4 4 4-4 4')!,
};

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
    return (
      <View style={[styles.box, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Canvas style={{ width: size, height: size }}>
          <Path path={ICON_PATHS[name]} color={color} style="stroke" strokeWidth={1.9} strokeCap="round" strokeJoin="round" />
        </Canvas>
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
