import { grid, pyramid90 } from './__fixtures__/shapes';
import { FreeTracker, buildAdjacency } from './geometry';
import { GameState, applyMove } from './gameState';
import { generateLevel } from './generator';
import { STAR_TYPE, type Generated, type LevelSpec } from './types';

const aids = { hints: null, shuffles: null, undo: null };
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids, ...over });

const variants: [string, LevelSpec][] = [
  ['coppie su 5 piani', spec()],
  ['nascoste, nebbia e oro', spec({ hidden: [4, 4], fog: 6, gold: 5 })],
  ['tris su un piano', spec({ cells: grid(10, 9, 0), groupSize: 3, types: 8 })],
];
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * Rigioca la soluzione costruita con le regole di gioco (`applyMove`), indipendenti dal generatore. Un blocco del piano
 * ha `groupSize` o `2 × groupSize` tessere uguali libere insieme: si toglie a gruppi di `groupSize`.
 */
function replay(s: LevelSpec, g: Generated) {
  let state = new GameState(g.tiles, s.groupSize, s.poolSize);
  for (const block of g.plan) {
    for (let k = 0; k < block.length; k += s.groupSize) {
      const group = block.slice(k, k + s.groupSize);
      const r = applyMove(state, group);
      if (!r.ok) throw new Error(`mossa [${group.join(',')}] rifiutata: ${r.error}`);
      state = r.value;
    }
  }
  expect(state.remaining).toBe(0);
}

describe('generateLevel', () => {
  test('stessa specifica e stesso seme producono la stessa tavola; semi diversi no', () => {
    const a = generateLevel(spec(), 7);
    const b = generateLevel(spec(), 7);
    const c = generateLevel(spec(), 8);
    if (!a.ok || !b.ok || !c.ok) throw new Error('generazione fallita');
    expect(a.value).toEqual(b.value);
    expect(a.value.tiles.map((t) => t.type)).not.toEqual(c.value.tiles.map((t) => t.type));
  });

  test.each(variants)('%s: la soluzione costruita è giocabile secondo le regole', (_name, s) => {
    for (const seed of seeds) {
      const r = generateLevel(s, seed);
      if (!r.ok) throw new Error(`seme ${seed}: ${JSON.stringify(r.error)}`);
      replay(s, r.value);
    }
  });

  test.each(variants)('%s: tipi, stelle, nascoste, nebbia e oro rispettano la specifica', (_name, s) => {
    const g = s.groupSize;
    for (const seed of seeds) {
      const r = generateLevel(s, seed);
      if (!r.ok) throw new Error(`seme ${seed}: ${JSON.stringify(r.error)}`);
      const { tiles } = r.value;
      const counts = new Map<number, number>();
      for (const t of tiles) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
      for (const [type, c] of counts) expect({ type, resto: c % g }).toEqual({ type, resto: 0 });
      expect(counts.get(STAR_TYPE) ?? 0).toBe(s.hidden.length * g);
      expect(counts.size - (counts.has(STAR_TYPE) ? 1 : 0)).toBeLessThanOrEqual(s.types);
      s.hidden.forEach((h, gi) => expect(tiles.filter((t) => t.hiddenGroup === gi + 1).length).toBe(h));
      expect(tiles.filter((t) => t.gold).length).toBe(s.gold);
      expect(tiles.filter((t) => t.fog).length).toBeLessThanOrEqual(s.fog);
      const first = new FreeTracker(buildAdjacency(tiles));
      tiles.forEach((t, i) => {
        if (t.fog) expect({ i, libera: first.isFree(i) }).toEqual({ i, libera: false });
        if (t.gold) expect(t.type === STAR_TYPE || t.hiddenGroup > 0).toBe(false);
      });
    }
  });

  test('specifica non valida: invalid-spec', () => {
    const kind = (s: LevelSpec) => {
      const r = generateLevel(s, 1);
      return r.ok ? 'ok' : r.error.kind;
    };
    expect(kind(spec({ cells: pyramid90().slice(0, 89) }))).toBe('invalid-spec');
    expect(kind(spec({ types: 25 }))).toBe('invalid-spec');
    expect(kind(spec({ types: 0 }))).toBe('invalid-spec');
    expect(kind(spec({ hidden: [200] }))).toBe('invalid-spec');
  });

  test('tavola che non può dare un gruppo di tessere libere: generation-failed con il numero di tentativi', () => {
    // Sulla piramide all'inizio sono libere 4 tessere, ma con 8 tipi e gruppi da 3 servono gruppi da 6.
    const r = generateLevel(spec({ groupSize: 3, types: 8 }), 1, 5);
    expect(r).toEqual({ ok: false, error: { kind: 'generation-failed', attempts: 5 } });
  });
});
