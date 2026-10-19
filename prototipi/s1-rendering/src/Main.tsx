import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import level20 from './data/level20.json';
import { boardMetrics, gameColumn, isFree, visibleFraction, type Metrics, type Tile } from './board';
import { FpsMeter, useFrameStats } from './FpsMeter';
import { Gallery } from './Gallery';
import { HEADER_H } from './layout';
import { sleep, useJsLag } from './perf';
import { loadTileSvgs, type LoadedTiles } from './svgTiles';
import { TileBoard } from './TileBoard';

const TILES: Tile[] = level20.tiles;
const WARMUP_MS = 1500;
const MEASURE_MS = 5000;
const TAP_EVERY_MS = 400;

const CONFIGS = [
  { name: 'fermo', animate: false, shadow: false },
  { name: 'Anima', animate: true, shadow: false },
  { name: 'Ombre', animate: false, shadow: true },
  { name: 'Anima+Ombre', animate: true, shadow: true },
];

// Sequenza della prova: vecchio comportamento (memo no) solo per due configurazioni, poi memo sì senza e con cache.
const RUNS = [
  { memo: false, cache: false, cfg: CONFIGS[0] },
  { memo: false, cache: false, cfg: CONFIGS[3] },
  ...CONFIGS.map((cfg) => ({ memo: true, cache: false, cfg })),
  ...CONFIGS.map((cfg) => ({ memo: true, cache: true, cfg })),
];

type BenchRow = { memo: boolean; cache: boolean; cfg: string; fps: number; worst: number; jsMax: number; tapAvg: number; tapMax: number; echoAvg: number; echoMax: number };
type Bench = { running: boolean; rows: BenchRow[] };

function Button({ label, on, onPress, testID }: { label: string; on?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={[styles.btn, on && styles.btnOn]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/** Tempo, sul thread JS, dal gesto di tocco al commit di React con la nuova selezione. Componente a parte per non ridisegnare la tavola. */
function TapLatency({ selected, t0, sink, style }: { selected: number | null; t0: RefObject<number>; sink: RefObject<number[]>; style: object }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (t0.current) {
      const d = performance.now() - t0.current;
      t0.current = 0;
      sink.current.push(d);
      setMs(Math.round(d));
    }
  }, [selected, t0, sink]);
  return (
    <Text style={style} testID="tap-lat">
      {ms === null ? 'Tocco → commit JS: —' : `Tocco → commit JS: ${ms} ms`}
    </Text>
  );
}

export default function Main() {
  const { width, height } = useWindowDimensions();
  const col = gameColumn(width, height);
  const [loaded, setLoaded] = useState<LoadedTiles | null>(null);
  const [mode, setMode] = useState<'tavola' | 'galleria'>('tavola');
  const [animate, setAnimate] = useState(false);
  const [shadow, setShadow] = useState(false);
  const [stable, setStable] = useState(true);
  const [cache, setCache] = useState(false);
  const [entranceKey, setEntranceKey] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tapInfo, setTapInfo] = useState('Tocca una tessera');
  const [bench, setBench] = useState<Bench>({ running: false, rows: [] });
  const { stats, ping, benchReset, benchRead } = useFrameStats();
  const jsLag = useJsLag();
  const tapT0 = useRef(0);
  const latencies = useRef<number[]>([]);
  const benchRunning = useRef(false);

  useEffect(() => {
    loadTileSvgs().then(setLoaded);
  }, []);

  const areaH = Math.max(100, col.h - HEADER_H);
  const metrics = useMemo(() => boardMetrics(TILES, col.w, areaH), [col.w, areaH]);
  const freeIdx = useMemo(() => TILES.map((_, i) => i).filter((i) => isFree(TILES, i)), []);
  const touch = useMemo(() => {
    // Area minima raggiungibile al tocco tra le tessere libere (campionamento a 3 px).
    const minVisible = Math.min(...freeIdx.map((i) => visibleFraction(TILES, metrics, i, 3)));
    return { free: freeIdx.length, minVisiblePct: Math.round(minVisible * 100) };
  }, [metrics, freeIdx]);

  const onTap = useCallback((index: number | null, m: Metrics) => {
    tapT0.current = performance.now();
    ping();
    setSelected(index);
    if (index === null) setTapInfo('Tocco fuori dalle tessere');
    else {
      const t = TILES[index];
      setTapInfo(`Tessera #${index} (x${t.x} y${t.y} z${t.z}) · disegno ${t.type} · ${Math.round(m.tw)}×${Math.round(m.th)} dp`);
    }
  }, [ping]);

  const runBench = useCallback(async () => {
    if (benchRunning.current) return;
    benchRunning.current = true;
    setMode('tavola');
    const rows: BenchRow[] = [];
    setBench({ running: true, rows });
    for (const run of RUNS) {
      setStable(run.memo);
      setCache(run.cache);
      setAnimate(run.cfg.animate);
      setShadow(run.cfg.shadow);
      await sleep(WARMUP_MS);
      benchReset();
      jsLag.reset();
      latencies.current = [];
      const t0 = Date.now();
      let k = 0;
      while (Date.now() - t0 < MEASURE_MS) {
        onTap(freeIdx[k++ % freeIdx.length], metrics);
        await sleep(TAP_EVERY_MS);
      }
      const f = benchRead();
      const l = latencies.current;
      rows.push({
        memo: run.memo,
        cache: run.cache,
        cfg: run.cfg.name,
        fps: f.fps,
        worst: f.worst,
        jsMax: jsLag.read().max,
        tapAvg: l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : 0,
        tapMax: l.length ? Math.round(Math.max(...l)) : 0,
        echoAvg: f.echoAvg,
        echoMax: f.echoMax,
      });
      setBench({ running: true, rows: [...rows] });
    }
    setAnimate(false);
    setShadow(false);
    setStable(true);
    setCache(false);
    setSelected(null);
    setBench({ running: false, rows });
    console.log('S1-BENCH ' + JSON.stringify(rows));
    benchRunning.current = false;
  }, [benchReset, benchRead, jsLag, freeIdx, metrics, onTap]);

  const benchLines = bench.rows.map(
    (r) => `m${r.memo ? '+' : '-'} c${r.cache ? '+' : '-'} ${r.cfg}: ${r.fps} fps · pegg ${r.worst} · JS ${r.jsMax} · tocco ${r.tapAvg}/${r.tapMax} · eco ${r.echoAvg}/${r.echoMax}`,
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <View style={{ position: 'absolute', left: col.x, top: 0, width: col.w, height: col.h }} testID="colonna">
        <View style={{ height: HEADER_H, padding: 8, gap: 4 }}>
          <Text style={styles.title}>S1 · rendering Skia</Text>
          <View style={styles.row}>
            <Button label="Tavola" on={mode === 'tavola'} onPress={() => setMode('tavola')} testID="btn-tavola" />
            <Button label="Galleria" on={mode === 'galleria'} onPress={() => setMode('galleria')} testID="btn-galleria" />
            <Button label="Anima" on={animate} onPress={() => setAnimate((v) => !v)} testID="btn-anima" />
            <Button label="Ombre" on={shadow} onPress={() => setShadow((v) => !v)} testID="btn-ombre" />
            <Button label="Entrata" onPress={() => setEntranceKey((k) => k + 1)} testID="btn-entrata" />
            <Button label={stable ? 'Memo sì' : 'Memo no'} on={stable} onPress={() => setStable((v) => !v)} testID="btn-memo" />
            <Button label="Cache" on={cache} onPress={() => setCache((v) => !v)} testID="btn-cache" />
            <Button label={bench.running ? 'Prova…' : 'Prova'} on={bench.running} onPress={runBench} testID="btn-prova" />
          </View>
          <Text style={styles.info} testID="svg-info">
            {loaded ? `SVG: ${loaded.loaded}/${loaded.svgs.length} in ${loaded.ms} ms${loaded.failed ? ` · ${loaded.failed} falliti: ${loaded.firstError}` : ''}` : 'SVG: caricamento…'}
          </Text>
          <Text style={styles.info} testID="board-info">
            {`Tessere ${TILES.length} · libere ${touch.free} (tocco ≥ ${touch.minVisiblePct}% dell'area) · piani ${metrics.maxZ + 1} · tessera ${Math.round(metrics.tw)}×${Math.round(metrics.th)} dp`}
          </Text>
          <FpsMeter stats={stats} style={styles.info} />
          <TapLatency selected={selected} t0={tapT0} sink={latencies} style={styles.info} />
          <Text style={styles.info} testID="tap-info">{tapInfo}</Text>
        </View>
        {loaded && mode === 'tavola' ? (
          <TileBoard tiles={TILES} svgs={loaded.svgs} width={col.w} height={areaH} animate={animate} shadow={shadow} entranceKey={entranceKey} selected={selected} stable={stable} cache={cache} onTap={onTap} />
        ) : null}
        {loaded && mode === 'galleria' ? <Gallery svgs={loaded.svgs} width={col.w} height={areaH} /> : null}
        {bench.rows.length > 0 || bench.running ? (
          <View style={styles.benchPanel} pointerEvents="none">
            <Text style={styles.benchTitle}>
              {bench.running ? `Prova in corso (${bench.rows.length}/${RUNS.length})…` : 'Prova completata'}
            </Text>
            <Text style={styles.benchText}>m = memo, c = cache del corpo · pegg = peggior frame · JS = ritardo max thread JS · tocco = gesto→commit JS medio/max · eco = andata e ritorno col thread UI medio/max · tutto in ms</Text>
            <Text style={styles.benchText} testID="bench-result">{[bench.running ? 'in corso' : 'completata', ...benchLines].join('\n')}</Text>
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2a1230' },
  title: { color: '#fff1a8', fontSize: 16, fontWeight: '700' },
  info: { color: '#f3e6f0', fontSize: 11 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn: { backgroundColor: '#5a2f55', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9 },
  btnOn: { backgroundColor: '#c0562a' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  benchPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,24,0.94)', padding: 8 },
  benchTitle: { color: '#fff1a8', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  benchText: { color: '#f3e6f0', fontSize: 10.5, lineHeight: 14 },
});
