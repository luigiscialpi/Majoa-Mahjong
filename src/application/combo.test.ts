import { COMBO_WINDOW_MS, NO_COMBO, nextCombo, type ComboState } from './combo';

const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto

/** Sequenza di abbinamenti a questi istanti (ms): lo stato dopo ciascuno. */
const run = (times: number[], start: ComboState = NO_COMBO): number[] => {
  const counts: number[] = [];
  let state = start;
  for (const t of times) {
    state = nextCombo(state, t);
    counts.push(state.count);
  }
  return counts;
};

describe('nextCombo', () => {
  test('la finestra è quella dell\'originale (`now-lastMatch<4500`, riga 2133)', () => {
    const m = /combo=\(now-lastMatch<(\d+)\)\?combo\+1:0/.exec(fs.readFileSync(ORIGINAL_HTML, 'utf8'));
    expect(m).not.toBeNull();
    expect(COMBO_WINDOW_MS).toBe(Number(m![1]));
  });

  test('il primo abbinamento vale 0, quelli ravvicinati salgono di uno', () => {
    expect(run([10_000, 11_000, 12_500, 14_000])).toEqual([0, 1, 2, 3]);
  });

  test('a 4499 ms la combo continua, a 4500 ms riparte da 0 (confronto stretto, come l\'originale)', () => {
    expect(run([0, 4499])).toEqual([0, 1]);
    expect(run([0, 4500])).toEqual([0, 0]);
  });

  test('la finestra si misura dall\'ultimo abbinamento, non dal primo', () => {
    expect(run([0, 4000, 8000, 12_000])).toEqual([0, 1, 2, 3]);
  });

  test('dopo una pausa riparte da 0 e poi cresce di nuovo', () => {
    expect(run([0, 1000, 2000, 10_000, 11_000])).toEqual([0, 1, 2, 0, 1]);
  });

  test('il conteggio non ha tetto (serve ai suoni, la scritta si ferma al livello 4)', () => {
    expect(run(Array.from({ length: 12 }, (_, i) => i * 1000)).at(-1)).toBe(11);
  });

  test('non modifica lo stato di partenza e ricorda l\'istante', () => {
    const next = nextCombo(NO_COMBO, 500);
    expect(NO_COMBO).toEqual({ count: 0, lastMs: null });
    expect(next).toEqual({ count: 0, lastMs: 500 });
  });
});
