// Genera src/data/tileSources.ts: l'elenco dei require() dei 129 SVG, in ordine di indice.
// Uso: node tools/generate-tile-index.js   (dalla cartella del prototipo)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'tiles');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
const lines = files.map((f) => `  require('../../assets/tiles/${f}'),`);
const out = `// Generato da tools/generate-tile-index.js: non modificare a mano.\n// Indice nell'array = indice del disegno nell'originale (0-128).\nexport const TILE_SOURCES: number[] = [\n${lines.join('\n')}\n];\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'tileSources.ts'), out);
console.log('tileSources.ts:', files.length, 'disegni');
