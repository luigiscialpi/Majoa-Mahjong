import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { PuzzleDifficulty, PuzzleId } from '../../domain/puzzles';
import { useTranslation } from '../../infrastructure/i18n';
import { GamesScreen } from '../../ui/GamesScreen';
import { useSaves } from '../../ui/SaveProvider';
import { TabScreen } from '../../ui/TabScreen';

/** Scheda Giochi della barra in basso. Un rompicapo giocabile apre la sua rotta `/puzzle`. */
export default function GamesRoute() {
  const router = useRouter();
  const { home } = useSaves();
  const { t } = useTranslation();
  if (!home.progress.ok) {
    return (
      <TabScreen>
        <View style={styles.missing}>
          <Text style={styles.missingText}>{t('progressReadErrorTitle')}</Text>
        </View>
      </TabScreen>
    );
  }
  const play = (id: PuzzleId, difficulty: PuzzleDifficulty) => router.push({ pathname: '/puzzle', params: { id, difficulty } });
  return (
    <TabScreen>
      <GamesScreen progress={home.progress.value} onPlay={play} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  missingText: { fontSize: 16, color: '#111111' },
});
