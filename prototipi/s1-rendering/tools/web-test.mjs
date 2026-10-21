// Prova automatica dell'app esportata per il web (cartella dist/) in Chromium headless.
// Verifica: caricamento dei 129 SVG, schermate Tavola e Galleria, tocco (confronto con hitTest del dominio),
// assenza di errori in console. Gli fps misurati qui NON sono rappresentativi di un dispositivo.
// Uso: node tools/web-test.mjs [cartella-output]   (dopo `npm run setup:web` e `npm run web:build`)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { boardMetrics, gameColumn, hitTest, tileRect, visibleFraction } from '../src/board.ts';
import { HEADER_H } from '../src/layout.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dist = new URL('../dist/', import.meta.url).pathname;
const out = process.argv[2] ?? 's1-output';
mkdirSync(out, { recursive: true });
const tiles = JSON.parse(readFileSync(new URL('../src/data/level20.json', import.meta.url), 'utf8')).tiles;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = join(dist, url);
  if (!existsSync(file) || url === '/') file = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const report = [];
for (const [w, h] of [[390, 844], [1280, 800]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  const t0 = Date.now();
  await page.getByTestId('svg-info').filter({ hasText: /\d+\/129/ }).waitFor({ timeout: 60000 });
  const r = { viewport: `${w}x${h}`, svgInfo: await page.getByTestId('svg-info').innerText(), firstLoadMs: Date.now() - t0 };
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `tavola-${w}x${h}.png`) });
  r.boardInfo = await page.getByTestId('board-info').innerText();

  // Geometria attesa (stessa del dominio) e prove di tocco
  const col = gameColumn(w, h);
  const m = boardMetrics(tiles, col.w, Math.max(100, col.h - HEADER_H));
  const toPage = (x, y) => [col.x + x, HEADER_H + y];
  const checks = [];
  const topIdx = tiles.findIndex((t) => t.z === 4);
  const rTop = tileRect(m, tiles[topIdx]);
  const lowIdx = tiles.findIndex((t) => t.z === 0 && visibleFraction(tiles, m, tiles.indexOf(t), 3) < 0.6 && visibleFraction(tiles, m, tiles.indexOf(t), 3) > 0.05);
  const points = [
    ['centro tessera in cima', rTop.x + rTop.w / 2, rTop.y + rTop.h / 2],
    ['fuori dalla tavola', 2, 2],
  ];
  if (lowIdx >= 0) {
    const rl = tileRect(m, tiles[lowIdx]);
    for (let y = rl.y + 1; y < rl.y + rl.h; y += 1) for (let x = rl.x + 1; x < rl.x + rl.w; x += 1) {
      if (hitTest(tiles, m, x, y) === lowIdx) { points.push(['bordino scoperto di una tessera coperta', x, y]); y = Infinity; break; }
    }
  }
  for (const [label, x, y] of points) {
    const expected = hitTest(tiles, m, x, y);
    const [px, py] = toPage(x, y);
    await page.mouse.click(px, py);
    await page.waitForTimeout(250);
    const txt = await page.getByTestId('tap-info').innerText();
    const got = /#(\d+)/.exec(txt);
    checks.push({ label, expected, got: got ? Number(got[1]) : null, ok: (got ? Number(got[1]) : null) === expected, txt });
  }
  r.tapChecks = checks;

  // Animazioni (in web: solo verifica che non vadano in errore; gli fps non sono rappresentativi)
  await page.getByTestId('btn-anima').click();
  await page.waitForTimeout(2500);
  r.fpsAnima = await page.getByTestId('fps').innerText();
  await page.getByTestId('btn-ombre').click();
  await page.waitForTimeout(2500);
  r.fpsAnimaOmbre = await page.getByTestId('fps').innerText();
  await page.getByTestId('btn-entrata').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `entrata-${w}x${h}.png`) });
  await page.waitForTimeout(2000);
  await page.getByTestId('btn-anima').click();
  await page.getByTestId('btn-ombre').click();

  await page.getByTestId('btn-galleria').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, `galleria-${w}x${h}.png`) });
  await page.getByTestId('btn-tavola').click();

  // Equivalenza visiva: la tavola a strati (tutte le tessere nell'immagine) deve apparire come la tavola normale.
  await page.mouse.click(col.x + 2, HEADER_H + 2);
  await page.waitForTimeout(300);
  const clip = { x: col.x, y: HEADER_H, width: col.w, height: Math.max(100, col.h - HEADER_H) };
  const shotNormal = await page.screenshot({ clip });
  await page.getByTestId('btn-strati').click();
  await page.waitForTimeout(2500);
  await page.getByTestId('btn-confronto').click();
  await page.getByTestId('equiv-info').filter({ hasText: /pixel diversi|non riuscito/ }).waitFor({ timeout: 60000 });
  r.equivalence = await page.getByTestId('equiv-info').innerText();
  const shotLayered = await page.screenshot({ clip });
  writeFileSync(join(out, `confronto-normale-${w}x${h}.png`), shotNormal);
  writeFileSync(join(out, `confronto-strati-${w}x${h}.png`), shotLayered);
  r.layeredVsNormalDiffPct = await page.evaluate(async ([a, b]) => {
    const load = async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const [da, db] = await Promise.all([load(a), load(b)]);
    let diff = 0;
    for (let k = 0; k < da.length; k += 4) {
      if (Math.abs(da[k] - db[k]) > 12 || Math.abs(da[k + 1] - db[k + 1]) > 12 || Math.abs(da[k + 2] - db[k + 2]) > 12) diff++;
    }
    return Math.round((diff / (da.length / 4)) * 10000) / 100;
  }, [shotNormal.toString('base64'), shotLayered.toString('base64')]);
  await page.getByTestId('btn-strati').click();

  // Prove automatiche (solo telefono). S1_BENCH=1, 2 (predefinita), 3, 4 oppure all.
  // In web JS e rendering condividono il thread: i valori non sono rappresentativi.
  if (w < 600) {
    const which = process.env.S1_BENCH ?? '2';
    r.bench = {};
    for (const [id, btn] of [['1', 'btn-prova'], ['2', 'btn-prova2'], ['3', 'btn-prova3'], ['4', 'btn-prova4']]) {
      if (which !== id && which !== 'all') continue;
      await page.getByTestId(btn).click();
      await page.getByTestId('bench-result').filter({ hasText: /^in corso/ }).waitFor({ timeout: 20000 });
      if (id === '4') {
        await page.waitForTimeout(7000);
        await page.screenshot({ path: join(out, `partita-${w}x${h}.png`) });
      }
      await page.getByTestId('bench-result').filter({ hasText: /^completata/ }).waitFor({ timeout: 250000 });
      r.bench[id] = (await page.getByTestId('bench-result').innerText()).split('\n').slice(1);
      await page.screenshot({ path: join(out, `prova${id}-${w}x${h}.png`) });
    }
  }
  r.errors = errors;
  report.push(r);
  await page.close();
}
await browser.close();
server.close();
writeFileSync(join(out, 'web-test.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
const bad = report.flatMap((r) => r.tapChecks.filter((c) => !c.ok)).length + report.flatMap((r) => r.errors).length;
process.exit(bad ? 1 : 0);
