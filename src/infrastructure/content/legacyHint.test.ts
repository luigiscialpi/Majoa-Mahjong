import { originalFindPair } from '../../domain/__fixtures__/original';
import { GameState, applyMove } from '../../domain/gameState';
import { generateLevel } from '../../domain/generator';
import { findMove } from '../../domain/hint';
import { createRng } from '../../domain/prng';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(120_000);

describe('mossa suggerita sui 100 livelli dell\'originale', () => {
  test('in partite casuali coincide con findMove dell\'originale (coppie) e trova una mossa quando esiste (Tris)', () => {
    const rng = createRng(21);
    let passi = 0;
    for (const l of legacyLevels) {
      const spec = toSpec(l);
      const gen = generateLevel(spec, 1);
      if (!gen.ok) throw new Error(`livello ${l.id}: generazione fallita`);
      const tiles = gen.value.tiles;
      const groups = tiles.reduce((m, t) => Math.max(m, t.hiddenGroup), 0);
      let state = new GameState(tiles, spec.groupSize, spec.poolSize);
      while (state.remaining > 0) {
        const alive = new Set(tiles.keys());
        tiles.forEach((_, i) => {
          if (state.ft.alive[i] === 0) alive.delete(i);
        });
        const mine = findMove(state);
        if (spec.groupSize === 2) {
          expect({ id: l.id, rimaste: state.remaining, mossa: mine }).toEqual({ id: l.id, rimaste: state.remaining, mossa: originalFindPair(tiles, alive, state.unlocked, groups) });
        } else {
          expect({ id: l.id, rimaste: state.remaining, trovata: mine !== null }).toEqual({ id: l.id, rimaste: state.remaining, trovata: [...state.playableByType().values()].some((v) => v.length >= 3) });
        }
        // Prosegue con una mossa casuale tra quelle possibili, per visitare stati diversi da quelli seguiti dall'Aiuto.
        const options = [...state.playableByType().values()].filter((v) => v.length >= spec.groupSize);
        if (options.length === 0) break;
        const tilesOfType = rng.shuffle([...options[rng.int(options.length)]]);
        const next = applyMove(state, tilesOfType.slice(0, spec.groupSize));
        if (!next.ok) throw new Error(`livello ${l.id}: ${next.error}`);
        state = next.value;
        passi++;
      }
    }
    expect(passi).toBeGreaterThan(1000);
  });
});
