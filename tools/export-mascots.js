// Esporta dall'HTML originale le quattro mascotte (busti a fumetto) come SVG e genera l'elenco dei file.
// Uso: node tools/export-mascots.js "<percorso di Majoa Mahjong.html>"   (dalla radice del progetto)
// Scrive assets/mascots/<id>.svg e src/infrastructure/content/mascotSources.ts. Le mascotte nell'originale (`MASCOTS`, riga 821)
// sono funzioni che compongono stringhe SVG: si estrae il blocco dalle funzioni di disegno (`mp`, `ml`, `mn`, `me`, `almond`)
// a `mascotSvg` e lo si esegue in un contesto isolato, senza DOM né browser. Il modulo esporta anche `extract`, che usa il test
// che confronta i file con l'originale.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const START = 'var MK=';
const END = 'function mascotSvg(';

/** Esegue il blocco delle mascotte dell'originale e restituisce `{ id: { viewBox, svg } }` nell'ordine dell'originale. */
function extract(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start) throw new Error("blocco delle mascotte non trovato: la struttura dell'originale è cambiata");
  const mascots = vm.runInNewContext(`${html.slice(start, end)}\n;MASCOTS`, {}, { timeout: 2000 });
  const out = {};
  for (const [id, m] of Object.entries(mascots)) {
    if (typeof m.vb !== 'string' || typeof m.art !== 'string' || m.art.length === 0) throw new Error(`mascotte «${id}» non valida`);
    // Solo `viewBox`, mai `width` e `height` fissi: con attributi fissi SkSVG ignora la dimensione richiesta (`docs/rendering.md`).
    out[id] = { viewBox: m.vb, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.vb}">${m.art}</svg>` };
  }
  return out;
}

/** Il contenuto di `mascotSources.ts` per gli `ids` dati. */
function indexSource(ids) {
  const lines = ids.map((id) => `  ${id}: require('../../../assets/mascots/${id}.svg'),`);
  return `// Generato da tools/export-mascots.js: non modificare a mano.\n// Una mascotte per id (le stesse chiavi di \`MASCOTS\` nell'originale); «nessuna» non ha disegno.\nexport const MASCOT_SOURCES = {\n${lines.join('\n')}\n} as const;\n`;
}

module.exports = { extract, indexSource };

if (require.main === module) {
  const html = process.argv[2];
  if (!html) {
    console.error('Uso: node tools/export-mascots.js "<Majoa Mahjong.html>"');
    process.exit(2);
  }
  const root = path.join(__dirname, '..');
  const mascots = extract(html);
  const dir = path.join(root, 'assets', 'mascots');
  fs.mkdirSync(dir, { recursive: true });
  for (const [id, m] of Object.entries(mascots)) fs.writeFileSync(path.join(dir, `${id}.svg`), `${m.svg}\n`);
  fs.writeFileSync(path.join(root, 'src', 'infrastructure', 'content', 'mascotSources.ts'), indexSource(Object.keys(mascots)));
  console.log(`assets/mascots: ${Object.keys(mascots).length} mascotte (${Object.keys(mascots).join(', ')})`);
}
