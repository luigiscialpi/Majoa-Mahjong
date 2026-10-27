# S4 — motore dei livelli (prototipo)

Il prototipo S4 risponde a una domanda del README principale (sezione 8): il generatore con seme crea una tavola da 96 tessere in tempi accettabili, e il solver la verifica? Realizza in TypeScript puro il nucleo descritto in `docs/motore-livelli.md`: `LevelSpec`, generazione risolvibile per costruzione con seme, solver di verifica, partite simulate e misure dell'indice di difficoltà. È un esperimento usa e getta: il codice di `src/engine/` è privo di dipendenze da React Native e si può portare in `src/domain/` dell'app.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `src/engine/types.ts`, `prng.ts` | Tipi (`LevelSpec`, `PlacedTile`, `Result`); generatore pseudocasuale con seme (mulberry32) e hash dei semi |
| `src/engine/geometry.ts` | Tessere libere, coperte e chiuse ai lati (regole dell'originale) con aggiornamento incrementale |
| `src/engine/generator.ts` | `generateLevel(spec, seme)`: tavola risolvibile per costruzione, con stelle, tessere nascoste, nebbia e oro |
| `src/engine/solver.ts` | Stato di gioco, mosse, solver di verifica (ricerca in profondità con memoizzazione e potature), partite casuali |
| `src/engine/difficulty.ts`, `weights.ts` | Le nove misure dell'indice di difficoltà e la loro somma pesata; pesi e intervallo di libertà (generati da `tools/calibrate.py`) |
| `src/engine/bench.ts` | Misura delle prestazioni, condivisa da Node e dall'app |
| `src/engine/*.test.ts` | 14 test: determinismo, regole, 100 livelli, solver, indice |
| `src/data/legacy-levels.json` | I 100 livelli dell'originale (forma e parametri), esportati con `tools/export-levels.js` |
| `src/data/measures.json`, `calibration.json` | Misure dei 100 livelli e rapporto di taratura |
| `App.tsx` | Schermata con il pulsante «Prova» per misurare il motore su Hermes |

## Come funziona il generatore

La tavola si costruisce simulando la partita **in avanti**: a ogni passo si sceglie a caso un gruppo di tessere libere nello stesso momento, si assegna loro lo stesso disegno e si tolgono. Se non ci sono abbastanza tessere libere il tentativo fallisce e si riprova con un seme derivato da `(seme, tentativo)`, fino a 1500 volte come nell'originale; se falliscono tutti, `generateLevel` restituisce l'errore tipizzato `generation-failed`, senza il ripiego non garantito dell'originale.

- **Gruppi**: quanti più gruppi da quattro (coppie doppie) possibile, purché ogni tipo compaia almeno una volta; gli altri da due (da sei e da tre per i tris).
- **Stelle e tessere nascoste**: per ogni gruppo nascosto si pianifica un gruppo di stelle nella prima parte della soluzione; le tessere nascoste del gruppo `g` si scelgono tra quelle rimosse dopo il `g`-esimo gruppo di stelle.
- **Nebbia**: tessere non libere all'inizio, né nascoste né stelle. **Oro**: tessere visibili, non stella. Nessuna delle due cambia la risolvibilità.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | 14 test con il runner di Node, senza dipendenze aggiuntive |
| `npm run typecheck` | Tipi TypeScript |
| `npm run bench` | Prestazioni in Node (V8) sui 100 livelli: `node tools/bench.ts [semi] [partite]` |
| `node tools/measures.ts [semi] [partite]` | Ricalcola `src/data/measures.json` |
| `python3 tools/calibrate.py [--apply]` | Taratura dei pesi (richiede `numpy` e `scipy`); con `--apply` scrive i pesi tarati invece di quelli uniformi |
| `node tools/export-levels.js "<Majoa Mahjong.html>" src/data/legacy-levels.json` | Riesporta i livelli dall'originale (richiede Playwright) |

Per misurare su un dispositivo: `npm install`, `npx expo start --no-dev --minify`, poi il pulsante **Prova**.

## Risultati (23/10/2026)

Misurati in Node (V8), 100 livelli dell'originale × 20 semi:

| Misura | Esito |
|---|---|
| Generazione | 2000 tavole, **0 fallite**; tempo medio 0,3 ms, mediana 0,1, p95 0,7, massimo 15 ms; tentativi: media 1,7, p95 5, massimo 22 |
| Risolvibilità, verificata dal solver in modo indipendente dalla costruzione | 300 tavole su 300 risolvibili, nessuna non risolvibile, nessuna sconosciuta; tempo medio 0,9 ms, massimo 42 ms; nodi: massimo 2617 |
| Partite simulate (40 per tavola) | media 4,5 ms per livello, massimo 44 ms |
| Test | 14 su 14; il bundle Android e iOS si compila (Hermes) |

**Il solver senza potatura non bastava.** La prima versione lasciava un caso su 300 senza esito entro 200000 nodi (livello 90, seme 1, 78 tessere, due gruppi nascosti da 8). Con l'ordine delle mosse (stelle e tipi più vincolati per primi) non cambiava nulla; con la potatura «se di un tipo restano solo `g` tessere e una copre direttamente un'altra, lo stato è senza uscita» tutti i casi si risolvono in al più 2617 nodi.

### Indice di difficoltà: la taratura non identifica i pesi

L'ordine di progetto dell'originale dentro ogni isola è monotono su quasi tutte le misure: **con pesi uniformi la correlazione di Spearman media tra indice e posizione nell'isola è 0,991**, e già `K` da solo ottiene 0,991 e `A` 0,982. Cercare i pesi che la massimizzano porta a 0,999 (convalida «lascia fuori un'isola»: 0,998), ma con pesi senza significato (`H` 0,34, `A` 0,15, `T` 0,03, `Lc` 0,03): il massimo è piatto e i pesi seguono il rumore. Il controllo indipendente lo conferma: la correlazione con le etichette 1-5 dell'originale (80 livelli, confrontabili tra isole) è **0,943 con pesi uniformi e 0,864 con quelli «tarati»**. Per questo `weights.ts` usa pesi uniformi (1/9 per misura). Il solo valore ricavato dai dati è l'intervallo della libertà media (0,271-0,699), che normalizza `Lc`.

Conseguenza per `docs/motore-livelli.md`: i pesi non si ricavano dalla campagna dell'originale. Sono una scelta di progetto, da affinare con dati di gioco reali (stelle e tempo per livello).

Misure di una sola misura da sole (correlazione media con la posizione nell'isola): `K` 0,99, `A` 0,98, `Z` 0,93, `T` 0,92, `Lc` 0,89, `H` 0,81, `F` 0,64, `R` 0,53; `G` non varia dentro un'isola.

### Risultati su Hermes (Android)

Misure dell'utente, modalità di produzione, 100 livelli × 10 semi (modello del dispositivo non indicato):

| Misura | Hermes | Node (V8, 20 semi) |
|---|---|---|
| Generazione, media / mediana / p95 / massimo | 0,9 / 0,5 / 3,0 / 17,6 ms | 0,3 / 0,1 / 0,7 / 15 ms |
| Tavole fallite | 0 su 1000 | 0 su 2000 |
| Tentativi, media / massimo | 1,8 / 22 | 1,7 / 22 |
| Solver, media / massimo | 3,9 / 218,5 ms | 0,9 / 42 ms |
| Tavole risolvibili / non / sconosciute | 300 / 0 / 0 | 300 / 0 / 0 |
| Nodi del solver, massimo | 2617 | 2617 |
| Simulazione di 40 partite, media / massimo per livello | 27,5 / 94,3 ms | 4,5 / 43,8 ms |
| Totale della prova | 11,7 s | 2,1 s (2000 tavole) |

Hermes è 3-6 volte più lento di V8, ma i tempi restano molto sotto le soglie proposte (generazione al più 100 ms, nessun fallimento): anche l'esito più lento (17,6 ms, il primo livello alla prima chiamata) è invisibile se la tavola si genera prima di mostrare il livello. La stessa esecuzione del solver e delle partite simulate, più pesante, va tenuta fuori dal percorso critico.

### Limiti della verifica

- Le **partite simulate** sono di un giocatore che sceglie a caso: `R` (quota di partite senza mosse) misura il rischio di blocco, non la difficoltà percepita da chi pianifica; i pesi non dipendono da un modello del giocatore reale.
- Il motore **non genera forme**: i livelli dell'originale portano la forma pronta. La generazione di forme e di curve di difficoltà (`levelForIndex`, isole infinite) non è parte di S4.
- I livelli esportati usano i valori base dell'originale: non includono le modifiche dei profili di difficoltà né i layout della Modalità comoda.
- Provato su un solo dispositivo Android; iOS non provato.
