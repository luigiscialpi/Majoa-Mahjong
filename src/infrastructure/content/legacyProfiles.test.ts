import { checkInvariants } from '../../domain/__fixtures__/checks';
import { ORIGINAL_DIF, originalFogCount, originalNEff, originalScaleAid } from '../../domain/__fixtures__/original';
import { generateLevel } from '../../domain/generator';
import { PROFILES, PROFILE_RULES, applyProfile } from '../../domain/profile';
import { solve } from '../../domain/solver';
import { legacyLevels, toSpec } from './legacyLevels';

jest.setTimeout(120_000);

const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto

/** Legge da "Majoa Mahjong.html" una costante come `DIF_TM=[1.5,1,.9,.8,.7,.6]`. */
function originalArray(name: string): (number | null)[] {
  const source = fs.readFileSync(ORIGINAL_HTML, 'utf8');
  const match = new RegExp(`\\b${name}=\\[([^\\]]*)\\]`).exec(source);
  if (!match) throw new Error(`${name} non trovata in ${ORIGINAL_HTML}`);
  return match[1].split(',').map((x) => (x.trim() === 'null' ? null : Number(x)));
}

describe('profili di difficoltà sui 100 livelli dell\'originale', () => {
  test('le costanti usate dai test e dal dominio sono quelle scritte nell\'HTML dell\'originale', () => {
    const fromHtml = {
      aid: originalArray('DIF_AID'),
      aidNull: originalArray('DIF_AID_NULL'),
      n: originalArray('DIF_N'),
      resc: originalArray('DIF_RESC'),
      tm: originalArray('DIF_TM'),
      fogM: originalArray('DIF_FOGM'),
      fogAdd: originalArray('DIF_FOGADD'),
      bonus: originalArray('DIF_BONUS'),
    };
    expect(fromHtml).toEqual(ORIGINAL_DIF);
    expect(PROFILES.map((p) => PROFILE_RULES[p].timeFactor)).toEqual(fromHtml.tm);
    expect(PROFILES.map((p) => PROFILE_RULES[p].freeShuffles)).toEqual(fromHtml.resc);
  });

  test('Normale lascia invariata la specifica di tutti i livelli', () => {
    for (const l of legacyLevels) expect({ id: l.id, spec: applyProfile(toSpec(l), 'normal') }).toEqual({ id: l.id, spec: toSpec(l) });
  });

  test('disegni, nebbia e aiuti di ogni livello e profilo coincidono con quelli calcolati dall\'originale', () => {
    PROFILES.forEach((profile, d) => {
      for (const l of legacyLevels) {
        const got = applyProfile(toSpec(l), profile);
        const poolLen = l.poolSize + (l.island === 'tris' ? 0 : 1); // nell'originale il gruppo comprende la stella, tranne nei Tris
        expect({ id: l.id, profile, types: got.types, fog: got.fog, aids: got.aids }).toEqual({
          id: l.id,
          profile,
          types: originalNEff(l.types, poolLen, d),
          fog: originalFogCount(l.fog, d),
          aids: { hints: originalScaleAid(l.aids.hints, d, 'hints'), shuffles: originalScaleAid(l.aids.shuffles, d, 'shuffles'), undo: originalScaleAid(l.aids.undo, d, 'undo') },
        });
      }
    });
  });

  test('con ogni profilo tutti i livelli si generano, rispettano la specifica e il solver non li dichiara irrisolvibili', () => {
    let unsolvable = 0;
    let unknown = 0;
    let total = 0;
    for (const profile of PROFILES) {
      for (const l of legacyLevels) {
        const spec = applyProfile(toSpec(l), profile);
        const r = generateLevel(spec, 1);
        if (!r.ok) throw new Error(`livello ${l.id}, ${profile}: ${JSON.stringify(r.error)}`);
        checkInvariants(spec, r.value);
        const { status } = solve(r.value.tiles, spec.groupSize, spec.poolSize);
        total++;
        if (status === 'unsolvable') unsolvable++;
        if (status === 'unknown') unknown++;
      }
    }
    expect({ total, unsolvable, unknown }).toEqual({ total: 600, unsolvable: 0, unknown: 0 });
  });
});
