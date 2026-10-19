import { useEffect, useRef } from 'react';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Misura quanto il thread JS ritarda un timer da 20 ms: indica per quanto tempo resta occupato.
 * `read()` restituisce il ritardo massimo e medio (ms) dall'ultimo `reset()`.
 */
export function useJsLag() {
  const acc = useRef({ max: 0, sum: 0, n: 0 });
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - last - 20);
      last = now;
      const a = acc.current;
      a.max = Math.max(a.max, lag);
      a.sum += lag;
      a.n += 1;
    }, 20);
    return () => clearInterval(id);
  }, []);
  return useRef({
    reset: () => {
      acc.current = { max: 0, sum: 0, n: 0 };
    },
    read: () => ({ max: Math.round(acc.current.max), mean: acc.current.n ? Math.round(acc.current.sum / acc.current.n) : 0 }),
  }).current;
}
