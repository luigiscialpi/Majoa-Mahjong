import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reduceRound, startRound, type Round } from '../application/round';
import { goldCount, isStuck } from '../application/session';
import { gameColumn } from '../domain/board';
import type { GameState } from '../domain/gameState';
import type { Profile } from '../domain/profile';
import { designOf, levelPalette, type Palette } from '../infrastructure/content/legacyThemes';
import { toSpec, type LegacyLevel } from '../infrastructure/content/legacyLevels';
import { TileBoard } from './TileBoard';
import { goneTiles, newlyRemoved, tileStatuses } from './boardView';
import { PROFILE_NAMES, aidText, formatTime, starsText } from './format';
import { messageFor } from './messages';
import { useTileSvgs } from './svgs';
import type { SkSVG } from '@shopify/react-native-skia';

const REMOVE_MS = 250;
const RESCUE_DELAY_MS = 1100;
const NOTICE_MS = 2000;
const EMPTY: ReadonlySet<number> = new Set();

export type GameScreenProps = { level: LegacyLevel; profile: Profile; onExit: () => void };

/** Schermata di gioco di un livello: carica i disegni, sceglie un seme nuovo a ogni partita e ricomincia a richiesta. */
export function GameScreen({ level, profile, onExit }: GameScreenProps) {
  const [attempt, setAttempt] = useState(0);
  // Il seme è casuale a ogni partita (nell'originale non esiste seme); il dominio resta deterministico.
  const seed = useMemo(() => Math.floor(Math.random() * 2147483647), [attempt]);
  const started = useMemo(() => startRound({ spec: toSpec(level), profile, seed }), [level, profile, seed]);
  const svgs = useTileSvgs();
  const palette = levelPalette(level.id);

  if (!started.ok) return <Notice palette={palette} text={`Impossibile generare il livello (${started.error.kind})`} onExit={onExit} />;
  if (!svgs) return <Notice palette={palette} text="Caricamento dei disegni…" onExit={onExit} />;
  return <RoundView key={attempt} level={level} profile={profile} palette={palette} svgs={svgs} initial={started.value} onRestart={() => setAttempt((a) => a + 1)} onExit={onExit} />;
}

function Notice({ palette, text, onExit }: { palette: Palette; text: string; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: palette[1], paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        <Text style={styles.noticeText}>{text}</Text>
        <Pressable style={styles.button} onPress={onExit} accessibilityRole="button">
          <Text style={styles.buttonText}>Livelli</Text>
        </Pressable>
      </View>
    </View>
  );
}

type RoundViewProps = { level: LegacyLevel; profile: Profile; palette: Palette; svgs: readonly (SkSVG | null)[]; initial: Round; onRestart: () => void; onExit: () => void };

function RoundView({ level, profile, palette, svgs, initial, onRestart, onExit }: RoundViewProps) {
  const [round, dispatch] = useReducer(reduceRound, initial);
  const { session } = round;
  const game = session.game;
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [hintGroup, setHintGroup] = useState<readonly number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Tempo di gioco.
  useEffect(() => {
    if (session.phase !== 'playing') return;
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, [session.phase]);

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

  const onLayout = useCallback((e: LayoutChangeEvent) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }), []);
  const onTap = useCallback((tile: number | null) => {
    if (tile !== null) dispatch({ type: 'tap', tile });
  }, []);
  const column = gameColumn(area.width, area.height);
  const { got, total } = goldCount(session);

  return (
    <View style={[styles.root, { backgroundColor: palette[1], paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={onExit} style={styles.back} accessibilityRole="button" accessibilityLabel="Torna ai livelli" testID="btn-back">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Livello {level.id}</Text>
          <Text style={styles.subtitle}>
            {PROFILE_NAMES[profile]} · {game.remaining} tessere{total > 0 ? ` · oro ${got}/${total}` : ''}
          </Text>
        </View>
        <Text style={[styles.time, { color: palette[2] }]} testID="timer">
          {formatTime(session.seconds)}
        </Text>
      </View>

      <View style={styles.boardArea} onLayout={onLayout}>
        {area.width > 0 ? (
          <View style={{ width: column.w, height: column.h, marginLeft: column.x }}>
            <TileBoard
              tiles={game.tiles}
              designs={designs}
              svgs={svgs}
              statuses={statuses}
              palette={palette}
              width={column.w}
              height={column.h}
              free={free}
              gone={gone}
              removing={view.removing}
              removeKey={view.key}
              selected={session.selected}
              hint={hintGroup}
              onTap={onTap}
            />
          </View>
        ) : null}
        {notice ? (
          <View style={styles.noticeBox} pointerEvents="none">
            <Text style={styles.noticeBoxText}>{notice}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bar}>
        <AidButton label="Aiuto" icon="💡" left={session.left.hints} onPress={() => dispatch({ type: 'hint' })} testID="btn-hint" />
        <AidButton label="Annulla" icon="↶" left={session.left.undo} onPress={() => dispatch({ type: 'undo' })} testID="btn-undo" />
        <AidButton label="Mischia" icon="🔀" left={session.left.shuffles} onPress={() => dispatch({ type: 'shuffle' })} testID="btn-shuffle" />
      </View>

      {session.phase === 'won' && session.outcome ? (
        <Overlay>
          <Text style={styles.overlayTitle}>Livello completato!</Text>
          <Text style={[styles.overlayStars, { color: palette[2] }]}>{starsText(session.outcome.stars)}</Text>
          <Text style={styles.overlayLine}>Tempo {formatTime(session.outcome.seconds)}</Text>
          <Text style={styles.overlayLine}>Aiuti usati: {session.outcome.aidsUsed}</Text>
          {session.outcome.goldTotal > 0 ? <Text style={styles.overlayLine}>Tessere d'oro: {session.outcome.gold}/{session.outcome.goldTotal}</Text> : null}
          <OverlayButtons onRestart={onRestart} onExit={onExit} restartLabel="Rigioca" />
        </Overlay>
      ) : null}
      {session.phase === 'dead' ? (
        <Overlay>
          <Text style={styles.overlayTitle}>Bloccato!</Text>
          <Text style={styles.overlayLine}>Nessuna mossa possibile e nessun aiuto utile.</Text>
          <OverlayButtons onRestart={onRestart} onExit={onExit} restartLabel="Riprova" />
        </Overlay>
      ) : null}
    </View>
  );
}

function AidButton({ label, icon, left, onPress, testID }: { label: string; icon: string; left: number | null; onPress: () => void; testID: string }) {
  const empty = left !== null && left <= 0;
  return (
    <Pressable onPress={onPress} style={[styles.aid, empty ? styles.aidEmpty : null]} accessibilityRole="button" accessibilityLabel={`${label}, ${aidText(left)} rimasti`} testID={testID}>
      <Text style={styles.aidIcon}>{icon}</Text>
      <Text style={styles.aidLabel}>{label}</Text>
      <Text style={styles.aidCount}>{aidText(left)}</Text>
    </Pressable>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function OverlayButtons({ onRestart, onExit, restartLabel }: { onRestart: () => void; onExit: () => void; restartLabel: string }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.button} onPress={onRestart} accessibilityRole="button" testID="btn-restart">
        <Text style={styles.buttonText}>{restartLabel}</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={onExit} accessibilityRole="button" testID="btn-levels">
        <Text style={styles.buttonText}>Livelli</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  noticeText: { color: '#ffffff', fontSize: 16, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#ffffff', fontSize: 32, lineHeight: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  time: { width: 64, textAlign: 'right', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], paddingRight: 8 },
  boardArea: { flex: 1 },
  noticeBox: { position: 'absolute', left: 16, right: 16, bottom: 12, alignItems: 'center' },
  noticeBoxText: { color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, overflow: 'hidden', fontSize: 14, textAlign: 'center' },
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 10 },
  aid: { minWidth: 92, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)' },
  aidEmpty: { opacity: 0.45 },
  aidIcon: { fontSize: 20, color: '#ffffff' },
  aidLabel: { color: '#ffffff', fontSize: 12, marginTop: 2 },
  aidCount: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, backgroundColor: 'rgba(30,20,40,0.96)', padding: 24, alignItems: 'center', gap: 8 },
  overlayTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  overlayStars: { fontSize: 40, letterSpacing: 4 },
  overlayLine: { color: 'rgba(255,255,255,0.85)', fontSize: 15, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  button: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
