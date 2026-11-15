import { DEFAULT_MASCOT, MASCOT_IDS, isMascot } from '../../domain/mascot';
import { MASCOT_SOURCES } from './mascotSources';

const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
type Extracted = Record<string, { viewBox: string; svg: string }>;
const { extract, indexSource } = jest.requireActual('../../../tools/export-mascots.js') as {
  extract(htmlPath: string, options?: { refined?: boolean }): Extracted;
  indexSource(ids: string[]): string;
};
const { REFINEMENTS, refine } = jest.requireActual('../../../tools/mascot-refinements.js') as {
  REFINEMENTS: Record<string, [string, string][]>;
  refine(id: string, art: string): string;
};
const HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto
const html = fs.readFileSync(HTML, 'utf8');
/** I disegni dell'originale, tali e quali, e quelli con i ritocchi (`tools/mascot-refinements.js`). */
const original = extract(HTML, { refined: false });
const refined = extract(HTML);
const ids = Object.keys(original);
const file = (id: string) => fs.readFileSync(`assets/mascots/${id}.svg`, 'utf8');

describe('mascotte dell\'originale', () => {
  test('sono quattro, nello stesso ordine di `MASCOTS` e del dominio', () => {
    expect(ids).toEqual([...MASCOT_IDS]);
    expect(Object.keys(MASCOT_SOURCES)).toEqual([...MASCOT_IDS]);
  });

  test('la mascotte iniziale e i valori ammessi sono quelli dell\'originale (`SDEF`, riga 1362, e la sua verifica, riga 1383)', () => {
    expect(/var SDEF=\{[^}]*mascot:'(\w+)'/.exec(html)![1]).toBe(DEFAULT_MASCOT);
    const allowed = [...(/\[((?:'\w+',?)+)\]\.indexOf\(S\.mascot\)<0/.exec(html)![1].matchAll(/'(\w+)'/g))].map((m) => m[1]);
    expect(allowed).toEqual([...MASCOT_IDS, 'none']);
    for (const value of allowed) expect(isMascot(value)).toBe(true);
  });

  test('tutte hanno il viewBox 100×112 e un disegno non vuoto', () => {
    for (const id of ids) {
      expect(original[id].viewBox).toBe('0 0 100 112');
      expect(original[id].svg.length).toBeGreaterThan(1500);
    }
  });

  test('i file in `assets/mascots` sono quelli esportati dall\'originale, con i ritocchi', () => {
    for (const id of ids) expect(file(id)).toBe(`${refined[id].svg}\n`);
  });

  test('l\'elenco `mascotSources.ts` è quello generato dallo strumento', () => {
    expect(fs.readFileSync('src/infrastructure/content/mascotSources.ts', 'utf8')).toBe(indexSource(ids));
  });
});

describe('vincoli del motore SVG di Skia (docs/rendering.md)', () => {
  // Si prende ciò che il motore gestisce: figure di base senza testo, filtri, maschere né riferimenti. Il testo no (`<text>` non si
  // disegna) e niente `width` e `height` sull'elemento radice (con attributi fissi SkSVG ignora la dimensione richiesta).
  const ELEMENTS = ['svg', 'g', 'path', 'ellipse'];
  const ATTRIBUTES = ['xmlns', 'viewBox', 'd', 'cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap', 'transform'];

  test.each(ids)('%s: solo figure semplici, solo attributi gestiti, XML ben formato', (id) => {
    const svg = fs.readFileSync(`assets/mascots/${id}.svg`, 'utf8');
    const tags = [...svg.matchAll(/<(\/?)([\w:-]+)([^>]*?)(\/?)>/g)];
    expect([...new Set(tags.map((t) => t[2]))].every((name) => ELEMENTS.includes(name))).toBe(true);
    const attributes = new Set([...svg.matchAll(/\s([\w:-]+)="/g)].map((m) => m[1]));
    expect([...attributes].filter((a) => !ATTRIBUTES.includes(a))).toEqual([]);
    // Tag bilanciati: ogni apertura ha la sua chiusura o è autochiusa; il testo fuori dai tag non c'è.
    const stack: string[] = [];
    for (const [, closing, name, , selfClosing] of tags) {
      if (selfClosing) continue;
      if (closing) expect(stack.pop()).toBe(name);
      else stack.push(name);
    }
    expect(stack).toEqual([]);
    expect(svg.replace(/<[^>]*>/g, '').trim()).toBe('');
    expect(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 112">/.test(svg)).toBe(true);
    expect(/<(?:text|style|use|image|filter|mask|clipPath|defs)/.test(svg) || /(?:class|href|style)=|url\(/.test(svg)).toBe(false);
  });
});

describe('ritocchi alle mascotte (docs/gioco-originale.md)', () => {
  const retouched = Object.keys(REFINEMENTS);

  test('riguardano collie, sheltie e siamese a pelo lungo: il siamese a pelo corto è quello dell\'originale', () => {
    expect(retouched).toEqual(['collie', 'sheltie', 'siamlong']);
    expect(file('siamshort')).toBe(`${original.siamshort.svg}\n`);
    for (const id of retouched) expect(refined[id].svg).not.toBe(original[id].svg);
  });

  test.each(retouched)('%s: ogni frammento sostituito è uno solo nell\'originale e ogni ritocco è uno solo nel file', (id) => {
    for (const [from, to] of REFINEMENTS[id]) {
      expect(original[id].svg.split(from).length - 1).toBe(1);
      expect(file(id).split(to).length - 1).toBe(1);
    }
  });

  test.each(retouched)('%s: rimettendo i frammenti originali si riottiene l\'originale identico, quindi i ritocchi non toccano altro', (id) => {
    let back = refined[id].svg;
    for (const [from, to] of REFINEMENTS[id]) back = back.replace(to, () => from);
    expect(back).toBe(original[id].svg);
  });

  test('se l\'originale cambia e un frammento non c\'è più, o c\'è due volte, lo strumento si ferma', () => {
    const art = original.collie.svg;
    expect(() => refine('collie', '<path d="altro"/>')).toThrow(/compare 0 volte/);
    expect(() => refine('collie', art + art)).toThrow(/compare 2 volte/);
    expect(refine('siamshort', art)).toBe(art); // senza ritocchi dichiarati un disegno non cambia
  });

  // Gli effetti dichiarati, misurati sul disegno e non solo sul testo.
  const numbers = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  const maxY = (d: string) => Math.max(...numbers(d).filter((_, i) => i % 2 === 1));

  test('collie e sheltie: la mandibola è corta e non scende più fin quasi al bordo (da 112 a meno di 100)', () => {
    for (const id of ['collie', 'sheltie']) {
      const [from, to] = REFINEMENTS[id][0];
      const jaw = (fragment: string) => /d="([^"]*)"/.exec(fragment)![1];
      expect(maxY(jaw(from))).toBe(112);
      expect(maxY(jaw(to))).toBeLessThan(100);
    }
  });

  test('sheltie: le guance focate stanno dentro il viso (a sinistra e a destra del muso, non oltre i lati della testa a 24 e 76)', () => {
    const [from, to] = REFINEMENTS.sheltie[1];
    const extents = (fragment: string) => [...fragment.matchAll(/cx="([\d.]+)" cy="[\d.]+" rx="([\d.]+)"/g)].map((m) => [Number(m[1]) - Number(m[2]), Number(m[1]) + Number(m[2])]);
    for (const [left, right] of extents(from)) expect(left < 24 || right > 76).toBe(true); // nell'originale sporgono fuori dalla testa
    for (const [left, right] of extents(to)) {
      expect(left).toBeGreaterThanOrEqual(30);
      expect(right).toBeLessThanOrEqual(70);
    }
  });

  test('siamese a pelo lungo: i ciuffi delle guance sono curve morbide, non zig-zag di segmenti', () => {
    for (const [from, to] of REFINEMENTS.siamlong) {
      const d = (fragment: string) => /d="([^"]*)"/.exec(fragment)![1];
      expect(d(from).match(/L/g)!.length).toBeGreaterThanOrEqual(7);
      expect(d(to).match(/Q/g)!.length).toBeGreaterThanOrEqual(4);
      expect(d(to).match(/L/g)!.length).toBeLessThanOrEqual(1);
    }
  });
});
