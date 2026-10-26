import { readFileSync } from 'node:fs';
import type { LegacyLevel } from './legacy.ts';

/** I 100 livelli dell'originale (solo per test e strumenti in Node: legge il file con `fs`). */
export function loadLegacy(): LegacyLevel[] {
  return JSON.parse(readFileSync(new URL('../data/legacy-levels.json', import.meta.url), 'utf8')) as LegacyLevel[];
}
