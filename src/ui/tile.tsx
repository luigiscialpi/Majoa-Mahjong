import { useEffect, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Circle, Group, Image, ImageSVG, LinearGradient, Path, RoundedRect, Shadow, Text, drawAsImage, rect as clipRect, vec, type SkFont, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { Profile } from '../domain/profile';
import type { Rect } from '../domain/board';
import type { Palette } from '../infrastructure/content/legacyThemes';
import type { TileStatus } from './boardView';

/**
 * Colore dell'oscuramento per tessere bloccate (non libere) in base al profilo di difficoltà.
 * Valori ricavati dalle regole CSS dell'originale (righe 48, 49, 285, 286 HTML):
 * - Facile, Normale, Medio: brightness(.58) -> overlay 'rgba(0,0,0,0.40)'
 * - Difficile (nodim): brightness(.66) -> overlay 'rgba(0,0,0,0.28)'
 * - Esperto (nodim2): brightness(.82) -> overlay 'rgba(0,0,0,0.15)'
 * - Maestro (nodim3): nessun oscuramento (null)
 */
export function blockedDimOverlay(profile: Profile = 'normal'): string | null {
  switch (profile) {
    case 'easy':
    case 'normal':
    case 'medium':
      return 'rgba(0,0,0,0.40)';
    case 'hard':
      return 'rgba(0,0,0,0.28)';
    case 'expert':
      return 'rgba(0,0,0,0.15)';
    case 'master':
      return null;
  }
}

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
 * Genera il path SVG di una stella a 5 punte (10 punti alternati, raggio esterno R, interno r).
 * Stessa formula di `starPath(cx, cy, R, r)` nell'originale (riga 684 HTML).
 */
export function starPathD(cx: number, cy: number, R: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? R : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
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

/**
 * Faccia della tessera nascosta: sfondo viola scuro con cerchio tratteggiato, stella, «?» e lucchetto.
 * Scala i vettori originali (viewBox 0 0 60 80, righe 1883-1887 HTML) al riquadro reale della tessera.
 */
function LockedFace({ rect, radius, font }: { rect: Rect; radius: number; font: SkFont | null }) {
  const scale = Math.min((rect.w - 8) / 60, (rect.h - 6) / 80);
  const ox = rect.x + (rect.w - 60 * scale) / 2;
  const oy = rect.y + (rect.h - 80 * scale) / 2;
  // Dimensione del «?» per centrarlo orizzontalmente
  const qWidth = font ? font.measureText('?').width : 0;
  return (
    <>
      {/* Sfondo degradante viola-indaco (CSS .tile.locked riga 61 HTML) */}
      <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={radius}>
        <LinearGradient
          start={vec(rect.x, rect.y)}
          end={vec(rect.x + rect.w, rect.y + rect.h)}
          colors={['#4f4a82', '#2a2552', '#1f1b40']}
          positions={[0, 0.7, 1]}
        />
      </RoundedRect>
      {/* Bordo interno dorato (inset 0 0 0 1.5px rgba(255,207,90,.55)) */}
      <RoundedRect x={rect.x + 1.5} y={rect.y + 1.5} width={rect.w - 3} height={rect.h - 3} r={radius} style="stroke" strokeWidth={1.5} color="rgba(255,207,90,0.55)" />
      {/* Cerchio tratteggiato: circle cx=30 cy=40 r=27 stroke-dasharray="3 3" */}
      <Circle
        cx={ox + 30 * scale}
        cy={oy + 40 * scale}
        r={27 * scale}
        style="stroke"
        strokeWidth={1.6}
        color="rgba(255,207,90,0.65)"
      />
      {/* Stella a 5 punte: starPath(30,19,8.5,3.8) */}
      <Path
        path={starPathD(ox + 30 * scale, oy + 19 * scale, 8.5 * scale, 3.8 * scale)}
        style="stroke"
        strokeWidth={1.6}
        strokeJoin="round"
        color="#ffcf5a"
      />
      {/* «?» centrato verticalmente a y=55 nell'originale */}
      {font ? (
        <Text
          x={ox + 30 * scale - qWidth / 2}
          y={oy + 55 * scale}
          text="?"
          font={font}
          color="#ffcf5a"
        />
      ) : null}
      {/* Base del lucchetto: rect x=24 y=60 width=12 height=9 rx=2 */}
      <RoundedRect
        x={ox + 24 * scale}
        y={oy + 60 * scale}
        width={12 * scale}
        height={9 * scale}
        r={2 * scale}
        color="#ffcf5a"
      />
      {/* Arco del lucchetto: M26.5 60 v-3 a3.5 3.5 0 0 1 7 0 v3 */}
      <Path
        path={`M${(ox + 26.5 * scale).toFixed(1)} ${(oy + 60 * scale).toFixed(1)} v${(-3 * scale).toFixed(1)} a${(3.5 * scale).toFixed(1)} ${(3.5 * scale).toFixed(1)} 0 0 1 ${(7 * scale).toFixed(1)} 0 v${(3 * scale).toFixed(1)}`}
        style="stroke"
        strokeWidth={1.8}
        color="#ffcf5a"
      />
    </>
  );
}

/**
 * Faccia della tessera nebbiosa: sfondo azzurro chiaro con nuvola e «?».
 * Vettori originali (riga 1888-1889 HTML), scalati al riquadro reale.
 */
function FogFace({ rect, radius, font }: { rect: Rect; radius: number; font: SkFont | null }) {
  const scale = Math.min((rect.w - 8) / 60, (rect.h - 6) / 80);
  const ox = rect.x + (rect.w - 60 * scale) / 2;
  const oy = rect.y + (rect.h - 80 * scale) / 2;
  const qWidth = font ? font.measureText('?').width : 0;

  // Helper per scalare un path SVG con coordinate assolute (solo comandi M, L, Q, Z)
  const sp = (d: string) => {
    return d.replace(/(-?\d+\.?\d*)/g, (m) => (parseFloat(m) * scale).toFixed(1))
            .replace(/M/g, `M${ox.toFixed(1)}+`)  // placeholder, usiamo la traslazione del Group
            .replace(/M([^+]+)\+/g, `M$1`);
  };
  void sp; // non usato: scalare con Group+transform è più semplice

  return (
    <>
      {/* Sfondo degradante azzurro (CSS .tile.fog riga 287 HTML) */}
      <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={radius}>
        <LinearGradient
          start={vec(rect.x, rect.y)}
          end={vec(rect.x + rect.w, rect.y + rect.h)}
          colors={['#f1f5fa', '#c9d6e4', '#aebdd0']}
          positions={[0, 0.7, 1]}
        />
      </RoundedRect>
      {/* Vettori scalati tramite Group di traslazione e scala */}
      <Group transform={[{ translateX: ox }, { translateY: oy }, { scale }]}>
        {/* Cerchio base: circle cx=30 cy=40 r=28 fill=#c9d6e4 */}
        <Circle cx={30} cy={40} r={28} color="#c9d6e4" />
        {/* Nuvola: M12 52 Q6 42 17 39 Q18 28 30 30 Q41 24 45 36 Q56 37 52 52Z */}
        <Path
          path="M12 52 Q6 42 17 39 Q18 28 30 30 Q41 24 45 36 Q56 37 52 52Z"
          color="#ffffff"
          style="fill"
        />
        <Path
          path="M12 52 Q6 42 17 39 Q18 28 30 30 Q41 24 45 36 Q56 37 52 52Z"
          color="#8fa3b8"
          style="stroke"
          strokeWidth={1.8}
          strokeJoin="round"
        />
        {/* Curva inferiore: M17 58 Q30 64 44 58 */}
        <Path
          path="M17 58 Q30 64 44 58"
          color="#9fb2c6"
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
        />
      </Group>
      {/* «?» centrato a y=50 dell'originale */}
      {font ? (
        <Text
          x={ox + 31 * scale - qWidth / 2}
          y={oy + 50 * scale}
          text="?"
          font={font}
          color="#8fa3b8"
        />
      ) : null}
    </>
  );
}

/**
 * Scintilla vettoriale «✨» (dual 4-point star) a posto dell'emoji, sicura su qualsiasi font.
 * Coordinate dell'originale: top-left della tessera, offset -10 -10 in CSS; qui a +3 +3 dal bordo.
 * Il path è una stella a 4 punte (R=5, r=2) sovrapposta a una ruotata di 45°.
 */
function Sparkle({ x, y, size }: { x: number; y: number; size: number }) {
  const r = size / 2;
  const ri = r * 0.38;
  // Stelle a 4 punte: due path sfalsati di 45°
  const star4 = (rot: number) => {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? r : ri;
      d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  };
  return (
    <>
      <Path path={star4(0)} color="#ffe040" />
      <Path path={star4(Math.PI / 4)} color="#fff9c4" />
    </>
  );
}

export type StaticTileProps = {
  rect: Rect;
  radius: number;
  svg: SkSVG | null;
  shadow: boolean;
  body: SkImage | null;
  palette: Palette;
  status: TileStatus;
  font: SkFont | null;
  dimColor?: string | null;
};

/** Tessera ferma: componente senza hook né valori condivisi, adatto a essere disegnato una volta sola in un'immagine. */
export function StaticTile({ rect, radius, svg, shadow, body, palette, status, font, dimColor }: StaticTileProps) {
  const box = designBox(rect.x, rect.y, rect.w, rect.h);
  const covered = status.locked || status.fog;
  return (
    <>
      {/* Corpo base (o immagine in cache) — sostituito da gradient per locked/fog */}
      {!covered ? (
        body ? (
          <Group transform={[{ translateX: rect.x - BODY_PAD }, { translateY: rect.y - BODY_PAD }]}>
            <Image image={body} x={0} y={0} width={rect.w + 2 * BODY_PAD} height={rect.h + 2 * BODY_PAD} fit="fill" />
          </Group>
        ) : (
          <TileBody x={rect.x} y={rect.y} w={rect.w} h={rect.h} radius={radius} shadow={shadow} palette={palette} />
        )
      ) : null}
      {/* Disegno SVG (solo quando scoperta) */}
      {covered ? null : <SvgAt svg={svg} x={box.x} y={box.y} width={box.width} height={box.height} />}
      {/* Oscuramento per tessere bloccate (non libere) */}
      {dimColor && !covered ? (
        <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={radius} color={dimColor} />
      ) : null}
      {/* Facce speciali per stato locked/fog */}
      {status.locked ? (
        <LockedFace rect={rect} radius={radius} font={font} />
      ) : status.fog ? (
        <FogFace rect={rect} radius={radius} font={font} />
      ) : null}
      {/* Bordo dorato e scintilla per tessere d'oro (CSS .tile.gold riga 260, .gem riga 262 HTML) */}
      {status.gold && !covered ? (
        <>
          <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={radius}>
            <LinearGradient
              start={vec(rect.x, rect.y)}
              end={vec(rect.x + rect.w, rect.y + rect.h)}
              colors={['#fff6c8', '#ffe27a', '#f2c13a']}
              positions={[0, 0.65, 1]}
            />
          </RoundedRect>
          {/* Ridisegna il SVG sopra il gradient dorato */}
          <SvgAt svg={svg} x={box.x} y={box.y} width={box.width} height={box.height} />
          {/* Bordo dorato 2.5px */}
          <RoundedRect x={rect.x + 1.5} y={rect.y + 1.5} width={rect.w - 3} height={rect.h - 3} r={radius} style="stroke" strokeWidth={2.5} color="#ffd54a" />
          {/* Scintilla in alto a sinistra (posizione .gem top:-10 left:-10 in CSS = +3 +3 qui) */}
          <Sparkle x={rect.x + 7} y={rect.y + 7} size={14} />
        </>
      ) : null}
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
