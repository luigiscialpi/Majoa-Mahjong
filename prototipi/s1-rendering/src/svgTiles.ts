import { Skia, loadData, type SkSVG } from '@shopify/react-native-skia';
import { TILE_SOURCES } from './data/tileSources';

export type LoadedTiles = { svgs: (SkSVG | null)[]; loaded: number; failed: number; ms: number; firstError: string | null };

/**
 * Carica e analizza i 129 SVG delle tessere (asset statici) in oggetti SkSVG.
 * `loadData` è lo stesso caricatore di `useSVG`: risolve l'asset in modo corretto su Android, iOS e web.
 */
export async function loadTileSvgs(): Promise<LoadedTiles> {
  const t0 = Date.now();
  let firstError: string | null = null;
  const svgs = await Promise.all(
    TILE_SOURCES.map((source, i) =>
      loadData(source, (data) => Skia.SVG.MakeFromData(data), (e) => {
        if (firstError === null) firstError = `disegno ${i}: ${e.message}`;
      }).catch((e: unknown) => {
        if (firstError === null) firstError = `disegno ${i}: ${String(e)}`;
        return null;
      }),
    ),
  );
  const loaded = svgs.filter((s) => s !== null).length;
  return { svgs, loaded, failed: svgs.length - loaded, ms: Date.now() - t0, firstError };
}
