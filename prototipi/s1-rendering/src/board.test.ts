import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardMetrics, drawOrder, gameColumn, hitTest, isFree, tileRect, visibleFraction, type Tile } from './board.ts';

const level20 = JSON.parse(readFileSync(new URL('./data/level20.json', import.meta.url), 'utf8')) as { tiles: Tile[] };
const tiles = level20.tiles;

test('livello 20 esportato: 96 tessere, 5 piani, disegni validi', () => {
  assert.equal(tiles.length, 96);
  assert.equal(Math.max(...tiles.map((t) => t.z)) + 1, 5);
  assert.ok(tiles.every((t) => Number.isInteger(t.type) && t.type >= 0 && t.type <= 128));
});

test('gameColumn: finestra larga → colonna 3:4 centrata; finestra stretta → intera', () => {
  const wide = gameColumn(1200, 800);
  assert.equal(wide.w, 600);
  assert.equal(wide.x, 300);
  const narrow = gameColumn(360, 780);
  assert.equal(narrow.w, 360);
  assert.equal(narrow.x, 0);
});

test('boardMetrics: tutte le tessere stanno dentro l\'area', () => {
  for (const [w, h] of [[360, 640], [412, 915], [768, 1024]]) {
    const m = boardMetrics(tiles, w, h);
    for (const t of tiles) {
      const r = tileRect(m, t);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h, `fuori area a ${w}x${h}`);
    }
  }
});

test('hitTest: centro di una tessera in cima → quella tessera', () => {
  const m = boardMetrics(tiles, 360, 640);
  const top = tiles.map((t, i) => [t, i] as const).filter(([t]) => t.z === 4);
  assert.ok(top.length > 0);
  for (const [t, i] of top) {
    const r = tileRect(m, t);
    assert.equal(hitTest(tiles, m, r.x + r.w / 2, r.y + r.h / 2), i);
  }
});

test('hitTest: fuori dalla tavola → null', () => {
  const m = boardMetrics(tiles, 360, 640);
  assert.equal(hitTest(tiles, m, -5, -5), null);
});

test('hitTest: tessera coperta, tocco sul bordino scoperto → la tessera sotto', () => {
  const stack: Tile[] = [{ x: 0, y: 0, z: 0, type: 1 }, { x: 0, y: 0, z: 1, type: 2 }];
  const m = boardMetrics(stack, 200, 300);
  const under = tileRect(m, stack[0]);
  const over = tileRect(m, stack[1]);
  const px = under.x + under.w - 1;
  const py = under.y + under.h - 1;
  assert.ok(px > over.x + over.w || py > over.y + over.h, 'il bordino esiste');
  assert.equal(hitTest(stack, m, px, py), 0);
  assert.equal(hitTest(stack, m, over.x + over.w / 2, over.y + over.h / 2), 1);
});

test('drawOrder: i piani alti vengono dopo', () => {
  const order = drawOrder(tiles);
  const zs = order.map((i) => tiles[i].z);
  assert.deepEqual(zs, [...zs].sort((a, b) => a - b));
});

test('visibleFraction: una tessera in cima è raggiungibile al 100%', () => {
  const m = boardMetrics(tiles, 360, 640);
  const i = tiles.findIndex((t) => t.z === 4);
  assert.ok(visibleFraction(tiles, m, i, 2) > 0.99);
});

test('isFree: coperta, chiusa ai lati, libera', () => {
  const row: Tile[] = [
    { x: 0, y: 0, z: 0, type: 1 },
    { x: 1, y: 0, z: 0, type: 1 },
    { x: 2, y: 0, z: 0, type: 1 },
    { x: 1, y: 0, z: 1, type: 1 },
  ];
  assert.equal(isFree(row, 0), true, 'estremo sinistro');
  assert.equal(isFree(row, 1), false, 'coperta dal piano superiore');
  assert.equal(isFree(row, 2), true, 'estremo destro');
  assert.equal(isFree(row, 3), true, 'in cima');
  const closed = row.slice(0, 3);
  assert.equal(isFree(closed, 1), false, 'chiusa a sinistra e a destra');
});

test('livello 20: la maggior parte delle tessere libere è raggiungibile al tocco quasi per intero', () => {
  const m = boardMetrics(tiles, 360, 640);
  const free = tiles.map((_, i) => i).filter((i) => isFree(tiles, i));
  assert.ok(free.length > 0 && free.length < tiles.length);
  for (const i of free) assert.ok(visibleFraction(tiles, m, i, 2) > 0.5, `tessera libera ${i} poco raggiungibile`);
});
