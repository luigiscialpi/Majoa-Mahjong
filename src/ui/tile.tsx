import { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Group, Image, ImageSVG, LinearGradient, RoundedRect, Shadow, Text, drawAsImage, rect as clipRect, vec, type SkFont, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { Rect } from '../domain/board';
import type { Palette } from '../infrastructure/content/legacyThemes';
import type { TileStatus } from './boardView';

// Disegno di una tessera in Skia, portato dal prototipo S1 (`prototipi/s1-rendering/src/`): corpo, disegno SVG e rimozione.

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

/**
 * Disegna un SVG in (x, y) con dimensione (width, height).
 * Aggira un limite di React Native Skia 2.6.2: `ImageSVG` applica x e y solo se sono ENTRAMBI diversi da zero, quindi con
 * x=0 o y=0 il disegno finisce in (0, 0). La traslazione si fa con un Group. Ritaglia inoltre il disegno sul suo riquadro,
 * come fa il browser con il viewBox (alcuni disegni sporgono di qualche unità).
 */
function SvgAt({ svg, x, y, width, height }: { svg: SkSVG | null; x: number; y: number; width: number; height: number }) {
  return (
    <Group clip={clipRect(x, y, width, height)}>
      <Group transform={[{ translateX: x }, { translateY: y }]}>
        <ImageSVG svg={svg} width={width} height={height} />
      </Group>
    </Group>
  );
}

type BodyProps = { x: number; y: number; w: number; h: number; radius: number; shadow: boolean; palette: Palette };

/** Corpo della tessera: bordo laterale a due toni, ombra (opzionale), faccia sfumata, filo interno. */
function TileBody({ x, y, w, h, radius, shadow, palette }: BodyProps) {
  return (
    <>
      <RoundedRect x={x + 2} y={y + 3} width={w + 2} height={h + 2} r={radius + 1} color={palette[4]} />
      <RoundedRect x={x + 3} y={y + 4} width={w} height={h} r={radius} color={palette[3]}>
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
 * ombra sfocata e sfumatura non si ricalcolano a ogni fotogramma. Restituisce `null` finché non è pronta.
 */
export function useBodyImage(w: number, h: number, radius: number, shadow: boolean, palette: Palette): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);
  useEffect(() => {
    let cancelled = false;
    const dpr = PixelRatio.get();
    const size = { width: Math.ceil((w + 2 * BODY_PAD) * dpr), height: Math.ceil((h + 2 * BODY_PAD) * dpr) };
    drawAsImage(
      <Group transform={[{ scale: dpr }]}>
        <TileBody x={BODY_PAD} y={BODY_PAD} w={w} h={h} radius={radius} shadow={shadow} palette={palette} />
      </Group>,
      size,
    ).then((img) => {
      if (!cancelled) setImage(img);
    });
    return () => {
      cancelled = true;
    };
  }, [w, h, radius, shadow, palette]);
  return image;
}

/** Velo sopra una tessera nascosta (scuro, con «?») o nebbiosa (chiaro). */
function Veil({ rect, radius, color, mark, font }: { rect: Rect; radius: number; color: string; mark: string | null; font: SkFont | null }) {
  const width = font && mark ? font.measureText(mark).width : 0;
  return (
    <>
      <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={radius} color={color} />
      {font && mark ? <Text x={rect.x + (rect.w - width) / 2} y={rect.y + rect.h / 2 + font.getSize() * 0.35} text={mark} font={font} color="#ffe9a8" /> : null}
    </>
  );
}

export type StaticTileProps = { rect: Rect; radius: number; svg: SkSVG | null; shadow: boolean; body: SkImage | null; palette: Palette; status: TileStatus; font: SkFont | null };

/** Tessera ferma: componente senza hook né valori condivisi, adatto a essere disegnato una volta sola in un'immagine. */
export function StaticTile({ rect, radius, svg, shadow, body, palette, status, font }: StaticTileProps) {
  const box = designBox(rect.x, rect.y, rect.w, rect.h);
  const covered = status.locked || status.fog;
  return (
    <>
      {body ? (
        <Group transform={[{ translateX: rect.x - BODY_PAD }, { translateY: rect.y - BODY_PAD }]}>
          <Image image={body} x={0} y={0} width={rect.w + 2 * BODY_PAD} height={rect.h + 2 * BODY_PAD} fit="fill" />
        </Group>
      ) : (
        <TileBody x={rect.x} y={rect.y} w={rect.w} h={rect.h} radius={radius} shadow={shadow} palette={palette} />
      )}
      {covered ? null : <SvgAt svg={svg} x={box.x} y={box.y} width={box.width} height={box.height} />}
      {status.locked ? <Veil rect={rect} radius={radius} color="rgba(35,25,55,0.92)" mark="?" font={font} /> : status.fog ? <Veil rect={rect} radius={radius} color="rgba(245,248,255,0.92)" mark={null} font={font} /> : null}
      {status.gold ? <RoundedRect x={rect.x + 1.5} y={rect.y + 1.5} width={rect.w - 3} height={rect.h - 3} r={radius} style="stroke" strokeWidth={3} color="#ffd54a" /> : null}
    </>
  );
}

/**
 * Tessera in rimozione, come nell'originale (`.tile.gone`): scala 0,6 e rotazione di 8° in 120 ms, dissolvenza in 250 ms.
 * `rm` è l'avanzamento (0-1) dei 250 ms, condiviso da tutte le tessere che si rimuovono insieme.
 */
export function RemovingTile({ rm, ...tile }: StaticTileProps & { rm: SharedValue<number> }) {
  const { x, y, w, h } = tile.rect;
  const transform = useDerivedValue(() => {
    const qt = Math.min(1, rm.value / 0.48);
    const et = 1 - (1 - qt) * (1 - qt);
    return [{ scale: 1 - 0.4 * et }, { rotate: (et * 8 * Math.PI) / 180 }];
  });
  const opacity = useDerivedValue(() => (1 - rm.value) * (1 - rm.value));
  return (
    <Group transform={transform} origin={vec(x + w / 2, y + h / 2)} opacity={opacity}>
      <StaticTile {...tile} />
    </Group>
  );
}
