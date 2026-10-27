import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { computeGameColumn, computeTileScale, GameColumnMetrics } from './src/layout';

type PresetKey = 'real' | 'phone' | 'tablet_portrait' | 'tablet_landscape' | 'dex';

interface Preset {
  label: string;
  w: number;
  h: number;
}

const PRESETS: Record<PresetKey, Preset> = {
  real: { label: 'Dispositivo Reale', w: 0, h: 0 },
  phone: { label: 'Telefono (412 × 915)', w: 412, h: 915 },
  tablet_portrait: { label: 'Tablet Verticale (800 × 1280)', w: 800, h: 1280 },
  tablet_landscape: { label: 'Tablet Orizzontale (1280 × 800)', w: 1280, h: 800 },
  dex: { label: 'Desktop / DeX (1920 × 1080)', w: 1920, h: 1080 },
};

export default function App() {
  const windowDims = useWindowDimensions();
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('real');

  const activeWidth = selectedPreset === 'real' ? windowDims.width : PRESETS[selectedPreset].w;
  const activeHeight = selectedPreset === 'real' ? windowDims.height : PRESETS[selectedPreset].h;

  const column: GameColumnMetrics = computeGameColumn(activeWidth, activeHeight);
  const tileScale = computeTileScale(column.columnWidth, 8);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Sfondo globale (Bande laterali tematiche visibili su schermi larghi) */}
      <View style={[styles.canvasBackground, { width: windowDims.width, height: windowDims.height }]}>
        
        {/* Colonna di Gioco Verticale Centrata */}
        <View
          style={[
            styles.gameColumn,
            {
              width: Math.min(windowDims.width, column.columnWidth),
              alignSelf: 'center',
            },
          ]}
        >
          <ScrollView contentContainerStyle={styles.columnContent}>
            <Text style={styles.title}>Prototipo S3 — Layout & Tablet</Text>
            <Text style={styles.subtitle}>
              Colonna di gioco centrata (max 3:4) e blocco Android con appCategory
            </Text>

            {/* Scheda Metriche dello Schermo */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Stato Risoluzione</Text>
                <View style={styles.badgeRatio}>
                  <Text style={styles.badgeRatioText}>
                    Ratio: {column.aspectRatio.toFixed(2)} {column.isWideScreen ? '(Wide)' : '(Portrait)'}
                  </Text>
                </View>
              </View>

              <Text style={styles.metricRow}>
                Schermo simulato: <Text style={styles.bold}>{Math.round(activeWidth)} × {Math.round(activeHeight)} dp</Text>
              </Text>
              <Text style={styles.metricRow}>
                Larghezza colonna: <Text style={styles.bold}>{column.columnWidth} dp</Text>
              </Text>
              <Text style={styles.metricRow}>
                Bande laterali: <Text style={styles.bold}>{column.offsetX * 2} dp totali ({column.offsetX} dp per lato)</Text>
              </Text>
              <Text style={styles.metricRow}>
                Android appCategory: <Text style={[styles.bold, { color: '#2a9d8f' }]}>"game" (Attivo)</Text>
              </Text>
            </View>

            {/* Selettore Risoluzioni / Preset */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Simula Dispositivo:</Text>
              <View style={styles.presetsGrid}>
                {(Object.entries(PRESETS) as [PresetKey, Preset][]).map(([key, p]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.btnPreset,
                      selectedPreset === key && styles.btnPresetActive,
                    ]}
                    onPress={() => setSelectedPreset(key)}
                  >
                    <Text
                      style={[
                        styles.btnPresetText,
                        selectedPreset === key && styles.btnPresetTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Simulazione Tavola Mahjong e Tetto Tessere */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Simulazione Tavola & Tessere</Text>
                {tileScale.isCapped && (
                  <Text style={styles.badgeCapped}>Tetto 60dp attivo</Text>
                )}
              </View>
              <Text style={styles.cardHint}>
                Dimensione tessera: {tileScale.tileWidth} × {tileScale.tileHeight} dp (Spessore: {tileScale.tileDepth} dp)
              </Text>

              {/* Griglia dimostrativa tessere */}
              <View style={styles.boardPreview}>
                {[0, 1, 2, 3].map((row) => (
                  <View key={row} style={styles.boardRow}>
                    {[0, 1, 2, 3, 4, 5].map((col) => (
                      <View
                        key={col}
                        style={[
                          styles.tileDemo,
                          {
                            width: tileScale.tileWidth,
                            height: tileScale.tileHeight,
                          },
                        ]}
                      >
                        <Text style={styles.tileText}>🀄</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {/* Barra Azioni Inferiore (Sempre centrata e accessibile) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Barra Azioni (Bersaglio min. 48dp)</Text>
              <View style={styles.actionBar}>
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>💡 Aiuto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>↩️ Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>🔀 Mischia</Text>
                </TouchableOpacity>
              </View>
            </View>

          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1b2a22',
  },
  canvasBackground: {
    backgroundColor: '#1b2a22', // Sfondo tematico scuro visibile nelle bande laterali
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameColumn: {
    flex: 1,
    backgroundColor: '#f5f7f6',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#3a5446',
  },
  columnContent: {
    padding: 14,
    paddingBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a3322',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  cardHint: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRatio: {
    backgroundColor: '#264653',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRatioText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  metricRow: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
  },
  bold: {
    fontWeight: 'bold',
    color: '#111',
  },
  presetsGrid: {
    marginTop: 8,
  },
  btnPreset: {
    backgroundColor: '#f0f4f2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e6e2',
  },
  btnPresetActive: {
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  btnPresetText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  btnPresetTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  badgeCapped: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e76f51',
    backgroundColor: '#fdeee9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  boardPreview: {
    backgroundColor: '#e9ede9',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginVertical: 6,
  },
  boardRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  tileDemo: {
    backgroundColor: '#fff',
    marginHorizontal: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    borderBottomWidth: 3,
    borderBottomColor: '#aaa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileText: {
    fontSize: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    height: 48, // Minimo 48dp per tocco accessibile
    backgroundColor: '#2d6a4f',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
