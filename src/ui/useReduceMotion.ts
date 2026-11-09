import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** `true` se il sistema chiede di ridurre il movimento (`prefers-reduced-motion` dell'originale): spariscono scintille e combo. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
