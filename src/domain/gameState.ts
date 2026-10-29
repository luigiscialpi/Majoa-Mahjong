import { FreeTracker, buildAdjacency } from './geometry';
import { STAR_TYPE, type MoveError, type PlacedTile, type Result } from './types';

// ponytail: `GameState` muta internamente (`apply` su una copia ottenuta con `clone`) perché il solver ne visita decine di
// migliaia; l'interfaccia per chi sta fuori dal dominio è `applyMove`, che non muta lo stato ricevuto.
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
      // Con le stesse tessere i conteggi si copiano; se i tipi sono stati riassegnati (rimescolo) si ricalcolano.
      this.left = tiles === source.tiles ? source.left.slice() : this.countLeft();
    } else {
      this.ft = new FreeTracker(buildAdjacency(tiles));
      this.unlocked = 0;
      this.left = this.countLeft();
    }
  }

  private countLeft(): Int16Array {
    const left = new Int16Array(this.slots);
    this.tiles.forEach((t, i) => {
      if (this.ft.alive[i] === 1) left[this.slot(t.type)]++;
    });
    return left;
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

/**
 * Toglie un gruppo di tessere e restituisce il nuovo stato, senza modificare quello ricevuto. Il gruppo è valido se ha
 * `groupSize` tessere distinte ancora in gioco, tutte libere e non nascoste, dello stesso tipo. Togliere un gruppo di
 * stelle apre il gruppo nascosto successivo.
 */
export function applyMove(state: GameState, group: readonly number[]): Result<GameState, MoveError> {
  const n = state.tiles.length;
  const inGame = (i: number) => Number.isInteger(i) && i >= 0 && i < n && state.ft.alive[i] === 1;
  if (group.length !== state.g || new Set(group).size !== group.length || !group.every(inGame)) {
    return { ok: false, error: 'invalid-group' };
  }
  const playable = new Set(state.playable());
  if (!group.every((i) => playable.has(i))) return { ok: false, error: 'tile-blocked' };
  const slot = state.slot(state.tiles[group[0]].type);
  if (!group.every((i) => state.slot(state.tiles[i].type) === slot)) return { ok: false, error: 'not-matching' };
  const next = state.clone();
  next.apply(group);
  return { ok: true, value: next };
}
