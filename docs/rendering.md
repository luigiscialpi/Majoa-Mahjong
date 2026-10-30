# Rendering della tavola

> **Stato: DRAFT.** Il capitolo descrive l'architettura validata dal prototipo S1 (`prototipi/s1-rendering/`) su un solo dispositivo Android; il rendering dell'app non esiste ancora (geometria e `hitTest` sono in `src/domain/board.ts`). iOS, tablet e telefoni di fascia bassa non sono stati provati.

Questo capitolo spiega come si disegna la tavola con React Native Skia, quali vincoli impongono gli SVG delle tessere e quante tessere si possono animare insieme. Si legge prima di scrivere il rendering, le animazioni o la pipeline dei disegni.

## Cosa fa

Disegna le tessere della tavola (fino a 96 su 5 piani nel livello 20 dell'originale) in un unico `<Canvas>` Skia, anima le tessere libere, mostra selezione e rimozione e traduce il tocco in una tessera tramite il dominio. Non contiene regole di gioco: tessera libera e `hitTest` stanno nel dominio.

## Come funziona

### Due strati

- **Strato fermo**: tutte le tessere non libere, disegnate una sola volta in un'unica immagine (`drawAsImage`) e mostrate con un solo `<Image>`. Il corpo della tessera (bordo, ombra, faccia) viene da un'immagine in cache, più il disegno SVG.
- **Strato vivo**: le tessere libere e quelle in rimozione, disegnate con Skia e valori condivisi di Reanimated. Selezione, aiuto e anello di blocco stanno sopra.
- **Ricostruzione**: dopo ogni rimozione l'immagine si ricostruisce in background, per escludere le tessere appena diventate libere. Nel frattempo queste sono disegnate due volte con gli stessi pixel. Una tessera che sparisce non è mai nell'immagine, perché era libera, quindi viva.

### Perché due strati

In React Native Skia 2.6.2 ogni proprietà animata è un valore condiviso, e a ogni suo cambiamento un «mapper» rigioca sul thread UI l'intera registrazione di disegno (`sksg/Container.native.js`). Il costo per fotogramma segue quindi le tessere disegnate dal vivo, non quelle animate. Misure su un Android (modalità di produzione):

| Configurazione | fps | eco col thread UI, medio/max (ms) |
|---|---|---|
| Tutto dal vivo, solo 2 tessere animate | 49,4 | 710/929 |
| Tutto dal vivo, 96 animate (con cache del corpo) | 50,2 | 745/844 |
| A strati, 2-24 tessere vive | 59 | 33-42 |
| A strati, 26 vive | 59,6 | 70/147 |
| A strati, 48 vive | 58,8 | 171/190 |
| A strati, 96 vive | 49,8 | 838/975 |
| Partita simulata, strato fermo con corpo in cache | 59,1 | 41/149 |
| Partita simulata, corpo disegnato direttamente | 59,1 | 66/293 |

L'«eco» è il tempo di andata e ritorno di un messaggio JS → thread UI → JS: con valori alti la selezione al tocco arriva in ritardo (2 secondi con tutte le tessere animate). I fotogrammi al secondo da soli non lo mostrano.

### Budget di tessere vive

Circa 30 tessere vive. Nel livello 20 le libere insieme sono al massimo 26-27. Le animazioni di tutta la tavola (ingresso del livello, rimescolo) superano il budget e vanno fatte come immagine unica o a gruppi; il metodo è `TO DO`.

### Disegni (SVG)

Le 129 tessere sono SVG esportati una volta dall'originale (`prototipi/s1-rendering/tools/`); una copia sta in `assets/tiles/`. Vincoli del motore SVG di Skia, verificati con `skia-python` e sul dispositivo:

- **Nessun `<text>`**: SkSVG non lo disegna. Lettere, numeri e simboli (A M 7 3 K Z 5 9 π ∞ √) sono convertiti in tracciati; i font usati, Poppins Bold e DejaVu Serif Bold, sono provvisori e la scelta finale è una decisione di grafica (`TO DO`).
- **Solo `viewBox`, mai `width` e `height` fissi**: con attributi fissi SkSVG ignora la dimensione richiesta e disegna sempre 60 × 80.
- **Ritaglio sul riquadro**: il browser ritaglia sul `viewBox`, SkSVG no, e 10 disegni sporgono (per esempio il koala). `SvgAt` ritaglia sul riquadro del disegno.
- **`ImageSVG` con x o y a zero** ignora la posizione (`if (x && y)` nel player di Skia): si trasla con un `Group` (`SvgAt`).

### Quale disegno per ogni tessera

Il generatore assegna ai tipi posizioni astratte `0…poolSize-1`, mentre i 129 disegni sono indicizzati come nell'originale. `designOf(isola, tipo)` fa la corrispondenza: la posizione indica un disegno nel gruppo dell'isola (`legacy-themes.json`: per esempio `animals` usa 0-11, 16-21 e 30-39) e la stella ha il suo, il 26. Tipi diversi hanno sempre disegni diversi. Ogni livello ha la sua tavolozza di cinque colori (`levelPalette`): feltro chiaro, feltro scuro, accento, bordo e bordo scuro; quella del livello 20 è la stessa che usa S1.

Disegni e tavolozze si ricavano dall'originale eseguito in jsdom (`tools/export-themes.js`, con lo stesso gancio dello strumento di S4, senza browser). `TILE_SOURCES` (`tileSources.ts`, generato da `tools/generate-tile-index.js`) elenca gli SVG di `assets/tiles/` in ordine di indice.

### Tocco e rimozione

Il tocco si risolve con `hitTest` del dominio, non con viste per tessera. Delle 96 tessere del livello 20, 26 sono libere all'inizio e ciascuna è raggiungibile al tocco per più dell'80% della propria area (tra l'82% e l'85% su telefoni da 360 a 412 px di larghezza, oltre il 90% a 768 px); una tessera coperta si raggiunge solo dal bordino scoperto (4-5 px tra i piani), ma non è selezionabile. La rimozione riproduce l'originale (`.tile.gone`): scala 0,6 e rotazione di 8° in 120 ms, dissolvenza in 250 ms. Le scintille dell'originale (`burstAt`) non sono ancora riprodotte.

## Punti d'ingresso nel codice

Il rendering non esiste ancora. Regola della tessera libera, geometria di layout, `hitTest` e colonna di gioco sono in `src/domain/` (`geometry.ts`, `board.ts`; `docs/dominio-di-gioco.md`); il resto è ancora nel prototipo S1, da cui partire: `prototipi/s1-rendering/`.

| Elemento | Percorso | Ruolo |
|---|---|---|
| Geometria di layout, `hitTest`, colonna di gioco | `src/domain/board.ts` | Dominio puro, con test in `board.test.ts` e in `src/infrastructure/content/legacyBoard.test.ts` |
| Tavola a due strati | `prototipi/s1-rendering/src/TileBoardLayered.tsx` | Strato fermo, strato vivo, partita simulata |
| Corpo della tessera e cache | `prototipi/s1-rendering/src/TileBody.tsx` | `TileBody`, `useBodyImage` |
| Disegno di un SVG | `prototipi/s1-rendering/src/SvgAt.tsx` | Posizione e ritaglio |
| Equivalenza strato fermo / vivo | `prototipi/s1-rendering/src/equivalence.tsx` | Confronto sui pixel |
| Esportazione, conversione dei testi, fedeltà | `prototipi/s1-rendering/tools/` | Pipeline dei disegni |
| `designOf()`, `levelPalette()` | `src/infrastructure/content/legacyThemes.ts` | Disegno di un tipo e tavolozza di un livello |
| `TILE_SOURCES` | `src/infrastructure/content/tileSources.ts` | Elenco dei 129 SVG di `assets/tiles/` |
| `extract()` | `tools/export-themes.js` | Disegni e tavolozze dall'originale |

## Vincoli e scartato

- Non disegnare tutte le tessere dal vivo con valori condivisi: il costo segue le tessere disegnate, non quelle animate.
- Non animare tutta la tavola tessera per tessera: oltre circa 30 tessere vive l'eco col thread UI supera 170 ms (838 ms con 96).
- Non disegnare il corpo delle tessere dello strato fermo direttamente a ogni ricostruzione: 273 ms contro 132 ms con la cache.
- Non usare SVG con `<text>` o con `width` e `height` fissi; non usare `ImageSVG` con x o y a zero.
- Scartati (README, sezione 5): una vista per tessera con `react-native-svg`, sprite PNG, Lottie o Rive, motori di gioco.

## Verifica

- **Coperto da test**: 21 test del dominio (`src/domain/board.test.ts`, `src/infrastructure/content/legacyBoard.test.ts`); 6 test su disegni e tavolozze (`legacyThemes.test.ts`, `originalThemes.test.ts`: coerenza con i 100 livelli, corrispondenza tipo → disegno, confronto con l'originale rieseguito in jsdom; 6 difetti introdotti di proposito, tutti rilevati); confronto di fedeltà (129 disegni letti da SkSVG, 127 identici a Chromium, 2 con differenza media sotto 0,001/255); prova in Chromium (tocco, errori, equivalenza strato fermo / vivo); compilazione dei bundle Android e iOS.
- **Misurato su dispositivo**: un Android (modello non indicato), in produzione: tabella sopra; equivalenza strato fermo / vivo 0% di pixel diversi; nessun fantasma nella partita simulata (una coppia al secondo).
- **Non verificato**: iOS, tablet, telefoni di fascia bassa; fantasmi con un giocatore più veloce di una coppia al secondo; animazioni dell'intera tavola; scintille di rimozione; Expo SDK 58.

## Collegamenti

- `prototipi/s1-rendering/README.md`: prove, risultati e problemi trovati.
- `docs/gioco-originale.md`: grafica, animazioni e regole della tessera dell'originale.
- README, sezione 5: decisioni correlate; sezione 8: `TO DO` aperti.
