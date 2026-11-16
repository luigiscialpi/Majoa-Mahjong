# Motore dei livelli e progressione

> **Stato: DRAFT.** La mappa e la progressione coprono sette isole da 20 livelli e una sequenza infinita generata da forme originali verificate. Gli identificativi interni restano distinti dalla numerazione visibile. L'indice generale di difficoltà non guida ancora la generazione: la curva corrente usa il numero di disegni per isola e si ferma a 14.

Questo capitolo spiega come si descrive, si genera e si ordina un livello, e come isole e progressione si estendono all'infinito. Si legge prima di toccare il dominio dei livelli, la mappa o lo sblocco delle isole.

## Cosa fa

Il motore produce, per ogni livello di ogni isola, una descrizione dei dati (`LevelSpec`) e, dato un seme, la tavola giocabile. I primi livelli vengono dalla campagna dell'originale (dati esportati), gli altri dal generatore. Misura la difficoltà di ogni livello e la usa per ordinarli, per generarli verso un obiettivo e per mostrare l'etichetta al giocatore. Decide inoltre quando un'isola si apre. Non disegna (rendering), non salva (salvataggi) e non conosce pubblicità o audio.

## Come funziona

### Termini

Il progetto usa la parola «difficoltà» per due cose diverse, che nel codice hanno nomi diversi. Nell'originale la distinzione esiste già: il profilo scelto dal giocatore modifica le regole, mentre la difficoltà di ogni livello (`L.diff`, puntini da 1 a 5) è solo un'etichetta letta dal menu e non incide su nessuna regola.

| Termine | Nome nel codice | Significato |
|---|---|---|
| **Indice di difficoltà** | `difficultyIndex` | Numero da 0 a 100, proprietà del livello, calcolato dal modello per il profilo Normale. Governa generazione, ordinamento e etichetta. |
| **Profilo di difficoltà** | `DifficultyProfile` | Facile, Normale, Medio, Difficile, Esperto, Maestro: scelta del giocatore. Modifica aiuti, numero di tipi, rimescoli automatici, tempo per le stelle, nebbia, scurimento e bonus ✨ (tabella in `docs/gioco-originale.md`, sezione «Aiuti»). **Non ricalcola** l'indice. |
| **Etichetta di difficoltà** | `difficultyLabel` | Puntini da 1 a 5 mostrati nel menu: l'indice diviso in cinque fasce uguali. Per i livelli esportati dall'originale resta il valore originale. |

### Descrizione di un livello (`LevelSpec`)

Il `LevelSpec` è un dato puro e serializzabile. Contiene: identificativo `{isola, livello}` (più `legacyId` per i livelli dell'originale), forma (celle `x, y, z`), dimensione del gruppo (2, oppure 3 nei Tris), insieme di disegni, numero di tipi `K`, meccaniche (gruppi di tessere nascoste, tessere nebbiose, tessere d'oro), aiuti iniziali (Aiuto, Mischia, Annulla; assente = illimitato), indicatore di boss, tema.

### Generazione

`generateLevel(spec, seme)` costruisce una tavola **risolvibile per costruzione**: simula la partita in avanti: a ogni passo sceglie a caso un gruppo di tessere libere nello stesso momento (quattro per le coppie quando i tipi lo permettono, due altrimenti; sei o tre per i tris), assegna loro lo stesso disegno e le toglie. Il generatore usa un PRNG con seme; il seme deriva da `(isola, livello, profilo, tentativo)`, dove `tentativo` aumenta a ogni «Rifai». Stesso `LevelSpec` e stesso seme producono la stessa tavola.

Se la costruzione non riesce entro il numero massimo di tentativi (1500 nell'originale), la funzione restituisce l'errore tipizzato `generation-failed` e il chiamante riprova con il seme successivo. Il fallback dell'originale, che assegnava i disegni senza garanzie di risolvibilità, non si replica.

Per ogni gruppo di tessere nascoste si pianifica un gruppo di stelle nella prima parte della soluzione, e le tessere nascoste del gruppo `g` si scelgono tra quelle rimosse dopo il `g`-esimo gruppo di stelle. La nebbia si assegna a tessere non libere all'inizio, né nascoste né stelle; l'oro a tessere visibili e non stella; nessuna delle due cambia la risolvibilità.

Verificato nel prototipo S4 su 100 livelli dell'originale: 1000 tavole su un Android (Hermes) senza fallimenti, con in media 1,8 tentativi e al più 22, in media 0,9 ms e al più 17,6 ms; un solver indipendente dalla costruzione conferma risolvibili tutte le 300 tavole campione (al più 218 ms e 2617 nodi).

Misura aggiuntiva sulla build release dell'app, Hermes su Samsung Galaxy A36 (SM_A366B, 16/11/2026): 1000 semi per ciascuna delle isole generate 8, 9 e 10 (20 forme × 50 semi), senza errori. Per `generateLevel()`, media / mediana / p95 / massimo: isola 8, 0,226 / 0,176 / 0,600 / 2,653 ms; isola 9, 0,321 / 0,167 / 1,118 / 4,851 ms; isola 10, 0,198 / 0,173 / 0,407 / 2,373 ms. `startRound()` — che include profilo, generazione e creazione dello stato di gioco — ha impiegato rispettivamente 0,331 / 0,298 / 0,800 / 2,876 ms; 0,456 / 0,274 / 1,411 / 5,230 ms; 0,332 / 0,274 / 0,656 / 3,644 ms. Tentativi medi: 1,38 / 1,65 / 1,18. Il calcolo di `campaignIslandsForProgress()` ha impiegato 28,05 µs per chiamata (mappa iniziale con nove isole). La misura di `startRound()` esclude `toSpec()`, il rendering React Native e il caricamento dei disegni.

Per le isole aggiunte, `src/infrastructure/content/campaignLevels.ts` riusa le geometrie originali e costruisce una `LegacyLevel`; `toSpec()` la passa allo stesso generatore con un seme nuovo. I livelli 11–20 delle isole 3–7 riusano in ordine le dieci forme dello stesso tema, aggiungono due tipi (fino al pool del tema) e mantengono meccaniche e aiuti del livello modello. Dall'isola 8 si ripetono i cinque temi Dolci, Arte, Scienza, Mare e Fiori; ogni isola usa in ciclo le dieci forme originali del tema, due volte. Il numero di tipi è 12 sull'isola 8, 13 sull'isola 9 e 14 dall'isola 10 in poi, tetto del pool. La tavola viene riassegnata dal generatore a ogni nuova partita. Questo è il criterio iniziale approvato; la curva dell'indice non è ancora calibrata.

### Indice di difficoltà

L'indice riassume quanto è difficile un livello. Poggia su misure oggettive, calcolabili dallo `LevelSpec` e dal solver. Le misure sono nove: le prime sette vengono dai parametri che nell'originale determinano la difficoltà in modo implicito, le ultime due dal solver.

| Misura | Simbolo | Come si legge | Effetto sull'indice |
|---|---|---|---|
| Tessere | `T` | numero di tessere (nell'originale da 15 a 96) | più tessere, indice più alto |
| Piani | `Z` | numero di piani (nell'originale da 1 a 5) | più piani, più alto |
| Tipi | `K` | disegni diversi | più tipi, più alto |
| Gruppo | `G` | 2 oppure 3 | il tris è più alto |
| Nascoste | `H` | quota di tessere nascoste sul totale | più nascoste, più alto |
| Nebbia | `F` | quota di tessere nebbiose sul totale | più nebbia, più alto |
| Scarsità di aiuti | `A` | aiuti iniziali totali, normalizzati (illimitato = minimo) | meno aiuti, più alto |
| Libertà | `L` | media, lungo una partita simulata, delle coppie disponibili rispetto alle coppie rimaste | meno libertà, più alto |
| Rischio | `R` | quota di partite simulate di un giocatore che sceglie a caso tra le mosse possibili e finisce senza mosse prima della fine | più rischio, più alto |

Le tessere d'oro non entrano nell'indice: sono un premio, non un ostacolo.

**Composizione.** Ogni misura si normalizza tra 0 e 1 sugli intervalli del catalogo di riferimento. L'indice è `100 × Σ peso × misura` (per `L` si usa `1 − L`), con pesi che sommano a 1. I **pesi sono uniformi** (1/9 per misura), perché la campagna dell'originale non permette di tarare di più (paragrafo «Taratura»); `DRAFT`: si affineranno con dati di gioco.

**Simulazione.** `L` e `R` si ricavano da un numero fisso di partite simulate con seme fisso, quindi il risultato è deterministico e ripetibile. Nel prototipo S4 si usano 40 partite per tavola: su Hermes costano in media 27,5 ms per livello (al più 94 ms), quindi la misura si calcola fuori dal percorso critico, alla generazione del livello o in fase di progetto.

**Taratura.** L'ordine di progetto dei 100 livelli dell'originale **non identifica i pesi**: è monotono su quasi tutte le misure. Con pesi uniformi la correlazione di Spearman media tra indice e posizione nell'isola è 0,991 (già `K` da solo ottiene 0,991); cercando il massimo si arriva a 0,999 con pesi senza significato. Il controllo indipendente con le etichette 1-5 dell'originale (80 livelli, confrontabili tra isole) dà 0,943 con pesi uniformi e 0,864 con quelli «tarati». I pesi si sceglieranno quindi su dati di gioco reali (stelle e tempo per livello). Resta ricavato dai dati l'intervallo della libertà media (0,271-0,699), che normalizza `L`.

**Usi dell'indice.**
1. *Generazione*: `levelForIndex` sceglie una «ricetta» (forma, `T`, `Z`, `K`, meccaniche, aiuti) e la perturba con il seme finché l'indice è vicino all'obiettivo, entro una tolleranza.
2. *Etichetta*: puntini da 1 a 5.
3. *Ordinamento*: la sequenza dei livelli di un'isola ha indice non decrescente (sezione seguente).
4. *Test*: la stessa misura serve a verificare che i livelli generati rispettino la curva.

### Isole da 20 livelli

Ogni isola ha **20 livelli di difficoltà crescente**. La struttura per posizione deriva dall'Isola degli animali dell'originale, che è già un'isola da 20 livelli. In quell'isola: il boss chiude ogni gruppo di cinque livelli (5, 10, 15, 20), le tessere d'oro compaiono dal livello 3, le tessere nascoste dall'11, la nebbia dal 13; i tipi crescono da 6 a 24, le tessere vanno da 16 a 78 su 1-5 piani, gli aiuti iniziali passano da illimitati a 1-3 per strumento e le etichette vanno da 1 a 5.

Regole per l'indice dentro un'isola:
- `D(k+1) ≥ D(k) − ε`: la crescita è una tendenza, non è rigida, perché nell'originale il numero di tessere non è monotono e il passaggio a una meccanica nuova abbassa altre misure (l'etichetta dell'Isola degli animali scende da 4 a 3 al livello 11, quando compaiono le tessere nascoste). `ε` è `TO DO`.
- Ogni boss ha indice non inferiore a quello del livello precedente.
- L'indice dell'ultimo livello supera quello del primo di un margine fisso (`TO DO`).

Tra un'isola e la successiva l'andamento è «a dente di sega»: i primi livelli di un'isola nuova sono più facili degli ultimi della precedente, come nell'originale, dove le isole nuove ripartono da aiuti illimitati e pochi tipi. Il punto di partenza e quello di arrivo crescono con l'indice dell'isola fino a un tetto (`TO DO`: forma della curva e tetto).

**Isole dell'originale.** Le prime sette isole sono quelle dell'originale: livelli iniziali, Animali, Dolci, Arte, Scienza, Mare e Fiori. Ognuna ha 20 livelli. Per Dolci, Arte, Scienza, Mare e Fiori i livelli 1-10 conservano i riferimenti originali; i livelli generati 11-20 riusano le forme dello stesso tema. Gli identificativi originali da 1 a 100 non cambiano. I 50 nuovi livelli usano ID interni 101-150; gli ID 91-100 restano i Tris. La numerazione mostrata della campagna è continua: 1-140.

**Isole infinite.** L'isola 8 comincia dall'ID interno 151; ogni isola successiva aggiunge 20 ID. Il tema ruota tra i cinque temi della campagna, le forme originali vengono riusate in ciclo e il generatore assegna una tavola risolvibile con seme. I tipi di disegno aumentano da 12 a 13 e poi al massimo di 14; dopo l'isola 10 questa parte della difficoltà resta al tetto. Ogni isola generata dà 5 ✨ quando si apre. La mappa prepara due isole oltre la campagna base e aggiunge un'isola per ogni isola generata completata, mantenendo visibile la prossima chiusa senza creare un array infinito.

**Identificativo e numero mostrato.** L'identificativo interno serve a collegare progressi e partita salvata a uno specifico livello; per i 100 livelli originali non cambia. Il numero mostrato nella campagna è invece progressivo: `1 + livelli delle isole precedenti + posizione nell'isola`. Quando si aggiungono livelli a Dolci, Arte, Scienza, Mare e Fiori, i numeri visibili successivi slittano; i progressi salvati continuano a riferirsi agli stessi livelli. I Tris restano fuori dalla campagna e mostrano la propria numerazione. I nuovi livelli ricevono identificativi interni mai usati.

**Temi.** Un tema è un dato: 14 disegni più la tessera stella, una tavolozza base, un nome tradotto e 14 carte d'album. Dall'ottava isola i cinque temi Dolci, Arte, Scienza, Mare e Fiori si ripetono in sequenza; anche il nome delle isole generate è progressivo («Isola 8», «Isola 9»…). Le isole riutilizzano la tavolozza base del tema. Nuovi temi possono arrivare come contenuti aggiornabili (README, sezione 5).

**Livelli Tris.** Restano un insieme separato di 10 livelli con gruppi da 3, raggiungibile dalla sala Rompicapi e fuori dal percorso delle isole. L'estensione a livelli Tris generati è `TO DO`.

### Progressione e sblocco

Per spiegare la regola serve l'originale: un'isola si apriva quando la precedente era completata **e** le stelle cumulative dei livelli 1-90 raggiungevano 80, 110, 140, 170 o 200. Quelle soglie lasciano sempre un margine costante di 40 stelle sul massimo (80 su 120, 110 su 150, 140 su 180, 170 su 210, 200 su 240): con isole infinite richiederebbero in percentuale sempre più stelle, fino a quasi tre stelle ovunque.

Regole del modello:
1. Dentro un'isola i livelli si sbloccano in sequenza, vincendo il precedente con almeno una stella.
2. L'isola `i+1` si apre quando l'isola `i` è completata (ultimo livello con almeno una stella) **e** le stelle della sola isola `i` raggiungono `ρ × 3 × livelli`. È deciso `ρ = 2/3`: 40 stelle su 60 per ogni isola da 20 livelli. La soglia nel codice è `⌈ρ × 3 × livelli⌉` (`UNLOCK_RATIO = 2/3`).
3. Un solo criterio per le stelle (1-3 per livello, da tempo e aiuti come nell'originale): la stessa somma alimenta sblocco e album.
4. Il regalo ✨ all'apertura di un'isola è un dato dell'isola (nell'originale: 3 per l'Isola degli animali, 5 per le altre).
5. Le spiegazioni delle meccaniche compaiono alla **prima comparsa** della meccanica nel gioco, non per numero di livello.
6. La mappa è un elenco virtualizzato: mostra le isole aperte, la prossima chiusa con il requisito mancante e nulla oltre. Il catalogo genera solo le isole necessarie all'avanzamento e due successive; l'elenco non è allocato all'infinito.
7. `TO DO`: formula delle carte d'album per isola. Con 20 livelli (massimo 60 stelle e 4 boss) la formula dell'originale (`⌊stelle/2⌋ + boss`, tetto 14) raggiungerebbe il tetto a metà isola: va ricalibrata.

## Punti d'ingresso nel codice

`LevelSpec`, `generateLevel` e il solver sono in `src/domain/` (`docs/dominio-di-gioco.md`). L'indice di difficoltà è in `src/domain/difficulty.ts` e `weights.ts`; `campaignLevels.ts` assegna gli ID, compone le isole, sceglie il tema e riusa le forme per i contenuti generati. Per l'originale, i riferimenti sono righe di `Majoa Mahjong.html` (vedi `docs/gioco-originale.md`). I 100 livelli dell'originale sono dati in `src/infrastructure/content/legacy-levels.json`, esportati con `prototipi/s4-generatore/tools/export-levels.js` (richiede Playwright); `legacyLevels.ts` li tipizza e `toSpec` li converte in `LevelSpec`. Le misure di riferimento dei 100 livelli (media su 5 semi × 60 partite simulate) sono in `src/infrastructure/content/__fixtures__/legacy-measures.json`, prodotte da `prototipi/s4-generatore/tools/measures.ts`.

| Elemento | Percorso | Ruolo | Riferimento nell'originale |
|---|---|---|---|
| `LevelSpec` | `src/domain/types.ts` | Descrizione dati di un livello | `LEVELS` (1191), `ISL_CFG` (1271), `ISL_SHAPES` (1248) |
| `generateLevel()` | `src/domain/generator.ts` | Tavola risolvibile con seme | `makeGroups` (1778), `assign` (1810) |
| `solve()`, `playRandom()`, `simulate()` | `src/domain/solver.ts` | Verifica di risolvibilità e partite simulate | nessuno |
| `legacyLevels`, `toSpec()` | `src/infrastructure/content/legacyLevels.ts` | Campagna dell'originale come specifiche | `LEVELS` (1191), `layoutList` (1302) |
| `staticMeasures()`, `dynamicMeasures()`, `difficultyIndex()`, `difficultyLabel()` | `src/domain/difficulty.ts`, `src/domain/weights.ts` | Nove misure, indice di difficoltà e etichetta 1-5 | nessuno (nell'originale `L.diff` è un'etichetta) |
| `levelForIndex()`, `islandForIndex()` | `src/domain/islands.ts` (`TO DO`) | Livelli e isole oltre la campagna | `ISLANDS` (1159), `layoutList` (1302) |
| `newProgress()`, `recordWin()`, `levelProgress()` | `src/domain/progress.ts` | Progressi per livello e ✨ di una vittoria | `prog` (stelle, oro, record, profilo), `win` (2279) |
| `isLevelUnlocked()`, `isIslandUnlocked()`, `unlockThreshold()`, `islandStars()`, `isIslandCompleted()` | `src/domain/progress.ts` | Regole di sblocco di livelli e isole | `worldState` (2472), `islandEarned` (3213) |
| `openGifts()` | `src/domain/progress.ts` | Regalo ✨ delle isole appena aperte | campo `gift` delle isole |
| `legacyIslands`, `campaignIslandsForProgress()`, `campaignLevelById()` | `src/infrastructure/content/legacyIslands.ts`, `campaignLevels.ts` | Isole base, contenuti generati, numerazione interna; Tris a parte | `ISLANDS` (1159) |

## Vincoli e scartato

- Non usare `Math.random()` nel dominio: il generatore riceve un PRNG con seme, per rendere riproducibili tavole e test.
- Non usare soglie cumulative di stelle per aprire le isole: il margine costante di 40 stelle rende la regola sempre più severa.
- Non trattare l'indice di difficoltà come semplice etichetta: governa generazione e ordinamento.
- Non far ricalcolare l'indice dal profilo: il profilo modifica le regole di gioco, non la misura del livello.
- Non replicare il fallback non garantito dell'originale: la generazione fallita è un errore tipizzato.
- Non tarare i pesi dell'indice sulla campagna dell'originale: non li identifica e, cercandone il massimo, peggiora il controllo con le etichette 1-5 (0,864 contro 0,943 con pesi uniformi).
- Non rinominare né riutilizzare identificativi di isole, livelli e temi.
- Progressioni scartate: un solo asse di livelli senza isole (si perdono il viaggio e i traguardi); campagna fissa più modalità infinita separata (due progressioni e due economie); sola campagna fissa estesa a mano (non è infinita).

## Verifica

- **Coperto da test**: in `src/domain/`, test su forme sintetiche di determinismo, soluzione rigiocata con le regole di gioco, specifiche non valide, `generation-failed` e solver (`docs/dominio-di-gioco.md`) e dell'indice di difficoltà (misure calcolate a mano, pesi, intervalli, etichetta); in `src/infrastructure/content/`, test sui 100 livelli originali, ID e lunghezza delle isole, progressione della difficoltà generata e generazione risolvibile di forme originali per i nuovi ID; in `src/domain/progress.test.ts` e `src/infrastructure/content/legacyIslands.test.ts`, regole di sblocco, record, ✨, regali e simulazioni di giocatori sulle isole della campagna.
- **Test previsti**: per ogni isola e livello, su un campione di semi, la tavola è risolvibile; l'indice è entro la tolleranza dall'obiettivo; la curva rispetta le regole dell'isola; il tempo di generazione sta sotto la soglia; confronto dei livelli esportati con le tabelle di `docs/gioco-originale.md`.
- **Misurato su dispositivo**: un Android (modello non indicato), Hermes, produzione: vedi il paragrafo «Generazione» e `prototipi/s4-generatore/README.md`.
- **Verificato su dispositivo**: su Galaxy A36 la mappa mostra le isole 1-9, l'isola 8 espone i numeri 141-160 e il livello 141 avvia una tavola generata da 16 coppie.
- **Non verificato**: taratura dell'indice con dati reali; andamento complessivo della difficoltà oltre il parametro `types`; confronto visivo con le catture dell'originale e misure prestazionali delle partite generate; sblocco dei Tris; generazione di nuove forme invece del riuso delle forme originali; il solver su tris piatti molto grandi (forme sintetiche da 90 tessere con 8 tipi: 3 tavole su 20 `unknown` entro 200000 nodi; sui 100 livelli dell'originale nessuna); iOS.

## Collegamenti

- `docs/gioco-originale.md`: regole, livelli, difficoltà e punteggi dell'originale.
- `docs/salvataggi.md`: come si salvano e si leggono i progressi.
- README, sezione 5: decisioni correlate; sezione 8: `TO DO` aperti.
