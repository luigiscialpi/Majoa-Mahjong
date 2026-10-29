import { ORIGINAL_DIF, originalFogCount, originalNEff, originalScaleAid } from './__fixtures__/original';
import { pyramid90 } from './__fixtures__/shapes';
import { PROFILES, PROFILE_RULES, applyProfile, effectiveTypes, fogCount, scaleAid, type AidKind, type Profile } from './profile';
import type { LevelSpec } from './types';

const kinds: AidKind[] = ['hints', 'shuffles', 'undo'];
const values = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 20];
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({ id: 'test', cells: pyramid90(), groupSize: 2, types: 12, poolSize: 24, hidden: [4, 4], fog: 6, gold: 5, aids: { hints: 5, shuffles: 3, undo: null }, ...over });

describe('PROFILE_RULES', () => {
  test('la tabella coincide con le costanti dell\'originale, profilo per profilo', () => {
    PROFILES.forEach((p, d) => {
      expect({ p, ...PROFILE_RULES[p] }).toEqual({
        p,
        aidFactor: ORIGINAL_DIF.aid[d],
        unlimitedAidBecomes: ORIGINAL_DIF.aidNull[d],
        typesDelta: ORIGINAL_DIF.n[d],
        freeShuffles: ORIGINAL_DIF.resc[d],
        timeFactor: ORIGINAL_DIF.tm[d],
        fogFactor: ORIGINAL_DIF.fogM[d],
        fogAdd: ORIGINAL_DIF.fogAdd[d],
        bonus: ORIGINAL_DIF.bonus[d],
      });
    });
  });

  test('i sei profili sono in ordine di difficoltà crescente: le restrizioni non diminuiscono', () => {
    expect(PROFILES).toEqual(['easy', 'normal', 'medium', 'hard', 'expert', 'master']);
    for (let i = 1; i < PROFILES.length; i++) {
      const a = PROFILE_RULES[PROFILES[i - 1]];
      const b = PROFILE_RULES[PROFILES[i]];
      expect({ da: PROFILES[i - 1], a: PROFILES[i], aiutiNonCrescono: b.aidFactor <= a.aidFactor, tipiNonCalano: b.typesDelta >= a.typesDelta, tempoNonCresce: b.timeFactor <= a.timeFactor, bonusNonCala: b.bonus >= a.bonus }).toEqual({ da: PROFILES[i - 1], a: PROFILES[i], aiutiNonCrescono: true, tipiNonCalano: true, tempoNonCresce: true, bonusNonCala: true });
    }
  });
});

describe('scaleAid', () => {
  test('coincide con l\'originale per ogni profilo, tipo di aiuto e valore', () => {
    PROFILES.forEach((p, d) => {
      for (const kind of kinds) for (const v of values) expect({ p, kind, v, r: scaleAid(v, p, kind) }).toEqual({ p, kind, v, r: originalScaleAid(v, d, kind) });
    });
  });

  test('esempi: Normale invariato, Facile raddoppia e rende illimitati i valori da 8, Maestro azzera ma il Mischia resta 1', () => {
    expect(scaleAid(5, 'normal', 'hints')).toBe(5);
    expect(scaleAid(null, 'normal', 'undo')).toBeNull();
    expect(scaleAid(3, 'easy', 'hints')).toBe(6);
    expect(scaleAid(7, 'easy', 'hints')).toBe(14);
    expect(scaleAid(8, 'easy', 'hints')).toBeNull();
    expect(scaleAid(null, 'easy', 'hints')).toBeNull();
    expect(scaleAid(5, 'medium', 'hints')).toBe(4); // 3,75 arrotondato
    expect(scaleAid(2, 'medium', 'hints')).toBe(2); // 1,5 arrotondato per eccesso
    expect(scaleAid(null, 'hard', 'undo')).toBe(6);
    expect(scaleAid(5, 'master', 'hints')).toBe(0);
    expect(scaleAid(null, 'master', 'undo')).toBe(0);
    expect(scaleAid(5, 'master', 'shuffles')).toBe(1);
    expect(scaleAid(null, 'master', 'shuffles')).toBe(1);
    expect(scaleAid(0, 'normal', 'shuffles')).toBe(0); // Normale non tocca nulla, nemmeno il minimo del Mischia
  });
});

describe('effectiveTypes e fogCount', () => {
  test('i disegni restano tra 5 e poolSize − 1; coincidono con l\'originale se il suo gruppo ha una tessera in più (la stella)', () => {
    PROFILES.forEach((p, d) => {
      for (const types of [5, 6, 10, 12, 20, 23, 24]) {
        for (const poolSize of [14, 24, 28]) {
          if (types > poolSize) continue;
          expect({ p, types, poolSize, n: effectiveTypes(types, poolSize, p) }).toEqual({ p, types, poolSize, n: originalNEff(types, poolSize + 1, d) });
        }
      }
    });
    expect(effectiveTypes(5, 14, 'easy')).toBe(5); // il minimo
    expect(effectiveTypes(12, 14, 'master')).toBe(13); // poolSize − 1
  });

  test('nebbia: moltiplicatore e tessere in più, anche se il livello non ne ha (difetto 7 replicato)', () => {
    PROFILES.forEach((p, d) => {
      for (const fog of [0, 3, 4, 5, 6, 7, 8, 10, 12, 14]) expect({ p, fog, f: fogCount(fog, p) }).toEqual({ p, fog, f: originalFogCount(fog, d) });
    });
    expect(fogCount(0, 'normal')).toBe(0);
    expect(fogCount(0, 'master')).toBe(3);
    expect(fogCount(6, 'easy')).toBe(3);
  });
});

describe('applyProfile', () => {
  test('Normale non cambia la specifica', () => {
    expect(applyProfile(spec(), 'normal')).toEqual(spec());
  });

  test('cambia solo disegni, nebbia e aiuti; tavola, nascoste, oro e gruppo restano', () => {
    for (const p of PROFILES as readonly Profile[]) {
      const base = spec();
      const r = applyProfile(base, p);
      expect({ p, cells: r.cells, groupSize: r.groupSize, hidden: r.hidden, gold: r.gold, poolSize: r.poolSize, id: r.id }).toEqual({ p, cells: base.cells, groupSize: base.groupSize, hidden: base.hidden, gold: base.gold, poolSize: base.poolSize, id: base.id });
    }
    expect(applyProfile(spec(), 'hard')).toMatchObject({ types: 14, fog: 10, aids: { hints: 3, shuffles: 2, undo: 6 } });
  });

  test('non modifica la specifica ricevuta', () => {
    const base = spec();
    applyProfile(base, 'master');
    expect(base).toEqual(spec());
  });
});
