import { useCallback, useMemo, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Stats = { fps: number; worst: number };
type Acc = { frames: number; time: number; worst: number };
const ZERO: Acc = { frames: 0, time: 0, worst: 0 };

/**
 * Misura i fotogrammi sul thread UI (callback per frame di Reanimated).
 * `stats` si aggiorna ogni 500 ms per il testo a schermo; `benchReset`/`benchRead` misurano una finestra a scelta.
 */
export function useFrameStats() {
  const [stats, setStats] = useState<Stats>({ fps: 0, worst: 0 });
  const acc = useSharedValue<Acc>(ZERO);
  const bench = useSharedValue<Acc>(ZERO);
  // Eco: il JS scrive un numero, il thread UI lo vede al fotogramma successivo e risponde. Misura il ritardo di andata e ritorno.
  const pingId = useSharedValue(0);
  const ackId = useSharedValue(0);
  const pending = useRef(new Map<number, number>());
  const rtts = useRef<number[]>([]);
  const onAck = useCallback((id: number) => {
    const t0 = pending.current.get(id);
    if (t0 !== undefined) {
      rtts.current.push(performance.now() - t0);
      pending.current.delete(id);
    }
  }, []);

  useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame;
    if (dt == null) return;
    const a = acc.value;
    const next = { frames: a.frames + 1, time: a.time + dt, worst: Math.max(a.worst, dt) };
    if (next.time >= 500) {
      scheduleOnRN(setStats, { fps: Math.round((next.frames * 1000) / next.time), worst: Math.round(next.worst) });
      acc.value = ZERO;
    } else {
      acc.value = next;
    }
    const b = bench.value;
    bench.value = { frames: b.frames + 1, time: b.time + dt, worst: Math.max(b.worst, dt) };
    if (pingId.value !== ackId.value) {
      ackId.value = pingId.value;
      scheduleOnRN(onAck, pingId.value);
    }
  });

  const api = useMemo(
    () => ({
      ping: () => {
        const id = pingId.value + 1;
        pending.current.set(id, performance.now());
        pingId.value = id;
      },
      benchReset: () => {
        bench.value = ZERO;
        rtts.current = [];
        pending.current.clear();
      },
      benchRead: () => {
        const b = bench.value;
        const r = rtts.current;
        return {
          fps: b.time > 0 ? Math.round(((b.frames * 1000) / b.time) * 10) / 10 : 0,
          worst: Math.round(b.worst),
          echoAvg: r.length ? Math.round(r.reduce((x, y) => x + y, 0) / r.length) : 0,
          echoMax: r.length ? Math.round(Math.max(...r)) : 0,
        };
      },
    }),
    [pingId, bench],
  );

  return { stats, ...api };
}

export function FpsMeter({ stats, style }: { stats: Stats; style?: object }) {
  return (
    <Text style={style} testID="fps">
      {`Frame UI: ${stats.fps} fps · peggiore ${stats.worst} ms`}
    </Text>
  );
}
