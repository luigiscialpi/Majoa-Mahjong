import { Pressable, StyleSheet, Text } from 'react-native';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` è l'azione consigliata (chiara, in rilievo); `plain` le altre. */
  kind?: 'primary' | 'plain';
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Pulsante dei messaggi sopra la partita: almeno 48 dp di altezza, feedback alla pressione, aspetto spento se disattivato. */
export function Button({ label, onPress, kind = 'plain', disabled = false, accessibilityLabel, testID }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, kind === 'primary' ? styles.primary : styles.plain, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Text style={[styles.text, kind === 'primary' ? styles.primaryText : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, minWidth: 96, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plain: { backgroundColor: 'rgba(255,255,255,0.2)' },
  primary: { backgroundColor: '#ffffff' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  text: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  primaryText: { color: '#1c1426' },
});
