import { useEffect, useState } from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import { Group, ImageFormat, drawAsImage, matchFont, type SkFont, type SkSVG } from '@shopify/react-native-skia';
import type { Palette } from '../infrastructure/content/legacyThemes';
import type { BarSlot } from './selectionBarView';
import { StaticTile } from './tile';

/** La faccia della miniatura nella barra (`.sbslot .mt`, riga 196 dell'originale: 42×54, raggio 9) e il margine per il bordo laterale. */
export const MINI_FACE = { w: 42, h: 54, radius: 9 } as const;
export const MINI_PAD = 6;
/** Una miniatura piccola (`.sbrec .mt`, riga 200: 24×31) è la stessa immagine ridotta, con lo stesso rapporto. */
export const MINI_RECENT = { w: 24, h: 31 } as const;

const cache = new Map<string, Promise<string | null>>();
const miniKey = (slot: BarSlot, palette: Palette) => `${slot}|${palette[3]}|${palette[4]}`;

function markFont(): SkFont | null {
  try {
    return matchFont({ fontFamily: 'sans-serif', fontSize: Math.max(12, MINI_FACE.w * 0.6), fontWeight: 'bold' });
  } catch {
    return null;
  }
}

/**
 * La miniatura come immagine PNG (URI di dati), disegnata una volta sola per disegno e tavolozza con la stessa `StaticTile`
 * della tavola, quindi con lo stesso corpo, la stessa faccia nascosta o nebbiosa: un `<Image>` non costa una superficie GPU
 * per casella (`docs/rendering.md`). `null` se manca il disegno o non si disegna: la casella allora resta crema.
 */
export function loadMiniTileUri(slot: BarSlot, svg: SkSVG | null, palette: Palette): Promise<string | null> {
  if (typeof slot === 'number' && !svg) return Promise.resolve(null); // il disegno non è (ancora) caricato: niente in cache
  const key = miniKey(slot, palette);
  let loading = cache.get(key);
  if (!loading) {
    loading = (async () => {
      try {
        const dpr = PixelRatio.get();
        const size = { width: Math.ceil((MINI_FACE.w + MINI_PAD) * dpr), height: Math.ceil((MINI_FACE.h + MINI_PAD) * dpr) };
        const rect = { x: 0, y: 0, w: MINI_FACE.w, h: MINI_FACE.h };
        const status = { locked: slot === 'locked', fog: slot === 'fog', gold: false, match: false };
        const image = await drawAsImage(
          <Group transform={[{ scale: dpr }]}>
            <StaticTile rect={rect} radius={MINI_FACE.radius} svg={svg} shadow={false} body={null} palette={palette} status={status} font={markFont()} />
          </Group>,
          size,
        );
        return image ? `data:image/png;base64,${image.encodeToBase64(ImageFormat.PNG, 100)}` : null;
      } catch {
        return null;
      }
    })();
    cache.set(key, loading);
  }
  return loading;
}

/** La miniatura di una casella, oppure `null` finché non è pronta: un'immagine di una casella di prima non si mostra mai al suo posto. */
function useMiniTileUri(slot: BarSlot, svgs: readonly (SkSVG | null)[], palette: Palette): string | null {
  const [loaded, setLoaded] = useState<{ key: string; uri: string | null } | null>(null);
  const svg = typeof slot === 'number' ? (svgs[slot] ?? null) : null;
  const key = miniKey(slot, palette);
  useEffect(() => {
    let cancelled = false;
    loadMiniTileUri(slot, svg, palette).then((uri) => {
      if (!cancelled) setLoaded({ key, uri });
    });
    return () => {
      cancelled = true;
    };
  }, [slot, svg, palette, key]);
  return loaded?.key === key ? loaded.uri : null;
}

type MiniTileProps = { slot: BarSlot; svgs: readonly (SkSVG | null)[]; palette: Palette; width: number; height: number; testID?: string };

/** Una tessera in miniatura; decorativa (il nome è nel testo della barra). La crema sotto copre il tempo del disegno. */
export function MiniTile({ slot, svgs, palette, width, height, testID }: MiniTileProps) {
  const uri = useMiniTileUri(slot, svgs, palette);
  const k = width / MINI_FACE.w;
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {uri ? <Image source={{ uri }} style={[styles.image, { width: (MINI_FACE.w + MINI_PAD) * k, height: (MINI_FACE.h + MINI_PAD) * k }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ image: { position: 'absolute', left: 0, top: 0 } });
