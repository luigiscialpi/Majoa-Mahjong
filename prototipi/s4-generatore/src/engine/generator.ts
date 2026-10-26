import { FreeTracker, buildAdjacency, type Adjacency } from './geometry.ts';
import { createRng, hashSeed, type Rng } from './prng.ts';
import { STAR_TYPE, type GenError, type Generated, type LevelSpec, type PlacedTile, type Result } from './types.ts';

export const MAX_ATTEMPTS = 1500;

type Chunk = { size: number; type: number };

function validate(spec: LevelSpec): string | null {
  const n = spec.cells.length;
  const g = spec.groupSize;
  if (n === 0 || n % g !== 0) return `il numero di tessere (${n}) non è multiplo del gruppo (${g})`;
  if (spec.types < 1 || spec.types > spec.poolSize) return `tipi (${spec.types}) fuori dall'intervallo 1-${spec.poolSize}`;
  const starTiles = spec.hidden.length * g;
  const hiddenTiles = spec.hidden.reduce((a, b) => a + b, 0);
  if (n - starTiles < g) return 'troppe tessere stella rispetto alla tavola';
  if (hiddenTiles + starTiles > n) return 'troppe tessere nascoste rispetto alla tavola';
  return null;
}

/**
 * Costruisce una tavola **risolvibile per costruzione**: simula la partita in avanti. A ogni passo sceglie a caso
 * un gruppo di tessere libere nello stesso momento (4 per le coppie quando i tipi lo permettono, 2 altrimenti; 6 o 3
 * per i tris), assegna loro lo stesso disegno e le toglie. Se a un certo passo non ci sono abbastanza tessere libere,
 * il tentativo fallisce e si riprova con un seme derivato (fino a `maxAttempts`, 1500 come nell'originale).
 *
 * Stella e tessere nascoste: per ogni gruppo nascosto g si pianifica un gruppo di stelle nella prima parte della
 * soluzione, e le tessere nascoste del gruppo g si scelgono tra quelle rimosse DOPO quel gruppo di stelle.
 * Nebbia e oro non cambiano la risolvibilità.
 */
export function generateLevel(spec: LevelSpec, seed: number, maxAttempts = MAX_ATTEMPTS): Result<Generated, GenError> {
  const invalid = validate(spec);
  if (invalid) return { ok: false, error: { kind: 'invalid-spec', reason: invalid } };
  const adj = buildAdjacency(spec.cells);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const built = tryOnce(spec, adj, createRng(hashSeed(seed, attempt)));
    if (built) return { ok: true, value: { ...built, attempts: attempt } };
  }
  return { ok: false, error: { kind: 'generation-failed', attempts: maxAttempts } };
}

function tryOnce(spec: LevelSpec, adj: Adjacency, rng: Rng): Omit<Generated, 'attempts'> | null {
  const n = spec.cells.length;
  const g = spec.groupSize;
  const G = spec.hidden.length;

  // Piano dei gruppi: quanti gruppi grandi (2g) e piccoli (g) servono perché ogni tipo compaia almeno una volta.
  const P = (n - G * g) / g;
  const K = Math.min(spec.types, P);
  const quads = Math.max(0, Math.min(Math.floor(P / 2), P - K));
  const sizes = rng.shuffle([...Array<number>(quads).fill(2 * g), ...Array<number>(P - 2 * quads).fill(g)]);
  const C0 = sizes.length;
  const pool = rng.shuffle(Array.from({ length: spec.poolSize }, (_, i) => i)).slice(0, K);
  const labels = rng.shuffle(Array.from({ length: C0 }, (_, i) => pool[i % K]));

  // Posizione dei gruppi di stelle: nella prima parte della soluzione.
  const C = C0 + G;
  const window = Math.min(C, Math.max(G, Math.ceil(0.4 * C)));
  const starPos = rng.shuffle(Array.from({ length: window }, (_, i) => i)).slice(0, G).sort((a, b) => a - b);
  const starSet = new Set(starPos);
  const chunks: Chunk[] = [];
  for (let i = 0, k = 0; i < C; i++) {
    if (starSet.has(i)) chunks.push({ size: g, type: STAR_TYPE });
    else {
      chunks.push({ size: sizes[k], type: labels[k] });
      k++;
    }
  }

  // Simulazione in avanti.
  const ft = new FreeTracker(adj);
  const type = new Int16Array(n).fill(-2);
  const plan: number[][] = [];
  for (const chunk of chunks) {
    const free = ft.freeList();
    if (free.length < chunk.size) return null;
    for (let k = 0; k < chunk.size; k++) {
      const j = k + rng.int(free.length - k);
      [free[k], free[j]] = [free[j], free[k]];
    }
    const picked = free.slice(0, chunk.size);
    for (const t of picked) type[t] = chunk.type;
    for (const t of picked) ft.remove(t);
    plan.push(picked);
  }

  // Passo di rimozione di ogni tessera e posizione dei gruppi di stelle nel piano.
  const stepOf = new Int16Array(n);
  plan.forEach((group, step) => group.forEach((t) => (stepOf[t] = step)));
  const starSteps = plan.map((group, step) => (type[group[0]] === STAR_TYPE ? step : -1)).filter((s) => s >= 0);

  const tiles: PlacedTile[] = spec.cells.map((c, i) => ({ x: c.x, y: c.y, z: c.z, type: type[i], hiddenGroup: 0, fog: false, gold: false }));

  // Tessere nascoste: il gruppo gi si apre dopo gi gruppi di stelle; si scelgono tra le tessere rimosse dopo il gi-esimo.
  for (let gi = 0; gi < G; gi++) {
    const eligible: number[] = [];
    for (let t = 0; t < n; t++) if (tiles[t].type !== STAR_TYPE && tiles[t].hiddenGroup === 0 && stepOf[t] > starSteps[gi]) eligible.push(t);
    if (eligible.length < spec.hidden[gi]) return null;
    rng.shuffle(eligible);
    for (let k = 0; k < spec.hidden[gi]; k++) tiles[eligible[k]].hiddenGroup = gi + 1;
  }

  // Nebbia: tessere inizialmente non libere, né nascoste né stelle.
  const first = new FreeTracker(adj);
  const fogCandidates: number[] = [];
  for (let t = 0; t < n; t++) if (!first.isFree(t) && tiles[t].hiddenGroup === 0 && tiles[t].type !== STAR_TYPE) fogCandidates.push(t);
  rng.shuffle(fogCandidates);
  for (let k = 0; k < Math.min(spec.fog, fogCandidates.length); k++) tiles[fogCandidates[k]].fog = true;

  // Oro: tessere visibili e non stella.
  const goldCandidates: number[] = [];
  for (let t = 0; t < n; t++) if (tiles[t].hiddenGroup === 0 && tiles[t].type !== STAR_TYPE) goldCandidates.push(t);
  rng.shuffle(goldCandidates);
  for (let k = 0; k < Math.min(spec.gold, goldCandidates.length); k++) tiles[goldCandidates[k]].gold = true;

  return { tiles, plan };
}
