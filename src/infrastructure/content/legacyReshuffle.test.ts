import { checkReshuffle } from '../../domain/__fixtures__/checks';
import { playRandomMoves } from '../../domain/__fixtures__/play';
import { GameState } from '../../domain/gameState';
import { generateLevel } from '../../domain/generator';
import { createRng } from '../../domain/prng';
import { reshuffle } from '../../domain/reshuffle';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(120_000);

describe('rimescolo sui 100 livelli dell\'originale', () => {
  test('a un terzo e a due terzi della partita cambia solo i tipi e la partita resta risolvibile', () => {
    let unknown = 0;
    let controlli = 0;
    for (const l of legacyLevels) {
      const spec = toSpec(l);
      const gen = generateLevel(spec, 1);
      if (!gen.ok) throw new Error(`livello ${l.id}: generazione fallita`);
      const total = gen.value.tiles.length / spec.groupSize;
      for (const fraction of [1 / 3, 2 / 3]) {
        const before = playRandomMoves(new GameState(gen.value.tiles, spec.groupSize, spec.poolSize), createRng(l.id), Math.floor(total * fraction));
        if (before.remaining === 0) continue;
        const r = reshuffle(before, spec.types, l.id);
        if (!r.ok) throw new Error(`livello ${l.id}: ${JSON.stringify(r.error)}`);
        controlli++;
        if (checkReshuffle(before, r.value, spec.types, `livello ${l.id}`) === 'unknown') unknown++;
      }
    }
    expect(controlli).toBeGreaterThan(150);
    expect(unknown).toBe(0);
  });
});
