import type { Feedback } from '../application/session';
import type { GameState } from '../domain/gameState';
import { designOf } from '../infrastructure/content/legacyThemes';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { BAR_MATCH_MS, BAR_RECENT, BAR_REJECT_MS, barName, selectionView, transientView } from './selectionBarView';

// Durate e numeri si leggono dall'HTML dell'originale (`tap`, righe 2122-2151; `sbShow`, riga 1968), non si scrivono a occhio.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const src = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
const must = (m: RegExpExecArray | null): RegExpExecArray => {
  expect(m).not.toBeNull();
  return m!;
};
const delayAfter = (call: string) => Number(must(new RegExp(`${call}\\s*sbLater\\(function\\(\\)\\{sbShow\\((?:sel|null),null,''\\);\\},(\\d+)\\)`).exec(src))[1]);

const island = legacyLevels[0].island;
const t0 = 0; // due tipi diversi e il loro disegno nell'isola del livello 1
const t1 = 1;
const d0 = designOf(island, t0);
const d1 = designOf(island, t1);
/** Una tavola minima: solo i campi che la barra legge (`tiles[i].type` e `tiles[i].fog`). */
const game = { tiles: [{ type: t0, fog: false }, { type: t0, fog: false }, { type: t1, fog: false }, { type: t1, fog: true }] } as unknown as GameState;

describe('costanti dell\'originale', () => {
  test('rifiuti e tessere diverse restano 900 ms, un abbinamento 1100 ms', () => {
    expect(delayAfter("sbShow\\(t,null,'🔒'\\);")).toBe(BAR_REJECT_MS);
    expect(delayAfter("sbShow\\(t,null,'⛔'\\);")).toBe(BAR_REJECT_MS);
    expect(delayAfter("sbShow\\(prev,t,'✖'\\);")).toBe(BAR_REJECT_MS);
    expect(delayAfter("sbShow\\(a,b,'✔',c3\\);")).toBe(BAR_MATCH_MS);
    expect([BAR_REJECT_MS, BAR_MATCH_MS]).toEqual([900, 1100]);
  });

  test('si mostrano gli ultimi 4 abbinamenti', () => {
    expect(Number(must(/sbRecent\.slice\(-(\d+)\)/.exec(src))[1])).toBe(BAR_RECENT);
  });
});

describe('selectionView', () => {
  test('mostra il disegno di ogni tessera selezionata, senza segno', () => {
    expect(selectionView(game, island, [])).toEqual({ slots: [], status: null });
    expect(selectionView(game, island, [0])).toEqual({ slots: [d0], status: null });
    expect(selectionView(game, island, [2, 0])).toEqual({ slots: [d1, d0], status: null });
  });
});

describe('transientView', () => {
  const rejected = (reason: 'locked' | 'tile-blocked'): Feedback => ({ kind: 'rejected', reason }) as Feedback;

  test('abbinamento: tutto il gruppo con ✔ per 1100 ms', () => {
    const feedback: Feedback = { kind: 'matched', group: [0, 1], unlocked: false, gold: 0 };
    expect(transientView(feedback, game, island, null, [])).toEqual({ view: { slots: [d0, d0], status: 'ok' }, ms: BAR_MATCH_MS });
  });

  test('tessera nascosta toccata: casella nascosta e segno «locked» per 900 ms', () => {
    expect(transientView(rejected('locked'), game, island, 2, [])).toEqual({ view: { slots: ['locked'], status: 'locked' }, ms: BAR_REJECT_MS });
  });

  test('tessera bloccata toccata: il suo disegno, o la nebbia se è velata, con il segno «blocked»', () => {
    expect(transientView(rejected('tile-blocked'), game, island, 2, [])).toEqual({ view: { slots: [d1], status: 'blocked' }, ms: BAR_REJECT_MS });
    expect(transientView(rejected('tile-blocked'), game, island, 3, [])).toEqual({ view: { slots: ['fog'], status: 'blocked' }, ms: BAR_REJECT_MS });
  });

  test('tessere diverse: la selezione di prima e quella nuova con ✖', () => {
    expect(transientView({ kind: 'mismatch' }, game, island, 2, [0])).toEqual({ view: { slots: [d0, d1], status: 'bad' }, ms: BAR_REJECT_MS });
    expect(transientView({ kind: 'mismatch' }, game, island, 2, [])).toBeNull(); // senza selezione precedente non c'è nulla da confrontare
  });

  test('rifiuto o tessere diverse senza una tessera toccata, e le altre azioni, non hanno nulla di passeggero', () => {
    expect(transientView(rejected('locked'), game, island, null, [])).toBeNull();
    expect(transientView({ kind: 'mismatch' }, game, island, null, [0])).toBeNull();
    for (const feedback of [null, { kind: 'selected' }, { kind: 'deselected' }, { kind: 'undone' }, { kind: 'shuffled' }, { kind: 'hint', group: [0, 1] }] as (Feedback | null)[]) {
      expect(transientView(feedback, game, island, 0, [])).toBeNull();
    }
  });

  test('un rifiuto che non è di nascosta o bloccata (altro errore di mossa) non cambia la barra', () => {
    expect(transientView({ kind: 'rejected', reason: 'not-a-pair' } as unknown as Feedback, game, island, 0, [])).toBeNull();
  });
});

describe('barName', () => {
  const tn = ['Gatto', 'Cane'];
  test('il nome della prima tessera; con una seconda diversa «primo ≠ secondo», con una uguale uno solo', () => {
    expect(barName([], tn, 'Nascosta', 'Velata')).toBe('');
    expect(barName([0], tn, 'Nascosta', 'Velata')).toBe('Gatto');
    expect(barName([0, 1], tn, 'Nascosta', 'Velata')).toBe('Gatto ≠ Cane');
    expect(barName([1, 1, 1], tn, 'Nascosta', 'Velata')).toBe('Cane');
  });
  test('le tessere nascoste e nebbiose hanno il loro nome; un indice senza nome dà una stringa vuota', () => {
    expect(barName(['locked'], tn, 'Nascosta', 'Velata')).toBe('Nascosta');
    expect(barName(['fog'], tn, 'Nascosta', 'Velata')).toBe('Velata');
    expect(barName([0, 'fog'], tn, 'Nascosta', 'Velata')).toBe('Gatto ≠ Velata');
    expect(barName([7], tn, 'Nascosta', 'Velata')).toBe('');
  });
  test('il terzo nome (Tris) non entra nel testo, come nell\'originale', () => {
    expect(barName([0, 0, 1], tn, 'Nascosta', 'Velata')).toBe('Gatto');
  });
});
