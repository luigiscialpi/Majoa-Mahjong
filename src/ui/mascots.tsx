import { useEffect, useState } from 'react';
import { ImageFormat, ImageSVG, Skia, drawAsImage, loadData } from '@shopify/react-native-skia';
import type { Mascot, MascotId } from '../domain/mascot';
import { MASCOT_SOURCES } from '../infrastructure/content/mascotSources';

/**
 * Dimensione della rasterizzazione: stesso rapporto del `viewBox` delle mascotte (100×112 = 25:28), così Skia non deve
 * adattare un disegno non quadrato a un riquadro e la posizione nel medaglione la decide `resizeMode="contain"`.
 */
export const MASCOT_RASTER = { width: 250, height: 280 } as const;

const cache = new Map<MascotId, Promise<string | null>>();

/**
 * La mascotte come immagine PNG (URI di dati), disegnata una volta sola per l'app: un `<Image>` normale costa molto meno di un
 * canvas Skia dentro una scritta che compare e sparisce (ogni canvas è una superficie GPU, `docs/rendering.md`). `null` se
 * il disegno non si carica o non si disegna: la mascotte allora manca e il resto si vede lo stesso. Un errore resta in
 * memoria fino alla chiusura dell'app, per non ripetere un disegno che non riesce.
 */
export function loadMascotUri(id: MascotId): Promise<string | null> {
  let loading = cache.get(id);
  if (!loading) {
    loading = (async () => {
      try {
        const svg = await loadData(MASCOT_SOURCES[id], (data) => Skia.SVG.MakeFromData(data), () => undefined);
        if (!svg) return null;
        const image = await drawAsImage(<ImageSVG svg={svg} width={MASCOT_RASTER.width} height={MASCOT_RASTER.height} />, MASCOT_RASTER);
        return image ? `data:image/png;base64,${image.encodeToBase64(ImageFormat.PNG, 100)}` : null;
      } catch {
        return null;
      }
    })();
    cache.set(id, loading);
  }
  return loading;
}

/** L'immagine della mascotte scelta, oppure `null` con «nessuna» o finché non è pronta. */
export function useMascotUri(mascot: Mascot): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (mascot === 'none') {
      setUri(null);
      return;
    }
    let cancelled = false;
    loadMascotUri(mascot).then((loaded) => {
      // Solo se c'è qualcosa di nuovo: un aggiornamento a parità di valore, a render in coda, fa avvisare React fuori da `act`.
      if (!cancelled && loaded !== null) setUri(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [mascot]);
  return mascot === 'none' ? null : uri;
}
