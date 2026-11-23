import { newProgress, type IslandInfo, type Progress } from '../domain/progress';
import { legacyIslands } from '../infrastructure/content/legacyIslands';
import { isTrisRoomOpen, islandStatus, levelStatus } from './levelStatus';

const ISLANDS: IslandInfo[] = [
  { id: 'prologue', levelIds: [1, 2, 3], gift: 0 },
  { id: 'animals', levelIds: [4, 5, 6], gift: 3 },
  { id: 'sweets', levelIds: [7, 8], gift: 5 },
];
const stars = (byLevel: Record<number, number>): Progress => ({
  ...newProgress(),
  levels: Object.fromEntries(Object.entries(byLevel).map(([id, s]) => [id, { stars: s, bestSeconds: null, gold: 0, profile: null }])),
});
const locked = (reason: string) => ({ open: false, reason });
const status = (progress: Progress, levelId: number, prova = false, islands: readonly IslandInfo[] = ISLANDS) => levelStatus(progress, islands, levelId, prova);

describe('islandStatus', () => {
  test('la mappa espone le isole aperte e la prossima con il requisito mancante', () => {
    expect(islandStatus(newProgress(), ISLANDS, 0, false)).toEqual({ open: true });
    expect(islandStatus(newProgress(), ISLANDS, 1, false)).toEqual(locked('Servono 6 ★ per aprire Animali'));
    expect(islandStatus(newProgress(), ISLANDS, 2, false)).toEqual(locked('Servono 6 ★ per aprire Dolci'));
  });

  test('con stelle sufficienti ma isola incompleta indica il livello da vincere', () => {
    expect(islandStatus(stars({ 1: 3, 2: 3 }), ISLANDS, 1, false)).toEqual(locked('Vinci il livello 3 per aprire Animali'));
  });

  test('la modalità prova apre tutte le isole della campagna', () => {
    expect(islandStatus(newProgress(), ISLANDS, 2, true)).toEqual({ open: true });
  });
});

describe('levelStatus', () => {
  test('con la modalità prova tutto è aperto, anche i Tris e le isole chiuse', () => {
    for (const id of [1, 3, 4, 8, 91, 100]) expect(status(newProgress(), id, true)).toEqual({ open: true });
  });

  test('il primo livello della prima isola è sempre aperto', () => {
    expect(status(newProgress(), 1)).toEqual({ open: true });
  });

  test('dentro un\'isola aperta si vince il livello prima: con almeno una stella', () => {
    expect(status(newProgress(), 2)).toEqual(locked('Vinci il livello 1 per aprire questo'));
    expect(status(newProgress(), 3)).toEqual(locked('Vinci il livello 2 per aprire questo'));
    expect(status(stars({ 1: 0 }), 2)).toEqual(locked('Vinci il livello 1 per aprire questo'));
    expect(status(stars({ 1: 1 }), 2)).toEqual({ open: true });
    expect(status(stars({ 1: 1 }), 3)).toEqual(locked('Vinci il livello 2 per aprire questo'));
  });

  test('un\'isola chiusa dice quante stelle servono per aprirla, col suo nome', () => {
    expect(status(newProgress(), 4)).toEqual(locked('Servono 6 ★ per aprire Animali'));
    expect(status(newProgress(), 6)).toEqual(locked('Servono 6 ★ per aprire Animali'));
    expect(status(stars({ 1: 2, 2: 2, 3: 1 }), 4)).toEqual(locked('Servono 6 ★ per aprire Animali'));
  });

  test('con le stelle ma senza aver finito l\'isola precedente indica il livello da vincere', () => {
    expect(status(stars({ 1: 3, 2: 3 }), 4)).toEqual(locked('Vinci il livello 3 per aprire Animali'));
  });

  test('indica il primo livello ancora da vincere, non l\'ultimo', () => {
    const islands: IslandInfo[] = [
      { id: 'prologue', levelIds: [1, 2, 3, 4, 5, 6], gift: 0 },
      { id: 'animals', levelIds: [7, 8], gift: 3 },
    ];
    expect(status(stars({ 1: 3, 2: 3, 4: 3, 5: 3 }), 7, false, islands)).toEqual(locked('Vinci il livello 3 per aprire Animali'));
  });

  test('un livello vinto con una sola stella conta come vinto', () => {
    const islands: IslandInfo[] = [
      { id: 'prologue', levelIds: [1, 2, 3, 4, 5, 6], gift: 0 },
      { id: 'animals', levelIds: [7, 8], gift: 3 },
    ];
    expect(status(stars({ 1: 3, 2: 1, 3: 2, 4: 3, 5: 3 }), 7, false, islands)).toEqual(locked('Vinci il livello 6 per aprire Animali'));
  });

  test('finita l\'isola con le stelle richieste, la successiva si apre dal primo livello', () => {
    const done = stars({ 1: 3, 2: 2, 3: 1 });
    expect(status(done, 4)).toEqual({ open: true });
    expect(status(done, 5)).toEqual(locked('Vinci il livello 4 per aprire questo'));
  });

  test('ogni isola chiede le stelle di quella che la precede', () => {
    expect(status(stars({ 1: 3, 2: 3, 3: 3 }), 7)).toEqual(locked('Servono 6 ★ per aprire Dolci'));
    expect(status(stars({ 1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 2 }), 7)).toEqual({ open: true });
  });

  test('un livello fuori dalle isole e che non è uno dei Tris dell\'originale resta chiuso', () => {
    expect(status(stars({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 }), 999)).toEqual(locked('Si sbloccano più avanti'));
  });

  test('la sala dei Tris dell\'originale si apre finendo il primo Tris del percorso, e i suoi livelli in sequenza', () => {
    const first = legacyIslands[1].levelIds[0]; // il 21, in apertura della seconda isola
    expect(status(newProgress(), 91, false, legacyIslands)).toEqual(locked('Si sbloccano più avanti'));
    expect(status(stars({ [first]: 0 }), 91, false, legacyIslands)).toEqual(locked('Si sbloccano più avanti')); // giocato ma non vinto
    expect(status(stars({ [first]: 1 }), 91, false, legacyIslands)).toEqual({ open: true });
    expect(status(stars({ [first]: 1 }), 92, false, legacyIslands)).toEqual(locked('Vinci il livello 1 per aprire questo'));
    expect(status(stars({ [first]: 1, 91: 1 }), 92, false, legacyIslands)).toEqual({ open: true });
    expect(status(stars({ [first]: 1, 91: 1 }), 93, false, legacyIslands)).toEqual(locked('Vinci il livello 2 per aprire questo'));
    expect(status(stars({ [first]: 3, 91: 3, 92: 3, 93: 3, 94: 3, 95: 3, 96: 3, 97: 3, 98: 3, 99: 3 }), 100, false, legacyIslands)).toEqual({ open: true });
  });
});

describe('isTrisRoomOpen', () => {
  test('con la Modalità prova è sempre aperta', () => {
    expect(isTrisRoomOpen(newProgress(), ISLANDS, true)).toBe(true);
    expect(isTrisRoomOpen(newProgress(), [], true)).toBe(true);
  });

  test('si apre con una stella sul primo livello della seconda isola, qualunque sia il suo numero', () => {
    expect(isTrisRoomOpen(newProgress(), ISLANDS, false)).toBe(false);
    expect(isTrisRoomOpen(stars({ 4: 1 }), ISLANDS, false)).toBe(true); // il 4 apre la seconda isola di prova
    expect(isTrisRoomOpen(stars({ 1: 3, 2: 3, 3: 3, 5: 3, 6: 3 }), ISLANDS, false)).toBe(false); // altri livelli non contano
    expect(isTrisRoomOpen(stars({ 21: 3 }), ISLANDS, false)).toBe(false); // nemmeno il 21, se qui non è il primo Tris
  });

  test('senza una seconda isola non c\'è un primo Tris: chiusa', () => {
    expect(isTrisRoomOpen(stars({ 1: 3 }), [ISLANDS[0]], false)).toBe(false);
    expect(isTrisRoomOpen(stars({ 1: 3 }), [], false)).toBe(false);
  });
});

describe('levelStatus nella campagna', () => {
  test('con le isole della campagna: «Servono 40 ★ per aprire Animali»', () => {
    expect(status(newProgress(), 21, false, legacyIslands)).toEqual(locked('Servono 40 ★ per aprire Animali'));
    expect(status(newProgress(), 1, false, legacyIslands)).toEqual({ open: true });
    expect(status(newProgress(), 100, false, legacyIslands)).toEqual(locked('Si sbloccano più avanti'));
  });
});
