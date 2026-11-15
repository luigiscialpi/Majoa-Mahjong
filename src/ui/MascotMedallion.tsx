import { Image, StyleSheet, View } from 'react-native';

/** Fondo del medaglione (`.cmbox .mcv`, riga 271 dell'originale): crema, tondo. */
export const MEDALLION_COLOR = '#fff7dd';

/**
 * La mascotte nel suo medaglione tondo e crema, ritagliata a cerchio come nell'originale (un `<svg>` con `border-radius: 50%`).
 * Decorativa: nascosta ai lettori di schermo. `uri` è l'immagine di `useMascotUri`.
 */
export function MascotMedallion({ uri, size }: { uri: string; size: number }) {
  return (
    <View style={[styles.medallion, { width: size, height: size, borderRadius: size / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="mascot-medallion">
      <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({ medallion: { backgroundColor: MEDALLION_COLOR, overflow: 'hidden' } });
