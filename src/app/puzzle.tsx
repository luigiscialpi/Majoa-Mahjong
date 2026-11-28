import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PUZZLE_DIFFICULTIES, type PuzzleDifficulty } from '../domain/puzzles';
import { useTranslation } from '../infrastructure/i18n';
import { MemoryScreen } from '../ui/MemoryScreen';
import { useSaves } from '../ui/SaveProvider';
import { SudokuScreen } from '../ui/SudokuScreen';

/**
 * Rotta di un rompicapo: `/puzzle?id=<memory|sudoku>&difficulty=<easy|medium|hard>`. Per ora ci sono Memory e Sudoku; gli
 * altri rompicapi si aggiungono con le loro patch.
 */
export default function Puzzle() {
  const params = useLocalSearchParams<{ id?: string; difficulty?: string }>();
  const router = useRouter();
  const { store, home, setProgress } = useSaves();
  const { t } = useTranslation();
  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const difficulty = PUZZLE_DIFFICULTIES.find((d): d is PuzzleDifficulty => d === params.difficulty);
  if ((params.id !== 'memory' && params.id !== 'sudoku') || !difficulty || !home.progress.ok) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{t(home.progress.ok ? 'levelNotFound' : 'progressReadErrorTitle')}</Text>
      </View>
    );
  }
  const Screen = params.id === 'sudoku' ? SudokuScreen : MemoryScreen;
  return <Screen difficulty={difficulty} store={store} progress={home.progress.value} onProgress={setProgress} onExit={exit} />;
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  missingText: { fontSize: 16, color: '#111111' },
});
