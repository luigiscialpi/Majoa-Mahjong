import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';
import { SOUND_ASSETS, SoundKey, COMBO_KEYS } from './src/sounds';

interface BenchmarkLog {
  id: number;
  test: string;
  durationMs: number;
  jitterMs: number;
  notesPlayed: number;
  status: 'ok' | 'lag';
  details: string;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Inizializzazione audio...');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [comboInterval, setComboInterval] = useState<number>(120); // 120ms tra note
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [isRunningCombo, setIsRunningCombo] = useState(false);
  const [logs, setLogs] = useState<BenchmarkLog[]>([]);
  const [touchLatency, setTouchLatency] = useState<number | null>(null);

  // Pool di AudioPlayer pre-istratti per azzerare I/O al playback
  const playersRef = useRef<Map<SoundKey, AudioPlayer>>(new Map());

  // Inizializza audio e precarica i 24 campioni
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoadingMsg('Configurazione AudioMode...');
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });

        setLoadingMsg('Download campioni WAV in cache locale...');
        await Asset.loadAsync(Object.values(SOUND_ASSETS));

        setLoadingMsg('Pre-caricamento 24 campioni nel player...');
        const map = new Map<SoundKey, AudioPlayer>();
        for (const [key, asset] of Object.entries(SOUND_ASSETS) as [SoundKey, any][]) {
          const player = createAudioPlayer(asset);
          player.volume = 1.0;
          map.set(key, player);
        }
        playersRef.current = map;

        if (isMounted) {
          setLoaded(true);
        }
      } catch (err: any) {
        console.error('Errore inizializzazione audio:', err);
        setLoadingMsg(`Errore: ${err.message}`);
      }
    })();

    return () => {
      isMounted = false;
      // Rilascia i player alla chiusura
      playersRef.current.forEach((player) => {
        try {
          player.pause();
        } catch (_) {}
      });
      playersRef.current.clear();
    };
  }, []);

  // Riproduce un singolo suono dal pool (seek a 0 e play immediato)
  const playSound = useCallback((key: SoundKey, triggerHaptic = false) => {
    const t0 = performance.now();
    const player = playersRef.current.get(key);
    if (!player) return 0;

    try {
      player.seekTo(0);
      player.play();
      if (triggerHaptic && hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (e) {
      console.warn(`Errore play ${key}:`, e);
    }
    return performance.now() - t0;
  }, [hapticsEnabled]);

  // Test 1: Combo rapida (8 note a salire con intervallo prestabilito)
  const runComboTest = useCallback(async () => {
    if (isRunningCombo) return;
    setIsRunningCombo(true);

    const noteCount = COMBO_KEYS.length;
    const targetInterval = comboInterval;
    const startReal = performance.now();
    const delays: number[] = [];

    for (let i = 0; i < noteCount; i++) {
      const noteKey = COMBO_KEYS[i];
      setActiveNote(i);

      const dispatchStart = performance.now();
      playSound(noteKey, true);
      const dispatchDuration = performance.now() - dispatchStart;

      // Misura jitter
      delays.push(dispatchDuration);

      // Attesa temporizzata fino alla prossima nota
      if (i < noteCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, targetInterval));
      }
    }

    const totalReal = performance.now() - startReal;
    const totalExpected = targetInterval * (noteCount - 1);
    const drift = totalReal - totalExpected;
    const avgDispatch = delays.reduce((a, b) => a + b, 0) / delays.length;

    setActiveNote(null);
    setIsRunningCombo(false);

    const newLog: BenchmarkLog = {
      id: Date.now(),
      test: `Combo 8 note (${targetInterval}ms)`,
      durationMs: Math.round(totalReal),
      jitterMs: Math.round(Math.abs(drift) * 10) / 10,
      notesPlayed: noteCount,
      status: avgDispatch < 10 && Math.abs(drift) < 50 ? 'ok' : 'lag',
      details: `Dispatch medio: ${avgDispatch.toFixed(2)}ms, Drift totale: ${drift.toFixed(1)}ms`,
    };

    setLogs((prev) => [newLog, ...prev.slice(0, 9)]);
  }, [isRunningCombo, comboInterval, playSound]);

  // Test 2: Misurazione latenza singolo tocco
  const handleTouchMeasure = useCallback(() => {
    const t0 = performance.now();
    playSound('select', true);
    const dt = performance.now() - t0;
    setTouchLatency(Math.round(dt * 100) / 100);

    const newLog: BenchmarkLog = {
      id: Date.now(),
      test: 'Tocco singolo (select)',
      durationMs: Math.round(dt * 100) / 100,
      jitterMs: 0,
      notesPlayed: 1,
      status: dt < 5 ? 'ok' : 'lag',
      details: `Tempo chiamata player.play(): ${dt.toFixed(2)}ms`,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 9)]);
  }, [playSound]);

  // Test 3: Polifonia / Sovrapposizione simultanea (4 suoni insieme)
  const handlePolyphonyTest = useCallback(() => {
    const t0 = performance.now();
    const batch: SoundKey[] = ['match_2', 'star_0', 'gold', 'boom'];

    batch.forEach((key) => playSound(key, false));
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const dt = performance.now() - t0;
    const newLog: BenchmarkLog = {
      id: Date.now(),
      test: 'Polifonia (4 suoni simultanei)',
      durationMs: Math.round(dt * 100) / 100,
      jitterMs: 0,
      notesPlayed: batch.length,
      status: dt < 12 ? 'ok' : 'lag',
      details: `Dispatch parallelo 4 player: ${dt.toFixed(2)}ms`,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 9)]);
  }, [playSound, hapticsEnabled]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#4a7c59" />
        <Text style={styles.loadingText}>{loadingMsg}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Prototipo S2 — Audio & Haptics</Text>
        <Text style={styles.subtitle}>
          Validazione campioni WAV e latenza combo con expo-audio
        </Text>

        {/* Impostazioni Haptics */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Vibrazione (expo-haptics)</Text>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ true: '#4a7c59', false: '#ccc' }}
            />
          </View>
          <Text style={styles.cardHint}>
            Riproduce un impulso leggero a ogni abbinamento (14ms come originale).
          </Text>
        </View>

        {/* Test Combo Rapida */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Test Combo (8 note in salita)</Text>
          <Text style={styles.cardHint}>
            Verifica ritardi, drop o desincronizzazione su sequenze rapide.
          </Text>

          {/* Selettore intervallo */}
          <Text style={styles.label}>Intervallo tra note:</Text>
          <View style={styles.rowIntervals}>
            {[80, 120, 160, 200].map((ms) => (
              <TouchableOpacity
                key={ms}
                style={[
                  styles.btnInterval,
                  comboInterval === ms && styles.btnIntervalActive,
                ]}
                onPress={() => setComboInterval(ms)}
              >
                <Text
                  style={[
                    styles.btnIntervalText,
                    comboInterval === ms && styles.btnIntervalTextActive,
                  ]}
                >
                  {ms} ms
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Indicatori grafici delle 8 note */}
          <View style={styles.rowNotes}>
            {COMBO_KEYS.map((key, idx) => (
              <View
                key={key}
                style={[
                  styles.noteBox,
                  activeNote === idx && styles.noteBoxActive,
                ]}
              >
                <Text
                  style={[
                    styles.noteBoxText,
                    activeNote === idx && styles.noteBoxTextActive,
                  ]}
                >
                  {idx + 1}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, isRunningCombo && styles.btnDisabled]}
            disabled={isRunningCombo}
            onPress={runComboTest}
          >
            <Text style={styles.btnPrimaryText}>
              {isRunningCombo ? 'Riproduzione combo...' : 'Avvia Combo 8 Note'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Test Latenza e Polifonia */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Latenza Tocco & Polifonia</Text>

          <View style={styles.rowButtons}>
            <TouchableOpacity
              style={[styles.btnSecondary, { flex: 1, marginRight: 6 }]}
              onPress={handleTouchMeasure}
            >
              <Text style={styles.btnSecondaryText}>Tocca (Latenza)</Text>
              {touchLatency !== null && (
                <Text style={styles.badgeText}>{touchLatency} ms</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSecondary, { flex: 1, marginLeft: 6 }]}
              onPress={handlePolyphonyTest}
            >
              <Text style={styles.btnSecondaryText}>Polifonia (4 suoni)</Text>
              <Text style={styles.badgeText}>simultanei</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Catalogo Suoni */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Ascolto Campioni (24 suoni)</Text>
          <Text style={styles.cardHint}>
            Tocca per verificare la qualità acustica rispetto all'originale.
          </Text>

          <Text style={styles.sectionHeader}>Meccaniche di gioco:</Text>
          <View style={styles.grid}>
            {(
              [
                'select',
                'blocked',
                'hint',
                'undo',
                'shuffle',
                'stuck',
                'start',
                'win',
                'boom',
                'fog',
                'gold',
                'unlock',
                'pop',
              ] as SoundKey[]
            ).map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.btnSound}
                onPress={() => playSound(key, false)}
              >
                <Text style={styles.btnSoundText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionHeader}>Stelle:</Text>
          <View style={styles.grid}>
            {(['star_0', 'star_1', 'star_2'] as SoundKey[]).map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.btnSound, { backgroundColor: '#fdf6e2' }]}
                onPress={() => playSound(key, false)}
              >
                <Text style={[styles.btnSoundText, { color: '#b58900' }]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Log e Misure */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Misure e Log di Prestazione</Text>
          {logs.length === 0 ? (
            <Text style={styles.cardHint}>Nessuna misura ancora eseguita.</Text>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.rowBetween}>
                  <Text style={styles.logTitle}>{log.test}</Text>
                  <Text
                    style={[
                      styles.logBadge,
                      log.status === 'ok' ? styles.badgeOk : styles.badgeLag,
                    ]}
                  >
                    {log.status === 'ok' ? 'OK (<10ms)' : 'LAG'}
                  </Text>
                </View>
                <Text style={styles.logDetail}>{log.details}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7f6',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  containerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#555',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a3322',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  cardHint: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#444',
    marginTop: 10,
    marginBottom: 6,
  },
  rowIntervals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  btnInterval: {
    flex: 1,
    paddingVertical: 6,
    marginHorizontal: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  btnIntervalActive: {
    backgroundColor: '#4a7c59',
    borderColor: '#4a7c59',
  },
  btnIntervalText: {
    fontSize: 12,
    color: '#555',
  },
  btnIntervalTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rowNotes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  noteBox: {
    flex: 1,
    height: 36,
    marginHorizontal: 2,
    borderRadius: 6,
    backgroundColor: '#eef2ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteBoxActive: {
    backgroundColor: '#e76f51',
    transform: [{ scale: 1.1 }],
  },
  noteBoxText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  noteBoxTextActive: {
    color: '#fff',
  },
  btnPrimary: {
    backgroundColor: '#4a7c59',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  rowButtons: {
    flexDirection: 'row',
    marginTop: 10,
  },
  btnSecondary: {
    backgroundColor: '#eef2ee',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#2d5a3c',
    fontWeight: '600',
    fontSize: 14,
  },
  badgeText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginTop: 10,
    marginBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  btnSound: {
    backgroundColor: '#f1f3f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    margin: 4,
  },
  btnSoundText: {
    fontSize: 12,
    color: '#333',
  },
  logItem: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
    marginTop: 8,
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  logBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeOk: {
    backgroundColor: '#e2f4e8',
    color: '#2a7a40',
  },
  badgeLag: {
    backgroundColor: '#ffe8e6',
    color: '#d9381e',
  },
  logDetail: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
});
