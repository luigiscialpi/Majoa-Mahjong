import { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Group, LinearGradient, RoundedRect, Shadow, drawAsImage, vec, type SkImage } from '@shopify/react-native-skia';

// Tavolozza del livello 20 dell'originale: [feltro chiaro, feltro scuro, accento, bordo, bordo scuro].
export const PALETTE = ['#e0742a', '#6a1f4a', '#fff1a8', '#f09a3a', '#8a3a1f'];
/** Margine attorno alla tessera nell'immagine in cache: contiene bordo laterale e ombra sfocata. */
export const BODY_PAD = 16;

/** Riquadro in cui sta il disegno della tessera: area interna (padding 3px 4px dell'originale), «meet» e centrato. */
export function designBox(x: number, y: number, w: number, h: number) {
  const iw = w - 8;
  const ih = h - 6;
  const scale = Math.min(iw / 60, ih / 80);
  const width = 60 * scale;
  const height = 80 * scale;
  return { x: x + 4 + (iw - width) / 2, y: y + 3 + (ih - height) / 2, width, height };
}

type BodyProps = { x: number; y: number; w: number; h: number; radius: number; shadow: boolean };

/** Corpo della tessera: bordo laterale a due toni, ombra (opzionale), faccia sfumata, filo interno. */
export function TileBody({ x, y, w, h, radius, shadow }: BodyProps) {
  return (
    <>
      <RoundedRect x={x + 2} y={y + 3} width={w + 2} height={h + 2} r={radius + 1} color={PALETTE[4]} />
      <RoundedRect x={x + 3} y={y + 4} width={w} height={h} r={radius} color={PALETTE[3]}>
        {shadow ? <Shadow dx={4} dy={6} blur={5} color="rgba(0,0,0,0.45)" /> : null}
      </RoundedRect>
      <RoundedRect x={x} y={y} width={w} height={h} r={radius}>
        <LinearGradient start={vec(x, y)} end={vec(x + w, y + h)} colors={['#fffdf3', '#f6edd2', '#eadcb4']} positions={[0, 0.6, 1]} />
      </RoundedRect>
      <RoundedRect x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h - 1.5} r={radius} style="stroke" strokeWidth={1.5} color="rgba(120,95,40,0.35)" />
    </>
  );
}

/**
 * Disegna il corpo della tessera una sola volta in un'immagine (`drawAsImage`) condivisa da tutte le tessere:
 * ombra sfocata e sfumatura non si ricalcolano a ogni fotogramma. Restituisce `null` se disattivato o in preparazione.
 */
export function useBodyImage(enabled: boolean, w: number, h: number, radius: number, shadow: boolean): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);
  useEffect(() => {
    if (!enabled) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const dpr = PixelRatio.get();
    const size = { width: Math.ceil((w + 2 * BODY_PAD) * dpr), height: Math.ceil((h + 2 * BODY_PAD) * dpr) };
    drawAsImage(
      <Group transform={[{ scale: dpr }]}>
        <TileBody x={BODY_PAD} y={BODY_PAD} w={w} h={h} radius={radius} shadow={shadow} />
      </Group>,
      size,
    ).then((img) => {
      if (!cancelled) setImage(img);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, w, h, radius, shadow]);
  return image;
}
