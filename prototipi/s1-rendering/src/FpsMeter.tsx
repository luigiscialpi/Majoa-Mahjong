import { useState } from 'react';
import { Text } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

type Stats = { fps: number; worst: number };

/** Misura i fotogrammi sul thread UI (callback per frame di Reanimated) e aggiorna il testo ogni 500 ms. */
export function FpsMeter({ style }: { style?: object }) {
  const [stats, setStats] = useState<Stats>({ fps: 0, worst: 0 });
  const acc = useSharedValue({ frames: 0, time: 0, worst: 0 });

  useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame;
    if (dt == null) return;
    const a = acc.value;
    const next = { frames: a.frames + 1, time: a.time + dt, worst: Math.max(a.worst, dt) };
    if (next.time >= 500) {
      scheduleOnRN(setStats, { fps: Math.round((next.frames * 1000) / next.time), worst: Math.round(next.worst) });
      acc.value = { frames: 0, time: 0, worst: 0 };
    } else {
      acc.value = next;
    }
  });

  return (
    <Text style={style} testID="fps">
      {`Frame UI: ${stats.fps} fps · peggiore ${stats.worst} ms`}
    </Text>
  );
}
