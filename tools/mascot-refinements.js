// Ritocchi alle mascotte dell'originale (`docs/gioco-originale.md`, «Scelte della nuova app»). Ogni ritocco sostituisce un
// frammento SVG dell'originale con uno migliore; il frammento da sostituire deve comparire una volta sola nel disegno
// originale, altrimenti `tools/export-mascots.js` si ferma (se l'originale cambia, i ritocchi vanno rivisti). Il siamese a pelo
// corto resta com'è. Le funzioni che compongono i frammenti sono quelle dell'originale (`mp`, `mn`, `me`, riga 800).
const MK = '#2b2230';
const mp = (d, fill, w) => `<path d="${d}" fill="${fill}" stroke="${MK}" stroke-width="${w || 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
const me = (x, y, rx, ry, fill, w, tr) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${w === 0 ? '' : ` stroke="${MK}" stroke-width="${w || 2}"`}${tr ? ` transform="${tr}"` : ''}/>`;

const JAW = '#f4f6fb';

/** `{ id: [[frammento dell'originale, frammento ritoccato], …] }`. */
const REFINEMENTS = {
  // La mandibola (il «mento» bianco sotto il naso) nell'originale è uno scudo lungo 28 unità che pende sul petto, staccato dal
  // muso: sembra un bavaglino. Accorciata e attaccata al muso diventa una mandibola con la lingua.
  collie: [[mp('M43 74 Q50 69 57 74 L60 92 Q50 112 40 92Z', JAW, 1.8), mp('M43 74 Q50 69 57 74 L58 87 Q50 98 42 87Z', JAW, 1.8)]],
  sheltie: [
    // Stessa mandibola del collie.
    [mp('M43 73 Q50 68 57 73 L60 92 Q50 112 40 92Z', JAW, 1.8), mp('M43 73 Q50 68 57 73 L58 86 Q50 97 42 86Z', JAW, 1.8)],
    // Le guance focate nell'originale sporgono fuori dal viso come due ovali arancioni; qui stanno dentro il contorno della testa.
    [
      me(29, 52, 6, 9, '#cf7a30', 0, 'rotate(-14 29 52)') + me(71, 52, 6, 9, '#cf7a30', 0, 'rotate(14 71 52)'),
      me(37, 52, 4.5, 6.5, '#cf7a30', 0, 'rotate(-14 37 52)') + me(63, 52, 4.5, 6.5, '#cf7a30', 0, 'rotate(14 63 52)'),
    ],
  ],
  // I ciuffi delle guance nell'originale sono zig-zag taglienti; con lobi morbidi sembrano pelo.
  siamlong: [
    [mp('M20 52 L6 56 L15 62 L3 69 L14 73 L6 83 L22 78 L26 66Z', '#f6ead4'), mp('M21 52 Q8 52 9 59 Q1 62 7 68 Q0 74 9 77 Q7 85 21 79 L26 66Z', '#f6ead4')],
    [mp('M80 52 L94 56 L85 62 L97 69 L86 73 L94 83 L78 78 L74 66Z', '#f6ead4'), mp('M79 52 Q92 52 91 59 Q99 62 93 68 Q100 74 91 77 Q93 85 79 79 L74 66Z', '#f6ead4')],
  ],
};

/** Applica i ritocchi di `id` al disegno `art`; si ferma se un frammento da sostituire non c'è o non è unico. */
function refine(id, art) {
  let out = art;
  for (const [from, to] of REFINEMENTS[id] || []) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`mascotte «${id}»: il frammento da ritoccare compare ${count} volte invece di 1 («${from.slice(0, 50)}…»)`);
    out = out.replace(from, () => to);
  }
  return out;
}

module.exports = { REFINEMENTS, refine };
