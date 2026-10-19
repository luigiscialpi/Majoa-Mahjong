#!/usr/bin/env python3
"""Converte gli elementi <text> degli SVG delle tessere in <path>.

Motivo: il motore SVG di Skia (SkSVG) non disegna <text>, e i font di sistema
dell'originale (Arial Rounded MT Bold, Georgia) non esistono su Android.
Uso: python3 text_to_paths.py <cartella svg> <font sans .ttf> <font serif .ttf>
I font sono parametri: la scelta finale del carattere è una decisione di grafica.
"""
import sys, re, glob, os, html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

svg_dir, sans_path, serif_path = sys.argv[1:4]
fonts = {'sans': TTFont(sans_path), 'serif': TTFont(serif_path)}

def glyph_path(font, text, x, y, size, anchor):
    cmap, gs, upem = font.getBestCmap(), font.getGlyphSet(), font['head'].unitsPerEm
    s = size / upem
    names = [cmap[ord(c)] for c in text]
    width = sum(font['hmtx'][n][0] for n in names) * s
    pen_x = x - (width / 2 if anchor == 'middle' else width if anchor == 'end' else 0)
    d = []
    for n in names:
        pen = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        gs[n].draw(TransformPen(pen, (s, 0, 0, -s, pen_x, y)))
        d.append(pen.getCommands())
        pen_x += font['hmtx'][n][0] * s
    return ' '.join(d)

def attr(tag, name, default=None):
    m = re.search(r'\b%s="([^"]*)"' % re.escape(name), tag)
    return html.unescape(m.group(1)) if m else default

TEXT = re.compile(r'<text\b([^>]*)>([^<]*)</text>')
def convert(m):
    a, content = m.group(1), html.unescape(m.group(2))
    fam = 'serif' if (attr(a, 'font-family', '') or '').lower().startswith('georgia') else 'sans'
    d = glyph_path(fonts[fam], content, float(attr(a, 'x', 0)), float(attr(a, 'y', 0)), float(attr(a, 'font-size', 16)), attr(a, 'text-anchor', 'start'))
    fill, stroke = attr(a, 'fill', '#000'), attr(a, 'stroke')
    sw, lj = attr(a, 'stroke-width', '1'), attr(a, 'stroke-linejoin', 'miter')
    fill_p = '<path d="%s" fill="%s"/>' % (d, fill)
    if not stroke:
        return fill_p
    stroke_p = '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="%s"/>' % (d, stroke, sw, lj)
    # paint-order="stroke": contorno sotto, riempimento sopra; altrimenti il contrario
    return stroke_p + fill_p if attr(a, 'paint-order') == 'stroke' else fill_p + stroke_p

n = 0
for f in sorted(glob.glob(os.path.join(svg_dir, '*.svg'))):
    s = open(f, encoding='utf-8').read()
    t = TEXT.sub(convert, s)
    if t != s:
        open(f, 'w', encoding='utf-8').write(t); n += 1
print('SVG convertiti:', n)
