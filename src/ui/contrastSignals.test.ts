import { HATCH, MATCH_BADGE, blockerSignal, hatchPathD, hintSignal, matchSignal, selectedSignal, type Ring } from './contrastSignals';

// Spessori, distanze e colori si leggono dal CSS dell'originale (righe 211-234), non si scrivono a occhio.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const html = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
const esc = (s: string) => s.replace(/[.#*+?^${}()|[\]\\]/g, '\\$&');
/** Il corpo di una regola CSS, dal suo selettore esatto. */
function rule(selector: string): string {
  const m = new RegExp(`(?:^|\\n|\\})\\s*${esc(selector)}\\s*\\{([^}]*)\\}`).exec(html);
  expect(m).not.toBeNull();
  return m![1];
}

const rect = { x: 10, y: 20, w: 50, h: 70 };
const radius = 7;
/** Distanza dell'interno e dell'esterno di un anello dal bordo della tessera (negativa = dentro). */
function edges(g: Ring) {
  const inner = rect.x - g.x - g.width / 2;
  return { inner, outer: inner + g.width };
}
const expectAround = (g: Ring, e: number) => {
  expect(g.w).toBeCloseTo(rect.w + 2 * e, 9);
  expect(g.h).toBeCloseTo(rect.h + 2 * e, 9);
  expect(g.y).toBeCloseTo(rect.y - e, 9);
  expect(g.r).toBeCloseTo(radius + e, 9);
};

describe('selectedSignal', () => {
  test('contorno pieno bianco, 5 px a 2 px dal bordo', () => {
    const css = rule('.cb .tile.sel,.hc .tile.sel');
    const [width, offset] = [Number(/outline:(\d+)px solid #fff/.exec(css)![1]), Number(/outline-offset:(\d+)px/.exec(css)![1])];
    const [g, ...rest] = selectedSignal(rect, radius);
    expect(rest).toHaveLength(0);
    expect(g).toMatchObject({ width, color: '#fff' });
    expect(g.dash).toBeUndefined();
    expect(edges(g)).toEqual({ inner: offset, outer: offset + width });
    expectAround(g, offset + width / 2);
  });
});

describe('hintSignal', () => {
  test('contorno tratteggiato bianco, 4 px a 3 px dal bordo', () => {
    const css = rule('.cb .tile.hint,.hc .tile.hint');
    const [width, offset] = [Number(/outline:(\d+)px dashed #fff/.exec(css)![1]), Number(/outline-offset:(\d+)px/.exec(css)![1])];
    const [g, ...rest] = hintSignal(rect, radius);
    expect(rest).toHaveLength(0);
    expect(g).toMatchObject({ width, color: '#fff' });
    expect(g.dash).toBeDefined();
    expect(g.dash![0]).toBeGreaterThan(g.dash![1]); // tratti più lunghi degli spazi
    expect(edges(g)).toEqual({ inner: offset, outer: offset + width });
  });
});

describe('blockerSignal', () => {
  test('due linee bianche sottili («double» di 5 px) a 2 px dal bordo, ciascuna un terzo dello spessore', () => {
    const offset = Number(/outline-offset:(\d+)px/.exec(rule('.tile.blocker'))![1]);
    const width = Number(/outline:(\d+)px double #fff/.exec(rule('.cb .tile.blocker,.hc .tile.blocker'))![1]);
    const rings = blockerSignal(rect, radius);
    expect(rings).toHaveLength(2);
    for (const g of rings) {
      expect(g.color).toBe('#fff');
      expect(g.width).toBeCloseTo(width / 3, 9);
    }
    expect(edges(rings[0]).inner).toBeCloseTo(offset, 9); // la linea interna parte dal bordo + scarto
    expect(edges(rings[1]).outer).toBeCloseTo(offset + width, 9); // quella esterna finisce a spessore pieno
    expect(edges(rings[1]).inner - edges(rings[0]).outer).toBeCloseTo(width / 3, 9); // un terzo di vuoto in mezzo
  });
});

describe('matchSignal', () => {
  const css = rule('.cb .tile.match,.hc .tile.match');
  test('anello interno nero di 4 px, poi bianco di 4 e nero di altri 4 px fuori dal bordo', () => {
    expect(css).toMatch(/box-shadow:inset 0 0 0 4px #000,0 0 0 4px #fff,0 0 0 8px #000/);
    const [inner, white, outer, ...rest] = matchSignal(rect, radius);
    expect(rest).toHaveLength(0);
    expect([inner, white, outer].map((g) => g.color)).toEqual(['#000', '#fff', '#000']);
    expect(edges(inner)).toEqual({ inner: -4, outer: 0 });
    expect(edges(white)).toEqual({ inner: 0, outer: 4 });
    expect(edges(outer)).toEqual({ inner: 4, outer: 8 });
    expectAround(inner, -2);
    expectAround(white, 2);
    expectAround(outer, 6);
  });

  test('il segno ✔ è in un quadrato nero dagli angoli smussati con un anello bianco di 3 px', () => {
    const badge = rule('.cb .tile.match::before,.hc .tile.match::before');
    const size = Number(/width:(\d+)px/.exec(rule('.tile.match::before'))![1]);
    expect(badge).toMatch(/background:#000/);
    expect(badge).toMatch(/box-shadow:0 0 0 3px #fff/);
    expect(MATCH_BADGE).toMatchObject({ fill: '#000', ring: '#fff', ringWidth: 3 });
    expect(MATCH_BADGE.cornerRatio * size).toBe(Number(/border-radius:(\d+)px/.exec(badge)![1]));
  });
});

describe('hatchPathD', () => {
  test('le misure sono quelle del tratteggio dell\'originale: 45°, nero al 40%, 5 px di striscia su 11', () => {
    expect(rule('.cb .tile.blocked::after,.hc .tile.blocked::after')).toContain('repeating-linear-gradient(45deg,rgba(0,0,0,.4) 0 5px,transparent 5px 11px)');
    expect(HATCH).toEqual({ color: 'rgba(0,0,0,0.4)', width: 5, period: 11 });
  });

  /** Le linee del tratteggio: `c` è la costante di `x - y = c` che le descrive. */
  const lines = (w: number, h: number) =>
    [...hatchPathD(w, h).matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((m) => {
      const [x1, y1, x2, y2] = m.slice(1).map(Number);
      return { x1, y1, x2, y2, c: x1 - y1 };
    });

  test('strisce dall\'alto a sinistra al basso a destra (45°), a 11 px l\'una dall\'altra', () => {
    const ls = lines(50, 70);
    expect(ls.length).toBeGreaterThan(5);
    for (const l of ls) expect(l.x2 - l.x1).toBeCloseTo(l.y2 - l.y1, 9); // pendenza 1
    for (let i = 1; i < ls.length; i++) expect((ls[i].c - ls[i - 1].c) / Math.SQRT2).toBeCloseTo(HATCH.period, 1); // le coordinate sono a 2 decimali
  });

  test('la prima striscia sta a metà del suo spessore dall\'angolo in basso a sinistra, da cui parte il gradiente', () => {
    const [first] = lines(50, 70);
    // distanza della retta x - y = c dall'angolo (0, h): |0 - h - c| / √2
    expect(Math.abs(0 - 70 - first.c) / Math.SQRT2).toBeCloseTo(HATCH.width / 2, 1);
  });

  test('coprono tutta la tessera: nessuna striscia che la tocchi manca, né prima né dopo', () => {
    const ls = lines(50, 70);
    const step = HATCH.period * Math.SQRT2;
    const half = (HATCH.width / 2) * Math.SQRT2; // metà dello spessore di una striscia, misurata lungo x
    // la striscia che verrebbe prima della prima e quella dopo l'ultima stanno fuori dalla tessera (da c = -h a c = w)
    expect(ls[0].c - step + half).toBeLessThan(-70);
    expect(ls[ls.length - 1].c + step - half).toBeGreaterThan(50);
  });
});
