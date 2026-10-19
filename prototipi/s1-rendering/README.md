# S1 — rendering Skia dei disegni e della tavola (prototipo)

Il prototipo S1 risponde a due domande del README principale (sezione 8): Skia rende fedelmente i 129 disegni esportati dall'originale? E la tavola del livello 20 (96 tessere, 5 piani) con le animazioni gira fluida su un Android di fascia bassa? È un esperimento usa e getta: non fa parte dell'app e il suo codice non si riusa così com'è.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `assets/tiles/000.svg … 128.svg` | I 129 disegni esportati dall'originale (`viewBox 0 0 60 80`), con i testi già convertiti in tracciati |
| `src/data/level20.json` | Geometria del livello 20 dell'originale (96 tessere, 5 piani, 24 disegni). L'assegnazione dei disegni è un campione: l'originale la genera a caso a ogni partita |
| `src/board.ts` | Geometria della tavola, tessera libera (`isFree`), `hitTest`, colonna di gioco 3:4. Funzioni pure, con test in `src/board.test.ts` |
| `src/TileBoard.tsx` | Tavola in un unico `<Canvas>` Skia; animazioni con valori condivisi di Reanimated; tocco con `hitTest` |
| `src/TileBody.tsx` | Corpo della tessera (bordo, ombra, faccia) e sua versione in cache: un'immagine disegnata una volta con `drawAsImage` |
| `src/Gallery.tsx` | Griglia dei 129 disegni |
| `src/FpsMeter.tsx` | Misura i fotogrammi sul thread UI (`useFrameCallback`) e l'eco di andata e ritorno col thread UI |
| `src/perf.ts`, `src/layout.ts` | Ritardo del thread JS; altezza dell'intestazione condivisa con la prova web |
| `src/SvgAt.tsx` | Disegna un SVG in una posizione (aggira un limite di `ImageSVG`, vedi «Problemi trovati») |
| `tools/` | Esportazione dall'originale, conversione dei testi, confronto di fedeltà, prova web |

L'interfaccia ha otto pulsanti: **Tavola** e **Galleria** cambiano schermata; **Anima** fa oscillare tutte le tessere; **Ombre** aggiunge l'ombra sfocata a ogni tessera (prova più impegnativa); **Entrata** rigioca l'animazione di ingresso a ritardi sfalsati; **Memo** attiva o disattiva la stabilità delle proprietà delle tessere (spiegata sotto); **Cache** disegna il corpo delle tessere come immagine in cache; **Prova** esegue la prova automatica. In alto: caricamento degli SVG, tessere libere, dimensione della tessera, fotogrammi del thread UI, ritardo dall'ultimo tocco al commit di React e ultima tessera toccata.

## Prova automatica

Il pulsante **Prova** esegue 10 passaggi di 6,5 secondi (1,5 di riscaldamento e 5 di misura) e mostra una tabella; l'esito va anche nel log con il prefisso `S1-BENCH`. In ogni passaggio simula un tocco ogni 0,4 secondi su una tessera libera diversa. Colonne: `m` memo, `c` cache del corpo (+ attivo, − spento); fps medi del thread UI; `pegg` = peggior fotogramma; `JS` = ritardo massimo del thread JS (un timer da 20 ms che arriva in ritardo); `tocco` = tempo medio e massimo dal gesto al commit di React; `eco` = andata e ritorno di un messaggio JS → thread UI → JS, medio e massimo. Tutti i tempi sono in millisecondi.

Per misure realistiche eseguire l'app in modalità di produzione, senza i controlli di sviluppo di React: `npx expo start --no-dev --minify`. Il primo test su dispositivo (sotto) è stato probabilmente fatto in modalità di sviluppo, che rallenta il thread JS.

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
| Ritardo della selezione al tocco | **Problema aperto**: sul dispositivo la selezione arrivava dopo circa 2 secondi | Segnalato dall'utente; la prova automatica serve a isolarne la causa |

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

### Ritardo al tocco: ipotesi e correzioni

La causa non è stata isolata. Ipotesi, in ordine:

1. **Tutte le 96 tessere si ridisegnavano a ogni tocco.** Verificato leggendo il codice: a `React.memo` passavo un oggetto `rect` nuovo a ogni render, quindi la memoizzazione non funzionava. Il gesto di tocco veniva inoltre ricreato a ogni render. Corretto (pulsante **Memo** per il confronto). In Chromium il confronto memo sì/no non mostra differenze misurabili; l'effetto su Hermes in sviluppo è ignoto.
2. **Il costo dell'ombra sfocata per 96 tessere a ogni fotogramma** (soprattutto con «Anima», che cambia la trasformazione di ogni tessera). Rimedio sperimentale: **Cache**, che disegna il corpo della tessera una volta sola con `drawAsImage`. Prova in Chromium con WebGL software (indicativa, non rappresentativa di un dispositivo): con «Ombre» da 2,2 a 41 fps; con «Anima+Ombre» da 1,2 a 8,3 fps e ritardo massimo del tocco da circa 1000 a circa 170 ms.
3. **Modalità di sviluppo**: il codice di React in sviluppo è molto più lento. Da escludere con `--no-dev --minify`.

Come distinguere le cause con la tabella della prova: se `JS` e `tocco` sono alti anche con «fermo», pesa il thread JS (ipotesi 1 o 3); se sono bassi ma `eco` e `pegg` salgono con «Ombre», pesa il disegno (ipotesi 2); se `fps` resta alto ma il ritardo si sente, il collo di bottiglia è dopo il thread UI (coda di fotogrammi della GPU) e la tabella non lo vede.

### Da misurare su dispositivo

Eseguire **Prova** (in modalità di produzione, vedi sopra) e riportare la tabella; poi aprire **Galleria** e verificare che tutti i disegni siano presenti, comprese le tessere con lettere, numeri e simboli (A M 7 3 K Z 5 9 π ∞ √). Soglia proposta (da confermare): almeno 50 fps medi con «Anima» e nessun disegno mancante; selezione del tocco senza ritardo percepibile.

| Dispositivo | Android | Modalità | Esito della prova (riga «m+ c+ Anima+Ombre») |
|---|---|---|---|
|  |  |  |  |
