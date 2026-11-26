import { newProgress } from './progress';
import {
  PUZZLE_COST,
  PUZZLE_DIFFICULTIES,
  PUZZLE_FIRST_WIN_COINS,
  PUZZLE_HINTS,
  PUZZLE_IDS,
  PUZZLE_KEYS,
  PUZZLE_MAX_STARS_WITH_HINT,
  effectiveStars,
  puzzleKey,
  recordPuzzleWin,
  refundPuzzle,
  startPuzzle,
} from './puzzles';

describe('catalogo dei rompicapi', () => {
  test('dieci rompicapi in tre difficoltà: trenta coppie, tutte diverse', () => {
    expect(PUZZLE_IDS).toHaveLength(10);
    expect(PUZZLE_DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
    expect(PUZZLE_KEYS).toHaveLength(30);
    expect(new Set(PUZZLE_KEYS).size).toBe(30);
    expect(puzzleKey('memory', 'easy')).toBe('memory:easy');
    expect(PUZZLE_KEYS).toContain('wordSearch:hard');
  });

  test('le regole comuni sono quelle dell\'originale: 1 ✨ per iniziare, +2 alla prima vittoria, 3 aiuti, 2 stelle con un aiuto', () => {
    expect([PUZZLE_COST, PUZZLE_FIRST_WIN_COINS, PUZZLE_HINTS, PUZZLE_MAX_STARS_WITH_HINT]).toEqual([1, 2, 3, 2]);
  });
});

describe('costo e rimborso', () => {
  test('iniziare toglie 1 ✨ e non tocca il resto', () => {
    const progress = { ...newProgress(), coins: 3, giftsOpened: ['animals'] };
    expect(startPuzzle(progress)).toEqual({ ...progress, coins: 2 });
    expect(startPuzzle({ ...progress, coins: 1 })?.coins).toBe(0);
  });

  test('senza ✨ il gioco non parte', () => {
    expect(startPuzzle({ ...newProgress(), coins: 0 })).toBeNull();
  });

  test('uscire senza mosse rende la ✨', () => {
    const started = startPuzzle({ ...newProgress(), coins: 3 });
    expect(started && refundPuzzle(started).coins).toBe(3);
  });
});

describe('stelle e aiuti', () => {
  test.each([[3, false, 3], [3, true, 2], [2, true, 2], [1, true, 1], [2, false, 2], [1, false, 1]] as const)('%i stelle, aiuto usato: %s → %i', (stars, usedHint, expected) => {
    expect(effectiveStars(stars, usedHint)).toBe(expected);
  });
});

describe('vittoria', () => {
  const start = { ...newProgress(), coins: 5 };

  test('la prima vittoria di una coppia dà 2 ✨ (netto +1 con il costo) e registra le stelle', () => {
    const win = recordPuzzleWin(start, 'memory', 'easy', 3, false);
    expect(win).toMatchObject({ stars: 3, coins: 2, newRecord: true });
    expect(win.progress.coins).toBe(7);
    expect(win.progress.puzzles).toEqual({ 'memory:easy': 3 });
    expect(start.puzzles).toEqual({});
    const started = startPuzzle(start)!;
    expect(recordPuzzleWin(started, 'memory', 'easy', 3, false).progress.coins - start.coins).toBe(PUZZLE_FIRST_WIN_COINS - PUZZLE_COST);
  });

  test('rigiocando la stessa coppia non ci sono altre ✨', () => {
    const first = recordPuzzleWin(start, 'sudoku', 'hard', 2, false).progress;
    const again = recordPuzzleWin(first, 'sudoku', 'hard', 2, false);
    expect(again).toMatchObject({ stars: 2, coins: 0, newRecord: false });
    expect(again.progress.coins).toBe(first.coins);
  });

  test('si tiene la stella migliore: una più alta è un record, una più bassa non toglie niente', () => {
    const first = recordPuzzleWin(start, 'maze', 'medium', 2, false).progress;
    const better = recordPuzzleWin(first, 'maze', 'medium', 3, false);
    expect(better).toMatchObject({ stars: 3, newRecord: true });
    expect(better.progress.puzzles['maze:medium']).toBe(3);
    const worse = recordPuzzleWin(better.progress, 'maze', 'medium', 1, false);
    expect(worse).toMatchObject({ stars: 1, newRecord: false });
    expect(worse.progress.puzzles['maze:medium']).toBe(3);
  });

  test('con un aiuto usato le stelle si fermano a 2, anche alla prima vittoria', () => {
    const win = recordPuzzleWin(start, 'jars', 'easy', 3, true);
    expect(win.stars).toBe(2);
    expect(win.progress.puzzles['jars:easy']).toBe(2);
    expect(win.coins).toBe(2);
  });

  test('ogni coppia ha il suo record e le sue ✨ della prima vittoria', () => {
    const memory = recordPuzzleWin(start, 'memory', 'easy', 1, false).progress;
    const other = recordPuzzleWin(memory, 'memory', 'medium', 1, false);
    expect(other.coins).toBe(2);
    expect(other.progress.puzzles).toEqual({ 'memory:easy': 1, 'memory:medium': 1 });
  });
});
