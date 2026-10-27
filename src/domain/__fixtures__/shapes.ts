import type { Cell } from '../types';

/** Griglia `cols × rows` al piano `z`, con passo 1 e spostamento `(ox, oy)`. */
export function grid(cols: number, rows: number, z: number, ox = 0, oy = 0): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out.push({ x: x + ox, y: y + oy, z });
  return out;
}

/** Piramide di 5 piani (6×6, 5×5, 4×4, 3×3, 2×2 = 90 tessere), ogni piano spostato di mezza tessera. */
export function pyramid90(): Cell[] {
  return [6, 5, 4, 3, 2].flatMap((n, z) => grid(n, n, z, z / 2, z / 2));
}
