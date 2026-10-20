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
import { TileBoardLayered } from './TileBoardLayered';

const TILES: Tile[] = level20.tiles;
const WARMUP_MS = 1500;
const MEASURE_MS = 5000;
const TAP_EVERY_MS = 400;
const LIVE_STEPS = [0, 2, 8, 24, 96];

type Run = { label: string; setup: () => void };
type BenchRow = { label: string; fps: number; worst: number; jsMax: number; tapAvg: number; tapMax: number; echoAvg: number; echoMax: number; imgMs: number | null };
type Bench = { title: string; total: number; running: boolean; rows: BenchRow[] };

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
  const [layered, setLayered] = useState(false);
  const [liveN, setLiveN] = useState(0);
  const [animN, setAnimN] = useState<number | null>(null);
  const [entranceKey, setEntranceKey] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tapInfo, setTapInfo] = useState('Tocca una tessera');
  const [bench, setBench] = useState<Bench>({ title: '', total: 0, running: false, rows: [] });
  const { stats, ping, benchReset, benchRead } = useFrameStats();
  const jsLag = useJsLag();
  const tapT0 = useRef(0);
  const latencies = useRef<number[]>([]);
  const benchRunning = useRef(false);
  const imgMs = useRef<number | null>(null);

  useEffect(() => {
    loadTileSvgs().then(setLoaded);
  }, []);

  const areaH = Math.max(100, col.h - HEADER_H);
  const metrics = useMemo(() => boardMetrics(TILES, col.w, areaH), [col.w, areaH]);
  const freeIdx = useMemo(() => TILES.map((_, i) => i).filter((i) => isFree(TILES, i)), []);
  // Ordine con cui si scelgono le tessere animate: prima le libere, poi le altre.
  const liveOrder = useMemo(() => [...freeIdx, ...TILES.map((_, i) => i).filter((i) => !freeIdx.includes(i))], [freeIdx]);
  const liveIndices = useMemo(() => liveOrder.slice(0, liveN), [liveOrder, liveN]);
  const animatedSet = useMemo(() => (animN === null ? null : new Set(liveOrder.slice(0, animN))), [animN, liveOrder]);
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

  const onStaticBuilt = useCallback((ms: number) => {
    imgMs.current = ms;
  }, []);

  /** Esegue una sequenza di configurazioni: riscaldamento, poi 5 s di misura con un tocco simulato ogni 0,4 s. */
  const runSequence = useCallback(
    async (title: string, runs: Run[]) => {
      if (benchRunning.current) return;
      benchRunning.current = true;
      setMode('tavola');
      const rows: BenchRow[] = [];
      setBench({ title, total: runs.length, running: true, rows });
      for (const run of runs) {
        run.setup();
        imgMs.current = null;
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
          label: run.label,
          fps: f.fps,
          worst: f.worst,
          jsMax: jsLag.read().max,
          tapAvg: l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : 0,
          tapMax: l.length ? Math.round(Math.max(...l)) : 0,
          echoAvg: f.echoAvg,
          echoMax: f.echoMax,
          imgMs: imgMs.current,
        });
        setBench({ title, total: runs.length, running: true, rows: [...rows] });
      }
      setAnimate(false);
      setShadow(false);
      setStable(true);
      setCache(false);
      setLayered(false);
      setLiveN(0);
      setAnimN(null);
      setSelected(null);
      setBench({ title, total: runs.length, running: false, rows });
      console.log('S1-BENCH ' + JSON.stringify({ title, rows }));
      benchRunning.current = false;
    },
    [benchReset, benchRead, jsLag, freeIdx, metrics, onTap],
  );

  const prova1 = useCallback(() => {
    const cfgs = [
      { name: 'fermo', animate: false, shadow: false },
      { name: 'Anima', animate: true, shadow: false },
      { name: 'Ombre', animate: false, shadow: true },
      { name: 'Anima+Ombre', animate: true, shadow: true },
    ];
    const mk = (memo: boolean, c: boolean, cfg: (typeof cfgs)[number]): Run => ({
      label: `m${memo ? '+' : '-'} c${c ? '+' : '-'} ${cfg.name}`,
      setup: () => {
        setLayered(false);
        setAnimN(null);
        setStable(memo);
        setCache(c);
        setAnimate(cfg.animate);
        setShadow(cfg.shadow);
      },
    });
    runSequence('Prova 1: memo e cache', [
      mk(false, false, cfgs[0]),
      mk(false, false, cfgs[3]),
      ...cfgs.map((c) => mk(true, false, c)),
      ...cfgs.map((c) => mk(true, true, c)),
    ]);
  }, [runSequence]);

  const prova2 = useCallback(() => {
    const common = () => {
      setStable(true);
      setCache(true);
      setShadow(true);
      setAnimate(true);
    };
    const runs: Run[] = [
      {
        label: 'A tutto dal vivo, 2 animate',
        setup: () => {
          common();
          setLayered(false);
          setAnimN(2);
        },
      },
      ...[0, 2, 8, 24, 96].map((n) => ({
        label: `B a strati, ${n} vive`,
        setup: () => {
          common();
          setAnimN(null);
          setLayered(true);
          setLiveN(n);
        },
      })),
    ];
    runSequence('Prova 2: architettura a strati', runs);
  }, [runSequence]);

  const benchLines = bench.rows.map(
    (r) => `${r.label}: ${r.fps} fps · pegg ${r.worst} · JS ${r.jsMax} · tocco ${r.tapAvg}/${r.tapMax} · eco ${r.echoAvg}/${r.echoMax}${r.imgMs !== null ? ` · img ${r.imgMs}` : ''}`,
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
            <Button label="Strati" on={layered} onPress={() => setLayered((v) => !v)} testID="btn-strati" />
            <Button label={`Vive ${liveN}`} onPress={() => setLiveN((n) => LIVE_STEPS[(LIVE_STEPS.indexOf(n) + 1) % LIVE_STEPS.length])} testID="btn-vive" />
            <Button label={bench.running ? 'Prova…' : 'Prova 1'} on={bench.running} onPress={prova1} testID="btn-prova" />
            <Button label="Prova 2" on={bench.running} onPress={prova2} testID="btn-prova2" />
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
        {loaded && mode === 'tavola' && !layered ? (
          <TileBoard tiles={TILES} svgs={loaded.svgs} width={col.w} height={areaH} animate={animate} shadow={shadow} entranceKey={entranceKey} selected={selected} stable={stable} cache={cache} animatedSet={animatedSet} onTap={onTap} />
        ) : null}
        {loaded && mode === 'tavola' && layered ? (
          <TileBoardLayered tiles={TILES} svgs={loaded.svgs} width={col.w} height={areaH} shadow={shadow} liveIndices={liveIndices} selected={selected} onTap={onTap} onStaticBuilt={onStaticBuilt} />
        ) : null}
        {loaded && mode === 'galleria' ? <Gallery svgs={loaded.svgs} width={col.w} height={areaH} /> : null}
        {bench.rows.length > 0 || bench.running ? (
          <View style={styles.benchPanel} pointerEvents="none">
            <Text style={styles.benchTitle}>{bench.running ? `${bench.title} in corso (${bench.rows.length}/${bench.total})…` : `${bench.title}: completata`}</Text>
            <Text style={styles.benchText}>
              m = memo, c = cache del corpo · pegg = peggior frame · JS = ritardo max thread JS · tocco = gesto→commit JS medio/max · eco = andata e ritorno col thread UI medio/max · img = tempo per costruire l'immagine dello strato fermo · tutto in ms
            </Text>
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
