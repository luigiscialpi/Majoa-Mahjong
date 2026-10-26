// Esporta dall'HTML originale i 100 livelli come specifiche per il motore (forma e parametri).
// Uso: node tools/export-levels.js "<percorso di Majoa Mahjong.html>" <file di uscita .json>
// Richiede Playwright con Chromium.
const fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const [html, out] = process.argv.slice(2);
if (!html || !out) { console.error('Uso: node tools/export-levels.js "<Majoa Mahjong.html>" <uscita.json>'); process.exit(2); }
const src = fs.readFileSync(html, 'utf8');
const HOOK = "openMap(); window.__x={get ISLANDS(){return ISLANDS},get LEVELS(){return LEVELS},layoutList:layoutList};})();</script>";
const patched = src.replace(/openMap\(\);\s*\}\)\(\);\s*<\/script>/, HOOK);
if (!patched.includes('__x')) throw new Error('gancio non inserito');
(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(patched); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const br = await chromium.launch();
  const pg = await br.newPage();
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/');
  await pg.waitForTimeout(300);
  const data = await pg.evaluate(() => {
    const x = window.__x;
    const islandOf = (n) => x.ISLANDS.find((w) => n >= w.levels[0] && n <= w.levels[1]);
    return x.LEVELS.map((L, i) => {
      const n = i + 1;
      const w = islandOf(n);
      const cells = x.layoutList(n, false).map((t) => ({ x: t.x, y: t.y, z: t.z }));
      return {
        id: n,
        island: w.id,
        local: n - w.levels[0] + 1,
        islandSize: w.levels[1] - w.levels[0] + 1,
        name: L.name,
        cells,
        groupSize: L.group || 2,
        types: L.n,
        poolSize: w.pool.filter((k) => k !== w.starIdx && k !== 26).length,
        hidden: L.hid || [],
        fog: L.fog || 0,
        gold: L.gold || 0,
        aids: { hints: L.hints === undefined ? null : L.hints, shuffles: L.shuf === undefined ? null : L.shuf, undo: L.undo === undefined ? null : L.undo },
        label: L.diff || 0,
        boss: !!L.boss,
      };
    });
  });
  fs.writeFileSync(out, JSON.stringify(data) + '\n');
  console.log('livelli:', data.length, '| isole:', [...new Set(data.map((d) => d.island))].join(','));
  await br.close(); srv.close();
})();
