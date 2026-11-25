import { ALBUM_CARDS, ALBUM_IDS, THEME_CARDS, allOwnedCards, animalsPlayCards, cardsNotIn, drawGiftCards, isAlbumId, ownedCards, playCards, themePlayCards } from './album';
import { newProgress, type IslandInfo, type Progress } from './progress';

const progressWith = (stars: Record<number, number>, giftCards: string[] = []): Progress => ({
  ...newProgress(),
  giftCards,
  levels: Object.fromEntries(Object.entries(stars).map(([id, s]) => [id, { stars: s, bestSeconds: null, gold: 0, profile: null }])),
});

const ISLANDS: IslandInfo[] = [
  { id: 'animals', levelIds: [1, 2, 3, 4], gift: 3, album: 'animals', bossLevelIds: [4] },
  { id: 'sweets', levelIds: [5, 6, 7, 8], gift: 5, album: 'sweets', bossLevelIds: [8] },
  { id: 'generated-8', levelIds: [9, 10], gift: 5, album: 'sweets', bossLevelIds: [10] },
];

describe('catalogo: 111 carte in 6 album', () => {
  test('41 carte in «Animali», 14 in ognuno dei cinque album di tema, tutte con id diverso', () => {
    expect(ALBUM_IDS).toEqual(['animals', 'sweets', 'art', 'science', 'sea', 'flowers']);
    expect(ALBUM_CARDS.animals).toHaveLength(41);
    for (const id of ALBUM_IDS.slice(1)) expect(ALBUM_CARDS[id]).toHaveLength(THEME_CARDS);
    const all = ALBUM_IDS.flatMap((id) => ALBUM_CARDS[id]);
    expect(all).toHaveLength(111);
    expect(new Set(all).size).toBe(111);
  });

  test('«Animali» ha 10 cani, 8 gatti, 6 pappagalli, 5 pappagallini e 12 dello zoo', () => {
    const count = (category: string) => ALBUM_CARDS.animals.filter((card) => card.startsWith(category)).length;
    expect(['dogs', 'cats', 'parrots', 'budgies', 'zoo'].map(count)).toEqual([10, 8, 6, 5, 12]);
  });

  test('«Animali» gira tra le categorie: la prima carta di ognuna, poi la seconda, ecc.', () => {
    expect(ALBUM_CARDS.animals.slice(0, 10)).toEqual(['dogs0', 'cats0', 'parrots0', 'budgies0', 'zoo0', 'dogs1', 'cats1', 'parrots1', 'budgies1', 'zoo1']);
    // l'ultima carta di ogni categoria arriva alla 24ª (pappagallini), 28ª (pappagalli), 34ª (gatti), 38ª (cani) e 41ª (zoo)
    const position = (card: string) => ALBUM_CARDS.animals.indexOf(card) + 1;
    expect(['budgies4', 'parrots5', 'cats7', 'dogs9', 'zoo11'].map(position)).toEqual([24, 28, 34, 38, 41]);
  });

  test('gli album di tema seguono l\'ordine dei 14 disegni dell\'isola', () => {
    expect(ALBUM_CARDS.sweets).toEqual(Array.from({ length: 14 }, (_, i) => `sweets${i}`));
    expect(isAlbumId('flowers') && !isAlbumId('prologue') && !isAlbumId(3)).toBe(true);
  });
});

describe('formule delle carte guadagnate giocando', () => {
  test.each([[0, 0, 0], [4, 0, 0], [5, 0, 1], [9, 4, 5], [45, 4, 13], [60, 4, 13], [0, 4, 4], [10, 20, 13]])('album di tema con %i stelle e %i boss: %i carte', (stars, bosses, cards) => {
    expect(themePlayCards(stars, bosses)).toBe(cards);
  });

  test.each([[0, 0], [7, 0], [8, 1], [16, 2], [320, 40], [328, 41], [1000, 41]])('«Animali» con %i stelle: %i carte', (stars, cards) => {
    expect(animalsPlayCards(stars)).toBe(cards);
  });

  test('album di tema: le stelle e i boss della sua isola, e solo quelli', () => {
    const p = progressWith({ 1: 3, 2: 3, 5: 3, 6: 2, 7: 0, 8: 1 });
    expect(playCards('sweets', p, ISLANDS)).toBe(Math.floor(6 / 5) + 1);
    expect(playCards('art', p, ISLANDS)).toBe(0);
    // un boss con zero stelle non è vinto
    expect(playCards('sweets', progressWith({ 5: 3, 6: 2, 8: 0 }), ISLANDS)).toBe(1);
  });

  test('un\'isola che ripete il tema non conta per l\'album (da decidere)', () => {
    expect(playCards('sweets', progressWith({ 9: 3, 10: 3 }), ISLANDS)).toBe(0);
  });

  test('«Animali»: le stelle di tutte le isole, boss e isole generate comprese', () => {
    expect(playCards('animals', progressWith({ 1: 3, 2: 3, 5: 3, 8: 3, 9: 3, 10: 3 }), ISLANDS)).toBe(Math.floor(18 / 8));
    expect(playCards('animals', progressWith({ 4: 3 }), ISLANDS)).toBe(0);
  });
});

describe('carte possedute', () => {
  test('senza carte regalate sono le prime dell\'ordine fisso', () => {
    expect(ownedCards('animals', progressWith({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 }), ISLANDS)).toEqual(['dogs0', 'cats0', 'parrots0']);
    expect(ownedCards('sweets', newProgress(), ISLANDS)).toEqual([]);
  });

  test('una carta regalata si salta nell\'ordine fisso: il totale è carte giocate + carte regalate', () => {
    // 10 stelle (2 carte) e il boss vinto (1): 3 carte giocate, più la regalata sweets2, che si salta
    const p = progressWith({ 5: 3, 6: 3, 7: 3, 8: 1 }, ['sweets2']);
    expect(playCards('sweets', p, ISLANDS)).toBe(3);
    expect(ownedCards('sweets', p, ISLANDS)).toEqual(['sweets0', 'sweets1', 'sweets2', 'sweets3']);
    // la regalata è la prima dell'ordine: le giocate partono dalla seconda
    expect(ownedCards('sweets', progressWith({ 5: 3, 6: 3, 7: 3, 8: 3 }, ['sweets0']), ISLANDS)).toEqual(['sweets0', 'sweets1', 'sweets2', 'sweets3']);
  });

  test('le carte regalate di un altro album non entrano e l\'album non supera le sue carte', () => {
    expect(ownedCards('sweets', progressWith({}, ['dogs0', 'art3']), ISLANDS)).toEqual([]);
    const full = Array.from({ length: 14 }, (_, i) => `sweets${i}`);
    expect(ownedCards('sweets', progressWith({ 5: 3, 6: 3, 7: 3, 8: 3 }, full), ISLANDS)).toEqual(full);
  });

  test('tutti gli album, album per album', () => {
    expect(allOwnedCards(progressWith({}, ['sweets1', 'dogs0']), ISLANDS)).toEqual(['dogs0', 'sweets1']);
  });

  test('le carte nuove sono quelle che prima non c\'erano, nell\'ordine di dopo', () => {
    expect(cardsNotIn(['a', 'b'], ['a', 'c', 'b', 'd'])).toEqual(['c', 'd']);
  });
});

describe('carta del regalo d\'isola', () => {
  test('una carta a caso tra quelle che mancano, sempre la stessa con gli stessi progressi', () => {
    const first = drawGiftCards(newProgress(), [ISLANDS[1]], ISLANDS);
    expect(first.giftCards).toHaveLength(1);
    expect(ALBUM_CARDS.sweets).toContain(first.giftCards[0]);
    expect(drawGiftCards(newProgress(), [ISLANDS[1]], ISLANDS)).toEqual(first);
  });

  test('sceglie solo tra le mancanti, comprese le guadagnate giocando', () => {
    const owned = Array.from({ length: 12 }, (_, i) => `sweets${i}`);
    const p = progressWith({ 5: 3, 6: 3 }, owned.slice(1));
    // gioco: 2 carte (6 stelle → 1, più 0 boss) → sweets0 giocata, resta solo una carta da avere tra sweets12 e sweets13
    const drawn = drawGiftCards(p, [ISLANDS[1]], ISLANDS).giftCards;
    expect(drawn.slice(0, p.giftCards.length)).toEqual(p.giftCards);
    expect(['sweets12', 'sweets13']).toContain(drawn[drawn.length - 1]);
  });

  test('le ultime carte mancanti: l\'unica rimasta; con l\'album completo nessuna carta', () => {
    const almost = Array.from({ length: 13 }, (_, i) => `sweets${i}`);
    expect(drawGiftCards(progressWith({}, almost), [ISLANDS[1]], ISLANDS).giftCards).toEqual([...almost, 'sweets13']);
    const full = [...almost, 'sweets13'];
    expect(drawGiftCards(progressWith({}, full), [ISLANDS[1]], ISLANDS).giftCards).toEqual(full);
  });

  test('due isole dello stesso album aperte insieme danno due carte diverse; un\'isola senza album nessuna', () => {
    const p = drawGiftCards(newProgress(), [ISLANDS[1], ISLANDS[2]], ISLANDS);
    expect(p.giftCards).toHaveLength(2);
    expect(new Set(p.giftCards).size).toBe(2);
    const bare: IslandInfo = { id: 'prologue', levelIds: [11], gift: 5 };
    expect(drawGiftCards(newProgress(), [bare], [bare])).toEqual(newProgress());
  });

  test('«Animali» dà una carta di «Animali»', () => {
    const p = drawGiftCards(newProgress(), [ISLANDS[0]], ISLANDS);
    expect(ALBUM_CARDS.animals).toContain(p.giftCards[0]);
  });
});
