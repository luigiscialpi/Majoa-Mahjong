// Tipi del motore dei livelli. Nessuna dipendenza da React Native: il motore è dominio puro.

export type Cell = { x: number; y: number; z: number };

/** Aiuti iniziali: `null` = illimitati. */
export type Aids = { hints: number | null; shuffles: number | null; undo: number | null };

/** Descrizione dati di un livello (docs/motore-livelli.md). */
export type LevelSpec = {
  id: string;
  cells: readonly Cell[];
  /** 2 = coppie, 3 = tris. */
  groupSize: 2 | 3;
  /** Numero di disegni diversi (la stella è esclusa). */
  types: number;
  /** Disegni disponibili nel tema (la stella è esclusa). */
  poolSize: number;
  /** Dimensione di ogni gruppo di tessere nascoste; il gruppo `g` si apre dopo `g` abbinamenti di stelle. */
  hidden: readonly number[];
  fog: number;
  gold: number;
  aids: Aids;
};

/** Tipo speciale della tessera stella, che apre i gruppi nascosti. */
export const STAR_TYPE = -1;

export type PlacedTile = Cell & {
  /** Indice del disegno (0 … poolSize − 1) oppure `STAR_TYPE`. */
  type: number;
  /** 0 = visibile; g > 0 = nascosta nel gruppo g. */
  hiddenGroup: number;
  fog: boolean;
  gold: boolean;
};

export type Generated = {
  tiles: PlacedTile[];
  /** Soluzione costruita: gruppi di indici di tessere, nell'ordine di rimozione. */
  plan: number[][];
  attempts: number;
};

export type GenError = { kind: 'generation-failed'; attempts: number } | { kind: 'invalid-spec'; reason: string };
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
