#!/usr/bin/env node
/*
 * TEST_majoa.js — prove automatiche di "Majoa Mahjong"
 *
 * COME SI USA
 *   node TEST_majoa.js [percorso/mahjong.html] [--quick] [--shots=cartella]
 *
 *   --quick        salta la partita completa dei 20 livelli (circa 1 minuto invece di 4-5)
 *   --levels=a-b   esegue SOLO la partita completa dei livelli da a a b (es. --levels=11-20)
 *   --comfort      con --levels: gioca i livelli in Modalità comoda
 *   --sections=2d,2e  esegue solo le sezioni indicate (la suite completa dura più di 6 minuti)
 *   --shots   salva gli screenshot nella cartella indicata (default /tmp/majoa_shots)
 *
 * REQUISITI
 *   Node 18+, modulo "playwright" installato globalmente e Chromium disponibile
 *   (nell'ambiente di lavoro: /opt/pw-browsers).
 *
 * COSA FA
 *   1. Crea una copia di prova del gioco con un gancio di debug (window.__dbg) in fondo alla IIFE.
 *   2. Apre la copia in Chromium con schermo da telefono e click veri.
 *   3. Controlla: sintassi, lingue, modali delle novità, Annulla dopo rimescolo, stelle e aiuti,
 *      pausa, guida "?", impostazioni ⚙️ (palette, accessibilità, barra tessere, volume, ripristino),
 *      salvataggio e ripresa, larghezza dell'intestazione a 360 px,
 *      e (senza --quick) la vittoria di tutti i 20 livelli. Segnala errori di pagina.
 *   Esce con codice 0 se tutto è passato, 1 altrimenti.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --sections=2d,2e : esegue solo le sezioni indicate (i numeri sono nei commenti «// ---------- 2d. …»)
const SEC = (process.argv.find(a => a.startsWith('--sections=')) || '').split('=')[1];
if (SEC && !process.env.MAJOA_CHILD) {
  const src0 = fs.readFileSync(__filename, 'utf8'), want = SEC.split(',');
  const a0 = src0.search(/^  \/\/ ---------- 2\. lingue ----------$/m), e0 = src0.search(/^  \} \/\/ fine sezioni 2-9$/m);
  const body = src0.slice(a0, e0), parts = body.split(/^(?=  \/\/ ---------- )/m);
  const keep = parts.filter(p => { const m = p.match(/^  \/\/ ---------- (\S+?)\./); return m && want.includes(m[1]); });
  const trimmed = src0.slice(0, a0) + keep.join('') + src0.slice(e0);
  const tmp = '/tmp/majoa_sections_run.js'; fs.writeFileSync(tmp, trimmed);
  try { execSync('node ' + tmp + ' ' + process.argv.slice(2).filter(a => !a.startsWith('--sections=')).map(a => JSON.stringify(a)).join(' '), { stdio: 'inherit', env: Object.assign({}, process.env, { MAJOA_CHILD: '1' }), cwd: process.cwd() }); process.exit(0); }
  catch (e) { process.exit(e.status || 1); }
}

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const COMFORT_RUN = args.includes('--comfort');
const LV = (args.find(a => a.startsWith('--levels=')) || '').split('=')[1];
const LV_RANGE = LV ? LV.split('-').map(Number) : null;
const GAME = path.resolve(args.find(a => !a.startsWith('--')) || 'mahjong.html');
const SHOTS = (args.find(a => a.startsWith('--shots=')) || '--shots=/tmp/majoa_shots').split('=')[1];
const TEST_HTML = '/tmp/majoa_test_copy.html';
fs.mkdirSync(SHOTS, { recursive: true });

const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { pass++; console.log('  ✔ ' + name + (info ? '  [' + info + ']' : '')); }
  else { fail++; console.log('  ✘ ' + name + (info ? '  [' + info + ']' : '')); }
}
function section(t) { console.log('\n== ' + t); }

// ---------- 1. copia di prova con gancio di debug ----------
const src = fs.readFileSync(GAME, 'utf8');
const js = src.split('<script>')[1].split('</script>')[0];
section('Sintassi');
try { new Function(js); check('il JavaScript non ha errori di sintassi', true); }
catch (e) { check('il JavaScript non ha errori di sintassi', false, e.message); process.exit(1); }

const HOOK = "openMap(); window.__dbg={get ISL(){return ISLANDS},get I18N(){return I18N},get TYPES(){return TYPES},get tiles(){return tiles},tap:tap,findMove:findMove,get over(){return over}," +
  "startLevel:startLevel,get unl(){return unl},G:G,get history(){return history},get secs(){return secs}," +
  "get prog(){return prog},get lang(){return lang},get timerOn(){return timerOn},get lv(){return lv},get S(){return S},get aids(){return hintsUsed+undosUsed+shufUsed;},get curCf(){return curCf},get MASC(){return MASCOTS},rescue:rescue,islandEarned:islandEarned,starsMain:starsMain,startPuzzle:startPuzzle,leavePuzzle:leavePuzzle,domColor:domColor,colDist:colDist,sudoSolve:sudoSolve,albumCheck:albumCheck,chalAward:chalAward,get ALBUM(){return ALBUM},albumEarned:albumEarned,get GS(){return GS},get Wn(){return ISLANDS},get puz(){return puz},get curDif(){return curDif},get rescueLeft(){return rescueLeft},forceDead:function(){shufLeft=0;undoLeft=0;rescueLeft=0;history=[];deadCheck();},get cfg(){return cfg},get goldGot(){return goldGot},get goldTotal(){return goldTotal},setGold:function(i){var t=tiles[i];if(!t.gold){t.gold=true;goldTotal++;paintTile(t);showGold();}},get idleMs(){return IDLE_MS},setIdle:function(v){IDLE_MS=v;armIdle();},setSecs:function(v){secs=v;}};\n})();\n</script>";
const patched = src.replace(/openMap\(\);\s*\}\)\(\);\s*<\/script>/, HOOK);
if (!patched.includes('__dbg')) { console.log('Impossibile inserire il gancio di debug: cambia la fine dello script?'); process.exit(1); }
fs.writeFileSync(TEST_HTML, patched);

// Il gioco viene aperto da un piccolo server locale (http://127.0.0.1) e non come file:// :
// l'origine è più simile al link vero e il salvataggio nel browser (localStorage) è affidabile.
const http = require('http');
let GAME_URL = 'file://' + TEST_HTML, server = null;
async function startServer() {
  server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(TEST_HTML)); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  GAME_URL = 'http://127.0.0.1:' + server.address().port + '/';
}

(async () => {
  await startServer();
  const browser = await chromium.launch();
  const mk = async (w = 390, h = 780, init, enter = true) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.errs = [];
    page.on('pageerror', e => page.errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') page.errs.push(m.text()); });
    if (init) await page.addInitScript(init);
    await page.goto(GAME_URL);
    await page.waitForTimeout(500);
    // all'avvio compare la mappa del viaggio: di solito si entra subito nell'Isola degli animali (menu dei livelli)
    if (enter && await page.evaluate(() => document.getElementById('map').classList.contains('show'))) { await page.click('#isl_prologue'); await page.waitForTimeout(250); }
    return page;
  };
  const T = (page, sel) => page.evaluate(s => (document.querySelector(s) || {}).textContent, sel);
  const has = (page, id, cls = 'show') => page.evaluate(([i, c]) => document.getElementById(i).classList.contains(c), [id, cls]);
  const dbg = (page, fn, arg) => page.evaluate(fn, arg);
  const closeIntro = async page => { if (await has(page, 'intro')) await page.click('#bIntroOk'); };
  const clickTile = async (page, idx) => {
    const r = await page.evaluate(k => { const e = window.__dbg.tiles[k].el.getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]; }, idx);
    await page.mouse.click(r[0], r[1]);
  };
  // tocca un punto della tessera che non è coperto da altre (utile per tessere sotto o nascoste)
  const clickExposed = async (page, idx) => {
    const p = await page.evaluate(k => {
      const el = window.__dbg.tiles[k].el, r = el.getBoundingClientRect();
      for (let y = r.bottom - 1; y > r.top; y -= 1.5) for (let x = r.right - 1; x > r.left; x -= 1.5) if (document.elementFromPoint(x, y) === el) return [x, y];
      return [r.left + r.width / 2, r.top + r.height / 2];
    }, idx);
    await page.mouse.click(p[0], p[1]);
  };
  // una mossa può essere una coppia o (livelli Tris) un tris
  // chiude i messaggi di regalo / nuova carta (anche più di uno di fila)
  const dismissGifts = async page => { await page.waitForTimeout(450); for (let i = 0; i < 4; i++) { if (!(await page.evaluate(() => document.getElementById('gift').classList.contains('show')))) break; await page.click('#bGiftOk'); await page.waitForTimeout(550); } };
  const nextMove = page => page.evaluate(() => { const m = window.__dbg.findMove(); return m ? m.map(x => window.__dbg.tiles.indexOf(x)) : null; });
  // gioca fino a n mosse (o fino alla vittoria); aspetta il rimescolo automatico se serve
  const play = async (page, n, delay = 0) => {
    let done = 0;
    for (let i = 0; i < n; i++) {
      if (await dbg(page, () => window.__dbg.over)) return done;
      let m = await nextMove(page);
      if (!m) { await page.waitForTimeout(1700); m = await nextMove(page); if (!m) return done; }
      for (const k of m) await clickTile(page, k);
      done++;
      if (delay) await page.waitForTimeout(delay);
    }
    return done;
  };
  const startLevel = async (page, n, dismiss = true) => {
    await page.evaluate(l => window.__dbg.startLevel(l), n);
    await page.waitForTimeout(450);
    if (dismiss) await closeIntro(page);
    await page.waitForTimeout(1700);
  };
  // imposta i progressi solo se mancano (l'init script viene rieseguito a ogni ricaricamento)
  const unlockAll = () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 20, stars: {}, best: {}, seen: {} })); };

  let page;
  if (!LV_RANGE) {
  // ---------- 2. lingue ----------
  section('Lingue');
  page = await mk();
  check('lingua predefinita = francese', await dbg(page, () => window.__dbg.lang) === 'fr');
  check('sottotitolo del menu in francese', (await T(page, '#menuSub')).includes('Choisis'));
  await page.screenshot({ path: SHOTS + '/menu_fr.png' });
  await page.click('#langs button[data-l="en"]'); await page.waitForTimeout(150);
  check('passando a EN cambiano i testi', (await T(page, '#lblHint')) === 'Hint' && (await T(page, '#menuSub')).includes('Choose'));
  await page.click('#langs button[data-l="it"]'); await page.waitForTimeout(150);
  check('passando a IT cambiano i testi', (await T(page, '#lblHint')) === 'Aiuto' && (await T(page, '.lcard span')) === 'Giada');
  await page.reload(); await page.waitForTimeout(400);
  check('la lingua scelta resta dopo il ricaricamento', await dbg(page, () => window.__dbg.lang) === 'it');
  await page.evaluate(() => localStorage.clear());
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();


  // ---------- 2b. mondi: livelli iniziali, isole e mappa del viaggio ----------
  section('Livelli iniziali, isole e mappa del viaggio');
  page = await mk(390, 780, unlockAll, false);
  check('all\'avvio compare la mappa del viaggio, non il menu', await has(page, 'map') && !(await has(page, 'menu')));
  check('ci sono 7 tappe: livelli iniziali (aperti) + 6 isole (animali bloccata, 5 «presto»)', (await page.evaluate(() => document.querySelectorAll('#mapPath .isl').length)) === 7 && (await page.evaluate(() => document.querySelectorAll('#mapPath .isl.locked').length)) === 6);
  check('i livelli iniziali sono la prima tappa e mostrano le stelle (0/60)', (await T(page, '#mapPath .isl:first-child .islsub')).includes('0/60') && (await page.evaluate(() => document.querySelector('#mapPath .isl').getAttribute('data-id'))) === 'prologue');
  check('l\'isola degli animali dice di finire i livelli iniziali', (await T(page, '#mapPath .isl[data-id="animals"] .islsub')).includes('départ'), await T(page, '#mapPath .isl[data-id="animals"] .islsub'));
  await page.screenshot({ path: SHOTS + '/mappa.png' });
  await page.click('#isl_animals'); await page.waitForTimeout(400);
  check('toccando l\'isola degli animali (ancora bloccata) non si entra', !(await has(page, 'menu')) && await has(page, 'map'));
  await page.click('#isl_sweets'); await page.waitForTimeout(300);
  check('toccando un\'isola «presto» non si entra', !(await has(page, 'menu')) && await has(page, 'map'));
  await page.click('#langsMap button[data-l="it"]'); await page.waitForTimeout(200);
  check('dalla mappa si cambia lingua', (await T(page, '#mapTitle')) === 'Il viaggio' && (await page.evaluate(() => document.getElementById('isl_prologue').getAttribute('aria-label'))).includes('Livelli iniziali'));
  await page.click('#langsMap button[data-l="fr"]'); await page.waitForTimeout(200);
  await page.click('#isl_prologue'); await page.waitForTimeout(300);
  check('toccando i livelli iniziali si apre il menu dei 20 livelli', await has(page, 'menu') && (await page.evaluate(() => document.querySelectorAll('#grid .lcard').length)) === 20);
  check('il menu mostra il nome del mondo', (await T(page, '#islTitle')).includes('départ'), await T(page, '#islTitle'));
  await page.screenshot({ path: SHOTS + '/livelli_iniziali.png' });
  await page.click('#bMapBack'); await page.waitForTimeout(250);
  check('il pulsante «Les îles» riporta alla mappa', await has(page, 'map') && !(await has(page, 'menu')));
  await page.click('#isl_prologue'); await page.waitForTimeout(250);
  await page.evaluate(() => window.__dbg.startLevel(3)); await page.waitForTimeout(600);
  await closeIntro(page);
  check('iniziando un livello mappa e menu spariscono', !(await has(page, 'map')) && !(await has(page, 'menu')));
  await page.click('#bLevel'); await page.waitForTimeout(250);
  check('durante la partita il pulsante del livello apre il menu (non la mappa)', await has(page, 'menu') && !(await has(page, 'map')));
  await page.click('#bMapBack'); await page.waitForTimeout(250);
  check('dalla partita si può aprire la mappa e chiuderla con ✕', await has(page, 'map') && (await page.evaluate(() => getComputedStyle(document.getElementById('mapClose')).display)) !== 'none');
  await page.click('#mapClose'); await page.waitForTimeout(300);
  check('chiusa la mappa si torna alla partita e il tempo riparte', !(await has(page, 'map')) && await dbg(page, () => window.__dbg.timerOn));
  // gruppi di tessere: i livelli iniziali usano i 30 tipi originali (nessun nuovo animale); l'Isola degli animali solo animali + stella
  let badInit = 0, badIsl = 0; const seenNew = new Set();
  for (let L = 1; L <= 40; L++) {
    const r = await page.evaluate(l => { window.__dbg.startLevel(l); const ty = [...new Set(window.__dbg.tiles.map(t => t.type))]; const pool = window.__dbg.ISL[l <= 20 ? 0 : 1].pool; return { bad: ty.filter(x => !pool.includes(x)), ty, l }; }, L);
    if (L <= 20) badInit += r.bad.length + r.ty.filter(x => x >= 30).length; else badIsl += r.bad.length;
    r.ty.forEach(x => { if (x >= 30 && L > 20) seenNew.add(x); });
  }
  check('livelli 1-20 (iniziali): solo i 30 tipi originali, nessun nuovo animale', badInit === 0, 'fuori gruppo: ' + badInit);
  check('livelli 21-40 (Isola degli animali): solo animali e stella, nessuna lettera/numero/sole/luna/mare', badIsl === 0, 'fuori gruppo: ' + badIsl);
  for (let k = 0; k < 14; k++) await page.evaluate(() => { window.__dbg.startLevel(26); window.__dbg.tiles.forEach(t => { if (t.type >= 30) window.__seen = (window.__seen || new Set()).add(t.type); }); });
  const seen2 = await page.evaluate(() => [...(window.__seen || [])].sort((a, b) => a - b));
  check('sull\'isola compaiono tutti i 10 nuovi animali (cani, gatti di razza, pappagalli)', [30, 31, 32, 33, 34, 35, 36, 37, 38, 39].every(x => seen2.includes(x) || seenNew.has(x)), 'visti: ' + seen2.join(','));
  const missing = await page.evaluate(() => { const out = []; for (const lg of ['fr', 'en', 'it']) for (const i of window.__dbg.ISL[1].pool.concat(window.__dbg.ISL[0].pool)) { const n = (window.__dbg.I18N[lg].tn || [])[i]; if (!n || typeof n !== 'string') out.push(lg + ':' + i); } return out; });
  check('ogni tessera ha il nome in francese, inglese e italiano', missing.length === 0, missing.join(' '));
  await page.evaluate(() => { const T = window.__dbg.TYPES; document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); const w = document.createElement('div'); w.id = 'sheet'; w.style.cssText = 'position:fixed;inset:0;background:#1f6b57;z-index:99999;display:flex;flex-wrap:wrap;gap:10px;padding:10px;align-content:flex-start'; [30, 31, 32, 33, 34, 35, 36, 37, 38, 39].forEach(i => { const d = document.createElement('div'); d.style.cssText = 'width:112px;height:146px;background:linear-gradient(145deg,#fffdf3,#eadcb4);border-radius:12px;padding:5px'; d.innerHTML = '<svg viewBox="0 0 60 80" style="width:100%;height:100%">' + T[i] + '</svg>'; w.appendChild(d); }); document.body.appendChild(w); });
  await page.screenshot({ path: SHOTS + '/nuovi_animali.png' });
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  // finiti i livelli iniziali l'isola degli animali si apre
  page = await mk(390, 780, () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 21, stars: { 20: 2 }, best: {}, seen: { 1: 1, 3: 1, 4: 1, 8: 1, 11: 1, 13: 1, 16: 1, 19: 1 }, revealed: { animals: true } })); }, false);
  check('con i livelli iniziali finiti l\'isola degli animali è aperta (mostra le stelle)', !(await page.evaluate(() => document.getElementById('isl_animals').closest('.isl').classList.contains('locked'))) && (await T(page, '#mapPath .isl[data-id="animals"] .islsub')).includes('/60'));
  await page.click('#isl_animals'); await page.waitForTimeout(300);
  check('toccandola si apre il menu dell\'isola con 20 livelli numerati da 1', await has(page, 'menu') && (await page.evaluate(() => document.querySelectorAll('#grid .lcard').length)) === 20 && (await T(page, '#grid .lcard b')) === '1' && (await T(page, '#islTitle')).includes('animaux'), await T(page, '#islTitle'));
  await page.screenshot({ path: SHOTS + '/isola_animali.png' });
  check('il livello 1 dell\'isola è aperto (si prosegue dal 20)', !(await page.evaluate(() => document.querySelector('#grid .lcard').classList.contains('locked'))));
  await page.evaluate(() => window.__dbg.startLevel(24)); await page.waitForTimeout(500);
  check('un livello dell\'isola mostra il numero dell\'isola (Niv. 4) e l\'icona 🐾', (await T(page, '#lvNum')) === 'Niv. 4' && (await T(page, '#lvName')).includes('🐾'), (await T(page, '#lvNum')) + ' / ' + (await T(page, '#lvName')));
  check('e non mostra le modali delle novità già viste nei livelli iniziali', !(await has(page, 'intro')));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  // un salvataggio vecchio con lettere/numeri (tipi 12-15) si riprende lo stesso
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 5);
  await play(page, 2, 150); await page.waitForTimeout(400);
  await page.reload(); await page.waitForTimeout(600);
  // l'uscita dalla pagina salva la partita: si modifica il salvataggio DOPO il ricaricamento e si ricostruisce la mappa
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mj_save1')); s.t = s.t.map(r => [12 + (r[0] % 4), r[1], r[2]]); localStorage.setItem('mj_save1', JSON.stringify(s)); });
  await page.click('#langsMap button[data-l="fr"]'); await page.waitForTimeout(300);
  check('la mappa propone di riprendere la partita', await page.evaluate(() => !!document.querySelector('#resumeBoxMap .resumebtn')));
  await page.click('#resumeBoxMap .resumebtn'); await page.waitForTimeout(700);
  const oldT = await dbg(page, () => ({ t0: window.__dbg.tiles[0].type, all: [...new Set(window.__dbg.tiles.filter(x => !x.gone).map(x => x.type))].join(','), n: window.__dbg.tiles.length }));
  check('un vecchio salvataggio con lettere e numeri si apre senza errori', oldT.t0 >= 12 && oldT.t0 <= 15 && page.errs.length === 0, JSON.stringify(oldT) + ' ' + page.errs.join(' | '));
  await page.context().close();
  // vittoria del livello 20: fine dei livelli iniziali → il viaggio
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 20);
  await play(page, 250, 0); await page.waitForTimeout(900);
  check('livello 20 vinto: il messaggio parla dei livelli iniziali finiti', (await T(page, '#winTitle')).includes('départ'), await T(page, '#winTitle'));
  check('il pulsante porta al viaggio (🗺️)', (await T(page, '#bNext')).includes('🗺️'), await T(page, '#bNext'));
  await page.click('#bNext'); await page.waitForTimeout(500);
  check('la mappa si apre e l\'Isola degli animali è ora aperta', await has(page, 'map') && !(await page.evaluate(() => document.getElementById('isl_animals').closest('.isl').classList.contains('locked'))));
  await page.screenshot({ path: SHOTS + '/mappa_dopo_prologo.png' });
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2c. Isola degli animali: forme nuove, tessere d'oro, combo ed effetti ----------
  section('Isola: forme nuove, tessere d\'oro, combo, effetti');
  page = await mk(390, 780, () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: {}, best: {}, seen: { 23: 1, 33: 1 }, revealed: { animals: true } })); }, false);
  await page.click('#isl_animals'); await page.waitForTimeout(300);
  const expN = [16, 22, 18, 18, 24, 34, 20, 30, 26, 24, 32, 32, 28, 36, 44, 34, 50, 66, 70, 78];
  const shape = [];
  for (let k = 1; k <= 20; k++) {
    const r = await page.evaluate(l => { window.__dbg.startLevel(l); const T = window.__dbg.tiles; const key = new Set(T.map(t => t.x + ',' + t.y + ',' + t.z)); const dup = T.length - key.size; const unsup = T.filter(t => t.z > 0 && !key.has(t.x + ',' + t.y + ',' + (t.z - 1))).length;
      return { n: T.length, cols: Math.max(...T.map(t => t.x)) + 1, rows: Math.max(...T.map(t => t.y)) + 1, zs: Math.max(...T.map(t => t.z)) + 1, dup, unsup, gold: T.filter(t => t.gold).length, cfgGold: window.__dbg.cfg.gold, w: Math.round(T[0].el.getBoundingClientRect().width), mv: !!window.__dbg.findMove() }; }, 20 + k);
    await page.waitForTimeout(80);
    shape.push(k + ':' + r.n + 't/' + r.cols + 'x' + r.rows + '/p' + r.zs + '/o' + r.gold);
    check('isola livello ' + k + ': forma valida (' + expN[k - 1] + ' tessere, ≤5×6, nessun doppione, tutte appoggiate), tessere d\'oro e una mossa subito', r.n === expN[k - 1] && r.cols <= 5 && r.rows <= 6 && r.dup === 0 && r.unsup === 0 && r.gold === r.cfgGold && r.mv, JSON.stringify(r));
  }
  console.log('   forme: ' + shape.join(' | '));
  await page.evaluate(() => { document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); });
  // menu dell'isola: difficoltà e boss
  await page.evaluate(() => { document.getElementById('bLevel').click(); }); await page.waitForTimeout(300);
  check('le 20 carte dell\'isola mostrano la difficoltà (●●○○○)', (await page.evaluate(() => document.querySelectorAll('#grid .lcard i.dif').length)) === 20);
  check('i livelli boss (5, 10, 15, 20) hanno la corona 👑', (await page.evaluate(() => [...document.querySelectorAll('#grid .lcard')].map((c, i) => c.querySelector('u.bossb') ? i + 1 : 0).filter(Boolean).join(','))) === '5,10,15,20');
  await page.screenshot({ path: SHOTS + '/isola_menu_difficolta.png' });
  // tessere d'oro: partita su un livello con 2 tessere d'oro
  await page.evaluate(() => window.__dbg.startLevel(26)); await page.waitForTimeout(1700);
  check('livello 6 dell\'isola: la barra dell\'oro compare con le tessere d\'oro', (await page.evaluate(() => getComputedStyle(document.getElementById('goldBar')).display)) === 'flex' && (await T(page, '#goldIcons')).includes('◌'), await T(page, '#goldIcons'));
  check('le tessere d\'oro sono dorate e hanno il ✨', (await page.evaluate(() => document.querySelectorAll('.tile.gold .gem').length)) === 2);
  await page.screenshot({ path: SHOTS + '/oro_barra.png' });
  const mvg = await nextMove(page);
  await page.evaluate(i => window.__dbg.setGold(i), mvg[0]);   // si rende d'oro una delle due tessere della prossima mossa
  const gotBefore = await dbg(page, () => window.__dbg.goldGot);
  await clickTile(page, mvg[0]); await clickTile(page, mvg[1]); await page.waitForTimeout(250);
  check('abbinando una tessera d\'oro il conteggio sale', (await dbg(page, () => window.__dbg.goldGot)) === gotBefore + 1);
  check('la barra dell\'oro si aggiorna (✨ in più)', (await T(page, '#goldIcons')).split('✨').length - 1 === gotBefore + 1, await T(page, '#goldIcons'));
  check('partono le scintille (effetti attivi)', (await page.evaluate(() => document.querySelectorAll('#fxLayer .sp').length)) > 0);
  await page.screenshot({ path: SHOTS + '/oro_scintille.png' });
  // Annulla restituisce l'oro
  await page.click('#bUndo'); await page.waitForTimeout(250);
  check('Annulla restituisce la tessera d\'oro', (await dbg(page, () => window.__dbg.goldGot)) === gotBefore);
  await clickTile(page, mvg[0]); await clickTile(page, mvg[1]); await page.waitForTimeout(200);
  // combo: due coppie di fila, subito
  const mvc2 = await nextMove(page); await clickTile(page, mvc2[0]); await clickTile(page, mvc2[1]); await page.waitForTimeout(200);
  check('due coppie ravvicinate fanno comparire la scritta della combo', /Bien|Super|Génial|Incroyable/.test(await T(page, '#combo')), await T(page, '#combo'));
  await page.screenshot({ path: SHOTS + '/combo.png' });
  // salvataggio e ripresa mantengono l'oro raccolto
  const gSave = await dbg(page, () => ({ got: window.__dbg.goldGot, tot: window.__dbg.goldTotal }));
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#resumeBoxMap .resumebtn'); await page.waitForTimeout(700);
  const gRes = await dbg(page, () => ({ got: window.__dbg.goldGot, tot: window.__dbg.goldTotal }));
  check('dopo il ricaricamento l\'oro raccolto è lo stesso', gRes.got === gSave.got && gRes.tot === gSave.tot && gRes.tot > 0, JSON.stringify(gSave) + ' → ' + JSON.stringify(gRes));
  // effetti spenti dalle impostazioni
  await page.click('#bSettings'); await page.waitForTimeout(250);
  await page.click('#setBody .srow[data-k="fx"] .sw'); await page.waitForTimeout(150);
  await page.click('#bSetOk'); await page.waitForTimeout(200);
  check('con «effetti speciali» spenti il corpo ha la classe nofx', await page.evaluate(() => document.body.classList.contains('nofx')));
  await page.evaluate(() => { document.getElementById('fxLayer').innerHTML = ''; });
  const mvf = await nextMove(page); await clickTile(page, mvf[0]); await clickTile(page, mvf[1]); await page.waitForTimeout(200);
  check('e non partono scintille', (await page.evaluate(() => document.querySelectorAll('#fxLayer .sp').length)) === 0);
  // vittoria: la scheda mostra le tessere d'oro
  await play(page, 250, 0); await page.waitForTimeout(900);
  check('a fine livello la scheda mostra le tessere d\'oro raccolte', (await T(page, '#winInfo')).includes('✨'), (await T(page, '#winInfo')).replace(/\s+/g, ' '));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  // modale delle novità del livello 23
  page = await mk(390, 780, () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: {}, best: {}, seen: {}, revealed: { animals: true } })); }, false);
  await page.click('#isl_animals'); await page.waitForTimeout(250);
  await page.evaluate(() => window.__dbg.startLevel(23)); await page.waitForTimeout(500);
  check('al livello 3 dell\'isola compare la modale «Tuiles d\'or et combos»', await has(page, 'intro') && (await T(page, '#introTitle')).includes('or'), await T(page, '#introTitle'));
  await page.screenshot({ path: SHOTS + '/intro_oro.png' });
  await page.click('#bIntroOk'); await page.waitForTimeout(300);
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2d. nebbia, difficoltà, mappa con punti, gettoni ----------
  section('Nebbia, difficoltà, mappa con nebbia e punti, gettoni');
  const initIsl = () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: {}, best: {}, seen: { 23: 1, 33: 1 }, revealed: { animals: true } })); };
  page = await mk(390, 780, initIsl, false);
  check('nuovo giocatore: 3 ✨ di regalo e mappa con la nebbia sulle isole future', (await T(page, '#mapCoins')) === '✨ 3' && (await page.evaluate(() => document.querySelectorAll('#mapPath .isl.fogged').length)) === 5, await T(page, '#mapCoins'));
  check('un\'isola nebbiosa nasconde nome e icona e mostra i punti per scoprirla', (await T(page, '#mapPath .isl[data-id="sweets"] .islname')).length > 0 && (await T(page, '#mapPath .isl[data-id="sweets"] .islsub')).includes('précédente') && (await T(page, '#mapPath .isl[data-id="sweets"] .islbtn')) === '🌫️', await T(page, '#mapPath .isl[data-id="sweets"] .islsub'));
  await page.screenshot({ path: SHOTS + '/mappa_nebbia.png' });
  await page.click('#isl_animals'); await page.waitForTimeout(300);
  // livello 13 dell'isola (id 33): 4 tessere nebbiose
  await page.evaluate(() => window.__dbg.startLevel(33)); await page.waitForTimeout(1700);
  const fog0 = await page.evaluate(() => { const T = window.__dbg.tiles; const f = T.filter(t => t.fogOn); return { n: f.length, dom: document.querySelectorAll('.tile.fog').length, blocked: f.every(t => t.el.classList.contains('blocked') || true) }; });
  check('livello 13 dell\'isola: 4 tessere nebbiose coperte', fog0.n === 4 && fog0.dom === 4, JSON.stringify(fog0));
  await page.screenshot({ path: SHOTS + '/nebbia_tessere.png' });
  let minFog = fog0.n, moves = 0;
  while (moves < 120 && !(await dbg(page, () => window.__dbg.over))) {
    const m = await nextMove(page); if (!m) { await page.waitForTimeout(1500); continue; }
    for (const k of m) await clickTile(page, k); moves++;
    minFog = Math.min(minFog, await dbg(page, () => window.__dbg.tiles.filter(t => t.fogOn).length));
  }
  check('giocando la nebbia si dirada: le tessere si scoprono quando diventano libere', minFog === 0 && (await dbg(page, () => window.__dbg.over)), 'nebbiose rimaste: ' + minFog);
  await page.waitForTimeout(800);
  const coinsAfter = await dbg(page, () => window.__dbg.prog.coins);
  check('vincendo si guadagnano ✨ e la scheda lo dice', (await T(page, '#winInfo')).includes('🎁') && coinsAfter > 3, (await T(page, '#winInfo')).replace(/\s+/g, ' ') + ' → ' + coinsAfter);
  await page.screenshot({ path: SHOTS + '/vittoria_gettoni.png' });
  await page.click('#bMenu'); await page.waitForTimeout(300);
  // difficoltà: aiuti, tipi di disegno, scurimento, rimescoli
  const readDif = async (d) => {
    await page.evaluate(() => { document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); });
    await page.evaluate(i => { const s = JSON.parse(localStorage.getItem('mj_set1') || '{}'); s.dif = i; localStorage.setItem('mj_set1', JSON.stringify(s)); window.__dbg.S.dif = i; }, d);
    await page.evaluate(() => window.__dbg.startLevel(6)); await page.waitForTimeout(250);
    return page.evaluate(() => ({ h: document.getElementById('cHint').textContent, u: document.getElementById('cUndo').textContent, sh: document.getElementById('cShuf').textContent, types: new Set(window.__dbg.tiles.map(t => t.type)).size, nodim: document.getElementById('board').classList.contains('nodim'), nodim2: document.getElementById('board').classList.contains('nodim2'), nodim3: document.getElementById('board').classList.contains('nodim3'), resc: window.__dbg.rescueLeft, dif: window.__dbg.curDif }));
  };
  const exp = [
    { d: 0, h: '10', sh: '6', u: '∞', types: 14, nodim: false, resc: null },
    { d: 1, h: '5', sh: '3', u: '∞', types: 16, nodim: false, resc: null },
    { d: 2, h: '4', sh: '2', u: '10', types: 17, nodim: false, resc: 3 },
    { d: 3, h: '3', sh: '2', u: '6', types: 18, nodim: true, resc: 2 },
    { d: 4, h: '1', sh: '1', u: '3', types: 19, nodim: true, nodim2: true, resc: 1 },
    { d: 5, h: '0', sh: '1', u: '0', types: 21, nodim: true, nodim3: true, resc: 0 }
  ];
  const diffNames = ['Facile', 'Normal', 'Moyen', 'Difficile', 'Expert', 'Maître'];
  for (const e of exp) {
    const r = await readDif(e.d);
    const ok = r.h === e.h && r.sh === e.sh && r.u === e.u && r.types === e.types && r.nodim === e.nodim && (!!r.nodim2) === (!!e.nodim2) && (!!r.nodim3) === (!!e.nodim3) && r.resc === e.resc && r.dif === e.d;
    check('difficoltà ' + e.d + ' (livello 6): aiuti, rimescoli, annulla, tipi di disegno, scurimento, rimescoli automatici', ok, JSON.stringify(r));
  }
  await readDif(1);
  check('Normale = il gioco di sempre (aiuti 5/3/∞, 16 tipi)', (await page.evaluate(() => document.getElementById('cHint').textContent + '/' + document.getElementById('cShuf').textContent + '/' + document.getElementById('cUndo').textContent)) === '5/3/∞');
  // impostazioni: sei difficoltà in elenco
  await page.evaluate(() => document.getElementById('bSettings').click()); await page.waitForTimeout(300);
  check('in Impostazioni ci sono le 6 difficoltà (Facile … Maestro)', (await page.evaluate(() => [...document.querySelectorAll('#setBody .difbtn b')].map(b => b.textContent).join(','))) === diffNames.join(','), await page.evaluate(() => [...document.querySelectorAll('#setBody .difbtn b')].map(b => b.textContent).join(',')));
  await page.click('#setBody .difbtn[data-d="3"]'); await page.waitForTimeout(150);
  check('si sceglie con un tocco e resta salvata', (await dbg(page, () => window.__dbg.S.dif)) === 3 && (await page.evaluate(() => JSON.parse(localStorage.getItem('mj_set1')).dif)) === 3);
  await page.screenshot({ path: SHOTS + '/difficolta.png' });
  await page.evaluate(() => document.getElementById('bSetOk').click());
  // blocco: nessuna mossa e nessun aiuto
  await page.evaluate(() => window.__dbg.startLevel(2)); await page.waitForTimeout(300);
  await page.evaluate(() => window.__dbg.forceDead()); await page.waitForTimeout(300);
  check('senza mosse né aiuti compare «Bloccato!» con Ricomincia', await has(page, 'dead') && (await T(page, '#deadTitle')).length > 0, await T(page, '#deadTitle'));
  await page.screenshot({ path: SHOTS + '/bloccato.png' });
  await page.click('#bDeadRestart'); await page.waitForTimeout(400);
  check('Ricomincia riparte dal livello', !(await has(page, 'dead')) && (await dbg(page, () => window.__dbg.lv)) === 2);
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  // modalità comoda: niente nebbia e difficoltà ignorata
  page = await mk(390, 780, () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: {}, best: {}, seen: { 23: 1, 33: 1 }, revealed: { animals: true } })); localStorage.setItem('mj_set1', JSON.stringify({ cf: 1, dif: 5 })); }, false);
  await page.click('#isl_animals'); await page.waitForTimeout(250);
  await page.evaluate(() => window.__dbg.startLevel(37)); await page.waitForTimeout(500);
  check('in Modalità comoda niente nebbia e la difficoltà è ignorata (aiuti ∞)', (await dbg(page, () => window.__dbg.tiles.filter(t => t.fogOn).length)) === 0 && (await T(page, '#cHint')) === '∞' && (await dbg(page, () => window.__dbg.curDif)) === 1);
  await page.context().close();
  // punti per scoprire le isole + regalo
  const stars34 = {}; for (let i = 1; i <= 34; i++) stars34[i] = 3; stars34[40] = 1;
  page = await mk(390, 780, null, false);
  await page.evaluate(s => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: s, best: {}, seen: {}, revealed: { animals: true }, coins: 4 })); }, stars34);
  await page.reload(); await page.waitForTimeout(1900);
  check('con 80 punti ★ l\'isola dei dolci si svela con un regalo', await has(page, 'gift') && (await T(page, '#giftText')).includes('+5'), await T(page, '#giftText'));
  await page.screenshot({ path: SHOTS + '/regalo_isola.png' });
  await page.click('#bGiftOk'); await page.waitForTimeout(300);
  check('il regalo si prende una volta sola: +5 ✨ e l\'isola ora è aperta con le sue stelle (0/30)', (await dbg(page, () => window.__dbg.prog.coins)) === 9 && (await page.evaluate(() => !document.querySelector('#mapPath .isl[data-id="sweets"]').classList.contains('fogged'))) && (await T(page, '#mapPath .isl[data-id="sweets"] .islsub')).includes('/30'), await T(page, '#mapPath .isl[data-id="sweets"] .islsub'));
  await page.reload(); await page.waitForTimeout(1500);
  check('ricaricando il regalo non si ripete', !(await has(page, 'gift')) && (await dbg(page, () => window.__dbg.prog.coins)) === 9);
  check('le altre isole restano nella nebbia (arte: prima va finita l\'isola dei dolci)', (await T(page, '#mapPath .isl[data-id="art"] .islsub')).includes('précédente'), await T(page, '#mapPath .isl[data-id="art"] .islsub'));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  // migrazione: un vecchio salvataggio senza gettoni riceve 3 + stelle + oro
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 5, stars: { 1: 3, 2: 2, 3: 1 }, best: {}, seen: {}, gold: { 26: 2 } })); });
  await page.reload(); await page.waitForTimeout(600);
  check('vecchi progressi: gettoni = 3 + 6 stelle + 2 oro = 11', (await T(page, '#mapCoins')) === '✨ 11', await T(page, '#mapCoins'));
  await page.context().close();

  // ---------- 2e. sala dei rompicapo (3 giochi, si pagano con i ✨) ----------
  section('Rompicapi: Memory, Pezzo mancante, Sudoku');
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 1, stars: {}, best: {}, seen: {}, revealed: {}, coins: 3, pzSeen: { memory: 1, missing: 1, sudoku: 1, slide: 1, maze: 1, diff: 1, jars: 1, pairs: 1, words: 1, dots: 1 } })); });
  await page.reload(); await page.waitForTimeout(600);
  check('dalla mappa, fin dall\'inizio, c\'è il pulsante dei rompicapi', await page.evaluate(() => getComputedStyle(document.getElementById('bBonus')).display) !== 'none');
  await page.click('#bBonus'); await page.waitForTimeout(300);
  check('la sala mostra i rompicapi (10 giochi × 3 livelli) e i ✨', (await page.evaluate(() => document.querySelectorAll('#bonusList .pcard[data-k]:not([data-k="tris"])').length)) === 10 && (await page.evaluate(() => document.querySelectorAll('#bonusList .pbtn[data-r]').length)) === 30 && (await T(page, '#bonusCoins')) === '✨ 3');
  await page.screenshot({ path: SHOTS + '/sala_rompicapi.png' });
  const coinsNow = () => dbg(page, () => window.__dbg.prog.coins);
  const btn = (k, r) => '#bonusList .pcard[data-k="' + k + '"] .pbtn[data-r="' + r + '"]';
  // uscire senza muovere restituisce il ✨
  await page.click(btn('memory', 1)); await page.waitForTimeout(300);
  check('iniziare un rompicapo costa 1 ✨', (await coinsNow()) === 2 && await has(page, 'puz'));
  await page.click('#puzBack'); await page.waitForTimeout(300);
  check('uscendo senza giocare il ✨ torna indietro', (await coinsNow()) === 3 && !(await has(page, 'puz')));
  // MEMORY facile: si risolve toccando le coppie
  await page.click(btn('memory', 1)); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/memory.png' });
  const mem = await dbg(page, () => window.__dbg.puz.cards);
  check('Memory facile: 12 carte (6 coppie)', mem.length === 12);
  const seenM = {}; mem.forEach((t, i) => { (seenM[t] = seenM[t] || []).push(i); });
  const memClick = async i => { await page.evaluate(k => document.querySelectorAll('#puzBody .mcard')[k].click(), i); };
  // un errore apposta
  const keysM = Object.keys(seenM);
  await memClick(seenM[keysM[0]][0]); await memClick(seenM[keysM[1]][0]); await page.waitForTimeout(1000);
  check('due carte diverse si rigirano e contano come tentativo', (await dbg(page, () => window.__dbg.puz.moves)) === 1 && (await page.evaluate(() => document.querySelectorAll('#puzBody .mcard.up').length)) === 0);
  for (const k of keysM) { await memClick(seenM[k][0]); await memClick(seenM[k][1]); await page.waitForTimeout(450); }
  await page.waitForTimeout(1200);
  check('risolto il Memory compare il premio: prima vittoria +2 ✨', await has(page, 'gift') && (await T(page, '#giftText')).includes('+2'), await T(page, '#giftText'));
  await page.screenshot({ path: SHOTS + '/rompicapo_premio.png' });
  await dismissGifts(page);
  check('tornati nella sala: ✨ 3 − 1 + 2 = 4 e le stelle sul pulsante', (await coinsNow()) === 4 && (await page.evaluate(() => document.querySelectorAll('#bonusList .pcard[data-k="memory"] .pbtn[data-r="1"] .st')[0].textContent.includes('★'))), String(await coinsNow()));
  // seconda vittoria: nessun rimborso
  await page.click(btn('memory', 1)); await page.waitForTimeout(300);
  const mem2 = await dbg(page, () => window.__dbg.puz.cards); const s2 = {}; mem2.forEach((t, i) => { (s2[t] = s2[t] || []).push(i); });
  for (const k of Object.keys(s2)) { await memClick(s2[k][0]); await memClick(s2[k][1]); await page.waitForTimeout(450); }
  await page.waitForTimeout(1200);
  check('rigiocando lo stesso livello non c\'è rimborso (3 ✨ restano)', await has(page, 'gift') && !(await T(page, '#giftText')).includes('+2') && (await coinsNow()) === 3, (await T(page, '#giftText')) + ' / ' + await coinsNow());
  await dismissGifts(page);
  // PEZZO MANCANTE facile: 3 domande
  await page.click(btn('missing', 1)); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/pezzo_mancante.png' });
  const bad0 = await dbg(page, () => { const c = window.__dbg.puz.qa.correct; return document.querySelectorAll('#puzBody .opt').length === 2 ? 1 - c : (c + 1) % 4; });
  await page.evaluate(i => document.querySelectorAll('#puzBody .opt')[i].click(), bad0); await page.waitForTimeout(150);
  check('una risposta sbagliata conta come errore e si può riprovare', (await dbg(page, () => window.__dbg.puz.errors)) === 1);
  for (let q = 0; q < 3; q++) {
    const c = await dbg(page, () => window.__dbg.puz.qa.correct);
    await page.evaluate(i => document.querySelectorAll('#puzBody .opt')[i].click(), c); await page.waitForTimeout(900);
  }
  await page.waitForTimeout(500);
  check('dopo 3 risposte giuste il Pezzo mancante è vinto', await has(page, 'gift') && (await T(page, '#giftText')).includes('+2'), await T(page, '#giftText'));
  await dismissGifts(page);
  // SUDOKU facile
  await page.click(btn('sudoku', 1)); await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + '/sudoku.png' });
  const su = await dbg(page, () => ({ sol: window.__dbg.puz.sol, fixed: window.__dbg.puz.fixed }));
  check('Sudoku facile: 16 caselle, 6 da riempire', su.sol.length === 16 && su.fixed.filter(f => !f).length === 6);
  // una mossa sbagliata
  const firstBlank = su.fixed.findIndex(f => !f);
  await page.evaluate(i => document.querySelectorAll('#puzBody .scell')[i].click(), firstBlank);
  await page.evaluate(([i, sol]) => document.querySelectorAll('#puzBody .spal button[data-v]')[(sol[i] + 1) % 4].click(), [firstBlank, su.sol]); await page.waitForTimeout(150);
  check('un animale sbagliato non si inserisce e conta come errore', (await dbg(page, () => window.__dbg.puz.errors)) === 1 && (await dbg(page, i => window.__dbg.puz.grid[i], firstBlank)) === -1);
  for (let i = 0; i < 16; i++) {
    if (su.fixed[i]) continue;
    await page.evaluate(k => document.querySelectorAll('#puzBody .scell')[k].click(), i);
    await page.evaluate(([k, sol]) => document.querySelectorAll('#puzBody .spal button[data-v]')[sol[k]].click(), [i, su.sol]); await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);
  check('riempita la griglia giusta il Sudoku è vinto', await has(page, 'gift') && (await T(page, '#giftText')).includes('+2'), await T(page, '#giftText'));
  await dismissGifts(page);
  const coinsEnd = await coinsNow();
  check('conti finali: 3 + (−1+2) + 0 + (−1+2) + (−1+2) + ... coerenti (≥ 5)', coinsEnd >= 5, String(coinsEnd));
  // livelli medio e difficile: si aprono e hanno la forma giusta
  const forms = [];
  for (const [k, r, sel2, n] of [['memory', 3, '#puzBody .mcard', 20], ['missing', 3, '#puzBody .opt', 6], ['sudoku', 3, '#puzBody .scell', 16]]) {
    await page.click(btn(k, r)); await page.waitForTimeout(300);
    const cnt = await page.evaluate(sl => document.querySelectorAll(sl).length, sel2);
    forms.push(k + ':' + cnt); check('livello difficile di ' + k + ': ' + n + ' elementi', cnt === n, String(cnt));
    if (k === 'sudoku') check('Sudoku difficile: 10 caselle vuote', (await dbg(page, () => window.__dbg.puz.fixed.filter(f => !f).length)) === 10);
    await page.click('#puzBack'); await page.waitForTimeout(250);
  }
  // senza gettoni
  await page.evaluate(() => { window.__dbg.prog.coins = 0; });
  await page.click(btn('memory', 2)); await page.waitForTimeout(300);
  check('senza ✨ il rompicapo non parte e compare l\'avviso', !(await has(page, 'puz')) && (await T(page, '#bonusSub')).includes('✨') && (await T(page, '#bonusSub')).includes('Pas assez'), await T(page, '#bonusSub'));
  await page.screenshot({ path: SHOTS + '/senza_gettoni.png' });
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 7e. mascotte e parole in alto ----------
  section('Mascotte e parole degli effetti in alto');
  page = await mk(390, 780, unlockAll);
  await page.evaluate(() => document.getElementById('bSettings') ? 0 : 0);
  await page.click('#bSetMenu'); await page.waitForTimeout(300);
  check('in Impostazioni c\'è la scelta della mascotte (4 + nessuna), predefinita il collie', (await page.evaluate(() => document.querySelectorAll('#setBody .mcbtn').length)) === 5 && (await page.evaluate(() => document.querySelector('#setBody .mcbtn.on').getAttribute('data-m'))) === 'collie');
  await page.screenshot({ path: SHOTS + '/mascotte_scelta.png' });
  await page.click('#setBody .mcbtn[data-m="siamlong"]'); await page.waitForTimeout(150);
  check('si sceglie il siamese a pelo lungo e resta salvato', (await dbg(page, () => window.__dbg.S.mascot)) === 'siamlong' && (await page.evaluate(() => JSON.parse(localStorage.getItem('mj_set1')).mascot)) === 'siamlong');
  await page.click('#bSetOk'); await page.waitForTimeout(200);
  await startLevel(page, 5);
  const mm1 = await nextMove(page); await clickTile(page, mm1[0]); await clickTile(page, mm1[1]); await page.waitForTimeout(150);
  const mm2 = await nextMove(page); await clickTile(page, mm2[0]); await clickTile(page, mm2[1]); await page.waitForTimeout(350);
  const cb = await page.evaluate(() => { const e = document.getElementById('combo'); const r = e.firstChild.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), mid: Math.round(r.left + r.width / 2), vw: innerWidth, svg: !!e.querySelector('svg.mcv'), txt: e.textContent }; });
  check('la scritta della combo compare IN ALTO (sotto l\'intestazione, non a metà schermo) con la mascotte', cb.bottom < 190 && cb.top > 40 && cb.svg && /Bien|Super|Génial|Incroyable/.test(cb.txt), JSON.stringify(cb));
  await page.screenshot({ path: SHOTS + '/combo_in_alto.png' });
  await page.evaluate(() => { window.__dbg.S.mascot = 'none'; });
  const mm3 = await nextMove(page); await clickTile(page, mm3[0]); await clickTile(page, mm3[1]); await page.waitForTimeout(150);
  const mm4 = await nextMove(page); await clickTile(page, mm4[0]); await clickTile(page, mm4[1]); await page.waitForTimeout(300);
  check('senza mascotte compare solo la scritta', !(await page.evaluate(() => !!document.querySelector('#combo svg.mcv'))));
  // le 4 mascotte a fumetto: disegni diversi, riquadro uniforme, grandi abbastanza nella scelta
  const mk4 = await page.evaluate(() => { const M = window.__dbg.MASC, ks = ['collie', 'sheltie', 'siamshort', 'siamlong']; return { n: ks.filter(k => M[k] && M[k].art.length > 1500).length, distinct: new Set(ks.map(k => M[k].art)).size, vb: ks.every(k => M[k].vb === '0 0 100 112') }; });
  check('le 4 mascotte hanno disegni ricchi e diversi tra loro, nello stesso riquadro', mk4.n === 4 && mk4.distinct === 4 && mk4.vb, JSON.stringify(mk4));
  await page.click('#bSettings'); await page.waitForTimeout(300);
  const mkSz = await page.evaluate(() => [...document.querySelectorAll('#setBody .mcbtn svg')].map(s => Math.round(s.getBoundingClientRect().width)));
  check('nella scelta le mascotte sono grandi (76 px) e si vedono tutte e 4', mkSz.length === 4 && mkSz.every(w => w >= 70), mkSz.join(','));
  await page.screenshot({ path: SHOTS + '/mascotte_fumetto.png' });
  await page.click('#bSetOk'); await page.waitForTimeout(200);
  // nell'album le mascotte (collie, shetland, siamese a pelo lungo) hanno lo sfondo al posto giusto
  const alb = await page.evaluate(() => { const D = window.__dbg; return D.ALBUM.filter(a => typeof a.src === 'string').map(a => a.src); });
  check('nell\'album ci sono le mascotte come carte (collie, shetland, siamese a pelo lungo)', ['m:collie', 'm:sheltie', 'm:siamlong'].every(x => alb.includes(x)), alb.join(','));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2f. cinque nuove isole e livelli Tris ----------
  section('Nuove isole (dolci, arte, scienza, mare, fiori) e livelli Tris');
  page = await mk(390, 780, () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 100, stars: { 1: 3 }, best: {}, seen: {}, revealed: { animals: true } })); }, false);
  const worlds = await page.evaluate(() => {
    const out = []; const ISL = window.__dbg.ISL;
    for (let l = 41; l <= 100; l++) {
      window.__dbg.startLevel(l);
      const T = window.__dbg.tiles, key = new Set(T.map(t => t.x + ',' + t.y + ',' + t.z));
      const I = ISL.find(w => w.levels && l >= w.levels[0] && l <= w.levels[1]), cfg = window.__dbg.cfg;
      const types = [...new Set(T.map(t => t.type))], per = {}; T.forEach(t => { per[t.type] = (per[t.type] || 0) + 1; });
      const gs = window.__dbg.GS, mv = window.__dbg.findMove();
      out.push({ l, w: I.id, n: T.length, dup: T.length - key.size, uns: T.filter(t => t.z > 0 && !key.has(t.x + ',' + t.y + ',' + (t.z - 1))).length, cols: Math.max(...T.map(t => t.x)) + 1, rows: Math.max(...T.map(t => t.y)) + 1,
        bad: types.filter(x => !I.pool.includes(x)).length, gold: T.filter(t => t.gold).length, cg: cfg.gold || 0, hid: T.filter(t => t.hid).length, ch: (cfg.hid || []).reduce((a, b) => a + b, 0), fog: T.filter(t => t.fogOn).length, gs,
        modOk: Object.values(per).every(c => c % gs === 0) && T.length % gs === 0, mvLen: mv ? mv.length : 0, ntypes: types.length });
    }
    return out;
  });
  const errs2 = worlds.filter(r => r.dup || r.uns || r.cols > 5 || r.rows > 6 || r.bad || r.gold !== r.cg || r.hid !== r.ch || !r.modOk || r.mvLen !== r.gs || r.n < 12);
  check('tutti i 60 livelli delle 5 isole + Tris: forma valida (≤5×6, niente doppioni, tutte appoggiate)', worlds.every(r => !r.dup && !r.uns && r.cols <= 5 && r.rows <= 6), errs2.map(r => r.l).join(','));
  check('le tessere di ogni livello appartengono al gruppo della sua isola (nessun animale tra i dolci, ecc.)', worlds.every(r => r.bad === 0), worlds.filter(r => r.bad).map(r => r.l).join(','));
  check('tessere d\'oro e nascoste come da parametri, e subito una mossa possibile', worlds.every(r => r.gold === r.cg && r.hid === r.ch && r.mvLen === r.gs), errs2.map(r => r.l).join(','));
  check('livelli Tris (91-100): gruppi da 3, tessere multiple di 3, una mossa è un tris', worlds.filter(r => r.w === 'tris').every(r => r.gs === 3 && r.modOk && r.mvLen === 3 && r.n % 3 === 0) && worlds.filter(r => r.w === 'tris').length === 10);
  check('le nuove isole hanno 10 livelli ciascuna', ['sweets', 'art', 'science', 'sea', 'flowers'].every(w => worlds.filter(r => r.w === w).length === 10));
  console.log('   tessere per livello: ' + worlds.map(r => r.l + ':' + r.n).join(' '));
  // avanzamento separato per isola + mappa
  await page.context().close();
  const star80 = {}; for (let i = 1; i <= 27; i++) star80[i] = 3; star80[40] = 1;
  page = await mk(390, 780, null, false);
  await page.evaluate(s => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: s, best: {}, seen: {}, revealed: { animals: true, sweets: true }, coins: 5 })); }, star80);
  await page.reload(); await page.waitForTimeout(700);
  check('con 81 punti ★ l\'isola dei dolci è aperta e mostra 0/30', (await T(page, '#mapPath .isl[data-id="sweets"] .islsub')).includes('0/30') && !(await page.evaluate(() => document.querySelector('#mapPath .isl[data-id="sweets"]').classList.contains('locked'))));
  await page.screenshot({ path: SHOTS + '/mappa_isole.png' });
  await page.click('#isl_sweets'); await page.waitForTimeout(300);
  check('toccandola si apre il menu dei suoi 10 livelli con il solo primo aperto', (await page.evaluate(() => document.querySelectorAll('#grid .lcard').length)) === 10 && (await page.evaluate(() => document.querySelectorAll('#grid .lcard:not(.locked)').length)) === 1, await T(page, '#islTitle'));
  await page.screenshot({ path: SHOTS + '/isola_dolci_menu.png' });
  await page.evaluate(() => window.__dbg.startLevel(41)); await page.waitForTimeout(1700);
  await play(page, 120, 0); await page.waitForTimeout(900);
  check('vinto il primo livello dei dolci si apre il secondo (avanzamento dell\'isola)', await dbg(page, () => window.__dbg.prog.iu.sweets) === 42, JSON.stringify(await dbg(page, () => window.__dbg.prog.iu)));
  await page.screenshot({ path: SHOTS + '/dolci_livello.png' });
  await page.context().close();
  // Tris dalla sala dei rompicapi
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 5, stars: {}, best: {}, seen: {}, revealed: {}, coins: 3, pzSeen: { memory: 1, missing: 1, sudoku: 1, slide: 1, maze: 1, diff: 1, jars: 1, pairs: 1, words: 1, dots: 1 } })); });
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#bBonus'); await page.waitForTimeout(300);
  check('prima dei livelli iniziali i Tris sono bloccati', (await T(page, '#bTris')).includes('🔒'), await T(page, '#bTris'));
  await page.context().close();
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 21, stars: {}, best: {}, seen: { 91: 1 }, revealed: { animals: true }, coins: 3 })); });
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#bBonus'); await page.waitForTimeout(300);
  check('finiti i livelli iniziali i Tris si aprono dalla sala', !(await T(page, '#bTris')).includes('🔒'));
  await page.click('#bTris'); await page.waitForTimeout(400);
  check('si apre il menu dei 10 livelli Tris', await has(page, 'menu') && (await page.evaluate(() => document.querySelectorAll('#grid .lcard').length)) === 10 && !(await has(page, 'bonus')), await T(page, '#islTitle'));
  await page.evaluate(() => window.__dbg.startLevel(91)); await page.waitForTimeout(1700);
  const tr = await page.evaluate(() => ({ gs: window.__dbg.GS, n: window.__dbg.tiles.length }));
  check('livello Tris 1: si abbinano 3 tessere', tr.gs === 3 && tr.n % 3 === 0, JSON.stringify(tr));
  const trm = await nextMove(page);
  await clickTile(page, trm[0]); await clickTile(page, trm[1]); await page.waitForTimeout(150);
  check('dopo due tessere uguali sono evidenziate entrambe (manca la terza)', (await page.evaluate(() => document.querySelectorAll('.tile.sel').length)) === 2 && (await dbg(page, () => window.__dbg.tiles.filter(t => t.gone).length)) === 0);
  await page.screenshot({ path: SHOTS + '/tris_due.png' });
  await clickTile(page, trm[2]); await page.waitForTimeout(250);
  check('la terza tessera uguale toglie tutte e tre', (await dbg(page, () => window.__dbg.tiles.filter(t => t.gone).length)) === 3);
  await page.click('#bUndo'); await page.waitForTimeout(250);
  check('Annulla rimette tutte e tre le tessere', (await dbg(page, () => window.__dbg.tiles.filter(t => t.gone).length)) === 0);
  await play(page, 200, 0); await page.waitForTimeout(900);
  check('il livello Tris si completa giocando', await dbg(page, () => window.__dbg.over));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2g. gli altri sette rompicapo ----------
  section('Rompicapi: scorrevole, labirinto, differenze, barattoli, coppie, parole, puntini');
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 1, stars: {}, best: {}, seen: {}, revealed: {}, coins: 30, pzSeen: { memory: 1, missing: 1, sudoku: 1, slide: 1, maze: 1, diff: 1, jars: 1, pairs: 1, words: 1, dots: 1 } })); });
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#bBonus'); await page.waitForTimeout(300);
  check('la sala ha ora 10 rompicapi (10 carte × 3 livelli) più la carta dei Tris', (await page.evaluate(() => document.querySelectorAll('#bonusList .pcard[data-k]:not([data-k="tris"])').length)) === 10 && (await page.evaluate(() => document.querySelectorAll('#bonusList .pbtn[data-r]').length)) === 30);
  await page.screenshot({ path: SHOTS + '/sala_10.png' });
  const open2 = async (k, r) => { await page.click('#bonusList .pcard[data-k="' + k + '"] .pbtn[data-r="' + r + '"]'); await page.waitForTimeout(350); };
  const KINDOF = { 'Puzzle scorrevole': 'slide', 'Labirinto': 'maze', 'Trova le differenze': 'diff', 'Smista i barattoli': 'jars', 'Collega le coppie': 'pairs', 'Cerca parole': 'words', 'Unisci i puntini': 'dots' };
  const wonOk = async name => { await page.waitForTimeout(1500); const g = await has(page, 'gift'); const txt = await T(page, '#giftText'); check(name + ': vinto, prima vittoria +2 ✨', g && txt.includes('+2'), txt); if (g) { await dismissGifts(page); }
    const kk = KINDOF[name]; if (kk) { const st = await page.evaluate(k => { const e = document.querySelector('#bonusList .pcard[data-k="' + k + '"] .pbtn[data-r="1"] .st'); return e ? e.textContent : ''; }, kk); check(name + ': le stelle guadagnate compaiono nella sala dei rompicapi (★ sul pulsante)', st.includes('★') && (await dbg(page, k => window.__dbg.prog.puz[k + ':1'], kk)) >= 1, st); } };
  // PUZZLE SCORREVOLE
  await open2('slide', 1); await page.screenshot({ path: SHOTS + '/scorrevole.png' });
  check('Puzzle scorrevole facile: 9 caselle', (await page.evaluate(() => document.querySelectorAll('#puzBody .slg button').length)) === 9);
  const slSol = await dbg(page, () => window.__dbg.puz.sol);
  for (const c of slSol) { await page.evaluate(k => document.querySelectorAll('#puzBody .slg button')[k].click(), c); await page.waitForTimeout(60); }
  await wonOk('Puzzle scorrevole');
  // LABIRINTO
  await open2('maze', 1); await page.screenshot({ path: SHOTS + '/labirinto.png' });
  check('Labirinto facile: 5×5', (await page.evaluate(() => document.querySelectorAll('#puzBody .mzc').length)) === 25);
  const mzPath = await dbg(page, () => window.__dbg.puz.path);
  for (const c of mzPath.slice(1)) { await page.evaluate(k => document.querySelectorAll('#puzBody .mzc')[k].click(), c); await page.waitForTimeout(50); }
  await wonOk('Labirinto');
  // DIFFERENZE
  await open2('diff', 1); await page.screenshot({ path: SHOTS + '/differenze.png' });
  const dfs = await dbg(page, () => window.__dbg.puz.diffs);
  const nonDiff = await page.evaluate(d => { for (let i = 0; i < 6; i++) if (!d.includes(i)) return i; return 0; }, dfs);
  await page.evaluate(i => document.querySelectorAll('#puzBody .dgrid')[1].querySelectorAll('button')[i].click(), nonDiff); await page.waitForTimeout(150);
  check('toccando una tessera uguale conta come errore', (await dbg(page, () => window.__dbg.puz.errors)) === 1);
  for (const i of dfs) { await page.evaluate(k => document.querySelectorAll('#puzBody .dgrid')[1].querySelectorAll('button')[k].click(), i); await page.waitForTimeout(80); }
  await wonOk('Trova le differenze');
  // BARATTOLI
  await open2('jars', 1); await page.screenshot({ path: SHOTS + '/barattoli.png' });
  check('Barattoli facile: 5 barattoli', (await page.evaluate(() => document.querySelectorAll('#puzBody .jar').length)) === 5);
  const jfw = await dbg(page, () => window.__dbg.puz.fwd);
  for (const [f, to] of jfw) { await page.evaluate(([a, b]) => { const j = document.querySelectorAll('#puzBody .jar'); j[a].click(); j[b].click(); }, [f, to]); await page.waitForTimeout(50); }
  await wonOk('Smista i barattoli');
  // COPPIE (si traccia col dito)
  await open2('pairs', 1); await page.screenshot({ path: SHOTS + '/coppie.png' });
  const pp = await dbg(page, () => window.__dbg.puz.paths);
  for (const p of pp) {
    const cs = await page.evaluate(cells => cells.map(c => { const r = document.querySelectorAll('#puzBody .pcell')[c].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }), p);
    await page.mouse.move(cs[0][0], cs[0][1]); await page.mouse.down();
    for (const c of cs.slice(1)) await page.mouse.move(c[0], c[1], { steps: 3 });
    await page.mouse.up(); await page.waitForTimeout(80);
  }
  check('Coppie: tutte le coppie collegate', (await dbg(page, () => window.__dbg.puz.conn.length)) === pp.length, String(await dbg(page, () => window.__dbg.puz.conn.length)));
  await wonOk('Collega le coppie');
  // PAROLE
  await open2('words', 1); await page.screenshot({ path: SHOTS + '/parole.png' });
  const ws = await dbg(page, () => window.__dbg.puz.words);
  await page.evaluate(() => { const c = document.querySelectorAll('#puzBody .wcell'); c[0].click(); c[1].click(); }); await page.waitForTimeout(100);
  for (const w of ws) { await page.evaluate(([a, b]) => { const c = document.querySelectorAll('#puzBody .wcell'); c[a].click(); c[b].click(); }, [w.a, w.b]); await page.waitForTimeout(80); }
  await wonOk('Cerca parole');
  // PUNTINI
  await open2('dots', 1); await page.screenshot({ path: SHOTS + '/puntini_inizio.png' });
  const nD = await dbg(page, () => window.__dbg.puz.N);
  for (let i = 0; i < nD; i++) { await page.evaluate(k => document.querySelectorAll('#puzBody svg.dotsvg g[data-i]')[k].dispatchEvent(new MouseEvent('click', { bubbles: true })), i); await page.waitForTimeout(40); }
  await page.waitForTimeout(300); await page.screenshot({ path: SHOTS + '/puntini_fine.png' });
  await wonOk('Unisci i puntini');
  // i livelli difficili si aprono
  const sizes = [];
  for (const [k, sel2, minN] of [['slide', '#puzBody .slg button', 16], ['maze', '#puzBody .mzc', 81], ['diff', '#puzBody .dgrid button', 12], ['jars', '#puzBody .jar', 8], ['pairs', '#puzBody .pcell', 36], ['words', '#puzBody .wcell', 64], ['dots', '#puzBody svg.dotsvg g[data-i]', 16]]) {
    await open2(k, 3); const cnt = await page.evaluate(s => document.querySelectorAll(s).length, sel2); sizes.push(k + ':' + cnt);
    check('livello difficile di ' + k + ' ha almeno ' + minN + ' elementi', cnt >= minN, String(cnt)); await page.click('#puzBack'); await page.waitForTimeout(250);
  }
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2h. album da collezionare ----------
  section('Album da collezionare e mascotte');
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 1, stars: {}, best: {}, seen: {}, revealed: {}, coins: 3, pzSeen: { memory: 1, missing: 1, sudoku: 1, slide: 1, maze: 1, diff: 1, jars: 1, pairs: 1, words: 1, dots: 1 } })); });
  await page.reload(); await page.waitForTimeout(600);
  check('sulla mappa c\'è il pulsante dell\'album', await page.evaluate(() => getComputedStyle(document.getElementById('bAlbum')).display) !== 'none');
  await page.click('#bAlbum'); await page.waitForTimeout(300);
  check('l\'album ha 5 categorie (cani, gatti, pappagalli, pappagallini, zoo) e 41 carte', (await page.evaluate(() => document.querySelectorAll('#albTabs .albtab').length)) === 5 && (await page.evaluate(() => document.querySelectorAll('#albSets .albset').length)) === 6 && (await dbg(page, () => window.__dbg.ALBUM.length)) === 41);
  check('all\'inizio tutte le carte sono coperte (silhouette «???»)', (await page.evaluate(() => document.querySelectorAll('#albGrid .albcard.lock').length)) === 10 && (await T(page, '#albSub')).includes('0/41'), await T(page, '#albSub'));
  await page.screenshot({ path: SHOTS + '/album_vuoto.png' });
  await page.click('#albClose'); await page.waitForTimeout(200);
  // 8 punti ★ + 1 sfida = 3 carte
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 5, stars: { 1: 3, 2: 3, 3: 2 }, best: {}, seen: {}, revealed: {}, coins: 3, chal: 1, albumSeen: 0 })); });
  await page.reload(); await page.waitForTimeout(600);
  check('8 stelle + 1 sfida = 3 carte guadagnate', (await dbg(page, () => window.__dbg.albumEarned())) === 3);
  await dbg(page, () => window.__dbg.albumCheck()); await page.waitForTimeout(400);
  check('compare «Nuova carta!» con la figurina', await has(page, 'gift') && (await T(page, '#giftTitle')).length > 0 && (await page.evaluate(() => !!document.querySelector('#giftIcon .albpop svg'))), await T(page, '#giftText'));
  await page.screenshot({ path: SHOTS + '/album_nuova_carta.png' });
  await page.click('#bGiftOk'); await page.waitForTimeout(300);
  await dbg(page, () => window.__dbg.albumCheck()); await page.waitForTimeout(300);
  check('la notifica non si ripete', !(await has(page, 'gift')));
  await page.click('#bAlbum'); await page.waitForTimeout(300);
  check('nell\'album ci sono 3 carte scoperte', (await page.evaluate(() => { let n = 0; document.querySelectorAll('#albTabs .albtab small').forEach(s => { n += +s.textContent.split('/')[0]; }); return n; })) === 3);
  await page.screenshot({ path: SHOTS + '/album_tre.png' });
  await page.click('#albTabs .albtab[data-c="zoo"]'); await page.waitForTimeout(200);
  check('si cambia categoria: lo zoo ha 12 carte', (await page.evaluate(() => document.querySelectorAll('#albGrid .albcard').length)) === 12);
  await page.screenshot({ path: SHOTS + '/album_zoo.png' });
  await page.click('#albClose'); await page.waitForTimeout(200);
  // una sfida si conta una sola volta
  const c1 = await dbg(page, () => { window.__dbg.chalAward('b25'); window.__dbg.chalAward('b25'); return window.__dbg.prog.chal; });
  check('una sfida vale una sola volta (boss 25)', c1 === 2, String(c1));
  // nomi e disegni in tutte le lingue per tutte le carte
  const nm = await page.evaluate(() => { const bad = []; for (const lg of ['fr', 'en', 'it']) { document.querySelector('#langsMap button[data-l="' + lg + '"]').click(); window.__dbg.ALBUM.forEach(it => { const tn = window.__dbg.I18N[lg].tn; const nme = typeof it.src === 'string' ? window.__dbg.I18N[lg]['mc_' + it.src.slice(2)] : tn[it.src]; if (!nme) bad.push(lg + ':' + it.id); }); } document.querySelector('#langsMap button[data-l="fr"]').click(); return bad; });
  check('tutte le 41 carte hanno il nome in francese, inglese e italiano', nm.length === 0, nm.join(' '));
  // album completo
  await page.evaluate(() => { const st = {}; for (let i = 1; i <= 100; i++)st[i] = 3; localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 100, stars: st, best: {}, seen: {}, revealed: { animals: true, sweets: true, art: true, science: true, sea: true, flowers: true }, coins: 3, albumSeen: 41 })); });
  await page.reload(); await page.waitForTimeout(800);
  await page.click('#bAlbum'); await page.waitForTimeout(300);
  check('con tutte le stelle l\'album è completo (41/41)', (await T(page, '#albSub')).includes('41/41') && (await page.evaluate(() => document.querySelectorAll('#albGrid .albcard.lock').length)) === 0);
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2i. rompicapi: controlli a tappeto (generazione casuale ripetuta + uso reale) ----------
  section('Rompicapi: generazione ripetuta e uso reale');
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 1, stars: {}, best: {}, seen: {}, revealed: {}, coins: 500, pzSeen: { memory: 1, missing: 1, sudoku: 1, slide: 1, maze: 1, diff: 1, jars: 1, pairs: 1, words: 1, dots: 1 } })); });
  await page.reload(); await page.waitForTimeout(600);
  const inv = await page.evaluate(() => {
    const D = window.__dbg, out = {}; const bad = (k, m) => { (out[k] = out[k] || []).push(m); };
    for (let it = 0; it < 25; it++) for (let r = 1; r <= 3; r++) {
      document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); D.prog.coins = 500;
      // PUNTINI: nessuna sovrapposizione, tutti i punti nel riquadro
      D.startPuzzle('dots', r); let p = D.puz;
      const dc = [...document.querySelectorAll('#puzBody svg.dotsvg g[data-i] circle')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
      let md = 1e9; for (let a = 0; a < dc.length; a++) for (let b = a + 1; b < dc.length; b++) md = Math.min(md, Math.hypot(dc[a][0] - dc[b][0], dc[a][1] - dc[b][1]));
      if (md < 2 * p.rad + 3) bad('dots', 'r' + r + ' dist ' + md.toFixed(1) + ' < ' + (2 * p.rad + 3).toFixed(1));
      if (dc.some(c => c[0] < 10 || c[0] > 310 || c[1] < 10 || c[1] > 310)) bad('dots', 'fuori riquadro r' + r);
      if (p.rad < 12) bad('dots', 'punti troppo piccoli r' + r + ' ' + p.rad.toFixed(1));
      D.leavePuzzle();
      // DIFFERENZE: ogni differenza si vede (contenuto, filtro, scala, trasparenza o fiocco), le altre sono identiche
      D.startPuzzle('diff', r); p = D.puz;
      const grids = document.querySelectorAll('#puzBody .dgrid'), A = [...grids[0].children], B = [...grids[1].children];
      A.forEach((a, i) => { const b = B[i]; const same = a.innerHTML === b.innerHTML && !b.querySelector('.bdg') && !b.firstChild.getAttribute('style');
        if (p.diffs.includes(i) && same) bad('diff', 'differenza invisibile r' + r + ' cella ' + i); if (!p.diffs.includes(i) && !same) bad('diff', 'cella uguale ma diversa r' + r); });
      D.leavePuzzle();
      // PEZZO MANCANTE: opzioni tutte diverse fra loro e colori distinti
      D.startPuzzle('missing', r); p = D.puz;
      const op = [...document.querySelectorAll('#puzBody .opt')].map(o => o.innerHTML); if (new Set(op).size !== op.length) bad('missing', 'opzioni uguali r' + r);
      if (op.length !== [2, 4, 6][r - 1]) bad('missing', 'numero opzioni ' + op.length);
      D.leavePuzzle();
      // COPPIE: estremi mai adiacenti, percorsi senza sovrapposizioni
      D.startPuzzle('pairs', r); p = D.puz; const seen = new Set(); let ov = false; p.paths.forEach(pa => { pa.forEach(c => { if (seen.has(c)) ov = true; seen.add(c); }); const n = [4, 5, 6][r - 1], a = pa[0], b = pa[pa.length - 1]; if (Math.abs(a % n - b % n) + Math.abs(Math.floor(a / n) - Math.floor(b / n)) < 2) bad('pairs', 'estremi vicini r' + r); });
      if (ov) bad('pairs', 'percorsi sovrapposti'); if (p.paths.length < [3, 4, 5][r - 1] - 1) bad('pairs', 'poche coppie ' + p.paths.length + ' r' + r);
      D.leavePuzzle();
      // SUDOKU: soluzione unica
      D.startPuzzle('sudoku', r); p = D.puz; const g = p.grid.slice(); if (D.sudoSolve(g, 3) !== 1) bad('sudoku', 'soluzione non unica r' + r); D.leavePuzzle();
      // BARATTOLI: la sequenza di soluzione funziona e porta alla fine
      D.startPuzzle('jars', r); p = D.puz; const J = p.jars.map(j => j.slice()); let okJ = true;
      for (const [f, to] of p.fwd) { const src = J[f], dst = J[to]; const top = src[src.length - 1]; if (!(dst.length < p.cap && (dst.length === 0 || dst[dst.length - 1] === top))) { okJ = false; break; } dst.push(src.pop()); }
      if (!okJ || !J.every(j => j.length === 0 || (j.length === 4 && j.every(x => x === j[0])))) bad('jars', 'soluzione non valida r' + r); D.leavePuzzle();
      // SCORREVOLE: la soluzione risolve e i pezzi sono numerati
      D.startPuzzle('slide', r); p = D.puz; const nsn = document.querySelectorAll('#puzBody .slc .sn').length, N = p.cols * p.rows; if (nsn !== N - 1) bad('slide', 'numeri ' + nsn + ' su ' + (N - 1));
      const bd = p.bd.slice(); for (const c of p.sol) { const bi = bd.indexOf(N - 1); bd[bi] = bd[c]; bd[c] = N - 1; } if (!bd.every((v, k) => v === k)) bad('slide', 'soluzione non valida r' + r); D.leavePuzzle();
      // LABIRINTO: esiste il percorso, parte da 0 e arriva all'ultima cella
      D.startPuzzle('maze', r); p = D.puz; if (p.path[0] !== 0 || p.path[p.path.length - 1] !== p.n * p.n - 1) bad('maze', 'percorso non valido r' + r); D.leavePuzzle();
      // PAROLE: tutte le parole sono state piazzate
      D.startPuzzle('words', r); p = D.puz; if (p.words.length < [4, 5, 6][r - 1]) bad('words', 'parole piazzate ' + p.words.length + ' r' + r); D.leavePuzzle();
    }
    return out;
  });
  for (const k of ['dots', 'diff', 'missing', 'pairs', 'sudoku', 'jars', 'slide', 'maze', 'words']) check('rompicapo ' + k + ': 75 generazioni casuali tutte valide', !inv[k], (inv[k] || []).slice(0, 3).join(' | '));
  // uso reale con tocchi veri: puntini (ognuno si deve poter toccare davvero)
  await page.reload(); await page.waitForTimeout(700);
  await page.click('#bBonus'); await page.waitForTimeout(300);
  for (const r of [1, 2, 3]) {
    await page.click('#bonusList .pcard[data-k="dots"] .pbtn[data-r="' + r + '"]'); await page.waitForTimeout(350);
    const N = await dbg(page, () => window.__dbg.puz.N); let okTap = 0;
    for (let i = 0; i < N; i++) {
      const pt = await page.evaluate(k => { const c = document.querySelectorAll('#puzBody svg.dotsvg g[data-i] circle')[k].getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; }, i);
      const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const g = e && e.closest('g[data-i]'); return g ? +g.getAttribute('data-i') : -1; }, pt);
      if (hit === i) okTap++; await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(50);
    }
    check('puntini livello ' + r + ': ' + N + ' punti, ognuno si tocca davvero col dito e si completa', okTap === N && (await dbg(page, () => window.__dbg.puz.next)) === N, okTap + '/' + N);
    await page.waitForTimeout(1900); if (r === 1) await page.screenshot({ path: SHOTS + '/puntini_stella.png' });
    await dismissGifts(page);
  }
  await page.screenshot({ path: SHOTS + '/sala_dopo.png' });
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2j. rompicapi su schermi piccoli ----------
  section('Rompicapi su schermo piccolo (360×640): niente esce dai bordi');
  page = await mk(360, 640, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 1, stars: {}, best: {}, seen: {}, revealed: {}, coins: 500, pzSeen: { memory: 1, missing: 1, sudoku: 1, slide: 1, maze: 1, diff: 1, jars: 1, pairs: 1, words: 1, dots: 1 } })); });
  await page.reload(); await page.waitForTimeout(600);
  const small = await page.evaluate(() => {
    const D = window.__dbg, out = []; const ks = ['memory', 'missing', 'sudoku', 'slide', 'maze', 'diff', 'jars', 'pairs', 'words', 'dots'];
    for (const k of ks) for (let r = 1; r <= 3; r++) {
      document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); D.prog.coins = 500; D.startPuzzle(k, r);
      const vw = innerWidth; let maxR = 0, minL = 1e9; document.querySelectorAll('#puzBody *').forEach(e => { if (e.ownerSVGElement) return; const b = e.getBoundingClientRect(); if (b.width && b.height) { maxR = Math.max(maxR, b.right); minL = Math.min(minL, b.left); } });
      const el = document.getElementById('puz'); const hs = el.scrollWidth > el.clientWidth + 1;
      const tapMin = Math.min(...[...document.querySelectorAll('#puzBody button, #puzBody .mzc, #puzBody g[data-i] circle')].map(b => { const q = b.getBoundingClientRect(); return Math.min(q.width, q.height); }).filter(x => x > 0));
      out.push({ k, r, maxR: Math.round(maxR), minL: Math.round(minL), hs, tapMin: Math.round(tapMin), vw });
      D.leavePuzzle();
    }
    return out;
  });
  const badSmall = small.filter(o => o.maxR > o.vw + 1 || o.minL < -1 || o.hs);
  check('tutti i 30 livelli di rompicapo stanno nella larghezza dello schermo (nessuno scorre di lato)', badSmall.length === 0, badSmall.map(o => o.k + o.r + ':' + o.maxR).join(' '));
  const tiny = small.filter(o => o.tapMin < 24);
  check('i bersagli da toccare sono almeno 24 px', tiny.length === 0, tiny.map(o => o.k + o.r + ':' + o.tapMin).join(' '));
  console.log('   bersagli minimi: ' + small.filter(o => o.r === 3).map(o => o.k + ':' + o.tapMin).join(' '));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 2k. rompicapi: aiuti, spiegazioni, barattoli, stelle registrate ----------
  section('Rompicapi: aiuti, spiegazioni, barattoli, stelle');
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 1, stars: {}, best: {}, seen: {}, revealed: {}, coins: 500 })); });
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#bBonus'); await page.waitForTimeout(300);
  // spiegazione: la prima volta compare da sola, poi con «Come si gioca»
  await page.click('#bonusList .pcard[data-k="jars"] .pbtn[data-r="1"]'); await page.waitForTimeout(400);
  check('la prima volta compare la spiegazione del gioco (scopo, cosa toccare, aiuto)', await has(page, 'pzHelp') && (await page.evaluate(() => document.querySelectorAll('#phList .ph').length)) === 3 && (await T(page, '#phTitle')).length > 0, await T(page, '#phTitle'));
  await page.screenshot({ path: SHOTS + '/spiegazione.png' });
  await page.click('#bPhOk'); await page.waitForTimeout(250);
  check('si chiude con «Compris» e il rompicapo è sotto', !(await has(page, 'pzHelp')) && await has(page, 'puz'));
  await page.click('#puzHelp'); await page.waitForTimeout(250);
  check('il pulsante «Come si gioca» la riapre', await has(page, 'pzHelp'));
  await page.click('#bPhOk'); await page.waitForTimeout(200);
  await page.click('#puzBack'); await page.waitForTimeout(250);
  await page.click('#bonusList .pcard[data-k="jars"] .pbtn[data-r="1"]'); await page.waitForTimeout(350);
  check('la seconda volta non compare più da sola', !(await has(page, 'pzHelp')));
  // BARATTOLI: una mossa su un barattolo non vuoto funziona davvero
  const jm = await page.evaluate(() => { const p = window.__dbg.puz; let best = null; p.jars.forEach((a, ai) => { if (!a.length) return; p.jars.forEach((b, bi) => { if (ai === bi || !b.length || b.length >= p.cap) return; if (b[b.length - 1] === a[a.length - 1]) best = best || [ai, bi]; }); }); return best; });
  check('nella partita c\'è almeno una mossa su un barattolo NON vuoto', !!jm);
  if (jm) {
    const before = await dbg(page, () => window.__dbg.puz.jars.map(j => j.length));
    await page.click('#puzBody .jar[data-j="' + jm[0] + '"]'); await page.waitForTimeout(120);
    check('il barattolo toccato si solleva e compare il suggerimento', (await page.evaluate(() => document.querySelectorAll('#puzBody .jar.sel').length)) === 1 && (await T(page, '#puzMsg')).length > 0, await T(page, '#puzMsg'));
    await page.click('#puzBody .jar[data-j="' + jm[1] + '"]'); await page.waitForTimeout(150);
    const after = await dbg(page, () => window.__dbg.puz.jars.map(j => j.length));
    check('la mossa su un barattolo con lo stesso animale in cima si fa', after[jm[0]] === before[jm[0]] - 1 && after[jm[1]] === before[jm[1]] + 1, before.join('') + ' → ' + after.join(''));
  }
  // mossa non valida: messaggio che spiega perché
  const bad = await page.evaluate(() => { const p = window.__dbg.puz; let r = null; p.jars.forEach((a, ai) => { if (!a.length) return; p.jars.forEach((b, bi) => { if (ai === bi || !b.length || b.length >= p.cap) return; if (b[b.length - 1] !== a[a.length - 1] && !r) r = [ai, bi]; }); }); return r; });
  if (bad) { await page.click('#puzBody .jar[data-j="' + bad[0] + '"]'); await page.click('#puzBody .jar[data-j="' + bad[1] + '"]'); await page.waitForTimeout(150); check('una mossa non valida spiega il motivo', (await T(page, '#puzMsg')).length > 10, await T(page, '#puzMsg')); }
  // generazione: quante mosse su barattoli non vuoti ci sono all'inizio (sempre ≥ 1)
  const jstat = await page.evaluate(() => { const D = window.__dbg, out = []; for (let it = 0; it < 20; it++) for (let r = 1; r <= 3; r++) { document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); D.prog.coins = 500; D.startPuzzle('jars', r); const p = D.puz; let n = 0; p.jars.forEach((a, ai) => { if (!a.length) return; p.jars.forEach((b, bi) => { if (ai !== bi && b.length && b.length < p.cap && b[b.length - 1] === a[a.length - 1]) n++; }); }); out.push(n); D.leavePuzzle(); } return out; });
  check('all\'inizio ci sono sempre almeno 3 mosse verso barattoli con animali (min ' + Math.min(...jstat) + ')', Math.min(...jstat) >= 3, jstat.join(','));
  await page.reload(); await page.waitForTimeout(700);
  // AIUTI di ogni rompicapo
  await page.click('#bBonus'); await page.waitForTimeout(300);
  const aidRes = {};
  for (const k of ['memory', 'missing', 'sudoku', 'slide', 'maze', 'diff', 'jars', 'pairs', 'words', 'dots']) {
    await page.evaluate(kk => { const p = JSON.parse(localStorage.getItem('mj_prog3')); p.pzSeen = p.pzSeen || {}; p.pzSeen[kk] = 1; localStorage.setItem('mj_prog3', JSON.stringify(p)); window.__dbg.prog.pzSeen[kk] = 1; }, k);
    await page.click('#bonusList .pcard[data-k="' + k + '"] .pbtn[data-r="1"]'); await page.waitForTimeout(350);
    const b0 = await page.evaluate(() => ({ label: document.getElementById('puzAidT').textContent, up: document.querySelectorAll('#puzBody .mcard.up').length, out: document.querySelectorAll('#puzBody .opt.out').length, filled: window.__dbg.puz.grid ? window.__dbg.puz.grid.filter(v => v >= 0).length : 0, conn: (window.__dbg.puz.conn || []).length }));
    await page.click('#puzAid'); await page.waitForTimeout(250);
    const a1 = await page.evaluate(() => ({ label: document.getElementById('puzAidT').textContent, up: document.querySelectorAll('#puzBody .mcard.up').length, out: document.querySelectorAll('#puzBody .opt.out').length, hint: document.querySelectorAll('#puzBody .hintA').length, filled: window.__dbg.puz.grid ? window.__dbg.puz.grid.filter(v => v >= 0).length : 0, conn: (window.__dbg.puz.conn || []).length, aids: window.__dbg.puz.aids, aided: window.__dbg.puz.aided, msg: document.getElementById('puzMsg').textContent, dotRed: [...document.querySelectorAll('#puzBody svg.dotsvg circle')].some(c => c.getAttribute('stroke') === '#e5484d') }));
    const eff = { memory: a1.up > 0, missing: a1.out === 1, sudoku: a1.filled === b0.filled + 1, slide: a1.hint === 2, maze: a1.hint >= 1, diff: a1.hint === 1, jars: a1.hint === 2 || a1.msg.length > 0, pairs: a1.conn === b0.conn + 1, words: a1.hint === 1, dots: a1.dotRed }[k];
    aidRes[k] = eff && a1.aids === 2 && a1.aided && b0.label.includes('3') && a1.label.includes('2');
    check('aiuto «' + k + '»: ha un effetto visibile e le scorte scendono da 3 a 2', !!aidRes[k], JSON.stringify(a1));
    await page.click('#puzBack'); await page.waitForTimeout(250);
  }
  // tre aiuti, poi il pulsante si spegne; con gli aiuti al massimo 2 stelle
  await page.click('#bonusList .pcard[data-k="dots"] .pbtn[data-r="1"]'); await page.waitForTimeout(350);
  for (let i = 0; i < 3; i++) { await page.click('#puzAid'); await page.waitForTimeout(120); }
  check('dopo 3 aiuti il pulsante si spegne', await page.evaluate(() => document.getElementById('puzAid').disabled));
  for (let i = 0; i < 14; i++) await page.evaluate(k => document.querySelectorAll('#puzBody svg.dotsvg g[data-i]')[k].dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
  await page.waitForTimeout(100);
  const starsAided = await dbg(page, () => window.__dbg.prog.puz['dots:1']);
  check('puntini vinti con gli aiuti: al massimo 2 stelle', starsAided >= 1 && starsAided <= 2, String(starsAided));
  await page.waitForTimeout(1900); await dismissGifts(page);
  // STELLE REGISTRATE SUBITO: si esce subito dopo l'ultimo punto, senza aspettare il messaggio
  await page.click('#bonusList .pcard[data-k="dots"] .pbtn[data-r="2"]'); await page.waitForTimeout(350);
  const nDots = await dbg(page, () => window.__dbg.puz.N);
  for (let i = 0; i < nDots; i++) await page.evaluate(k => document.querySelectorAll('#puzBody svg.dotsvg g[data-i]')[k].dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
  await page.click('#puzBack'); await page.waitForTimeout(400);
  const st2 = await dbg(page, () => window.__dbg.prog.puz['dots:2']);
  check('uscendo subito dopo l\'ultimo punto le stelle sono comunque registrate', st2 >= 1, String(st2));
  await dismissGifts(page);
  check('e nella sala dei rompicapo compaiono sul pulsante', await page.evaluate(() => document.querySelector('#bonusList .pcard[data-k="dots"] .pbtn[data-r="2"] .st').textContent.includes('★')));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  // spiegazioni in tutte le lingue
  page = await mk(390, 780, null, false);
  const hl = await page.evaluate(() => { const bad = []; const I = window.__dbg.I18N; for (const lg of ['fr', 'en', 'it']) for (const k of ['memory', 'missing', 'sudoku', 'slide', 'maze', 'diff', 'jars', 'pairs', 'words', 'dots']) { const t = I[lg]['pzh_' + k]; if (!t || t.split('||').length !== 3) bad.push(lg + ':' + k); } return bad; });
  check('le 10 spiegazioni esistono in francese, inglese e italiano, ognuna con 3 parti', hl.length === 0, hl.join(' '));
  await page.context().close();
  // ISOLE IN ORDINE e album per isola
  const sAll = {}; for (let i = 1; i <= 40; i++) sAll[i] = 3; for (let i = 91; i <= 100; i++) sAll[i] = 3;
  page = await mk(390, 780, null, false);
  await page.evaluate(s => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: s, best: {}, seen: {}, revealed: { animals: true }, coins: 3 })); }, sAll);
  await page.reload(); await page.waitForTimeout(1800);
  const isl = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#mapPath .isl')].map(e => [e.getAttribute('data-id'), !e.classList.contains('fogged')])));
  check('finita l\'isola degli animali (120 ★ + 30 dai Tris) si apre SOLO l\'isola dei dolci', isl.sweets === true && isl.art === false && isl.science === false && isl.sea === false && isl.flowers === false, JSON.stringify(isl));
  check('i punti per le isole non contano i Tris (120, non 150)', (await dbg(page, () => window.__dbg.starsMain())) === 120);
  check('l\'isola successiva dice di finire quella precedente', (await T(page, '#mapPath .isl[data-id="art"] .islsub')).includes('précédente'), await T(page, '#mapPath .isl[data-id="art"] .islsub'));
  check('il regalo cita una sola isola (Dolci)', await has(page, 'gift') && !(await T(page, '#giftText')).includes(','), await T(page, '#giftText'));
  await page.screenshot({ path: SHOTS + '/isole_in_ordine.png' });
  await dismissGifts(page);
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();
  const sChain = Object.assign({}, sAll); for (let i = 41; i <= 50; i++) sChain[i] = 3;
  page = await mk(390, 780, null, false);
  await page.evaluate(s => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 40, stars: s, best: {}, seen: {}, revealed: { animals: true, sweets: true }, coins: 3, iu: { sweets: 50 } })); }, sChain);
  await page.reload(); await page.waitForTimeout(1800);
  const isl2 = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#mapPath .isl')].map(e => [e.getAttribute('data-id'), !e.classList.contains('fogged')])));
  check('finiti anche i dolci si apre l\'arte (non la scienza)', isl2.art === true && isl2.science === false, JSON.stringify(isl2));
  await dismissGifts(page);
  // album per isola: 9 stelle nei dolci = 4 carte
  const sAlb = { 41: 3, 42: 3, 43: 3 };
  await page.evaluate(s => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 5, stars: s, best: {}, seen: {}, revealed: {}, coins: 3 })); }, sAlb);
  await page.reload(); await page.waitForTimeout(700);
  check('l\'album dei dolci ha 4 carte con 9 stelle (1 ogni 2 ★)', (await dbg(page, () => window.__dbg.islandEarned('sweets'))) === 4);
  await page.click('#bAlbum'); await page.waitForTimeout(300);
  await page.click('#albSets .albset[data-s="sweets"]'); await page.waitForTimeout(250);
  check('si apre l\'album dei dolci: 14 carte, 4 scoperte', (await page.evaluate(() => document.querySelectorAll('#albGrid .albcard').length)) === 14 && (await page.evaluate(() => document.querySelectorAll('#albGrid .albcard:not(.lock)').length)) === 4);
  await page.screenshot({ path: SHOTS + '/album_dolci.png' });
  await page.click('#albClose'); await page.waitForTimeout(200);
  await dbg(page, () => window.__dbg.albumCheck()); await page.waitForTimeout(500);
  const g1 = await T(page, '#giftTitle'); await page.click('#bGiftOk'); await page.waitForTimeout(800);
  check('prima compare la carta dell\'album degli animali, poi quella dell\'isola dei dolci', g1.includes('Nouvelle carte') && await has(page, 'gift') && (await T(page, '#giftTitle')).includes('Île des douceurs'), g1 + ' → ' + await T(page, '#giftTitle'));
  await dismissGifts(page);
  await page.context().close();
  // TRIS: il rimescolo automatico quando non ci sono mosse
  page = await mk(390, 780, null, false);
  await page.evaluate(() => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 30, stars: {}, best: {}, seen: { 91: 1 }, revealed: { animals: true }, coins: 3, pzSeen: {} })); });
  await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(() => window.__dbg.startLevel(94)); await page.waitForTimeout(1700);
  const trisR = await page.evaluate(() => { const D = window.__dbg; const n0 = D.tiles.filter(t => !t.gone).length; D.tiles.filter(t => !t.gone).forEach((t, i) => { t.type = 40 + i; }); D.rescue(); return n0; });   // tutte diverse: nessun tris possibile
  await page.waitForTimeout(3200);
  const trisR2 = await page.evaluate(n0 => { const D = window.__dbg, al = D.tiles.filter(t => !t.gone), per = {}; al.forEach(t => { per[t.type] = (per[t.type] || 0) + 1; }); return { n: al.length, n0, mv: D.findMove() ? D.findMove().length : 0, mod: Object.values(per).every(c => c % 3 === 0) }; }, trisR);
  check('Tris: il rimescolo automatico mantiene le tessere, sono a gruppi di 3 e c\'è di nuovo un tris', trisR2.n === trisR2.n0 && trisR2.mv === 3 && trisR2.mod, JSON.stringify(trisR2));
  // tre tessere in fila (quella di mezzo è bloccata): nessun tris sarebbe possibile → si riordinano
  await page.evaluate(() => window.__dbg.startLevel(92)); await page.waitForTimeout(1700);
  await page.evaluate(() => { const D = window.__dbg; const al = D.tiles.filter(t => !t.gone); al.forEach((t, i) => { if (i >= 3) { t.gone = true; t.el.classList.add('gone', 'hidden'); } else { t.x = i; t.y = 0; t.z = 0; t.type = 40 + i; } }); D.rescue(); });
  await page.waitForTimeout(3200);
  const row3 = await page.evaluate(() => { const D = window.__dbg, al = D.tiles.filter(t => !t.gone); return { n: al.length, mv: D.findMove() ? D.findMove().length : 0, same: new Set(al.map(t => t.type)).size }; });
  check('Tris: con tre tessere in fila (impossibile) vengono riordinate e il tris è possibile', row3.n === 3 && row3.mv === 3 && row3.same === 1, JSON.stringify(row3));
  await page.evaluate(() => { const D = window.__dbg; const m = D.findMove(); m.forEach(t => D.tap(t)); }); await page.waitForTimeout(900);
  check('e si può completare il livello', await dbg(page, () => window.__dbg.over));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 3. modali delle novità ----------
  section('Modali delle novità');
  page = await mk(390, 780, unlockAll);
  await page.evaluate(() => window.__dbg.startLevel(1)); await page.waitForTimeout(1800);
  check('livello 1: la modale compare', await has(page, 'intro'));
  await page.screenshot({ path: SHOTS + '/intro_1.png' });
  const s1 = await dbg(page, () => window.__dbg.secs); await page.waitForTimeout(2200);
  check('timer fermo finché la modale è aperta', s1 === await dbg(page, () => window.__dbg.secs));
  await page.click('#bIntroOk'); await page.waitForTimeout(2300);
  check('dopo «Compris» il timer riparte', (await dbg(page, () => window.__dbg.secs)) > s1);
  await page.evaluate(() => window.__dbg.startLevel(1)); await page.waitForTimeout(500);
  check('rientrando nel livello 1 la modale NON riappare', !(await has(page, 'intro')));
  for (const L of [3, 4, 8, 11, 13, 16, 19]) {
    await page.evaluate(l => window.__dbg.startLevel(l), L); await page.waitForTimeout(450);
    const v = await has(page, 'intro');
    if (v && (L === 4 || L === 11)) await page.screenshot({ path: SHOTS + '/intro_' + L + '.png' });
    check('livello ' + L + ': modale delle novità', v, v ? await T(page, '#introTitle') : '');
    if (v) await page.click('#bIntroOk');
  }
  for (const L of [2, 5, 12]) {
    await page.evaluate(l => window.__dbg.startLevel(l), L); await page.waitForTimeout(450);
    check('livello ' + L + ': nessuna modale (nessuna novità)', !(await has(page, 'intro')));
  }
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 4. annulla dopo rimescolo ----------
  section('Annulla dopo il rimescolo');
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 5);
  await play(page, 3, 150);
  check('prima del rimescolo la cronologia ha 3 mosse', await dbg(page, () => window.__dbg.history.length) === 3);
  await page.click('#bShuf'); await page.waitForTimeout(300);
  check('dopo il rimescolo la cronologia è vuota', await dbg(page, () => window.__dbg.history.length) === 0);
  await page.click('#bUndo'); await page.waitForTimeout(300);
  check('Annulla subito dopo spiega perché non si può', (await T(page, '#toast')).includes('mélange'), await T(page, '#toast'));
  await play(page, 2, 150);
  const l0 = await dbg(page, () => window.__dbg.tiles.filter(t => !t.gone).length);
  await page.click('#bUndo'); await page.waitForTimeout(300);
  const l1 = await dbg(page, () => window.__dbg.tiles.filter(t => !t.gone).length);
  check('Annulla di una mossa fatta dopo il rimescolo funziona', l1 === l0 + 2, l0 + ' -> ' + l1);
  await play(page, 80, 60);
  check('la partita si può finire', await dbg(page, () => window.__dbg.over));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 5. stelle e aiuti ----------
  section('Stelle e aiuti');
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 2);
  await play(page, 40, 40); await page.waitForTimeout(900);
  check('livello 2 veloce e senza aiuti → 3 stelle', await page.evaluate(() => document.querySelectorAll('#winStars .st.on').length) === 3);
  check('la scheda mostra "Aides utilisées : 0"', (await T(page, '#winInfo')).includes('0'), (await T(page, '#winInfo')).replace(/\s+/g, ' '));
  await page.screenshot({ path: SHOTS + '/win_noaids.png' });
  await startLevel(page, 2);
  for (let i = 0; i < 5; i++) { await page.click('#bHint'); await page.waitForTimeout(70); }
  await play(page, 40, 40); await page.waitForTimeout(900);
  check('con 5 aiuti → 1 stella', await page.evaluate(() => document.querySelectorAll('#winStars .st.on').length) === 1);
  await page.screenshot({ path: SHOTS + '/win_aids.png' });
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 6. pausa ----------
  section('Pausa');
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 5);
  check('il timer gira', await dbg(page, () => window.__dbg.timerOn));
  await page.click('#bPause'); await page.waitForTimeout(300);
  check('toccando il tempo compare la pausa', await has(page, 'pause'));
  check('in pausa il timer è fermo', !(await dbg(page, () => window.__dbg.timerOn)));
  await page.screenshot({ path: SHOTS + '/pausa.png' });
  const sp = await dbg(page, () => window.__dbg.secs); await page.waitForTimeout(2200);
  check('in pausa il tempo non avanza', sp === await dbg(page, () => window.__dbg.secs));
  await page.click('#bResume'); await page.waitForTimeout(2300);
  check('«Riprendi» fa ripartire il tempo', (await dbg(page, () => window.__dbg.secs)) > sp);
  // pausa automatica quando l'app va in background
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  check('pausa automatica quando la pagina va in background', await has(page, 'pause') && !(await dbg(page, () => window.__dbg.timerOn)));
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  await page.click('#bResume'); await page.waitForTimeout(500);
  check('dopo la ripresa il gioco continua', await dbg(page, () => window.__dbg.timerOn));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 7. guida ----------
  section('Guida «?»');
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 12);
  await page.click('#bGuide'); await page.waitForTimeout(400);
  check('il pulsante «?» apre la guida', await has(page, 'guide'));
  const nItems = await page.evaluate(() => document.querySelectorAll('#guideList .gitem').length);
  const nLocked = await page.evaluate(() => document.querySelectorAll('#guideList .gitem.lockedg').length);
  check('la guida elenca tutte le novità (11 voci: 8 dei livelli iniziali + tessere d\'oro, nebbia e Tris)', nItems === 11 && nLocked === 3, nItems + ' voci, ' + nLocked + ' ancora bloccate');
  check('il timer è fermo mentre la guida è aperta', !(await dbg(page, () => window.__dbg.timerOn)));
  await page.screenshot({ path: SHOTS + '/guida.png' });
  await page.click('#bGuideOk'); await page.waitForTimeout(300);
  check('chiudendo la guida il timer riparte', await dbg(page, () => window.__dbg.timerOn));
  await page.context().close();
  page = await mk(390, 780, () => { if (!localStorage.getItem('mj_prog3')) localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 3, stars: {}, best: {}, seen: {} })); });
  await page.click('#bGuideMenu'); await page.waitForTimeout(300);
  const nLocked2 = await page.evaluate(() => document.querySelectorAll('#guideList .gitem.lockedg').length);
  check('dal menu: i livelli non ancora raggiunti restano nascosti', nLocked2 === 9, nLocked2 + ' bloccate su 11');
  await page.context().close();



  // ---------- 7a. tessere bloccate: chi le blocca ----------
  section('Tessere bloccate: chi le blocca');
  page = await mk(390, 780, unlockAll);
  const cnt = (p, c) => p.evaluate(k => document.querySelectorAll('.tile.' + k).length, c);
  // livello 1: tavola piatta 4×4, la tessera (x=1,y=1) ha una vicina a sinistra e una a destra
  await startLevel(page, 1);
  const idxSide = await page.evaluate(() => window.__dbg.tiles.findIndex(t => t.x === 1 && t.y === 1));
  await clickTile(page, idxSide); await page.waitForTimeout(250);
  check('bloccata di lato: si evidenziano le 2 vicine (sinistra e destra)', (await cnt(page, 'blocker')) === 2, (await cnt(page, 'blocker')) + ' evidenziate');
  check('la tessera toccata trema (target)', (await cnt(page, 'target')) === 1);
  check('il messaggio spiega «libera un lato»', (await T(page, '#toast')).includes('côté'), await T(page, '#toast'));
  await page.screenshot({ path: SHOTS + '/blocca_lato.png' });
  await page.waitForTimeout(2600);
  check('dopo 2 secondi le evidenziazioni spariscono', (await cnt(page, 'blocker')) === 0 && (await cnt(page, 'target')) === 0);
  // livello 4: tessere sovrapposte
  await startLevel(page, 4);
  const idxTop = await page.evaluate(() => { const T = window.__dbg.tiles; return T.findIndex(t => t.z === 0 && T.some(u => u.z === 1 && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1)); });
  // la tessera sotto è coperta da quella sopra (spostata di 4-5 px): si cerca un punto del bordino che resta scoperto
  const sliver = await page.evaluate(k => {
    const el = window.__dbg.tiles[k].el, r = el.getBoundingClientRect();
    for (let y = r.bottom - 1; y > r.top; y -= 1.5) for (let x = r.right - 1; x > r.left; x -= 1.5) if (document.elementFromPoint(x, y) === el) return [x, y];
    return [r.right - 6, r.bottom - 2];
  }, idxTop);
  await page.mouse.click(sliver[0], sliver[1]); await page.waitForTimeout(250);
  check('bloccata da sopra: si evidenzia la tessera che la copre', (await cnt(page, 'blocker')) >= 1);
  check('il messaggio spiega «togli prima quelle sopra»', (await T(page, '#toast')).includes('dessus'), await T(page, '#toast'));
  await page.screenshot({ path: SHOTS + '/blocca_sopra.png' });
  // una nuova mossa cancella subito le evidenziazioni
  const mvb = await nextMove(page); await clickTile(page, mvb[0]); await page.waitForTimeout(150);
  check('toccando un\'altra tessera le evidenziazioni spariscono subito', (await cnt(page, 'blocker')) === 0);
  // livello 11: toccare una nascosta fa pulsare le stelle libere
  await startLevel(page, 11);
  // una tessera nascosta NON coperta da altre (altrimenti il tocco finirebbe sulla tessera sopra)
  const idxLock = await page.evaluate(() => { const T = window.__dbg.tiles; const free = T.findIndex(t => t.hid && !t.gone && !T.some(u => !u.gone && u.z === t.z + 1 && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1)); return free >= 0 ? free : T.findIndex(t => t.hid && !t.gone); });
  const diag = await page.evaluate(k => { const T = window.__dbg.tiles, el = T[k].el, r = el.getBoundingClientRect(); let p = [r.left + r.width / 2, r.top + r.height / 2];
    outer: for (let y = r.bottom - 1; y > r.top; y -= 1.5) for (let x = r.right - 1; x > r.left; x -= 1.5) if (document.elementFromPoint(x, y) === el) { p = [x, y]; break outer; }
    const hit = document.elementFromPoint(p[0], p[1]); return { k, hid: T[k].hid, cls: hit && hit.className, same: hit === el, intro: document.getElementById('intro').classList.contains('show'), lv: window.__dbg.lv, unl: window.__dbg.unl }; }, idxLock);
  await clickExposed(page, idxLock); await page.waitForTimeout(250);
  // si aspetta fino a 2 secondi (sotto carico il browser può essere lento)
  let nHint = 0; for (let i = 0; i < 20 && nHint < 2; i++) { nHint = await cnt(page, 'hint'); if (nHint < 2) await page.waitForTimeout(100); }
  check('toccando una tessera nascosta pulsano le stelle libere', nHint >= 2, nHint + ' stelle | ' + JSON.stringify(diag) + ' | toast: ' + (await T(page, '#toast')));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 7b. impostazioni ----------
  section('Impostazioni ⚙️');
  page = await mk(390, 780, unlockAll);
  const cssv = (p, n) => p.evaluate(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), n);
  const bodyHas = (p, c) => p.evaluate(k => document.body.classList.contains(k), c);
  const swClick = async (p, key) => { await p.click('#setBody .srow[data-k="' + key + '"] .sw'); await p.waitForTimeout(120); };
  await page.click('#bSetMenu'); await page.waitForTimeout(300);
  check('dal menu si apre Impostazioni', await has(page, 'settings'));
  check('ci sono i 7 gruppi: Mascotte, Difficoltà, Aspetto, Comfort, Aiuti, Suono, Lingua', (await page.evaluate(() => document.querySelectorAll('#setBody .sgroup').length)) === 7);
  await page.screenshot({ path: SHOTS + '/impostazioni_1.png' });
  await page.click('#setBody .swatch[data-k="ocean"]'); await page.waitForTimeout(100);
  check('sfondo «oceano» applicato', (await cssv(page, '--felt-a')) === '#1f6f94', await cssv(page, '--felt-a'));
  await page.click('#setBody .swatches:nth-of-type(1) .swatch[data-k="pink"]').catch(() => {});
  await page.evaluate(() => document.querySelector('#setBody .swatch[data-k="pink"]').click()); await page.waitForTimeout(100);
  check('colore bordo tessere «rosa» applicato', (await cssv(page, '--edge')) === '#d8628f', await cssv(page, '--edge'));
  await swClick(page, 'hc');
  check('contrasto alto: classi hc + cb sul body', await bodyHas(page, 'hc') && await bodyHas(page, 'cb'));
  await swClick(page, 'hc');
  check('contrasto alto spento: classi tolte', !(await bodyHas(page, 'hc')) && !(await bodyHas(page, 'cb')));
  await page.evaluate(() => { document.querySelector('#setBody .swatch[data-k="level"]').click(); document.querySelectorAll('#setBody .swatch[data-k="level"]')[1].click(); }); await page.waitForTimeout(100);
  await swClick(page, 'cb');
  check('segnali senza colore: palette sicura blu/arancio', await bodyHas(page, 'cb') && (await cssv(page, '--accent')).toLowerCase() === '#e69f00', await cssv(page, '--accent'));
  await swClick(page, 'cb');
  await page.evaluate(() => { const v = document.getElementById('setVol'); v.value = 40; v.dispatchEvent(new Event('input')); });
  check('volume 40 salvato', (await dbg(page, () => window.__dbg.S.vol)) === 40);
  check('le impostazioni sono salvate nel telefono (mj_set1)', await page.evaluate(() => JSON.parse(localStorage.getItem('mj_set1')).vol === 40));
  await page.click('#bSetOk'); await page.waitForTimeout(200);
  // senza pressione del tempo
  await startLevel(page, 2);
  await dbg(page, () => window.__dbg.setSecs(900));
  await play(page, 40, 30); await page.waitForTimeout(900);
  check('livello 2 lentissimo (tempo normale) → 1 stella', await page.evaluate(() => document.querySelectorAll('#winStars .st.on').length) === 1);
  await page.click('#bMenu'); await page.waitForTimeout(250); await page.click('#bSetMenu'); await page.waitForTimeout(250);
  check('in modalità normale il cronometro mostra le cifre', /\d:\d\d/.test(await T(page, '#time')), await T(page, '#time'));
  await swClick(page, 'nt'); await page.click('#bSetOk'); await page.waitForTimeout(150);
  check('con «senza pressione del tempo» il cronometro è nascosto', !/\d:\d\d/.test(await T(page, '#time')), await T(page, '#time'));
  await startLevel(page, 2);
  await dbg(page, () => window.__dbg.setSecs(900));
  await play(page, 40, 30); await page.waitForTimeout(900);
  check('lo stesso con «senza pressione del tempo» → 3 stelle', await page.evaluate(() => document.querySelectorAll('#winStars .st.on').length) === 3);
  check('la regola mostrata cambia', (await T(page, '#winRule')).includes('temps'), await T(page, '#winRule'));
  check('«senza pressione del tempo»: la scheda non mostra tempo né record', !(await T(page, '#winInfo')).includes('Temps'), (await T(page, '#winInfo')).replace(/\s+/g, ' '));
  // barra delle tessere selezionate
  await page.click('#bMenu'); await page.waitForTimeout(250); await page.click('#bSetMenu'); await page.waitForTimeout(250);
  await swClick(page, 'nt'); await swClick(page, 'bar'); await page.click('#bSetOk'); await page.waitForTimeout(250);
  check('la barra compare', await page.evaluate(() => getComputedStyle(document.getElementById('selbar')).display) === 'flex');
  await startLevel(page, 5);
  const wBar = await page.evaluate(() => Math.round(window.__dbg.tiles[0].el.getBoundingClientRect().width));
  check('con la barra le tessere restano di taglia media (≥ 44 px)', wBar >= 44, wBar + ' px');
  const mv = await nextMove(page);
  await clickTile(page, mv[0]); await page.waitForTimeout(200);
  check('toccando una tessera appare ingrandita nella barra, con il nome', (await page.evaluate(() => !!document.querySelector('#sb1 svg'))) && (await T(page, '#sbName')).length > 0, await T(page, '#sbName'));
  await page.screenshot({ path: SHOTS + '/barra_1.png' });
  await clickTile(page, mv[1]); await page.waitForTimeout(150);
  check('la seconda tessera uguale mostra ✔', (await T(page, '#sbStat')) === '✔');
  check('la striscia delle ultime coppie ha 1 tessera', await page.evaluate(() => document.querySelectorAll('#sbRec .mt').length) === 1);
  await page.screenshot({ path: SHOTS + '/barra_2.png' });
  // tessera diversa → ✖
  const mv2 = await nextMove(page);
  const other = await page.evaluate(([a]) => { const T = window.__dbg.tiles; const al = T.filter(t => !t.gone); const f = al.filter(t => { return true; }); return null; }, [mv2[0]]);
  // contrasto alto + daltonismo: schermate
  await page.click('#bLevel'); await page.waitForTimeout(250); await page.click('#bSetMenu'); await page.waitForTimeout(250);
  await swClick(page, 'hc'); await page.click('#bSetOk'); await page.waitForTimeout(250);
  await page.evaluate(() => window.__dbg.startLevel(11)); await page.waitForTimeout(400);
  if (await has(page, 'intro')) await page.click('#bIntroOk');
  await page.waitForTimeout(1800);
  check('contrasto alto: le tessere bloccate hanno il tratteggio', await page.evaluate(() => { const e = document.querySelector('.tile.blocked'); return e ? getComputedStyle(e, '::after').content !== 'none' : false; }));
  await page.screenshot({ path: SHOTS + '/contrasto_alto.png' });
  // testi grandi a 360 px
  await page.click('#bLevel'); await page.waitForTimeout(250); await page.click('#bSetMenu'); await page.waitForTimeout(250);
  await swClick(page, 'hc'); await swClick(page, 'ui'); await page.click('#bSetOk'); await page.waitForTimeout(250);
  await page.setViewportSize({ width: 360, height: 740 }); await page.waitForTimeout(400);
  await page.evaluate(() => window.__dbg.startLevel(12)); await page.waitForTimeout(400);
  if (await has(page, 'intro')) await page.click('#bIntroOk');
  await page.waitForTimeout(1800);
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, nav: document.querySelector('nav').getBoundingClientRect().bottom, ih: innerHeight }));
  // con isMobile il browser allarga la finestra se il contenuto è troppo largo: si confronta con 360, non con innerWidth
  check('testi grandi a 360 px: nulla esce a destra e i pulsanti sono visibili', ov.sw <= 360 && ov.iw <= 360 && ov.nav <= ov.ih, JSON.stringify(ov));
  await page.screenshot({ path: SHOTS + '/testi_grandi_360.png' });
  // persistenza
  const before2 = await dbg(page, () => JSON.stringify(window.__dbg.S));
  const stored2 = await page.evaluate(() => localStorage.getItem('mj_set1'));
  await page.reload(); await page.waitForTimeout(500);
  const after2 = await dbg(page, () => JSON.stringify(window.__dbg.S));
  const stored3 = await page.evaluate(() => localStorage.getItem('mj_set1'));
  const body3 = await page.evaluate(() => document.body.className);
  const rawAfter = await page.evaluate(() => localStorage.getItem('mj_set1') + ' | url ' + location.href.slice(-30) + ' | menu ' + document.getElementById('menu').classList.contains('show'));
  check('dopo il ricaricamento le impostazioni restano', before2 === after2 && await bodyHas(page, 'bigui'), 'prima ' + before2 + ' | salvato ' + stored2 + ' | dopo ' + after2 + ' | raw ' + rawAfter);
  // ripristino (dopo il ricaricamento si riparte dalla mappa)
  await page.click('#isl_prologue'); await page.waitForTimeout(250);
  await page.click('#bSetMenu'); await page.waitForTimeout(250);
  await page.click('#bSetReset'); await page.waitForTimeout(250);
  const S2 = await dbg(page, () => window.__dbg.S);
  check('«Ripristina predefiniti» riporta tutto come all\'inizio', S2.bg === 'level' && S2.tile === 'level' && !S2.ui && !S2.hc && !S2.cb && !S2.nt && !S2.bar && S2.vol === 100 && S2.vib === 1, JSON.stringify(S2));
  check('e le classi sul body sono tolte', !(await bodyHas(page, 'bigui')) && !(await bodyHas(page, 'hc')));
  check('la lingua dentro Impostazioni funziona', await page.evaluate(() => { document.querySelector('#settings button[data-l="en"]').click(); return document.getElementById('setTitle').textContent === 'Settings'; }));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();


  // ---------- 7c. piccoli aiuti ----------
  section('Piccoli aiuti: chi blocca, tessere uguali, aiuto automatico');
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 5);
  const blockedIdx = await page.evaluate(() => window.__dbg.tiles.findIndex(t => !t.gone && t.el.classList.contains('blocked') && !t.el.classList.contains('locked')));
  check('c\'è una tessera bloccata da provare', blockedIdx >= 0);
  await clickTile(page, blockedIdx); await page.waitForTimeout(300);
  const nb = await page.evaluate(() => ({ blockers: document.querySelectorAll('.tile.blocker').length, target: document.querySelectorAll('.tile.target').length }));
  check('toccando una bloccata si evidenziano le tessere che la bloccano', nb.blockers >= 1 && nb.target === 1, JSON.stringify(nb));
  check('compare un messaggio che spiega cosa fare', (await T(page, '#toast')).length > 5, await T(page, '#toast'));
  await page.screenshot({ path: SHOTS + '/chi_blocca.png' });
  await page.waitForTimeout(2600);
  check('dopo qualche secondo l\'evidenziazione sparisce', await page.evaluate(() => document.querySelectorAll('.tile.blocker').length) === 0);
  // tessera nascosta: pulsano le stelle libere
  await startLevel(page, 11);
  // una nascosta NON coperta da altre: il tocco al centro di una coperta finirebbe sulla tessera sopra
  const lockedIdx = await page.evaluate(() => { const T = window.__dbg.tiles; const k = T.findIndex(t => t.hid && !t.gone && !T.some(u => !u.gone && u.z === t.z + 1 && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1)); return k >= 0 ? k : T.findIndex(t => t.hid && !t.gone); });
  await clickExposed(page, lockedIdx); await page.waitForTimeout(250);
  check('toccando una tessera nascosta (seconda prova) pulsano le stelle libere', await page.evaluate(() => [...document.querySelectorAll('.tile.hint')].length) >= 2);
  await page.context().close();

  page = await mk(390, 780, unlockAll);
  await page.click('#bSetMenu'); await page.waitForTimeout(250);
  await swClick(page, 'eq'); await swClick(page, 'auto');
  check('le due opzioni sono spente di default e si accendono', await dbg(page, () => window.__dbg.S.eq === 1 && window.__dbg.S.auto === 1));
  await page.click('#bSetOk'); await page.waitForTimeout(200);
  await startLevel(page, 5);
  const pair = await nextMove(page);
  await clickTile(page, pair[0]); await page.waitForTimeout(200);
  const eqInfo = await page.evaluate(([a, b]) => ({ partner: window.__dbg.tiles[b].el.classList.contains('match'), self: window.__dbg.tiles[a].el.classList.contains('match'), n: document.querySelectorAll('.tile.match').length }), pair);
  check('selezionando una tessera si illumina la compagna libera, non lei stessa', eqInfo.partner && !eqInfo.self && eqInfo.n >= 1, JSON.stringify(eqInfo));
  await page.screenshot({ path: SHOTS + '/tessere_uguali.png' });
  await clickTile(page, pair[0]); await page.waitForTimeout(150);
  check('deselezionando le luci spariscono', await page.evaluate(() => document.querySelectorAll('.tile.match').length) === 0);
  check('l\'attesa predefinita dell\'aiuto automatico è 2 minuti', await dbg(page, () => window.__dbg.idleMs) === 120000);
  await dbg(page, () => window.__dbg.setIdle(1500));   // per il test si accorcia l'attesa
  await page.waitForTimeout(2800);
  check('scaduta l\'attesa: una coppia lampeggia da sola', await page.evaluate(() => document.querySelectorAll('.tile.hint').length) >= 2);
  check('l\'aiuto automatico non conta come aiuto', await dbg(page, () => window.__dbg.aids) === 0);
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();


  // ---------- 7d. modalità comoda ----------
  section('Modalità comoda');
  page = await mk(390, 780, unlockAll);
  await page.click('#bSetMenu'); await page.waitForTimeout(300);
  check('la riga «Modalità comoda» è nel gruppo Confort', await page.evaluate(() => !!document.querySelector('#setBody .srow[data-k="cf"]')));
  await page.click('#setBody .srow[data-k="cf"] .sw'); await page.waitForTimeout(150);
  check('attivata: salvata e testi grandi subito', (await dbg(page, () => window.__dbg.S.cf)) === 1 && await page.evaluate(() => document.body.classList.contains('bigui')));
  await page.click('#bSetOk'); await page.waitForTimeout(200);
  const geo = [];
  for (let L = 1; L <= 20; L++) {
    await page.evaluate(l => window.__dbg.startLevel(l), L); await page.waitForTimeout(350);
    await closeIntro(page);
    await page.waitForTimeout(1300);
    const g = await page.evaluate(() => {
      const T = window.__dbg.tiles;
      const cols = Math.max(...T.map(t => t.x)) + 1, rows = Math.max(...T.map(t => t.y)) + 1;
      const w = Math.round(T[0].el.getBoundingClientRect().width);
      const mv = window.__dbg.findMove();
      return { n: T.length, cols, rows, w, cf: window.__dbg.curCf, inf: document.getElementById('cHint').textContent === '∞', mv: !!mv, star: window.__dbg.G() === 0 || (!!mv && mv[0].type === 26) };
    });
    geo.push(L + ':' + g.n + 't ' + g.cols + 'x' + g.rows + ' ' + g.w + 'px');
    const ok = g.cf && g.cols <= 5 && g.rows <= 6 && g.w >= (L === 1 ? 78 : 62) && g.inf && g.mv && g.star && g.n % 2 === 0;
    check('livello ' + L + ' comodo: ≤5×6, tessere grandi, aiuti ∞, mossa e stella subito possibili', ok, JSON.stringify(g));
    if (L === 5 || L === 11 || L === 20) await page.screenshot({ path: SHOTS + '/comoda_' + L + '.png' });
  }
  await startLevel(page, 5);
  const mvc = await nextMove(page);
  await clickTile(page, mvc[0]); await page.waitForTimeout(200);
  check('le tessere uguali si illuminano da sole (la modalità comoda accende «illumina uguali»)', (await page.evaluate(() => document.querySelectorAll('.tile.match').length)) >= 1);
  check('le altre tessere libere si abbassano di luce', (await page.evaluate(() => document.querySelectorAll('.tile.fade').length)) >= 1);
  check('le tessere uguali hanno il bollino ✔', await page.evaluate(() => { const e = document.querySelector('.tile.match'); return e ? getComputedStyle(e, '::before').content.includes('✔') : false; }));
  await page.screenshot({ path: SHOTS + '/comoda_match.png' });
  await clickTile(page, mvc[0]); await page.waitForTimeout(150);
  check('deselezionando, le evidenziazioni spariscono', (await page.evaluate(() => document.querySelectorAll('.tile.match,.tile.fade').length)) === 0);
  check('il cronometro è nascosto in Modalità comoda (niente cifre del tempo)', !/\d:\d\d/.test(await T(page, '#time')) && (await T(page, '#timeLbl')).includes('Pause'), (await T(page, '#time')) + ' / ' + (await T(page, '#timeLbl')));
  check('l\'aiuto automatico scatta dopo 2 minuti (120000 ms)', (await dbg(page, () => window.__dbg.idleMs)) === 120000);
  await dbg(page, () => window.__dbg.setIdle(1500));   // per il test si accorcia l'attesa
  await page.waitForTimeout(2800);
  check('allo scadere dell\'attesa pulsa da sola una coppia (aiuto automatico)', (await page.evaluate(() => document.querySelectorAll('.tile.hint').length)) >= 2);
  await dbg(page, () => window.__dbg.setIdle(120000));
  // un salvataggio fatto in modalità comoda si riprende con la stessa tavola anche se poi la si spegne
  await play(page, 2, 150);
  const leftC = await dbg(page, () => window.__dbg.tiles.filter(t => !t.gone).length), totC = await dbg(page, () => window.__dbg.tiles.length);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mj_set1')); s.cf = 0; localStorage.setItem('mj_set1', JSON.stringify(s)); });
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#resumeBoxMap .resumebtn'); await page.waitForTimeout(700);
  const rs = await dbg(page, () => ({ tot: window.__dbg.tiles.length, left: window.__dbg.tiles.filter(t => !t.gone).length, cf: window.__dbg.curCf, setcf: window.__dbg.S.cf }));
  check('ripresa: la tavola comoda resta comoda anche se la modalità è stata spenta', rs.tot === totC && rs.left === leftC && rs.cf === true && rs.setcf === 0, JSON.stringify(rs) + ' atteso ' + totC + '/' + leftC);
  await startLevel(page, 5);
  const nonC = await dbg(page, () => ({ tot: window.__dbg.tiles.length, cf: window.__dbg.curCf }));
  check('con la modalità spenta una nuova partita usa la tavola normale', nonC.tot === 48 && nonC.cf === false, JSON.stringify(nonC));
  console.log('   misure: ' + geo.join(' | '));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 8. salvataggio e ripresa ----------
  section('Salvataggio e ripresa');
  page = await mk(390, 780, unlockAll);
  await startLevel(page, 11);
  await play(page, 6, 120);
  const before = await dbg(page, () => ({ left: window.__dbg.tiles.filter(t => !t.gone).length, unl: window.__dbg.unl, hist: window.__dbg.history.length }));
  check('livello 11: la coppia di stelle ha sbloccato il gruppo', before.unl === 1, JSON.stringify(before));
  await page.waitForTimeout(1200);
  await page.reload(); await page.waitForTimeout(600);
  check('dopo il ricaricamento compare «Riprendi la partita»', (await page.evaluate(() => !!document.querySelector('#resumeBoxMap .resumebtn'))), (await T(page, '#resumeBoxMap')).replace(/\s+/g, ' '));
  await page.screenshot({ path: SHOTS + '/riprendi.png' });
  await page.click('#resumeBoxMap .resumebtn'); await page.waitForTimeout(700);
  const after = await dbg(page, () => ({ left: window.__dbg.tiles.filter(t => !t.gone).length, unl: window.__dbg.unl, hist: window.__dbg.history.length, lv: window.__dbg.lv }));
  check('tessere rimaste, gruppi sbloccati e cronologia identici', after.left === before.left && after.unl === before.unl && after.hist === before.hist, JSON.stringify(after));
  check('la partita ripresa è del livello 11', after.lv === 11);
  check('nessuna modale dopo la ripresa (già vista)', !(await has(page, 'intro')));
  await page.click('#bUndo'); await page.waitForTimeout(300);
  const l2 = await dbg(page, () => window.__dbg.tiles.filter(t => !t.gone).length);
  check('Annulla funziona dopo la ripresa', l2 === after.left + 2, after.left + ' -> ' + l2);
  await play(page, 120, 30);
  check('la partita ripresa si può finire', await dbg(page, () => window.__dbg.over));
  check('a vittoria il salvataggio viene cancellato', await page.evaluate(() => localStorage.getItem('mj_save1') === null));
  check('nessun errore di pagina', page.errs.length === 0, page.errs.join(' | '));
  await page.context().close();

  // ---------- 9. intestazione a 360 px ----------
  section('Intestazione su schermi stretti');
  for (const w of [360, 390]) {
    page = await mk(w, 740, unlockAll);
    await startLevel(page, 11);
    const m = await page.evaluate(() => { const h = document.querySelector('header'); const kids = [...h.querySelectorAll('.stats > *')].filter(e => e.offsetParent); const last = kids[kids.length - 1].getBoundingClientRect(); return { sw: h.scrollWidth, cw: h.clientWidth, right: Math.round(last.right), vw: innerWidth }; });
    check('larghezza ' + w + ' px: nulla esce dallo schermo', m.sw <= m.cw + 1 && m.right <= m.vw, JSON.stringify(m));
    const clip = await page.evaluate(() => { const b = document.getElementById('bLevel').getBoundingClientRect(); const n = document.getElementById('lvNum').getBoundingClientRect(); return { numRight: Math.round(n.right), btnRight: Math.round(b.right) }; });
    check('larghezza ' + w + ' px: il titolo del livello non è tagliato', clip.numRight <= clip.btnRight, JSON.stringify(clip));
    if (w === 360) await page.screenshot({ path: SHOTS + '/header_360.png' });
    await page.context().close();
  }

  } // fine sezioni 2-9

  // ---------- 10. tutti i livelli ----------
  if (!QUICK || LV_RANGE) {
    section('Tutti i 20 livelli, con click reali');
    page = await mk(390, 780, COMFORT_RUN ? () => { localStorage.setItem('mj_prog3', JSON.stringify({ unlocked: 20, stars: {}, best: {}, seen: {} })); localStorage.setItem('mj_set1', JSON.stringify({ cf: 1 })); } : unlockAll);
    const lo = LV_RANGE ? LV_RANGE[0] : 1, hi = LV_RANGE ? LV_RANGE[1] : 20;   // senza --levels si giocano i 20 livelli iniziali; --levels=21-40 per l'isola
    const langs = [['fr', 1, 10], ['en', 11, 19], ['it', 20, 20], ['fr', 21, 100]].map(([lg, a, b]) => [lg, Math.max(a, lo), Math.min(b, hi)]).filter(([, a, b]) => a <= b);
    const out = [];
    for (const [lg, a, b] of langs) {
      await page.evaluate(l => document.querySelector('#langs button[data-l="' + l + '"]').click(), lg);
      for (let L = a; L <= b; L++) {
        await dismissGifts(page);
        await startLevel(page, L);
        await play(page, 250, 0);
        await page.waitForTimeout(500);
        const ok = await dbg(page, () => window.__dbg.over);
        await page.waitForTimeout(1500); await dismissGifts(page);   // nuove carte dell'album
        out.push((ok ? '' : '✘') + L);
        check('livello ' + L + ' (' + lg + ') completato', ok);
      }
      await page.evaluate(() => document.getElementById('win').classList.remove('show'));
    }
    check('nessun errore di pagina in tutta la sessione', page.errs.length === 0, page.errs.join(' | '));
    await page.context().close();
  }

  await browser.close();
  if (server) server.close();
  console.log('\n==== RISULTATO: ' + pass + ' ok, ' + fail + ' falliti ====');
  console.log('Screenshot in: ' + SHOTS);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRORE NEL TEST:', e); process.exit(2); });
