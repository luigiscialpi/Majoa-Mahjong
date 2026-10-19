import { ScrollView } from 'react-native';
import { Canvas, Fill, type SkSVG } from '@shopify/react-native-skia';
import { SvgAt } from './SvgAt';

const COLS = 6;

/** Griglia dei 129 disegni, nell'ordine dell'indice dell'originale (sei per riga). */
export function Gallery({ svgs, width, height }: { svgs: (SkSVG | null)[]; width: number; height: number }) {
  const cell = width / COLS;
  const cellH = (cell * 80) / 60;
  const rows = Math.ceil(svgs.length / COLS);
  return (
    <ScrollView style={{ width, height }}>
      <Canvas style={{ width, height: rows * cellH }}>
        <Fill color="white" />
        {svgs.map((svg, i) => (
          <SvgAt key={i} svg={svg} x={(i % COLS) * cell} y={Math.floor(i / COLS) * cellH} width={cell} height={cellH} />
        ))}
      </Canvas>
    </ScrollView>
  );
}
