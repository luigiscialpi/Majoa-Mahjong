import { generateLevel } from './generator.ts';
import { toSpec, type LegacyLevel } from './legacy.ts';
import { createRng } from './prng.ts';
import { simulate, solve } from './solver.ts';

export type Dist = { mean: number; median: number; p95: number; max: number };
export type BenchReport = {
  levels: number;
  seeds: number;
  generated: number;
  failed: number;
  genMs: Dist;
  attempts: Dist;
  solver: { solvable: number; unsolvable: number; unknown: number; ms: Dist; nodes: Dist };
  simMs: Dist;
  worst: { id: number; seed: number; ms: number; attempts: number }[];
  totalMs: number;
};

const dist = (a: number[]): Dist => {
  const s = [...a].sort((x, y) => x - y);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { mean: a.reduce((x, y) => x + y, 0) / a.length, median: at(0.5), p95: at(0.95), max: s[s.length - 1] };
};

/**
 * Misura il motore su un elenco di livelli: generazione (`seeds` semi per livello), solver e simulazione (3 semi per livello,
 * `simRuns` partite). `pause` si chiama tra un livello e l'altro (nell'app serve a lasciare respirare l'interfaccia).
 */
export async function runBench(levels: readonly LegacyLevel[], seeds: number, simRuns: number, pause?: () => Promise<void>): Promise<BenchReport> {
  const t00 = performance.now();
  const genMs: number[] = [];
  const attempts: number[] = [];
  const solveMs: number[] = [];
  const nodes: number[] = [];
  const simMs: number[] = [];
  const status = { solvable: 0, unsolvable: 0, unknown: 0 };
  const worst: BenchReport['worst'] = [];
  let failed = 0;
  for (const l of levels) {
    const spec = toSpec(l);
    for (let seed = 1; seed <= seeds; seed++) {
      const t0 = performance.now();
      const r = generateLevel(spec, seed);
      const ms = performance.now() - t0;
      genMs.push(ms);
      if (!r.ok) {
        failed++;
        continue;
      }
      attempts.push(r.value.attempts);
      worst.push({ id: l.id, seed, ms, attempts: r.value.attempts });
      if (seed <= 3) {
        const t1 = performance.now();
        const s = solve(r.value.tiles, spec.groupSize, spec.poolSize);
        solveMs.push(performance.now() - t1);
        nodes.push(s.nodes);
        status[s.status]++;
        const t2 = performance.now();
        simulate(r.value.tiles, spec.groupSize, spec.poolSize, createRng(seed), simRuns);
        simMs.push(performance.now() - t2);
      }
    }
    if (pause) await pause();
  }
  return {
    levels: levels.length,
    seeds,
    generated: genMs.length - failed,
    failed,
    genMs: dist(genMs),
    attempts: dist(attempts),
    solver: { ...status, ms: dist(solveMs), nodes: dist(nodes) },
    simMs: dist(simMs),
    worst: worst.sort((a, b) => b.ms - a.ms).slice(0, 5),
    totalMs: performance.now() - t00,
  };
}

const f = (x: number) => x.toFixed(1);
/** Righe di testo del rapporto (stesso formato in Node e nell'app). */
export function formatReport(r: BenchReport): string[] {
  return [
    `Generazione: ${r.generated + r.failed} tavole (${r.levels} livelli × ${r.seeds} semi), fallite ${r.failed}`,
    `  tempo ms: media ${f(r.genMs.mean)} · mediana ${f(r.genMs.median)} · p95 ${f(r.genMs.p95)} · max ${f(r.genMs.max)}`,
    `  tentativi: media ${f(r.attempts.mean)} · p95 ${r.attempts.p95} · max ${r.attempts.max}`,
    `Solver (3 semi per livello): ${r.solver.solvable} risolvibili, ${r.solver.unsolvable} no, ${r.solver.unknown} sconosciuti`,
    `  tempo ms: media ${f(r.solver.ms.mean)} · p95 ${f(r.solver.ms.p95)} · max ${f(r.solver.ms.max)} · nodi: media ${f(r.solver.nodes.mean)} · max ${r.solver.nodes.max}`,
    `Simulazione (partite per tavola): ms per livello: media ${f(r.simMs.mean)} · p95 ${f(r.simMs.p95)} · max ${f(r.simMs.max)}`,
    `Più lente: ${r.worst.map((w) => `L${w.id}/s${w.seed} ${f(w.ms)} ms (${w.attempts} tent.)`).join(' · ')}`,
    `Totale: ${f(r.totalMs / 1000)} s`,
  ];
}
