import { useEffect, useState } from 'react';
import { Skia, loadData, type SkSVG } from '@shopify/react-native-skia';
import { TILE_SOURCES } from '../infrastructure/content/tileSources';

let loading: Promise<(SkSVG | null)[]> | null = null;

/**
 * Carica e analizza i 129 SVG delle tessere in oggetti SkSVG, una volta sola per l'app. Un disegno che non si carica
 * resta `null` e la tessera si disegna senza figura. `loadData` è lo stesso caricatore di `useSVG`: risolve l'asset
 * in modo corretto su Android.
 */
export function loadTileSvgs(): Promise<(SkSVG | null)[]> {
  if (loading === null) {
    loading = Promise.all(TILE_SOURCES.map((source) => loadData(source, (data) => Skia.SVG.MakeFromData(data), () => undefined).catch(() => null)));
  }
  return loading;
}

/** I disegni delle tessere, oppure `null` finché non sono pronti. */
export function useTileSvgs(): readonly (SkSVG | null)[] | null {
  const [svgs, setSvgs] = useState<readonly (SkSVG | null)[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadTileSvgs().then((loaded) => {
      if (!cancelled) setSvgs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return svgs;
}
