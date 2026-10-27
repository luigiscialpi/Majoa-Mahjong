import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BUNDLE_V1, BUNDLE_V2, BUNDLE_INVALID_MUTATED } from './src/bundles';
import { ContentRepository } from './src/content-repository';
import { MemoryStorageAdapter } from './src/storage';
import {
  computeBoardHash,
  saveGame,
  loadSavedGame,
  clearSavedGame,
  restoreSavedGame,
} from './src/saved-game';
import { SavedGame } from './src/types';

interface LogEntry {
  id: number;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export default function App() {
  const repoRef = useRef(new ContentRepository(BUNDLE_V1));
  const storageRef = useRef(new MemoryStorageAdapter());

  const [activeVersion, setActiveVersion] = useState(1);
  const [hasStagedUpdate, setHasStagedUpdate] = useState(false);
  const [stagedVersion, setStagedVersion] = useState<number | null>(null);
  const [activeGame, setActiveGame] = useState<SavedGame | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'App avviata con Bundle Base v1 (2 isole, 40 livelli).',
    },
  ]);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs((prev) => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        type,
        message,
      },
      ...prev.slice(0, 14),
    ]);
  }, []);

  // Avvia una nuova partita su Isola 1 Livello 5
  const handleStartGame = () => {
    const spec = repoRef.current.getLevel('island-1-lv-5');
    if (!spec) return;

    const seed = 12345;
    const initialMoves: number[] = [];
    const hash = computeBoardHash(spec, seed, initialMoves);

    const game: SavedGame = {
      levelId: spec.id,
      contentVersion: repoRef.current.getActiveBundle().contentVersion,
      seed,
      moves: initialMoves,
      boardHash: hash,
      timestamp: Date.now(),
    };

    saveGame(storageRef.current, game);
    setActiveGame(game);
    setMoveCount(0);
    addLog('info', `Avviata partita su ${spec.id} (contentVersion: ${game.contentVersion}).`);
  };

  // Esegue una mossa di abbinamento
  const handlePlayMove = () => {
    if (!activeGame) return;
    const spec = repoRef.current.getLevel(activeGame.levelId);
    if (!spec) return;

    const nextMoves = [...activeGame.moves, activeGame.moves.length];
    const newHash = computeBoardHash(spec, activeGame.seed, nextMoves);

    const updated: SavedGame = {
      ...activeGame,
      moves: nextMoves,
      boardHash: newHash,
      timestamp: Date.now(),
    };

    saveGame(storageRef.current, updated);
    setActiveGame(updated);
    setMoveCount(nextMoves.length);
    addLog('info', `Mossa eseguita (Totale: ${nextMoves.length}, Hash: ${newHash}).`);
  };

  // Simula ricezione aggiornamento OTA v2 (Isola 3, append-only)
  const handleReceiveOtaV2 = () => {
    const res = repoRef.current.stageUpdate(BUNDLE_V2);
    if (res.ok) {
      setHasStagedUpdate(true);
      setStagedVersion(BUNDLE_V2.contentVersion);
      addLog(
        'success',
        'Ricevuto aggiornamento OTA v2 in background (Isola 3 Vulcanica). Messo in attesa del riavvio (Regola 4).'
      );
    } else {
      addLog('error', `OTA rifiutato: ${res.reason}`);
    }
  };

  // Simula ricezione OTA non retrocompatibile (viola append-only)
  const handleReceiveOtaCorrupt = () => {
    // Forziamo uno stage di un bundle mutato
    const res = repoRef.current.stageUpdate(BUNDLE_INVALID_MUTATED);
    if (!res.ok) {
      addLog(
        'warn',
        `OTA Invalido bloccato dal validatore: ${res.reason}. La sessione corrente è protetta.`
      );
    }
  };

  // Simula riavvio dell'app (applica l'aggiornamento e ripristina la partita)
  const handleRestartApp = () => {
    const applied = repoRef.current.applyStagedUpdate();
    setActiveVersion(repoRef.current.getActiveBundle().contentVersion);
    setHasStagedUpdate(false);
    setStagedVersion(null);

    addLog(
      'info',
      applied
        ? `App riavviata: applicato bundle v${repoRef.current.getActiveBundle().contentVersion}.`
        : 'App riavviata senza nuovi aggiornamenti.'
    );

    // Esegue ripristino partita con Regola 3
    const restore = restoreSavedGame(storageRef.current, repoRef.current);
    if (restore.status === 'restored') {
      const saved = loadSavedGame(storageRef.current);
      setActiveGame(saved);
      setMoveCount(restore.playedMoves);
      addLog('success', `[Regola 3] ${restore.message}`);
    } else {
      setActiveGame(null);
      setMoveCount(0);
      addLog('warn', `[Regola 3] ${restore.message}`);
    }
  };

  // Reset completo
  const handleReset = () => {
    repoRef.current = new ContentRepository(BUNDLE_V1);
    storageRef.current.clear();
    setActiveVersion(1);
    setHasStagedUpdate(false);
    setStagedVersion(null);
    setActiveGame(null);
    setMoveCount(0);
    addLog('info', 'Reset completo alle condizioni iniziali (Bundle v1, storage vuoto).');
  };

  const islands = repoRef.current.getAllIslands();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Prototipo S5 — Aggiornamenti OTA</Text>
        <Text style={styles.subtitle}>
          Verifica EAS Update, contenuti append-only e compatibilità salvataggi
        </Text>

        {/* Stato Contenuti Attivi */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Contenuto Attivo</Text>
            <View style={styles.badgeVersion}>
              <Text style={styles.badgeVersionText}>v{activeVersion}</Text>
            </View>
          </View>
          <Text style={styles.cardHint}>
            Isole attive nel catalogo: {islands.length} ({islands.length * 20} livelli totali)
          </Text>

          <View style={styles.islandsList}>
            {islands.map((island) => (
              <View key={island.id} style={styles.islandItem}>
                <Text style={styles.islandIcon}>{island.icon}</Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.islandName}>{island.name}</Text>
                  <Text style={styles.islandMeta}>
                    {island.levelCount} livelli • tema {island.theme}
                  </Text>
                </View>
                {island.id === 'island-3' && (
                  <Text style={styles.badgeNew}>NUOVA VIA OTA</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Partita in Corso */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stato Partita Salvata</Text>
          {activeGame ? (
            <View style={styles.gameBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.gameLevel}>{activeGame.levelId}</Text>
                <Text style={styles.gameBadge}>In Corso</Text>
              </View>
              <Text style={styles.gameDetail}>
                Versione bundle salvata: v{activeGame.contentVersion}
              </Text>
              <Text style={styles.gameDetail}>Mosse eseguite: {moveCount}</Text>
              <Text style={styles.gameDetail}>Hash tavola: {activeGame.boardHash}</Text>

              <TouchableOpacity style={styles.btnAction} onPress={handlePlayMove}>
                <Text style={styles.btnActionText}>Fai una mossa (+1 abbinamento)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.gameEmpty}>
              <Text style={styles.gameEmptyText}>Nessuna partita in corso.</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleStartGame}>
                <Text style={styles.btnPrimaryText}>Inizia Livello 5 (Isola 1)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Simulazione Flusso OTA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Simulatore Ricezione OTA</Text>
          <Text style={styles.cardHint}>
            Test delle 4 regole di compatibilità descritte in docs/decisioni-tecniche.md
          </Text>

          {hasStagedUpdate && (
            <View style={styles.stagedAlert}>
              <Text style={styles.stagedAlertText}>
                ⏳ Aggiornamento v{stagedVersion} pronto: in attesa del riavvio (Regola 4: non interrompe la partita).
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnOta, hasStagedUpdate && styles.btnDisabled]}
            disabled={hasStagedUpdate}
            onPress={handleReceiveOtaV2}
          >
            <Text style={styles.btnOtaText}>1. Simula Download OTA v2 (Isola 3 Append-Only)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnOta, { backgroundColor: '#e76f51' }]}
            onPress={handleReceiveOtaCorrupt}
          >
            <Text style={[styles.btnOtaText, { color: '#fff' }]}>
              2. Simula OTA Invalido (Modifica distruttiva spec)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnRestart} onPress={handleRestartApp}>
            <Text style={styles.btnRestartText}>🔄 Riavvia App (Applica OTA e Ripristina Partita)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnReset} onPress={handleReset}>
            <Text style={styles.btnResetText}>Reset Completo (Torna a v1)</Text>
          </TouchableOpacity>
        </View>

        {/* Log delle Operazioni */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log di Conformità</Text>
          {logs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logTime}>{log.time}</Text>
              <Text
                style={[
                  styles.logMsg,
                  log.type === 'success' && styles.logSuccess,
                  log.type === 'warn' && styles.logWarn,
                  log.type === 'error' && styles.logError,
                ]}
              >
                {log.message}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a2e26',
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
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeVersion: {
    backgroundColor: '#2a9d8f',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeVersionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  islandsList: {
    marginTop: 6,
  },
  islandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  islandIcon: {
    fontSize: 24,
  },
  islandName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  islandMeta: {
    fontSize: 11,
    color: '#888',
  },
  badgeNew: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e76f51',
    backgroundColor: '#fdeee9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gameBox: {
    backgroundColor: '#f4fbf7',
    borderWidth: 1,
    borderColor: '#ccebdc',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  gameLevel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2d6a4f',
  },
  gameBadge: {
    fontSize: 11,
    color: '#2d6a4f',
    fontWeight: '600',
  },
  gameDetail: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  btnAction: {
    backgroundColor: '#2d6a4f',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  gameEmpty: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  gameEmptyText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  btnPrimary: {
    backgroundColor: '#2a9d8f',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  stagedAlert: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  stagedAlertText: {
    fontSize: 12,
    color: '#856404',
  },
  btnOta: {
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnOtaText: {
    color: '#1d3557',
    fontWeight: '600',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnRestart: {
    backgroundColor: '#264653',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnRestartText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnReset: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  btnResetText: {
    color: '#888',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  logRow: {
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
    paddingVertical: 6,
  },
  logTime: {
    fontSize: 10,
    color: '#999',
  },
  logMsg: {
    fontSize: 12,
    color: '#444',
    marginTop: 1,
  },
  logSuccess: {
    color: '#2a9d8f',
  },
  logWarn: {
    color: '#e76f51',
  },
  logError: {
    color: '#d62828',
    fontWeight: '600',
  },
});
