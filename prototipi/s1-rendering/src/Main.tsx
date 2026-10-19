import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import level20 from './data/level20.json';
import { boardMetrics, gameColumn, isFree, visibleFraction, type Metrics, type Tile } from './board';
import { FpsMeter } from './FpsMeter';
import { Gallery } from './Gallery';
import { loadTileSvgs, type LoadedTiles } from './svgTiles';
import { TileBoard } from './TileBoard';

const TILES: Tile[] = level20.tiles;
const HEADER_H = 150;

function Button({ label, on, onPress, testID }: { label: string; on?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={[styles.btn, on && styles.btnOn]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export default function Main() {
  const { width, height } = useWindowDimensions();
  const col = gameColumn(width, height);
  const [loaded, setLoaded] = useState<LoadedTiles | null>(null);
  const [mode, setMode] = useState<'tavola' | 'galleria'>('tavola');
  const [animate, setAnimate] = useState(false);
  const [shadow, setShadow] = useState(false);
  const [entranceKey, setEntranceKey] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tapInfo, setTapInfo] = useState('Tocca una tessera');

  useEffect(() => {
    loadTileSvgs().then(setLoaded);
  }, []);

  const areaH = Math.max(100, col.h - HEADER_H);
  const metrics = useMemo(() => boardMetrics(TILES, col.w, areaH), [col.w, areaH]);
  const touch = useMemo(() => {
    // Tessere libere (le sole selezionabili) e area minima raggiungibile al tocco tra queste (campionamento a 3 px).
    const free = TILES.map((_, i) => i).filter((i) => isFree(TILES, i));
    const minVisible = Math.min(...free.map((i) => visibleFraction(TILES, metrics, i, 3)));
    return { free: free.length, minVisiblePct: Math.round(minVisible * 100) };
  }, [metrics]);

  const onTap = useCallback((index: number | null, m: Metrics) => {
    setSelected(index);
    if (index === null) setTapInfo('Tocco fuori dalle tessere');
    else {
      const t = TILES[index];
      setTapInfo(`Tessera #${index} (x${t.x} y${t.y} z${t.z}) · disegno ${t.type} · ${Math.round(m.tw)}×${Math.round(m.th)} dp`);
    }
  }, []);

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
          </View>
          <Text style={styles.info} testID="svg-info">
            {loaded ? `SVG: ${loaded.loaded}/${loaded.svgs.length} in ${loaded.ms} ms${loaded.failed ? ` · ${loaded.failed} falliti: ${loaded.firstError}` : ''}` : 'SVG: caricamento…'}
          </Text>
          <Text style={styles.info} testID="board-info">
            {`Tessere ${TILES.length} · libere ${touch.free} (tocco ≥ ${touch.minVisiblePct}% dell'area) · piani ${metrics.maxZ + 1} · tessera ${Math.round(metrics.tw)}×${Math.round(metrics.th)} dp`}
          </Text>
          <FpsMeter style={styles.info} />
          <Text style={styles.info} testID="tap-info">{tapInfo}</Text>
        </View>
        {loaded && mode === 'tavola' ? (
          <TileBoard tiles={TILES} svgs={loaded.svgs} width={col.w} height={areaH} animate={animate} shadow={shadow} entranceKey={entranceKey} selected={selected} onTap={onTap} />
        ) : null}
        {loaded && mode === 'galleria' ? <Gallery svgs={loaded.svgs} width={col.w} height={areaH} /> : null}
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
});
