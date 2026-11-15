import { useEffect, useState } from 'react';
import { Skia, loadData, type SkSVG } from '@shopify/react-native-skia';
import { TILE_SOURCES } from '../infrastructure/content/tileSources';

let loading: Promise<(SkSVG | null)[]> | null = null;
// ponytail: cache del valore già risolto per evitare il flash "Caricamento dei disegni"
// al rimontaggio del componente (es. navigazione impostazioni → partita).
let resolved: readonly (SkSVG | null)[] | null = null;

/** Timeout di sicurezza: se `loadData` si blocca (thread Skia saturo) restituisce `null` dopo `ms` ms. */
function loadWithTimeout(source: (typeof TILE_SOURCES)[number], ms: number): Promise<SkSVG | null> {
  return Promise.race([
    loadData(source, (data) => Skia.SVG.MakeFromData(data), () => undefined).catch(() => null),
    new Promise<null>((res) => setTimeout(() => res(null), ms)),
  ]);
}

/**
 * Carica e analizza i 129 SVG delle tessere in oggetti SkSVG, una volta sola per l'app. Un disegno che non si carica
 * o supera i 10 s di attesa resta `null` e la tessera si disegna senza figura. `loadData` è lo stesso caricatore
 * di `useSVG`: risolve l'asset in modo corretto su Android.
 */
export function loadTileSvgs(): Promise<(SkSVG | null)[]> {
  if (loading === null) {
    loading = Promise.all(
      TILE_SOURCES.map((source) => loadWithTimeout(source, 10_000)),
    ).then((r) => {
      resolved = r;
      return r;
    });
  }
  return loading;
}

/** I disegni delle tessere, oppure `null` finché non sono pronti. */
export function useTileSvgs(): readonly (SkSVG | null)[] | null {
  // Se la Promise è già risolta, inizializza lo stato subito (nessun flash di caricamento).
  const [svgs, setSvgs] = useState<readonly (SkSVG | null)[] | null>(resolved);
  useEffect(() => {
    if (resolved) {
      setSvgs(resolved);
      return;
    }
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
