import type { Cell } from './types';

/**
 * Relazioni geometriche tra le tessere, calcolate una volta per forma. Regole dell'originale (`isFree`):
 * una tessera è coperta se al piano superiore ce n'è una con |Δx| < 1 e |Δy| < 1; è chiusa ai lati se ha una vicina
 * a sinistra e una a destra sullo stesso piano (|Δy| < 1, distanza in x minore di 2).
 */
export type Adjacency = {
  n: number;
  above: number[][];
  left: number[][];
  right: number[][];
  /** Tessere che questa copre / di cui è vicina di sinistra / di destra (relazioni inverse). */
  belowOf: number[][];
  rightOf: number[][];
  leftOf: number[][];
};

const cache = new WeakMap<readonly Cell[], Adjacency>();

export function buildAdjacency(cells: readonly Cell[]): Adjacency {
  const hit = cache.get(cells);
  if (hit) return hit;
  const n = cells.length;
  const mk = () => Array.from({ length: n }, () => [] as number[]);
  const a: Adjacency = { n, above: mk(), left: mk(), right: mk(), belowOf: mk(), rightOf: mk(), leftOf: mk() };
  for (let i = 0; i < n; i++) {
    const t = cells[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const u = cells[j];
      if (u.z === t.z + 1 && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1) {
        a.above[i].push(j);
        a.belowOf[j].push(i);
      }
      if (u.z === t.z && Math.abs(u.y - t.y) < 1) {
        if (u.x < t.x && t.x - u.x < 2) {
          a.left[i].push(j);
          a.rightOf[j].push(i);
        }
        if (u.x > t.x && u.x - t.x < 2) {
          a.right[i].push(j);
          a.leftOf[j].push(i);
        }
      }
    }
  }
  cache.set(cells, a);
  return a;
}

/** Stato delle tessere rimaste, con aggiornamento incrementale di quali sono libere. */
export class FreeTracker {
  readonly adj: Adjacency;
  alive: Uint8Array;
  aboveN: Int16Array;
  leftN: Int16Array;
  rightN: Int16Array;
  remaining: number;

  constructor(adj: Adjacency, source?: FreeTracker) {
    this.adj = adj;
    if (source) {
      this.alive = source.alive.slice();
      this.aboveN = source.aboveN.slice();
      this.leftN = source.leftN.slice();
      this.rightN = source.rightN.slice();
      this.remaining = source.remaining;
    } else {
      const n = adj.n;
      this.alive = new Uint8Array(n).fill(1);
      this.aboveN = Int16Array.from(adj.above, (l) => l.length);
      this.leftN = Int16Array.from(adj.left, (l) => l.length);
      this.rightN = Int16Array.from(adj.right, (l) => l.length);
      this.remaining = n;
    }
  }

  clone(): FreeTracker {
    return new FreeTracker(this.adj, this);
  }

  isFree(i: number): boolean {
    return this.alive[i] === 1 && this.aboveN[i] === 0 && !(this.leftN[i] > 0 && this.rightN[i] > 0);
  }

  freeList(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.adj.n; i++) if (this.isFree(i)) out.push(i);
    return out;
  }

  remove(i: number): void {
    this.alive[i] = 0;
    this.remaining--;
    for (const t of this.adj.belowOf[i]) this.aboveN[t]--;
    for (const t of this.adj.rightOf[i]) this.leftN[t]--;
    for (const t of this.adj.leftOf[i]) this.rightN[t]--;
  }
}
