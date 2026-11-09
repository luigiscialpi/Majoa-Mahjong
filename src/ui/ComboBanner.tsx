import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { COMBO_BANNER_MS, COMBO_BANNER_TOP, bannerFrame } from './effects';
import { fontFamilies } from './theme/typography';

// Scritta della combo (`#combo` e `.cmbox`, righe 269-273 dell'originale; animazione in `showCombo`, riga 2101).

export type ComboBannerProps = {
  text: string;
  /** Dal livello 3: scritta rosa invece che dorata (`.cmbox.hot`). */
  hot: boolean;
  /** Chiamata al termine dell'animazione. */
  onDone: () => void;
};

/**
 * ponytail: manca la mascotte accanto alla scritta (arriva con la tappa «Mascotte») e il bagliore dorato sfocato
 * (`0 0 18px`): su Android l'ombra sfocata a raggio libero richiede `elevation`. Se serve fedeltà si disegna con Skia.
 */
export function ComboBanner({ text, hot, onDone }: ComboBannerProps) {
  const elapsed = useSharedValue(0);
  const done = useRef(onDone);
  done.current = onDone;
  const finish = useCallback(() => done.current(), []);
  useEffect(() => {
    elapsed.value = withTiming(COMBO_BANNER_MS, { duration: COMBO_BANNER_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [elapsed, finish]);

  const style = useAnimatedStyle(() => {
    const f = bannerFrame(elapsed.value);
    return { opacity: f.opacity, transform: [{ translateY: f.translateY }, { scale: f.scale }] };
  });

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="combo-banner">
      <Animated.View style={style}>
        <View style={styles.shadow} testID="combo-shadow" />
        <View style={styles.box} testID="combo-box">
          <Text style={[styles.text, hot ? styles.textHot : null]}>{text}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: COMBO_BANNER_TOP, left: 0, right: 0, alignItems: 'center' },
  // Ombra piena `0 5px 0 rgba(0,0,0,.35)`: un secondo riquadro identico, spostato in basso.
  shadow: { position: 'absolute', top: 5, left: 0, right: 0, bottom: -5, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.35)' },
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(24,12,48,0.78)', borderWidth: 3, borderColor: '#ffe27a', borderRadius: 34, paddingVertical: 4, paddingHorizontal: 20 },
  text: { fontFamily: fontFamilies.title, fontSize: 28, color: '#ffe27a', textShadowColor: '#b8741a', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  textHot: { color: '#ff9ad5', textShadowColor: '#8a2a6a' },
});
