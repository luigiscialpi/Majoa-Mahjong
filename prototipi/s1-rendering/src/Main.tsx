import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import level20 from './data/level20.json';
import { boardMetrics, freeIndices, gameColumn, visibleFraction, type Metrics, type Tile } from './board';
import { layerEquivalence } from './equivalence';
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
const REMOVE_MS = 260;
const PAIR_EVERY_MS = 1000;
const EMPTY: ReadonlySet<number> = new Set();

type Cfg = {
  layered?: boolean;
  stable?: boolean;
  cache?: boolean;
  staticCache?: boolean;
  autoLive?: boolean;
  animate?: boolean;
  shadow?: boolean;
  liveN?: number;
  animN?: number | null;
};
/** Una configurazione della prova. `setup` può restituire una funzione di pulizia; `measureMs` sostituisce la durata di misura. */
type Run = { label: string; setup: () => void | (() => void); measureMs?: number };
type BenchRow = { label: string; fps: number; worst: number; jsMax: number; tapAvg: number; tapMax: number; echoAvg: number; echoMax: number; img: string | null; ghosts: number | null };
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
  const [staticCache, setStaticCache] = useState(false);
  const [layered, setLayered] = useState(false);
  const [autoLive, setAutoLive] = useState(false);
  const [liveN, setLiveN] = useState(0);
  const [liveShift, setLiveShift] = useState(0);
  const [animN, setAnimN] = useState<number | null>(null);
  const [gone, setGone] = useState<ReadonlySet<number>>(EMPTY);
  const [removing, setRemoving] = useState<ReadonlySet<number>>(EMPTY);
  const [removeKey, setRemoveKey] = useState(0);
  const [entranceKey, setEntranceKey] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tapInfo, setTapInfo] = useState('Tocca una tessera');
  const [bench, setBench] = useState<Bench>({ title: '', total: 0, running: false, rows: [] });
  const { stats, ping, benchReset, benchRead } = useFrameStats();
  const jsLag = useJsLag();
  const tapT0 = useRef(0);
  const latencies = useRef<number[]>([]);
  const benchRunning = useRef(false);
  const imgTimes = useRef<number[]>([]);
  const ghosts = useRef(0);
  const goneRef = useRef<ReadonlySet<number>>(EMPTY);
  const simStop = useRef<(() => void) | null>(null);
  const [equiv, setEquiv] = useState('Confronto strato fermo / vivo: —');

  useEffect(() => {
    loadTileSvgs().then(setLoaded);
  }, []);

  const areaH = Math.max(100, col.h - HEADER_H);
  const metrics = useMemo(() => boardMetrics(TILES, col.w, areaH), [col.w, areaH]);
  const freeIdx = useMemo(() => freeIndices(TILES), []);
  // Ordine con cui si scelgono le tessere animate: prima le libere, poi le altre; `liveShift` fa scorrere la finestra.
  const liveOrder = useMemo(() => [...freeIdx, ...TILES.map((_, i) => i).filter((i) => !freeIdx.includes(i))], [freeIdx]);
  const liveIndices = useMemo(() => {
    const k = liveShift % liveOrder.length;
    return [...liveOrder.slice(k), ...liveOrder.slice(0, k)].slice(0, liveN);
  }, [liveOrder, liveN, liveShift]);
  const animatedSet = useMemo(() => (animN === null ? null : new Set(liveOrder.slice(0, animN))), [animN, liveOrder]);
  const touch = useMemo(() => {
    // Area minima raggiungibile al tocco tra le tessere libere (campionamento a 3 px).
    const minVisible = Math.min(...freeIdx.map((i) => visibleFraction(TILES, metrics, i, 3)));
    return { free: freeIdx.length, minVisiblePct: Math.round(minVisible * 100) };
  }, [metrics, freeIdx]);

  const onTap = useCallback(
    (index: number | null, m: Metrics) => {
      tapT0.current = performance.now();
      ping();
      setSelected(index);
      if (index === null) setTapInfo('Tocco fuori dalle tessere');
      else {
        const t = TILES[index];
        setTapInfo(`Tessera #${index} (x${t.x} y${t.y} z${t.z}) · disegno ${t.type} · ${Math.round(m.tw)}×${Math.round(m.th)} dp`);
      }
    },
    [ping],
  );

  const onStaticBuilt = useCallback((ms: number) => {
    imgTimes.current.push(ms);
  }, []);

  const applyCfg = useCallback((c: Cfg) => {
    setLayered(c.layered ?? false);
    setStable(c.stable ?? true);
    setCache(c.cache ?? false);
    setStaticCache(c.staticCache ?? false);
    setAutoLive(c.autoLive ?? false);
    setAnimate(c.animate ?? false);
    setShadow(c.shadow ?? false);
    setLiveN(c.liveN ?? 0);
    setLiveShift(0);
    setAnimN(c.animN ?? null);
    goneRef.current = EMPTY;
    setGone(EMPTY);
    setRemoving(EMPTY);
    setSelected(null);
  }, []);

  /** Partita simulata: ogni secondo rimuove la prima e l'ultima tessera libera, con l'animazione di rimozione; ricomincia a tavola vuota. */
  const startSim = useCallback(() => {
    let stopped = false;
    (async () => {
      while (!stopped) {
        const free = freeIndices(TILES, goneRef.current);
        if (free.length < 2) {
          await sleep(1500);
          goneRef.current = EMPTY;
          setGone(EMPTY);
          continue;
        }
        const pair = new Set([free[0], free[free.length - 1]]);
        setRemoving(pair);
        setRemoveKey((k) => k + 1);
        await sleep(REMOVE_MS + 40);
        const next = new Set([...goneRef.current, ...pair]);
        goneRef.current = next;
        setGone(next);
        setRemoving(EMPTY);
        await sleep(PAIR_EVERY_MS - REMOVE_MS - 40);
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  /** Esegue una sequenza di configurazioni: riscaldamento, poi misura con un tocco simulato ogni 0,4 s su una tessera libera. */
  const runSequence = useCallback(
    async (title: string, runs: Run[]) => {
      if (benchRunning.current) return;
      benchRunning.current = true;
      simStop.current?.();
      setMode('tavola');
      const rows: BenchRow[] = [];
      setBench({ title, total: runs.length, running: true, rows });
      for (const run of runs) {
        const cleanup = run.setup();
        imgTimes.current = [];
        ghosts.current = 0;
        await sleep(WARMUP_MS);
        benchReset();
        jsLag.reset();
        latencies.current = [];
        imgTimes.current = [];
        ghosts.current = 0;
        const t0 = Date.now();
        let k = 0;
        while (Date.now() - t0 < (run.measureMs ?? MEASURE_MS)) {
          const free = freeIndices(TILES, goneRef.current);
          if (free.length > 0) onTap(free[k++ % free.length], metrics);
          await sleep(TAP_EVERY_MS);
        }
        const f = benchRead();
        const l = latencies.current;
        const it = imgTimes.current;
        rows.push({
          label: run.label,
          fps: f.fps,
          worst: f.worst,
          jsMax: jsLag.read().max,
          tapAvg: l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : 0,
          tapMax: l.length ? Math.round(Math.max(...l)) : 0,
          echoAvg: f.echoAvg,
          echoMax: f.echoMax,
          img: it.length ? `${Math.round(it.reduce((a, b) => a + b, 0) / it.length)}/${Math.round(Math.max(...it))} (${it.length})` : null,
          ghosts: run.label.startsWith('Partita') ? ghosts.current : null,
        });
        if (typeof cleanup === 'function') cleanup();
        setBench({ title, total: runs.length, running: true, rows: [...rows] });
      }
      applyCfg({});
      setBench({ title, total: runs.length, running: false, rows });
      console.log('S1-BENCH ' + JSON.stringify({ title, rows }));
      benchRunning.current = false;
    },
    [benchReset, benchRead, jsLag, metrics, onTap, applyCfg],
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
      setup: () => applyCfg({ stable: memo, cache: c, animate: cfg.animate, shadow: cfg.shadow }),
    });
    runSequence('Prova 1: memo e cache', [mk(false, false, cfgs[0]), mk(false, false, cfgs[3]), ...cfgs.map((c) => mk(true, false, c)), ...cfgs.map((c) => mk(true, true, c))]);
  }, [runSequence, applyCfg]);

  const prova2 = useCallback(() => {
    const runs: Run[] = [
      { label: 'A tutto dal vivo, 2 animate', setup: () => applyCfg({ cache: true, shadow: true, animate: true, animN: 2 }) },
      ...[0, 2, 8, 24, 96].map((n) => ({
        label: `B a strati, ${n} vive`,
        setup: () => applyCfg({ layered: true, shadow: true, animate: true, liveN: n }),
      })),
    ];
    runSequence('Prova 2: architettura a strati', runs);
  }, [runSequence, applyCfg]);

  const prova3 = useCallback(() => {
    const rebuild = (cfg: Cfg): (() => void) => {
      applyCfg(cfg);
      let k = 0;
      const id = setInterval(() => setLiveShift(++k), 800);
      return () => clearInterval(id);
    };
    const runs: Run[] = [
      { label: 'B 26 vive', setup: () => applyCfg({ layered: true, shadow: true, animate: true, liveN: 26 }) },
      { label: 'B 48 vive', setup: () => applyCfg({ layered: true, shadow: true, animate: true, liveN: 48 }) },
      { label: 'B 24 vive, cache nello strato fermo', setup: () => applyCfg({ layered: true, shadow: true, animate: true, liveN: 24, staticCache: true }) },
      { label: 'B 24 vive, ricostruzione ogni 0,8 s', setup: () => rebuild({ layered: true, shadow: true, animate: true, liveN: 24 }), measureMs: 8000 },
      { label: 'B 24 vive, ricostruzione ogni 0,8 s, cache', setup: () => rebuild({ layered: true, shadow: true, animate: true, liveN: 24, staticCache: true }), measureMs: 8000 },
    ];
    runSequence('Prova 3: tessere vive e ricostruzioni', runs);
  }, [runSequence, applyCfg]);

  const prova4 = useCallback(() => {
    const game = (cache: boolean): (() => void) => {
      applyCfg({ layered: true, autoLive: true, shadow: true, staticCache: cache });
      return startSim();
    };
    const runs: Run[] = [
      { label: 'Partita simulata, strato fermo normale', setup: () => game(false), measureMs: 20000 },
      { label: 'Partita simulata, strato fermo con cache', setup: () => game(true), measureMs: 20000 },
    ];
    runSequence('Prova 4: partita simulata', runs);
  }, [runSequence, applyCfg, startSim]);

  const toggleGame = useCallback(() => {
    if (simStop.current) {
      simStop.current();
      simStop.current = null;
      applyCfg({});
    } else {
      applyCfg({ layered: true, autoLive: true, shadow: true, staticCache: true });
      simStop.current = startSim();
    }
  }, [applyCfg, startSim]);

  const runEquivalence = useCallback(async () => {
    if (!loaded) return;
    setEquiv('Confronto in corso…');
    try {
      const r = await layerEquivalence(TILES, loaded.svgs, metrics, col.w, areaH, shadow);
      setEquiv(`Confronto strato fermo / vivo: ${r.diffPct}% dei pixel diversi (soglia 12/255), differenza massima ${r.maxDiff}/255, ${r.ms} ms`);
    } catch (e) {
      setEquiv(`Confronto non riuscito: ${String(e)}`);
    }
  }, [loaded, metrics, col.w, areaH, shadow]);

  const benchLines = bench.rows.map(
    (r) =>
      `${r.label}: ${r.fps} fps · pegg ${r.worst} · JS ${r.jsMax} · tocco ${r.tapAvg}/${r.tapMax} · eco ${r.echoAvg}/${r.echoMax}${r.img !== null ? ` · img ${r.img}` : ''}${r.ghosts !== null ? ` · fantasmi ${r.ghosts}` : ''}`,
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
            <Button label="Partita" on={autoLive} onPress={toggleGame} testID="btn-partita" />
          </View>
          <View style={styles.row}>
            <Button label="Prova 1" on={bench.running} onPress={prova1} testID="btn-prova" />
            <Button label="Prova 2" on={bench.running} onPress={prova2} testID="btn-prova2" />
            <Button label="Prova 3" on={bench.running} onPress={prova3} testID="btn-prova3" />
            <Button label="Prova 4" on={bench.running} onPress={prova4} testID="btn-prova4" />
            <Button label="Confronto" onPress={runEquivalence} testID="btn-confronto" />
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
          <Text style={styles.info} testID="equiv-info">{equiv}</Text>
        </View>
        {loaded && mode === 'tavola' && !layered ? (
          <TileBoard tiles={TILES} svgs={loaded.svgs} width={col.w} height={areaH} animate={animate} shadow={shadow} entranceKey={entranceKey} selected={selected} stable={stable} cache={cache} animatedSet={animatedSet} onTap={onTap} />
        ) : null}
        {loaded && mode === 'tavola' && layered ? (
          <TileBoardLayered
            tiles={TILES}
            svgs={loaded.svgs}
            width={col.w}
            height={areaH}
            shadow={shadow}
            liveIndices={liveIndices}
            autoLive={autoLive}
            gone={gone}
            removing={removing}
            removeKey={removeKey}
            staticCache={staticCache}
            selected={selected}
            onTap={onTap}
            onStaticBuilt={onStaticBuilt}
            ghosts={ghosts}
          />
        ) : null}
        {loaded && mode === 'galleria' ? <Gallery svgs={loaded.svgs} width={col.w} height={areaH} /> : null}
        {bench.rows.length > 0 || bench.running ? (
          <View style={styles.benchPanel} pointerEvents="none">
            <Text style={styles.benchTitle}>{bench.running ? `${bench.title} in corso (${bench.rows.length}/${bench.total})…` : `${bench.title}: completata`}</Text>
            <Text style={styles.benchText}>
              m = memo, c = cache del corpo · pegg = peggior frame · JS = ritardo max thread JS · tocco = gesto→commit JS medio/max · eco = andata e ritorno col thread UI medio/max · img = tempo medio/max (e numero) per costruire l'immagine dello strato fermo · fantasmi = tessere rimosse ancora visibili nell'immagine · tutto in ms
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
