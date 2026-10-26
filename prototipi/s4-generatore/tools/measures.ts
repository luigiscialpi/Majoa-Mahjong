// Calcola le misure di difficoltà dei 100 livelli dell'originale (media su più semi) e le scrive in src/data/measures.json.
// Uso: node tools/measures.ts [semi per livello, predefinito 5] [partite simulate per tavola, predefinito 60]
import { writeFileSync } from 'node:fs';
import { generateLevel } from '../src/engine/generator.ts';
import { createRng } from '../src/engine/prng.ts';
import { simulate } from '../src/engine/solver.ts';
import { toSpec } from '../src/engine/legacy.ts';
import { loadLegacy } from '../src/engine/legacy-node.ts';
import { staticMeasures } from '../src/engine/difficulty.ts';

const seeds = Number(process.argv[2] ?? 5);
const runs = Number(process.argv[3] ?? 60);
const rows = loadLegacy().map((l) => {
  const spec = toSpec(l);
  let freedom = 0;
  let stuck = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const r = generateLevel(spec, seed);
    if (!r.ok) throw new Error(`livello ${l.id}: generazione fallita`);
    const s = simulate(r.value.tiles, spec.groupSize, spec.poolSize, createRng(1000 + seed), runs);
    freedom += s.freedom / seeds;
    stuck += s.stuck / seeds;
  }
  return { id: l.id, island: l.island, local: l.local, islandSize: l.islandSize, label: l.label, boss: l.boss, ...staticMeasures(spec), freedom, stuck };
});
writeFileSync(new URL('../src/data/measures.json', import.meta.url), JSON.stringify(rows) + '\n');
console.log(`misure scritte: ${rows.length} livelli, ${seeds} semi × ${runs} partite`);
