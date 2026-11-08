import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas, Circle, Group, Image, Path, RoundedRect, drawAsImage, matchFont, type SkFont, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withSequence, withTiming, useDerivedValue } from 'react-native-reanimated';
import { boardMetrics, drawOrder, hitTest, tileRect } from '../domain/board';
import type { Profile } from '../domain/profile';
import type { PlacedTile } from '../domain/types';
import type { Palette } from '../infrastructure/content/legacyThemes';
import { statusKey, type TileStatus } from './boardView';
import { EnteringTile, FlippingTile, RemovingTile, StaticTile, blockedDimOverlay, tinDelayMs, useBodyImage, type StaticTileProps } from './tile';

/** Tessera con animazione shake su tocco rifiutato (CSS @keyframes shake riga 225 HTML, 0.42s ease-in-out). */
function ShakingTile(props: StaticTileProps & { shakeKey: number }) {
  const { shakeKey, ...tileProps } = props;
  const shakeX = useSharedValue(0);
  const prevKey = useRef(0);
  const transform = useDerivedValue(() => [{ translateX: shakeX.value }]);

  useEffect(() => {
    if (shakeKey === prevKey.current) return;
    prevKey.current = shakeKey;
    shakeX.value = 0;
    shakeX.value = withSequence(
      withTiming(-5, { duration: 105, easing: Easing.inOut(Easing.ease) }),
      withTiming(5, { duration: 210, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 105, easing: Easing.inOut(Easing.ease) }),
    );
  }, [shakeKey, shakeX]);

  return (
    <Group transform={transform}>
      <StaticTile {...tileProps} />
    </Group>
  );
}

export type TileBoardProps = {
  tiles: readonly PlacedTile[];
  /** Disegno (0-128) di ogni tessera. */
  designs: readonly number[];
  svgs: readonly (SkSVG | null)[];
  statuses: readonly TileStatus[];
  palette: Palette;
  profile?: Profile;
  width: number;
  height: number;
  /** Tessere vive e libere: le sole che possono essere toccate o tolte, quindi disegnate dal vivo. */
  free: ReadonlySet<number>;
  /** Tessere già tolte e tessere che si stanno togliendo (animazione di 250 ms). */
  gone: ReadonlySet<number>;
  removing: ReadonlySet<number>;
  /** Cambia a ogni nuova rimozione e fa ripartire l'animazione. */
  removeKey: number;
  selected: readonly number[];
  hint: readonly number[];
  /**
   * Indici delle tessere libere con tipo uguale alla tessera selezionata (esclusa la selezionata stessa).
   * Ricevono l'anello verde con ✔; le altre libere (non selected, non match) vengono attenuate.
   */
  match: readonly number[];
  /**
   * Indice di una tessera il cui tocco è stato rifiutato (bloccata o nascosta).
   * Riceve l'animazione di scuotimento (shake 0.42s, CSS riga 225 HTML).
   */
  rejected: number | null;
  /** Tessere che bloccano la tessera toccata (outline rosso #ff4d4d, CSS riga 222 HTML). */
  blockers?: readonly number[];
  /** Tessere che entrano con animazione tin a scaglioni all'avvio della tavola (CSS riga 59 HTML). */
  boardIn?: boolean;
  /** Tessere che si stanno sbloccando con animazione flip 0.7s e alone d'accento 1s (CSS riga 66 HTML). */
  unlocking?: readonly number[];
  /** Tessere di cui si sta diradando la nebbia con animazione flip 0.55s (CSS riga 289 HTML). */
  revealing?: readonly number[];
  /** Tessera toccata, oppure `null` se il tocco è fuori da ogni tessera viva. */
  onTap: (index: number | null) => void;
};

const REMOVE_MS = 250;
const BOARD_IN_MS = 1500;
const TIN_MS = 450;
const EMPTY: ReadonlySet<number> = new Set();
const EMPTY_LIST: readonly number[] = [];
type Layer = { image: SkImage | null; excluded: ReadonlySet<number> };

function useMarkFont(size: number): SkFont | null {
  return useMemo(() => {
    try {
      return matchFont({ fontFamily: 'sans-serif', fontSize: size, fontWeight: 'bold' });
    } catch {
      return null;
    }
  }, [size]);
}

/**
 * Tavola a due strati, portata da `TileBoardLayered` di S1. Strato fermo: le tessere che non si muovono, disegnate UNA volta
 * in un'immagine (`drawAsImage`) e mostrate con un solo `<Image>`. Strato vivo: le tessere libere (le sole che si possono
 * togliere) e quelle in rimozione, con valori condivisi solo per l'animazione. Così il costo per fotogramma segue le tessere
 * vive, non l'intera tavola. Il tocco si risolve con `hitTest` del dominio, non con viste per tessera.
 */
export function TileBoard({
  tiles,
  designs,
  svgs,
  statuses,
  palette,
  profile = 'normal',
  width,
  height,
  free,
  gone,
  removing,
  removeKey,
  selected,
  hint,
  match,
  rejected,
  blockers = EMPTY_LIST,
  boardIn = false,
  unlocking = EMPTY_LIST,
  revealing = EMPTY_LIST,
  onTap,
}: TileBoardProps) {
  const metrics = useMemo(() => boardMetrics(tiles, width, height), [tiles, width, height]);
  const order = useMemo(() => drawOrder(tiles), [tiles]);
  const rects = useMemo(() => tiles.map((t) => tileRect(metrics, t)), [tiles, metrics]);
  const radius = Math.max(4, metrics.tw * 0.14);
  const font = useMarkFont(Math.max(12, metrics.tw * 0.6));
  const body = useBodyImage(metrics.tw - 3, metrics.th - 3, radius, true, palette);
  const dimColor = useMemo(() => blockedDimOverlay(profile), [profile]);

  const unlockingSet = useMemo(() => new Set(unlocking), [unlocking]);
  const revealingSet = useMemo(() => new Set(revealing), [revealing]);

  // Tessere vive: le libere, quelle in rimozione, quelle che si sbloccano o di cui si dirada la nebbia.
  // Durante boardIn tutte le tessere sono vive per eseguire l'animazione d'ingresso tin.
  const desired = useMemo(() => {
    const set = new Set(free);
    for (const i of removing) set.add(i);
    for (const i of unlockingSet) set.add(i);
    for (const i of revealingSet) set.add(i);
    if (boardIn) {
      for (const i of order) set.add(i);
    }
    return set;
  }, [free, removing, unlockingSet, revealingSet, boardIn, order]);
  const liveKey = useMemo(() => [...desired].sort((a, b) => a - b).join(','), [desired]);
  const statusesKey = useMemo(() => statusKey(statuses), [statuses]);

  const [layer, setLayer] = useState<Layer>({ image: null, excluded: EMPTY });
  const goneRef = useRef(gone);
  goneRef.current = gone;
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  // Animazione di rimozione: 0→1 in REMOVE_MS.
  const rm = useSharedValue(0);
  useEffect(() => {
    if (removeKey === 0) return;
    rm.value = 0;
    rm.value = withTiming(1, { duration: REMOVE_MS, easing: Easing.linear });
  }, [removeKey, rm]);

  // Animazione boardIn: un solo SharedValue 0→1 in BOARD_IN_MS condiviso da tutte le EnteringTile.
  const boardProgress = useSharedValue(0);
  useEffect(() => {
    if (!boardIn) return;
    boardProgress.value = 0;
    boardProgress.value = withTiming(1, { duration: BOARD_IN_MS, easing: Easing.linear });
  }, [boardIn, boardProgress]);

  // Ricostruisce l'immagine dello strato fermo quando cambia l'insieme delle tessere vive, la tavola o l'aspetto delle tessere
  // (non a ogni selezione). Se boardIn è attiva l'immagine non viene disegnata perché tutte le tessere entrano animate.
  useEffect(() => {
    if (boardIn) return;
    let cancelled = false;
    const excluded = new Set(desired);
    const dpr = PixelRatio.get();
    drawAsImage(
      <Group transform={[{ scale: dpr }]}>
        {order
          .filter((i) => !excluded.has(i) && !goneRef.current.has(i))
          .map((i) => {
            const isBlocked = !free.has(i) && !statusesRef.current[i].locked;
            return (
              <StaticTile
                key={i}
                rect={rects[i]}
                radius={radius}
                svg={svgs[designs[i]] ?? null}
                shadow
                body={body}
                palette={palette}
                status={statusesRef.current[i]}
                font={font}
                dimColor={isBlocked ? dimColor : null}
              />
            );
          })}
      </Group>,
      { width: Math.ceil(width * dpr), height: Math.ceil(height * dpr) },
    ).then((image) => {
      if (!cancelled) setLayer({ image, excluded });
    });
    return () => {
      cancelled = true;
    };
    // `desired` entra tramite `liveKey` e gli aspetti tramite `statusesKey`.
  }, [liveKey, statusesKey, width, height, rects, order, radius, svgs, designs, tiles, body, palette, font, dimColor, free]);

  // Finché l'immagine non è pronta si disegna tutto dal vivo; dopo, dal vivo solo ciò che l'immagine non contiene
  // o che sta per muoversi (stessi pixel, nessun buco durante il passaggio).
  const live = order.filter((i) => !gone.has(i) && (!layer.image || layer.excluded.has(i) || desired.has(i)));
  const tappable = useMemo(() => order.filter((i) => !gone.has(i) && !removing.has(i)), [order, gone, removing]);

  // Set per lookup O(1)
  const matchSet = useMemo(() => new Set(match), [match]);
  // Tessere libere che non sono la selezionata e non sono una match → attenuate (CSS .tile.fade)
  // Non si applica a tessere nascoste o nebbiose
  const fadeSet = useMemo(() => {
    if (match.length === 0) return new Set<number>();
    const sel = new Set(selected);
    const result = new Set<number>();
    for (const i of free) {
      if (!sel.has(i) && !matchSet.has(i) && !gone.has(i) && !statuses[i]?.locked && !statuses[i]?.fog) {
        result.add(i);
      }
    }
    return result;
  }, [match, selected, free, gone, matchSet, statuses]);

  // shakeKey incrementale per ShakingTile: aumenta a ogni nuovo rifiuto (anche sulla stessa tessera).
  const shakeSeqRef = useRef(0);
  const prevRejectedRef = useRef<number | null>(null);
  if (rejected !== null && rejected !== prevRejectedRef.current) {
    shakeSeqRef.current += 1;
    prevRejectedRef.current = rejected;
  }
  const shakeSeq = shakeSeqRef.current;

  // Il gesto si crea una volta sola e legge sempre i dati più recenti da un ref.
  const latest = useRef({ tiles, metrics, tappable, onTap });
  latest.current = { tiles, metrics, tappable, onTap };
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((e) => {
          const l = latest.current;
          l.onTap(hitTest(l.tiles, l.metrics, e.x, e.y, 0, l.tappable));
        }),
    [],
  );

  return (
    <GestureDetector gesture={tap}>
      <Canvas style={{ width, height }}>
        {layer.image && !boardIn ? <Image image={layer.image} x={0} y={0} width={width} height={height} fit="fill" /> : null}

        {/* Strato vivo: tessere libere, in ingresso, in rimozione, sblocco o diradamento */}
        {live.map((i) => {
          const isSelected = selected.includes(i);
          // Tessera selezionata: sollevata di 4px (CSS .tile.sel translateY(-4px) riga 50 HTML)
          const rect = isSelected ? { ...rects[i], y: rects[i].y - 4 } : rects[i];
          const isBlocked = !free.has(i) && !statuses[i].locked;
          const isFaded = fadeSet.has(i);
          const props = {
            rect,
            radius,
            svg: svgs[designs[i]] ?? null,
            shadow: true,
            body,
            palette,
            status: statuses[i],
            font,
            dimColor: isBlocked ? dimColor : null,
            fade: isFaded,
          };
          // Ingresso della tavola: tin a scaglioni in funzione di z, y, x (CSS riga 59 HTML)
          if (boardIn) {
            const delay = tinDelayMs(tiles[i].x, tiles[i].y, tiles[i].z);
            const startFraction = delay / BOARD_IN_MS;
            const durationFraction = TIN_MS / BOARD_IN_MS;
            return <EnteringTile key={i} boardProgress={boardProgress} startFraction={startFraction} durationFraction={durationFraction} {...props} />;
          }
          if (removing.has(i)) return <RemovingTile key={i} rm={rm} {...props} />;
          if (unlockingSet.has(i)) return <FlippingTile key={i} kind="unlock" {...props} />;
          if (revealingSet.has(i)) return <FlippingTile key={i} kind="reveal" {...props} />;
          // Tessera rifiutata: shake
          if (i === rejected) {
            return <ShakingTile key={i} shakeKey={shakeSeq} {...props} />;
          }
          return <StaticTile key={i} {...props} />;
        })}

        {/* Aiuto: anello bianco */}
        {hint.filter((i) => !gone.has(i) && !removing.has(i)).map((i) => (
          <RoundedRect key={`h${i}`} x={rects[i].x + 1.5} y={rects[i].y + 1.5} width={rects[i].w - 3} height={rects[i].h - 3} r={radius} style="stroke" strokeWidth={4} color="#ffffff" />
        ))}

        {/* Tessere bloccanti: outline rosso 4px solido con 2px offset + bagliore (CSS .tile.blocker righe 222-223 HTML) */}
        {blockers
          .filter((i) => !gone.has(i) && !removing.has(i))
          .map((i) => {
            const r = rects[i];
            return (
              <Group key={`blk${i}`}>
                {/* Bagliore rosso esterno */}
                <RoundedRect
                  x={r.x - 5}
                  y={r.y - 5}
                  width={r.w + 10}
                  height={r.h + 10}
                  r={radius + 4}
                  style="stroke"
                  strokeWidth={2}
                  color="rgba(255, 77, 77, 0.45)"
                />
                {/* Outline rosso 4px solido (offset 2px) */}
                <RoundedRect
                  x={r.x - 3}
                  y={r.y - 3}
                  width={r.w + 6}
                  height={r.h + 6}
                  r={radius + 2}
                  style="stroke"
                  strokeWidth={4}
                  color="#ff4d4d"
                />
              </Group>
            );
          })}

        {/* Tessere selezionate: bagliore d'accento, bordo 3px, filo interno chiaro (CSS .tile.sel righe 50-53 HTML) */}
        {selected
          .filter((i) => !gone.has(i) && !removing.has(i))
          .map((i) => {
            const r = { ...rects[i], y: rects[i].y - 4 };
            return (
              <Group key={`s${i}`}>
                {/* Bagliore d'accento sfumato attorno alla tessera sollevata */}
                <RoundedRect x={r.x - 2} y={r.y - 2} width={r.w + 4} height={r.h + 4} r={radius + 2} style="stroke" strokeWidth={3} color={palette[2]} opacity={0.35} />
                {/* Bordo principale d'accento (3px) */}
                <RoundedRect x={r.x + 1.5} y={r.y + 1.5} width={r.w - 3} height={r.h - 3} r={radius} style="stroke" strokeWidth={3} color={palette[2]} />
                {/* Filo interno chiaro superiore (replica inset 0 2px 3px rgba(255,255,255,.9)) */}
                <RoundedRect x={r.x + 3} y={r.y + 3} width={r.w - 6} height={r.h - 6} r={radius - 1} style="stroke" strokeWidth={1} color="rgba(255,255,255,0.7)" />
              </Group>
            );
          })}

        {/* Match: anello verde con pallino ✔ (CSS .tile.match box-shadow + ::before righe 228-232 HTML) */}
        {match
          .filter((i) => !gone.has(i) && !removing.has(i))
          .map((i) => {
            const r = rects[i];
            const checkR = Math.max(9, radius * 0.85);
            const checkX = Math.min(width - checkR - 3, r.x + r.w - checkR + 1);
            const checkY = Math.max(checkR + 3, r.y - checkR + 3);
            const checkD = `M${checkX - 3.5} ${checkY} L${checkX - 1} ${checkY + 3} L${checkX + 4} ${checkY - 3}`;
            return (
              <Group key={`m${i}`}>
                {/* Alone verde esterno */}
                <RoundedRect x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8} r={radius + 4} style="stroke" strokeWidth={4} color="rgba(31,191,90,0.45)" />
                {/* Bordo verde interno 3px */}
                <RoundedRect x={r.x + 1.5} y={r.y + 1.5} width={r.w - 3} height={r.h - 3} r={radius} style="stroke" strokeWidth={3} color="#1fbf5a" />
                {/* Pallino ✔ in alto a destra: cerchio verde, contorno bianco e segno ✔ vettoriale */}
                <Circle cx={checkX} cy={checkY} r={checkR} color="#1fbf5a" />
                <Circle cx={checkX} cy={checkY} r={checkR} style="stroke" strokeWidth={2} color="#ffffff" />
                <Path path={checkD} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" color="#ffffff" />
              </Group>
            );
          })}
      </Canvas>
    </GestureDetector>
  );
}
