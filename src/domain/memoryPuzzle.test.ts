import {
  MEMORY_HINT_MS,
  MEMORY_LAYOUTS,
  MEMORY_MATCH_MS,
  MEMORY_MISMATCH_MS,
  canRefundMemory,
  createMemory,
  flipCard,
  hintMemory,
  isFaceUp,
  isMemoryWon,
  memoryPairs,
  memoryStars,
  settle,
  type MemoryState,
} from './memoryPuzzle';

const POOL = Array.from({ length: 28 }, (_, i) => i);

/** Le due posizioni di ogni disegno, per giocare senza sbagliare. */
function pairsOf(state: MemoryState): [number, number][] {
  const first = new Map<number, number>();
  const out: [number, number][] = [];
  state.cards.forEach((design, i) => {
    const other = first.get(design);
    if (other === undefined) first.set(design, i);
    else out.push([other, i]);
  });
  return out;
}

/** Due carte diverse. */
function mismatch(state: MemoryState): [number, number] {
  const a = state.cards.findIndex((_, i) => !state.matched[i]);
  const b = state.cards.findIndex((design, i) => !state.matched[i] && design !== state.cards[a]);
  return [a, b];
}

describe('griglie e partita nuova', () => {
  test('3×4, 4×4 e 4×5: 6, 8 e 10 coppie', () => {
    expect(MEMORY_LAYOUTS).toEqual({ easy: { columns: 3, rows: 4 }, medium: { columns: 4, rows: 4 }, hard: { columns: 4, rows: 5 } });
    expect([memoryPairs('easy'), memoryPairs('medium'), memoryPairs('hard')]).toEqual([6, 8, 10]);
  });

  test('i tempi sono quelli dell\'originale', () => {
    expect([MEMORY_MISMATCH_MS, MEMORY_MATCH_MS, MEMORY_HINT_MS]).toEqual([800, 350, 1500]);
  });

  test.each(['easy', 'medium', 'hard'] as const)('%s: ogni disegno compare due volte e i disegni sono diversi tra loro', (difficulty) => {
    const state = createMemory(difficulty, POOL, 7);
    const { columns, rows } = MEMORY_LAYOUTS[difficulty];
    expect(state.cards).toHaveLength(columns * rows);
    const count = new Map<number, number>();
    for (const design of state.cards) count.set(design, (count.get(design) ?? 0) + 1);
    expect([...count.values()].every((n) => n === 2)).toBe(true);
    expect(count.size).toBe(memoryPairs(difficulty));
    expect(state.cards.every((design) => POOL.includes(design))).toBe(true);
    expect(state).toMatchObject({ up: [], attempts: 0, hintsUsed: 0, lock: 'none' });
    expect(state.matched.every((done) => !done)).toBe(true);
  });

  test('stesso seme, stessa partita; semi diversi, partite diverse', () => {
    expect(createMemory('hard', POOL, 11)).toEqual(createMemory('hard', POOL, 11));
    expect(createMemory('hard', POOL, 11).cards).not.toEqual(createMemory('hard', POOL, 12).cards);
  });
});

describe('girare le carte', () => {
  test('la prima carta resta girata, la stessa carta non si rigira', () => {
    const one = flipCard(createMemory('easy', POOL, 1), 3);
    expect(one).toMatchObject({ up: [3], attempts: 0, lock: 'none' });
    expect(flipCard(one, 3)).toBe(one);
  });

  test('due carte uguali restano trovate e contano un tentativo', () => {
    const start = createMemory('easy', POOL, 1);
    const [a, b] = pairsOf(start)[0];
    const done = flipCard(flipCard(start, a), b);
    expect(done).toMatchObject({ up: [], attempts: 1, lock: 'none' });
    expect(done.matched[a] && done.matched[b]).toBe(true);
    expect(done.matched.filter(Boolean)).toHaveLength(2);
    expect(flipCard(done, a)).toBe(done);
  });

  test('due carte diverse contano un tentativo e bloccano finché non si rigirano', () => {
    const start = createMemory('easy', POOL, 1);
    const [a, b] = mismatch(start);
    const wrong = flipCard(flipCard(start, a), b);
    expect(wrong).toMatchObject({ up: [a, b], attempts: 1, lock: 'mismatch' });
    expect(wrong.matched.some(Boolean)).toBe(false);
    const other = [...start.cards.keys()].find((i) => i !== a && i !== b)!;
    expect(flipCard(wrong, other)).toBe(wrong);
    expect(settle(wrong)).toMatchObject({ up: [], attempts: 1, lock: 'none' });
  });

  test('una carta che non esiste non fa niente', () => {
    const start = createMemory('easy', POOL, 1);
    expect(flipCard(start, 99)).toBe(start);
    expect(flipCard(start, -1)).toBe(start);
  });

  test('si vince con tutte le coppie trovate: giocando senza sbagliare i tentativi sono le coppie e le stelle 3', () => {
    let state = createMemory('hard', POOL, 5);
    for (const [a, b] of pairsOf(state)) state = flipCard(flipCard(state, a), b);
    expect(isMemoryWon(state)).toBe(true);
    expect(state.attempts).toBe(10);
    expect(memoryStars(state.attempts, 10)).toBe(3);
  });

  test('settle non cambia una partita che non aspetta niente', () => {
    const start = createMemory('easy', POOL, 1);
    expect(settle(start)).toBe(start);
  });
});

describe('stelle', () => {
  // errori = tentativi − coppie: fino a coppie/2 → 3, fino a coppie → 2, oltre → 1
  test.each([
    [6, 6, 3], [6, 9, 3], [6, 10, 2], [6, 12, 2], [6, 13, 1],
    [8, 12, 3], [8, 13, 2], [8, 16, 2], [8, 17, 1],
    [10, 15, 3], [10, 16, 2], [10, 20, 2], [10, 21, 1],
  ])('%i coppie, %i tentativi: %i stelle', (pairs, attempts, stars) => {
    expect(memoryStars(attempts, pairs)).toBe(stars);
  });
});

describe('aiuto', () => {
  test('mostra tutte le carte finché non finisce l\'attesa e blocca le carte', () => {
    const start = createMemory('easy', POOL, 1);
    const hinted = hintMemory(start)!;
    expect(hinted).toMatchObject({ hintsUsed: 1, lock: 'hint' });
    expect(start.cards.every((_, i) => isFaceUp(hinted, i))).toBe(true);
    expect(start.cards.some((_, i) => isFaceUp(start, i))).toBe(false);
    expect(flipCard(hinted, 0)).toBe(hinted);
    const after = settle(hinted);
    expect(after).toMatchObject({ lock: 'none', hintsUsed: 1 });
    expect(start.cards.some((_, i) => isFaceUp(after, i))).toBe(false);
  });

  test('non si usa mentre si aspetta, né oltre i 3 aiuti, né a partita finita', () => {
    let state = createMemory('medium', POOL, 2);
    for (let i = 0; i < 3; i++) state = settle(hintMemory(state)!);
    expect(state.hintsUsed).toBe(3);
    expect(hintMemory(state)).toBeNull();
    const fresh = createMemory('medium', POOL, 2);
    const [a, b] = mismatch(fresh);
    expect(hintMemory(flipCard(flipCard(fresh, a), b))).toBeNull();
    let won = fresh;
    for (const [x, y] of pairsOf(won)) won = flipCard(flipCard(won, x), y);
    expect(hintMemory(won)).toBeNull();
  });

  test('le carte girate prima dell\'aiuto restano girate dopo', () => {
    const start = flipCard(createMemory('easy', POOL, 1), 4);
    const after = settle(hintMemory(start)!);
    expect(isFaceUp(after, 4)).toBe(true);
  });
});

describe('rimborso', () => {
  test('si rimborsa se non c\'è stato nessun tentativo, anche con una carta girata', () => {
    const start = createMemory('easy', POOL, 1);
    expect(canRefundMemory(start)).toBe(true);
    expect(canRefundMemory(flipCard(start, 0))).toBe(true);
  });

  test('non si rimborsa dopo un tentativo né a partita vinta', () => {
    const start = createMemory('easy', POOL, 1);
    const [a, b] = mismatch(start);
    expect(canRefundMemory(settle(flipCard(flipCard(start, a), b)))).toBe(false);
    let won = start;
    for (const [x, y] of pairsOf(won)) won = flipCard(flipCard(won, x), y);
    expect(canRefundMemory(won)).toBe(false);
  });
});
