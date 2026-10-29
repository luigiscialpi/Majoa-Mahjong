import { GameState, applyMove } from '../gameState';
import type { Rng } from '../prng';

/** Gioca fino a `maxMoves` mosse valide scelte a caso (si ferma se non ce ne sono). */
export function playRandomMoves(start: GameState, rng: Rng, maxMoves: number): GameState {
  let state = start;
  for (let m = 0; m < maxMoves; m++) {
    const options = [...state.playableByType().values()].filter((v) => v.length >= state.g);
    if (options.length === 0) break;
    const group = rng.shuffle([...options[rng.int(options.length)]]).slice(0, state.g);
    const r = applyMove(state, group);
    if (!r.ok) throw new Error(`mossa [${group.join(',')}] rifiutata: ${r.error}`);
    state = r.value;
  }
  return state;
}
