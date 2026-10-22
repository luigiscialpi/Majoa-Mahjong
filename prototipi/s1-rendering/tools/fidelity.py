#!/usr/bin/env python3
"""S1 — fedeltà del motore SVG di Skia (SkSVG) rispetto a Chromium sui 129 disegni.

Uso: python3 fidelity.py <cartella assets/tiles> <cartella output> [scala]
Richiede: skia-python, numpy, pillow, playwright (Chromium).
"""
import sys, os, io, glob, json, http.server, threading, functools
import numpy as np
from PIL import Image
import skia
from playwright.sync_api import sync_playwright

tiles_dir, out_dir = sys.argv[1], sys.argv[2]
S = int(sys.argv[3]) if len(sys.argv) > 3 else 3
W, H = 60 * S, 80 * S
os.makedirs(out_dir, exist_ok=True)
files = sorted(glob.glob(os.path.join(tiles_dir, '*.svg')))

def render_skia(path):
    data = open(path, 'rb').read()
    stream = skia.MemoryStream.MakeDirect(data)
    dom = skia.SVGDOM.MakeFromStream(stream)
    if dom is None:
        return None
    surf = skia.Surface(W, H)
    c = surf.getCanvas()
    c.clear(skia.ColorWHITE)
    # Come fa l'app (`drawSvg(svg, width, height)`): la dimensione si passa come contenitore, senza scalare la tela.
    dom.setContainerSize(skia.Size(W, H))
    dom.render(c)
    img = surf.makeImageSnapshot()
    return np.array(img.convert(alphaType=skia.kUnpremul_AlphaType, colorType=skia.kRGBA_8888_ColorType))[:, :, :3]

def render_chromium(files):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=os.path.abspath(tiles_dir))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    res = {}
    with sync_playwright() as p:
        br = p.chromium.launch()
        pg = br.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        for f in files:
            name = os.path.basename(f)
            pg.set_content('<body style="margin:0;background:#fff"><img id=i src="http://127.0.0.1:%d/%s" width=%d height=%d style="display:block"></body>' % (port, name, W, H))
            pg.wait_for_function('document.getElementById("i").complete')
            png = pg.screenshot(clip={'x': 0, 'y': 0, 'width': W, 'height': H})
            res[name] = np.array(Image.open(io.BytesIO(png)).convert('RGB'))
        br.close()
    srv.shutdown()
    return res

def ink_box(path, cw, ch, margin=60):
    """Riquadro (x0, x1, y0, y1) dell'inchiostro con un contenitore cw × ch, con un margine attorno per vedere ciò che sporge."""
    data = open(path, 'rb').read()
    dom = skia.SVGDOM.MakeFromStream(skia.MemoryStream.MakeDirect(data))
    surf = skia.Surface(int(cw + 2 * margin), int(ch + 2 * margin))
    c = surf.getCanvas()
    c.clear(skia.ColorWHITE)
    c.translate(margin, margin)
    dom.setContainerSize(skia.Size(cw, ch))
    dom.render(c)
    a = np.array(surf.makeImageSnapshot().convert(alphaType=skia.kUnpremul_AlphaType, colorType=skia.kRGBA_8888_ColorType))[:, :, :3]
    ink = np.where(a.min(axis=2) < 250)
    return int(ink[1].min() - margin), int(ink[1].max() + 1 - margin), int(ink[0].min() - margin), int(ink[0].max() + 1 - margin)

# 1) La dimensione richiesta deve essere rispettata: con un contenitore dimezzato il disegno deve dimezzarsi
#    (con width/height fissi nel file SkSVG li ignora e disegna sempre 60 × 80).
not_scaled = []
# 2) Il browser ritaglia il disegno sul viewBox, SkSVG no: elenco dei disegni che sporgono (da ritagliare nell'app).
overflow = []
for f in files:
    b60, b30 = ink_box(f, 60, 80), ink_box(f, 30, 40)
    if abs((b30[1] - b30[0]) - (b60[1] - b60[0]) / 2) > 2:
        not_scaled.append(os.path.basename(f))
    if b60[0] < 0 or b60[1] > 60 or b60[2] < 0 or b60[3] > 80:
        overflow.append(os.path.basename(f))
print('disegni che non rispettano la dimensione richiesta:', len(not_scaled), not_scaled[:5])
print('disegni che sporgono dal viewBox (da ritagliare):', len(overflow), overflow[:10])

ref = render_chromium(files)
rows = []
for f in files:
    name = os.path.basename(f)
    a = render_skia(f)
    b = ref[name]
    if a is None:
        rows.append({'file': name, 'error': 'SVGDOM non valido'}); continue
    d = np.abs(a.astype(int) - b.astype(int))
    rows.append({'file': name,
                 'mae': round(float(d.mean()), 3),
                 'pct_gt32': round(float((d.max(axis=2) > 32).mean() * 100), 3),
                 'ink_skia': round(float((a.min(axis=2) < 250).mean() * 100), 2),
                 'ink_chromium': round(float((b.min(axis=2) < 250).mean() * 100), 2)})
    if rows[-1]['pct_gt32'] > 1.0:
        Image.fromarray(np.hstack([b, a, np.clip(d * 4, 0, 255).astype('uint8')])).save(os.path.join(out_dir, name.replace('.svg', '_cmp.png')))
json.dump(rows, open(os.path.join(out_dir, 'fidelity.json'), 'w'), indent=1)
ok = [r for r in rows if 'mae' in r]
print('disegni:', len(rows), '| errori di parsing:', len(rows) - len(ok))
print('MAE medio %.3f | peggiore %.3f' % (np.mean([r['mae'] for r in ok]), max(r['mae'] for r in ok)))
print('disegni con >1%% pixel diversi (>32/255): %d' % sum(r['pct_gt32'] > 1.0 for r in ok))
for r in sorted(ok, key=lambda r: -r['pct_gt32'])[:14]:
    print(r)
