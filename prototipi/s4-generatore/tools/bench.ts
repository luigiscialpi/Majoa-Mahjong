// Prestazioni del motore in Node (V8) sui 100 livelli dell'originale. Su Hermes: pulsante «Prova» dell'app.
// Uso: node tools/bench.ts [semi per livello, predefinito 20] [partite simulate, predefinito 40]
import { formatReport, runBench } from '../src/engine/bench.ts';
import { loadLegacy } from '../src/engine/legacy-node.ts';

const report = await runBench(loadLegacy(), Number(process.argv[2] ?? 20), Number(process.argv[3] ?? 40));
console.log(formatReport(report).join('\n'));
