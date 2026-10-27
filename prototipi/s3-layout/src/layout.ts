export interface GameColumnMetrics {
  windowWidth: number;
  windowHeight: number;
  columnWidth: number;
  columnHeight: number;
  offsetX: number;
  offsetY: number;
  isWideScreen: boolean;
  aspectRatio: number;
}

export interface TileScaleMetrics {
  tileWidth: number;
  tileHeight: number;
  tileDepth: number;
  isCapped: boolean;
}

/**
 * Calcola le dimensioni della Colonna di Gioco in conformità con docs/decisioni-tecniche.md (sez. 5):
 * - Rapporto massimo larghezza/altezza: 3:4 (0.75).
 * - Oltre quel rapporto (tablet orizzontale, schermi larghi, DeX), la colonna si ancora verticalmente al centro.
 * - Tetto massimo assoluto della colonna a 640 dp per mantenere le proporzioni armoniose.
 */
export function computeGameColumn(windowWidth: number, windowHeight: number): GameColumnMetrics {
  const currentRatio = windowWidth / windowHeight;
  const MAX_RATIO = 3 / 4; // 0.75
  const MAX_COLUMN_WIDTH = 640;

  let columnWidth = windowWidth;
  const columnHeight = windowHeight;
  let isWideScreen = false;

  if (currentRatio > MAX_RATIO) {
    isWideScreen = true;
    columnWidth = Math.min(windowHeight * MAX_RATIO, MAX_COLUMN_WIDTH);
  } else {
    columnWidth = Math.min(windowWidth, MAX_COLUMN_WIDTH);
    isWideScreen = columnWidth < windowWidth;
  }

  const offsetX = Math.max(0, (windowWidth - columnWidth) / 2);
  const offsetY = Math.max(0, (windowHeight - columnHeight) / 2);

  return {
    windowWidth,
    windowHeight,
    columnWidth: Math.round(columnWidth),
    columnHeight: Math.round(columnHeight),
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    isWideScreen,
    aspectRatio: columnWidth / columnHeight,
  };
}

/**
 * Calcola la scalatura della tessera garantendo:
 * 1. Proporzioni fedeli (1 : 1.33).
 * 2. Bersaglio di tocco accessibile (almeno 44 dp).
 * 3. Tetto massimo della tessera (per evitare tessere giganti su tablet).
 */
export function computeTileScale(
  columnWidth: number,
  boardCols = 10,
  tileAspectRatio = 1.33,
  minTouchTarget = 44,
  maxTileWidth = 60
): TileScaleMetrics {
  const horizontalPadding = 24;
  const availableWidth = Math.max(100, columnWidth - horizontalPadding);
  const rawTileWidth = availableWidth / Math.max(1, boardCols);

  const isCapped = rawTileWidth > maxTileWidth;
  const tileWidth = Math.max(minTouchTarget, Math.min(rawTileWidth, maxTileWidth));
  const tileHeight = tileWidth * tileAspectRatio;
  const tileDepth = tileWidth * 0.2;

  return {
    tileWidth: Math.round(tileWidth * 10) / 10,
    tileHeight: Math.round(tileHeight * 10) / 10,
    tileDepth: Math.round(tileDepth * 10) / 10,
    isCapped,
  };
}
