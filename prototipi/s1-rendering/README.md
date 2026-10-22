# S1 — rendering Skia dei disegni e della tavola (prototipo)

Il prototipo S1 risponde a due domande del README principale (sezione 8): Skia rende fedelmente i 129 disegni esportati dall'originale? E la tavola del livello 20 (96 tessere, 5 piani) con le animazioni gira fluida su un Android di fascia bassa? È un esperimento usa e getta: non fa parte dell'app e il suo codice non si riusa così com'è.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `assets/tiles/000.svg … 128.svg` | I 129 disegni esportati dall'originale (`viewBox 0 0 60 80`), con i testi già convertiti in tracciati |
| `src/data/level20.json` | Geometria del livello 20 dell'originale (96 tessere, 5 piani, 24 disegni). L'assegnazione dei disegni è un campione: l'originale la genera a caso a ogni partita |
| `src/board.ts` | Geometria della tavola, tessera libera (`isFree`), `hitTest`, colonna di gioco 3:4. Funzioni pure, con test in `src/board.test.ts` |
| `src/TileBoard.tsx` | Tavola in un unico `<Canvas>` Skia; animazioni con valori condivisi di Reanimated; tocco con `hitTest` |
| `src/TileBoardLayered.tsx` | Tavola a due strati: le tessere ferme in un'unica immagine (`drawAsImage`), solo quelle animate (o, in modalità partita, quelle libere) disegnate dal vivo |
| `src/equivalence.tsx` | Confronto sui pixel tra lo strato fermo e gli sprite vivi |
| `src/TileBody.tsx` | Corpo della tessera (bordo, ombra, faccia) e sua versione in cache: un'immagine disegnata una volta con `drawAsImage` |
| `src/Gallery.tsx` | Griglia dei 129 disegni |
| `src/FpsMeter.tsx` | Misura i fotogrammi sul thread UI (`useFrameCallback`) e l'eco di andata e ritorno col thread UI |
| `src/perf.ts`, `src/layout.ts` | Ritardo del thread JS; altezza dell'intestazione condivisa con la prova web |
| `src/SvgAt.tsx` | Disegna un SVG in una posizione (aggira un limite di `ImageSVG`, vedi «Problemi trovati») |
| `tools/` | Esportazione dall'originale, conversione dei testi, confronto di fedeltà, prova web |

L'interfaccia ha questi pulsanti: **Tavola** e **Galleria** cambiano schermata; **Anima** fa oscillare le tessere; **Ombre** aggiunge l'ombra sfocata a ogni tessera; **Entrata** rigioca l'animazione di ingresso a ritardi sfalsati; **Memo** attiva o disattiva la stabilità delle proprietà delle tessere; **Cache** disegna il corpo delle tessere come immagine in cache; **Strati** passa alla tavola a due strati; **Vive N** sceglie quante tessere sono animate dal vivo nella tavola a strati (0, 2, 8, 24, 96); **Partita** avvia una partita simulata (ogni secondo rimuove una coppia di tessere libere con l'animazione di rimozione); **Prova 1-4** eseguono le prove automatiche; **Confronto** verifica sui pixel che lo strato fermo e gli sprite vivi siano indistinguibili. In alto: caricamento degli SVG, tessere libere, dimensione della tessera, fotogrammi del thread UI, ritardo dall'ultimo tocco al commit di React, ultima tessera toccata ed esito del confronto.

## Prove automatiche

Ogni prova esegue passaggi di 6,5 secondi (1,5 di riscaldamento e 5 di misura) e mostra una tabella; l'esito va anche nel log con il prefisso `S1-BENCH`. In ogni passaggio simula un tocco ogni 0,4 secondi su una tessera libera diversa. **Prova 1** (10 passaggi) confronta memo e cache; **Prova 2** (6 passaggi) confronta la tavola tutta dal vivo con la tavola a strati e con un numero crescente di tessere vive; **Prova 3** (5 passaggi) misura 26 e 48 tessere vive, la cache nello strato fermo e le ricostruzioni ripetute dell'immagine; **Prova 4** (2 passaggi da 20 secondi) misura una partita simulata.

Colonne: `m` memo, `c` cache del corpo (+ attivo, − spento); fps medi del thread UI; `pegg` = peggior fotogramma; `JS` = ritardo massimo del thread JS (un timer da 20 ms che arriva in ritardo); `tocco` = tempo medio e massimo dal gesto al commit di React; `eco` = andata e ritorno di un messaggio JS → thread UI → JS, medio e massimo; `img` = tempo medio/massimo (e numero) di ricostruzioni dell'immagine dello strato fermo; `fantasmi` = tessere rimosse mentre erano ancora nell'immagine, quindi visibili fino alla ricostruzione. Tutti i tempi sono in millisecondi.

Per misure realistiche eseguire l'app in modalità di produzione: `npx expo start --no-dev --minify`.

## Esecuzione su dispositivo

```bash
cd prototipi/s1-rendering
npm install
npx expo start
```

Aprire poi l'app con Expo Go su Android. Se l'Expo Go dello store non supporta ancora la SDK 57, costruire una build di sviluppo con `npx expo run:android`. Per provarla in un browser: `npm run setup:web && npx expo start --web`.

## Comandi di verifica

| Comando | Cosa verifica |
|---|---|
| `npm run typecheck` | Tipi TypeScript |
| `npm test` | Test del dominio (`src/board.test.ts`) con il runner di Node, senza dipendenze aggiuntive |
| `npm run setup:web && npm run web:build` | Copia CanvasKit in `public/` e produce `dist/` per il web |
| `node tools/web-test.mjs [cartella]` | Prova in Chromium headless: caricamento dei 129 SVG, tocco confrontato con `hitTest`, errori in console, screenshot |
| `python3 tools/fidelity.py assets/tiles <cartella> 3` | Confronto pixel tra il motore SVG di Skia e Chromium sui 129 disegni (richiede `skia-python`, `numpy`, `pillow`, `playwright`) |

Per rigenerare gli asset dall'originale (dopo la patch di riallineamento, l'originale sta in `reference/majoa-originale/`):

```bash
node tools/export-designs.js "../../reference/majoa-originale/Majoa Mahjong.html" .
python3 tools/text_to_paths.py assets/tiles <Poppins-Bold.ttf> <DejaVuSerif-Bold.ttf>
node tools/generate-tile-index.js
```

I due font sono una scelta provvisoria con licenza libera: la scelta definitiva del carattere di lettere e numeri è una decisione di grafica.

## Risultati (18/10/2026)

| Domanda | Esito | Come è stato misurato |
|---|---|---|
| Il motore SVG di Skia legge i 129 disegni? | Sì: 129 su 129, nessun errore | `skia-python` 144 (modulo SkSVG), `tools/fidelity.py` |
| Il risultato coincide con Chromium? | 127 identici; 2 con differenza media di al più 0,001 su 255; nessuno con più dell'1% di pixel diversi | Confronto pixel a 180 × 240 |
| E i testi? | **SkSVG non disegna `<text>`**: 11 tessere (A, M, 7, 3, K, Z, 5, 9, π, ∞, √) risultavano senza lettera. Convertiti in tracciati, ora identici | Confronto prima e dopo la conversione, controllo visivo |
| Il tocco funziona? | Sì: 3 prove su 3 coincidono con `hitTest` (tessera in cima, tocco fuori, bordino di una tessera coperta), con telefono (390 dp) e finestra larga (1280 dp) | `tools/web-test.mjs` |
| Quanto è raggiungibile una tessera libera? | Delle 96 tessere, 26 sono libere all'inizio; ognuna è raggiungibile per almeno l'84% della propria area (telefono) | `src/Main.tsx`, `visibleFraction` |
| Il bundle nativo si compila? | Sì per Android e per iOS (Hermes, circa 1420 moduli) | `expo export --platform android` e `ios` |
| Fotogrammi su un Android | Primo test dell'utente, con «Anima» e «Ombre» attivi: **21 fps, peggior fotogramma 50 ms**; 129 SVG caricati in 933 ms. Modello del dispositivo non indicato | Schermata inviata dall'utente |
| Ritardo della selezione al tocco | **Circoscritto, non risolto**: sul dispositivo la selezione arrivava dopo circa 2 secondi; compare con le animazioni su tutte le tessere (eco medio fino a 2,7 s), non con la scena ferma né con le ombre. Correzione a strati da verificare su dispositivo | Prova 1 dell'utente, sezione «Ritardo al tocco» |

Nota sul tocco: la tessera coperta si raggiunge solo dal bordino scoperto (4-5 px tra i piani), ma le tessere coperte non sono selezionabili nel gioco. Il limite pesa solo sul feedback «ecco cosa la blocca»; per le tessere libere l'area utile è quasi intera.

### Limiti della verifica

- `skia-python` usa la versione 144 di Skia; React Native Skia 2.6.2 incorpora una versione diversa (non verificata). Il modulo SVG è lo stesso, ma l'esito va riconfermato su dispositivo.
- Su web React Native Skia disegna gli SVG con l'elemento `<img>` del browser (`JsiSkSVGFactory`): la prova web **non** collauda il motore SVG nativo, ma l'integrazione dell'app.
- Gli fps misurati in Chromium headless (WebGL software, 1-6 fps) non sono rappresentativi.
- L'app non è stata eseguita su dispositivo né su emulatore.
- `expo-doctor` passa 19 controlli su 21; i due falliti richiedono l'accesso a `exp.host`, non raggiungibile dall'ambiente di prova.

### Problemi trovati

1. **`<text>` non viene disegnato dal motore SVG di Skia.** Rimedio: conversione in tracciati in fase di esportazione (`tools/text_to_paths.py`).
2. **`ImageSVG` ignora x e y se uno dei due è zero** (`sksg/Recorder/commands/Drawing.js`: `if (x && y) canvas.translate(x, y)`): i disegni con `x=0` o `y=0` finiscono tutti in `(0, 0)`. Rimedio: `src/SvgAt.tsx` trasla con un `Group`. Il codice è del player JavaScript di Skia; che valga anche su nativo è da confermare su dispositivo.
3. **`Image.resolveAssetSource` non esiste su `react-native-web`.** Rimedio: `loadData` di Skia, che risolve l'asset su ogni piattaforma.
4. **`setup-skia-web` copia `canvaskit.wasm` in `web/static/js/`** invece che in `public/` con questo progetto Expo. Rimedio: lo script `npm run setup:web`.
5. **TypeScript 6 non include più i tipi di `@types/*` per impostazione predefinita.** Rimedio: `"types": ["node"]` in `tsconfig.json`.
6. **Versione della SDK.** Al 18/10/2026 npm indica Expo 58 come `latest` (React Native 0.88.0, pubblicato il 15/10/2026). Il prototipo usa la 57, come da README: se passare alla 58 prima di creare l'app è una decisione da prendere.
7. **SkSVG ignora la dimensione richiesta se il file ha `width` e `height` fissi** e disegna sempre 60 × 80: sul dispositivo le immagini uscivano dalla tessera (segnalato dall'utente). Verificato con `skia-python`: con `width="60" height="80"` un contenitore 30 × 40 produce comunque un disegno da 59 × 69; senza quegli attributi, uno da 30 × 35. Rimedio: gli SVG hanno solo il `viewBox` (`tools/export-designs.js`); `tools/fidelity.py` ora verifica che la dimensione sia rispettata.
8. **SkSVG non ritaglia il disegno sul viewBox**, il browser sì: 10 disegni sporgono di qualche unità (per esempio le orecchie del koala, da −3 a 63 su 60). Rimedio: `SvgAt` ritaglia sul riquadro del disegno.
9. **L'animazione di rimozione non coincideva con l'originale.** L'originale (`.tile.gone`) porta la tessera a scala 0,6 con rotazione di 8° in 120 ms e la dissolve in 250 ms; il prototipo usava un'unica curva più lenta e senza rotazione. Ora usa gli stessi valori. Le scintille di `burstAt` dell'originale non sono nel prototipo.

### Ritardo al tocco: esito della Prova 1 su dispositivo

Misure dell'utente (Android, modalità di produzione, modello non indicato; ms salvo indicazione):

| Passaggio | fps | pegg | JS | tocco medio/max | eco medio/max |
|---|---|---|---|---|---|
| m− c− fermo | 50 | 83 | 135 | 32/46 | 74/137 |
| m− c− Anima+Ombre | 21,5 | 100 | 2870 | 50/51 | 2746/2890 |
| m+ c− fermo | 48,4 | 67 | 121 | 39/153 | 81/151 |
| m+ c− Anima | 45,6 | 67 | 1523 | 36/75 | 914/1239 |
| m+ c− Ombre | 39,8 | 117 | 212 | 31/69 | 74/205 |
| m+ c− Anima+Ombre | 21,3 | 100 | 2678 | 34/48 | 2357/2699 |
| m+ c+ fermo | 51 | 84 | 156 | 31/58 | 41/102 |
| m+ c+ Anima | 50,2 | 50 | 823 | 24/25 | 745/844 |
| m+ c+ Ombre | 53,2 | 83 | 116 | 38/107 | 61/119 |
| m+ c+ Anima+Ombre | 51,3 | 34 | 1160 | 23/27 | 853/1181 |

Cosa dicono i numeri:

1. **Il ritardo non nasce nel commit di React.** `tocco` resta tra 23 e 50 ms in ogni passaggio e «memo sì» e «memo no» sono indistinguibili (fermo: 32/46 contro 39/153; Anima+Ombre: 50/51 contro 34/48). La memoizzazione corretta resta, ma non spiega i due secondi.
2. **La scena ferma va bene, anche con le ombre.** Con «fermo» 48-51 fps ed eco di 41-81 ms; con «Ombre» da sole 40-53 fps ed eco di 61-74 ms. Le ombre sfocate costano fotogrammi (40 contro 53 fps con la cache), non ritardo.
3. **Il ritardo compare con «Anima».** L'eco medio sale a 914 ms (745 ms con la cache), e con «Anima+Ombre» senza cache a 2,4-2,7 secondi: coincide con i «due secondi» segnalati. Anche il ritardo del thread JS arriva a 0,8-2,9 secondi.
4. **La cache aiuta molto ma non basta.** Con «Anima+Ombre» porta i fotogrammi da 21 a 51 fps e l'eco medio da 2357 a 853 ms, ma restano ritardi di 0,7-1,2 secondi con tutte le 96 tessere animate.
5. **I fotogrammi da soli ingannano.** Con cache e «Anima+Ombre»: 51 fps, ma eco di 853 ms. Fotogrammi alti e ritardo alto possono coesistere.

Meccanismo probabile, **letto nel codice di React Native Skia 2.6.2** (`sksg/Container.native.js`) e non misurato: ogni proprietà animata è un valore condiviso, e a ogni suo cambiamento un «mapper» rigioca sul thread UI l'intera registrazione di disegno, cioè tutte le tessere, non solo quelle animate. Il costo per fotogramma segue quindi le tessere disegnate, e anche una sola tessera animata rigiocherebbe tutte le 96. Il passaggio «A tutto dal vivo, 2 animate» della Prova 2 serve a verificarlo.

### Prova 2 su dispositivo: l'architettura a strati elimina il ritardo

Misure dell'utente (Android, modalità di produzione; ms salvo indicazione):

| Passaggio | fps | pegg | JS | tocco medio/max | eco medio/max | img |
|---|---|---|---|---|---|---|
| A tutto dal vivo, 2 animate | 49,4 | 83 | 908 | 36/105 | 710/929 | |
| B a strati, 0 vive | 59,2 | 33 | 63 | 28/44 | 35/48 | 555 |
| B a strati, 2 vive | 59,6 | 33 | 42 | 30/62 | 33/60 | 375 |
| B a strati, 8 vive | 58,8 | 33 | 48 | 24/43 | 33/81 | 418 |
| B a strati, 24 vive | 59,7 | 33 | 98 | 44/139 | 42/138 | 439 |
| B a strati, 96 vive | 49,8 | 50 | 955 | 22/28 | 838/975 | 421 |

1. **Il meccanismo è confermato.** Con soltanto 2 tessere animate su 96 disegnate dal vivo l'eco medio è 710 ms e il ritardo del thread JS 908 ms: lo stesso ordine di grandezza di animarle tutte. Il costo dipende da quante tessere sono *disegnate dal vivo*, non da quante si muovono.
2. **A strati il ritardo scompare fino a 24 tessere vive**: circa 59 fps, eco 33-42 ms, ritardo JS al più 98 ms. Con 96 tessere vive torna a 838 ms di eco.
3. **La soglia sta tra 24 e 96 tessere vive.** Nel livello 20 le tessere libere insieme sono al massimo 26-27 (calcolato con i test del dominio su tre politiche di rimozione), quindi il budget necessario è circa 30: serve verificare 26 e 48 (Prova 3).
4. **Ricostruire l'immagine costa 375-555 ms**, troppo per stare nel percorso critico di una rimozione.

### Dal ritardo alla soluzione: le tessere libere restano vive

Una rimozione non deve aspettare la ricostruzione dell'immagine. Se le tessere vive sono **sempre le libere** (le sole che si possono toccare, selezionare o rimuovere) **più quelle in rimozione**, una tessera che sparisce non è mai nell'immagine: la sua animazione è tutta nello strato vivo. L'immagine si ricostruisce *dopo*, in background, per escludere le tessere appena diventate libere; nel frattempo queste sono disegnate due volte con gli stessi pixel (stessa posizione, nessuna differenza visibile). Il pulsante **Partita** e la **Prova 4** mettono alla prova questo schema. Conseguenze per l'app vera:

- Le tessere bloccate (non libere) possono essere attenuate dentro l'immagine; quando diventano libere passano nello strato vivo e si illuminano senza ricostruire nulla.
- Selezione, aiuto e anello «ecco cosa la blocca» sono elementi dello strato vivo o sovrapposti: costano pochi nodi.
- Il rischio residuo è il **fantasma**: una tessera appena liberata e rimossa prima che finisca la ricostruzione (circa 0,4 s) resta visibile nell'immagine finché questa non è pronta. La Prova 4 lo conta.
- Le animazioni di tutte le tessere insieme (ingresso del livello, rimescolo) superano il budget: vanno animate come immagine unica o a gruppi, non tessera per tessera.

Misure dell'utente (Android, modalità di produzione; ms salvo indicazione):

| Passaggio | fps | JS | tocco medio/max | eco medio/max | img medio/max (n) | fantasmi |
|---|---|---|---|---|---|---|
| Prova 3: B 26 vive | 59,6 | 126 | 50/148 | 70/147 | | |
| Prova 3: B 48 vive | 58,8 | 243 | 14/21 | 171/190 | | |
| Prova 3: B 24 vive, cache nello strato fermo | 59,2 | 100 | 36/135 | 64/132 | | |
| Prova 3: B 24 vive, ricostruzione ogni 0,8 s | 58,7 | 385 | 62/347 | 130/418 | 437/487 (10) | |
| Prova 3: B 24 vive, ricostruzione ogni 0,8 s, cache | 59,3 | 115 | 41/151 | 70/136 | 202/257 (10) | |
| Prova 4: partita, strato fermo normale | 59,1 | 282 | 64/395 | 66/293 | 273/451 (34) | 0 |
| Prova 4: partita, strato fermo con cache | 59,1 | 151 | 34/138 | 41/149 | 132/281 (34) | 0 |

Confronto strato fermo / vivo sul dispositivo: 0% di pixel diversi, differenza massima 0/255. Guardando **Partita** l'utente non ha visto difetti di sovrapposizione, ma ha notato le due differenze dall'originale ora corrette (problemi 7 e 9).

### Confronto strato fermo / vivo

Il pulsante **Confronto** disegna la tavola in due immagini fuori schermo (tutte le tessere come nello strato fermo; le stesse tessere avvolte in un gruppo con trasformazione identica, come gli sprite vivi) e confronta i pixel. In Chromium: 0% di pixel diversi, differenza massima 0/255. Sempre in Chromium il confronto tra la tavola normale su schermo e quella a strati mostra invece differenze ai bordi dei disegni (21% dei pixel oltre la soglia): dipende dal modo in cui il browser rasterizza gli SVG come immagini su una superficie GPU e su una fuori schermo, e su nativo non vale (React Native Skia disegna lì gli SVG come vettori). Non è dimostrato che su dispositivo l'aspetto su schermo coincida con quello fuori schermo: va guardato con **Partita**.

### Esito di S1

- **Fedeltà del rendering**: 129 disegni su 129 letti da SkSVG, 127 identici a Chromium e 2 con differenza media sotto 0,001/255, dopo tre accorgimenti: testi in tracciati, SVG con solo `viewBox`, ritaglio sul riquadro del disegno.
- **Architettura**: tavola a strati con **tessere libere sempre vive** e **strato fermo in un'immagine con il corpo delle tessere in cache**. Nella partita simulata: 59 fps, eco medio 41 ms, ricostruzione dell'immagine 132 ms in media (281 al massimo), nessun fantasma. Le soglie proposte (almeno 50 fps, eco sotto 50 ms, ricostruzione media sotto 150 ms, nessun fantasma) sono rispettate **solo con la cache**: senza, eco 66 ms e ricostruzione 273 ms.
- **Budget di tessere vive**: 26 vive vanno bene (eco 70 ms), con 48 degrada (171 ms), con 96 non regge (838 ms). Nel livello 20 le libere sono al massimo 26-27. Le animazioni di tutta la tavola (ingresso del livello, rimescolo) vanno fatte come immagine unica o a gruppi.
- **Rischio residuo**: il simulatore toglie una coppia al secondo; un giocatore veloce può rimuovere una tessera appena liberata prima che finisca la ricostruzione (circa 0,13 s con la cache) e vederla restare un istante (fantasma).
- **Non verificato**: iOS; tablet; un dispositivo di fascia bassa (il modello usato non è indicato); i problemi 7, 8 e 9 sono corretti ma da riguardare a vista; Expo SDK 58.

### Da fare su dispositivo (dopo la correzione)

Aprire **Galleria** e **Partita** e verificare che i disegni stiano dentro la tessera (koala compreso), che la rimozione somigli all'originale (riduzione e rotazione rapide, dissolvenza) e che lettere, numeri e simboli (A M 7 3 K Z 5 9 π ∞ √) siano tutti presenti.
