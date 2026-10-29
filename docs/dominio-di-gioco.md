# Dominio di gioco

> **Stato: DRAFT.** Il capitolo descrive il codice di `src/domain/` così com'è: tavola, regole di abbinamento, geometria sullo schermo con `hitTest`, mossa suggerita, rimescolo, generatore con seme, solver e indice di difficoltà. Isole, progressione, Annulla e punteggi non sono ancora nel dominio (README, sezione 8).

Questo capitolo spiega come il dominio rappresenta la tavola e le regole di abbinamento, e come una mossa produce il nuovo stato o un errore tipizzato. Si legge prima di toccare il codice di `src/domain/`.

## Cosa fa

Il dominio è codice puro: senza UI, storage, rete o framework. Dato lo stato di una partita dice quali tessere sono giocabili e, data una mossa, restituisce il nuovo stato oppure il motivo del rifiuto. Contiene anche il generatore pseudocasuale con seme, il generatore di tavole risolvibili e il solver di verifica (modello e misure in `docs/motore-livelli.md`). Non disegna (`docs/rendering.md`), non salva e non conosce pubblicità o audio.

## Come funziona

### Tessere e geometria

Una cella è `{x, y, z}` (`z` è il piano). Una tessera posata (`PlacedTile`) aggiunge `type` (indice del disegno, oppure `STAR_TYPE` per la stella), `hiddenGroup` (0 = visibile, `g` > 0 = nascosta nel gruppo `g`), `fog` e `gold`. Le regole della tessera libera sono quelle dell'originale (`isFree`):

- una tessera è **coperta** se al piano superiore ce n'è una con `|Δx| < 1` e `|Δy| < 1`;
- è **chiusa ai lati** se sullo stesso piano (`|Δy| < 1`) ha una vicina a sinistra e una a destra, con distanza in `x` minore di 2;
- è **libera** se non è coperta né chiusa ai lati.

`buildAdjacency(celle)` calcola una volta per forma le relazioni (coperture e vicine, dirette e inverse). `FreeTracker` tiene i conteggi di tessere sopra e vicine per ogni tessera: `remove(i)` li aggiorna in modo incrementale, quindi le tessere libere si ottengono senza ripetere il confronto tra tutte le coppie.

### Layout e tocco

`boardMetrics(celle, larghezza, altezza)` calcola la dimensione della tessera e l'origine della tavola perché stia nell'area, con la formula del `layout()` dell'originale: ogni piano è spostato di −4 px in `x` e −5 px in `y`, la tessera è alta 1,3 volte la larghezza. `tileRect` dà il rettangolo di una tessera, `drawOrder` l'ordine di disegno dal fondo alla cima e `gameColumn` la colonna di gioco (rapporto massimo 3:4). `hitTest(celle, metriche, x, y, tolleranza)` restituisce la tessera più in alto nel punto, anche se coperta: dal bordino scoperto tra i piani si raggiunge la tessera sotto, ma se sia selezionabile lo decide `applyMove`. `visibleFraction` misura la quota di area di una tessera raggiungibile al tocco.

### Stato di partita e mosse

`GameState` raccoglie le tessere rimaste (con le libere), i gruppi nascosti aperti (`unlocked`) e le tessere rimaste per tipo. Una tessera è **giocabile** se è libera e il suo `hiddenGroup` non supera `unlocked`. Togliere un gruppo di stelle apre il gruppo nascosto successivo.

`applyMove(stato, gruppo)` restituisce `Result<GameState, MoveError>`. Il gruppo è valido se ha `groupSize` tessere (2, oppure 3 nei Tris) distinte e ancora in gioco, tutte giocabili e dello stesso tipo. Gli errori, controllati in quest'ordine:

| Errore | Quando |
|---|---|
| `invalid-group` | dimensione sbagliata, tessere ripetute, indice fuori tavola o tessera già tolta |
| `tile-blocked` | almeno una tessera è coperta, chiusa ai lati o nascosta in un gruppo non ancora aperto |
| `not-matching` | le tessere hanno tipi diversi |

`applyMove` non modifica lo stato ricevuto: lavora su una copia (`clone`). `GameState.apply` invece muta, ed è usato solo da solver e test.

### Mossa suggerita e stato bloccato

`findMove(stato)` restituisce la mossa che propone l'Aiuto: `groupSize` tessere giocabili dello stesso tipo, oppure `null`. `null` è lo stato «bloccato» (nessuna mossa possibile), che nell'originale avvia il rimescolo automatico. Finché restano gruppi nascosti chiusi preferisce il gruppo di stelle; altrimenti sceglie il gruppo che contiene la prima tessera giocabile nell'ordine delle tessere. Nei Tris l'originale sceglie il tipo con l'indice più basso: qui vale la stessa regola delle coppie, quindi la mossa suggerita può differire, la regola no. Contare gli usi, evidenziare le tessere e rimescolare non fanno parte di `findMove`.

### Mischia e rimescolo

`reshuffle(stato, tipi, seme)` riassegna i disegni delle tessere rimaste e restituisce un nuovo stato, senza modificare quello ricevuto. Restano uguali le posizioni, le tessere tolte, i gruppi nascosti aperti e i flag di nascosta, nebbia e oro; cambiano i tipi, stelle comprese: i gruppi di stelle ancora da aprire si ripianificano. Il metodo è quello del generatore, ma parte dallo stato in corso: pianifica i blocchi (`planChunks`) e simula la partita in avanti scegliendo solo tessere libere e già giocabili, quindi lo stato ottenuto è risolvibile per costruzione. Se un tentativo non riesce ne prova un altro con un seme derivato, fino a 1500; se nessuno riesce restituisce `generation-failed` (l'originale in quel caso assegna senza garanzia). `tipi` è il numero di disegni normali da usare. Chi chiama decide se il rimescolo conta come aiuto e se azzera la cronologia: nell'originale la Mischia conta e il rimescolo automatico no, e dopo entrambi non si annulla più.

### Generatore e piano di rimozione

`generateLevel(spec, seme)` costruisce la tavola simulando la partita in avanti e restituisce, oltre alle tessere, il **piano**: i blocchi di tessere nell'ordine di rimozione. Un blocco ha `groupSize` oppure `2 × groupSize` tessere uguali, libere nello stesso momento. `applyMove` accetta solo gruppi di `groupSize`, quindi chi rigioca il piano spezza ogni blocco in gruppi consecutivi.

### Determinismo

Il generatore usa mulberry32 con `hashSeed` per derivare i semi. I valori prodotti da un seme sono fissati dai test: cambiarli cambierebbe tutti i livelli generati e ogni partita ricostruita da specifica e seme.

## Punti d'ingresso nel codice

| Elemento | Percorso | Ruolo |
|---|---|---|
| `Cell`, `PlacedTile`, `LevelSpec`, `Result`, `MoveError` | `src/domain/types.ts` | Tipi del dominio |
| `buildAdjacency()`, `FreeTracker` | `src/domain/geometry.ts` | Tessera libera, aggiornamento incrementale |
| `GameState`, `applyMove()` | `src/domain/gameState.ts` | Stato di partita e mossa |
| `findMove()` | `src/domain/hint.ts` | Mossa suggerita e stato bloccato |
| `boardMetrics()`, `tileRect()`, `drawOrder()`, `hitTest()`, `visibleFraction()`, `gameColumn()` | `src/domain/board.ts` | Layout sullo schermo e tocco |
| `createRng()`, `hashSeed()` | `src/domain/prng.ts` | Generatore con seme |
| `generateLevel()`, `planChunks()`, `pickRandom()` | `src/domain/generator.ts` | Tavola risolvibile per costruzione; pianificazione dei blocchi e scelta casuale, condivise con `reshuffle()` |
| `reshuffle()` | `src/domain/reshuffle.ts` | Mischia e rimescolo automatico |
| `solve()`, `solveFrom()`, `playRandom()`, `simulate()` | `src/domain/solver.ts` | Verifica di risolvibilità, partite simulate |
| `staticMeasures()`, `dynamicMeasures()`, `difficultyIndex()`, `difficultyLabel()` | `src/domain/difficulty.ts`, `src/domain/weights.ts` | Misure e indice di difficoltà (`docs/motore-livelli.md`) |
| `grid()`, `pyramid90()` | `src/domain/__fixtures__/shapes.ts` | Forme sintetiche per i test |
| `replay()`, `checkInvariants()` | `src/domain/__fixtures__/checks.ts` | Verifiche condivise sulle tavole generate |

## Vincoli e scartato

- Non importare nel dominio nulla da React Native, Expo o dagli altri livelli.
- Non usare `Math.random()` né `Date.now()` nel dominio: il generatore con seme entra come argomento.
- Non chiamare `GameState.apply` fuori dal dominio: muta lo stato. Fuori dal dominio si usa `applyMove`.
- Non usare il fallback non garantito dell'originale: una generazione che non riesce restituisce `generation-failed`.
- Non cambiare l'algoritmo del generatore, né l'ordine in cui consuma i numeri casuali, senza una decisione esplicita: le partite si ricostruiscono da specifica e seme. `src/infrastructure/content/legacyGolden.test.ts` fissa le tavole dei 100 livelli con tre semi.
- Il solver ha un budget di nodi (200000 per impostazione): oltre, l'esito è `unknown`, mai `unsolvable`. Chi lo usa tratta `unknown` come «non verificato».

## Verifica

- **Coperto da test**: 76 test in `src/domain/` su forme sintetiche (5 piani con 90 tessere, griglie piatte): valori fissati del PRNG, tessera libera e aggiornamento incrementale, `applyMove` (errori, immutabilità, stelle e gruppi nascosti, tris), generatore (determinismo, specifiche non valide, `generation-failed`, soluzione rigiocata con `applyMove`, conteggi di tipi, stelle, nascoste, nebbia e oro) e solver (casi risolvibili e non, budget, tavole generate verificate in modo indipendente dalla costruzione), indice di difficoltà (misure, intervalli, pesi, etichetta), layout e `hitTest` (formula calcolata a mano, costanti dell'originale, ordine di disegno, tocco sul bordino, tolleranza), mossa suggerita (ordine, preferenza per le stelle, tris, coerenza con `applyMove`) e rimescolo (tavola e conteggi invariati, risolvibilità, ripresa da una partita bloccata, determinismo, errori). Sul livello 20 dell'originale e su tutti i 100 livelli, `src/infrastructure/content/legacyBoard.test.ts` verifica che la tavola stia nell'area a più schermi e che le 26 tessere libere iniziali siano raggiungibili al tocco. `src/infrastructure/content/legacyHint.test.ts` confronta `findMove` con quello dell'originale (coppie) in partite casuali su tutti i 100 livelli. `legacyReshuffle.test.ts` rimescola a un terzo e a due terzi della partita su tutti i 100 livelli (200 controlli: nessuno irrisolvibile né senza esito). Sensibilità controllata introducendo 15 difetti di proposito (regole della tessera libera, `applyMove`, PRNG, generatore, solver): tutti rilevati. La regola della tessera libera è inoltre confrontata con `isFree` dell'originale su tutti i 100 livelli, in partite casuali, in `src/infrastructure/content/legacyLevels.test.ts` (alterandola di proposito il test fallisce).
- **Come eseguirli**: `npx jest src/domain`.
- **Non verificato**: prestazioni di `src/domain/` su dispositivo (misurate nel prototipo S4, stesso algoritmo); il layout e il tocco su dispositivo (nessuna schermata ancora); il rimescolo nei Tris quando non riesce (l'originale riordina le tessere in file distanziate, qui `generation-failed`); il solver su tris piatti molto grandi: su una griglia sintetica di 90 tessere con 8 tipi, 3 tavole su 20 restano `unknown` entro 200000 nodi (le tavole risolvibili per costruzione restano tali; sui 100 livelli dell'originale nessuna).

## Collegamenti

- `docs/motore-livelli.md`: `LevelSpec`, generazione, indice di difficoltà, isole.
- `docs/rendering.md`: come la tavola si disegna e come il tocco arriva al dominio.
- `docs/gioco-originale.md`: regole dell'originale da cui derivano tessera libera e abbinamento.
- README, sezione 5: decisioni correlate.
