import { FreeTracker, buildAdjacency, type Adjacency } from './geometry.ts';
import type { Rng } from './prng.ts';
import { STAR_TYPE, type PlacedTile } from './types.ts';

/**
 * Stato di una partita: tessere rimaste (con le libere), gruppi nascosti aperti e tessere rimaste per tipo.
 * Le regole sono quelle dell'originale: un gruppo di `groupSize` tessere uguali, tutte libere e non nascoste, si toglie;
 * togliere un gruppo di stelle apre il gruppo nascosto successivo.
 */
export class GameState {
  readonly tiles: readonly PlacedTile[];
  readonly g: number;
  readonly ft: FreeTracker;
  unlocked: number;
  /** Tessere rimaste per tipo; l'indice `typeSlots - 1` è la stella. */
  left: Int16Array;
  readonly slots: number;

  constructor(tiles: readonly PlacedTile[], groupSize: number, poolSize: number, source?: GameState) {
    this.tiles = tiles;
    this.g = groupSize;
    this.slots = poolSize + 1;
    if (source) {
      this.ft = source.ft.clone();
      this.unlocked = source.unlocked;
      this.left = source.left.slice();
    } else {
      this.ft = new FreeTracker(buildAdjacency(tiles));
      this.unlocked = 0;
      this.left = new Int16Array(this.slots);
      for (const t of tiles) this.left[this.slot(t.type)]++;
    }
  }

  slot(type: number): number {
    return type === STAR_TYPE ? this.slots - 1 : type;
  }

  clone(): GameState {
    return new GameState(this.tiles, this.g, this.slots - 1, this);
  }

  get remaining(): number {
    return this.ft.remaining;
  }

  /** Tessere selezionabili: libere e non nascoste (gruppo già aperto). */
  playable(): number[] {
    return this.ft.freeList().filter((i) => this.tiles[i].hiddenGroup <= this.unlocked);
  }

  /** Tessere giocabili raggruppate per tipo. */
  playableByType(): Map<number, number[]> {
    const by = new Map<number, number[]>();
    for (const i of this.playable()) {
      const s = this.slot(this.tiles[i].type);
      const l = by.get(s);
      if (l) l.push(i);
      else by.set(s, [i]);
    }
    return by;
  }

  apply(group: readonly number[]): void {
    for (const i of group) this.ft.remove(i);
    const s = this.slot(this.tiles[group[0]].type);
    this.left[s] -= group.length;
    if (s === this.slots - 1) this.unlocked++;
  }

  /** Chiave compatta dello stato (tessere rimaste) per la memoizzazione. */
  key(): string {
    let out = '';
    const a = this.ft.alive;
    for (let i = 0; i < a.length; i += 30) {
      let w = 0;
      for (let k = 0; k < 30 && i + k < a.length; k++) w = w * 2 + a[i + k];
      out += w.toString(36) + ',';
    }
    return out;
  }
}

function combinations(items: readonly number[], k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = (start: number) => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      cur.push(items[i]);
      rec(i + 1);
      cur.pop();
    }
  };
  rec(0);
  return out;
}

/** Tutte le mosse possibili: i gruppi di `g` tessere giocabili dello stesso tipo. */
export function moves(state: GameState): number[][] {
  const out: number[][] = [];
  for (const list of state.playableByType().values()) if (list.length >= state.g) out.push(...combinations(list, state.g));
  return out;
}

/** `true` se esiste un tipo con esattamente `g` tessere rimaste e una di esse copre direttamente un'altra. */
function hasStackedLastGroup(state: GameState): boolean {
  const byType = new Map<number, number[]>();
  const a = state.ft.alive;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0) continue;
    const s = state.slot(state.tiles[i].type);
    if (state.left[s] !== state.g) continue;
    const l = byType.get(s);
    if (l) l.push(i);
    else byType.set(s, [i]);
  }
  for (const list of byType.values()) {
    for (const i of list) for (const j of state.ft.adj.above[i]) if (list.includes(j)) return true;
  }
  return false;
}

export type SolveResult = { status: 'solvable' | 'unsolvable' | 'unknown'; nodes: number };

/**
 * Verifica se la tavola è risolvibile con una ricerca in profondità con memoizzazione degli stati senza uscita.
 * Mosse «sicure»: se di un tipo restano solo `g` tessere e sono tutte giocabili, si tolgono subito senza ramificare.
 * `budget` limita i nodi visitati: oltre, l'esito è `unknown`.
 */
export function solve(tiles: readonly PlacedTile[], groupSize: number, poolSize: number, budget = 200000): SolveResult {
  const dead = new Set<string>();
  let nodes = 0;
  let exceeded = false;

  const dfs = (state: GameState): boolean => {
    if (state.remaining === 0) return true;
    if (++nodes > budget) {
      exceeded = true;
      return false;
    }
    const key = state.key() + state.unlocked;
    if (dead.has(key)) return false;

    // Potatura: se di un tipo restano solo `g` tessere e una copre direttamente un'altra, non saranno mai libere insieme.
    if (hasStackedLastGroup(state)) {
      dead.add(key);
      return false;
    }
    // Mosse sicure
    const by = state.playableByType();
    for (const [slot, list] of by) {
      if (state.left[slot] === state.g && list.length === state.g) {
        const next = state.clone();
        next.apply(list);
        if (dfs(next)) return true;
        if (!exceeded) dead.add(key);
        return false;
      }
    }
    const all: number[][] = [];
    for (const list of by.values()) if (list.length >= state.g) all.push(...combinations(list, state.g));
    if (all.length === 0) {
      dead.add(key);
      return false;
    }
    // Ordine delle mosse: prima le stelle (aprono le tessere nascoste), poi i tipi con meno tessere rimaste (più vincolati),
    // poi i gruppi che liberano di più (piani alti, tessere che ne coprono altre).
    const star = state.slots - 1;
    const score = (m: number[]) => {
      const slot = state.slot(state.tiles[m[0]].type);
      const frees = m.reduce((a, i) => a + state.tiles[i].z * 4 + state.ft.adj.belowOf[i].length, 0);
      return (slot === star ? 100000 : 0) - state.left[slot] * 100 + frees;
    };
    all.sort((a, b) => score(b) - score(a) || a[0] - b[0]);
    for (const m of all) {
      const next = state.clone();
      next.apply(m);
      if (dfs(next)) return true;
      if (exceeded) return false;
    }
    dead.add(key);
    return false;
  };

  const ok = dfs(new GameState(tiles, groupSize, poolSize));
  if (ok) return { status: 'solvable', nodes };
  return { status: exceeded ? 'unknown' : 'unsolvable', nodes };
}

export type Playthrough = { solved: boolean; steps: number; freedom: number };

/**
 * Partita di un giocatore che sceglie a caso tra le tessere che hanno almeno un compagno giocabile, senza aiuti.
 * `freedom` è la media, lungo la partita, della quota di tessere rimaste che si possono abbinare subito.
 */
export function playRandom(tiles: readonly PlacedTile[], groupSize: number, poolSize: number, rng: Rng): Playthrough {
  const state = new GameState(tiles, groupSize, poolSize);
  let steps = 0;
  let freedomSum = 0;
  while (state.remaining > 0) {
    const by = state.playableByType();
    const matchable: number[] = [];
    for (const list of by.values()) if (list.length >= groupSize) matchable.push(...list);
    if (matchable.length === 0) return { solved: false, steps, freedom: steps ? freedomSum / steps : 0 };
    freedomSum += matchable.length / state.remaining;
    steps++;
    const first = matchable[rng.int(matchable.length)];
    const slot = state.slot(tiles[first].type);
    const mates = (by.get(slot) ?? []).filter((i) => i !== first);
    for (let k = 0; k < groupSize - 1; k++) {
      const j = k + rng.int(mates.length - k);
      [mates[k], mates[j]] = [mates[j], mates[k]];
    }
    state.apply([first, ...mates.slice(0, groupSize - 1)]);
  }
  return { solved: true, steps, freedom: steps ? freedomSum / steps : 0 };
}

/** Ripete `runs` partite casuali: libertà media (L) e quota di partite che restano senza mosse (R). */
export function simulate(tiles: readonly PlacedTile[], groupSize: number, poolSize: number, rng: Rng, runs: number): { freedom: number; stuck: number } {
  let f = 0;
  let stuck = 0;
  for (let r = 0; r < runs; r++) {
    const p = playRandom(tiles, groupSize, poolSize, rng);
    f += p.freedom;
    if (!p.solved) stuck++;
  }
  return { freedom: f / runs, stuck: stuck / runs };
}

export type { Adjacency };
