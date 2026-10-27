# Motore dei livelli e progressione

> **Stato: DRAFT.** Il capitolo descrive il modello deciso. Generatore e solver sono implementati in `src/domain/`; le misure dell'indice e la verifica sui 100 livelli dell'originale stanno nel prototipo S4 (`prototipi/s4-generatore/`); restano `TO DO` la tolleranza dell'indice, la curva tra isole, `ρ` di sblocco e la generazione delle forme (README, sezione 8).

Questo capitolo spiega come si descrive, si genera e si ordina un livello, e come isole e progressione si estendono all'infinito. Si legge prima di toccare il dominio dei livelli, la mappa o lo sblocco delle isole.

## Cosa fa

Il motore produce, per ogni livello di ogni isola, una descrizione dei dati (`LevelSpec`) e, dato un seme, la tavola giocabile. I primi livelli vengono dalla campagna dell'originale (dati esportati), gli altri dal generatore. Misura la difficoltà di ogni livello e la usa per ordinarli, per generarli verso un obiettivo e per mostrare l'etichetta al giocatore. Decide inoltre quando un'isola si apre. Non disegna (rendering), non salva (salvataggi) e non conosce pubblicità o audio.

## Come funziona

### Termini

Il progetto usa la parola «difficoltà» per due cose diverse, che nel codice hanno nomi diversi. Nell'originale la distinzione esiste già: il profilo scelto dal giocatore modifica le regole, mentre la difficoltà di ogni livello (`L.diff`, puntini da 1 a 5) è solo un'etichetta letta dal menu e non incide su nessuna regola.

| Termine | Nome nel codice | Significato |
|---|---|---|
| **Indice di difficoltà** | `levelDifficulty` | Numero da 0 a 100, proprietà del livello, calcolato dal modello per il profilo Normale. Governa generazione, ordinamento e etichetta. |
| **Profilo di difficoltà** | `DifficultyProfile` | Facile, Normale, Medio, Difficile, Esperto, Maestro: scelta del giocatore. Modifica aiuti, numero di tipi, rimescoli automatici, tempo per le stelle, nebbia, scurimento e bonus ✨ (tabella in `docs/gioco-originale.md`, sezione «Aiuti»). **Non ricalcola** l'indice. |
| **Etichetta di difficoltà** | `difficultyLabel` | Puntini da 1 a 5 mostrati nel menu: l'indice diviso in cinque fasce uguali. Per i livelli esportati dall'originale resta il valore originale. |

### Descrizione di un livello (`LevelSpec`)

Il `LevelSpec` è un dato puro e serializzabile. Contiene: identificativo `{isola, livello}` (più `legacyId` per i livelli dell'originale), forma (celle `x, y, z`), dimensione del gruppo (2, oppure 3 nei Tris), insieme di disegni, numero di tipi `K`, meccaniche (gruppi di tessere nascoste, tessere nebbiose, tessere d'oro), aiuti iniziali (Aiuto, Mischia, Annulla; assente = illimitato), indicatore di boss, tema.

### Generazione

`generateLevel(spec, seme)` costruisce una tavola **risolvibile per costruzione**: simula la partita in avanti: a ogni passo sceglie a caso un gruppo di tessere libere nello stesso momento (quattro per le coppie quando i tipi lo permettono, due altrimenti; sei o tre per i tris), assegna loro lo stesso disegno e le toglie. Il generatore usa un PRNG con seme; il seme deriva da `(isola, livello, profilo, tentativo)`, dove `tentativo` aumenta a ogni «Rifai». Stesso `LevelSpec` e stesso seme producono la stessa tavola.

Se la costruzione non riesce entro il numero massimo di tentativi (1500 nell'originale), la funzione restituisce l'errore tipizzato `generation-failed` e il chiamante riprova con il seme successivo. Il fallback dell'originale, che assegnava i disegni senza garanzie di risolvibilità, non si replica.

Per ogni gruppo di tessere nascoste si pianifica un gruppo di stelle nella prima parte della soluzione, e le tessere nascoste del gruppo `g` si scelgono tra quelle rimosse dopo il `g`-esimo gruppo di stelle. La nebbia si assegna a tessere non libere all'inizio, né nascoste né stelle; l'oro a tessere visibili e non stella; nessuna delle due cambia la risolvibilità.

Verificato nel prototipo S4 su 100 livelli dell'originale: 1000 tavole su un Android (Hermes) senza fallimenti, con in media 1,8 tentativi e al più 22, in media 0,9 ms e al più 17,6 ms; un solver indipendente dalla costruzione conferma risolvibili tutte le 300 tavole campione (al più 218 ms e 2617 nodi).

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

**Isole dell'originale.** Le prime sette isole sono quelle dell'originale: livelli iniziali, Isola degli animali, Dolci, Arte, Scienza, Mare, Fiori. Le prime due hanno già 20 livelli. Per le altre cinque, i 10 livelli disegnati a mano sono i livelli 1-10 e i livelli **11-20 vengono generati** nel tema dell'isola, con indice che continua a salire e con le meccaniche già attive dal 6 e dal 7 dell'isola. `DRAFT`: ipotesi da confermare.

**Temi.** Un tema è un dato: 14 disegni più la tessera stella, tre tavolozze che si alternano, nomi tradotti e 14 carte d'album. Dall'ottava isola in poi il tema si sceglie in sequenza tra quelli disponibili; finiti i temi, si ripetono con una variante (tavolozza). Nuovi temi arrivano come contenuti aggiornabili (README, sezione 5).

**Livelli Tris.** Restano un insieme separato di 10 livelli con gruppi da 3, raggiungibile dalla sala Rompicapi e fuori dal percorso delle isole. L'estensione a livelli Tris generati è `TO DO`.

### Progressione e sblocco

Per spiegare la regola serve l'originale: un'isola si apriva quando la precedente era completata **e** le stelle cumulative dei livelli 1-90 raggiungevano 80, 110, 140, 170 o 200. Quelle soglie lasciano sempre un margine costante di 40 stelle sul massimo (80 su 120, 110 su 150, 140 su 180, 170 su 210, 200 su 240): con isole infinite richiederebbero in percentuale sempre più stelle, fino a quasi tre stelle ovunque.

Regole del modello:
1. Dentro un'isola i livelli si sbloccano in sequenza, vincendo il precedente con almeno una stella.
2. L'isola `i+1` si apre quando l'isola `i` è completata (livello 20 con almeno una stella) **e** le stelle della sola isola `i` raggiungono `ρ × 60`. Proposta di partenza: `ρ = 2/3`, cioè 40 stelle su 60, che corrisponde alla prima soglia dell'originale (80 su 120). `ρ` è `TO DO`.
3. Un solo criterio per le stelle (1-3 per livello, da tempo e aiuti come nell'originale): la stessa somma alimenta sblocco e album.
4. Il regalo ✨ all'apertura di un'isola è un dato dell'isola (nell'originale: 3 per l'Isola degli animali, 5 per le altre).
5. Le spiegazioni delle meccaniche compaiono alla **prima comparsa** della meccanica nel gioco, non per numero di livello.
6. La mappa è un elenco virtualizzato: mostra le isole aperte, la prossima chiusa con il requisito mancante e nulla oltre.
7. `TO DO`: formula delle carte d'album per isola. Con 20 livelli (massimo 60 stelle e 4 boss) la formula dell'originale (`⌊stelle/2⌋ + boss`, tetto 14) raggiungerebbe il tetto a metà isola: va ricalibrata.

## Punti d'ingresso nel codice

`LevelSpec`, `generateLevel` e il solver sono in `src/domain/` (`docs/dominio-di-gioco.md`). Indice di difficoltà, isole e progressione hanno solo il percorso previsto (`TO DO`); per l'indice esiste un'implementazione di partenza nel prototipo S4, in `prototipi/s4-generatore/src/engine/` (`difficulty.ts`, `weights.ts`). Per l'originale, i riferimenti sono righe di `Majoa Mahjong.html` (vedi `docs/gioco-originale.md`).

| Elemento | Percorso | Ruolo | Riferimento nell'originale |
|---|---|---|---|
| `LevelSpec` | `src/domain/types.ts` | Descrizione dati di un livello | `LEVELS` (1191), `ISL_CFG` (1271), `ISL_SHAPES` (1248) |
| `generateLevel()` | `src/domain/generator.ts` | Tavola risolvibile con seme | `makeGroups` (1778), `assign` (1810) |
| `solve()`, `playRandom()`, `simulate()` | `src/domain/solver.ts` | Verifica di risolvibilità e partite simulate | nessuno |
| `levelDifficulty()` | `src/domain/difficulty.ts` (`TO DO`) | Indice di difficoltà | nessuno (nell'originale `L.diff` è un'etichetta) |
| `levelForIndex()`, `islandForIndex()` | `src/domain/islands.ts` (`TO DO`) | Livelli e isole oltre la campagna | `ISLANDS` (1159), `layoutList` (1302) |
| `isIslandUnlocked()` | `src/domain/progress.ts` (`TO DO`) | Regola di sblocco | `worldState` (2472), `islandEarned` (3213) |

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

- **Coperto da test**: in `src/domain/`, test su forme sintetiche di determinismo, soluzione rigiocata con le regole di gioco, specifiche non valide, `generation-failed` e solver (`docs/dominio-di-gioco.md`); nel prototipo S4, 14 test, tra cui i 100 livelli dell'originale e l'indice.
- **Test previsti**: per ogni isola e livello, su un campione di semi, la tavola è risolvibile; l'indice è entro la tolleranza dall'obiettivo; la curva rispetta le regole dell'isola; il tempo di generazione sta sotto la soglia; regressione sui livelli esportati dell'originale contro le tabelle di `docs/gioco-originale.md`.
- **Misurato su dispositivo**: un Android (modello non indicato), Hermes, produzione: vedi il paragrafo «Generazione» e `prototipi/s4-generatore/README.md`.
- **Non verificato**: pesi dell'indice su dati di gioco; tolleranza e curva tra isole; generazione di forme e di livelli oltre la campagna (`levelForIndex`); `src/domain/` sui 100 livelli dell'originale; il solver su tris piatti molto grandi (90 tessere, 8 tipi: 3 tavole su 20 `unknown` entro 200000 nodi); iOS.

## Collegamenti

- `docs/gioco-originale.md`: regole, livelli, difficoltà e punteggi dell'originale.
- README, sezione 5: decisioni correlate; sezione 8: `TO DO` aperti.
