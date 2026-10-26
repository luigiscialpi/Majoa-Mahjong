#!/usr/bin/env python3
"""Taratura dei pesi dell'indice di difficoltà sui 100 livelli dell'originale.

Obiettivo: l'indice deve seguire l'ordine di progetto dentro ogni isola (livello 1 più facile dell'ultimo).
Metodo: massimizza la correlazione di rango di Spearman media tra isole, con pesi non negativi che sommano a 1
e un minimo di 0,02 per misura. Stima l'adattamento eccessivo con la convalida «lascia fuori un'isola».
Risultato: l'ordine di progetto dell'originale è monotono su quasi tutte le misure, quindi NON identifica i pesi
(già con pesi uniformi la correlazione è 0,99). Per questo `weights.ts` usa pesi uniformi, salvo `--apply`.
Un controllo più significativo è la correlazione con le etichette 1-5 dell'originale (livelli 21-90), confrontabili tra isole.
Uso: python3 tools/calibrate.py [--apply]
     (legge src/data/measures.json; scrive src/data/calibration.json e src/engine/weights.ts)
"""
import json, os, sys
import numpy as np
from scipy.stats import rankdata, spearmanr

HERE = os.path.dirname(os.path.abspath(__file__))
KEYS = ['T', 'Z', 'K', 'G', 'H', 'F', 'A', 'Lc', 'R']
FLOOR = 0.02
rows = json.load(open(os.path.join(HERE, '..', 'src', 'data', 'measures.json')))
lo = min(r['freedom'] for r in rows); hi = max(r['freedom'] for r in rows)
for r in rows:
    r['Lc'] = 1 - (r['freedom'] - lo) / (hi - lo)
    r['R'] = r['stuck']
M = np.array([[r[k] for k in KEYS] for r in rows])
islands = sorted({r['island'] for r in rows})
idx = {i: [j for j, r in enumerate(rows) if r['island'] == i] for i in islands}
local = {i: np.array([rows[j]['local'] for j in idx[i]]) for i in islands}

RL = {i: rankdata(local[i]) - rankdata(local[i]).mean() for i in islands}
def rho(w, isl):
    d = M[idx[isl]] @ w
    if np.ptp(d) == 0: return 0.0
    rd = rankdata(d) - (len(d) + 1) / 2
    return float(rd @ RL[isl] / np.sqrt((rd @ rd) * (RL[isl] @ RL[isl])))

def mean_rho(w, subset): return float(np.mean([rho(w, i) for i in subset]))

def fit(subset, rng, samples=3000):
    best_w, best = None, -2
    for _ in range(samples):
        w = FLOOR + (1 - FLOOR * len(KEYS)) * rng.dirichlet(np.ones(len(KEYS)))
        s = mean_rho(w, subset)
        if s > best: best, best_w = s, w
    step = 0.05
    for _ in range(1500):  # ricerca locale
        k, j = rng.choice(len(KEYS), 2, replace=False)
        w = best_w.copy(); d = min(step, w[k] - FLOOR)
        if d <= 0: continue
        w[k] -= d; w[j] += d
        s = mean_rho(w, subset)
        if s > best: best, best_w = s, w
    return best_w, best

rng = np.random.default_rng(12345)
uniform = np.ones(len(KEYS)) / len(KEYS)
w, best = fit(islands, rng)
single = {k: round(float(np.mean([spearmanr(M[idx[i]][:, c], local[i]).statistic if np.ptp(M[idx[i]][:, c]) else 0 for i in islands])), 3) for c, k in enumerate(KEYS)}
cv = []
for out in islands:
    train = [i for i in islands if i != out]
    wt, _ = fit(train, np.random.default_rng(7), samples=800)
    cv.append(rho(wt, out))
labeled = [j for j, r in enumerate(rows) if r['label'] > 0]
lab = np.array([rows[j]['label'] for j in labeled])
def rho_label(w): return float(spearmanr(M[labeled] @ w, lab).statistic)
apply = '--apply' in sys.argv
final = w if apply else uniform
report = {
    'misure': KEYS, 'intervalloLibertà': [round(lo, 4), round(hi, 4)],
    'pesiUniformi': {'rhoMedio': round(mean_rho(uniform, islands), 3), 'perIsola': {i: round(rho(uniform, i), 3) for i in islands}},
    'pesiTarati': {'pesi': {k: round(float(x), 3) for k, x in zip(KEYS, w)}, 'rhoMedio': round(best, 3), 'perIsola': {i: round(rho(w, i), 3) for i in islands}},
    'convalidaLasciaFuoriUnIsola': {'rhoMedio': round(float(np.mean(cv)), 3), 'perIsola': {i: round(c, 3) for i, c in zip(islands, cv)}},
    'rhoDiOgniMisuraDaSola': single,
    'rhoConEtichetta1-5': {'livelli': len(labeled), 'pesiUniformi': round(rho_label(uniform), 3), 'pesiTarati': round(rho_label(w), 3)},
    'pesiUsati': 'tarati' if apply else 'uniformi',
}
json.dump(report, open(os.path.join(HERE, '..', 'src', 'data', 'calibration.json'), 'w'), indent=2, ensure_ascii=False)
ws = ', '.join(f"{k}: {x:.4f}" for k, x in zip(KEYS, final))
open(os.path.join(HERE, '..', 'src', 'engine', 'weights.ts'), 'w').write(f"""// Pesi e intervalli dell'indice di difficoltà. Generato da `tools/calibrate.py`: non modificare a mano.
// Pesi {report['pesiUsati']}. Correlazione di Spearman media tra indice e posizione nell'isola: uniformi {report['pesiUniformi']['rhoMedio']}, tarati {report['pesiTarati']['rhoMedio']}
// (convalida lascia-fuori-un'isola {report['convalidaLasciaFuoriUnIsola']['rhoMedio']}): l'ordine dell'originale non identifica i pesi. Con le etichette 1-5 dei livelli 21-90: uniformi {report['rhoConEtichetta1-5']['pesiUniformi']}, tarati {report['rhoConEtichetta1-5']['pesiTarati']}.
// Dettagli in src/data/calibration.json.
import type {{ Measures }} from './difficulty.ts';

export const DEFAULT_WEIGHTS: Measures = {{ {ws} }};
/** Intervallo della libertà media osservato nei 100 livelli, per normalizzare `Lc` tra 0 e 1. */
export const FREEDOM_RANGE: [number, number] = [{lo:.4f}, {hi:.4f}];
""")
print(json.dumps(report, indent=1, ensure_ascii=False))
