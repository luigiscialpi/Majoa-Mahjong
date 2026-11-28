import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PUZZLE_HINTS } from '../domain/puzzles';
import { useTranslation } from '../infrastructure/i18n';
import { Button } from './Button';
import { FeltBackground } from './FeltBackground';
import { GiftDialog } from './GiftDialog';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';
import type { PuzzleSession } from './usePuzzleSession';

export type PuzzleFrameProps = {
  /** Prefisso dei `testID` (`memory` dà `memory-back`, `memory-coins`, `memory-hint`, ...). */
  prefix: string;
  title: string;
  session: PuzzleSession;
  /** Riga di informazione (tentativi, errori) e il suo `testID`. */
  info: string;
  infoTestID: string;
  hintsUsed: number;
  onHint: () => void;
  /** Messaggio dell'aiuto; con un aiuto già usato si aggiunge il tetto delle 2 stelle. */
  note: string | null;
  children: ReactNode;
};

/**
 * La cornice comune dei rompicapi: testata con indietro, titolo e ✨, riga di informazione con l'aiuto, messaggio, il gioco
 * e l'esito. Senza ✨ o con la scrittura fallita mostra l'avviso al posto del gioco.
 */
export function PuzzleFrame({ prefix, title, session, info, infoTestID, hintsUsed, onHint, note, children }: PuzzleFrameProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { phase, result } = session;

  if (phase === 'no-coins' || phase === 'failed') {
    return (
      <FeltBackground testID={`${prefix}-bg`}>
        <View style={[styles.notice, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.noticeText} testID={`${prefix}-notice`}>{phase === 'no-coins' ? t('pzNoCoins') : t('progressReadErrorTitle')}</Text>
          <Button label={t('backToGames')} onPress={() => void session.exit()} kind="primary" testID={`${prefix}-notice-exit`} />
        </View>
      </FeltBackground>
    );
  }

  return (
    <FeltBackground testID={`${prefix}-bg`}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => void session.exit()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('backToGames')} testID={`${prefix}-back`}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.coins} testID={`${prefix}-coins`}>{`✨ ${session.coins}`}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.info} testID={infoTestID}>{info}</Text>
          <Button label={t('aidBtn', { n: Math.max(0, PUZZLE_HINTS - hintsUsed) })} onPress={onHint} disabled={phase !== 'playing'} testID={`${prefix}-hint`} />
        </View>
        {note ? <Text style={styles.note} testID={`${prefix}-note`}>{hintsUsed > 0 ? `${note} · ${t('aidCap')}` : note}</Text> : null}
        {children}
      </View>
      {result ? (
        <GiftDialog
          title={t('pzWinTitle')}
          body={`${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}\n${result.coins > 0 ? t('pzWinFirst', { n: result.coins }) : t('pzWinAgain')}`}
          onClose={() => void session.exit()}
          testID={`${prefix}-win`}
        />
      ) : null}
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.ink, marginTop: -2 },
  title: { flex: 1, fontFamily: fontFamilies.title, fontSize: 22, color: colors.ink },
  coins: { fontFamily: fontFamilies.bodyBold, fontSize: 16, color: colors.ink },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  info: { fontFamily: fontFamilies.bodyBold, fontSize: 16, color: colors.ink },
  note: { fontFamily: fontFamilies.body, fontSize: 14, color: colors.inkSoft, marginBottom: 8 },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  noticeText: { fontFamily: fontFamilies.body, fontSize: 17, color: colors.ink, textAlign: 'center' },
});
