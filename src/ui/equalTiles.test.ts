import { startRound } from '../application/round';
import type { GameState } from '../domain/gameState';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { equalFreeTiles, lacksFreeMatch } from './equalTiles';

// Una tavola minima: solo i campi che la logica legge (tipo, gruppo nascosto, tessere libere, tessere per gruppo).
function board(tiles: { type: number; hiddenGroup?: number }[], free: number[], opts: { g?: 2 | 3; unlocked?: number } = {}): GameState {
  return {
    tiles: tiles.map((t) => ({ type: t.type, hiddenGroup: t.hiddenGroup ?? 0 })),
    g: opts.g ?? 2,
    unlocked: opts.unlocked ?? 0,
    ft: { freeList: () => free },
  } as unknown as GameState;
}

describe('equalFreeTiles', () => {
  test('senza selezione non c\'è nulla da evidenziare', () => {
    expect(equalFreeTiles(board([{ type: 1 }, { type: 1 }], [0, 1]), [])).toEqual([]);
  });

  test('sono le tessere libere dello stesso tipo della selezionata, senza la selezionata stessa', () => {
    const game = board([{ type: 1 }, { type: 2 }, { type: 1 }, { type: 1 }, { type: 2 }], [0, 1, 2, 4]);
    expect(equalFreeTiles(game, [0])).toEqual([2]); // la 3 è dello stesso tipo ma non libera
    expect(equalFreeTiles(game, [1])).toEqual([4]);
  });

  test('una tessera nascosta (lucchetto) non conta, anche se libera e dello stesso tipo: sarebbe svelare il gioco', () => {
    const game = board([{ type: 1 }, { type: 1, hiddenGroup: 1 }, { type: 1 }], [0, 1, 2]);
    expect(equalFreeTiles(game, [0])).toEqual([2]);
    expect(equalFreeTiles({ ...game, unlocked: 1 } as GameState, [0])).toEqual([1, 2]); // sbloccato il gruppo, torna a contare
  });

  test('nei Tris, con due tessere scelte, si cerca la terza dello stesso tipo e le due scelte non contano', () => {
    const game = board([{ type: 3 }, { type: 3 }, { type: 3 }, { type: 3 }], [0, 1, 2, 3], { g: 3 });
    expect(equalFreeTiles(game, [0, 1])).toEqual([2, 3]);
  });

  test('un indice che non esiste non dà nulla', () => {
    expect(equalFreeTiles(board([{ type: 1 }], [0]), [5])).toEqual([]);
  });
});

describe('lacksFreeMatch', () => {
  test('a coppie ne serve una, nei Tris due (`< GS-1`, riga 2127 dell\'originale)', () => {
    const html = (jest.requireActual('fs') as { readFileSync(p: string, e: string): string }).readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
    expect(html).toContain('.length<GS-1)toast(tx(\'tNoMatchFree\'),2400)');
    const pair = board([{ type: 1 }, { type: 1 }, { type: 1 }], [0, 1]);
    expect(lacksFreeMatch(pair, 0)).toBe(false); // la 1 è libera
    expect(lacksFreeMatch(board([{ type: 1 }, { type: 1 }], [0]), 0)).toBe(true); // la 1 non è libera
    const tris = (free: number[]) => board([{ type: 1 }, { type: 1 }, { type: 1 }], free, { g: 3 });
    expect(lacksFreeMatch(tris([0, 1]), 0)).toBe(true); // ne servono due, ne basta una
    expect(lacksFreeMatch(tris([0, 1, 2]), 0)).toBe(false);
  });

  test('le nascoste non contano come compagne', () => {
    expect(lacksFreeMatch(board([{ type: 1 }, { type: 1, hiddenGroup: 1 }], [0, 1]), 0)).toBe(true);
  });

  test('su una partita vera: una libera con compagne libere non avvisa, e ne esiste una senza compagne che avvisa', () => {
    const started = startRound({ spec: toSpec(legacyLevels[0]), profile: 'normal', seed: 3 });
    if (!started.ok) throw new Error('la partita non parte');
    const game = started.value.session.game;
    const free = [...game.ft.freeList()];
    const answers = free.map((i) => lacksFreeMatch(game, i));
    expect(answers).toContain(true);
    expect(answers).toContain(false);
    free.forEach((i, k) => expect(equalFreeTiles(game, [i]).length < game.g - 1).toBe(answers[k]));
  });
});
