// Effetti speciali della partita: scintille degli abbinamenti e scritta della combo (`docs/resa-visiva.md`).
// Solo funzioni e costanti pure, senza React, Skia o Reanimated: i componenti `SparkLayer` e `ComboBanner` le disegnano.
// Riferimenti nell'originale ("Majoa Mahjong.html"): `sparkBurst` riga 2082, `burstAt` 2093, `showCombo` 2101.

/** Forme delle scintille: ✨ (scintilla a 4 punte), ⭐ (stella a 5 punte), 💛 (cuore). Nell'app sono vettoriali, non emoji. */
export type SparkKind = 'sparkle' | 'star' | 'heart';

/** Una scintilla: spostamento finale (`dx`, `dy`, già con il sollevamento) e durata. */
export type Particle = { readonly kind: SparkKind; readonly dx: number; readonly dy: number; readonly ms: number };

/** Un'esplosione di scintille attorno a un punto (`x`, `y`) dell'area di gioco. */
export type Burst = { readonly id: number; readonly x: number; readonly y: number; readonly particles: readonly Particle[] };

export type ComboLevel = 1 | 2 | 3 | 4;

/** Lato dell'emoji dell'originale (`.sp`, font-size 18px): le scintille vettoriali stanno nello stesso riquadro. */
export const SPARK_SIZE = 18;
/** Ogni scintilla sale di 18 px oltre allo spostamento casuale (`translate(.., sin·d − 18)`). */
export const SPARK_LIFT = 18;
/** Durata di una scintilla: 600 ms più fino a 350 ms a caso. */
export const SPARK_MIN_MS = 600;
export const SPARK_SPREAD_MS = 350;
export const SPARK_MAX_MS = SPARK_MIN_MS + SPARK_SPREAD_MS;

type BurstKind = { readonly kinds: readonly SparkKind[]; readonly count: number; readonly dist: number };
/** Tessera comune che sparisce: `['✨','⭐'], 4, 46`. */
export const PLAIN_BURST: BurstKind = { kinds: ['sparkle', 'star'], count: 4, dist: 46 };
/** Tessera d'oro che sparisce: `['✨','⭐','💛'], 12, 80`. */
export const GOLD_BURST: BurstKind = { kinds: ['sparkle', 'star', 'heart'], count: 12, dist: 80 };
const COMBO_KINDS: readonly SparkKind[] = ['star', 'sparkle'];

/** Livello massimo della scritta («Incroyable !», «Amazing!», «Incredibile!»): oltre, scritta e scintille non crescono più. */
export const COMBO_MAX_LEVEL = 4;
/** Durata della scritta della combo. */
export const COMBO_BANNER_MS = 1300;
/** Posizione della scritta e centro da cui partono le sue scintille, nell'area di gioco (px dall'alto). */
export const COMBO_BANNER_TOP = 12;
export const COMBO_ORIGIN_Y = 36;

/** Livello della scritta per una combo di `count` (0 = nessuna scritta); oltre il livello 4 resta 4. */
export function comboLevel(count: number): ComboLevel | null {
  return count < 1 ? null : (Math.min(count, COMBO_MAX_LEVEL) as ComboLevel);
}

/** `count` scintille che partono dal centro in direzioni a caso: le forme si alternano, la distanza va da metà a 1,2 volte `dist`. */
export function makeParticles(kinds: readonly SparkKind[], count: number, dist: number, rand: () => number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = (0.5 + rand() * 0.7) * dist;
    out.push({ kind: kinds[i % kinds.length], dx: Math.cos(a) * d, dy: Math.sin(a) * d - SPARK_LIFT, ms: SPARK_MIN_MS + rand() * SPARK_SPREAD_MS });
  }
  return out;
}

/** Scintille di una tessera che sparisce, centrate in (`x`, `y`); più numerose e con i cuori se è d'oro. */
export function tileBurst(id: number, x: number, y: number, gold: boolean, rand: () => number): Burst {
  const k = gold ? GOLD_BURST : PLAIN_BURST;
  return { id, x, y, particles: makeParticles(k.kinds, k.count, k.dist, rand) };
}

/** Scintille della scritta della combo: `5 + 2·livello` scintille a `70 + 12·livello` px. */
export function comboBurst(id: number, x: number, y: number, level: ComboLevel, rand: () => number): Burst {
  return { id, x, y, particles: makeParticles(COMBO_KINDS, 5 + level * 2, 70 + level * 12, rand) };
}

/**
 * Curva `ease-out` di CSS, cubic-bezier(0, 0, .58, 1). Con il primo punto di controllo nell'origine la derivata in 0 è
 * nulla e Newton non converge: si inverte x con la bisezione.
 */
export function easeOut(x: number): number {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 14; i++) {
    t = (lo + hi) / 2;
    const xt = (-0.74 * t + 1.74) * t * t;
    if (xt < x) lo = t;
    else hi = t;
  }
  return (-2 * t + 3) * t * t;
}

/**
 * Stato di una scintilla dopo `elapsedMs` (`sparkBurst`): dal centro, scala 0,6 e opacità 1 fino a `(dx, dy)`, scala 1,15
 * e opacità 0; la stessa curva `ease-out` regola tutto.
 */
export function sparkFrame(p: { readonly dx: number; readonly dy: number; readonly ms: number }, elapsedMs: number) {
  'worklet';
  const e = easeOut(elapsedMs / p.ms);
  return { x: p.dx * e, y: p.dy * e, scale: 0.6 + 0.55 * e, opacity: 1 - e };
}

/**
 * Stato della scritta della combo dopo `elapsedMs` (`showCombo`, `Element.animate` con `duration: 1300`, `ease-out` sull'intera
 * durata): comparsa dall'alto in scala 0,6 → 1,08 (fino al 20%), poi 1,00 fino al 75%, poi dissolvenza con salita di 18 px.
 */
export function bannerFrame(elapsedMs: number) {
  'worklet';
  const u = easeOut(elapsedMs / COMBO_BANNER_MS);
  if (u < 0.2) {
    const k = u / 0.2;
    return { opacity: k, translateY: -26 + 26 * k, scale: 0.6 + 0.48 * k };
  }
  if (u < 0.75) return { opacity: 1, translateY: 0, scale: 1.08 - 0.08 * ((u - 0.2) / 0.55) };
  const k = (u - 0.75) / 0.25;
  return { opacity: 1 - k, translateY: -18 * k, scale: 1 };
}

/** Path SVG delle due stelle a 4 punte sfalsate di 45° che formano la scintilla ✨, centrate in (`cx`, `cy`), di lato `size`. */
export function sparklePathsD(cx: number, cy: number, size: number): readonly [string, string] {
  const r = size / 2;
  const ri = r * 0.38;
  const star4 = (rot: number) => {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? r : ri;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  };
  return [star4(0), star4(Math.PI / 4)];
}

/** Path SVG di un cuore centrato in (`cx`, `cy`), largo `2,4·s` e alto `2·s`. */
export function heartPathD(cx: number, cy: number, s: number): string {
  const p = (x: number, y: number) => `${(cx + x * s).toFixed(1)} ${(cy + y * s).toFixed(1)}`;
  return (
    `M${p(0, -0.35)}C${p(0, -0.78)} ${p(-0.4, -1)} ${p(-0.72, -1)}C${p(-1.12, -1)} ${p(-1.2, -0.6)} ${p(-1.2, -0.35)}` +
    `C${p(-1.2, 0.2)} ${p(-0.35, 0.6)} ${p(0, 1)}C${p(0.35, 0.6)} ${p(1.2, 0.2)} ${p(1.2, -0.35)}` +
    `C${p(1.2, -0.6)} ${p(1.12, -1)} ${p(0.72, -1)}C${p(0.4, -1)} ${p(0, -0.78)} ${p(0, -0.35)}Z`
  );
}

/** Uno strato di una forma: tracciato SVG, colore e, se è un contorno, la larghezza. Solo dati, nessun oggetto di Skia. */
export type GlyphLayer = { readonly d: string; readonly color: string; readonly stroke?: number };

type AlphaPaint = { setAlphaf(alpha: number): void };

/** La parte della tela di Skia che serve a disegnare le scintille: così si prova con una tela finta. */
export type SparkCanvas<Path, Paint extends AlphaPaint> = {
  save(): unknown;
  restore(): void;
  translate(dx: number, dy: number): void;
  scale(sx: number, sy: number): void;
  drawPath(path: Path, paint: Paint): void;
};

/**
 * Disegna un'esplosione al tempo `elapsedMs`: ogni scintilla ancora visibile a posto, in scala e con la sua opacità
 * (`sparkFrame`), strato per strato. Quelle finite non si disegnano. Un'esplosione intera è un solo disegno: non servono un
 * nodo e un valore derivato per scintilla (`docs/rendering.md`: il costo segue i nodi e i mapper).
 */
export function drawSparks<Path, Paint extends AlphaPaint>(
  canvas: SparkCanvas<Path, Paint>,
  glyphs: Record<SparkKind, readonly { readonly path: Path; readonly paint: Paint }[]>,
  burst: Burst,
  elapsedMs: number,
): void {
  'worklet';
  for (let i = 0; i < burst.particles.length; i++) {
    const p = burst.particles[i];
    const f = sparkFrame(p, elapsedMs);
    if (f.opacity <= 0) continue;
    canvas.save();
    canvas.translate(burst.x + f.x, burst.y + f.y);
    canvas.scale(f.scale, f.scale);
    const layers = glyphs[p.kind];
    for (let j = 0; j < layers.length; j++) {
      layers[j].paint.setAlphaf(f.opacity);
      canvas.drawPath(layers[j].path, layers[j].paint);
    }
    canvas.restore();
  }
}
