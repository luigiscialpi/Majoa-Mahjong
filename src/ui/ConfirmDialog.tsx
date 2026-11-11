import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

export type DialogAction = { label: string; onPress: () => void; /** L'azione sicura e consigliata, in rilievo. */ primary?: boolean; disabled?: boolean; testID?: string };

/**
 * Finestra di conferma: dice cosa si perde, con pulsanti che nominano l'azione (mai «OK»), uno per riga, e la scelta sicura in
 * rilievo. Il tasto indietro di Android la chiude senza fare nulla (`onDismiss`).
 */
export function ConfirmDialog({ title, body, actions, onDismiss, testID }: { title: string; body: string; actions: readonly DialogAction[]; onDismiss: () => void; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View
        style={[
          styles.scrim,
          {
            paddingTop: Math.max(24, insets.top + 12),
            paddingBottom: Math.max(24, insets.bottom + 12),
            paddingLeft: Math.max(24, insets.left + 12),
            paddingRight: Math.max(24, insets.right + 12),
          },
        ]}
        testID={testID}
      >
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            {actions.map((a) => (
              <Button key={a.label} label={a.label} kind={a.primary ? 'primary' : 'plain'} disabled={a.disabled} onPress={a.onPress} testID={a.testID} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, backgroundColor: colors.feltB, borderWidth: 2, borderColor: colors.accent, padding: 22, gap: 12 },
  title: { color: colors.accent, fontSize: 22, fontFamily: fontFamilies.title },
  body: { color: colors.inkSoft, fontSize: 16, lineHeight: 22, fontFamily: fontFamilies.body },
  actions: { gap: 12, marginTop: 8 },
});
