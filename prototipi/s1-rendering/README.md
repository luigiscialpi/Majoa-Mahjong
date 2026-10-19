# S1 — rendering Skia dei disegni e della tavola (prototipo)

Il prototipo S1 risponde a due domande del README principale (sezione 8): Skia rende fedelmente i 129 disegni esportati dall'originale? E la tavola del livello 20 (96 tessere, 5 piani) con le animazioni gira fluida su un Android di fascia bassa? È un esperimento usa e getta: non fa parte dell'app e il suo codice non si riusa così com'è.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `assets/tiles/000.svg … 128.svg` | I 129 disegni esportati dall'originale (`viewBox 0 0 60 80`), con i testi già convertiti in tracciati |
| `src/data/level20.json` | Geometria del livello 20 dell'originale (96 tessere, 5 piani, 24 disegni). L'assegnazione dei disegni è un campione: l'originale la genera a caso a ogni partita |
| `src/board.ts` | Geometria della tavola, tessera libera (`isFree`), `hitTest`, colonna di gioco 3:4. Funzioni pure, con test in `src/board.test.ts` |
| `src/TileBoard.tsx` | Tavola in un unico `<Canvas>` Skia; animazioni con valori condivisi di Reanimated; tocco con `hitTest` |
| `src/Gallery.tsx` | Griglia dei 129 disegni |
| `src/FpsMeter.tsx` | Misura i fotogrammi sul thread UI (`useFrameCallback`) |
| `src/SvgAt.tsx` | Disegna un SVG in una posizione (aggira un limite di `ImageSVG`, vedi «Problemi trovati») |
| `tools/` | Esportazione dall'originale, conversione dei testi, confronto di fedeltà, prova web |

L'interfaccia ha cinque pulsanti: **Tavola** e **Galleria** cambiano schermata; **Anima** fa oscillare tutte le tessere; **Ombre** aggiunge l'ombra sfocata a ogni tessera (prova più impegnativa); **Entrata** rigioca l'animazione di ingresso a ritardi sfalsati. In alto: caricamento degli SVG, tessere libere, dimensione della tessera, fotogrammi del thread UI e ultima tessera toccata.

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
| Fotogrammi su un Android di fascia bassa | **Non misurato** | Serve un dispositivo (tabella sotto) |

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

### Da misurare su dispositivo

Premere **Anima**, attendere 5 secondi e leggere «Frame UI»; ripetere con **Ombre** attivo; aprire **Galleria** e verificare che tutti i disegni siano presenti, comprese le tessere con lettere, numeri e simboli (A M 7 3 K Z 5 9 π ∞ √). Soglia proposta (da confermare): almeno 50 fps medi con «Anima» e nessun disegno mancante.

| Dispositivo | Android | fps «Anima» | fps «Anima + Ombre» | peggior frame (ms) | SVG caricati (ms) |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
