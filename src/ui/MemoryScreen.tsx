import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { SaveStore } from '../application/saveStore';
import { MEMORY_HINT_MS, MEMORY_LAYOUTS, MEMORY_MISMATCH_MS, canRefundMemory, createMemory, flipCard, hintMemory, isFaceUp, isMemoryWon, memoryPairs, memoryStars, settle, type MemoryState } from '../domain/memoryPuzzle';
import type { Progress } from '../domain/progress';
import { PUZZLE_HINTS, type PuzzleDifficulty } from '../domain/puzzles';
import { levelPalette } from '../infrastructure/content/legacyThemes';
import { ANIMAL_DESIGNS } from '../infrastructure/content/puzzleAnimals';
import { useTranslation } from '../infrastructure/i18n';
import { MiniTile } from './miniTiles';
import { PuzzleFrame } from './PuzzleFrame';
import { useTileSvgs } from './svgs';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';
import { usePuzzleSession } from './usePuzzleSession';

/** Dopo l'ultima coppia, prima dell'esito (`puzWin(st,700)` dell'originale). */
const WIN_DELAY_MS = 700;
const GAP = 8;
const SIDE = 16;
/** Rapporto altezza/larghezza della carta: quello della faccia della miniatura (54/42). */
const CARD_RATIO = 54 / 42;

export type MemoryScreenProps = {
  difficulty: PuzzleDifficulty;
  store: SaveStore;
  progress: Progress;
  /** Aggiorna i progressi in memoria dopo costo, rimborso o vittoria. */
  onProgress: (progress: Progress) => void;
  onExit: () => void;
  /** Seme della partita; assente: casuale. I test lo fissano. */
  seed?: number;
};

/** Memory: la partita con le regole di `memoryPuzzle.ts` dentro la cornice comune dei rompicapi (`PuzzleFrame`). */
export function MemoryScreen({ difficulty, store, progress, onProgress, onExit, seed }: MemoryScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const svgs = useTileSvgs();
  const palette = levelPalette(1);
  const [game, setGame] = useState<MemoryState>(() => createMemory(difficulty, ANIMAL_DESIGNS, seed ?? Math.floor(Math.random() * 2 ** 31)));
  const [note, setNote] = useState<string | null>(null);
  const session = usePuzzleSession({ id: 'memory', difficulty, store, progress, onProgress, onExit, canRefund: canRefundMemory(game) });
  const { phase, finish } = session;

  useEffect(() => {
    if (game.lock === 'none') return;
    const timer = setTimeout(() => setGame((g) => settle(g)), game.lock === 'mismatch' ? MEMORY_MISMATCH_MS : MEMORY_HINT_MS);
    return () => clearTimeout(timer);
  }, [game.lock]);

  const won = isMemoryWon(game);
  useEffect(() => {
    if (!won || phase !== 'playing') return;
    const timer = setTimeout(() => finish(memoryStars(game.attempts, memoryPairs(difficulty)), game.hintsUsed > 0), WIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won, phase, finish, difficulty, game.attempts, game.hintsUsed]);

  const hint = () => {
    const next = hintMemory(game);
    if (next) {
      setGame(next);
      setNote(t('aidMemory'));
    } else if (game.hintsUsed >= PUZZLE_HINTS) setNote(t('aidNone'));
  };

  const { columns, rows } = MEMORY_LAYOUTS[difficulty];
  const cardW = Math.floor((width - 2 * SIDE - GAP * (columns - 1)) / columns);
  const cardH = Math.round(cardW * CARD_RATIO);

  return (
    <PuzzleFrame prefix="memory" title={t('pz_memory')} session={session} info={t('pzInfoMem', { n: game.attempts })} infoTestID="memory-attempts" hintsUsed={game.hintsUsed} onHint={hint} note={note}>
      <ScrollView contentContainerStyle={styles.grid}>
        {Array.from({ length: rows }, (_, row) => (
          <View key={row} style={styles.row}>
            {Array.from({ length: columns }, (_, col) => {
              const i = row * columns + col;
              const up = isFaceUp(game, i);
              return (
                <Pressable
                  key={i}
                  onPress={() => setGame((g) => flipCard(g, i))}
                  disabled={phase !== 'playing'}
                  style={[styles.card, { width: cardW, height: cardH }, up ? styles.cardUp : styles.cardDown, game.matched[i] ? styles.cardDone : null]}
                  accessibilityRole="button"
                  accessibilityLabel={t('pzCard', { n: i + 1 })}
                  accessibilityState={{ selected: up }}
                  testID={`memory-card-${i}`}
                >
                  {up ? <MiniTile slot={game.cards[i]} svgs={svgs ?? []} palette={palette} width={cardW} height={cardH} /> : <Text style={styles.cardBack}>?</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </PuzzleFrame>
  );
}

const styles = StyleSheet.create({
  grid: { gap: GAP, paddingBottom: 16 },
  row: { flexDirection: 'row', gap: GAP, justifyContent: 'center' },
  card: { borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardDown: { backgroundColor: colors.panel, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  cardUp: { backgroundColor: '#fbf6e6' },
  cardDone: { opacity: 0.9 },
  cardBack: { fontFamily: fontFamilies.title, fontSize: 28, color: colors.accent },
});
