import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Progress } from '../domain/progress';
import { PUZZLE_COST, PUZZLE_DIFFICULTIES, PUZZLE_IDS, puzzleKey, type PuzzleDifficulty, type PuzzleId } from '../domain/puzzles';
import { useTranslation } from '../infrastructure/i18n';
import { FeltBackground } from './FeltBackground';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

/** Nome di ogni rompicapo nel dizionario (le chiavi dell'originale). */
const PUZZLE_NAME = {
  memory: 'pz_memory',
  missingPiece: 'pz_missing',
  sudoku: 'pz_sudoku',
  sliding: 'pz_slide',
  maze: 'pz_maze',
  differences: 'pz_diff',
  jars: 'pz_jars',
  links: 'pz_pairs',
  wordSearch: 'pz_words',
  dots: 'pz_dots',
} as const satisfies Record<PuzzleId, string>;

/** I rompicapi già giocabili, nell'ordine dell'elenco. Gli altri dicono «In arrivo». */
const PLAYABLE: readonly PuzzleId[] = ['memory', 'sudoku'];

const DIFFICULTY_LABEL = { easy: 'dif_easy', medium: 'dif_medium', hard: 'dif_hard' } as const satisfies Record<PuzzleDifficulty, string>;

/** ★ per le stelle migliori (0 = mai vinto): sempre tre simboli, così le righe restano allineate. */
export function starsText(stars: number): string {
  return `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
}

export type GamesScreenProps = {
  progress: Progress;
  /** Avvia un rompicapo giocabile (`PLAYABLE`). Solo i rompicapi già pronti lo chiamano. */
  onPlay: (id: PuzzleId, difficulty: PuzzleDifficulty) => void;
};

/** Scheda Giochi: ✨ in testa, i rompicapi giocabili con le tre difficoltà e le loro stelle, gli altri in arrivo. */
export function GamesScreen({ progress, onPlay }: GamesScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Stessa regola di `startPuzzle`: senza la ✨ per iniziare il rompicapo è grigio, e chi lo tocca non parte.
  const canStart = progress.coins >= PUZZLE_COST;

  return (
    <FeltBackground testID="games-bg">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{t('tabGames')}</Text>
          <Text style={styles.coins} testID="games-coins">{`✨ ${progress.coins}`}</Text>
        </View>

        {PUZZLE_IDS.map((id) => {
          if (!PLAYABLE.includes(id)) {
            return (
              <View key={id} style={[styles.row, styles.rowOff]} testID={`games-row-${id}`}>
                <Text style={styles.nameOff}>{t(PUZZLE_NAME[id])}</Text>
                <Text style={styles.soon}>{t('puzzleSoon')}</Text>
              </View>
            );
          }
          return (
            <View key={id} style={styles.row} testID={`games-row-${id}`}>
              <Text style={styles.name}>{t(PUZZLE_NAME[id])}</Text>
              <View style={styles.levels}>
                {PUZZLE_DIFFICULTIES.map((difficulty) => {
                  const stars = progress.puzzles[puzzleKey(id, difficulty)] ?? 0;
                  return (
                    <Pressable
                      key={difficulty}
                      onPress={() => onPlay(id, difficulty)}
                      disabled={!canStart}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(PUZZLE_NAME[id])} ${t(DIFFICULTY_LABEL[difficulty])}`}
                      style={[styles.level, !canStart && styles.levelOff]}
                      testID={`games-${id}-${difficulty}`}
                    >
                      <Text style={styles.levelName}>{t(DIFFICULTY_LABEL[difficulty])}</Text>
                      <Text style={styles.stars} testID={`games-${id}-${difficulty}-stars`}>{starsText(stars)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginBottom: 8 },
  title: { fontFamily: fontFamilies.title, fontSize: 26, color: colors.ink },
  coins: { fontFamily: fontFamilies.bodyBold, fontSize: 16, color: colors.ink },
  row: { backgroundColor: colors.panel, borderRadius: 14, padding: 14, gap: 10 },
  rowOff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 },
  name: { fontFamily: fontFamilies.bodyExtraBold, fontSize: 18, color: colors.ink },
  nameOff: { fontFamily: fontFamilies.bodyBold, fontSize: 16, color: colors.ink },
  soon: { fontFamily: fontFamilies.body, fontSize: 14, color: colors.inkSoft },
  levels: { flexDirection: 'row', gap: 8 },
  level: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  levelOff: { opacity: 0.35 },
  levelName: { fontFamily: fontFamilies.bodyBold, fontSize: 14, color: colors.ink },
  stars: { fontFamily: fontFamilies.body, fontSize: 13, color: colors.accent, marginTop: 4 },
});
