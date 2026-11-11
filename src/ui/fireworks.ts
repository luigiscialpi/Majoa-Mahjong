// Fuochi d'artificio della vittoria (`docs/resa-visiva.md`). Solo funzioni e costanti pure, senza React, Skia o Reanimated:
// `FireworksLayer` li disegna. Riferimenti nell'originale ("Majoa Mahjong.html"): `launch` riga 2214, `explode` 2220,
// `spawnConf` 2229, `fwLoop` 2234, `startFx` 2264.
//
// Costo: l'originale arriva a circa 700 scintille e 500 coriandoli vivi insieme, disegnati uno per uno su un canvas 2D. Qui
// ogni primitiva costa una chiamata a Skia dal thread UI, e il profilo sul Redmi mostra che bastano poche decine di primitive
// per aumentare i frame lenti (`docs/rendering.md`). Per questo lo spettacolo ha un budget fisso (costanti `BUDGET` sotto, da
// tarare con il profilo A/B), è finito, si aggiorna a 30 fotogrammi al secondo e si disegna a lotti: una sola chiamata per
// colore e livello di dissolvenza, non una per particella.

/** Aggiornamenti al secondo: il disegno si rifà a ogni passo, non a ogni fotogramma dello schermo. */
export const FPS = 30;
export const FRAME_MS = 1000 / FPS;
/** Passo del fotogramma dell'originale (60 al secondo): le formule fisiche sono quelle dell'originale a questo passo. */
const DT = 1 / 60;

/** Razzi (`launch`, `fwLoop`): partenza dal bordo basso, salita con gravità 120, esplosione a quota `ty` o quando rallenta. */
export const ROCKET = { xMin: 0.12, xSpan: 0.76, vx: 50, vyMin: 0.85, vySpan: 0.35, tyMin: 0.1, tySpan: 0.35, gravity: 120, slowUp: 40, width: 2.5, color: '#fff6c8' } as const;
/** Scintille (`explode`, `fwLoop`): velocità, decadimento, frenata 0,985 e gravità 150 a ogni fotogramma a 60 al secondo. */
export const SPARK = { speedMin: 60, speedSpanPhone: 170, speedSpanWide: 260, wideFrom: 500, slowChance: 0.35, slowFactor: 0.45, decayMin: 0.55, decaySpan: 0.5, damping: 0.985, gravity: 150, hueSpan: 30, hueSecond: 150 } as const;
/** Coriandoli (`spawnConf`, `fwLoop`): caduta con oscillazione laterale e rotazione, rettangolo schiacciato dal coseno della fase. */
export const CONFETTI = {
  colors: ['#ff5c8a', '#ffc21a', '#4a90e8', '#2ec4a0', '#9b5de5', '#ffffff', '#ff8a3d'],
  startY: -12,
  exitMargin: 20,
  vxSpan: 60,
  vyMin: 90,
  vySpan: 180,
  vrSpan: 10,
  wMin: 6,
  wSpan: 6,
  hMin: 4,
  hSpan: 5,
  driftAmp: 40,
  driftRate: 4,
  squash: 1.3,
} as const;
/** Livello massimo usato per razzi, scintille e coriandoli iniziali (`fwLevel = Math.min(level, 12)`). */
export const MAX_LEVEL = 12;
/** Durata del lancio di razzi e coriandoli: 5 s, 9 s nei finali (`confUntil`). */
export const SHOW_MS = { normal: 5000, finale: 9000 } as const;

/**
 * Budget scelto per l'app, non dell'originale: scintille per esplosione `24 + 2·livello` (48 al massimo, 26 con la riduzione
 * del movimento come nell'originale) invece di `50 + 9·livello`; coriandoli `24 + 2·livello` all'inizio e 30 al secondo
 * invece di `60 + 8·livello` e 120 al secondo (nessuno con la riduzione del movimento); tetti sulle primitive vive disegnate
 * in un fotogramma.
 */
export const BUDGET = { sparkBase: 24, sparkPerLevel: 2, sparkReduced: 26, confettiBase: 24, confettiPerLevel: 2, confettiPerSecond: 30, maxLiveSparks: 300, maxLiveConfetti: 200 } as const;

/** Livelli di dissolvenza delle scintille e di spessore dei coriandoli: ogni combinazione con un colore è un lotto di disegno. */
export const LIFE_LEVELS = 8;
export const THICKNESS_LEVELS = 4;
const THICKNESS_STEP = 2.25;

/** Hue delle scintille: 12 colori a passo di 30° (l'originale ne ha di continui, con luminosità 60-80%). */
export const SPARK_HUES = 12;
/** Colore di ogni tipo di primitiva: indici in `FIREWORKS_COLORS`. */
export const ROCKET_COLOR = 0;
export const CONFETTI_FIRST = 1;
export const SPARK_FIRST = CONFETTI_FIRST + CONFETTI.colors.length;

/** Colore HSL come stringa `#rrggbb`. */
export function hslHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Tutti i colori dello spettacolo: razzo, coriandoli, scintille (le scintille sono gli ultimi `SPARK_HUES`). */
export const FIREWORKS_COLORS: readonly string[] = [
  ROCKET.color,
  ...CONFETTI.colors,
  ...Array.from({ length: SPARK_HUES }, (_, i) => hslHex(i * (360 / SPARK_HUES), 100, 70)),
];

/** Passi (numero di valori per elemento) delle tre tabelle di `Show`. */
export const ROCKET_STRIDE = 10;
export const SPARK_STRIDE = 4;
export const CONFETTI_STRIDE = 11;
/** Indici dentro un razzo: partenza (ms), x0, y0, vx, vy0, esplosione (ms), x e y dell'esplosione, prima scintilla, scintille. */
const R = { launch: 0, x0: 1, y0: 2, vx: 3, vy0: 4, boom: 5, bx: 6, by: 7, first: 8, count: 9 } as const;
/** Indici dentro una scintilla: vx0, vy0, decadimento al secondo, colore. */
const S = { vx: 0, vy: 1, decay: 2, color: 3 } as const;
/** Indici dentro un coriandolo: nascita (ms), x0, vx, vy, r0, vr, larghezza, altezza, fase, colore, fine (ms). */
const C = { spawn: 0, x0: 1, vx: 2, vy: 3, r0: 4, vr: 5, w: 6, h: 7, ph: 8, color: 9, end: 10 } as const;

/**
 * Uno spettacolo intero, deciso in anticipo: tabelle piatte di numeri (si copiano al thread UI una sola volta e costano poco),
 * senza stato che cambi da un fotogramma all'altro.
 */
export type Show = {
  readonly width: number;
  readonly height: number;
  /** Quando non c'è più nulla da vedere (ms dall'inizio). */
  readonly durationMs: number;
  readonly rockets: readonly number[];
  readonly sparks: readonly number[];
  readonly confetti: readonly number[];
};

export type ShowOptions = { width: number; height: number; level: number; finale: boolean; reduced: boolean };

/** Scintille di un'esplosione al livello `level`. */
export function sparkCount(level: number, reduced: boolean): number {
  return reduced ? BUDGET.sparkReduced : BUDGET.sparkBase + BUDGET.sparkPerLevel * Math.min(level, MAX_LEVEL);
}

/** Volo di un razzo con la stessa regola dell'originale, fotogramma per fotogramma: dove e dopo quanto esplode. */
function flight(x0: number, y0: number, vx: number, vy0: number, ty: number): { frames: number; x: number; y: number } {
  let x = x0;
  let y = y0;
  let vy = vy0;
  let frames = 0;
  do {
    x += vx * DT;
    y += vy * DT;
    vy += ROCKET.gravity * DT;
    frames++;
  } while (y > ty && vy <= -ROCKET.slowUp && frames < 1200);
  return { frames, x, y };
}

/** Lo spettacolo di un livello. `rand` è la sola fonte di casualità: con lo stesso `rand` lo spettacolo è identico. */
export function makeShow(o: ShowOptions, rand: () => number): Show {
  const L = Math.min(o.level, MAX_LEVEL);
  const windowMs = o.finale ? SHOW_MS.finale : SHOW_MS.normal;
  const rockets: number[] = [];
  const sparks: number[] = [];
  const confetti: number[] = [];
  let durationMs = 0;

  const launch = (launchMs: number) => {
    const x0 = o.width * (ROCKET.xMin + rand() * ROCKET.xSpan);
    const vx = (rand() - 0.5) * ROCKET.vx;
    const vy0 = -(o.height * (ROCKET.vyMin + rand() * ROCKET.vySpan));
    const ty = o.height * (ROCKET.tyMin + rand() * ROCKET.tySpan);
    const f = flight(x0, o.height, vx, vy0, ty);
    const boomMs = launchMs + f.frames * DT * 1000;
    // Esplosione (`explode`): tinta di base a caso; una volta su due le scintille alternano due tinte.
    const n = sparkCount(L, o.reduced);
    const hue = rand() * 360;
    const two = rand() < 0.5;
    const first = sparks.length / SPARK_STRIDE;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      let speed = SPARK.speedMin + rand() * (o.width < SPARK.wideFrom ? SPARK.speedSpanPhone : SPARK.speedSpanWide);
      if (rand() < SPARK.slowChance) speed *= SPARK.slowFactor;
      const h = (two && i % 2 ? hue + SPARK.hueSecond : hue) + rand() * SPARK.hueSpan;
      const bucket = Math.round((((h % 360) + 360) % 360) / (360 / SPARK_HUES)) % SPARK_HUES;
      sparks.push(Math.cos(a) * speed, Math.sin(a) * speed, SPARK.decayMin + rand() * SPARK.decaySpan, SPARK_FIRST + bucket);
    }
    rockets.push(launchMs, x0, o.height, vx, vy0, boomMs, f.x, f.y, first, n);
    durationMs = Math.max(durationMs, boomMs + 1000 / SPARK.decayMin);
  };

  // Lancio (`startFx`, `fwLoop`): all'inizio `2 + ⌊livello/3⌋` razzi (+3 nei finali) e uno subito, poi uno ogni intervallo.
  const initial = 2 + Math.floor(L / 3) + (o.finale ? 3 : 0);
  for (let i = 0; i < initial; i++) launch(0);
  let t = 0;
  while (t < windowMs) {
    launch(t);
    t += (Math.max(0.16, 0.6 - L * 0.045) + rand() * 0.3) * 1000;
  }

  const confetto = (spawnMs: number) => {
    const vy = CONFETTI.vyMin + rand() * CONFETTI.vySpan;
    confetti.push(
      spawnMs,
      rand() * o.width,
      (rand() - 0.5) * CONFETTI.vxSpan,
      vy,
      rand() * Math.PI * 2,
      (rand() - 0.5) * CONFETTI.vrSpan,
      CONFETTI.wMin + rand() * CONFETTI.wSpan,
      CONFETTI.hMin + rand() * CONFETTI.hSpan,
      rand() * Math.PI * 2,
      CONFETTI_FIRST + Math.floor(rand() * CONFETTI.colors.length),
      spawnMs + ((o.height + CONFETTI.exitMargin - CONFETTI.startY) / vy) * 1000,
    );
    durationMs = Math.max(durationMs, confetti[confetti.length - 1]);
  };
  if (!o.reduced) {
    for (let i = 0; i < BUDGET.confettiBase + BUDGET.confettiPerLevel * L; i++) confetto(0);
    for (let i = 0; i < (windowMs / 1000) * BUDGET.confettiPerSecond; i++) confetto((i * 1000) / BUDGET.confettiPerSecond);
  }

  return { width: o.width, height: o.height, durationMs, rockets, sparks, confetti };
}

/** Quanto tempo resta da contare nel prossimo passo: `acc` accumula il tempo reale, `clock` avanza a passi interi di `FRAME_MS`. */
export function advanceClock(clockMs: number, accMs: number, dtMs: number): { clockMs: number; accMs: number } {
  'worklet';
  const acc = accMs + dtMs;
  const steps = Math.floor(acc / FRAME_MS);
  return { clockMs: clockMs + steps * FRAME_MS, accMs: acc - steps * FRAME_MS };
}

type Point = { x: number; y: number };
type Pen<Color> = {
  setColor(color: Color): void;
  setAlphaf(alpha: number): void;
  setStrokeWidth(width: number): void;
  setStrokeCap(cap: number): void;
};

/** La parte della tela di Skia che serve: un lotto di segmenti (coppie di punti) con un solo pennello. */
export type FireworksCanvas<P extends Pen<unknown>> = { drawPoints(mode: number, points: Point[], paint: P): void };
/** Valori delle enumerazioni di Skia (`PointMode.Lines`, `StrokeCap.Round` e `Butt`), passati da chi disegna. */
export type FireworksEnums = { readonly lines: number; readonly round: number; readonly butt: number };

/**
 * Disegna lo spettacolo al tempo `tMs`, a lotti di segmenti con un solo pennello: i coriandoli (come linee spesse con testa
 * piatta, per colore e spessore), i razzi (una scia) e le scintille (per tinta e livello di dissolvenza), nello stesso ordine
 * dell'originale. Le scintille sono segmenti dalla posizione di un passo fa a quella di adesso. Restituisce quante primitive
 * ha disegnato, per i test.
 */
export function drawFireworks<P extends Pen<Color>, Color>(canvas: FireworksCanvas<P>, paint: P, colors: readonly Color[], enums: FireworksEnums, show: Show, tMs: number): { sparks: number; confetti: number; rockets: number; batches: number } {
  'worklet';
  const trailS = FRAME_MS / 1000;
  const out = { sparks: 0, confetti: 0, rockets: 0, batches: 0 };
  const flush = (points: Point[] | undefined, color: number, alpha: number, width: number, cap: number) => {
    if (!points || points.length === 0) return;
    paint.setColor(colors[color]);
    paint.setAlphaf(alpha);
    paint.setStrokeWidth(width);
    paint.setStrokeCap(cap);
    canvas.drawPoints(enums.lines, points, paint);
    out.batches++;
  };

  // Coriandoli: rettangolo w×h ruotato di r e schiacciato di |cos(1,3·fase)| nel verso dell'altezza = segmento lungo w,
  // spesso h·|cos|, centrato sul coriandolo.
  const confettiBuckets: (Point[] | undefined)[] = [];
  const cf = show.confetti;
  for (let i = 0; i < cf.length && out.confetti < BUDGET.maxLiveConfetti; i += CONFETTI_STRIDE) {
    if (tMs < cf[i + C.spawn] || tMs >= cf[i + C.end]) continue;
    const s = (tMs - cf[i + C.spawn]) / 1000;
    const ph = cf[i + C.ph] + CONFETTI.driftRate * s;
    const x = cf[i + C.x0] + cf[i + C.vx] * s + (CONFETTI.driftAmp / CONFETTI.driftRate) * (Math.cos(cf[i + C.ph]) - Math.cos(ph));
    const y = CONFETTI.startY + cf[i + C.vy] * s;
    const thickness = cf[i + C.h] * Math.abs(Math.cos(ph * CONFETTI.squash));
    const level = Math.min(THICKNESS_LEVELS, Math.ceil(thickness / THICKNESS_STEP));
    if (level === 0) continue;
    const r = cf[i + C.r0] + cf[i + C.vr] * s;
    const dx = (Math.cos(r) * cf[i + C.w]) / 2;
    const dy = (Math.sin(r) * cf[i + C.w]) / 2;
    const key = (cf[i + C.color] - CONFETTI_FIRST) * THICKNESS_LEVELS + (level - 1);
    let bucket = confettiBuckets[key];
    if (!bucket) {
      bucket = [];
      confettiBuckets[key] = bucket;
    }
    bucket.push({ x: x - dx, y: y - dy }, { x: x + dx, y: y + dy });
    out.confetti++;
  }
  for (let key = 0; key < confettiBuckets.length; key++) {
    flush(confettiBuckets[key], CONFETTI_FIRST + Math.floor(key / THICKNESS_LEVELS), 1, ((key % THICKNESS_LEVELS) + 1) * THICKNESS_STEP, enums.butt);
  }

  // Razzi in volo: una scia dalla posizione di un passo fa a quella di adesso.
  const rocketPoints: Point[] = [];
  const rk = show.rockets;
  for (let i = 0; i < rk.length; i += ROCKET_STRIDE) {
    if (tMs < rk[i + R.launch] || tMs >= rk[i + R.boom]) continue;
    const s = (tMs - rk[i + R.launch]) / 1000;
    const p = Math.max(s - trailS, 0);
    const pos = (u: number): Point => ({ x: rk[i + R.x0] + rk[i + R.vx] * u, y: rk[i + R.y0] + rk[i + R.vy0] * u + (ROCKET.gravity / 2) * u * (u - DT) });
    rocketPoints.push(pos(p), pos(s));
    out.rockets++;
  }
  flush(rocketPoints, ROCKET_COLOR, 1, ROCKET.width, enums.round);

  // Scintille dall'esplosione: posizione esatta dell'originale a 60 fotogrammi al secondo in forma chiusa (frenata `d^n` e
  // gravità), uguale per tutte le scintille di un'esplosione tranne la velocità iniziale. Le più recenti hanno la precedenza.
  const d = SPARK.damping;
  const sparkBuckets: (Point[] | undefined)[] = [];
  const sp = show.sparks;
  const lifeMs = 1000 / SPARK.decayMin;
  for (let i = rk.length - ROCKET_STRIDE; i >= 0 && out.sparks < BUDGET.maxLiveSparks; i -= ROCKET_STRIDE) {
    const age = tMs - rk[i + R.boom];
    if (age < 0 || age >= lifeMs) continue;
    const s = age / 1000;
    const n = s / DT;
    const nPrev = Math.max(n - trailS / DT, 0);
    // Dopo `steps` passi la scintilla è a `velocità iniziale · a` dal punto di esplosione, più `g` in verticale per la gravità
    // (somma della ricorrenza dell'originale: `v = v·d`, poi `v += gravità·dt`, poi `pos += v·dt`).
    const run = (steps: number) => {
      const pow = Math.pow(d, steps);
      const sum = (d * (1 - pow)) / (1 - d);
      return { a: DT * sum, g: DT * ((SPARK.gravity * DT) / (1 - d)) * (steps - sum) };
    };
    const now = run(n);
    const before = run(nPrev);
    const first = rk[i + R.first];
    const count = rk[i + R.count];
    for (let j = 0; j < count && out.sparks < BUDGET.maxLiveSparks; j++) {
      const k = (first + j) * SPARK_STRIDE;
      const life = 1 - sp[k + S.decay] * s;
      if (life <= 0) continue;
      const level = Math.min(LIFE_LEVELS, Math.max(1, Math.ceil(life * LIFE_LEVELS)));
      const vx = sp[k + S.vx];
      const vy = sp[k + S.vy];
      const key = (sp[k + S.color] - SPARK_FIRST) * LIFE_LEVELS + (level - 1);
      let bucket = sparkBuckets[key];
      if (!bucket) {
        bucket = [];
        sparkBuckets[key] = bucket;
      }
      bucket.push(
        { x: rk[i + R.bx] + vx * before.a, y: rk[i + R.by] + vy * before.a + before.g },
        { x: rk[i + R.bx] + vx * now.a, y: rk[i + R.by] + vy * now.a + now.g },
      );
      out.sparks++;
    }
  }
  for (let key = 0; key < sparkBuckets.length; key++) {
    const alpha = ((key % LIFE_LEVELS) + 1) / LIFE_LEVELS;
    flush(sparkBuckets[key], SPARK_FIRST + Math.floor(key / LIFE_LEVELS), alpha, 2.6 * alpha + 0.6, enums.round);
  }
  return out;
}
