import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** `true` se il sistema chiede di ridurre il movimento (`prefers-reduced-motion` dell'originale): spariscono scintille e scritta. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    let current = false;
    // Si aggiorna lo stato solo se il valore cambia: con il sistema a «no» (il caso normale) non c'è nessun aggiornamento.
    const update = (value: boolean) => {
      if (!alive || value === current) return;
      current = value;
      setReduce(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
