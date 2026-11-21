import { INTRO_IDS } from '../domain/settings';
import { campaignLevelById } from '../infrastructure/content/campaignLevels';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { locale } from '../infrastructure/i18n';
import { introFor, introText } from './intros';

describe('introFor', () => {
  test('un livello a gruppi di tre ha la spiegazione del Tris; a coppie, nessuna', () => {
    expect(introFor({ groupSize: 3 })).toBe('tris');
    expect(introFor({ groupSize: 2 })).toBeNull();
  });

  test('sui livelli veri: i Tris al primo posto delle isole e i dieci originali sì, gli altri no', () => {
    for (const id of [21, 41, 51, 61, 71, 81, 151, 171]) expect({ id, intro: introFor(campaignLevelById(id)!) }).toEqual({ id, intro: 'tris' });
    for (const level of legacyLevels.filter((l) => l.groupSize === 3)) expect(introFor(campaignLevelById(level.id)!)).toBe('tris');
    for (const id of [1, 20, 22, 40, 52, 101, 152]) expect({ id, intro: introFor(campaignLevelById(id)!) }).toEqual({ id, intro: null });
  });

  test('ogni spiegazione nota ha il suo testo in tutte le lingue: un titolo e tre righe', () => {
    for (const lang of ['it', 'en', 'fr'] as const) {
      for (const id of INTRO_IDS) {
        const entry = introText(id, locale(lang).intro);
        expect({ lang, id, ok: !!entry }).toEqual({ lang, id, ok: true });
        expect(entry!.t.length).toBeGreaterThan(0);
        expect(entry!.l).toHaveLength(3);
      }
    }
  });

  test('il testo del Tris è quello dell\'originale, sotto il livello 91', () => {
    expect(introText('tris', locale('it').intro)).toBe(locale('it').intro[91]);
    expect(introText('tris', {})).toBeUndefined();
  });
});
