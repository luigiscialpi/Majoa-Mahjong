// Esporta dall'HTML originale i disegni di ogni isola e la tavolozza di ogni livello.
// Uso: node tools/export-themes.js "<percorso di Majoa Mahjong.html>" <file di uscita .json>
// Carica l'originale in jsdom (installato con jest-expo) con lo stesso gancio di prototipi/s4-generatore/tools/export-levels.js,
// quindi non serve un browser. Il modulo esporta anche `extract`, che usa il test che confronta il JSON con l'originale.
const fs = require('fs');

const HOOK = 'openMap(); window.__x={get ISLANDS(){return ISLANDS},get LEVELS(){return LEVELS},get STAR_IDX(){return STAR_IDX},get NT(){return NT}};})();</script>';

/** Esegue l'originale in jsdom e ne legge isole e livelli. Restituisce { starDesign, designCount, islands, palettes }. */
async function extract(htmlPath) {
  const { JSDOM, VirtualConsole } = require('jsdom');
  const patched = fs.readFileSync(htmlPath, 'utf8').replace(/openMap\(\);\s*\}\)\(\);\s*<\/script>/, HOOK);
  if (!patched.includes('__x')) throw new Error('gancio non inserito: la struttura dell\'originale è cambiata');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String((e && e.message) || e)));
  const dom = new JSDOM(patched, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    url: 'http://localhost/',
    // L'originale usa API del browser che jsdom non ha: sostituti minimi, che non influiscono sui dati letti.
    beforeParse(w) {
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
      w.AudioContext = w.AudioContext || function () {
        return { createGain: () => ({ gain: param(), connect() {} }), createOscillator: () => ({ frequency: param(), connect() {}, start() {}, stop() {}, type: '' }), destination: {}, currentTime: 0, resume() {}, state: 'running' };
      };
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.speechSynthesis = w.speechSynthesis || { speak() {}, cancel() {}, getVoices: () => [] };
    },
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const x = dom.window.__x;
    if (!x) throw new Error(`l'originale non ha esposto i dati (errori: ${errors.slice(0, 2).join('; ') || 'nessuno'})`);
    const islands = {};
    for (const w of x.ISLANDS) islands[w.id] = w.pool.filter((k) => k !== x.STAR_IDX);
    return { starDesign: x.STAR_IDX, designCount: x.NT, islands, palettes: x.LEVELS.map((l) => l.th) };
  } finally {
    dom.window.close();
  }
}

module.exports = { extract };

if (require.main === module) {
  const [html, out] = process.argv.slice(2);
  if (!html || !out) {
    console.error('Uso: node tools/export-themes.js "<Majoa Mahjong.html>" <uscita.json>');
    process.exit(2);
  }
  extract(html).then(
    (data) => {
      fs.writeFileSync(out, JSON.stringify(data) + '\n');
      console.log(`${out}: ${Object.keys(data.islands).length} isole, ${data.palettes.length} tavolozze, ${data.designCount} disegni`);
      process.exit(0);
    },
    (e) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}
