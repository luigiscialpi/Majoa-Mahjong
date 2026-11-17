import {
  BG_PALETTE_COLORS,
  COLORBLIND_PALETTE,
  TILE_PALETTE_COLORS,
  bgPreviewColor,
  tilePreviewColor,
  resolveEffectivePalette,
} from './appearancePalettes';
import type { Palette } from './legacyThemes';

const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html';

/** Estrae un oggetto di array come `BGP={...}` dall'HTML originale. */
function extractObject(name: string): Record<string, string[]> {
  const source = fs.readFileSync(ORIGINAL_HTML, 'utf8');
  const match = new RegExp(`\\b${name}=\\{([^}]+)\\}`).exec(source);
  if (!match) throw new Error(`${name} non trovata in ${ORIGINAL_HTML}`);
  const out: Record<string, string[]> = {};
  const entries = match[1].split(/(?<=\]),/);
  for (const entry of entries) {
    const [k, v] = entry.split(':');
    if (!k || !v) continue;
    const cleanKey = k.trim();
    const cleanVals = v.replace(/[\[\]']/g, '').split(',').map((s) => s.trim());
    out[cleanKey] = cleanVals;
  }
  return out;
}

describe('appearancePalettes', () => {
  test('i colori di BG_PALETTE_COLORS coincidono esattamente con BGP dell\'originale', () => {
    const bgp = extractObject('BGP');
    expect(Object.keys(BG_PALETTE_COLORS)).toEqual(Object.keys(bgp));
    for (const [k, colors] of Object.entries(BG_PALETTE_COLORS)) {
      expect([colors.feltA, colors.feltB, colors.accent]).toEqual(bgp[k]);
    }
  });

  test('i colori di TILE_PALETTE_COLORS coincidono esattamente con TLP dell\'originale', () => {
    const tlp = extractObject('TLP');
    expect(Object.keys(TILE_PALETTE_COLORS)).toEqual(Object.keys(tlp));
    for (const [k, colors] of Object.entries(TILE_PALETTE_COLORS)) {
      expect([colors.edge, colors.edge2]).toEqual(tlp[k]);
    }
  });

  test('bgPreviewColor restituisce il colore del livello se key è level, altrimenti feltA della palette', () => {
    expect(bgPreviewColor('level', '#112233')).toBe('#112233');
    expect(bgPreviewColor('jade', '#112233')).toBe(BG_PALETTE_COLORS.jade.feltA);
    expect(bgPreviewColor('ocean', '#112233')).toBe(BG_PALETTE_COLORS.ocean.feltA);
  });

  test('tilePreviewColor restituisce il colore del livello se key è level, altrimenti edge della palette', () => {
    expect(tilePreviewColor('level', '#334455')).toBe('#334455');
    expect(tilePreviewColor('green', '#334455')).toBe(TILE_PALETTE_COLORS.green.edge);
    expect(tilePreviewColor('gold', '#334455')).toBe(TILE_PALETTE_COLORS.gold.edge);
  });

  test('resolveEffectivePalette mantiene la palette base se impostazioni sono level', () => {
    const base: Palette = ['#a', '#b', '#c', '#d', '#e'];
    expect(resolveEffectivePalette(base, 'level', 'level')).toEqual(base);
  });

  test('resolveEffectivePalette sovrascrive feltA, feltB, accent quando bgPalette non è level', () => {
    const base: Palette = ['#a', '#b', '#c', '#d', '#e'];
    const resolved = resolveEffectivePalette(base, 'ocean', 'level');
    expect(resolved).toEqual([
      BG_PALETTE_COLORS.ocean.feltA,
      BG_PALETTE_COLORS.ocean.feltB,
      BG_PALETTE_COLORS.ocean.accent,
      '#d',
      '#e',
    ]);
  });

  test('resolveEffectivePalette sovrascrive edge e edge2 quando tilePalette non è level', () => {
    const base: Palette = ['#a', '#b', '#c', '#d', '#e'];
    const resolved = resolveEffectivePalette(base, 'level', 'pink');
    expect(resolved).toEqual([
      '#a',
      '#b',
      '#c',
      TILE_PALETTE_COLORS.pink.edge,
      TILE_PALETTE_COLORS.pink.edge2,
    ]);
  });

  test('resolveEffectivePalette sovrascrive sia sfondo che tessere indipendentemente', () => {
    const base: Palette = ['#a', '#b', '#c', '#d', '#e'];
    const resolved = resolveEffectivePalette(base, 'sunset', 'teal');
    expect(resolved).toEqual([
      BG_PALETTE_COLORS.sunset.feltA,
      BG_PALETTE_COLORS.sunset.feltB,
      BG_PALETTE_COLORS.sunset.accent,
      TILE_PALETTE_COLORS.teal.edge,
      TILE_PALETTE_COLORS.teal.edge2,
    ]);
  });
});

describe('COLORBLIND_PALETTE', () => {
  test('è la CBP dell\'originale (riga 1374): blu e arancio, nello stesso ordine di una tavolozza di livello', () => {
    const source = fs.readFileSync(ORIGINAL_HTML, 'utf8');
    const match = /var CBP=\[([^\]]+)\]/.exec(source);
    expect(match).not.toBeNull();
    expect([...COLORBLIND_PALETTE]).toEqual(match![1].split(',').map((c) => c.trim().replace(/'/g, '')));
    expect(COLORBLIND_PALETTE).toHaveLength(5);
  });

  test('le scelte di sfondo e di bordo dell\'utente si applicano sopra, come in `applyTheme`', () => {
    const out = resolveEffectivePalette(COLORBLIND_PALETTE, 'ocean', 'level');
    expect(out.slice(0, 3)).toEqual([BG_PALETTE_COLORS.ocean.feltA, BG_PALETTE_COLORS.ocean.feltB, BG_PALETTE_COLORS.ocean.accent]);
    expect(out.slice(3)).toEqual([COLORBLIND_PALETTE[3], COLORBLIND_PALETTE[4]]);
    expect(resolveEffectivePalette(COLORBLIND_PALETTE, 'level', 'level')).toEqual([...COLORBLIND_PALETTE]);
  });
});
