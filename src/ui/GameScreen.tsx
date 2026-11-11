import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reduceRound, resumeRound, startRound, type Round } from '../application/round';
import { finaleOf } from '../application/finale';
import { createAutosaver, finishWin, prepareWin } from '../application/saveFlow';
import type { SaveError } from '../application/saveFormat';
import type { SaveStore } from '../application/saveStore';
import { goldCount, isStuck, type Session } from '../application/session';
import { gameColumn } from '../domain/board';
import type { GameState } from '../domain/gameState';
import type { Profile } from '../domain/profile';
import type { IslandInfo, Progress } from '../domain/progress';
import { blockersOf } from '../domain/geometry';
import { STAR_TYPE, type GenError, type Result } from '../domain/types';
import { legacyIslands, trisLevelIds } from '../infrastructure/content/legacyIslands';
import { designOf, levelPalette, type Palette } from '../infrastructure/content/legacyThemes';
import { toSpec, type LegacyLevel } from '../infrastructure/content/legacyLevels';
import { Button } from './Button';
import { ComboBanner } from './ComboBanner';
import { FireworksLayer } from './FireworksLayer';
import { SparkLayer } from './SparkLayer';
import { TileBoard } from './TileBoard';
import { goneTiles, newlyRemoved, tileStatuses } from './boardView';
import { aidText, formatTime, islandName, PROFILE_KEYS, starsText } from './format';
import { messageFor } from './messages';
import { useTileSvgs } from './svgs';
import { useAppActive } from './useAppActive';
import { useMatchEffects } from './useMatchEffects';
import { useReduceMotion } from './useReduceMotion';
import { FeltBackground } from './FeltBackground';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';
import { useTranslation } from '../infrastructure/i18n';
import type { SkSVG } from '@shopify/react-native-skia';
import { AppIcon, type AppIconName } from './AppIcon';

const REMOVE_MS = 250;
const RESCUE_DELAY_MS = 1100;
const NOTICE_MS = 2000;
const EMPTY: ReadonlySet<number> = new Set();

export type GameScreenProps = {
  level: LegacyLevel;
  profile: Profile;
  onExit: () => void;
  store: SaveStore;
  progress: Progress;
  /** Chiamata con i progressi nuovi quando una partita si vince. */
  onProgress: (progress: Progress) => void;
  /** Partita ricostruita da un salvataggio, da riprendere; senza, ne parte una nuova. */
  resume?: Session;
  islands?: readonly IslandInfo[];
};

/**
 * Schermata di gioco di un livello: carica i disegni, sceglie un seme nuovo a ogni partita e ricomincia a richiesta. La
 * partita si salva da sola (`docs/salvataggi.md`) e il tempo corre solo con l'app in primo piano.
 */
export function GameScreen({ level, profile, onExit, store, progress, onProgress, resume, islands = legacyIslands }: GameScreenProps) {
  const [attempt, setAttempt] = useState(0);
  const { t } = useTranslation();
  // Il seme è casuale a ogni partita (nell'originale non esiste seme); il dominio resta deterministico.
  const seed = useMemo(() => Math.floor(Math.random() * 2147483647), [attempt]);
  const started: Result<Round, GenError> = useMemo(() => (attempt === 0 && resume ? { ok: true, value: resumeRound(resume) } : startRound({ spec: toSpec(level), profile, seed })), [level, profile, seed, attempt, resume]);
  const svgs = useTileSvgs();
  const palette = levelPalette(level.id);

  if (!started.ok) return <Notice palette={palette} text={t('genError', { kind: started.error.kind })} onExit={onExit} />;
  if (!svgs) return <Notice palette={palette} text={t('loadingSvgs')} onExit={onExit} />;
  return (
    <RoundView
      key={attempt}
      level={level}
      profile={profile}
      palette={palette}
      svgs={svgs}
      initial={started.value}
      store={store}
      progress={progress}
      onProgress={onProgress}
      islands={islands}
      onRestart={() => setAttempt((a) => a + 1)}
      onExit={onExit}
    />
  );
}

function Notice({ palette, text, onExit }: { palette: Palette; text: string; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.root, { backgroundColor: palette[1], paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        <Text style={styles.noticeText}>{text}</Text>
        <Button label={t('levels')} onPress={onExit} />
      </View>
    </View>
  );
}

type RoundViewProps = {
  level: LegacyLevel;
  profile: Profile;
  palette: Palette;
  svgs: readonly (SkSVG | null)[];
  initial: Round;
  store: SaveStore;
  progress: Progress;
  onProgress: (progress: Progress) => void;
  islands: readonly IslandInfo[];
  onRestart: () => void;
  onExit: () => void;
};

/** La causa di un errore di salvataggio va nei log (`adb logcat`, tag ReactNativeJS): l'avviso a schermo non la mostra. */
const logSaveError = (error: SaveError) => console.warn(`Autosalvataggio non riuscito: ${JSON.stringify(error)}`);

function RoundView({ level, profile, palette, svgs, initial, store, progress, onProgress, islands, onRestart, onExit }: RoundViewProps) {
  const [round, dispatch] = useReducer(reduceRound, initial);
  const { session } = round;
  const game = session.game;
  const insets = useSafeAreaInsets();
  const { t: tl } = useTranslation();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [hintGroup, setHintGroup] = useState<readonly number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [trouble, setTrouble] = useState(false);
  const [progressNotSaved, setProgressNotSaved] = useState(false);
  const appActive = useAppActive();
  const autosaver = useMemo(() => createAutosaver(store, level.id, setTrouble, logSaveError), [store, level.id]);
  const progressAtStart = useRef(progress);
  // ponytail: calcola i premi prima dell'I/O, così la scheda appare già alla sua altezza finale.
  const victoryRewards = useMemo(() => {
    if (session.phase !== 'won' || !session.outcome) return null;
    return prepareWin(progressAtStart.current, session, level.id, islands).rewards;
  }, [session, level.id, islands]);

  // Tessere che si stanno togliendo (animazione di 250 ms). Si ricava durante il render, non in un effetto, perché le
  // tessere appena tolte non devono sparire per un fotogramma prima di comparire come «in rimozione».
  const [view, setView] = useState<{ game: GameState; removing: ReadonlySet<number>; key: number }>({ game, removing: EMPTY, key: 0 });
  if (view.game !== game) {
    const removing = newlyRemoved(view.game, game);
    setView({ game, removing, key: removing.size > 0 ? view.key + 1 : view.key });
  }
  useEffect(() => {
    if (view.removing.size === 0) return;
    const key = view.key;
    const id = setTimeout(() => setView((v) => (v.key === key ? { ...v, removing: EMPTY } : v)), REMOVE_MS + 40);
    return () => clearTimeout(id);
  }, [view.key, view.removing.size]);

  // Tempo di gioco: corre solo con l'app in primo piano.
  useEffect(() => {
    if (session.phase !== 'playing' || !appActive) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, [session.phase, appActive]);

  // Salvataggio automatico: a ogni azione che entra negli eventi (mossa, aiuto, annulla, rimescolo) e quando l'app va in
  // secondo piano, con il tempo trascorso. Non a partita vinta o bloccata: la chiusura è qui sotto.
  const savedEvents = useRef(initial.session.events);
  useEffect(() => {
    if (session.phase !== 'playing' || session.events === savedEvents.current) return;
    savedEvents.current = session.events;
    void autosaver.save(session);
  }, [session, autosaver]);
  useEffect(() => {
    if (appActive || session.phase !== 'playing') return;
    savedEvents.current = session.events;
    void autosaver.save(session);
  }, [appActive, session, autosaver]);

  // Fine partita, anche se la partita ricostruita era già finita: la vittoria registra i progressi e cancella la partita
  // salvata in un'unica scrittura; il blocco cancella la partita salvata.
  const closed = useRef(false);
  useEffect(() => {
    if (closed.current) return;
    if (session.phase === 'won') {
      closed.current = true;
      void finishWin(store, progress, session, level.id, islands).then((done) => {
        onProgress(done.progress);
        setProgressNotSaved(!done.saved.ok);
      });
    } else if (session.phase === 'dead') {
      closed.current = true;
      void store.clearGame();
    }
  }, [session.phase]); // eslint-disable-line react-hooks/exhaustive-deps -- si chiude una volta sola, con i valori di quando la fase cambia

  // Senza mosse: dopo un breve avviso parte il rimescolo automatico (o un consiglio, se i gratuiti sono finiti).
  const stuck = isStuck(session);
  useEffect(() => {
    if (!stuck) return;
    const id = setTimeout(() => dispatch({ type: 'rescue' }), RESCUE_DELAY_MS);
    return () => clearTimeout(id);
  }, [stuck, game]);

  // Avvisi e tessere suggerite: durano un paio di secondi e si azzerano a ogni nuova azione.
  useEffect(() => {
    const feedback = round.feedback;
    if (!feedback) return;
    setHintGroup(feedback.kind === 'hint' ? feedback.group : []);
    setNotice(messageFor(feedback));
    const id = setTimeout(() => {
      setHintGroup([]);
      setNotice(null);
    }, NOTICE_MS);
    return () => clearTimeout(id);
  }, [round.seq]);

  const designs = useMemo(() => game.tiles.map((t) => designOf(level.island, t.type)), [game.tiles, level.island]);
  const statuses = useMemo(() => tileStatuses(game), [game]);
  const free = useMemo(() => new Set(game.ft.freeList()), [game]);
  const gone = useMemo(() => goneTiles(game, view.removing), [game, view.removing]);

  // Tessere «uguale» alla selezionata: libere, con tipo uguale, esclusa la selezionata stessa.
  // CSS .tile.match (riga 1928 HTML): eqOn && fr && t.type === sel.type.
  const match = useMemo(() => {
    if (session.selected.length === 0) return [];
    const selType = game.tiles[session.selected[0]]?.type;
    if (selType === undefined) return [];
    const selSet = new Set(session.selected);
    return [...free].filter((i) => !selSet.has(i) && game.tiles[i].type === selType);
  }, [session.selected, game.tiles, free]);

  // Tessera rifiutata e relative tessere bloccanti (CSS .tile.blocker / .tile.target righe 2061-2078 HTML).
  const [rejected, setRejected] = useState<number | null>(null);
  const [blockers, setBlockers] = useState<readonly number[]>([]);
  useEffect(() => {
    const fb = round.feedback;
    if (fb?.kind === 'rejected') {
      const tapped = lastTapped.current;
      setRejected(tapped);
      if (tapped !== null && fb.reason === 'tile-blocked') {
        const { blockers: blkList, reason } = blockersOf(game.ft, tapped);
        setBlockers(blkList);
        if (reason === 'top') setNotice(tl('tBlockTop'));
        else if (reason === 'both') setNotice(tl('tBlockBoth'));
        else if (reason === 'sides') setNotice(tl('tBlockSides'));
        else setNotice(tl('tBlockedTile'));
      } else if (tapped !== null && fb.reason === 'locked') {
        setBlockers([]);
        const stars = game.tiles
          .map((t, idx) => (t.type === STAR_TYPE && game.ft.isFree(idx) ? idx : -1))
          .filter((idx) => idx >= 0);
        if (stars.length > 0) setHintGroup(stars);
        setNotice(tl('tLockedTile'));
      } else {
        setBlockers([]);
      }
      const id = setTimeout(() => {
        setBlockers([]);
      }, 2200);
      return () => clearTimeout(id);
    } else {
      setRejected(null);
      setBlockers([]);
    }
  }, [round.seq, game]);

  const lastTapped = useRef<number | null>(null);

  // Ingresso della tavola (CSS .board-in .tile riga 58 HTML): animazione tin a scaglioni all'avvio.
  const [boardIn, setBoardIn] = useState(true);
  const handleBoardInDone = useCallback(() => setBoardIn(false), []);
  useEffect(() => {
    setBoardIn(true);
    // Timeout di sicurezza fallback
    const id = setTimeout(() => setBoardIn(false), 2500);
    return () => clearTimeout(id);
  }, [level.id]);

  // Sblocco del gruppo nascosto (CSS .tile.unlock riga 66 HTML, 1000 ms).
  const [unlocking, setUnlocking] = useState<readonly number[]>([]);
  const prevUnlockedRef = useRef(game.unlocked);
  useEffect(() => {
    if (game.unlocked > prevUnlockedRef.current) {
      const newlyUnlocked = game.unlocked;
      const tilesToUnlock = game.tiles
        .map((t, idx) => (t.hiddenGroup === newlyUnlocked && !gone.has(idx) ? idx : -1))
        .filter((idx) => idx >= 0);
      if (tilesToUnlock.length > 0) {
        setUnlocking(tilesToUnlock);
        const id = setTimeout(() => setUnlocking([]), 1000);
        return () => clearTimeout(id);
      }
    }
    prevUnlockedRef.current = game.unlocked;
  }, [game.unlocked, game.tiles, gone]);

  // Diradamento della nebbia (CSS .tile.reveal riga 289 HTML, 700 ms quando la tessera diventa libera).
  const [revealing, setRevealing] = useState<readonly number[]>([]);
  const revealedFogRef = useRef<Set<number>>(new Set());
  const initialFogMountedRef = useRef(false);

  useEffect(() => {
    if (!initialFogMountedRef.current) {
      initialFogMountedRef.current = true;
      for (let i = 0; i < game.tiles.length; i++) {
        if (game.tiles[i].fog && game.ft.isFree(i)) {
          revealedFogRef.current.add(i);
        }
      }
      return;
    }

    const newlyRevealed: number[] = [];
    for (let i = 0; i < game.tiles.length; i++) {
      const t = game.tiles[i];
      const isLocked = t.hiddenGroup > game.unlocked;
      const isFree = game.ft.isFree(i);
      if (t.fog && !isLocked && isFree && !gone.has(i)) {
        if (!revealedFogRef.current.has(i)) {
          revealedFogRef.current.add(i);
          newlyRevealed.push(i);
        }
      } else if (t.fog && !isFree) {
        revealedFogRef.current.delete(i);
      }
    }

    if (newlyRevealed.length > 0) {
      setRevealing(newlyRevealed);
      const id = setTimeout(() => setRevealing([]), 700);
      return () => clearTimeout(id);
    }
  }, [game, gone]);

  const onLayout = useCallback((e: LayoutChangeEvent) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }), []);
  const onTap = useCallback((tile: number | null) => {
    if (tile !== null) {
      lastTapped.current = tile;
      dispatch({ type: 'tap', tile });
    }
  }, []);
  const column = gameColumn(area.width, area.height);
  const { got, total } = goldCount(session);

  // Scintille e scritta della combo a ogni abbinamento; spente con la riduzione del movimento del sistema.
  const fxOn = !useReduceMotion();
  const { bursts, banner, clearBanner } = useMatchEffects({ feedback: round.feedback, seq: round.seq, tiles: game.tiles, column, areaWidth: area.width, enabled: fxOn });

  return (
    <FeltBackground colorA={palette[0]} colorB={palette[1]} cyRatio={0.4} testID="game-felt-bg">
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.back} accessibilityRole="button" accessibilityLabel={tl('backToLevels')} testID="btn-back">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{tl('level', { n: level.id })}</Text>
            <Text style={styles.subtitle}>
              {tl(PROFILE_KEYS[profile])} · {game.remaining} {tl('pairs')}{total > 0 ? ` · ${tl('goldLbl', { a: got, b: total })}` : ''}
            </Text>
          </View>
          <Text style={[styles.time, { color: palette[2] }]} testID="timer">
            {formatTime(session.seconds)}
          </Text>
        </View>

        {trouble ? (
          <View style={styles.trouble} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="save-trouble">
            <Text style={styles.troubleText}>{tl('saveTrouble')}</Text>
          </View>
        ) : null}

        <View style={styles.boardArea} onLayout={onLayout} testID="board-area">
          {area.width > 0 ? (
            <View style={{ width: column.w, height: column.h, marginLeft: column.x }}>
              <TileBoard
                tiles={game.tiles}
                designs={designs}
                svgs={svgs}
                statuses={statuses}
                palette={palette}
                profile={profile}
                width={column.w}
                height={column.h}
                free={free}
                gone={gone}
                removing={view.removing}
                removeKey={view.key}
                selected={session.selected}
                hint={hintGroup}
                match={match}
                rejected={rejected}
                blockers={blockers}
                boardIn={boardIn}
                onBoardInDone={handleBoardInDone}
                unlocking={unlocking}
                revealing={revealing}
                onTap={onTap}
              />
            </View>
          ) : null}
          {fxOn && area.width > 0 ? <SparkLayer bursts={bursts} width={area.width} height={area.height} /> : null}
          {fxOn && banner ? <ComboBanner key={banner.key} text={tl(`cmb${banner.level}`)} hot={banner.level >= 3} onDone={() => clearBanner(banner.key)} /> : null}
          {notice ? (
            <View style={styles.noticeBox} pointerEvents="none">
              <Text style={styles.noticeBoxText}>{notice}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bar}>
          <AidButton label={tl('hint')} icon="help" left={session.left.hints} onPress={() => dispatch({ type: 'hint' })} testID="btn-hint" />
          <AidButton label={tl('undo')} icon="undo" left={session.left.undo} onPress={() => dispatch({ type: 'undo' })} testID="btn-undo" />
          <AidButton label={tl('shuffle')} icon="shuffle" left={session.left.shuffles} onPress={() => dispatch({ type: 'shuffle' })} testID="btn-shuffle" />
        </View>

        {session.phase === 'won' && session.outcome ? (
          <Overlay behind={<FireworksLayer level={level.id} finale={finaleOf(level.id, islands, trisLevelIds) !== null} reduced={!fxOn} />}>
            <Text style={styles.overlayTitle}>{tl('winLevelDone', { n: level.id })}</Text>
            <View style={styles.overlayStarsRow}>
              <Text style={[styles.overlayStars, { color: palette[2] }]}>{starsText(session.outcome.stars)}</Text>
              {victoryRewards && victoryRewards.coins > 0 ? <WinCoinReward coins={victoryRewards.coins} animated={fxOn} /> : null}
            </View>
            <Text style={styles.overlayLine}>{tl('winTime', { t: formatTime(session.outcome.seconds) })}</Text>
            {victoryRewards?.newRecord ? <Text style={styles.overlayRecord}>{tl('winNewRecord')}</Text> : null}
            <Text style={styles.overlayLine}>{tl('winAids', { n: session.outcome.aidsUsed })}</Text>
            {session.outcome.goldTotal > 0 ? <Text style={styles.overlayLine}>{tl('winGold', { a: session.outcome.gold, b: session.outcome.goldTotal })}</Text> : null}
            {victoryRewards?.gifts.map((island) => (
              <Text key={island.id} style={styles.overlayReward}>
                {tl('giftIsland', { name: islandName(island.id, tl), n: island.gift })}
              </Text>
            ))}
            {progressNotSaved ? <Text style={styles.overlayWarning}>{tl('progressSaveTrouble')}</Text> : null}
            <OverlayButtons onRestart={onRestart} onExit={onExit} restartLabel={tl('again')} />
          </Overlay>
        ) : null}
        {session.phase === 'dead' ? (
          <Overlay>
            <Text style={styles.overlayTitle}>{tl('deadTitle')}</Text>
            <Text style={styles.overlayLine}>{tl('deadText')}</Text>
            <OverlayButtons onRestart={onRestart} onExit={onExit} restartLabel={tl('deadRestart')} />
          </Overlay>
        ) : null}
      </View>
    </FeltBackground>
  );
}

function WinCoinReward({ coins, animated }: { coins: number; animated: boolean }) {
  const opacity = useSharedValue(animated ? 0 : 1);
  const translateY = useSharedValue(animated ? 7 : 0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!animated) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    opacity.value = withSequence(
      // Fade in
      withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.ease),
      }),

      // Rimane visibile
      withTiming(1, {
        duration: 1320,
      }),

      // Fade out
      withTiming(
        0,
        {
          duration: 500,
          easing: Easing.in(Easing.ease),
        },
        (finished) => {
          if (finished) runOnJS(setVisible)(false);
        },
      ),
    );

    translateY.value = withTiming(-8, {
      duration: 2000,
      easing: Easing.out(Easing.ease),
    });
  }, [animated, opacity, translateY]);
  
  const animation = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;
  return (
    <Animated.View style={[styles.overlayCoinRewardPosition, animation]} pointerEvents="none" testID="win-coins-reward">
      <Text numberOfLines={1} style={styles.overlayCoinText} accessibilityLiveRegion="polite">+{coins}</Text>
    </Animated.View>
  );
}

function AidButton({ label, icon, left, onPress, testID }: { label: string; icon: AppIconName; left: number | null; onPress: () => void; testID: string }) {
  const empty = left !== null && left <= 0;
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={[styles.aid, empty ? styles.aidEmpty : null]} accessibilityRole="button" accessibilityLabel={t('aidRemainingAria', { label, n: aidText(left) })} testID={testID}>
      <View style={styles.aidIcon}><AppIcon name={icon} /></View>
      <Text style={styles.aidLabel}>{label}</Text>
      <Text style={styles.aidCount}>{aidText(left)}</Text>
    </Pressable>
  );
}

/** `behind` sta tra lo sfondo scuro e la scheda (i fuochi d'artificio della vittoria). */
function Overlay({ children, behind }: { children: ReactNode; behind?: ReactNode }) {
  return (
    <View style={styles.overlay}>
      {behind}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function OverlayButtons({ onRestart, onExit, restartLabel }: { onRestart: () => void; onExit: () => void; restartLabel: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Button label={restartLabel} onPress={onRestart} testID="btn-restart" />
      <Button label={t('levels')} onPress={onExit} testID="btn-levels" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  noticeText: { color: colors.ink, fontSize: 16, textAlign: 'center', fontFamily: fontFamilies.bodyBold },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.ink, fontSize: 32, lineHeight: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: colors.ink, fontSize: 17, fontFamily: fontFamilies.title },
  subtitle: { color: colors.inkSoft, fontSize: 12, marginTop: 2, fontFamily: fontFamilies.body },
  time: { width: 64, textAlign: 'right', fontSize: 17, fontVariant: ['tabular-nums'], paddingRight: 8, color: colors.accent, fontFamily: fontFamilies.title },
  boardArea: { flex: 1 },
  noticeBox: { position: 'absolute', left: 16, right: 16, bottom: 12, alignItems: 'center' },
  noticeBoxText: { color: colors.ink, backgroundColor: colors.panelHeavy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, overflow: 'hidden', fontSize: 14, textAlign: 'center', fontFamily: fontFamilies.bodyBold },
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 10 },
  aid: { minWidth: 92, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  aidEmpty: { opacity: 0.45 },
  aidIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  aidLabel: { color: colors.inkSoft, fontSize: 12, marginTop: 2, fontFamily: fontFamilies.body },
  aidCount: { color: colors.ink, fontSize: 16, lineHeight: 20, fontFamily: fontFamilies.title },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, backgroundColor: colors.feltB, borderWidth: 2, borderColor: colors.accent, padding: 24, alignItems: 'center', gap: 8 },
  overlayTitle: { color: colors.accent, fontSize: 22, fontFamily: fontFamilies.title },
  overlayStarsRow: { position: 'relative', width: '100%', height: 48, alignItems: 'center', justifyContent: 'center' },
  overlayStars: { fontSize: 36, letterSpacing: 4 },
  overlayCoinRewardPosition: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  overlayCoinText: { color: colors.accent, fontSize: 16, lineHeight: 22, fontFamily: fontFamilies.bodyBold, fontVariant: ['tabular-nums'] },
  overlayLine: { color: colors.inkSoft, fontSize: 15, textAlign: 'center', fontFamily: fontFamilies.body },
  overlayRecord: { color: colors.accent, fontSize: 17, textAlign: 'center', fontFamily: fontFamilies.bodyExtraBold },
  overlayReward: { color: colors.ink, fontSize: 16, textAlign: 'center', fontFamily: fontFamilies.bodyBold },
  overlayWarning: { color: colors.accent, fontSize: 14, textAlign: 'center', fontFamily: fontFamilies.body },
  trouble: { marginHorizontal: 12, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.panelHeavy, alignItems: 'center' },
  troubleText: { color: colors.accent, fontSize: 14, textAlign: 'center', fontFamily: fontFamilies.bodyBold },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
