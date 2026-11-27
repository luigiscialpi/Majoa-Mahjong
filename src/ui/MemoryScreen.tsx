import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginPuzzle, finishPuzzle, leavePuzzle, type PuzzleFinished } from '../application/puzzleFlow';
import type { SaveStore } from '../application/saveStore';
import { MEMORY_HINT_MS, MEMORY_LAYOUTS, MEMORY_MISMATCH_MS, canRefundMemory, createMemory, flipCard, hintMemory, isFaceUp, isMemoryWon, memoryPairs, memoryStars, settle, type MemoryState } from '../domain/memoryPuzzle';
import type { Progress } from '../domain/progress';
import type { PuzzleDifficulty } from '../domain/puzzles';
import { levelPalette } from '../infrastructure/content/legacyThemes';
import { ANIMAL_DESIGNS } from '../infrastructure/content/puzzleAnimals';
import { useTranslation } from '../infrastructure/i18n';
import { Button } from './Button';
import { FeltBackground } from './FeltBackground';
import { GiftDialog } from './GiftDialog';
import { MiniTile } from './miniTiles';
import { useTileSvgs } from './svgs';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

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

type Phase = 'starting' | 'playing' | 'no-coins' | 'failed';

/** Memory: paga la ✨ all'avvio, gioca con le regole di `memoryPuzzle.ts` e a fine partita scrive stelle e ✨. */
export function MemoryScreen({ difficulty, store, progress, onProgress, onExit, seed }: MemoryScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const svgs = useTileSvgs();
  const palette = levelPalette(1);
  const [game, setGame] = useState<MemoryState>(() => createMemory(difficulty, ANIMAL_DESIGNS, seed ?? Math.floor(Math.random() * 2 ** 31)));
  const [phase, setPhase] = useState<Phase>('starting');
  const [current, setCurrent] = useState(progress);
  const [result, setResult] = useState<PuzzleFinished | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const begun = useRef(false);
  const finished = useRef(false);
  const left = useRef(false);

  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    beginPuzzle(store, progress).then((start) => {
      if (start.kind === 'started') {
        setCurrent(start.progress);
        onProgress(start.progress);
      }
      setPhase(start.kind === 'started' ? 'playing' : start.kind);
    });
  }, [store, progress, onProgress]);

  useEffect(() => {
    if (game.lock === 'none') return;
    const timer = setTimeout(() => setGame((g) => settle(g)), game.lock === 'mismatch' ? MEMORY_MISMATCH_MS : MEMORY_HINT_MS);
    return () => clearTimeout(timer);
  }, [game.lock]);

  const won = isMemoryWon(game);
  useEffect(() => {
    if (!won || phase !== 'playing' || finished.current) return;
    finished.current = true;
    const timer = setTimeout(() => {
      finishPuzzle(store, current, 'memory', difficulty, memoryStars(game.attempts, memoryPairs(difficulty)), game.hintsUsed > 0).then((done) => {
        setCurrent(done.progress);
        onProgress(done.progress);
        setResult(done);
      });
    }, WIN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won, phase, store, current, difficulty, game.attempts, game.hintsUsed, onProgress]);

  const exit = useCallback(async () => {
    if (left.current) return;
    left.current = true;
    if (phase === 'playing' && canRefundMemory(game)) {
      const refunded = await leavePuzzle(store, current);
      if (refunded.ok) onProgress(refunded.value);
    }
    onExit();
  }, [phase, game, store, current, onProgress, onExit]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void exit();
      return true;
    });
    return () => subscription.remove();
  }, [exit]);

  const hint = () => {
    const next = hintMemory(game);
    if (next) {
      setGame(next);
      setNote(t('aidMemory'));
    } else if (game.hintsUsed >= 3) setNote(t('aidNone'));
  };

  const { columns, rows } = MEMORY_LAYOUTS[difficulty];
  const cardW = Math.floor((width - 2 * SIDE - GAP * (columns - 1)) / columns);
  const cardH = Math.round(cardW * CARD_RATIO);

  if (phase === 'no-coins' || phase === 'failed') {
    return (
      <FeltBackground testID="memory-bg">
        <View style={[styles.notice, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.noticeText} testID="memory-notice">{phase === 'no-coins' ? t('pzNoCoins') : t('progressReadErrorTitle')}</Text>
          <Button label={t('backToGames')} onPress={onExit} kind="primary" testID="memory-notice-exit" />
        </View>
      </FeltBackground>
    );
  }

  const cardNames = (i: number) => t('pzCard', { n: i + 1 });
  return (
    <FeltBackground testID="memory-bg">
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => void exit()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('backToGames')} testID="memory-back">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">{t('pz_memory')}</Text>
          <Text style={styles.coins} testID="memory-coins">✨ {current.coins}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.info} testID="memory-attempts">{t('pzInfoMem', { n: game.attempts })}</Text>
          <Button label={t('aidBtn', { n: Math.max(0, 3 - game.hintsUsed) })} onPress={hint} disabled={phase !== 'playing'} testID="memory-hint" />
        </View>
        {note ? <Text style={styles.note} testID="memory-note">{game.hintsUsed > 0 ? `${note} · ${t('aidCap')}` : note}</Text> : null}
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
                    accessibilityLabel={cardNames(i)}
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
      </View>
      {result ? (
        <GiftDialog
          title={t('pzWinTitle')}
          body={`${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}\n${result.coins > 0 ? t('pzWinFirst', { n: result.coins }) : t('pzWinAgain')}`}
          onClose={() => void exit()}
          testID="memory-win"
        />
      ) : null}
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SIDE },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.ink, marginTop: -2 },
  title: { flex: 1, fontFamily: fontFamilies.title, fontSize: 22, color: colors.ink },
  coins: { fontFamily: fontFamilies.bodyBold, fontSize: 16, color: colors.ink },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  info: { fontFamily: fontFamilies.bodyBold, fontSize: 16, color: colors.ink },
  note: { fontFamily: fontFamilies.body, fontSize: 14, color: colors.inkSoft, marginBottom: 8 },
  grid: { gap: GAP, paddingBottom: 16 },
  row: { flexDirection: 'row', gap: GAP, justifyContent: 'center' },
  card: { borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardDown: { backgroundColor: colors.panel, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  cardUp: { backgroundColor: '#fbf6e6' },
  cardDone: { opacity: 0.9 },
  cardBack: { fontFamily: fontFamilies.title, fontSize: 28, color: colors.accent },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  noticeText: { fontFamily: fontFamilies.body, fontSize: 17, color: colors.ink, textAlign: 'center' },
});
