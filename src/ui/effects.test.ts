import {
  COMBO_BANNER_MS,
  COMBO_MAX_LEVEL,
  GOLD_BURST,
  PLAIN_BURST,
  SPARK_LIFT,
  SPARK_MAX_MS,
  SPARK_MIN_MS,
  SPARK_SIZE,
  SPARK_SPREAD_MS,
  bannerFrame,
  comboBurst,
  comboLevel,
  drawSparks,
  easeOut,
  heartPathD,
  makeParticles,
  sparkFrame,
  sparklePathsD,
  tileBurst,
  type Burst,
  type SparkKind,
} from './effects';

// Le costanti si leggono dall'HTML dell'originale (`sparkBurst` riga 2082, `burstAt` 2093, `showCombo` 2101), non si scrivono a occhio.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto
const src = fs.readFileSync(ORIGINAL_HTML, 'utf8');

const KIND: Record<string, SparkKind> = { '✨': 'sparkle', '⭐': 'star', '💛': 'heart' };
const kindsOf = (list: string): SparkKind[] => [...list.matchAll(/'([^']+)'/g)].map((m) => KIND[m[1]]);
const must = (m: RegExpExecArray | null): RegExpExecArray => {
  expect(m).not.toBeNull();
  return m!;
};
const constant = (v: number) => () => v;
const distance = (p: { dx: number; dy: number }) => Math.hypot(p.dx, p.dy + SPARK_LIFT);

describe('costanti dell\'originale', () => {
  test('scintille di una tessera: comune `[✨ ⭐] 4 46`, d\'oro `[✨ ⭐ 💛] 12 80`', () => {
    const plain = must(/else sparkBurst\([^[]*\[([^\]]*)\],(\d+),(\d+)\)/.exec(src));
    const gold = must(/if\(gold\)sparkBurst\([^[]*\[([^\]]*)\],(\d+),(\d+)\)/.exec(src));
    expect(PLAIN_BURST).toEqual({ kinds: kindsOf(plain[1]), count: Number(plain[2]), dist: Number(plain[3]) });
    expect(GOLD_BURST).toEqual({ kinds: kindsOf(gold[1]), count: Number(gold[2]), dist: Number(gold[3]) });
  });

  test('scintille della combo: forme, `5 + 2c` scintille a `70 + 12c` px', () => {
    const m = must(/sparkBurst\(window\.innerWidth[^[]*\[([^\]]*)\],(\d+)\+c\*(\d+),(\d+)\+c\*(\d+)\)/.exec(src));
    const [base, perLevel, dist0, distPerLevel] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
    for (const level of [1, 2, 3, 4] as const) {
      const burst = comboBurst(1, 0, 0, level, constant(0.9999));
      expect(burst.particles).toHaveLength(base + perLevel * level);
      expect(burst.particles.map((p) => p.kind).slice(0, 2)).toEqual(kindsOf(m[1]));
      expect(Math.max(...burst.particles.map(distance))).toBeLessThan(1.2 * (dist0 + distPerLevel * level));
      expect(Math.max(...burst.particles.map(distance))).toBeGreaterThan(1.19 * (dist0 + distPerLevel * level));
    }
  });

  test('distanza da 0,5 a 1,2 volte quella data, sollevamento di 18 px', () => {
    const m = must(/d=\(([\d.]+)\+Math\.random\(\)\*([\d.]+)\)\*dist/.exec(src));
    const lift = must(/Math\.sin\(a\)\*d-(\d+)\)\+'px\) scale\(/.exec(src));
    expect(SPARK_LIFT).toBe(Number(lift[1]));
    const [near] = makeParticles(['star'], 1, 100, constant(0));
    expect(distance(near)).toBeCloseTo(Number(m[1]) * 100);
    expect(near.dy).toBeCloseTo(-Number(lift[1])); // angolo 0: nessuno spostamento verticale oltre al sollevamento
    const [far] = makeParticles(['star'], 1, 100, constant(0.999999));
    expect(distance(far)).toBeCloseTo((Number(m[1]) + Number(m[2])) * 100, 1);
  });

  test('durata di una scintilla da 600 ms a 950 ms con `ease-out`', () => {
    const m = must(/duration:(\d+)\+Math\.random\(\)\*(\d+),easing:'ease-out'/.exec(src));
    expect(SPARK_MIN_MS).toBe(Number(m[1]));
    expect(SPARK_SPREAD_MS).toBe(Number(m[2]));
    expect(SPARK_MAX_MS).toBe(Number(m[1]) + Number(m[2]));
    expect(makeParticles(['star'], 1, 10, constant(0))[0].ms).toBe(Number(m[1]));
  });

  test('scala da 0,6 a 1,15 e opacità da 1 a 0', () => {
    const start = must(/translate\(0,0\) scale\(([\d.]+)\)',opacity:(\d)/.exec(src));
    const end = must(/Math\.sin\(a\)\*d-\d+\)\+'px\) scale\(([\d.]+)\)',opacity:(\d)/.exec(src));
    const p = { dx: 30, dy: -40, ms: 700 };
    const first = sparkFrame(p, 0);
    expect([first.x + 0, first.y + 0, first.scale, first.opacity]).toEqual([0, 0, Number(start[1]), Number(start[2])]); // `+ 0` evita -0
    expect(sparkFrame(p, p.ms)).toEqual({ x: 30, y: -40, scale: Number(end[1]), opacity: Number(end[2]) });
  });

  test('lato di 18 px', () => {
    expect(SPARK_SIZE).toBe(Number(must(/#fxLayer \.sp\{[^}]*font-size:(\d+)px/.exec(src))[1]));
  });

  test('scritta: livello massimo 4, durata 1300 ms con `ease-out`', () => {
    expect(COMBO_MAX_LEVEL).toBe(Number(must(/tx\('cmb'\+Math\.min\(c,(\d+)\)\)/.exec(src))[1]));
    expect(COMBO_BANNER_MS).toBe(Number(must(/duration:(\d+),easing:'ease-out'\}\);\s*sparkBurst\(window/.exec(src))[1]));
  });

  test('scritta: i quattro fotogrammi chiave dell\'originale, con le loro posizioni nel tempo', () => {
    const block = must(/e\.animate\(\[(\{opacity:0.*?)\],\{duration:\d+/s.exec(src))[1];
    const frames = [...block.matchAll(/\{opacity:(\d),transform:'[^']*translateY\((-?\d+)(?:px)?\) scale\(([\d.]+)\)'(?:,offset:([\d.]+))?\}/g)];
    expect(frames).toHaveLength(4);
    const offsets = [0, ...frames.slice(1, -1).map((f) => Number(f[4])), 1];
    for (const [i, f] of frames.entries()) {
      // `ease-out` regola l'intera durata: si cerca l'istante in cui la curva vale la posizione del fotogramma.
      let lo = 0;
      let hi = 1;
      for (let n = 0; n < 40; n++) {
        const mid = (lo + hi) / 2;
        if (easeOut(mid) < offsets[i]) lo = mid;
        else hi = mid;
      }
      const got = bannerFrame(lo * COMBO_BANNER_MS);
      expect(got.opacity).toBeCloseTo(Number(f[1]), 2);
      expect(got.translateY).toBeCloseTo(Number(f[2]), 1);
      expect(got.scale).toBeCloseTo(Number(f[3]), 2);
    }
  });
});

describe('scritta: tra un fotogramma e l\'altro', () => {
  const block = must(/e\.animate\(\[(\{opacity:0.*?)\],\{duration:\d+/s.exec(src))[1];
  const raw = [...block.matchAll(/\{opacity:(\d),transform:'[^']*translateY\((-?\d+)(?:px)?\) scale\(([\d.]+)\)'(?:,offset:([\d.]+))?\}/g)];
  const keyframes = raw.map((f, i) => ({ offset: i === 0 ? 0 : i === raw.length - 1 ? 1 : Number(f[4]), opacity: Number(f[1]), translateY: Number(f[2]), scale: Number(f[3]) }));

  test('l\'interpolazione è lineare sul tempo già reso con ease-out', () => {
    for (const u of [0.05, 0.1, 0.15, 0.19, 0.21, 0.3, 0.5, 0.7, 0.74, 0.76, 0.8, 0.9, 0.95]) {
      let lo = 0;
      let hi = 1;
      for (let n = 0; n < 40; n++) {
        const mid = (lo + hi) / 2;
        if (easeOut(mid) < u) lo = mid;
        else hi = mid;
      }
      const j = keyframes.findIndex((k) => k.offset > u);
      const [a, b] = [keyframes[j - 1], keyframes[j]];
      const k = (u - a.offset) / (b.offset - a.offset);
      const got = bannerFrame(lo * COMBO_BANNER_MS);
      expect(got.opacity).toBeCloseTo(a.opacity + (b.opacity - a.opacity) * k, 2);
      expect(got.translateY).toBeCloseTo(a.translateY + (b.translateY - a.translateY) * k, 1);
      expect(got.scale).toBeCloseTo(a.scale + (b.scale - a.scale) * k, 2);
    }
  });
});

describe('easeOut', () => {
  // Riferimento indipendente: la curva cubic-bezier(0, 0, .58, 1) campionata con la definizione parametrica.
  const reference = (x: number): number => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 4000; i++) {
      const t = i / 4000;
      const mt = 1 - t;
      pts.push([3 * mt * t * t * 0.58 + t * t * t, 3 * mt * t * t * 1 + t * t * t]);
    }
    const j = pts.findIndex(([px]) => px >= x);
    if (j <= 0) return pts[0][1];
    const [x0, y0] = pts[j - 1];
    const [x1, y1] = pts[j];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };

  test('coincide con la curva di CSS su tutto l\'intervallo', () => {
    for (let x = 0.02; x < 1; x += 0.02) expect(easeOut(x)).toBeCloseTo(reference(x), 2);
  });

  test('0 e 1 agli estremi, fuori intervallo non esce, sempre crescente', () => {
    expect([easeOut(-1), easeOut(0), easeOut(1), easeOut(2)]).toEqual([0, 0, 1, 1]);
    let prev = 0;
    for (let x = 0.01; x <= 1; x += 0.01) {
      const y = easeOut(x);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('scintille', () => {
  test('le forme si alternano nell\'ordine dato e il numero è quello richiesto', () => {
    const out = makeParticles(['sparkle', 'star', 'heart'], 7, 50, Math.random);
    expect(out.map((p) => p.kind)).toEqual(['sparkle', 'star', 'heart', 'sparkle', 'star', 'heart', 'sparkle']);
  });

  test('la tessera d\'oro ha più scintille, con i cuori; quella comune no', () => {
    const rand = constant(0.3);
    expect(tileBurst(1, 5, 6, false, rand).particles).toHaveLength(PLAIN_BURST.count);
    expect(tileBurst(1, 5, 6, true, rand).particles).toHaveLength(GOLD_BURST.count);
    expect(tileBurst(1, 5, 6, false, rand).particles.some((p) => p.kind === 'heart')).toBe(false);
    expect(tileBurst(1, 5, 6, true, rand).particles.some((p) => p.kind === 'heart')).toBe(true);
    expect(tileBurst(9, 5, 6, true, rand)).toMatchObject({ id: 9, x: 5, y: 6 });
  });

  test('la scintilla si sposta e svanisce con ease-out; dopo la durata resta ferma', () => {
    const p = { dx: 60, dy: -80, ms: 800 };
    const mid = sparkFrame(p, 400);
    expect(mid.x).toBeCloseTo(60 * easeOut(0.5));
    expect(mid.opacity).toBeCloseTo(1 - easeOut(0.5));
    expect(sparkFrame(p, 5000)).toEqual(sparkFrame(p, 800));
  });
});

describe('livello della combo', () => {
  test('nessuna scritta sotto 1, poi 1-4 e oltre il 4 resta 4', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(comboLevel)).toEqual([null, 1, 2, 3, 4, 4, 4]);
  });
});

describe('heartPathD', () => {
  test('percorso chiuso che resta nel riquadro previsto', () => {
    const d = heartPathD(50, 40, 10);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = d.match(/-?\d+\.\d/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([38, 62]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([30, 50]);
  });
});

describe('sparklePathsD', () => {
  // Formula con cui la tessera d'oro disegnava la scintilla prima di condividerla con le scintille degli abbinamenti.
  const before = (x: number, y: number, size: number): [string, string] => {
    const r = size / 2;
    const ri = r * 0.38;
    const star4 = (rot: number) => {
      let d = '';
      for (let i = 0; i < 8; i++) {
        const a = rot + (i * Math.PI) / 4;
        const rr = i % 2 === 0 ? r : ri;
        d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1);
      }
      return d + 'Z';
    };
    return [star4(0), star4(Math.PI / 4)];
  };

  test('coincide con il disegno che la tessera d\'oro aveva prima', () => {
    for (const [x, y, size] of [[7, 7, 14], [0, 0, 18], [100.5, 33.3, 20]]) expect(sparklePathsD(x, y, size)).toEqual(before(x, y, size));
  });

  test('due stelle a 4 punte: 8 vertici a distanza R e 0,38·R dal centro, la seconda ruotata di 45°', () => {
    const [a, b] = sparklePathsD(50, 40, 20);
    for (const [d, firstAngle] of [[a, 0], [b, 45]] as const) {
      const pts = [...d.matchAll(/(-?\d+\.\d) (-?\d+\.\d)/g)].map((m) => [Number(m[1]) - 50, Number(m[2]) - 40]);
      expect(pts).toHaveLength(8);
      pts.forEach(([x, y], i) => expect(Math.hypot(x, y)).toBeCloseTo(i % 2 === 0 ? 10 : 3.8, 0));
      expect((Math.atan2(pts[0][1], pts[0][0]) * 180) / Math.PI).toBeCloseTo(firstAngle, 0);
    }
  });
});

describe('drawSparks', () => {
  type Paint = { name: string; alpha: number; setAlphaf(a: number): void };
  const paint = (name: string): Paint => ({ name, alpha: 1, setAlphaf(a) { this.alpha = a; } });
  /** Forme finte: ogni forma ha due strati con paint propri (come nella realtà), i path sono nomi. */
  const glyphs = Object.fromEntries((['sparkle', 'star', 'heart'] as const).map((k) => [k, [{ path: `${k}-0`, paint: paint(`${k}-0`) }, { path: `${k}-1`, paint: paint(`${k}-1`) }]])) as Record<SparkKind, { path: string; paint: Paint }[]>;
  const draw = (burst: Burst, elapsed: number) => {
    const calls: unknown[][] = [];
    drawSparks<string, Paint>(
      {
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        translate: (x, y) => calls.push(['translate', x, y]),
        scale: (x, y) => calls.push(['scale', x, y]),
        drawPath: (path, p) => calls.push(['drawPath', path, p.alpha]),
      },
      glyphs,
      burst,
      elapsed,
    );
    return calls;
  };
  const burst = (particles: Burst['particles']): Burst => ({ id: 1, x: 100, y: 200, particles });
  const star = { kind: 'star' as const, dx: 40, dy: -60, ms: 800 };
  const heart = { kind: 'heart' as const, dx: -20, dy: -30, ms: 600 };

  test('all\'inizio ogni scintilla è nel centro, in scala 0,6 e piena opacità, strato per strato, nell\'ordine dato', () => {
    expect(draw(burst([star, heart]), 0)).toEqual([
      ['save'], ['translate', 100, 200], ['scale', 0.6, 0.6], ['drawPath', 'star-0', 1], ['drawPath', 'star-1', 1], ['restore'],
      ['save'], ['translate', 100, 200], ['scale', 0.6, 0.6], ['drawPath', 'heart-0', 1], ['drawPath', 'heart-1', 1], ['restore'],
    ]);
  });

  test('a metà strada posizione, scala e opacità sono quelle di sparkFrame', () => {
    const f = sparkFrame(star, 400);
    expect(draw(burst([star]), 400)).toEqual([
      ['save'], ['translate', 100 + f.x, 200 + f.y], ['scale', f.scale, f.scale], ['drawPath', 'star-0', f.opacity], ['drawPath', 'star-1', f.opacity], ['restore'],
    ]);
  });

  test('le scintille finite non si disegnano, quelle ancora in volo sì', () => {
    const calls = draw(burst([heart, star]), 700); // il cuore dura 600 ms, la stella 800 ms
    expect(calls.filter((c) => c[0] === 'drawPath').map((c) => c[1])).toEqual(['star-0', 'star-1']);
    expect(draw(burst([heart, star]), 800)).toEqual([]);
    expect(draw(burst([heart, star]), 5000)).toEqual([]);
  });

  test('save e restore sono sempre in pari numero', () => {
    for (const t of [0, 100, 450, 599, 600, 700, 800]) {
      const calls = draw(burst([star, heart, star]), t);
      expect(calls.filter((c) => c[0] === 'save')).toHaveLength(calls.filter((c) => c[0] === 'restore').length);
    }
  });
});
