import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { SaveStore } from '../application/saveStore';
import type { Progress } from '../domain/progress';
import { PUZZLE_HINTS, type PuzzleDifficulty } from '../domain/puzzles';
import { SUDOKU_ERROR_MS, SUDOKU_WIN_DELAY_MS, canRefundSudoku, createSudoku, hintSudoku, isSudokuWon, placeValue, selectCell, sudokuStars, type SudokuState } from '../domain/sudokuPuzzle';
import { levelPalette } from '../infrastructure/content/legacyThemes';
import { ANIMAL_DESIGNS } from '../infrastructure/content/puzzleAnimals';
import { useTranslation } from '../infrastructure/i18n';
import { MiniTile } from './miniTiles';
import { PuzzleFrame } from './PuzzleFrame';
import { useTileSvgs } from './svgs';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';
import { usePuzzleSession } from './usePuzzleSession';

const GAP = 6;
/** Spazio in più tra un quadrato 2×2 e l'altro. */
const SQUARE_GAP = 8;
const SIDE = 16;
/** Rapporto altezza/larghezza della casella: quello della faccia della miniatura (54/42). */
const CELL_RATIO = 54 / 42;
const PICK_W = 52;

export type SudokuScreenProps = {
  difficulty: PuzzleDifficulty;
  store: SaveStore;
  progress: Progress;
  /** Aggiorna i progressi in memoria dopo costo, rimborso o vittoria. */
  onProgress: (progress: Progress) => void;
  onExit: () => void;
  /** Seme della partita; assente: casuale. I test lo fissano. */
  seed?: number;
};

/** Sudoku degli animali: la partita con le regole di `sudokuPuzzle.ts` dentro la cornice comune dei rompicapi (`PuzzleFrame`). */
export function SudokuScreen({ difficulty, store, progress, onProgress, onExit, seed }: SudokuScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const svgs = useTileSvgs();
  const palette = levelPalette(1);
  const [game, setGame] = useState<SudokuState>(() => createSudoku(difficulty, ANIMAL_DESIGNS, seed ?? Math.floor(Math.random() * 2 ** 31)));
  const [note, setNote] = useState<string | null>(null);
  const [wrongCell, setWrongCell] = useState(-1);
  const session = usePuzzleSession({ id: 'sudoku', difficulty, store, progress, onProgress, onExit, canRefund: canRefundSudoku(game) });
  const { phase, finish } = session;
  const won = isSudokuWon(game);
  const playing = phase === 'playing' && !won;

  useEffect(() => {
    if (wrongCell < 0) return;
    const timer = setTimeout(() => setWrongCell(-1), SUDOKU_ERROR_MS);
    return () => clearTimeout(timer);
  }, [wrongCell]);

  useEffect(() => {
    if (!won || phase !== 'playing') return;
    const timer = setTimeout(() => finish(sudokuStars(game.errors), game.hintsUsed > 0), SUDOKU_WIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won, phase, finish, game.errors, game.hintsUsed]);

  const pick = (value: number) => {
    const next = placeValue(game, value);
    if (next === game) return;
    setGame(next);
    if (next.errors > game.errors) setWrongCell(game.selected);
  };

  const hint = () => {
    const next = hintSudoku(game);
    if (next) {
      setGame(next);
      setNote(t('aidSudoku'));
    } else if (game.hintsUsed >= PUZZLE_HINTS) setNote(t('aidNone'));
  };

  const cellW = Math.min(80, Math.floor((width - 2 * SIDE - 3 * GAP - SQUARE_GAP) / 4));
  const cellH = Math.round(cellW * CELL_RATIO);
  const pickH = Math.round(PICK_W * CELL_RATIO);

  return (
    <PuzzleFrame prefix="sudoku" title={t('pz_sudoku')} session={session} info={t('pzInfoSud', { n: game.errors })} infoTestID="sudoku-errors" hintsUsed={game.hintsUsed} onHint={hint} note={note}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.tip}>{t('pzTapCell')}</Text>
        <View style={styles.grid}>
          {Array.from({ length: 4 }, (_, row) => (
            <View key={row} style={[styles.row, row === 1 ? styles.squareBelow : null]}>
              {Array.from({ length: 4 }, (_, col) => {
                const i = row * 4 + col;
                const value = game.grid[i];
                const wrong = wrongCell === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setGame((g) => selectCell(g, i))}
                    disabled={!playing}
                    style={[styles.cell, { width: cellW, height: cellH }, col === 1 ? styles.squareRight : null, game.fixed[i] ? styles.cellFixed : null, game.selected === i ? styles.cellSelected : null, wrong ? styles.cellWrong : null]}
                    accessibilityRole="button"
                    accessibilityLabel={t('pzCell', { n: i + 1 })}
                    accessibilityState={{ selected: game.selected === i }}
                    accessibilityValue={wrong ? { text: t('pzWrong') } : undefined}
                    testID={`sudoku-cell-${i}`}
                  >
                    {value >= 0 ? <MiniTile slot={game.symbols[value]} svgs={svgs ?? []} palette={palette} width={cellW} height={cellH} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.picks}>
          {game.symbols.map((design, v) => (
            <Pressable key={v} onPress={() => pick(v)} disabled={!playing} style={[styles.pick, { width: PICK_W, height: pickH }]} accessibilityRole="button" accessibilityLabel={t('pzAnimal', { n: v + 1 })} testID={`sudoku-pick-${v}`}>
              <MiniTile slot={design} svgs={svgs ?? []} palette={palette} width={PICK_W} height={pickH} />
            </Pressable>
          ))}
          <Pressable onPress={() => pick(-1)} disabled={!playing} style={[styles.pick, styles.erase, { height: pickH }]} accessibilityRole="button" accessibilityLabel={t('pzErase')} testID="sudoku-erase">
            <Text style={styles.eraseText}>⌫</Text>
          </Pressable>
        </View>
      </ScrollView>
    </PuzzleFrame>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 16, paddingBottom: 16 },
  tip: { fontFamily: fontFamilies.body, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  grid: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  squareBelow: { marginBottom: SQUARE_GAP },
  squareRight: { marginRight: SQUARE_GAP },
  cell: { borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.panel, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  cellFixed: { backgroundColor: '#fbf6e6' },
  cellSelected: { borderColor: colors.accent, borderWidth: 3 },
  cellWrong: { backgroundColor: '#c0392b', borderColor: '#e74c3c' },
  picks: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  pick: { borderRadius: 9, overflow: 'hidden', backgroundColor: '#fbf6e6', alignItems: 'center', justifyContent: 'center' },
  erase: { width: PICK_W, backgroundColor: colors.panel },
  eraseText: { fontSize: 24, color: colors.ink },
});
