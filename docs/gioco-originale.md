# Gioco originale (Majoa Mahjong, versione HTML)

Questo capitolo descrive che cosa fa il gioco HTML/CSS/JavaScript originale «Majoa Mahjong», che fa da riferimento per grafica e funzionalità della nuova app. Si legge prima di implementare o modificare qualsiasi funzione che nasce dall'originale. I rimandi «sezione N» e «sezione N.M» indicano i paragrafi numerati di «Come funziona». Le informazioni sono state controllate sul codice e, dove indicato, eseguendo il gioco; ciò che è solo letto è marcato come tale.

## Cosa fa

L'originale è un solitario di abbinamento di tessere in stile mahjong, a tema animali e oggetti, con un «viaggio» a isole, 100 livelli, 10 rompicapi bonus, un album da collezione e una mascotte, in francese, inglese e italiano. Il codice non dichiara un pubblico di destinazione. Serve solo come riferimento: la nuova app si scrive da zero e non riusa il suo codice. Il capitolo descrive il comportamento dell'originale; le scelte della nuova app che se ne discostano stanno in «Vincoli e scartato», nel README (sezione 5) e in `docs/motore-livelli.md`.

La copia di sola lettura dell'originale si conserva nel repository in `reference/majoa-originale/` (`DRAFT`: cartella da creare).

| File | Contenuto |
|---|---|
| `Majoa Mahjong.html` | Il gioco: un solo file (3551 righe, 274 KB) con CSS, markup e un solo `<script>` racchiuso in una funzione auto-eseguita. Nessun file esterno e nessuna immagine: ogni disegno è codice SVG. |
| `TEST_majoa.js` | Suite Playwright (25 sezioni) che apre il gioco in Chromium e lo pilota con un gancio di debug iniettato. |
| Manuali HTML (sviluppo; idee e registro) | Scelte di progetto e registro delle modifiche. Servono solo da confronto: dove differiscono dal codice vale il codice. |

## Come funziona

### 1. Panoramica

Solitario di abbinamento tessere in stile mahjong, a tema animali e oggetti (il codice non dichiara un pubblico di destinazione), con una struttura a «viaggio» (isole), 100 livelli, 10 rompicapi bonus, un album da collezione e una mascotte. Interfaccia in francese (predefinito), inglese e italiano.

Caratteristiche architetturali rilevanti per il porting:

- **Rendering a DOM, non canvas.** Ogni tessera è un `<div>` con un `<svg>` dentro (`viewBox 0 0 60 80`). L'unico `<canvas>` è quello dei fuochi d'artificio della schermata di vittoria.
- **Nessuna rete.** Nessuna chiamata `fetch`, nessuna pubblicità, nessuna analitica, nessun servizio esterno (verificato con ricerca nel codice).
- **Persistenza solo `localStorage`** (chiavi in sezione 12).
- **Audio sintetizzato** con Web Audio (nessun file audio). **Vibrazione** con `navigator.vibrate`.
- **Grafica procedurale**: 129 disegni di tessere, 4 mascotte, sfondi e icone, tutti come stringhe SVG nel codice.
- **Adattamento allo schermo**: interfaccia a colonna singola per schermi stretti (viewport `width=device-width, viewport-fit=cover`). La tavola ricalcola la dimensione delle tessere a ogni ridimensionamento: lato massimo 64 px (88 px in Modalità comoda), proporzione 1 : 1,3. Il codice non blocca l'orientamento.

### 2. Schermate e flussi

| Schermata | Cosa contiene |
|---|---|
| Gioco | Intestazione con pulsante livello (numero + nome), contatore coppie rimaste, cronometro (tocco = pausa), contatore tessere bloccate (solo nei livelli con tessere nascoste), pulsanti `?` (guida) e ⚙️ (impostazioni). Barra opzionale delle tessere selezionate. Barra delle tessere d'oro. Tavola. Barra inferiore: 💡 Aiuto, ↩️ Annulla, 🔀 Mischia, 🔄 Rifai, ciascuno con il numero di usi rimasti (∞ se illimitato). |
| Mappa del viaggio | Le isole in sequenza verticale, con stato (aperta, nascosta dalla nebbia), progresso a stelle, ✨ disponibili, accesso a Rompicapi e Album, pulsante «Continua partita» se esiste un salvataggio, selezione lingua, Impostazioni, Guida. |
| Menu livelli dell'isola | Griglia dei livelli con numero, nome, stelle, record di tempo, ✨ tessere d'oro raccolte/totali, puntini di difficoltà (●○), corona 👑 per i boss, lucchetto se bloccato. «Continua partita» in cima. Pulsanti Impostazioni, Guida, «Cancella tutta la progressione». |
| Novità del livello | Finestra con spiegazione illustrata che compare **una sola volta** all'ingresso dei livelli 1, 3, 4, 8, 11, 13, 16, 19, 23, 33, 91 (sezione 5.4). |
| Vittoria | Fuochi d'artificio su canvas, 1-3 stelle animate, tempo e record, aiuti usati, tessere d'oro, ✨ guadagnati, regola delle stelle, pulsanti Successivo / Rigioca / Livelli. |
| Bloccato | «Bloccato!» quando non ci sono più mosse né rimedi: Ricomincia / Livelli. |
| Pausa | Si attiva toccando il cronometro e automaticamente quando la scheda perde visibilità (`visibilitychange`). |
| Regalo | Finestra con ✨ regalati all'apertura di una nuova isola. |
| Rompicapi | Sala con i 10 rompicapi, ciascuno in 3 livelli di difficoltà; schermata di gioco del rompicapo con ❔ (spiegazione) e 💡 (aiuto). |
| Album | Raccolte di carte da collezionare (sezione 9). |
| Guida | Elenco di spiegazioni delle regole. |
| Impostazioni | Sezione 11. |

Flusso tipico: avvio → mappa → isola → livello → vittoria → livello successivo o mappa. All'avvio il gioco mostra la mappa; la tavola resta vuota finché non si sceglie un livello o si preme «Continua partita».

### 3. Regole di base

**Tavola.** Una tavola è una lista di tessere con coordinate intere `(x, y, z)`: colonna, riga, piano. Le tessere dei piani superiori sono disegnate spostate di `(-4, -5)` px per piano (`LAYER_DX`, `LAYER_DY`).

**Tessera libera** (`isFree`). Una tessera è libera se:
1. nessuna tessera del piano immediatamente sopra (`z+1`) la copre, cioè con `|Δx| < 1` e `|Δy| < 1`;
2. **non** ha una tessera adiacente sia a sinistra sia a destra sullo stesso piano e sulla stessa riga (`|Δy| < 1`, vicino se la distanza in `x` è minore di 2).

Una tessera libera ma **bloccata** (nascosta, sezione 5.2) non è selezionabile.

**Abbinamento.** Si tocca una tessera libera (si evidenzia), poi un'altra libera con lo stesso disegno: le due spariscono. Non esistono errori né penalità: toccare una tessera diversa sposta semplicemente la selezione; toccare di nuovo la tessera selezionata la deseleziona.

**Livelli Tris** (91-100). Servono **tre** tessere uguali: dopo la seconda, entrambe restano evidenziate; la terza fa sparire tutte e tre. Il numero di tessere è sempre multiplo di 3. Annulla rimette tutte e tre.

**Tocco su una tessera non giocabile.** Se è coperta o chiusa ai lati, suono «bloccato» e le tessere che la bloccano vengono evidenziate. Se è nascosta, compare un avviso e vengono evidenziate le tessere stella giocabili.

**Combo.** Due abbinamenti a meno di 4,5 secondi l'uno dall'altro incrementano la combo; dalla seconda in poi compare la scritta in alto con la mascotte (se attiva) e la nota dell'abbinamento sale lungo una scala di 8 note.

**Fine livello.** Quando non restano tessere si passa alla vittoria. Dopo ogni mossa, se non esiste nessuna mossa possibile, scatta il rimescolo automatico (sezione 6.3).

### 4. Generazione della tavola

Le tavole sono **sempre risolvibili per costruzione** (`assign`): si simula la rimozione a ritroso. Si scelgono gruppi di 4 tessere uguali (2 per il resto, 3 nei Tris) tutte libere nello stesso momento, le si toglie dalla lista simulata e si ripete fino a svuotare la tavola; i disegni vengono poi assegnati in quell'ordine. Dettagli:

- Fino a **1500 tentativi**; se falliscono tutti, ripiega su un'assegnazione senza garanzie (nei manuali «mai visto»; nel codice non c'è un contatore di quante volte accade).
- Quando il livello ha tessere nascoste, i gruppi di tessere **stella** (che servono a sbloccarle) sono pianificati per primi: il primo gruppo è il primo a essere rimosso nella simulazione, gli altri cadono nella prima parte della sequenza, così lo sblocco è sempre raggiungibile. La stella conta come un disegno in meno tra quelli disponibili.
- Il numero di disegni diversi `nEff`: in Modalità comoda `max(6, round(n × 0,7))`; altrimenti `max(5, min(n + DIF_N[difficoltà], dimensione del gruppo di tessere − 2))`.
- **Gruppi di tessere per isola**: livelli iniziali 30 tipi originali; Isola degli animali 28 animali + stella; ciascuna delle altre isole 14 disegni + stella; Tris gli stessi 28 animali, senza stella.
- La posizione delle tessere d'oro, nascoste e nebbiose è casuale a ogni partita (non esiste seme).

### 5. Livelli, isole e modalità

#### 5.1 Struttura del viaggio

| Isola | Id livelli | Livelli | Sbloccata da | Regalo ✨ all'apertura |
|---|---|---|---|---|
| 🌱 Livelli iniziali | 1-20 | 20 | sempre aperta | – |
| 🐾 Isola degli animali | 21-40 | 20 | finire i livelli iniziali | 3 |
| 🍰 Isola dei dolci | 41-50 | 10 | isola precedente completata **e** 80 ★ | 5 |
| 🎨 Isola dell'arte | 51-60 | 10 | completata la precedente **e** 110 ★ | 5 |
| 🔬 Isola della scienza | 61-70 | 10 | completata la precedente **e** 140 ★ | 5 |
| 🌊 Isola del mare | 71-80 | 10 | completata la precedente **e** 170 ★ | 5 |
| 🌸 Isola dei fiori | 81-90 | 10 | completata la precedente **e** 200 ★ | 5 |
| 🔺 Livelli Tris (bonus) | 91-100 | 10 | finire i livelli iniziali | – |

I punti ★ del viaggio principale sono la somma delle stelle dei livelli 1-90 (i Tris non contano). Un'isola è «completata» quando l'ultimo suo livello ha almeno 1 stella. Le isole non ancora aperte compaiono nella nebbia con il requisito mancante; quella appena aperta mostra una finestra regalo con ✨ (una volta sola). I Tris non compaiono nel percorso della mappa: si raggiungono dalla sala Rompicapi, dalla scheda «Livelli Tris» in fondo alla lista (bloccata finché non si finiscono i livelli iniziali; mostra quanti dei 10 livelli hanno stelle).

Sblocco dei livelli: i livelli 1-40 si sbloccano in sequenza (`prog.unlocked`); i livelli delle isole 41+ e i Tris hanno ciascuno il proprio avanzamento (`prog.iu`).

Il livello 90 è il finale («grand»): titolo con 👑 e nessun pulsante «successivo». Il livello 20 chiude i livelli iniziali (🗺️), gli ultimi di ogni isola mostrano 🏝️.

#### 5.2 Meccaniche speciali

- **Tessere nascoste (🔒)**: all'inizio alcune tessere sono chiuse e mostrano un punto interrogativo con lucchetto. Si aprono a gruppi abbinando una coppia di stelle: il primo abbinamento di stelle apre il gruppo 1, il secondo il gruppo 2 e così via. Le dimensioni dei gruppi sono nella colonna «Nascoste» delle tabelle. Annullare l'abbinamento di stelle richiude il gruppo.
- **Tessere d'oro (✨)**: alcune tessere sono d'oro; abbinarle dà ✨ da spendere nei rompicapo. Il bonus è registrato una volta sola per livello (conta il massimo raggiunto). Una barra mostra le tessere d'oro raccolte.
- **Nebbia (🌫️)**: alcune tessere che all'inizio sono bloccate sono coperte da una nuvola; il disegno si scopre quando la tessera diventa libera.
- **Boss (👑)**: ultimo livello di ogni gruppo di 5 (livelli 5, 10, 15, 20 locali nell'isola degli animali; 5 e 10 nelle altre). Terminare un boss assegna una carta d'album (sezione 9). Il boss ha la stessa meccanica di un livello normale: nel codice la differenza è solo l'icona e la carta d'album assegnata alla vittoria (verificato con ricerca di tutti gli usi di `boss`).
- **Difficoltà del livello** (puntini 1-5 nel menu): è un'etichetta per il giocatore; non cambia nessuna regola nel codice **[verificato: `L.diff` è usato solo per mostrarla]**.

#### 5.3 Modalità comoda

Interruttore in Impostazioni (`S.cf`), etichettato «Modalità comoda (senior)» in tutte e tre le lingue. Quando è attivo:

- usa layout dedicati scritti a mano, uno per ognuno dei 20 livelli iniziali (`COMFORT`), con al massimo 5 colonne × 6 righe, quindi tessere più grandi. Le isole 21+ usano le stesse forme in entrambe le modalità;
- meno disegni diversi (`nEff` ×0,7, minimo 6);
- **aiuti, annullamenti e rimescoli illimitati**, rimescoli automatici illimitati;
- nessuna nebbia;
- ignora la difficoltà (sempre «Normale»);
- accende da solo: testi grandi, nessuna pressione del tempo, evidenzia-uguali, aiuto automatico (sezione 11).

Tessere per livello (comoda): 16, 20, 20, 30, 38, 42, 48, 54, 60, 62 (livelli 1-10) e 38, 42, 48, 54, 60, 56, 60, 62, 66, 72 (livelli 11-20).

#### 5.4 Spiegazioni al primo incontro

Finestra illustrata mostrata una sola volta (si ricorda in `prog.seen`) prima di avviare il livello: **1** abbinare coppie; **3** aiuti, rimescolo, annulla; **4** tessere impilate; **8** annulla; **11, 13, 16, 19** tessere nascoste con 1, 2, 3, 4 gruppi; **23** tessere d'oro; **33** nebbia; **91** tris. Il cronometro parte alla chiusura della finestra.

#### 5.5 Elenco dei livelli

Colonne: tessere totali in modalità normale (la tavola cambia solo nei livelli 1-20 in comoda), piani, numero base di disegni diversi (`n`, prima della difficoltà), aiuti iniziali Aiuto/Mischia/Annulla (∞ = illimitato; dipendono poi dalla difficoltà, sezione 6.2), tessere d'oro, tessere nascoste (con i gruppi), tessere nebbiose, difficoltà mostrata, boss.

**Livelli iniziali (1-20).** Nomi: Giada, Oceano, Ciliegio, Tramonto, Notte viola, Lacca rossa, Ghiaccio, Oro, Mezzanotte, Cosmo, Menta, Corallo, Zaffiro, Limone, Ametista, Deserto, Tempesta, Bronzo, Stellata, Alba (in italiano; in francese e inglese sono tradotti). Ogni livello ha una tavolozza di colori propria. I primi 7 livelli (e i primi 7 di ogni gruppo di 10 delle altre isole) scuriscono molto le tessere bloccate (`dim`).

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 16 | 1 | 6 | ∞/∞/∞ | – | – | – | – | – |
| 2 | 2 | 20 | 1 | 8 | ∞/9/∞ | – | – | – | – | – |
| 3 | 3 | 26 | 1 | 10 | 9/6/∞ | – | – | – | – | – |
| 4 | 4 | 36 | 2 | 12 | 8/5/∞ | – | – | – | – | – |
| 5 | 5 | 48 | 2 | 14 | 6/4/∞ | – | – | – | – | – |
| 6 | 6 | 54 | 2 | 16 | 5/3/∞ | – | – | – | – | – |
| 7 | 7 | 62 | 2 | 16 | 4/3/∞ | – | – | – | – | – |
| 8 | 8 | 68 | 3 | 16 | 3/2/10 | – | – | – | – | – |
| 9 | 9 | 70 | 4 | 17 | 3/1/6 | – | – | – | – | – |
| 10 | 10 | 76 | 4 | 18 | 2/1/4 | – | – | – | – | – |
| 11 | 11 | 58 | 2 | 16 | 3/2/8 | – | 6 (6) | – | – | – |
| 12 | 12 | 62 | 2 | 17 | 3/2/6 | – | 8 (8) | – | – | – |
| 13 | 13 | 68 | 3 | 18 | 2/2/6 | – | 8 (4+4) | – | – | – |
| 14 | 14 | 74 | 3 | 18 | 2/2/5 | – | 12 (6+6) | – | – | – |
| 15 | 15 | 76 | 4 | 19 | 2/2/5 | – | 16 (8+8) | – | – | – |
| 16 | 16 | 76 | 4 | 20 | 2/2/4 | – | 12 (4+4+4) | – | – | – |
| 17 | 17 | 80 | 4 | 20 | 1/2/4 | – | 18 (6+6+6) | – | – | – |
| 18 | 18 | 82 | 5 | 22 | 1/2/3 | – | 24 (8+8+8) | – | – | – |
| 19 | 19 | 88 | 4 | 22 | 1/2/3 | – | 24 (6+6+6+6) | – | – | – |
| 20 | 20 | 96 | 5 | 24 | 2/2/3 | – | 32 (8+8+8+8) | – | – | – |

**Isola degli animali (21-40).** Stessi nomi, tavolozze, aiuti e limiti dei livelli iniziali, ma con 20 forme proprie: venti forme in ordine: ottagono, croce, rombo, cuore, clessidra (boss), due torri, scalinata, fiore, ponte, stella (boss), castello, farfalla, albero, montagne, faro (boss), diamante a strati, cattedrale, piramide a gradoni, grande piramide, re del viaggio (boss). Tessere d'oro, nebbia (dal livello 33), tessere nascoste (dal 31), difficoltà 1-5.

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 21 | 1 | 16 | 1 | 6 | ∞/∞/∞ | – | – | – | 1 | – |
| 22 | 2 | 22 | 1 | 7 | ∞/9/∞ | – | – | – | 1 | – |
| 23 | 3 | 18 | 1 | 8 | 9/6/∞ | 1 | – | – | 1 | – |
| 24 | 4 | 18 | 1 | 9 | 8/5/∞ | 1 | – | – | 2 | – |
| 25 | 5 | 24 | 2 | 10 | 6/4/∞ | 2 | – | – | 2 | sì |
| 26 | 6 | 34 | 2 | 11 | 5/3/∞ | 2 | – | – | 2 | – |
| 27 | 7 | 20 | 2 | 12 | 4/3/∞ | 3 | – | – | 3 | – |
| 28 | 8 | 30 | 2 | 13 | 3/2/10 | 3 | – | – | 3 | – |
| 29 | 9 | 26 | 2 | 14 | 3/1/6 | 3 | – | – | 3 | – |
| 30 | 10 | 24 | 3 | 14 | 2/1/4 | 4 | – | – | 4 | sì |
| 31 | 11 | 32 | 2 | 15 | 3/2/8 | 3 | 6 (6) | – | 3 | – |
| 32 | 12 | 32 | 2 | 16 | 3/2/6 | 3 | 8 (8) | – | 3 | – |
| 33 | 13 | 28 | 3 | 17 | 2/2/6 | 4 | 8 (4+4) | 4 | 4 | – |
| 34 | 14 | 36 | 3 | 18 | 2/2/5 | 4 | 12 (6+6) | 5 | 4 | – |
| 35 | 15 | 44 | 3 | 18 | 2/2/5 | 5 | 16 (8+8) | 6 | 4 | sì |
| 36 | 16 | 34 | 4 | 19 | 2/2/4 | 5 | 12 (4+4+4) | 6 | 4 | – |
| 37 | 17 | 50 | 4 | 20 | 1/2/4 | 5 | 18 (6+6+6) | 8 | 5 | – |
| 38 | 18 | 66 | 5 | 22 | 1/2/3 | 5 | 24 (8+8+8) | 10 | 5 | – |
| 39 | 19 | 70 | 4 | 23 | 1/2/3 | 6 | 24 (6+6+6+6) | 12 | 5 | – |
| 40 | 20 | 78 | 5 | 24 | 2/2/3 | 8 | 32 (8+8+8+8) | 14 | 5 | sì |

**Isole dei dolci, dell'arte, della scienza, del mare, dei fiori (10 livelli ciascuna).** Ogni isola ha 10 forme scelte da un catalogo condiviso con l'Isola degli animali, 3 tavolozze che si alternano, tessere nascoste dal livello 6, nebbia dal 7, boss ai livelli 5 e 10. Aiuti e limiti iniziali come i primi 10 livelli iniziali. Il numero di tessere cambia da isola a isola perché cambia la forma.

**Dolci (41-50)**

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 41 | 1 | 16 | 1 | 5 | ∞/∞/∞ | – | – | – | 1 | – |
| 42 | 2 | 18 | 1 | 6 | ∞/9/∞ | 1 | – | – | 1 | – |
| 43 | 3 | 18 | 1 | 7 | 9/6/∞ | 1 | – | – | 2 | – |
| 44 | 4 | 20 | 2 | 8 | 8/5/∞ | 2 | – | – | 2 | – |
| 45 | 5 | 26 | 2 | 8 | 6/4/∞ | 2 | – | – | 2 | sì |
| 46 | 6 | 34 | 2 | 9 | 5/3/∞ | 2 | 4 (4) | – | 3 | – |
| 47 | 7 | 32 | 2 | 10 | 4/3/∞ | 3 | 6 (6) | 3 | 3 | – |
| 48 | 8 | 36 | 3 | 10 | 3/2/10 | 3 | 8 (4+4) | 4 | 4 | – |
| 49 | 9 | 34 | 4 | 11 | 3/1/6 | 3 | 12 (6+6) | 5 | 4 | – |
| 50 | 10 | 50 | 4 | 12 | 2/1/4 | 4 | 16 (8+8) | 7 | 5 | sì |

**Arte (51-60)**

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 51 | 1 | 22 | 1 | 5 | ∞/∞/∞ | – | – | – | 1 | – |
| 52 | 2 | 18 | 1 | 6 | ∞/9/∞ | 1 | – | – | 1 | – |
| 53 | 3 | 24 | 2 | 7 | 9/6/∞ | 1 | – | – | 2 | – |
| 54 | 4 | 30 | 2 | 8 | 8/5/∞ | 2 | – | – | 2 | – |
| 55 | 5 | 24 | 3 | 8 | 6/4/∞ | 2 | – | – | 2 | sì |
| 56 | 6 | 32 | 2 | 9 | 5/3/∞ | 2 | 4 (4) | – | 3 | – |
| 57 | 7 | 28 | 3 | 10 | 4/3/∞ | 3 | 6 (6) | 3 | 3 | – |
| 58 | 8 | 36 | 3 | 10 | 3/2/10 | 3 | 8 (4+4) | 4 | 4 | – |
| 59 | 9 | 50 | 4 | 11 | 3/1/6 | 3 | 12 (6+6) | 5 | 4 | – |
| 60 | 10 | 66 | 5 | 12 | 2/1/4 | 4 | 16 (8+8) | 7 | 5 | sì |

**Scienza (61-70)**

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 61 | 1 | 16 | 1 | 5 | ∞/∞/∞ | – | – | – | 1 | – |
| 62 | 2 | 22 | 1 | 6 | ∞/9/∞ | 1 | – | – | 1 | – |
| 63 | 3 | 20 | 2 | 7 | 9/6/∞ | 1 | – | – | 2 | – |
| 64 | 4 | 24 | 2 | 8 | 8/5/∞ | 2 | – | – | 2 | – |
| 65 | 5 | 34 | 2 | 8 | 6/4/∞ | 2 | – | – | 2 | sì |
| 66 | 6 | 24 | 3 | 9 | 5/3/∞ | 2 | 4 (4) | – | 3 | – |
| 67 | 7 | 32 | 2 | 10 | 4/3/∞ | 3 | 6 (6) | 3 | 3 | – |
| 68 | 8 | 28 | 3 | 10 | 3/2/10 | 3 | 8 (4+4) | 4 | 4 | – |
| 69 | 9 | 36 | 3 | 11 | 3/1/6 | 3 | 12 (6+6) | 5 | 4 | – |
| 70 | 10 | 44 | 3 | 12 | 2/1/4 | 4 | 16 (8+8) | 7 | 5 | sì |

**Mare (71-80)**

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 71 | 1 | 18 | 1 | 5 | ∞/∞/∞ | – | – | – | 1 | – |
| 72 | 2 | 18 | 1 | 6 | ∞/9/∞ | 1 | – | – | 1 | – |
| 73 | 3 | 30 | 2 | 7 | 9/6/∞ | 1 | – | – | 2 | – |
| 74 | 4 | 26 | 2 | 8 | 8/5/∞ | 2 | – | – | 2 | – |
| 75 | 5 | 20 | 2 | 8 | 6/4/∞ | 2 | – | – | 2 | sì |
| 76 | 6 | 32 | 2 | 9 | 5/3/∞ | 2 | 4 (4) | – | 3 | – |
| 77 | 7 | 36 | 3 | 10 | 4/3/∞ | 3 | 6 (6) | 3 | 3 | – |
| 78 | 8 | 44 | 3 | 10 | 3/2/10 | 3 | 8 (4+4) | 4 | 4 | – |
| 79 | 9 | 50 | 4 | 11 | 3/1/6 | 3 | 12 (6+6) | 5 | 4 | – |
| 80 | 10 | 70 | 4 | 12 | 2/1/4 | 4 | 16 (8+8) | 7 | 5 | sì |

**Fiori (81-90)**

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 81 | 1 | 22 | 1 | 5 | ∞/∞/∞ | – | – | – | 1 | – |
| 82 | 2 | 24 | 2 | 6 | ∞/9/∞ | 1 | – | – | 1 | – |
| 83 | 3 | 34 | 2 | 7 | 9/6/∞ | 1 | – | – | 2 | – |
| 84 | 4 | 30 | 2 | 8 | 8/5/∞ | 2 | – | – | 2 | – |
| 85 | 5 | 32 | 2 | 8 | 6/4/∞ | 2 | – | – | 2 | sì |
| 86 | 6 | 28 | 3 | 9 | 5/3/∞ | 2 | 4 (4) | – | 3 | – |
| 87 | 7 | 34 | 4 | 10 | 4/3/∞ | 3 | 6 (6) | 3 | 3 | – |
| 88 | 8 | 50 | 4 | 10 | 3/2/10 | 3 | 8 (4+4) | 4 | 4 | – |
| 89 | 9 | 66 | 5 | 11 | 3/1/6 | 3 | 12 (6+6) | 5 | 4 | – |
| 90 | 10 | 78 | 5 | 12 | 2/1/4 | 4 | 16 (8+8) | 7 | 5 | sì |

**Tris (91-100)**: nessuna tessera d'oro, nascosta o nebbiosa; la tavola si basa su gruppi da 3.

| Id | Loc. | Tessere | Piani | Tipi (n) | 💡/🔀/↩️ | Oro | Nascoste | Nebbia | Diff. | Boss |
|---|---|---|---|---|---|---|---|---|---|---|
| 91 | 1 | 15 | 1 | 5 | ∞/∞/∞ | – | – | – | 3 | – |
| 92 | 2 | 18 | 1 | 6 | ∞/9/∞ | – | – | – | 3 | – |
| 93 | 3 | 18 | 1 | 6 | 9/6/∞ | – | – | – | 3 | – |
| 94 | 4 | 33 | 2 | 8 | 8/5/∞ | – | – | – | 4 | – |
| 95 | 5 | 30 | 2 | 8 | 6/4/∞ | – | – | – | 4 | – |
| 96 | 6 | 24 | 2 | 8 | 5/3/∞ | – | – | – | 4 | – |
| 97 | 7 | 30 | 2 | 10 | 4/3/∞ | – | – | – | 5 | – |
| 98 | 8 | 36 | 3 | 12 | 3/2/10 | – | – | – | 5 | – |
| 99 | 9 | 42 | 3 | 12 | 3/1/6 | – | – | – | 5 | – |
| 100 | 10 | 48 | 3 | 14 | 2/1/4 | – | – | – | 5 | – |

### 6. Aiuti, annullamento e stati bloccati

#### 6.1 Strumenti

- **💡 Aiuto**: evidenzia una mossa possibile (coppia, o tris nei Tris). Se ci sono tessere nascoste ancora chiuse, preferisce la coppia di stelle. Consuma un uso e conta come aiuto. Se non esiste nessuna mossa, avvia il rimescolo automatico.
- **↩️ Annulla**: rimette in gioco l'ultima mossa (anche l'eventuale sblocco di un gruppo e le tessere d'oro). Conta come aiuto. Dopo un rimescolo non si può più annullare e il gioco lo spiega con un avviso.
- **🔀 Mischia**: riassegna i disegni delle tessere rimaste mantenendo la tavola risolvibile e lo stato degli sblocchi. Conta come aiuto, cancella la cronologia (nessun annullamento prima del rimescolo).
- **🔄 Rifai**: ricomincia il livello da capo con una nuova disposizione. Sostituisce la partita salvata **senza chiedere conferma**.
- **Aiuto automatico** (opzione): dopo 120 secondi senza mosse evidenzia una mossa. Non conta come aiuto.

#### 6.2 Aiuti iniziali e difficoltà

Ogni livello ha un numero base di aiuti (`hints`, `shuf`, `undo`; `null` = illimitato). Le **sei difficoltà** (Impostazioni) si sommano: ognuna conserva le restrizioni della precedente.

| Difficoltà | Aiuti | Tipi di disegno | Rimescoli automatici gratuiti | Tempo per le stelle | Nebbia | ✨ bonus alla prima vittoria | Scurimento delle tessere bloccate |
|---|---|---|---|---|---|---|---|
| Facile | ×2 (i valori ≥ 8 diventano illimitati) | −2 | illimitati | ×1,5 | ×0,5 | 0 | forte (luminosità 58%) sempre |
| Normale | invariati | 0 | illimitati | ×1 | ×1 | 0 | forte nei livelli con `dim` (i primi 7 di ogni isola), leggero (66%) negli altri |
| Medio | ×0,75; l'illimitato diventa 10 | +1 | 3 | ×0,9 | ×1,25 | +1 | come Normale |
| Difficile | ×0,5; l'illimitato diventa 6 | +2 | 2 | ×0,8 | ×1,5 (+1 tessera) | +2 | leggero (66%) sempre |
| Esperto | ×0,25; l'illimitato diventa 3 | +3 | 1 | ×0,7 | ×2 (+2) | +3 | molto leggero (82%) |
| Maestro | 0; l'illimitato diventa 0 | +5 | 0 | ×0,6 | ×3 (+3) | +5 | nessuno |

Note dedotte dal codice: la nebbia «in più» (colonna Nebbia) si somma anche nei livelli che di base non ne hanno (basta che esistano tessere bloccate all'inizio). Con i segnali di accessibilità «daltonismo» o «alto contrasto» lo scurimento resta quello di Normale a prescindere dalla difficoltà.

Eccezione verificata nel codice: il **Mischia** non scende mai sotto 1 uso in nessuna difficoltà (anche Maestro). Il rapporto illimitato-diventa-N è uguale per i tre strumenti. Il bonus ✨ si assegna solo la prima volta che si vince a quella difficoltà, e conta solo la differenza rispetto alla difficoltà più alta già battuta.

#### 6.3 Rimescolo automatico e «Bloccato!»

Dopo ogni mossa, se non esiste più nessuna mossa, compare l'avviso e dopo circa 1,1 secondi, se ancora non ce ne sono, le tessere rimaste vengono riassegnate (come Mischia ma gratuito e **senza contare come aiuto**; azzera la cronologia). Il numero di rimescoli automatici è limitato dalla difficoltà (tabella). Esauriti:

1. se restano rimescoli manuali, suggerisce di usarne uno;
2. altrimenti, se c'è cronologia e Annulla disponibile, suggerisce Annulla;
3. altrimenti compare «Bloccato!» (Ricomincia / Livelli).

Nei Tris, se la tavola rimasta non permette nessun tris, le tessere vengono riordinate in file ben distanziate (`t.rel`): la posizione cambia e viene salvata.

### 7. Punteggi, stelle e ✨

**Stelle (1-3 per livello)**, calcolate così:

- *Per tempo*: con `t` secondi e `P` coppie, 3 stelle se `t ≤ P × 5 × k`, 2 se `t ≤ P × 10 × k`, altrimenti 1, dove `k` è il fattore di difficoltà (tabella). Con «senza pressione del tempo» il tempo dà sempre 3.
- *Per aiuti*: massimo 3 stelle con 0-1 aiuti usati, massimo 2 con al più `max(3, ⌈P/6⌉)` aiuti, altrimenti 1.
- Vale il minore dei due.

Si conserva la **migliore** stella per livello e il **record di tempo** (non registrato con «senza pressione del tempo»). Le stelle sono una sola per livello a prescindere dalla difficoltà: cambiano solo le soglie.

**✨ (monete)**: partenza 3. Si guadagnano: +1 per ogni stella nuova rispetto al massimo precedente; +1 per ogni tessera d'oro in più rispetto al massimo precedente (per livello); bonus di difficoltà (tabella 6.2); regalo all'apertura di un'isola (3 per gli animali, 5 per le altre); +2 alla **prima vittoria** di ciascuna coppia rompicapo + difficoltà (sezione 8). Si spende 1 ✨ per iniziare un rompicapo; se si esce senza aver fatto nessuna mossa il ✨ torna indietro. Per i salvataggi vecchi senza il campo ✨, il valore iniziale è 3 più le stelle e le tessere d'oro già ottenute.

Non esiste una classifica né punteggi numerici oltre a stelle, tempi, ✨ e ★ totali.

### 8. Rompicapi (sala bonus)

Si aprono dal pulsante «🧩 Rompicapi» della mappa. Sono **10 mini-giochi**, ciascuno in **3 difficoltà** (Facile, Medio, Difficile), più la scheda «🔺 Livelli Tris» in fondo alla lista (sezione 5.1).

**Regole comuni** (verificate nel codice):

- Costo: **1 ✨** per iniziare. Se si esce senza aver fatto nessuna mossa, il ✨ torna indietro.
- Prima vittoria di ciascuna coppia *rompicapo + difficoltà*: **+2 ✨** (netto +1 rispetto al costo). Rigiocando non c'è rimborso.
- Stelle 1-3 per coppia, si conserva la migliore. **3 stelle** assegnano una carta d'album (sezione 9).
- **💡 Aiuto**: 3 per partita, gratuiti. Se se ne usa anche uno solo, il massimo diventa **2 stelle**.
- **❔ Spiegazione**: finestra con Obiettivo / Cosa toccare / Consiglio, uguale per tutti i giochi. La prima volta che si gioca ciascun rompicapo compare da sola.
- Gli animali usati sono solo quelli dell'Isola degli animali (28 disegni, senza la stella).
- La vittoria viene registrata subito (stelle, ✨, album), anche se si esce durante l'animazione.
- Senza ✨ il gioco non parte e compare un avviso.

| Rompicapo | Facile / Medio / Difficile | Regole | Stelle | Aiuto 💡 |
|---|---|---|---|---|
| 🃏 **Memory** | 3×4 (6 coppie) · 4×4 (8) · 4×5 (10) | Si girano due carte alla volta; se diverse si rigirano dopo 0,8 s e contano come tentativo. | Con `err = tentativi − coppie`: ≤ coppie/2 → 3; ≤ coppie → 2; altrimenti 1. | Mostra tutte le carte per 1,5 s. |
| 🧩 **Pezzo mancante** | 3 / 4 / 5 domande; 2 / 4 / 6 risposte | Un animale con un quadrato mancante in un punto casuale; si sceglie il pezzo giusto tra pezzi presi nello stesso punto di altri animali con colori ben distinti. Una risposta sbagliata è un errore e si riprova. | 0 errori → 3; ≤ 2 → 2; altrimenti 1. | Toglie una risposta sbagliata. |
| 🔢 **Sudoku** | 4×4 con 6 / 8 / 10 caselle vuote | Quattro animali al posto dei numeri; righe, colonne e quadrati 2×2 senza ripetizioni. Un animale sbagliato non viene inserito e conta come errore. Soluzione unica garantita. | 0 errori → 3; ≤ 2 → 2; altrimenti 1. | Riempie una casella corretta a caso. |
| 🧱 **Puzzle scorrevole** | 3×3 · 4×4 · 5×5 | Pezzi numerati di un animale da rimettere in ordine facendo scorrere nella casella vuota; il disegno modello è mostrato in alto. La tavola si mescola con 70 / 150 / 260 mosse casuali a partire dalla soluzione, quindi è sempre risolvibile. | Mosse ≤ 60% dei passi di mescolamento → 3; ≤ 120% → 2; altrimenti 1. | Evidenzia il pezzo successivo da mettere a posto e dove si trova. |
| 🌀 **Labirinto** | 5×5 · 7×7 · 9×9 | Labirinto perfetto generato con ricerca in profondità; si va dall'animale in alto a sinistra alla stella in basso a destra, con tocco su una casella adiacente o con le frecce. | Mosse ≤ 1,3 × il percorso più breve → 3; ≤ 2× → 2; altrimenti 1. | Evidenzia i primi passi del percorso più breve. |
| 🔍 **Trova le differenze** | 3×2 con 3 differenze · 3×3 con 4 · 4×3 con 5 | Due griglie di animali; nella seconda alcuni sono cambiati in modo ben visibile: animale diverso, colore ruotato, oggetto in più, più piccolo, assente. Si toccano nella seconda griglia. | 0 errori → 3; ≤ 2 → 2; altrimenti 1. | Fa lampeggiare una differenza. |
| 🫙 **Smista i barattoli** | 3 / 4 / 6 specie, tutte in barattoli da capacità 5, più 2 barattoli vuoti | Si sposta l'animale in cima a un barattolo su un altro se vuoto o con lo stesso animale in cima. Si vince con ogni barattolo vuoto o con 4 animali uguali. La partita si genera con mosse inverse e si rigenera finché esistono almeno 3 mosse verso barattoli già occupati. C'è Annulla. | Mosse ≤ 1,3 × le mosse di costruzione → 3; ≤ 2,2× → 2; altrimenti 1. | Mostra la prima mossa di una soluzione trovata con una ricerca A*-simile (max 60 000 nodi); se non ne trova, suggerisce di annullare. |
| 🔗 **Collega le coppie** | griglie 4×4 · 5×5 · 6×6 con 3 / 4 / 5 coppie | Si trascina il dito da un animale al suo gemello senza incrociare altri percorsi. Un tracciato che non arriva al gemello si cancella e conta come errore. Non si deve riempire tutta la griglia. | Errori ≤ 1 → 3; ≤ 4 → 2; altrimenti 1. | Completa il collegamento di una coppia. |
| 🔤 **Cerca parole** | griglie 6×6 · 7×7 · 8×8 con 4 / 5 / 6 parole | Parole di animali nella **lingua del gioco** (FR/EN/IT), in orizzontale e verticale; in Difficile anche in diagonale; dal Medio anche al contrario (35%). Si tocca la prima e poi l'ultima lettera. Le lettere vuote sono casuali. | Errori ≤ 1 → 3; ≤ 4 → 2; altrimenti 1. | Evidenzia la prima lettera di una parola. |
| ✏️ **Unisci i puntini** | stella (14 punti) · cuore (20) · fiore a 6 petali (22) | Si toccano i punti in ordine da 1 a N; un punto sbagliato è un errore. Alla fine il contorno si riempie e compare un disegno (stella: tessera stella; cuore: un animale a caso; fiore: il disegno n. 98 del catalogo). | 0 errori → 3; ≤ 3 → 2; altrimenti 1. | Evidenzia il punto successivo. |

Elenco parole usate: francese CHAT, CHIEN, LAPIN, RENARD, PANDA, TIGRE, SINGE, KOALA, LION, OURS, HIBOU, VACHE, CANARD, POULE; inglese CAT, DOG, RABBIT, FOX, PANDA, TIGER, MONKEY, KOALA, LION, BEAR, OWL, COW, DUCK, HEN; italiano GATTO, CANE, VOLPE, ORSO, LEONE, TIGRE, PANDA, KOALA, RANA, POLPO, GUFO, MUCCA, ANATRA, PESCE (14 per lingua; nelle lingue con parole più lunghe della griglia vengono escluse).

### 9. Album da collezionare

Sei album, aperti da «📒 Album» nella mappa; le carte non ancora ottenute sono sagome scure con «???». Quando se ne guadagna una compare una finestra regalo con la carta (una alla volta se sono più di una).

**Album generale «animali» (41 carte, 5 categorie):** Cani 10 (tra cui le mascotte Collie e Shetland), Gatti 8 (tra cui la mascotte Siamese a pelo lungo), Pappagalli 6, Pappagallini 5, Zoo 12. Si sbloccano in un ordine fisso che alterna le categorie (la prima carta di ognuna, poi la seconda, ecc.). Carte guadagnate = `⌊ stelle totali / 4 ⌋ + sfide`, massimo 41. Le «stelle totali» sommano **tutti** i livelli, compresi i Tris.

**Sfide** (ognuna conta 1 carta, una sola volta): vincere un livello **boss**; vincere ciascuno dei 10 livelli **Tris**; ottenere **3 stelle** in un rompicapo a una data difficoltà (30 combinazioni).

**Album per isola** (dolci, arte, scienza, mare, fiori; 14 carte ciascuno, i 14 disegni dell'isola): carte guadagnate = `⌊ stelle dell'isola / 2 ⌋ + boss vinti in quell'isola`, massimo 14. Non c'è un album per i livelli iniziali né per i Tris; l'album «animali» fa le veci dell'Isola degli animali.

Disegni usati solo nell'album e mai nelle partite: indici 110-128 (razze di cani e gatti, pappagalli, animali dello zoo, quattro colori di cocorita).

### 10. Grafica, animazioni e audio

#### 10.1 Tessere e disegni

- **129 disegni** in SVG con `viewBox 0 0 60 80`. Ogni disegno ha un colore pastello di sfondo per la faccia della tessera. Stile: animali e oggetti stilizzati, per lo più con volto (occhi, guance, bocca), con contorno scuro comune.
- Elenco per indici: 0-11 animali (gatto, cane, coniglio, volpe, panda, rana, tigre, scimmia, pinguino, maialino, koala, polpo); 12-15 lettere e numeri (A, M, 7, 3); 16-21 pulcino, leone, orso, mucca, gufo, balena; 22-25 lettere e numeri (K, Z, 5, 9); 26 **stella** (disegno speciale per le tessere nascoste); 27-29 sole, luna, mare; 30-39 shiba, husky, dalmata, golden retriever, siamese, gatto nero, persiano, ara, cocorita, calopsitta; 40-53 dolci; 54-67 arte; 68-81 scienza; 82-95 mare; 96-109 fiori; 110-128 solo album.
- **Elenco per isola** (14 + stella): *dolci* cupcake, ciambella, gelato, biscotto, lecca-lecca, fetta di torta, macaron, cioccolato, caramella, budino, zucchero filato, omino di pan di zenzero, fragola, frappè; *arte* tavolozza, pennello, cavalletto, cornice, matita, pastello, tubetto di colore, macchina fotografica, nota musicale, chitarra, maschera di teatro, vaso, basco da pittore, libro; *scienza* pi greco, infinito, radice quadrata, dado, atomo, calamita, prisma, lampadina, lente d'ingrandimento, razzo, pianeta con anelli, cometa, telescopio, astronauta; *mare* pesce, medusa, granchio, stella marina, cavalluccio marino, tartaruga, conchiglia, delfino, squalo, ostrica con perla, ancora, faro, barca a vela, corallo; *fiori* rosa, tulipano, girasole, margherita, loto, fiore di ciliegio, lavanda, papavero, orchidea, narciso, ibisco, quadrifoglio, farfalla, ape.
- Stati della tessera: normale, **selezionata**, **bloccata** (scurita, con gradazione dalla difficoltà, sezione 6.2), **nascosta** (sagoma con punto interrogativo e lucchetto), **nebbiosa** (nuvola con punto interrogativo), **d'oro** (alone dorato e ✨), **evidenziata** dall'aiuto, **«uguale»** o **attenuata** con «Illumina le tessere uguali», **bloccante** (mostra le tessere che ne coprono un'altra).
- Spessore 3D: ogni tessera ha un bordo laterale di due toni (`--edge`, `--edge2`). Per lo scostamento di 4-5 px tra i piani, una tessera coperta è raggiungibile solo dal bordino scoperto (dedotto dal codice di layout e confermato dai manuali).
- Tavolozza del livello: 5 colori (feltro chiaro, feltro scuro, accento, bordo, bordo scuro). I 20 livelli iniziali hanno 20 tavolozze diverse; ogni isola nuova ne ha 3 che si alternano.

#### 10.2 Mascotte

Quattro mascotte a fumetto fedeli alla razza, disegnate come busto in SVG: **Collie** (predefinita), **Shetland**, **Siamese a pelo corto**, **Siamese a pelo lungo**; oppure **nessuna**. Compaiono nella scritta delle combo (58 px), nelle finestre regalo (92 px, sostituiscono 🎁 e 🏆) e nella scelta in Impostazioni (76 px). Tre di esse sono anche carte dell'album generale.

#### 10.3 Animazioni ed effetti

- **CSS** (`@keyframes`): pulse, tin, flip, glow, cardIn, trophy, starpop, blk, shake, mglow, gemtw, fogdrift, fogaway, pz; ingresso della tavola con ritardo per tessera (in funzione di piano, riga e colonna); sparizione della coppia (260 ms); sblocco; diradamento della nebbia (700 ms).
- **Combo**: scritta in alto («Bien !», «Super !», «Génial !», «Incroyable !» e traduzioni; 4 livelli) animata con la Web Animations API, più scintille emoji (⭐ ✨) il cui numero cresce con la combo.
- **Scintille**: particelle emoji (⭐ ✨ 💛) per tessere d'oro, regali e abbinamenti.
- **Fuochi d'artificio** su `<canvas>`: razzi, scintille e coriandoli. Razzi iniziali = `2 + ⌊livello/3⌋` (livello limitato a 12), +3 nei finali; i coriandoli durano 5 s (9 s nei finali); i finali sono livello 20, fine isola e livello 90.
- **Riduzione del movimento**: se il sistema chiede `prefers-reduced-motion`, spariscono coriandoli e molte animazioni; l'opzione «Effetti speciali» spegne scintille, combo e animazioni dorate.

#### 10.4 Audio e vibrazione

Nessun file audio: tutto è sintetizzato con Web Audio (oscillatori e rumore filtrato). 15 effetti: selezione, abbinamento (la nota sale lungo una scala di 8 gradi con la combo, con quinta e ottava sopra), blocco, aiuto, annulla, rimescolo, «bloccato», avvio livello, stella (tono crescente), vittoria, esplosione dei fuochi, nebbia, tessera d'oro, sblocco, pop. Il contesto audio si avvia al primo tocco. Volume 0-100 a passi di 5, interruttore suoni, interruttore vibrazione. Vibrazione di 14 ms a ogni abbinamento e 30 ms come anteprima nell'attivazione.

### 11. Impostazioni, accessibilità e lingue

**Gruppi di impostazioni** (tutte salvate; vedi sezione 12):

| Gruppo | Voci |
|---|---|
| Mascotte | Collie, Shetland, Siamese a pelo corto, Siamese a pelo lungo, nessuna |
| Difficoltà | Facile, Normale, Medio, Difficile, Esperto, Maestro (sezione 6.2) |
| Aspetto | sfondo: «come il livello» + 8 palette (giada, oceano, ciliegio, tramonto, viola, grafite, notte, sabbia); colore dello spessore delle tessere: «come il livello» + 8 palette (verde, blu, rosa, oro, viola, grafite, rosso, verde acqua) |
| Comfort e accessibilità | **Modalità comoda**; testi e pulsanti più grandi; contrasto alto (tessere bianche, contorni spessi); segnali senza colore per il daltonismo (tratteggio sulle tessere bloccate, contorni spessi, colori sicuri blu/arancio); senza pressione del tempo (cronometro nascosto, stelle indipendenti dal tempo, nessun record); barra delle tessere selezionate |
| Aiuti di gioco | effetti speciali; illumina le tessere uguali (le libere uguali si circondano di verde con ✔, le altre si attenuano); aiuto automatico (120 s) |
| Suoni e vibrazione | suoni, volume, vibrazione |
| Lingua | FR, EN, IT |
| Ripristino | «Ripristina predefiniti» (azzera tutte le impostazioni, mascotte e difficoltà comprese; non tocca i progressi) |

La Modalità comoda vale **dalla prossima partita** e porta con sé testi grandi, assenza di pressione del tempo, evidenzia-uguali e aiuto automatico (sezione 5.3). Il segnale «daltonismo» sostituisce la tavolozza del livello con colori sicuri blu/arancio; «daltonismo» e «contrasto alto» attivano entrambi i segnali senza colore (tratteggio sulle bloccate) e fanno restare lo scurimento delle tessere bloccate quello di Normale.

**Accessibilità presente**: etichette `aria-label` sui pulsanti (20), interruttori con `role="switch"`, regione `aria-live` sulla barra delle selezioni, supporto a `prefers-reduced-motion`, tasto di pausa utilizzabile da tastiera (Invio/Spazio). **Assente** (verificato): etichette sulle singole tessere, navigazione da tastiera o lettore di schermo sulla tavola (le tessere sono `div` con gestore di click, non focalizzabili), tema chiaro.

**Lingue.** Francese (predefinita), inglese, italiano. 254 chiavi di testo per lingua, coerenti tra loro (verificato: nessuna chiave mancante o in più), i nomi di tutte le 129 tessere e dei 20 livelli sono tradotti. La lingua incide anche sul rompicapo «Cerca parole». Scelta dalla mappa, dal menu livelli e dalle Impostazioni; salvata. Il codice non usa il linguaggio del dispositivo per scegliere la lingua iniziale.

**Guida.** Raccoglie le 11 spiegazioni illustrate dei livelli (sezione 5.4): quelle dei livelli non ancora raggiunti compaiono come «sbloccata al livello N». Si apre con `?` in partita o dalla mappa e dal menu; il cronometro resta fermo finché è aperta.

### 12. Salvataggi

Tutto in `localStorage`; nessun dato esce dal dispositivo.

| Chiave | Contenuto |
|---|---|
| `mj_prog3` | Progressi: `unlocked` (livelli 1-40), `stars{livello}`, `best{livello}` (record di tempo), `seen{livello}` (spiegazioni viste), `iu{isola}` (avanzamento delle isole 41+ e Tris), `revealed{isola}` (regalo già dato), `coins` (✨), `gold{livello}` e `goldTot{livello}`, `dif{livello}` (difficoltà più alta battuta), `puz{rompicapo:difficoltà}`, `pzSeen{rompicapo}`, `chalDone{}` e `chal` (sfide), `albumSeen` e `albSeenI{isola}` (carte già mostrate) |
| `mj_set1` | Impostazioni (sezione 11): `bg, tile, ui, hc, cb, nt, bar, vol, vib, eq, auto, cf, fx, dif, mascot` |
| `mj_save1` | **Una sola** partita in corso: versione 1, livello, secondi, gruppo sbloccato, aiuti rimasti e usati, rimescoli automatici rimasti, flag comoda e difficoltà, tessere d'oro raccolte, per ogni tessera `[disegno, gruppo nascosto, rimossa, oro, nebbia, posizione ridefinita]`, cronologia delle mosse, timestamp |
| `mj_lang` | Lingua |
| `mj_mute` | Suoni spenti |

La partita si salva dopo ogni mossa, aiuto, annulla e rimescolo, ogni 10 secondi, in pausa, quando la scheda va in secondo piano e alla chiusura della pagina (`pagehide`). Il caricamento scarta il salvataggio se: versione diversa, livello inesistente, numero di tessere diverso da quello del livello, o nessuna tessera rimasta. **Non** verifica la posizione delle tessere, quindi cambiare una forma può far riprendere vecchie partite su una tavola diversa. La chiave vecchia `mj_prog2` viene cancellata all'avvio.

«🗑️ Cancella tutta la progressione» chiede un secondo tocco entro 3,5 secondi; azzera i progressi e il salvataggio (non le impostazioni, non la lingua). Vedi «Vincoli e scartato», difetto 1.

## Punti d'ingresso nel codice

Il codice dell'originale sta in `Majoa Mahjong.html`; i numeri sono le righe in cui inizia l'elemento. Servono per ritrovare in fretta la regola da cui nasce una funzione della nuova app.

| Area | Elemento (riga) | Ruolo |
|---|---|---|
| Regole | `isFree` (1762) | Tessera libera |
| Regole | `makeGroups` (1778), `assign` (1810) | Gruppi di tessere uguali e generazione risolvibile |
| Regole | `findMove` (1936), `tap` (2117) | Mossa disponibile; selezione e abbinamento |
| Regole | `rescue` (2164), `deadCheck` (2184) | Rimescolo automatico e «Bloccato!» |
| Livelli | `ISLANDS` (1159), `LEVELS` (1191) | Isole e parametri dei livelli |
| Livelli | `ISL_SHAPES` (1248), `ISL_CFG` (1271), `COMFORT` (1280), `layoutList` (1302) | Forme, configurazione delle isole, layout comodi, scelta del layout |
| Livelli | `markFog` (1336), `markHidden` (1344) | Nebbia e tessere nascoste |
| Difficoltà | `DIF_AID` (1369), `nEff` (1975), `scaleAid` (1979) | Parametri dei profili e loro applicazione |
| Flusso | `startLevel` (2350), `calcStars` (2274), `win` (2280) | Avvio livello, stelle, vittoria |
| Flusso | `buildMenu` (2434), `worldState` (2472), `buildMap` (2490), `buildBonus` (2538) | Menu livelli, stato delle isole, mappa, sala rompicapi |
| Rompicapi | `PUZZLES` (2531), `buildMemory` (2685), `buildMissing` (2744), `buildSudoku` (2807), `buildSlide` (2857), `buildMaze` (2896), `buildDiff` (2942), `buildJars` (2975), `buildPairs` (3023), `buildWords` (3095), `buildDots` (3165) | I 10 rompicapi |
| Album | `ALBUM` (3206), `islandEarned` (3213), `albumEarned` (3217), `chalAward` (3225), `buildAlbum` (3245) | Carte e sfide |
| Grafica e audio | `FACES` (613), `MASCOTS` (821), `paintTile` (1890), `SND` (1739), `sparkBurst` (2082), `showCombo` (2101), `startFx` (2264) | Disegni, mascotte, tessera, suoni, effetti |
| Impostazioni e testi | `I18N` (1390), `applySettings` (3401), `buildSettings` (3416) | Lingue e impostazioni |
| Salvataggio | `saveGame` (2011) | Partita in corso |

## Vincoli e scartato

### Difetti noti dell'originale

La tabella elenca i difetti e le incongruenze trovati e dice come vanno trattati nella nuova app. «Verificato» indica che sono stati riprodotti eseguendo il gioco; «letto» indica che sono dedotti dal codice.

| Id | Difetto | Evidenza | Trattamento nella nuova app |
|---|---|---|---|
| 1 | Dopo «Cancella tutta la progressione» la sessione si rompe fino al ricaricamento: il reset ricrea i progressi con soli quattro campi e aprire «Rompicapi» o completare un livello lancia un errore (causa probabile del secondo: `prog.dif` non inizializzato) | Verificato (errori riprodotti in Chromium); causa del secondo letta | **Correggere**: reset transazionale con valori predefiniti e test sui casi d'uso subito dopo il reset |
| 2 | Le stelle contano in modo diverso per l'album (tutti i livelli, Tris compresi) e per lo sblocco delle isole (livelli 1-90) | Letto | **Risolto**: un solo criterio (`docs/motore-livelli.md`) |
| 3 | Un solo slot di salvataggio: «Rifai» e l'avvio di un altro livello lo sostituiscono senza chiedere conferma | Letto (`startLevel` termina con un salvataggio) | **Correggere**: conferma prima di sostituire |
| 4 | Dopo 1500 tentativi la generazione ripiega su un'assegnazione senza garanzia di risolvibilità, senza segnalarlo né contarlo | Letto | **Non replicare**: errore tipizzato e nuovo tentativo (`docs/motore-livelli.md`, `DRAFT`) |
| 5 | La ripresa di una partita non verifica la posizione delle tessere: cambiare una forma può far riprendere una vecchia partita su una tavola diversa | Letto | **Correggere**: partita ricostruibile da spec, seme e mosse, con controllo dell'hash della tavola |
| 6 | Valori scelti a occhio: fattore 0,7 della Modalità comoda, soglie di tempo delle stelle (5 e 10 secondi per coppia), soglie dei rompicapi; nel Puzzle scorrevole il riferimento delle stelle sono i passi del mescolamento casuale e non la soluzione minima | Letto (dichiarato anche dai manuali) | `TO DO`: ricalibrare con dati di gioco |
| 7 | La nebbia «in più» dei profili Difficile, Esperto e Maestro si aggiunge anche ai livelli che di base non ne hanno | Letto | `TO DO`: decidere se replicare |
| 8 | Una tessera coperta si tocca solo dal bordino scoperto (4-5 px tra i piani) | Letto, confermato dai manuali | **Rivedere**: regola di `hitTest` nel dominio, con tolleranza o zoom |
| 9 | Nessuna accessibilità per le singole tessere: niente etichette, niente focus da tastiera, niente tema chiaro | Verificato per assenza | `TO DO`: decidere (README, sezione 8) |
| 10 | Un ramo `if(false){}` in «Pezzo mancante» | Letto | **Non replicare** |
| 11 | Traduzioni FR ed EN da rivedere da madrelingua; i manuali sono in parte non allineati al codice (esempio: il backlog dice «volume e vibrazione solo acceso/spento», ma il codice ha il cursore del volume) | Dichiarato dai manuali; confronto non sistematico | Nota: dove serve vale il codice |

### Scelte della nuova app rispetto all'originale

- Si porta tutto il perimetro (100 livelli, 10 rompicapi, 6 album, 4 mascotte, 6 profili, Modalità comoda, Tris), ma isole e progressione sono ridisegnate per livelli infiniti: vedi `docs/motore-livelli.md`.
- «Cerca parole» mantiene FR, EN e IT; altre lingue verranno aggiunte.
- Lingua iniziale: quella del dispositivo; se non è supportata, inglese. L'originale parte in francese e non guarda la lingua del dispositivo.
- Interfaccia sempre in verticale: l'originale non blocca l'orientamento.

### Assente nell'originale

Verificato per assenza nel codice: pubblicità e monetizzazione, acquisti in-app, account o salvataggi su server, analitica, classifiche, obiettivi di piattaforma, notifiche, statistiche di gioco, sfida giornaliera, generazione con seme riproducibile (si usa `Math.random` ovunque), tema chiaro, zoom della tavola, lettore di schermo sulle tessere, musica di sottofondo.

Idee dei manuali approvate ma non sviluppate: zoom della tavola, più preset per il daltonismo, etichette e segni sulle tessere, tocchi più tolleranti, lettore dello schermo, temi come premi, avviso prima di sostituire una partita salvata, statistiche, stelle e record separati per profilo. Non sono funzioni dell'originale e non vanno trattate come tali.

## Verifica

- **Coperto da test**: la suite `TEST_majoa.js` ha 25 sezioni: sintassi; lingue; livelli iniziali, isole e mappa; isola (forme, tessere d'oro, combo, effetti); nebbia, difficoltà, mappa con nebbia, gettoni; rompicapi Memory, Pezzo mancante, Sudoku; mascotte e parole degli effetti; nuove isole e Tris; rompicapi scorrevole, labirinto, differenze, barattoli, coppie, parole, puntini; album; rompicapi (generazione ripetuta, schermo 360 × 640, aiuti e spiegazioni); modali delle novità; annulla dopo il rimescolo; stelle e aiuti; pausa; guida; tessere bloccate; impostazioni; piccoli aiuti; Modalità comoda; salvataggio e ripresa; intestazione su schermi stretti; tutti i 20 livelli con click reali.
- **Come eseguirli**: `node TEST_majoa.js <file.html> [--quick] [--shots=cartella]`, con Playwright e Chromium disponibili. `--quick` salta la partita completa dei 20 livelli (circa 1 minuto invece di 4-5).
- **Verificato** su questo capitolo: lettura integrale del codice; esecuzione in Chromium headless, con un gancio di debug inserito in una copia del file, per contare livelli, tessere, disegni e chiavi di testo (129 disegni; 254 chiavi per lingua, coerenti tra FR, EN e IT); riproduzione del difetto 1; **142 controlli della suite superati senza fallimenti nelle prime 8 sezioni su 25**, in modalità rapida.
- **Non verificato**: le altre 17 sezioni della suite e il suo riepilogo finale (l'esecuzione è stata interrotta per un limite di tempo); la frequenza del fallback di generazione (i manuali dicono «mai visto»); il comportamento su dispositivi reali.

## Collegamenti

- `docs/motore-livelli.md`: come la nuova app descrive, genera e ordina i livelli e come estende le isole.
- README, sezione 5: decisioni correlate; sezione 8: `TO DO` aperti.
- `docs/linee-guida-codice.md`: regole di codice per la riscrittura.
