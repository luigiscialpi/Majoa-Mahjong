import { createRng } from '../domain/prng';
import {
  BUDGET,
  CONFETTI,
  CONFETTI_FIRST,
  CONFETTI_STRIDE,
  FIREWORKS_COLORS,
  FPS,
  FRAME_MS,
  LIFE_LEVELS,
  MAX_LEVEL,
  ROCKET,
  ROCKET_COLOR,
  ROCKET_STRIDE,
  SHOW_MS,
  SPARK,
  SPARK_FIRST,
  SPARK_HUES,
  SPARK_STRIDE,
  THICKNESS_LEVELS,
  advanceClock,
  drawFireworks,
  hslHex,
  makeShow,
  sparkCount,
  type Show,
} from './fireworks';

// Le costanti si leggono dall'HTML dell'originale, non si scrivono a occhio: `launch` riga 2214, `explode` 2220,
// `spawnConf` 2229, `fwLoop` 2234, `startFx` 2264.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const src = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8'); // percorso dalla radice del progetto
const part = (from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
const must = (m: RegExpExecArray | null): RegExpExecArray => {
  expect(m).not.toBeNull();
  return m!;
};
const num = (m: RegExpExecArray, i: number) => Number(m[i]);
const launchSrc = part('function launch()', 'function explode');
const explodeSrc = part('function explode', 'var CONF=');
const confSrc = part('function spawnConf', 'function fwLoop');
const loopSrc = part('function fwLoop', 'function startFx');
const startSrc = part('function startFx', 'function stopFx');

const rngOf = (seed: number) => {
  const r = createRng(seed);
  return () => r.next();
};
const OPTS = { width: 360, height: 780, level: 7, finale: false, reduced: false };
const DT = 1 / 60;

describe('costanti dell\'originale', () => {
  test('razzi: posizione e velocità di partenza, quota, gravità, soglia di esplosione, scia', () => {
    const x = must(/x:fwW\*\(([\d.]+)\+Math\.random\(\)\*([\d.]+)\)/.exec(launchSrc));
    const vx = must(/vx:\(Math\.random\(\)-\.5\)\*(\d+)/.exec(launchSrc));
    const vy = must(/vy:-\(fwH\*\(([\d.]+)\+Math\.random\(\)\*([\d.]+)\)\)/.exec(launchSrc));
    const ty = must(/ty:fwH\*\(([\d.]+)\+Math\.random\(\)\*([\d.]+)\)/.exec(launchSrc));
    const g = must(/r\.vy\+=(\d+)\*dt/.exec(loopSrc));
    const slow = must(/r\.vy>-(\d+)/.exec(loopSrc));
    const line = must(/strokeStyle='(#\w+)'; fx\.lineWidth=([\d.]+)/.exec(loopSrc));
    expect(ROCKET).toEqual({ xMin: num(x, 1), xSpan: num(x, 2), vx: num(vx, 1), vyMin: num(vy, 1), vySpan: num(vy, 2), tyMin: num(ty, 1), tySpan: num(ty, 2), gravity: num(g, 1), slowUp: num(slow, 1), width: num(line, 2), color: line[1] });
  });

  test('scintille: velocità, frenata, gravità, decadimento, tinte e spessore', () => {
    const sp = must(/sp=(\d+)\+Math\.random\(\)\*\(fwW<(\d+)\?(\d+):(\d+)\)/.exec(explodeSrc));
    const slow = must(/Math\.random\(\)<([\d.]+)\)sp\*=([\d.]+)/.exec(explodeSrc));
    const decay = must(/decay:([\d.]+)\+Math\.random\(\)\*([\d.]+)/.exec(explodeSrc));
    const hue = must(/hue\+(\d+):hue\)\+Math\.random\(\)\*(\d+)\)/.exec(explodeSrc));
    const damp = must(/p\.vx\*=([\d.]+)/.exec(loopSrc));
    const grav = must(/p\.vy=p\.vy\*[\d.]+\+(\d+)\*dt/.exec(loopSrc));
    expect(SPARK).toEqual({ speedMin: num(sp, 1), speedSpanPhone: num(sp, 3), speedSpanWide: num(sp, 4), wideFrom: num(sp, 2), slowChance: num(slow, 1), slowFactor: num(slow, 2), decayMin: num(decay, 1), decaySpan: num(decay, 2), damping: num(damp, 1), gravity: num(grav, 1), hueSpan: num(hue, 2), hueSecond: num(hue, 1) });
    const width = must(/lineWidth=([\d.]+)\*p\.life\+([\d.]+)/.exec(loopSrc));
    expect([num(width, 1), num(width, 2)]).toEqual([2.6, 0.6]); // se cambiano, vanno cambiati nel disegno a lotti (`2.6 * alpha + 0.6`)
    const n = must(/reduce\?(\d+):(\d+)\+fwLevel\*(\d+)/.exec(explodeSrc));
    expect([n[1], n[2], n[3]]).toEqual(['26', '50', '9']); // quantità dell'originale, qui ridotte da `BUDGET`
    expect(BUDGET.sparkReduced).toBe(num(n, 1));
  });

  test('coriandoli: colori, partenza, velocità, rotazione, dimensioni, oscillazione, schiacciamento, uscita', () => {
    const colors = must(/var CONF=\[([^\]]*)\]/.exec(src))[1].match(/#\w+/g);
    const c = must(/x:Math\.random\(\)\*fwW,y:(-?\d+),vx:\(Math\.random\(\)-\.5\)\*(\d+),vy:(\d+)\+Math\.random\(\)\*(\d+),\s*r:Math\.random\(\)\*[\d.]+,vr:\(Math\.random\(\)-\.5\)\*(\d+),w:(\d+)\+Math\.random\(\)\*(\d+),h:(\d+)\+Math\.random\(\)\*(\d+)/.exec(confSrc));
    const drift = must(/p\.x\+=\(p\.vx\+Math\.sin\(p\.ph\)\*(\d+)\)\*dt/.exec(loopSrc));
    const rate = must(/p\.ph\+=dt\*(\d+)/.exec(loopSrc));
    const squash = must(/fx\.scale\(1,Math\.cos\(p\.ph\*([\d.]+)\)\)/.exec(loopSrc));
    const exit = must(/p\.y>fwH\+(\d+)/.exec(loopSrc));
    expect(CONFETTI).toEqual({ colors, startY: num(c, 1), exitMargin: num(exit, 1), vxSpan: num(c, 2), vyMin: num(c, 3), vySpan: num(c, 4), vrSpan: num(c, 5), wMin: num(c, 6), wSpan: num(c, 7), hMin: num(c, 8), hSpan: num(c, 9), driftAmp: num(drift, 1), driftRate: num(rate, 1), squash: num(squash, 1) });
  });

  test('durata di lancio 5 s (9 s nei finali), razzi iniziali, intervallo tra i razzi, livello massimo 12', () => {
    const until = must(/confUntil=fwLast\+\(grand\?(\d+):(\d+)\)/.exec(startSrc));
    expect(SHOW_MS).toEqual({ normal: num(until, 2), finale: num(until, 1) });
    expect(must(/fwLevel=Math\.min\(level,(\d+)\)/.exec(startSrc))[1]).toBe(String(MAX_LEVEL));
    const n = must(/var n=2\+Math\.floor\(fwLevel\/(\d+)\)\+\(grand\?(\d+):0\)/.exec(startSrc));
    const rocketsAt = (level: number, finale: boolean) => makeShow({ ...OPTS, level, finale }, rngOf(level)).rockets.filter((_, i) => i % ROCKET_STRIDE === 0 && _ === 0).length;
    for (const level of [1, 3, 6, 9, 12, 20]) {
      for (const finale of [false, true]) {
        const L = Math.min(level, 12);
        expect(rocketsAt(level, finale)).toBe(2 + Math.floor(L / num(n, 1)) + (finale ? num(n, 2) : 0) + 1); // +1: il razzo del primo fotogramma
      }
    }
    const gap = must(/fwNext=Math\.max\(\.(\d+),\.(\d+)-fwLevel\*([\d.]+)\)\+Math\.random\(\)\*([\d.]+)/.exec(loopSrc));
    for (const level of [1, 5, 12]) {
      const gaps: number[] = [];
      for (let seed = 1; seed <= 40; seed++) {
        const launches = makeShow({ ...OPTS, level }, rngOf(seed)).rockets.filter((_, i) => i % ROCKET_STRIDE === 0);
        const later = launches.filter((t) => t > 0).sort((a, b) => a - b);
        gaps.push(...later.slice(1).map((t, i) => t - later[i]));
      }
      const min = Math.max(Number(`.${gap[1]}`), Number(`.${gap[2]}`) - Math.min(level, 12) * num(gap, 3)) * 1000;
      const span = num(gap, 4) * 1000;
      for (const g of gaps) expect(g).toBeGreaterThanOrEqual(min - 1e-6), expect(g).toBeLessThanOrEqual(min + span + 1e-6);
      // L'intervallo è `min + casuale·span`: con centinaia di campioni la media sta a metà (altrimenti cambia il minimo).
      expect(gaps.length).toBeGreaterThan(100);
      expect(Math.abs(gaps.reduce((a, b) => a + b, 0) / gaps.length - (min + span / 2))).toBeLessThan(span / 20);
    }
  });
});

describe('fisica: coincide con l\'integrazione dell\'originale a 60 fotogrammi al secondo', () => {
  const ENUMS = { lines: 1, round: 1, butt: 0 } as const;
  const stub = () => {
    const calls: { color: number; alpha: number; width: number; cap: number; points: { x: number; y: number }[] }[] = [];
    const paint = { color: -1, alpha: 1, width: 0, cap: -1, setColor(c: number) { this.color = c; }, setAlphaf(a: number) { this.alpha = a; }, setStrokeWidth(w: number) { this.width = w; }, setStrokeCap(c: number) { this.cap = c; } };
    const canvas = { drawPoints: (_mode: number, points: { x: number; y: number }[], p: typeof paint) => calls.push({ color: p.color, alpha: p.alpha, width: p.width, cap: p.cap, points: [...points] }) };
    return { calls, paint, canvas };
  };
  const draw = (show: Show, t: number) => {
    const { calls, paint, canvas } = stub();
    const result = drawFireworks(canvas, paint, FIREWORKS_COLORS.map((_, i) => i), ENUMS, show, t);
    return { calls, result };
  };
  /** Uno spettacolo con un solo razzo che esplode subito in (100, 400) e una sola scintilla. */
  const oneSpark = (vx: number, vy: number, decay = 0.55): Show => ({ width: 360, height: 780, durationMs: 5000, rockets: [0, 0, 0, 0, 0, 0, 100, 400, 0, 1], sparks: [vx, vy, decay, SPARK_FIRST + 3], confetti: [] });

  test('scintille: posizione dopo ogni fotogramma uguale al ciclo dell\'originale (frenata, gravità, poi spostamento)', () => {
    for (const [vx, vy] of [[150, -120], [-80, 200], [0, -250]]) {
      let x = 100;
      let y = 400;
      let svx = vx;
      let svy = vy;
      const at: Record<number, { x: number; y: number }> = { 0: { x, y } };
      for (let k = 1; k <= 90; k++) {
        svx *= SPARK.damping;
        svy = svy * SPARK.damping + SPARK.gravity * DT;
        x += svx * DT;
        y += svy * DT;
        at[k] = { x, y };
      }
      // Il disegno è una scia dal passo precedente (`FRAME_MS` fa) a ora: l'ultimo punto è la posizione di ora.
      for (const k of [2, 5, 30, 60, 90]) {
        const { calls } = draw(oneSpark(vx, vy, 0.01), k * DT * 1000);
        const [, now] = calls[0].points;
        expect(now.x).toBeCloseTo(at[k].x, 6);
        expect(now.y).toBeCloseTo(at[k].y, 6);
        const kPrev = k - FRAME_MS / (DT * 1000);
        const [before] = calls[0].points;
        const lo = Math.floor(kPrev);
        const f = kPrev - lo; // tra due fotogrammi l'andamento è liscio: basta restare tra i due vicini
        expect(before.x).toBeGreaterThanOrEqual(Math.min(at[lo].x, at[lo + 1].x) - 1e-6);
        expect(before.x).toBeLessThanOrEqual(Math.max(at[lo].x, at[lo + 1].x) + 1e-6);
        expect(f).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('razzo in volo: posizione dopo ogni fotogramma uguale al ciclo dell\'originale (spostamento, poi gravità)', () => {
    const vx = 20;
    const vy0 = -700;
    const show: Show = { width: 360, height: 780, durationMs: 9000, rockets: [0, 100, 780, vx, vy0, 5000, 130, 100, 0, 0], sparks: [], confetti: [] };
    let x = 100;
    let y = 780;
    let vy = vy0;
    for (let k = 1; k <= 40; k++) {
      x += vx * DT;
      y += vy * DT;
      vy += ROCKET.gravity * DT;
      const { calls } = draw(show, k * DT * 1000);
      const [, now] = calls[0].points;
      expect(now.x).toBeCloseTo(x, 6);
      expect(now.y).toBeCloseTo(y, 6);
    }
  });

  test('coriandolo: posizione, rotazione e spessore dopo ogni fotogramma uguali all\'originale entro 1,5 px', () => {
    // Un coriandolo: nasce a 0, x0 100, vx 10, vy 150, r0 1, vr 3, 8×6, fase 0,5, colore 2, vive 9 s.
    const confetto = [0, 100, 10, 150, 1, 3, 8, 6, 0.5, CONFETTI_FIRST + 2, 9000];
    const show: Show = { width: 360, height: 780, durationMs: 9000, rockets: [], sparks: [], confetti: confetto };
    let x = 100;
    let y = CONFETTI.startY;
    let r = 1;
    let ph = 0.5;
    for (let k = 1; k <= 360; k++) {
      ph += DT * CONFETTI.driftRate;
      x += (10 + Math.sin(ph) * CONFETTI.driftAmp) * DT;
      y += 150 * DT;
      r += 3 * DT;
      if (k % 60 !== 0) continue;
      const { calls } = draw(show, k * DT * 1000);
      if (calls.length === 0) continue; // di taglio: spessore nullo in quell'istante
      const [a, b] = calls[0].points;
      expect(Math.abs((a.x + b.x) / 2 - x)).toBeLessThan(1.5);
      expect(Math.abs((a.y + b.y) / 2 - y)).toBeLessThan(1.5);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(8, 6); // lunghezza = larghezza
      expect(Math.atan2(b.y - a.y, b.x - a.x)).toBeCloseTo(Math.atan2(Math.sin(r), Math.cos(r)), 6);
      const thickness = 6 * Math.abs(Math.cos(ph * CONFETTI.squash));
      expect(calls[0].width).toBeGreaterThanOrEqual(thickness - 2.25 - 1e-9); // livello = soffitto di thickness / 2,25
      expect(calls[0].width).toBeLessThan(thickness + 2.25 + 1e-9);
    }
  });

  test('i razzi esplodono alla quota o quando rallentano, come l\'originale', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const show = makeShow({ ...OPTS, level: 1 + (seed % 14), finale: seed % 5 === 0 }, rngOf(seed));
      for (let i = 0; i < show.rockets.length; i += ROCKET_STRIDE) {
        const [launch, , , , vy0, boom, , by] = show.rockets.slice(i, i + ROCKET_STRIDE);
        const vyEnd = vy0 + ROCKET.gravity * ((boom - launch) / 1000);
        expect(by <= OPTS.height * (ROCKET.tyMin + ROCKET.tySpan) + Math.abs(vy0) * DT || vyEnd > -ROCKET.slowUp - 1e-9).toBe(true);
        expect(boom).toBeGreaterThan(launch);
      }
    }
  });
});

describe('budget', () => {
  // Sono scelte dell'app, non dell'originale (`docs/gioco-originale.md`): cambiarle è una decisione da riportare nei documenti.
  test('i valori sono quelli documentati', () => {
    expect(BUDGET).toEqual({ sparkBase: 24, sparkPerLevel: 2, sparkReduced: 26, confettiBase: 24, confettiPerLevel: 2, confettiPerSecond: 30, maxLiveSparks: 300, maxLiveConfetti: 200 });
    expect(FPS).toBe(30);
  });
});

describe('makeShow', () => {
  test('con lo stesso `rand` lo spettacolo è identico, con un altro cambia', () => {
    expect(makeShow(OPTS, rngOf(5))).toEqual(makeShow(OPTS, rngOf(5)));
    expect(makeShow(OPTS, rngOf(5))).not.toEqual(makeShow(OPTS, rngOf(6)));
  });

  test('scintille per esplosione: `24 + 2·livello` (26 con la riduzione del movimento), mai più di 48', () => {
    expect([1, 5, 12, 30].map((l) => sparkCount(l, false))).toEqual([26, 34, 48, 48]);
    expect(sparkCount(12, true)).toBe(26);
    const show = makeShow({ ...OPTS, level: 9 }, rngOf(2));
    for (let i = 0; i < show.rockets.length; i += ROCKET_STRIDE) expect(show.rockets[i + 9]).toBe(sparkCount(9, false));
    expect(show.sparks.length / SPARK_STRIDE).toBe((show.rockets.length / ROCKET_STRIDE) * sparkCount(9, false));
  });

  test('i razzi partono solo nella durata di lancio; nessuno dopo', () => {
    for (const finale of [false, true]) {
      const show = makeShow({ ...OPTS, finale }, rngOf(8));
      const launches = show.rockets.filter((_, i) => i % ROCKET_STRIDE === 0);
      expect(Math.max(...launches)).toBeLessThan(finale ? SHOW_MS.finale : SHOW_MS.normal);
    }
  });

  test('coriandoli: `24 + 2·livello` all\'inizio e 30 al secondo per la durata di lancio, nessuno con la riduzione del movimento', () => {
    const show = makeShow({ ...OPTS, level: 5 }, rngOf(4));
    expect(show.confetti.length / CONFETTI_STRIDE).toBe(24 + 2 * 5 + (SHOW_MS.normal / 1000) * BUDGET.confettiPerSecond);
    expect(makeShow({ ...OPTS, level: 5, finale: true }, rngOf(4)).confetti.length / CONFETTI_STRIDE).toBe(24 + 2 * 5 + (SHOW_MS.finale / 1000) * BUDGET.confettiPerSecond);
    expect(makeShow({ ...OPTS, reduced: true }, rngOf(4)).confetti).toEqual([]);
  });

  test('i valori sono quelli dell\'originale: confetti nel loro intervallo, colori validi, fine dopo la nascita', () => {
    const show = makeShow({ ...OPTS, level: 20 }, rngOf(9));
    for (let i = 0; i < show.confetti.length; i += CONFETTI_STRIDE) {
      const [spawn, x0, vx, vy, r0, vr, w, h, ph, color, end] = show.confetti.slice(i, i + CONFETTI_STRIDE);
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(x0).toBeLessThanOrEqual(OPTS.width);
      expect(Math.abs(vx)).toBeLessThanOrEqual(CONFETTI.vxSpan / 2);
      expect(vy).toBeGreaterThanOrEqual(CONFETTI.vyMin);
      expect(vy).toBeLessThanOrEqual(CONFETTI.vyMin + CONFETTI.vySpan);
      expect(Math.abs(vr)).toBeLessThanOrEqual(CONFETTI.vrSpan / 2);
      expect([r0, ph].every((a) => a >= 0 && a <= Math.PI * 2)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(CONFETTI.wMin);
      expect(h).toBeGreaterThanOrEqual(CONFETTI.hMin);
      expect(Number.isInteger(color) && color >= CONFETTI_FIRST && color < CONFETTI_FIRST + CONFETTI.colors.length).toBe(true);
      expect(end - spawn).toBeCloseTo(((OPTS.height + CONFETTI.exitMargin - CONFETTI.startY) / vy) * 1000, 6);
    }
    for (let i = 0; i < show.sparks.length; i += SPARK_STRIDE) {
      const [vx, vy, decay, color] = show.sparks.slice(i, i + SPARK_STRIDE);
      expect(Math.hypot(vx, vy)).toBeLessThanOrEqual(SPARK.speedMin + SPARK.speedSpanPhone + 1e-9);
      expect(decay).toBeGreaterThanOrEqual(SPARK.decayMin);
      expect(decay).toBeLessThanOrEqual(SPARK.decayMin + SPARK.decaySpan);
      expect(Number.isInteger(color) && color >= SPARK_FIRST && color < SPARK_FIRST + SPARK_HUES).toBe(true);
    }
  });

  test('su schermo largo le scintille arrivano più lontano (soglia 500 px)', () => {
    const maxSpeed = (width: number) => {
      const show = makeShow({ ...OPTS, width }, rngOf(1));
      return Math.max(...Array.from({ length: show.sparks.length / SPARK_STRIDE }, (_, k) => Math.hypot(show.sparks[k * SPARK_STRIDE], show.sparks[k * SPARK_STRIDE + 1])));
    };
    expect(maxSpeed(360)).toBeLessThanOrEqual(SPARK.speedMin + SPARK.speedSpanPhone);
    expect(maxSpeed(800)).toBeGreaterThan(SPARK.speedMin + SPARK.speedSpanPhone);
    expect(maxSpeed(800)).toBeLessThanOrEqual(SPARK.speedMin + SPARK.speedSpanWide);
  });

  test('la durata copre l\'ultima scintilla e l\'ultimo coriandolo, e dopo non c\'è più nulla da disegnare', () => {
    for (const finale of [false, true]) {
      const show = makeShow({ ...OPTS, finale }, rngOf(12));
      for (let i = 0; i < show.rockets.length; i += ROCKET_STRIDE) expect(show.durationMs).toBeGreaterThanOrEqual(show.rockets[i + 5] + 1000 / SPARK.decayMin - 1e-6);
      for (let i = 0; i < show.confetti.length; i += CONFETTI_STRIDE) expect(show.durationMs).toBeGreaterThanOrEqual(show.confetti[i + 10] - 1e-6);
      const calls: unknown[] = [];
      const paint = { setColor() {}, setAlphaf() {}, setStrokeWidth() {}, setStrokeCap() {} };
      const out = drawFireworks({ drawPoints: (...a) => calls.push(a) }, paint, FIREWORKS_COLORS, { lines: 1, round: 1, butt: 0 }, show, show.durationMs);
      expect(out).toEqual({ sparks: 0, confetti: 0, rockets: 0, batches: 0 });
      expect(calls).toEqual([]);
    }
  });

  test('senza coriandoli (riduzione del movimento) la durata è quella dell\'ultima scintilla', () => {
    for (const finale of [false, true]) {
      const show = makeShow({ ...OPTS, finale, reduced: true }, rngOf(15));
      const lastBoom = Math.max(...show.rockets.filter((_, i) => i % ROCKET_STRIDE === 5));
      expect(show.durationMs).toBeCloseTo(lastBoom + 1000 / SPARK.decayMin, 6);
    }
  });

  test('una partita da 14 s al massimo e finali più lunghi', () => {
    const normal = makeShow({ ...OPTS, finale: false }, rngOf(1)).durationMs;
    const finale = makeShow({ ...OPTS, finale: true }, rngOf(1)).durationMs;
    expect(normal).toBeLessThan(16_000);
    expect(finale).toBeGreaterThan(normal);
    expect(finale).toBeLessThan(25_000);
  });
});

describe('drawFireworks: lotti di disegno', () => {
  const ENUMS = { lines: 7, round: 11, butt: 13 } as const;
  const run = (show: Show, t: number, drawPointsMode = false) => {
    const calls: { mode: number; color: number; alpha: number; width: number; cap: number; points: { x: number; y: number }[] }[] = [];
    const paint = { color: -1, alpha: 1, width: 0, cap: -1, setColor(c: number) { this.color = c; }, setAlphaf(a: number) { this.alpha = a; }, setStrokeWidth(w: number) { this.width = w; }, setStrokeCap(c: number) { this.cap = c; } };
    const canvas = { drawPoints: (mode: number, points: { x: number; y: number }[], p: typeof paint) => calls.push({ mode, color: p.color, alpha: p.alpha, width: p.width, cap: p.cap, points: [...points] }) };
    const result = drawFireworks(canvas, paint, FIREWORKS_COLORS.map((_, i) => i), ENUMS, show, t);
    void drawPointsMode;
    return { calls, result };
  };
  const rocket = (boom: number, sparksFirst: number, count: number, launch = 0) => [launch, 0, 780, 0, -700, boom, 100, 400, sparksFirst, count];

  test('una scintilla: un lotto con colore, dissolvenza e spessore dell\'originale (alpha = vita, spessore 2,6·vita + 0,6)', () => {
    const show: Show = { width: 360, height: 780, durationMs: 5000, rockets: rocket(0, 0, 1), sparks: [100, -50, 0.8, SPARK_FIRST + 5], confetti: [] };
    const s = 0.5; // vita = 1 - 0,8·0,5 = 0,6 → livello ⌈0,6·8⌉ = 5 di 8
    const { calls, result } = run(show, s * 1000);
    expect(result).toMatchObject({ sparks: 1, confetti: 0, rockets: 0, batches: 1 });
    const alpha = Math.ceil(0.6 * LIFE_LEVELS) / LIFE_LEVELS;
    expect(calls).toEqual([{ mode: ENUMS.lines, color: SPARK_FIRST + 5, alpha, width: 2.6 * alpha + 0.6, cap: ENUMS.round, points: expect.any(Array) }]);
    expect(calls[0].points).toHaveLength(2);
  });

  test('le scintille con lo stesso colore e livello stanno nello stesso lotto, con colore o livello diversi no', () => {
    const sparks = [100, 0, 0.55, SPARK_FIRST + 1, -100, 0, 0.55, SPARK_FIRST + 1, 0, 100, 0.55, SPARK_FIRST + 2, 0, -100, 0.9, SPARK_FIRST + 1];
    const { calls, result } = run({ width: 360, height: 780, durationMs: 5000, rockets: rocket(0, 0, 4), sparks, confetti: [] }, 400);
    expect(result.sparks).toBe(4);
    expect(calls.map((c) => c.points.length / 2).sort()).toEqual([1, 1, 2]); // 2 insieme; il colore diverso e la vita diversa a parte
  });

  test('ordine di disegno come nell\'originale: coriandoli, razzi, scintille', () => {
    const show: Show = {
      width: 360,
      height: 780,
      durationMs: 5000,
      rockets: [...rocket(0, 0, 1), 0, 50, 780, 0, -700, 5000, 60, 100, 1, 0],
      sparks: [100, 0, 0.55, SPARK_FIRST],
      confetti: [0, 100, 0, 150, 0, 0, 8, 6, 0, CONFETTI_FIRST + 1, 9000],
    };
    const { calls } = run(show, 100);
    const kinds = calls.map((c) => (c.color === ROCKET_COLOR ? 'razzo' : c.color < SPARK_FIRST ? 'coriandolo' : 'scintilla'));
    expect(kinds).toEqual(['coriandolo', 'razzo', 'scintilla']);
    expect(calls[0].cap).toBe(ENUMS.butt); // i coriandoli hanno la testa piatta
    expect(calls[1]).toMatchObject({ cap: ENUMS.round, alpha: 1, width: ROCKET.width });
  });

  test('tetti sulle primitive vive: scintille e coriandoli oltre il budget non si disegnano', () => {
    const rockets: number[] = [];
    const sparks: number[] = [];
    for (let r = 0; r < 12; r++) {
      rockets.push(...rocket(0, r * 100, 100));
      for (let i = 0; i < 100; i++) sparks.push(10 + i, -20, 0.55, SPARK_FIRST + (i % SPARK_HUES));
    }
    const confetti: number[] = [];
    for (let i = 0; i < 400; i++) confetti.push(0, 10 + i / 2, 0, 100, 0, 0, 8, 6, 0.1, CONFETTI_FIRST + (i % CONFETTI.colors.length), 9000);
    const out = run({ width: 360, height: 780, durationMs: 9000, rockets, sparks, confetti }, 600).result;
    expect(out.sparks).toBe(BUDGET.maxLiveSparks);
    expect(out.confetti).toBe(BUDGET.maxLiveConfetti);
    expect(out.batches).toBeLessThanOrEqual(SPARK_HUES * LIFE_LEVELS + CONFETTI.colors.length * THICKNESS_LEVELS + 1);
  });

  test('con le scintille oltre il tetto restano quelle dell\'esplosione più recente', () => {
    // Due esplosioni da 200 scintille (400 in tutto, il tetto è 300): la più vecchia (colore A) perde le ultime 100.
    const sparks: number[] = [];
    for (let i = 0; i < 200; i++) sparks.push(10 + i, 0, 0.55, SPARK_FIRST);
    for (let i = 0; i < 200; i++) sparks.push(10 + i, 0, 0.55, SPARK_FIRST + 6);
    const rockets = [...rocket(0, 0, 200), ...rocket(100, 200, 200)];
    const { calls, result } = run({ width: 360, height: 780, durationMs: 5000, rockets, sparks, confetti: [] }, 150);
    const per = (color: number) => calls.filter((c) => c.color === color).reduce((n, c) => n + c.points.length / 2, 0);
    expect(result.sparks).toBe(BUDGET.maxLiveSparks);
    expect([per(SPARK_FIRST + 6), per(SPARK_FIRST)]).toEqual([200, BUDGET.maxLiveSparks - 200]);
  });

  test('prima della partenza e dopo la fine non si disegna nulla', () => {
    const show = makeShow(OPTS, rngOf(3));
    expect(run(show, -50).result).toEqual({ sparks: 0, confetti: 0, rockets: 0, batches: 0 });
  });

  test('uno spettacolo vero resta dentro i tetti in ogni istante', () => {
    const show = makeShow({ ...OPTS, level: 12, finale: true }, rngOf(21));
    let peakBatches = 0;
    for (let t = 0; t <= show.durationMs; t += FRAME_MS) {
      const { result } = run(show, t);
      expect(result.sparks).toBeLessThanOrEqual(BUDGET.maxLiveSparks);
      expect(result.confetti).toBeLessThanOrEqual(BUDGET.maxLiveConfetti);
      peakBatches = Math.max(peakBatches, result.batches);
    }
    expect(peakBatches).toBeLessThanOrEqual(SPARK_HUES * LIFE_LEVELS + CONFETTI.colors.length * THICKNESS_LEVELS + 1);
  });
});

describe('advanceClock', () => {
  test('il tempo reale si accumula e l\'orologio avanza a passi interi di FRAME_MS', () => {
    expect(FPS).toBe(30);
    let state = { clockMs: 0, accMs: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 12; i++) {
      state = advanceClock(state.clockMs, state.accMs, 1000 / 60); // schermo a 60 Hz: un passo ogni due fotogrammi
      seen.push(Math.round(state.clockMs * 1000) / 1000);
    }
    expect(seen).toEqual([0, 33.333, 33.333, 66.667, 66.667, 100, 100, 133.333, 133.333, 166.667, 166.667, 200]);
  });

  test('dopo un fotogramma lento recupera il tempo perso, senza rallentare lo spettacolo', () => {
    const state = advanceClock(0, 0, 100);
    expect(state.clockMs).toBeCloseTo(3 * FRAME_MS, 9);
    expect(state.accMs).toBeCloseTo(100 - 3 * FRAME_MS, 9);
  });

  test('nel lungo periodo l\'orologio non si discosta dal tempo reale più di un passo', () => {
    let state = { clockMs: 0, accMs: 0 };
    let real = 0;
    for (let i = 0; i < 1000; i++) {
      const dt = 8 + ((i * 7) % 25); // fotogrammi irregolari
      real += dt;
      state = advanceClock(state.clockMs, state.accMs, dt);
      expect(real - state.clockMs).toBeLessThan(FRAME_MS + 1e-6);
      expect(real - state.clockMs).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});

describe('colori', () => {
  // Riferimento indipendente: conversione HSL → RGB come da specifica CSS.
  const reference = (h: number, s: number, l: number) => {
    const S = s / 100;
    const L = l / 100;
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    const f = (t: number) => {
      const u = (t + 1) % 1;
      const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    const H = h / 360;
    return `#${f(H + 1 / 3)}${f(H)}${f(H - 1 / 3)}`;
  };

  test('hslHex coincide con la conversione CSS', () => {
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const h of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      for (const [s, l] of [[100, 70], [100, 50], [80, 60], [50, 30]]) {
        // Ammesso un livello di scarto: i valori a metà (come 178,5) si arrotondano in modo diverso tra le due formule.
        channels(hslHex(h, s, l)).forEach((c, i) => expect(Math.abs(c - channels(reference(h, s, l))[i])).toBeLessThanOrEqual(1));
      }
    }
    expect(hslHex(0, 100, 50)).toBe('#ff0000');
    expect(hslHex(120, 100, 50)).toBe('#00ff00');
    expect(hslHex(240, 100, 50)).toBe('#0000ff');
  });

  test('la tavolozza ha razzo, 7 coriandoli (quelli dell\'originale) e 12 tinte di scintille a passo di 30°', () => {
    expect(FIREWORKS_COLORS).toHaveLength(1 + CONFETTI.colors.length + SPARK_HUES);
    expect(FIREWORKS_COLORS[ROCKET_COLOR]).toBe(ROCKET.color);
    expect(FIREWORKS_COLORS.slice(CONFETTI_FIRST, SPARK_FIRST)).toEqual([...CONFETTI.colors]);
    expect(FIREWORKS_COLORS.slice(SPARK_FIRST)).toEqual(Array.from({ length: SPARK_HUES }, (_, i) => hslHex(i * 30, 100, 70)));
  });
});
