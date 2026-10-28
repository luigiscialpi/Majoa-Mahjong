// Geometria della tavola sullo schermo: funzioni pure, senza dipendenze da React Native.
// Replica la formula di posizionamento dell'originale (`layout()`, righe 1898-1914 di
// "Majoa Mahjong.html"); la differenza è che qui il tocco si risolve con `hitTest`.
import type { Cell } from './types';

export type Rect = { x: number; y: number; w: number; h: number };
export type Metrics = {
  tw: number;
  th: number;
  cols: number;
  rows: number;
  maxZ: number;
  boardW: number;
  boardH: number;
  originX: number;
  originY: number;
};

/** Scostamento di ogni piano rispetto al precedente (px dell'originale). */
export const LAYER_DX = -4;
export const LAYER_DY = -5;
/** Proporzione altezza/larghezza della tessera. */
export const TILE_RATIO = 1.3;

/** Colonna di gioco: contenitore verticale centrato, rapporto larghezza/altezza al massimo `maxAspect`. */
export function gameColumn(winW: number, winH: number, maxAspect = 3 / 4): Rect {
  const w = Math.min(winW, winH * maxAspect);
  return { x: (winW - w) / 2, y: 0, w, h: winH };
}

/** Dimensioni della tessera e posizione della tavola, perché stia in un'area `areaW × areaH`; `cap` limita la larghezza. */
export function boardMetrics(cells: readonly Cell[], areaW: number, areaH: number, cap = Infinity): Metrics {
  let cols = 0;
  let rows = 0;
  let maxZ = 0;
  for (const t of cells) {
    cols = Math.max(cols, t.x + 1);
    rows = Math.max(rows, t.y + 1);
    maxZ = Math.max(maxZ, t.z);
  }
  const ex = maxZ * -LAYER_DX + 8;
  const ey = maxZ * -LAYER_DY + 8;
  const aw = areaW - 14 - ex;
  const ah = areaH - 10 - ey;
  const tw = Math.min(aw / cols, ah / rows / TILE_RATIO, cap);
  const th = tw * TILE_RATIO;
  const boardW = cols * tw + ex;
  const boardH = rows * th + ey;
  return { tw, th, cols, rows, maxZ, boardW, boardH, originX: (areaW - boardW) / 2, originY: (areaH - boardH) / 2 };
}

/** Rettangolo di una tessera sullo schermo. */
export function tileRect(m: Metrics, t: Cell): Rect {
  return {
    x: m.originX + t.x * m.tw + t.z * LAYER_DX - m.maxZ * LAYER_DX + 4,
    y: m.originY + t.y * m.th + t.z * LAYER_DY - m.maxZ * LAYER_DY + 4,
    w: m.tw - 3,
    h: m.th - 3,
  };
}

function zKey(t: Cell): number {
  return t.z * 1000 + Math.round(t.y * 10) + Math.round(t.x);
}

/** Indici delle tessere in ordine di disegno (dal fondo alla cima), come lo `z-index` dell'originale. */
export function drawOrder(cells: readonly Cell[]): number[] {
  return cells.map((_, i) => i).sort((a, b) => zKey(cells[a]) - zKey(cells[b]) || a - b);
}

/** Tessera più in alto nel punto (px, py), oppure `null`. `tolerance` allarga ogni tessera, in px. */
export function hitTest(
  cells: readonly Cell[],
  m: Metrics,
  px: number,
  py: number,
  tolerance = 0,
  order: readonly number[] = drawOrder(cells),
): number | null {
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    const r = tileRect(m, cells[i]);
    if (px >= r.x - tolerance && px <= r.x + r.w + tolerance && py >= r.y - tolerance && py <= r.y + r.h + tolerance) return i;
  }
  return null;
}

/** Quota dell'area della tessera `i` che resta raggiungibile dal tocco (campionamento a griglia di passo `step` px). */
export function visibleFraction(cells: readonly Cell[], m: Metrics, i: number, step = 1): number {
  const r = tileRect(m, cells[i]);
  const order = drawOrder(cells);
  let hit = 0;
  let total = 0;
  for (let y = r.y + step / 2; y < r.y + r.h; y += step) {
    for (let x = r.x + step / 2; x < r.x + r.w; x += step) {
      total++;
      if (hitTest(cells, m, x, y, 0, order) === i) hit++;
    }
  }
  return total === 0 ? 0 : hit / total;
}
