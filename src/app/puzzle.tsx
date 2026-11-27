import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PUZZLE_DIFFICULTIES, type PuzzleDifficulty } from '../domain/puzzles';
import { useTranslation } from '../infrastructure/i18n';
import { MemoryScreen } from '../ui/MemoryScreen';
import { useSaves } from '../ui/SaveProvider';

/**
 * Rotta di un rompicapo: `/puzzle?id=memory&difficulty=<easy|medium|hard>`. Per ora c'è solo Memory; gli altri rompicapi
 * si aggiungono con le loro patch.
 */
export default function Puzzle() {
  const params = useLocalSearchParams<{ id?: string; difficulty?: string }>();
  const router = useRouter();
  const { store, home, setProgress } = useSaves();
  const { t } = useTranslation();
  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const difficulty = PUZZLE_DIFFICULTIES.find((d): d is PuzzleDifficulty => d === params.difficulty);
  if (params.id !== 'memory' || !difficulty || !home.progress.ok) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{t(home.progress.ok ? 'levelNotFound' : 'progressReadErrorTitle')}</Text>
      </View>
    );
  }
  return <MemoryScreen difficulty={difficulty} store={store} progress={home.progress.value} onProgress={setProgress} onExit={exit} />;
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  missingText: { fontSize: 16, color: '#111111' },
});
