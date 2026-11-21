import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../infrastructure/i18n';
import type { IntroEntry } from '../infrastructure/i18n/types';
import { ConfirmDialog } from './ConfirmDialog';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

/**
 * La spiegazione di un tipo di livello, prima di iniziarlo, con la spunta «Non mostrare più». La spunta parte spenta a ogni
 * apertura: finché non la si mette, la spiegazione torna a ogni livello di quel tipo. Il tasto indietro di Android chiude la
 * finestra senza iniziare.
 */
export function IntroDialog({ entry, onPlay, onDismiss }: { entry: IntroEntry; onPlay: (dontShowAgain: boolean) => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const [dontShow, setDontShow] = useState(false);
  return (
    <ConfirmDialog
      title={entry.t}
      body={entry.l.join('\n\n')}
      onDismiss={onDismiss}
      testID="intro-dialog"
      actions={[{ label: t('introPlay'), primary: true, testID: 'btn-intro-play', onPress: () => onPlay(dontShow) }]}
    >
      <Pressable
        onPress={() => setDontShow((v) => !v)}
        style={styles.row}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: dontShow }}
        accessibilityLabel={t('introDontShow')}
        testID="intro-dont-show"
      >
        <View style={[styles.box, dontShow ? styles.boxOn : null]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {dontShow ? <View style={styles.check} testID="intro-check" /> : null}
        </View>
        <Text style={styles.label}>{t('introDontShow')}</Text>
      </Pressable>
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  check: { width: 8, height: 14, marginTop: -3, borderRightWidth: 3, borderBottomWidth: 3, borderColor: colors.feltB, transform: [{ rotate: '45deg' }] },
  label: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 20, fontFamily: fontFamilies.body },
});
