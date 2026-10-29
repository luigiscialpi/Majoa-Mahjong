import { generateLevel } from '../../domain/generator';
import { legacyLevels, toSpec } from './legacyLevels';

// Le partite si ricostruiscono da specifica e seme: se il generatore (o il PRNG) cambia le tavole a parità di seme,
// le partite salvate non tornano. Questo test fissa le tavole dei 100 livelli con i semi 1, 2 e 3. Se cambia di
// proposito, il nuovo valore va scelto insieme a una decisione sui salvataggi esistenti.
const GOLDEN = '61d4b3a6eb26fb03';

/** Impronta a 64 bit (due FNV-1a a 32 bit con moltiplicatori diversi): basta a notare una modifica, senza dipendenze. */
function fingerprint(parts: Iterable<string>): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9747b28c;
  for (const text of parts) {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function* boards(): Generator<string> {
  for (const l of legacyLevels) for (const seed of [1, 2, 3]) yield JSON.stringify(generateLevel(toSpec(l), seed));
}

test('le tavole generate dai 100 livelli non cambiano a parità di seme', () => {
  expect(fingerprint(boards())).toBe(GOLDEN);
});
