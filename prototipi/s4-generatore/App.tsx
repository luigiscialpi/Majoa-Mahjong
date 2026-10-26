import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import legacy from './src/data/legacy-levels.json';
import { formatReport, runBench } from './src/engine/bench';
import type { LegacyLevel } from './src/engine/legacy';

const LEVELS = legacy as LegacyLevel[];
const SEEDS = 10;
const SIM_RUNS = 40;

export default function App() {
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setLines(['In corso…']);
    const report = await runBench(LEVELS, SEEDS, SIM_RUNS, () => new Promise((r) => setTimeout(r, 0)));
    const out = formatReport(report);
    console.log('S4-BENCH\n' + out.join('\n'));
    setLines(out);
    setRunning(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Text style={styles.title}>S4 · motore dei livelli</Text>
      <Text style={styles.info}>{`${LEVELS.length} livelli dell'originale · ${SEEDS} semi per livello · ${SIM_RUNS} partite simulate`}</Text>
      <Pressable onPress={run} style={[styles.btn, running && styles.btnOn]} testID="btn-prova">
        <Text style={styles.btnText}>{running ? 'Prova…' : 'Prova'}</Text>
      </Pressable>
      <ScrollView style={styles.out}>
        <Text style={styles.text} testID="risultato">
          {lines.join('\n')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2a1230', paddingTop: 56, paddingHorizontal: 12, gap: 8 },
  title: { color: '#fff1a8', fontSize: 18, fontWeight: '700' },
  info: { color: '#f3e6f0', fontSize: 12 },
  btn: { backgroundColor: '#5a2f55', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  btnOn: { backgroundColor: '#c0562a' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  out: { flex: 1 },
  text: { color: '#f3e6f0', fontSize: 12, lineHeight: 17 },
});
