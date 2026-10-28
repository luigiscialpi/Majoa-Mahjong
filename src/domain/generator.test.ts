import { checkInvariants, replay } from './__fixtures__/checks';
import { grid, pyramid90 } from './__fixtures__/shapes';
import { generateLevel } from './generator';
import type { LevelSpec } from './types';

const aids = { hints: null, shuffles: null, undo: null };
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [], fog: 0, gold: 0, aids, ...over });

const variants: [string, LevelSpec][] = [
  ['coppie su 5 piani', spec()],
  ['nascoste, nebbia e oro', spec({ hidden: [4, 4], fog: 6, gold: 5 })],
  ['tris su un piano', spec({ cells: grid(10, 9, 0), groupSize: 3, types: 8 })],
];
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

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
    for (const seed of seeds) {
      const r = generateLevel(s, seed);
      if (!r.ok) throw new Error(`seme ${seed}: ${JSON.stringify(r.error)}`);
      checkInvariants(s, r.value);
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
