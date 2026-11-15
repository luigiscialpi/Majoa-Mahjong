import { useEffect, useState } from 'react';
import { Skia, loadData, type SkSVG } from '@shopify/react-native-skia';
import { TILE_SOURCES } from '../infrastructure/content/tileSources';

let loading: Promise<(SkSVG | null)[]> | null = null;
// ponytail: cache in memoria del risultato una volta risolto, per evitare flash
// di caricamento o ricaricamenti inutili durante la navigazione.
let resolved: readonly (SkSVG | null)[] | null = null;

/**
 * Esegue una funzione asincrona su un array con concorrenza massima limitata.
 * Evita di intasare il pool di connessioni HTTP (es. Metro su ADB reverse)
 * con 129 richieste simultanee.
 */
async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Carica un singolo SVG con timeout pulito (senza timer orfani) e riprova fino a 2 volte. */
async function loadSingle(source: (typeof TILE_SOURCES)[number], maxRetries = 2): Promise<SkSVG | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<null>((res) => {
        timer = setTimeout(() => res(null), 5000);
      });
      const dataPromise = loadData(source, (data) => Skia.SVG.MakeFromData(data), () => undefined).catch(() => null);

      const result = await Promise.race([dataPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      if (result) return result;
    } catch {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Carica e analizza i 129 SVG delle tessere in oggetti SkSVG, una volta sola per l'app.
 * Usa un pool concorrente di 8 richieste alla volta per non saturare il server/Metro.
 */
export function loadTileSvgs(): Promise<(SkSVG | null)[]> {
  if (resolved) {
    return Promise.resolve(resolved as (SkSVG | null)[]);
  }
  if (loading === null) {
    loading = mapConcurrent(TILE_SOURCES, 8, (source) => loadSingle(source)).then((r) => {
      resolved = r;
      loading = null;
      return r;
    });
  }
  return loading;
}

/** I disegni delle tessere, oppure `null` finché non sono pronti. */
export function useTileSvgs(): readonly (SkSVG | null)[] | null {
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
