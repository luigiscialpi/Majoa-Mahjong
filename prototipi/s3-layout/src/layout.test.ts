import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGameColumn, computeTileScale } from './layout';
const withAppCategory = require('../plugins/withAppCategory');

test('1. Layout Telefono (Pixel 7: 412 x 915)', () => {
  const res = computeGameColumn(412, 915);
  assert.equal(res.columnWidth, 412);
  assert.equal(res.columnHeight, 915);
  assert.equal(res.offsetX, 0);
  assert.equal(res.offsetY, 0);
  assert.equal(res.isWideScreen, false);
});

test('2. Layout Tablet Verticale (Pixel Tablet: 800 x 1280)', () => {
  const res = computeGameColumn(800, 1280);
  // Tetto massimo colonna 640dp
  assert.equal(res.columnWidth, 640);
  assert.equal(res.columnHeight, 1280);
  assert.equal(res.offsetX, 80); // (800 - 640) / 2
  assert.equal(res.isWideScreen, true);
});

test('3. Layout Tablet Orizzontale / Pieghevole aperto (1280 x 800)', () => {
  const res = computeGameColumn(1280, 800);
  // Rapporto 3:4 su altezza 800 = 600dp (entro il tetto 640dp)
  assert.equal(res.columnWidth, 600);
  assert.equal(res.columnHeight, 800);
  assert.equal(res.offsetX, 340); // (1280 - 600) / 2 = 340dp
  assert.equal(res.isWideScreen, true);
  assert.ok(res.columnWidth / res.columnHeight <= 0.75);
});

test('4. Layout Schermo Ultra-Wide / DeX (1920 x 1080)', () => {
  const res = computeGameColumn(1920, 1080);
  assert.equal(res.columnWidth, 640); // Tetto 640dp
  assert.equal(res.offsetX, 640); // (1920 - 640) / 2
  assert.equal(res.isWideScreen, true);
});

test('5. Tetto della tessera (Tile Capping) su colonna larga', () => {
  // Su colonna 640dp con 10 colonne di tessere: (640-24)/10 = 61.6dp
  const scale = computeTileScale(640, 10, 1.33, 44, 60);
  assert.equal(scale.tileWidth, 60);
  assert.equal(scale.isCapped, true, 'Deve applicare il tetto massimo di 60dp');
  assert.equal(scale.tileHeight, Math.round(60 * 1.33 * 10) / 10);
});

test('6. Config Plugin Android: Inietta android:appCategory="game"', () => {
  const mockManifest: any = {
    application: [
      {
        $: {
          'android:name': '.MainApplication',
        },
      },
    ],
  };

  withAppCategory.setAppCategory(mockManifest);
  const appTag = mockManifest.application[0].$;
  assert.equal(appTag['android:appCategory'], 'game');
});
