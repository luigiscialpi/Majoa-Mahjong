// Genera src/infrastructure/content/tileSources.ts: l'elenco dei require() dei 129 SVG di assets/tiles, in ordine di indice.
// Uso: node tools/generate-tile-index.js   (dalla radice del progetto)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'assets', 'tiles')).filter((f) => f.endsWith('.svg')).sort();
const lines = files.map((f) => `  require('../../../assets/tiles/${f}'),`);
const out = `// Generato da tools/generate-tile-index.js: non modificare a mano.\n// Indice nell'array = indice del disegno nell'originale (0-128).\nexport const TILE_SOURCES: number[] = [\n${lines.join('\n')}\n];\n`;
fs.writeFileSync(path.join(root, 'src', 'infrastructure', 'content', 'tileSources.ts'), out);
console.log(`tileSources.ts: ${files.length} disegni`);
