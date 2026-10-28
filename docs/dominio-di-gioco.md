# Dominio di gioco

> **Stato: DRAFT.** Il capitolo descrive il codice di `src/domain/` così com'è: tavola, regole di abbinamento, generatore con seme, solver e indice di difficoltà. Isole, progressione, aiuti e punteggi non sono ancora nel dominio (README, sezione 8).

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

### Stato di partita e mosse

`GameState` raccoglie le tessere rimaste (con le libere), i gruppi nascosti aperti (`unlocked`) e le tessere rimaste per tipo. Una tessera è **giocabile** se è libera e il suo `hiddenGroup` non supera `unlocked`. Togliere un gruppo di stelle apre il gruppo nascosto successivo.

`applyMove(stato, gruppo)` restituisce `Result<GameState, MoveError>`. Il gruppo è valido se ha `groupSize` tessere (2, oppure 3 nei Tris) distinte e ancora in gioco, tutte giocabili e dello stesso tipo. Gli errori, controllati in quest'ordine:

| Errore | Quando |
|---|---|
| `invalid-group` | dimensione sbagliata, tessere ripetute, indice fuori tavola o tessera già tolta |
| `tile-blocked` | almeno una tessera è coperta, chiusa ai lati o nascosta in un gruppo non ancora aperto |
| `not-matching` | le tessere hanno tipi diversi |

`applyMove` non modifica lo stato ricevuto: lavora su una copia (`clone`). `GameState.apply` invece muta, ed è usato solo da solver e test.

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
| `createRng()`, `hashSeed()` | `src/domain/prng.ts` | Generatore con seme |
| `generateLevel()` | `src/domain/generator.ts` | Tavola risolvibile per costruzione |
| `solve()`, `playRandom()`, `simulate()` | `src/domain/solver.ts` | Verifica di risolvibilità, partite simulate |
| `staticMeasures()`, `dynamicMeasures()`, `difficultyIndex()`, `difficultyLabel()` | `src/domain/difficulty.ts`, `src/domain/weights.ts` | Misure e indice di difficoltà (`docs/motore-livelli.md`) |
| `grid()`, `pyramid90()` | `src/domain/__fixtures__/shapes.ts` | Forme sintetiche per i test |
| `replay()`, `checkInvariants()` | `src/domain/__fixtures__/checks.ts` | Verifiche condivise sulle tavole generate |

## Vincoli e scartato

- Non importare nel dominio nulla da React Native, Expo o dagli altri livelli.
- Non usare `Math.random()` né `Date.now()` nel dominio: il generatore con seme entra come argomento.
- Non chiamare `GameState.apply` fuori dal dominio: muta lo stato. Fuori dal dominio si usa `applyMove`.
- Non usare il fallback non garantito dell'originale: una generazione che non riesce restituisce `generation-failed`.
- Il solver ha un budget di nodi (200000 per impostazione): oltre, l'esito è `unknown`, mai `unsolvable`. Chi lo usa tratta `unknown` come «non verificato».

## Verifica

- **Coperto da test**: 44 test in `src/domain/` su forme sintetiche (5 piani con 90 tessere, griglie piatte): valori fissati del PRNG, tessera libera e aggiornamento incrementale, `applyMove` (errori, immutabilità, stelle e gruppi nascosti, tris), generatore (determinismo, specifiche non valide, `generation-failed`, soluzione rigiocata con `applyMove`, conteggi di tipi, stelle, nascoste, nebbia e oro) e solver (casi risolvibili e non, budget, tavole generate verificate in modo indipendente dalla costruzione) e indice di difficoltà (misure, intervalli, pesi, etichetta). Sensibilità controllata introducendo 15 difetti di proposito (regole della tessera libera, `applyMove`, PRNG, generatore, solver): tutti rilevati. La regola della tessera libera è inoltre confrontata con `isFree` dell'originale su tutti i 100 livelli, in partite casuali, in `src/infrastructure/content/legacyLevels.test.ts` (alterandola di proposito il test fallisce).
- **Come eseguirli**: `npx jest src/domain`.
- **Non verificato**: prestazioni di `src/domain/` su dispositivo (misurate nel prototipo S4, stesso algoritmo); il solver su tris piatti molto grandi: su una griglia sintetica di 90 tessere con 8 tipi, 3 tavole su 20 restano `unknown` entro 200000 nodi (le tavole risolvibili per costruzione restano tali; sui 100 livelli dell'originale nessuna).

## Collegamenti

- `docs/motore-livelli.md`: `LevelSpec`, generazione, indice di difficoltà, isole.
- `docs/rendering.md`: come la tavola si disegna e come il tocco arriva al dominio.
- `docs/gioco-originale.md`: regole dell'originale da cui derivano tessera libera e abbinamento.
- README, sezione 5: decisioni correlate.
