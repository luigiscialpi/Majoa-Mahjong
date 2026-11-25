/** @jest-environment node */
import { ALBUM_CARDS, ALBUM_IDS } from '../../domain/album';
import { ANIMAL_SOURCES, cardArt } from './albumCards';
import themes from './legacy-themes.json';

const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto
// Modulo di Node senza tipi nel progetto (`tsconfig.json` ha solo `jest`): `requireActual` lo restituisce come `any`.
const { readFileSync } = jest.requireActual('node:fs') as { readFileSync(path: string, encoding: 'utf8'): string };
const html = readFileSync(ORIGINAL_HTML, 'utf8');
const evaluate = (source: string): unknown => new Function(`return ${source};`)();
const originalSources = evaluate(/var ALBUM_SRC=(\{[\s\S]*?\});/.exec(html)?.[1] ?? 'null') as Record<string, (number | string)[]>;
const originalCategories = evaluate(/var ALB_CATS=(\[.*?\]);/.exec(html)?.[1] ?? 'null') as string[];

describe('carte d\'album e originale', () => {
  test('i disegni di «Animali» sono quelli di ALBUM_SRC dell\'originale', () => {
    expect(ANIMAL_SOURCES).toEqual(originalSources);
  });

  test('l\'ordine di «Animali» è quello di ALBUM_ORDER: si gira tra le categorie di ALB_CATS', () => {
    const order: string[] = [];
    for (let i = 0; i < 12; i++) for (const category of originalCategories) if (i < originalSources[category].length) order.push(`${category}${i}`);
    expect(ALBUM_CARDS.animals).toEqual(order);
  });

  test('gli album di tema sono i 14 disegni dell\'isola (islandItems dell\'originale: il gruppo senza la stella)', () => {
    const islands = themes.islands as Record<string, number[]>;
    for (const album of ALBUM_IDS.slice(1)) {
      expect(islands[album]).toHaveLength(14);
      expect(ALBUM_CARDS[album].map((card) => cardArt(card))).toEqual(islands[album].map((design) => ({ design })));
    }
  });
});

describe('disegni delle carte', () => {
  test('ogni carta ha il suo disegno e un id fuori dal catalogo non ne ha', () => {
    for (const album of ALBUM_IDS) for (const card of ALBUM_CARDS[album]) expect(cardArt(card)).toBeDefined();
    expect(cardArt('dogs10')).toBeUndefined();
    expect(cardArt('nessuna')).toBeUndefined();
  });

  test('le tre mascotte sono carte di «Animali»: Collie e Shetland tra i cani, la Siamese a pelo lungo tra i gatti', () => {
    expect([cardArt('dogs5'), cardArt('dogs6'), cardArt('cats4')]).toEqual([{ mascot: 'collie' }, { mascot: 'sheltie' }, { mascot: 'siamlong' }]);
  });

  test('i disegni 110-128 stanno solo in «Animali», ognuno una volta; nessuna carta mostra la stella', () => {
    const designs = ALBUM_IDS.flatMap((album) => ALBUM_CARDS[album].map((card) => cardArt(card))).flatMap((art) => (art && 'design' in art ? [art.design] : []));
    const onlyAlbum = ALBUM_CARDS.animals.flatMap((card) => { const art = cardArt(card); return art && 'design' in art && art.design >= 110 ? [art.design] : []; });
    expect(onlyAlbum.sort((a, b) => a - b)).toEqual(Array.from({ length: 19 }, (_, i) => 110 + i));
    expect(designs.filter((d) => d >= 110)).toHaveLength(19);
    expect(designs).not.toContain(themes.starDesign);
  });
});
