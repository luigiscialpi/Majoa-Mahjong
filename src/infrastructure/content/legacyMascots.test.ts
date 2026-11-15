import { DEFAULT_MASCOT, MASCOT_IDS, isMascot } from '../../domain/mascot';
import { MASCOT_SOURCES } from './mascotSources';

const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const { extract, indexSource } = jest.requireActual('../../../tools/export-mascots.js') as {
  extract(htmlPath: string): Record<string, { viewBox: string; svg: string }>;
  indexSource(ids: string[]): string;
};
const HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto
const html = fs.readFileSync(HTML, 'utf8');
const original = extract(HTML);
const ids = Object.keys(original);

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

  test('i file in `assets/mascots` sono quelli esportati dall\'originale', () => {
    for (const id of ids) expect(fs.readFileSync(`assets/mascots/${id}.svg`, 'utf8')).toBe(`${original[id].svg}\n`);
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
