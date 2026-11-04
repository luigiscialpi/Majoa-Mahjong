import { fingerprint } from '../../domain/fingerprint';
import { generateLevel } from '../../domain/generator';
import { legacyLevels, toSpec } from './legacyLevels';

// Le partite si ricostruiscono da specifica e seme: se il generatore (o il PRNG) cambia le tavole a parità di seme,
// le partite salvate non tornano. Questo test fissa le tavole dei 100 livelli con i semi 1, 2 e 3. Se cambia di
// proposito, il nuovo valore va scelto insieme a una decisione sui salvataggi esistenti.
const GOLDEN = '61d4b3a6eb26fb03';

function* boards(): Generator<string> {
  for (const l of legacyLevels) for (const seed of [1, 2, 3]) yield JSON.stringify(generateLevel(toSpec(l), seed));
}

test('le tavole generate dai 100 livelli non cambiano a parità di seme', () => {
  expect(fingerprint(boards())).toBe(GOLDEN);
});
